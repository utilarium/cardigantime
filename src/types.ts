import { Command } from "commander";
import { ZodObject } from "zod";

import { z } from "zod";
import { SecurityValidationConfig } from "./security/types";

// Re-export MCP types for convenience
export type {
    MCPConfigSource,
    FileConfigSource,
    ConfigSource,
    ResolvedConfig,
    MCPInvocationContext,
} from "./mcp/types";

/**
 * Available features that can be enabled in Cardigantime.
 * Currently supports:
 * - 'config': Configuration file reading and validation
 * - 'hierarchical': Hierarchical configuration discovery and layering
 */
export type Feature = 'config' | 'hierarchical';

/**
 * Supported configuration file formats.
 * 
 * - 'yaml': YAML format (.yaml, .yml)
 * - 'json': JSON format (.json)
 * - 'javascript': JavaScript module (.js, .mjs, .cjs)
 * - 'typescript': TypeScript module (.ts, .mts, .cts)
 */
export enum ConfigFormat {
    YAML = 'yaml',
    JSON = 'json',
    JavaScript = 'javascript',
    TypeScript = 'typescript'
}

/**
 * Interface for format-specific configuration parsers.
 * Each parser is responsible for loading and parsing configuration from a specific format.
 * 
 * @template T - The type of the parsed configuration object
 */
export interface ConfigParser<T = unknown> {
    /** The format this parser handles */
    format: ConfigFormat;
    /** File extensions this parser supports (e.g., ['.yaml', '.yml']) */
    extensions: string[];
    /** 
     * Parses configuration content from a file.
     * 
     * @param content - The raw file content as a string
     * @param filePath - The absolute path to the configuration file
     * @returns Promise resolving to the parsed configuration object
     * @throws {Error} When parsing fails or content is invalid
     */
    parse(content: string, filePath: string): Promise<T>;
}

/**
 * Metadata about where a configuration value came from.
 * Used for tracking configuration sources and debugging.
 * 
 * @deprecated Use FileConfigSource from ./mcp/types instead.
 * This type is kept for backward compatibility and will be removed in a future version.
 */
export interface LegacyConfigSource {
    /** The format of the configuration file */
    format: ConfigFormat;
    /** Absolute path to the configuration file */
    filePath: string;
    /** The parsed configuration content */
    content: unknown;
    /** Timestamp when the configuration was loaded */
    loadedAt: Date;
}

/**
 * Defines how array fields should be merged in hierarchical configurations.
 * 
 * - 'override': Higher precedence arrays completely replace lower precedence arrays (default)
 * - 'append': Higher precedence array elements are appended to lower precedence arrays
 * - 'prepend': Higher precedence array elements are prepended to lower precedence arrays
 */
export type ArrayOverlapMode = 'override' | 'append' | 'prepend';

/**
 * Configuration for how fields should be merged in hierarchical configurations.
 * Maps field names (using dot notation) to their overlap behavior.
 * 
 * @example
 * ```typescript
 * const fieldOverlaps: FieldOverlapOptions = {
 *   'features': 'append',           // features arrays will be combined by appending
 *   'api.endpoints': 'prepend',     // nested endpoint arrays will be combined by prepending
 *   'excludePatterns': 'override'   // excludePatterns arrays will replace each other (default behavior)
 * };
 * ```
 */
export interface FieldOverlapOptions {
    [fieldPath: string]: ArrayOverlapMode;
}

/**
 * Configuration for resolving relative paths in configuration values.
 * Paths specified in these fields will be resolved relative to the configuration file's directory.
 */
export interface PathResolutionOptions {
    /** Array of field names (using dot notation) that contain paths to be resolved */
    pathFields?: string[];
    /** Array of field names whose array elements should all be resolved as paths */
    resolvePathArray?: string[];
    /** 
     * Whether to validate that resolved paths exist on the filesystem
     * @default false
     */
    validateExists?: boolean;
    /**
     * Whether to warn about config values that look like paths but aren't in pathFields
     * Looks for values containing './' or '../' that might be unresolved paths
     * @default true
     */
    warnUnmarkedPaths?: boolean;
}

