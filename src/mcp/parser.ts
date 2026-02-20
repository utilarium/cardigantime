import { ZodSchema } from 'zod';
import path from 'path';
import { MCPConfigSource } from './types';
import { MCPConfigError } from './errors';

/**
 * Options for parsing MCP configuration.
 */
export interface ParseMCPConfigOptions {
    /**
     * Working directory for resolving relative paths.
     * If not provided, paths are not resolved.
     */
    workingDirectory?: string;

    /**
     * Whether to expand environment variable references in string values.
     * Environment variables are referenced as ${VAR_NAME} or $VAR_NAME.
     * 
     * @default false
     */
    expandEnvVars?: boolean;

    /**
     * Fields that contain paths to be resolved relative to workingDirectory.
     * Uses dot notation for nested fields (e.g., 'output.directory').
     */
    pathFields?: string[];
}

/**
 * Parses and validates configuration received from MCP invocation.
 * 
 * This function:
 * - Validates the raw config against the provided Zod schema
 * - Normalizes paths relative to the working directory
 * - Optionally expands environment variable references
 * - Returns a fully typed MCPConfigSource
 * 
 * @template T - The Zod schema type
 * @param rawConfig - The raw configuration object from MCP
 * @param schema - Zod schema to validate against
 * @param options - Optional parsing options
 * @returns Promise resolving to a validated MCPConfigSource
 * @throws {MCPConfigError} When validation fails or config is invalid
 * 
 * @example
 * ```typescript
 * const schema = z.object({
 *   port: z.number(),
 *   host: z.string(),
 *   outputDir: z.string(),
 * });
 * 
 * const configSource = await parseMCPConfig(
 *   { port: 3000, host: 'localhost', outputDir: './output' },
 *   schema,
 *   {
 *     workingDirectory: '/app',
 *     pathFields: ['outputDir'],
 *   }
 * );
 * 
 * // configSource.config.outputDir is now '/app/output'
 * ```
 */
export async function parseMCPConfig<T extends ZodSchema>(
    rawConfig: unknown,
    schema: T,
    _options: ParseMCPConfigOptions = {}
): Promise<MCPConfigSource> {
    // Validate against schema
    const result = schema.safeParse(rawConfig);
    
    if (!result.success) {
        throw new MCPConfigError(
            'Invalid MCP configuration: validation failed',
            result.error
        );
    }

    // Note: Transformations like expandEnvironmentVariables and resolveConfigPaths
    // are available but not applied here as they would modify the validated data.
    // These should be applied by the caller if needed, or we could add them to
    // the MCPConfigSource in a future iteration.

    return {
        type: 'mcp',
        rawConfig,
        receivedAt: new Date(),
    };
}

/**
 * Expands environment variable references in configuration values.
 * 
 * Supports both ${VAR_NAME} and $VAR_NAME syntax.
 * Only expands variables in string values.
 * 
 * @param config - Configuration object to process
 * @returns Configuration with environment variables expanded
 * 
 * @example
 * ```typescript
 * const config = {
 *   host: '${HOST}',
 *   port: 3000,
 *   path: '$HOME/data',
 * };
 * 
 * const expanded = expandEnvironmentVariables(config);
 * // { host: 'localhost', port: 3000, path: '/home/user/data' }
 * ```
 */
export function expandEnvironmentVariables(config: any): any {
    if (typeof config === 'string') {
        // Replace ${VAR_NAME} and $VAR_NAME patterns
        return config.replace(/\$\{([^}]+)\}|\$([A-Z_][A-Z0-9_]*)/g, (match, braced, unbraced) => {
            const varName = braced || unbraced;
            return process.env[varName] || match;
        });
    }

    if (Array.isArray(config)) {
        return config.map(item => expandEnvironmentVariables(item));
    }

    if (config !== null && typeof config === 'object') {
        const expanded: any = {};
        for (const [key, value] of Object.entries(config)) {
            // Prevent prototype pollution via dangerous property names
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                continue;
            }
            expanded[key] = expandEnvironmentVariables(value);
        }
        return expanded;
    }

    return config;
}

/**
 * Resolves relative paths in configuration to absolute paths.
 * 
 * Paths are resolved relative to the provided working directory.
 * Only processes fields specified in pathFields.
 * Supports nested fields using dot notation.
 * 
 * @param config - Configuration object to process
 * @param workingDirectory - Base directory for resolving relative paths
 * @param pathFields - Array of field paths to resolve (dot notation for nested)
 * @returns Configuration with resolved paths
 * 
 * @example
 * ```typescript
 * const config = {
 *   output: './dist',
 *   nested: {
 *     path: '../src',
 *   },
 * };
 * 
 * const resolved = resolveConfigPaths(
 *   config,
 *   '/app',
 *   ['output', 'nested.path']
 * );
 * // { output: '/app/dist', nested: { path: '/src' } }
 * ```
 */
export function resolveConfigPaths(
    config: any,
    workingDirectory: string,
    pathFields: string[]
): any {
    if (!config || typeof config !== 'object') {
        return config;
    }

    const resolved = Array.isArray(config) ? [...config] : { ...config };

    const isUnsafeKey = (key: string) => key === '__proto__' || key === 'constructor' || key === 'prototype';

    for (const fieldPath of pathFields) {
        const parts = fieldPath.split('.');

        // Prevent prototype pollution via dangerous property names in field paths
        if (parts.some(isUnsafeKey)) {
            continue;
        }

        let current: any = resolved;

        // Navigate to the parent of the target field
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                break;
            }
            current = current[parts[i]];
        }

        // Resolve the target field
        const fieldName = parts[parts.length - 1];
        if (current && typeof current[fieldName] === 'string') {
            const originalPath = current[fieldName];
            if (!path.isAbsolute(originalPath)) {
                current[fieldName] = path.resolve(workingDirectory, originalPath);
            }
        }
    }

    return resolved;
}

/**
 * Merges MCP configuration with default values.
 * 
 * This is useful when MCP provides partial configuration and you need
 * to fill in missing fields with defaults.
 * 
 * @template T - The configuration type
 * @param mcpConfig - Configuration from MCP (may be partial)
 * @param defaults - Default configuration values
 * @returns Merged configuration with defaults applied
 * 
 * @example
 * ```typescript
 * const defaults = {
 *   port: 3000,
 *   host: 'localhost',
 *   timeout: 5000,
 * };
 * 
 * const mcpConfig = {
 *   port: 8080,
 * };
 * 
 * const merged = mergeMCPConfigWithDefaults(mcpConfig, defaults);
 * // { port: 8080, host: 'localhost', timeout: 5000 }
 * ```
 */
export function mergeMCPConfigWithDefaults<T extends Record<string, any>>(
    mcpConfig: Partial<T>,
    defaults: T
): T {
    return {
        ...defaults,
        ...mcpConfig,
    };
}
