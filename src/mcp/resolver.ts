import { ZodSchema } from 'zod';
import { ResolvedConfig, MCPInvocationContext, FileConfigSource } from './types';
import { parseMCPConfig, ParseMCPConfigOptions } from './parser';
import { MCPContextError } from './errors';
import { Logger } from '../types';

/**
 * Options for resolving configuration from MCP or file sources.
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
}

/**
 * Resolves configuration using the MCP priority model.
 * 
 * **Priority Model (Simplifying Assumption):**
 * 1. If MCP config is present → use it exclusively (no file fallback)
 * 2. If MCP config is absent → fall back to file-based discovery
 * 3. No merging between MCP and file configs
 * 
 * This "simplifying assumption" makes configuration predictable and debuggable.
 * When an AI assistant provides config via MCP, that's the complete configuration.
 * 
 * @template T - The configuration type
 * @param context - MCP invocation context
 * @param options - Resolution options including schema and file resolver
 * @returns Promise resolving to a ResolvedConfig with source tracking
 * @throws {MCPContextError} When neither MCP config nor working directory is provided
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

    // Priority 2: Fall back to file-based discovery
    logger?.debug('No MCP configuration provided, falling back to file-based discovery');

    if (!context.workingDirectory) {
        throw new MCPContextError(
            'MCP invocation must provide either config or workingDirectory. ' +
            'Without config, workingDirectory is required for file-based discovery.'
        );
    }

    if (!options.resolveFileConfig) {
        throw new MCPContextError(
            'File-based config fallback requested but no resolveFileConfig function provided'
        );
    }

    const fileSource = await options.resolveFileConfig(context.workingDirectory);

    logger?.info(`Configuration loaded from file: ${fileSource.filePath}`);

    return {
        source: fileSource,
        config: fileSource as unknown as T,
        hierarchical: fileSource.parents !== undefined && fileSource.parents.length > 0,
        resolution: explainFileResolution(fileSource),
    };
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
 * ```
 */
export function explainResolution(resolved: ResolvedConfig): string {
    if (resolved.source.type === 'mcp') {
        return 'Configuration loaded from MCP invocation';
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
    if (resolved.source.type === 'mcp') {
        return [];
    }

    const fileSource = resolved.source;
    const files = [fileSource.filePath];

    if (fileSource.parents) {
        files.push(...fileSource.parents.map(parent => parent.filePath));
    }

    return files;
}