/**
 * Default configuration options for Cardigantime.
 * These define the basic behavior of configuration loading.
 */
export interface DefaultOptions {
    /** Directory path where configuration files are located */
    configDirectory: string;
    /** Name of the configuration file (e.g., 'config.yaml', 'app.yml') */
    configFile: string;
    /** Whether the configuration directory must exist. If true, throws error if directory doesn't exist */
    isRequired: boolean;
    /** File encoding for reading configuration files (e.g., 'utf8', 'ascii') */
    encoding: string;
    /** Configuration for resolving relative paths in configuration values */
    pathResolution?: PathResolutionOptions;
    /** 
     * Configuration for how array fields should be merged in hierarchical mode.
     * Only applies when the 'hierarchical' feature is enabled.
     * If not specified, all arrays use 'override' behavior (default).
     */
    fieldOverlaps?: FieldOverlapOptions;
    /** 
     * Security validation configuration (optional, uses development profile by default).
     * Enable security features to validate CLI arguments and config file values.
     */
    security?: Partial<SecurityValidationConfig>;
    /**
     * Optional source metadata for tracking where configuration came from.
     * Populated automatically when configuration is loaded.
     * 
     * @deprecated Use the new ConfigSource union type from ./mcp/types instead.
     */
    source?: LegacyConfigSource;
    /**
     * Allow executable configuration files (JavaScript/TypeScript).
     * 
     * **SECURITY WARNING**: Executable configs run with full Node.js permissions
     * in the same process as your application. Only enable this if you trust
     * the configuration files being loaded.
     * 
     * When disabled (default), JavaScript and TypeScript config files will be
     * ignored with a warning message.
     * 
     * @default false
     */
    allowExecutableConfig?: boolean;
}

/**
 * Complete options object passed to Cardigantime functions.
 * Combines defaults, features, schema shape, and logger.
 * 
 * @template T - The Zod schema shape type for configuration validation
 */
export interface Options<T extends z.ZodRawShape> {
    /** Default configuration options */
    defaults: DefaultOptions,
    /** Array of enabled features */
    features: Feature[],
    /** Zod schema shape for validating user configuration */
    configShape: T;
    /** Logger instance for debugging and error reporting */
    logger: Logger;
}

/**
 * Logger interface for Cardigantime's internal logging.
 * Compatible with popular logging libraries like Winston, Bunyan, etc.
 */
export interface Logger {
    /** Debug-level logging for detailed troubleshooting information */
    debug: (message: string, ...args: any[]) => void;
    /** Info-level logging for general information */
    info: (message: string, ...args: any[]) => void;
    /** Warning-level logging for non-critical issues */
    warn: (message: string, ...args: any[]) => void;
    /** Error-level logging for critical problems */
    error: (message: string, ...args: any[]) => void;
    /** Verbose-level logging for extensive detail */
    verbose: (message: string, ...args: any[]) => void;
    /** Silly-level logging for maximum detail */
    silly: (message: string, ...args: any[]) => void;
}

/**
 * Main Cardigantime interface providing configuration management functionality.
 * 
 * @template T - The Zod schema shape type for configuration validation
 */
export interface Cardigantime<T extends z.ZodRawShape> {
    /** 
     * Adds Cardigantime's CLI options to a Commander.js command.
     * This includes options like --config-directory for runtime config path overrides.
     */
    configure: (command: Command) => Promise<Command>;
    /** Sets a custom logger for debugging and error reporting */
    setLogger: (logger: Logger) => void;
    /** 
     * Reads configuration from files and merges with CLI arguments.
     * Returns a fully typed configuration object.
     */
    read: (args: Args) => Promise<z.infer<ZodObject<T & typeof ConfigSchema.shape>>>;
    /** 
     * Validates the merged configuration against the Zod schema.
     * Throws ConfigurationError if validation fails.
     */
    validate: (config: z.infer<ZodObject<T & typeof ConfigSchema.shape>>) => Promise<void>;
    /** 
     * Generates a configuration file with default values in the specified directory.
     * Creates the directory if it doesn't exist and writes a config file with all default values populated.
     */
    generateConfig: (configDirectory?: string) => Promise<void>;
    /** 
     * Checks and displays the resolved configuration with detailed source tracking.
     * Shows which file and hierarchical level contributed each configuration value in a git blame-like format.
     */
    checkConfig: (args: Args) => Promise<void>;
}

