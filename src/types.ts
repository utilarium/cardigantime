import { Command } from "commander";
import { ZodObject } from "zod";

import { z } from "zod";

/**
 * Available features that can be enabled in Cardigantime.
 * Currently supports:
 * - 'config': Configuration file reading and validation
 * - 'hierarchical': Hierarchical configuration discovery and layering
 */
export type Feature = 'config' | 'hierarchical';

/**
 * Configuration for resolving relative paths in configuration values.
 * Paths specified in these fields will be resolved relative to the configuration file's directory.
 */
export interface PathResolutionOptions {
    /** Array of field names (using dot notation) that contain paths to be resolved */
    pathFields?: string[];
    /** Array of field names whose array elements should all be resolved as paths */
    resolvePathArray?: string[];
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
});

/**
 * Base configuration type derived from the core schema.
 */
export type Config = z.infer<typeof ConfigSchema>;
