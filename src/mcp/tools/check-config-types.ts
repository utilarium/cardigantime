/**
 * Type definitions for the CheckConfig MCP tool.
 * 
 * CheckConfig is a built-in diagnostic tool available in all CardiganTime-based
 * MCP servers. It helps AI assistants understand how a tool is configured.
 * 
 * @module mcp/tools/check-config
 */

/**
 * Input parameters for the CheckConfig tool.
 */
export interface CheckConfigInput {
    /**
     * Optional file path to check configuration for.
     * 
     * When provided, the tool will determine the most relevant configuration
     * for this specific file (useful in hierarchical mode).
     * 
     * @example "/app/src/api/handler.ts"
     */
    targetFile?: string;

    /**
     * Whether to include detailed configuration breakdown.
     * 
     * When true, includes:
     * - All config sources that were checked
     * - Merge order (if hierarchical)
     * - Which values came from which source
     * 
     * @default false
     */
    verbose?: boolean;

    /**
     * Whether to include the full resolved configuration.
     * 
     * When false, only shows a summary without the actual config values.
     * Useful when you only need to know where config comes from.
     * 
     * @default true
     */
    includeConfig?: boolean;
}

/**
 * Source type for configuration.
 */
export type ConfigSourceType = 'mcp' | 'file' | 'defaults';

/**
 * Information about a configuration value's source.
 */
export interface ConfigValueSource {
    /**
     * The configuration field path (dot notation).
     * @example "server.port"
     */
    field: string;

    /**
     * The value of the field (sanitized if sensitive).
     */
    value: unknown;

    /**
     * Where this value came from.
     */
    source: string;

    /**
     * Whether this value was sanitized for security.
     */
    sanitized: boolean;
}

/**
 * Result of the CheckConfig tool.
 */
export interface CheckConfigResult {
    /**
     * Where the configuration came from.
     */
    source: ConfigSourceType;

    /**
     * If file-based, the path(s) to configuration files.
     * Ordered from most specific (closest) to least specific (furthest).
     */
    configPaths?: string[];

    /**
     * Whether hierarchical configuration lookup was used.
     */
    hierarchical: boolean;

    /**
     * The resolved configuration (with sensitive values sanitized).
     * Only included if includeConfig is true.
     */
    config?: Record<string, unknown>;

    /**
     * Detailed breakdown of where each config value came from.
     * Only included in verbose mode.
     */
    valueBreakdown?: ConfigValueSource[];

    /**
     * Human-readable summary of the configuration.
     * 
     * @example "Configuration loaded from MCP invocation"
     * @example "Configuration merged from 3 files: /app/config.yaml, /app/src/config.yaml, /app/src/api/config.yaml"
     */
    summary: string;

    /**
     * Links to relevant documentation.
     */
    documentation: {
        /**
         * Link to configuration guide.
         */
        configGuide: string;

        /**
         * Link to format reference (YAML, JSON, JS, TS).
         */
        formatReference: string;

        /**
         * Link to MCP integration guide.
         */
        mcpGuide: string;
    };

    /**
     * Warnings or issues detected in the configuration.
     */
    warnings?: string[];
}

/**
 * MCP tool descriptor for CheckConfig.
 * 
 * This follows the MCP protocol specification for tool definitions.
 */
export interface CheckConfigToolDescriptor {
    /**
     * Tool name (always 'check_config').
     */
    name: 'check_config';

    /**
     * Human-readable description of what the tool does.
     */
    description: string;

    /**
     * JSON Schema for the tool's input parameters.
     */
    inputSchema: {
        type: 'object';
        properties: {
            targetFile?: {
                type: 'string';
                description: string;
            };
            verbose?: {
                type: 'boolean';
                description: string;
                default: boolean;
            };
            includeConfig?: {
                type: 'boolean';
                description: string;
                default: boolean;
            };
        };
        additionalProperties: boolean;
    };
}

/**
 * Standard CheckConfig tool descriptor.
 * 
 * This can be used directly when registering the tool with an MCP server.
 * 
 * @example
 * ```typescript
 * server.registerTool(CHECK_CONFIG_TOOL_DESCRIPTOR, async (input) => {
 *   return await checkConfig(input);
 * });
 * ```
 */
export const CHECK_CONFIG_TOOL_DESCRIPTOR: CheckConfigToolDescriptor = {
    name: 'check_config',
    description: 
        'Check and display the current configuration for this tool. ' +
        'Shows where configuration came from (MCP, file, or defaults), ' +
        'which files were used, and the resolved configuration values. ' +
        'Use this to debug configuration issues or understand how the tool is configured.',
    inputSchema: {
        type: 'object',
        properties: {
            targetFile: {
                type: 'string',
                description: 
                    'Optional file path to check configuration for. ' +
                    'When provided, shows the most relevant configuration for this file ' +
                    '(useful in hierarchical mode).',
            },
            verbose: {
                type: 'boolean',
                description: 
                    'Include detailed breakdown of configuration sources and merge order. ' +
                    'Shows which values came from which files.',
                default: false,
            },
            includeConfig: {
                type: 'boolean',
                description: 
                    'Include the full resolved configuration in the output. ' +
                    'When false, only shows summary information.',
                default: true,
            },
        },
        additionalProperties: false,
    },
};

/**
 * Patterns for detecting sensitive configuration fields.
 * 
 * These patterns are used to sanitize sensitive values in CheckConfig output.
 */
export const SENSITIVE_FIELD_PATTERNS = [
    /password/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,
    /auth/i,
    /credential/i,
    /private[_-]?key/i,
    /access[_-]?key/i,
];

/**
 * Checks if a field name indicates sensitive data.
 * 
 * @param fieldName - The field name to check
 * @returns True if the field appears to contain sensitive data
 * 
 * @example
 * ```typescript
 * isSensitiveField('apiKey'); // true
 * isSensitiveField('password'); // true
 * isSensitiveField('port'); // false
 * ```
 */
export function isSensitiveField(fieldName: string): boolean {
    return SENSITIVE_FIELD_PATTERNS.some(pattern => pattern.test(fieldName));
}

/**
 * Sanitizes a sensitive value for display.
 * 
 * @param value - The value to sanitize
 * @returns Sanitized value (e.g., "***")
 * 
 * @example
 * ```typescript
 * sanitizeValue('my-secret-key'); // "***"
 * sanitizeValue(12345); // "***"
 * ```
 */
export function sanitizeValue(_value: unknown): string {
    return '***';
}