/**
 * Parsed command-line arguments object, typically from Commander.js opts().
 * Keys correspond to CLI option names with values from user input.
 */
export interface Args {
    [key: string]: any;
}

/**
 * Base Zod schema for core Cardigantime configuration.
 * Contains the minimum required configuration fields.
 */
export const ConfigSchema = z.object({
    /** The resolved configuration directory path */
    configDirectory: z.string(),
    /** Array of all directory paths that were discovered during hierarchical search */
    discoveredConfigDirs: z.array(z.string()),
    /** Array of directory paths that actually contained valid configuration files */
    resolvedConfigDirs: z.array(z.string()),
});

/**
 * Base configuration type derived from the core schema.
 */
export type Config = z.infer<typeof ConfigSchema>;

// ============================================================================
// Configuration Discovery Types
// ============================================================================

/**
 * Defines a configuration file naming pattern.
 * Used to discover configuration files in various standard locations.
 * 
 * Patterns support placeholders:
 * - `{app}` - The application name (e.g., 'protokoll', 'myapp')
 * - `{ext}` - The file extension (e.g., 'yaml', 'json', 'ts')
 * 
 * @example
 * ```typescript
 * // Pattern: "{app}.config.{ext}" with app="myapp" and ext="yaml"
 * // Results in: "myapp.config.yaml"
 * 
 * const pattern: ConfigNamingPattern = {
 *   pattern: '{app}.config.{ext}',
 *   priority: 1,
 *   hidden: false
 * };
 * ```
 */
export interface ConfigNamingPattern {
    /**
     * Pattern template with `{app}` and `{ext}` placeholders.
     * 
     * Examples:
     * - `"{app}.config.{ext}"` → `"protokoll.config.yaml"`
     * - `".{app}/config.{ext}"` → `".protokoll/config.yaml"`
     * - `".{app}rc.{ext}"` → `".protokollrc.json"`
     * - `".{app}rc"` → `".protokollrc"` (no extension)
     */
    pattern: string;

    /**
     * Search priority (lower number = checked first).
     * When multiple config files exist, lower priority patterns take precedence.
     */
    priority: number;

    /**
     * Whether this pattern results in a hidden file or directory.
     * Hidden patterns start with a dot (e.g., `.myapp/`, `.myapprc`).
     */
    hidden: boolean;
}

/**
 * Options for configuring how configuration files are discovered.
 * 
 * @example
 * ```typescript
 * const options: ConfigDiscoveryOptions = {
 *   appName: 'myapp',
 *   extensions: ['yaml', 'yml', 'json'],
 *   searchHidden: true,
 *   // Use custom patterns instead of defaults
 *   patterns: [
 *     { pattern: '{app}.config.{ext}', priority: 1, hidden: false }
 *   ]
 * };
 * ```
 */
export interface ConfigDiscoveryOptions {
    /**
     * The application name used in pattern expansion.
     * This value replaces `{app}` placeholders in naming patterns.
     */
    appName: string;

    /**
     * Custom naming patterns to use for discovery.
     * If not provided, uses the standard patterns defined in STANDARD_PATTERNS.
     */
    patterns?: ConfigNamingPattern[];

    /**
     * File extensions to search for.
     * These replace the `{ext}` placeholder in patterns.
     * If not provided, defaults to supported format extensions.
     * 
     * @example ['yaml', 'yml', 'json', 'js', 'ts']
     */
    extensions?: string[];

    /**
     * Whether to search for hidden files and directories.
     * When false, patterns with `hidden: true` are skipped.
     * 
     * @default true
     */
    searchHidden?: boolean;

    /**
     * Whether to check for multiple config files and emit a warning.
     * When enabled, discovery continues after finding the first match
     * to detect and warn about additional config files that would be ignored.
     * 
     * @default true
     */
    warnOnMultipleConfigs?: boolean;
}

