import { ZodSchema, ZodObject } from 'zod';
import { ResolvedConfig, MCPInvocationContext, FileConfigSource, EnvVarConfigSource } from './types';
import { parseMCPConfig, ParseMCPConfigOptions } from './parser';
import { MCPContextError } from './errors';
import { Logger } from '../types';
import { resolveEnvVarConfig } from '../env/resolver';

/**
 * Options for resolving configuration from MCP, file, or environment variable sources.
 */
export interface ConfigResolverOptions {
    /**
     * Zod schema to validate configuration against.
     */
    schema: ZodSchema;

    /**
     * Options for parsing MCP configuration.
     */
    mcpOptions?: ParseMCPConfigOptions;

    /**
     * Logger for debugging and informational messages.
     */
    logger?: Logger;

    /**
     * Function to resolve configuration from files.
     * This is called when MCP configuration is not provided.
     * 
     * @param workingDirectory - Directory to start file discovery from
     * @returns Promise resolving to a FileConfigSource
     */
    resolveFileConfig?: (workingDirectory: string) => Promise<FileConfigSource>;

    /**
     * Application name for environment variable prefix generation.
     * Required if environment variable resolution is enabled.
     * 
     * @example 'riotplan' generates env vars like RIOTPLAN_PLAN_DIRECTORY
     */
    appName?: string;

    /**
     * Custom environment variable name mappings.
     * Maps config field names to custom env var names.
     * 
     * @example { openaiApiKey: 'OPENAI_API_KEY' }
     */
    envVarMap?: Record<string, string>;

    /**
     * Disable environment variable resolution.
     * When true, env vars are not checked even if appName is provided.
     * 
     * @default false
     */
    disableEnvVars?: boolean;
}

/**
 * Resolves configuration using the MCP priority model.
 * 
 * **Priority Model:**
 * 1. If MCP config is present → use it exclusively
 * 2. If MCP config is absent → try file-based discovery
 * 3. If no file config found → try environment variables
 * 4. No merging between sources
 * 
 * This priority model makes configuration predictable and debuggable.
 * Each source is checked in order, and the first one found is used exclusively.
 * 
 * @template T - The configuration type
 * @param context - MCP invocation context
 * @param options - Resolution options including schema and resolvers
 * @returns Promise resolving to a ResolvedConfig with source tracking
 * @throws {MCPContextError} When no configuration source is available
 * @throws {MCPConfigError} When MCP config is invalid
 * 
 * @example
 * ```typescript
 * const context: MCPInvocationContext = {
 *   config: { port: 3000, host: 'localhost' },
 *   workingDirectory: '/app',
 * };
 * 
 * const resolved = await resolveConfig(context, {
 *   schema: myConfigSchema,
 *   appName: 'myapp',
 *   logger: console,
 * });
 * 
 * console.log(resolved.resolution); // "Configuration loaded from MCP invocation"
 * ```
 */
export async function resolveConfig<T = unknown>(
    context: MCPInvocationContext,
    options: ConfigResolverOptions
): Promise<ResolvedConfig<T>> {
    const logger = options.logger;

    // Priority 1: Check for MCP configuration
    if (context.config !== undefined) {
        logger?.debug('MCP configuration detected, using MCP config exclusively');

        const mcpSource = await parseMCPConfig(
            context.config,
            options.schema,
            options.mcpOptions
        );

        logger?.info('Configuration loaded from MCP invocation');

        return {
            source: mcpSource,
            config: context.config as T,
            hierarchical: false,
            resolution: 'Configuration loaded from MCP invocation',
        };
    }

    // Priority 2: Try file-based discovery
    logger?.debug('No MCP configuration provided, trying file-based discovery');

    if (context.workingDirectory && options.resolveFileConfig) {
        try {
            const fileSource = await options.resolveFileConfig(context.workingDirectory);

            logger?.info(`Configuration loaded from file: ${fileSource.filePath}`);

            return {
                source: fileSource,
                config: fileSource as unknown as T,
                hierarchical: fileSource.parents !== undefined && fileSource.parents.length > 0,
                resolution: explainFileResolution(fileSource),
            };
        } catch {
            logger?.debug('File-based discovery failed, trying environment variables');
        }
    }

    // Priority 3: Try environment variables
    if (!options.disableEnvVars && options.appName && options.schema instanceof ZodObject) {
        logger?.debug('Trying environment variable resolution');

        const envResult = await resolveEnvVarConfig(options.schema, {
            appName: options.appName,
            envVarMap: options.envVarMap,
        });

        if (envResult) {
            logger?.info(`Configuration loaded from environment variables (${envResult.source.values.size} vars)`);

            // Convert env source to MCP ConfigSource format
            const envSource: EnvVarConfigSource = {
                type: 'env',
                variables: new Map(
                    Array.from(envResult.source.values.entries()).map(([_key, result]) => [
                        result.envVarName,
                        { value: result.value!, isCustom: result.isCustom }
                    ])
                ),
                readAt: envResult.source.readAt,
            };

            return {
                source: envSource,
                config: envResult.config as T,
                hierarchical: false,
                resolution: explainEnvResolution(envSource),
            };
        }
    }

    // No configuration found
    throw new MCPContextError(
        'No configuration found. Tried: ' +
        (context.config !== undefined ? 'MCP config, ' : '') +
        (context.workingDirectory ? 'file-based discovery, ' : '') +
        (!options.disableEnvVars && options.appName ? 'environment variables' : '')
    );
}

