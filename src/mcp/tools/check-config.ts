import { ZodSchema } from 'zod';
import { ResolvedConfig, MCPInvocationContext } from '../types';
import { resolveConfig, getConfigFiles } from '../resolver';
import {
    CheckConfigInput,
    CheckConfigResult,
    ConfigValueSource,
    isSensitiveField,
    sanitizeValue,
} from './check-config-types';

/**
 * Options for the CheckConfig tool.
 */
export interface CheckConfigOptions {
    /**
     * Application name for documentation links.
     */
    appName: string;

    /**
     * Zod schema for configuration validation.
     */
    schema: ZodSchema;

    /**
     * Base URL for documentation.
     * @default "https://github.com/utilarium/cardigantime"
     */
    docsBaseUrl?: string;

    /**
     * Function to resolve file-based configuration.
     * Required when MCP config is not provided.
     */
    resolveFileConfig?: (workingDirectory: string) => Promise<any>;
}

/**
 * Implements the CheckConfig tool for MCP servers.
 * 
 * This tool helps AI assistants understand how a tool is configured by:
 * - Showing where configuration came from (MCP, file, or defaults)
 * - Displaying the resolved configuration (with sensitive values sanitized)
 * - Providing links to relevant documentation
 * - Optionally showing detailed breakdown of config sources
 * 
 * @param input - Tool input parameters
 * @param context - MCP invocation context
 * @param options - Tool configuration options
 * @returns Promise resolving to CheckConfigResult
 * 
 * @example
 * ```typescript
 * const result = await checkConfig(
 *   { verbose: true },
 *   { config: { port: 3000 } },
 *   { appName: 'myapp', schema: mySchema }
 * );
 * 
 * console.log(result.summary);
 * // "Configuration loaded from MCP invocation"
 * ```
 */
export async function checkConfig(
    input: CheckConfigInput,
    context: MCPInvocationContext,
    options: CheckConfigOptions
): Promise<CheckConfigResult> {
    // Resolve configuration using the MCP priority model
    const resolved = await resolveConfig(context, {
        schema: options.schema,
        resolveFileConfig: options.resolveFileConfig,
    });

    // Get configuration paths (empty for MCP)
    const configPaths = getConfigFiles(resolved);

    // Sanitize configuration for output
    const sanitizedConfig = input.includeConfig !== false
        ? sanitizeConfig(resolved.config as Record<string, unknown>)
        : undefined;

    // Generate value breakdown for verbose mode
    const valueBreakdown = input.verbose
        ? generateValueBreakdown(resolved, sanitizedConfig)
        : undefined;

    // Generate documentation links
    const documentation = generateDocLinks(options.appName, options.docsBaseUrl);

    // Detect any warnings
    const warnings = detectWarnings(resolved);

    return {
        source: resolved.source.type,
        configPaths: configPaths.length > 0 ? configPaths : undefined,
        hierarchical: resolved.hierarchical,
        config: sanitizedConfig,
        valueBreakdown,
        summary: resolved.resolution,
        documentation,
        warnings: warnings.length > 0 ? warnings : undefined,
    };
}

/**
 * Sanitizes a configuration object by masking sensitive values.
 * 
 * Recursively walks through the configuration and replaces sensitive
 * values with "***" to prevent accidental exposure.
 * 
 * @param config - Configuration object to sanitize
 * @param path - Current path in the object (for nested fields)
 * @returns Sanitized configuration object
 */
export function sanitizeConfig(
    config: Record<string, unknown>,
    path: string = ''
): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
        const fieldPath = path ? `${path}.${key}` : key;

        if (isSensitiveField(fieldPath)) {
            // Sanitize sensitive field
            sanitized[key] = sanitizeValue(value);
        } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            // Recursively sanitize nested objects
            sanitized[key] = sanitizeConfig(value as Record<string, unknown>, fieldPath);
        } else if (Array.isArray(value)) {
            // Sanitize array elements
            sanitized[key] = value.map((item, index) => {
                if (item !== null && typeof item === 'object') {
                    return sanitizeConfig(item as Record<string, unknown>, `${fieldPath}[${index}]`);
                }
                return item;
            });
        } else {
            // Keep non-sensitive values as-is
            sanitized[key] = value;
        }
    }

    return sanitized;
}

