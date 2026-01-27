import { ConfigFormat } from "../types";

/**
 * Configuration source from an MCP (Model Context Protocol) server invocation.
 * 
 * MCP servers receive configuration as JSON in the server invocation context.
 * This type tracks the raw configuration received from the MCP environment
 * and when it was received.
 * 
 * @example
 * ```typescript
 * const mcpSource: MCPConfigSource = {
 *   type: 'mcp',
 *   rawConfig: { features: ['validation'], maxRetries: 3 },
 *   receivedAt: new Date(),
 * };
 * ```
 */
export interface MCPConfigSource {
    /** Source type discriminator */
    type: 'mcp';
    
    /**
     * The raw JSON configuration received from the MCP invocation.
     * This is the unparsed, unvalidated configuration object.
     */
    rawConfig: unknown;
    
    /**
     * Timestamp when the configuration was received from the MCP server.
     * Used for debugging and cache invalidation.
     */
    receivedAt: Date;
}

/**
 * Configuration source from a file on the filesystem.
 * 
 * File-based configuration is the traditional way of providing config,
 * supporting multiple formats (YAML, JSON, JavaScript, TypeScript).
 * This type tracks the file path, format, and optional parent configs
 * in hierarchical mode.
 * 
 * @example
 * ```typescript
 * const fileSource: FileConfigSource = {
 *   type: 'file',
 *   filePath: '/project/app.config.yaml',
 *   format: ConfigFormat.YAML,
 *   parents: [parentConfigSource],
 * };
 * ```
 */
export interface FileConfigSource {
    /** Source type discriminator */
    type: 'file';
    
    /**
     * Absolute path to the configuration file.
     */
    filePath: string;
    
    /**
     * The format of the configuration file.
     */
    format: ConfigFormat;
    
    /**
     * Parent configuration sources in hierarchical mode.
     * These are configs from parent directories that were merged.
     * Ordered from most specific (closest) to least specific (furthest).
     */
    parents?: FileConfigSource[];
}

/**
 * Union type representing all possible configuration sources.
 * 
 * Configuration can come from either:
 * - MCP server invocation (for AI assistant tools)
 * - File on the filesystem (traditional config files)
 * 
 * Use the `type` discriminator to determine which source type you have.
 * 
 * @example
 * ```typescript
 * function handleConfig(source: ConfigSource) {
 *   if (source.type === 'mcp') {
 *     console.log('Config from MCP:', source.rawConfig);
 *   } else {
 *     console.log('Config from file:', source.filePath);
 *   }
 * }
 * ```
 */
export type ConfigSource = MCPConfigSource | FileConfigSource;

/**
 * A fully resolved configuration with source tracking.
 * 
 * This type represents the final configuration after all parsing,
 * validation, and merging has been completed. It includes metadata
 * about where the configuration came from and how it was resolved.
 * 
 * @template T - The type of the parsed configuration object
 * 
 * @example
 * ```typescript
 * const resolved: ResolvedConfig<AppConfig> = {
 *   source: { type: 'file', filePath: '/app/config.yaml', format: ConfigFormat.YAML },
 *   config: { port: 3000, host: 'localhost' },
 *   hierarchical: true,
 *   resolution: 'Merged 3 configs from /app, /app/src, /app/src/api',
 * };
 * ```
 */
export interface ResolvedConfig<T = unknown> {
    /**
     * The source of the configuration (MCP or file).
     */
    source: ConfigSource;
    
    /**
     * The parsed and validated configuration object.
     */
    config: T;
    
    /**
     * Whether hierarchical configuration lookup was used.
     * True if multiple configs were merged from parent directories.
     */
    hierarchical: boolean;
    
    /**
     * Human-readable explanation of how the configuration was resolved.
     * Useful for debugging and the checkConfig tool.
     * 
     * @example "Config from MCP invocation"
     * @example "Merged 2 configs: /project/config.yaml, /project/src/config.yaml"
     * @example "Single config from /app/.myapprc.json"
     */
    resolution: string;
}

/**
 * Context information provided by MCP server invocations.
 * 
 * When an MCP tool is invoked by an AI assistant (like Claude in Cursor),
 * the invocation includes contextual information about the environment.
 * This type captures that context.
 * 
 * @example
 * ```typescript
 * // MCP tool invocation from Cursor
 * const context: MCPInvocationContext = {
 *   workingDirectory: '/Users/dev/project',
 *   targetFile: '/Users/dev/project/src/index.ts',
 *   config: {
 *     features: ['validation'],
 *     maxRetries: 3,
 *   },
 * };
 * ```
 */
export interface MCPInvocationContext {
    /**
     * Working directory for file operations.
     * This is typically the current working directory in the AI assistant's context.
     * Used as the starting point for hierarchical config discovery.
     */
    workingDirectory?: string;
    
    /**
     * The specific file being operated on.
     * For tools like Protokoll that operate on files, this is the target file path.
     * Used to determine the most relevant configuration.
     */
    targetFile?: string;
    
    /**
     * MCP-provided configuration object.
     * This is the raw configuration passed by the AI assistant environment.
     * Must be parsed and validated before use.
     */
    config?: unknown;
}