/**
 * Generates a human-readable explanation of how configuration was resolved.
 * 
 * This is useful for:
 * - Debugging configuration issues
 * - The CheckConfig tool
 * - User-facing error messages
 * 
 * @param resolved - The resolved configuration
 * @returns Human-readable explanation string
 * 
 * @example
 * ```typescript
 * const explanation = explainResolution(resolved);
 * // "Configuration loaded from MCP invocation"
 * // "Configuration loaded from /app/config.yaml"
 * // "Configuration merged from 3 files: /app/config.yaml, /app/src/config.yaml, /app/src/api/config.yaml"
 * // "Configuration loaded from 5 environment variables"
 * ```
 */
export function explainResolution(resolved: ResolvedConfig): string {
    if (resolved.source.type === 'mcp') {
        return 'Configuration loaded from MCP invocation';
    }

    if (resolved.source.type === 'env') {
        return explainEnvResolution(resolved.source);
    }

    return explainFileResolution(resolved.source);
}

/**
 * Explains how file-based configuration was resolved.
 * 
 * @param fileSource - The file configuration source
 * @returns Human-readable explanation
 */
function explainFileResolution(fileSource: FileConfigSource): string {
    if (!fileSource.parents || fileSource.parents.length === 0) {
        return `Configuration loaded from ${fileSource.filePath}`;
    }

    const allFiles = [fileSource, ...fileSource.parents]
        .map(source => source.filePath)
        .join(', ');

    const count = fileSource.parents.length + 1;

    return `Configuration merged from ${count} files: ${allFiles}`;
}

/**
 * Explains how environment variable configuration was resolved.
 * 
 * @param envSource - The environment variable configuration source
 * @returns Human-readable explanation
 */
function explainEnvResolution(envSource: EnvVarConfigSource): string {
    const count = envSource.variables.size;
    const customCount = Array.from(envSource.variables.values())
        .filter(v => v.isCustom).length;

    if (customCount === 0) {
        return `Configuration loaded from ${count} environment variable${count === 1 ? '' : 's'}`;
    }

    return `Configuration loaded from ${count} environment variable${count === 1 ? '' : 's'} (${customCount} custom)`;
}

/**
 * Checks if a configuration was loaded from MCP.
 * 
 * @param resolved - The resolved configuration
 * @returns True if configuration came from MCP
 * 
 * @example
 * ```typescript
 * if (isMCPConfig(resolved)) {
 *   console.log('Using MCP-provided configuration');
 * }
 * ```
 */
export function isMCPConfig(resolved: ResolvedConfig): boolean {
    return resolved.source.type === 'mcp';
}

/**
 * Checks if a configuration was loaded from files.
 * 
 * @param resolved - The resolved configuration
 * @returns True if configuration came from files
 * 
 * @example
 * ```typescript
 * if (isFileConfig(resolved)) {
 *   console.log(`Config file: ${resolved.source.filePath}`);
 * }
 * ```
 */
export function isFileConfig(resolved: ResolvedConfig): boolean {
    return resolved.source.type === 'file';
}

/**
 * Checks if a configuration was loaded from environment variables.
 * 
 * @param resolved - The resolved configuration
 * @returns True if configuration came from environment variables
 * 
 * @example
 * ```typescript
 * if (isEnvConfig(resolved)) {
 *   console.log(`Config from ${resolved.source.variables.size} env vars`);
 * }
 * ```
 */
export function isEnvConfig(resolved: ResolvedConfig): boolean {
    return resolved.source.type === 'env';
}

/**
 * Gets the list of all configuration files that contributed to the resolved config.
 * 
 * For MCP configs, returns an empty array.
 * For file configs, returns the main file and all parent files.
 * 
 * @param resolved - The resolved configuration
 * @returns Array of file paths
 * 
 * @example
 * ```typescript
 * const files = getConfigFiles(resolved);
 * console.log('Config loaded from:', files.join(', '));
 * ```
 */
export function getConfigFiles(resolved: ResolvedConfig): string[] {
    if (resolved.source.type === 'mcp' || resolved.source.type === 'env') {
        return [];
    }

    const fileSource = resolved.source;
    const files = [fileSource.filePath];

    if (fileSource.parents) {
        files.push(...fileSource.parents.map((parent: FileConfigSource) => parent.filePath));
    }

    return files;
}