/**
 * Generates a breakdown of where each configuration value came from.
 * 
 * This is useful in verbose mode to understand hierarchical merging
 * and which files contributed which values.
 * 
 * @param resolved - Resolved configuration
 * @param sanitizedConfig - Sanitized configuration object
 * @returns Array of value sources
 */
function generateValueBreakdown(
    resolved: ResolvedConfig,
    sanitizedConfig?: Record<string, unknown>
): ConfigValueSource[] {
    if (!sanitizedConfig) {
        return [];
    }

    const breakdown: ConfigValueSource[] = [];

    // For MCP configs, all values come from MCP
    if (resolved.source.type === 'mcp') {
        flattenConfig(sanitizedConfig, '', breakdown, 'MCP invocation');
        return breakdown;
    }

    if (resolved.source.type === 'env') {
        flattenConfig(sanitizedConfig, '', breakdown, 'Environment variables');
        return breakdown;
    }

    // For file configs, show the primary source
    // (detailed per-value tracking would require more complex implementation)
    const primarySource = resolved.source.filePath;
    flattenConfig(sanitizedConfig, '', breakdown, primarySource);

    return breakdown;
}

/**
 * Flattens a nested configuration object into a list of field paths and values.
 * 
 * @param config - Configuration object to flatten
 * @param prefix - Current path prefix
 * @param result - Array to accumulate results
 * @param source - Source identifier for these values
 */
function flattenConfig(
    config: Record<string, unknown>,
    prefix: string,
    result: ConfigValueSource[],
    source: string
): void {
    for (const [key, value] of Object.entries(config)) {
        const field = prefix ? `${prefix}.${key}` : key;

        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            // Recursively flatten nested objects
            flattenConfig(value as Record<string, unknown>, field, result, source);
        } else {
            // Add leaf value to result
            result.push({
                field,
                value,
                source,
                sanitized: isSensitiveField(field),
            });
        }
    }
}

/**
 * Generates documentation links for the tool.
 * 
 * @param appName - Application name
 * @param baseUrl - Base URL for documentation
 * @returns Documentation links object
 */
function generateDocLinks(appName: string, baseUrl?: string): CheckConfigResult['documentation'] {
    const base = baseUrl || 'https://github.com/utilarium/cardigantime';

    return {
        configGuide: `${base}#configuration`,
        formatReference: `${base}#supported-formats`,
        mcpGuide: `${base}#mcp-integration`,
    };
}

/**
 * Detects potential issues or warnings in the configuration.
 * 
 * @param resolved - Resolved configuration
 * @returns Array of warning messages
 */
function detectWarnings(resolved: ResolvedConfig): string[] {
    const warnings: string[] = [];

    // Warn if using defaults (no config found)
    if (resolved.source.type === 'file' && !resolved.source.filePath) {
        warnings.push('No configuration file found. Using default values.');
    }

    // Warn if hierarchical mode found many configs
    if (resolved.hierarchical && resolved.source.type === 'file') {
        const parents = resolved.source.parents || [];
        if (parents.length > 3) {
            warnings.push(
                `Configuration merged from ${parents.length + 1} files. ` +
                'Consider consolidating to improve maintainability.'
            );
        }
    }

    return warnings;
}

/**
 * Creates a CheckConfig tool handler for MCP servers.
 * 
 * This is a convenience function that returns a handler function
 * ready to be registered with an MCP server.
 * 
 * @param options - Tool configuration options
 * @returns Tool handler function
 * 
 * @example
 * ```typescript
 * const handler = createCheckConfigHandler({
 *   appName: 'myapp',
 *   schema: myConfigSchema,
 *   resolveFileConfig: async (dir) => loadConfig(dir),
 * });
 * 
 * server.registerTool('check_config', handler);
 * ```
 */
export function createCheckConfigHandler(options: CheckConfigOptions) {
    return async (
        input: CheckConfigInput,
        context: MCPInvocationContext
    ): Promise<CheckConfigResult> => {
        return checkConfig(input, context, options);
    };
}