/**
 * Result of discovering a configuration file.
 * Contains the file path and the pattern that matched.
 */
export interface DiscoveredConfig {
    /**
     * The resolved file path to the configuration file.
     * Can be a file path (e.g., 'app.config.yaml') or include
     * a directory (e.g., '.app/config.yaml').
     */
    path: string;

    /**
     * The absolute path to the configuration file.
     */
    absolutePath: string;

    /**
     * The pattern that matched this configuration file.
     */
    pattern: ConfigNamingPattern;
}

/**
 * Warning information when multiple config files are found.
 * This helps users identify and remove unused config files.
 */
export interface MultipleConfigWarning {
    /**
     * The configuration that will be used (highest priority).
     */
    used: DiscoveredConfig;

    /**
     * Configurations that were found but will be ignored.
     */
    ignored: DiscoveredConfig[];
}

/**
 * Full result of configuration discovery, including warnings.
 */
export interface DiscoveryResult {
    /**
     * The discovered configuration file, or null if none found.
     */
    config: DiscoveredConfig | null;

    /**
     * Warning about multiple config files, if any were found.
     */
    multipleConfigWarning?: MultipleConfigWarning;
}

// ============================================================================
// Hierarchical Configuration Types
// ============================================================================

/**
 * Controls how hierarchical configuration lookup behaves.
 * 
 * - `'enabled'` - Walk up the directory tree and merge configs (default behavior).
 *   Configurations from parent directories are merged with child configurations,
 *   with child values taking precedence.
 * 
 * - `'disabled'` - Use only the config found in the starting directory.
 *   No parent directory traversal occurs. Useful for isolated projects or
 *   MCP configurations that should be self-contained.
 * 
 * - `'root-only'` - Walk up to find the first config, but don't merge with others.
 *   This mode finds the "closest" config file without merging parent configs.
 *   Useful when you want automatic config discovery but not inheritance.
 * 
 * - `'explicit'` - Only merge configs that are explicitly referenced.
 *   The base config can specify which parent configs to extend via an
 *   `extends` field. No automatic directory traversal.
 * 
 * @example
 * ```typescript
 * // In a child config that wants to be isolated:
 * // protokoll.config.yaml
 * hierarchical:
 *   mode: disabled
 * 
 * // This config will NOT inherit from parent directories
 * ```
 */
export type HierarchicalMode = 'enabled' | 'disabled' | 'root-only' | 'explicit';

/**
 * Files or directories that indicate a project root.
 * When encountered during directory traversal, hierarchical lookup stops.
 * 
 * @example
 * ```typescript
 * const markers: RootMarker[] = [
 *   { type: 'file', name: 'package.json' },
 *   { type: 'directory', name: '.git' },
 *   { type: 'file', name: 'pnpm-workspace.yaml' },
 * ];
 * ```
 */
export interface RootMarker {
    /** Type of the marker */
    type: 'file' | 'directory';
    /** Name of the file or directory that indicates a root */
    name: string;
}

/**
 * Default root markers used when none are specified.
 * These indicate common project root boundaries.
 */
export const DEFAULT_ROOT_MARKERS: RootMarker[] = [
    { type: 'file', name: 'package.json' },
    { type: 'directory', name: '.git' },
    { type: 'file', name: 'pnpm-workspace.yaml' },
    { type: 'file', name: 'lerna.json' },
    { type: 'file', name: 'nx.json' },
    { type: 'file', name: 'rush.json' },
];

/**
 * Configuration options for hierarchical config behavior.
 * Can be set in the configuration file or programmatically.
 * 
 * @example
 * ```typescript
 * // Configuration file (protokoll.config.yaml):
 * hierarchical:
 *   mode: enabled
 *   maxDepth: 5
 *   stopAt:
 *     - node_modules
 *     - vendor
 *   rootMarkers:
 *     - type: file
 *       name: package.json
 * ```
 * 
 * @example
 * ```typescript
 * // Programmatic configuration:
 * const options: HierarchicalOptions = {
 *   mode: 'disabled',  // No parent config merging
 * };
 * 
 * // For MCP servers:
 * const mcpOptions: HierarchicalOptions = {
 *   mode: 'root-only',
 *   rootMarkers: [{ type: 'file', name: 'mcp.json' }],
 * };
 * ```
 */
export interface HierarchicalOptions {
    /**
     * The hierarchical lookup mode.
     * Controls whether and how parent directories are searched.
     * 
     * @default 'enabled'
     */
    mode?: HierarchicalMode;

    /**
     * Maximum number of parent directories to traverse.
     * Prevents unbounded traversal in deep directory structures.
     * 
     * @default 10
     */
    maxDepth?: number;

    /**
     * Directory names where traversal should stop.
     * When a directory with one of these names is encountered as a parent,
     * traversal stops even if no config was found.
     * 
     * @example ['node_modules', 'vendor', '.cache']
     */
    stopAt?: string[];

    /**
     * Files or directories that indicate a project root.
     * When a directory contains one of these markers, it's treated as a root
     * and traversal stops after processing that directory.
     * 
     * If not specified, uses DEFAULT_ROOT_MARKERS.
     * Set to empty array to disable root marker detection.
     */
    rootMarkers?: RootMarker[];

    /**
     * Whether to stop at the first root marker found.
     * When true, traversal stops immediately when a root marker is found.
     * When false, the directory with the root marker is included but no further.
     * 
     * @default true
     */
    stopAtRoot?: boolean;
}

// ============================================================================
// Directory Traversal Security Types
// ============================================================================

/**
 * Defines security boundaries for directory traversal.
 * Used to prevent configuration lookup from accessing sensitive directories.
 * 
 * @example
 * ```typescript
 * const boundaries: TraversalBoundary = {
 *   forbidden: ['/etc', '/usr', '/var'],
 *   boundaries: [process.env.HOME ?? '/home'],
 *   maxAbsoluteDepth: 20,
 *   maxRelativeDepth: 10,
 * };
 * ```
 */
export interface TraversalBoundary {
    /**
     * Directories that are never allowed to be accessed.
     * Traversal is blocked if the path is at or within these directories.
     * Paths can include environment variable placeholders like `$HOME`.
     * 
     * @example ['/etc', '/usr', '/var', '/sys', '/proc', '$HOME/.ssh']
     */
    forbidden: string[];

    /**
     * Soft boundary directories - traversal stops at these unless explicitly allowed.
     * These represent natural project boundaries.
     * Paths can include environment variable placeholders like `$HOME`.
     * 
     * @example ['$HOME', '/tmp', '/private/tmp']
     */
    boundaries: string[];

    /**
     * Maximum absolute depth from the filesystem root.
     * Prevents extremely deep traversal regardless of starting point.
     * Depth is counted as the number of path segments from root.
     * 
     * @example 20 means paths like /a/b/c/.../t (20 levels deep) are allowed
     * @default 20
     */
    maxAbsoluteDepth: number;

    /**
     * Maximum relative depth from the starting directory.
     * Limits how far up the directory tree traversal can go.
     * 
     * @example 10 means traversal can go up 10 directories from the start
     * @default 10
     */
    maxRelativeDepth: number;
}

/**
 * Result of a traversal boundary check.
 */
export interface TraversalCheckResult {
    /** Whether the path is allowed */
    allowed: boolean;
    
    /** Reason for blocking (if not allowed) */
    reason?: string;
    
    /** The boundary that was violated (if any) */
    violatedBoundary?: string;
}

/**
 * Options for configuring traversal security behavior.
 */
export interface TraversalSecurityOptions {
    /**
     * Custom traversal boundaries to use instead of defaults.
     */
    boundaries?: Partial<TraversalBoundary>;

    /**
     * Allow traversal beyond safe boundaries.
     * 
     * **SECURITY WARNING**: Setting this to true bypasses security checks
     * and allows traversal into sensitive directories. Only use this in
     * trusted scenarios where you control all configuration files.
     * 
     * @default false
     */
    allowUnsafeTraversal?: boolean;

    /**
     * Whether to log warnings when boundaries are overridden.
     * 
     * @default true
     */
    warnOnOverride?: boolean;
}
