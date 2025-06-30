import path from 'path';
import * as yaml from 'js-yaml';
import { create as createStorage } from './storage';
import { Logger } from '../types';

/**
 * Represents a discovered configuration directory with its path and precedence level.
 */
export interface DiscoveredConfigDir {
    /** Absolute path to the configuration directory */
    path: string;
    /** Distance from the starting directory (0 = closest/highest precedence) */
    level: number;
}

/**
 * Options for hierarchical configuration discovery.
 */
export interface HierarchicalDiscoveryOptions {
    /** Name of the configuration directory to look for (e.g., '.kodrdriv') */
    configDirName: string;
    /** Name of the configuration file within each directory */
    configFileName: string;
    /** Maximum number of parent directories to traverse (default: 10) */
    maxLevels?: number;
    /** Starting directory for discovery (default: process.cwd()) */
    startingDir?: string;
    /** File encoding for reading configuration files */
    encoding?: string;
    /** Logger for debugging */
    logger?: Logger;
}

/**
 * Result of loading configurations from multiple directories.
 */
export interface HierarchicalConfigResult {
    /** Merged configuration object with proper precedence */
    config: object;
    /** Array of directories where configuration was found */
    discoveredDirs: DiscoveredConfigDir[];
    /** Array of any errors encountered during loading (non-fatal) */
    errors: string[];
}

/**
 * Discovers configuration directories by traversing up the directory tree.
 * 
 * Starting from the specified directory (or current working directory),
 * this function searches for directories with the given name, continuing
 * up the directory tree until it reaches the filesystem root or the
 * maximum number of levels.
 * 
 * @param options Configuration options for discovery
 * @returns Promise resolving to array of discovered configuration directories
 * 
 * @example
 * ```typescript
 * const dirs = await discoverConfigDirectories({
 *   configDirName: '.kodrdriv',
 *   configFileName: 'config.yaml',
 *   maxLevels: 5
 * });
 * // Returns: [
 * //   { path: '/project/.kodrdriv', level: 0 },
 * //   { path: '/project/parent/.kodrdriv', level: 1 }
 * // ]
 * ```
 */
export async function discoverConfigDirectories(
    options: HierarchicalDiscoveryOptions
): Promise<DiscoveredConfigDir[]> {
    const {
        configDirName,
        maxLevels = 10,
        startingDir = process.cwd(),
        logger
    } = options;

    const storage = createStorage({ log: logger?.debug || (() => { }) });
    const discoveredDirs: DiscoveredConfigDir[] = [];

    let currentDir = path.resolve(startingDir);
    let level = 0;
    const visited = new Set<string>(); // Prevent infinite loops with symlinks

    logger?.debug(`Starting hierarchical discovery from: ${currentDir}`);

    while (level < maxLevels) {
        // Prevent infinite loops with symlinks
        const realPath = path.resolve(currentDir);
        if (visited.has(realPath)) {
            logger?.debug(`Already visited ${realPath}, stopping discovery`);
            break;
        }
        visited.add(realPath);

        const configDirPath = path.join(currentDir, configDirName);
        logger?.debug(`Checking for config directory: ${configDirPath}`);

        try {
            const exists = await storage.exists(configDirPath);
            const isReadable = exists && await storage.isDirectoryReadable(configDirPath);

            if (exists && isReadable) {
                discoveredDirs.push({
                    path: configDirPath,
                    level
                });
                logger?.debug(`Found config directory at level ${level}: ${configDirPath}`);
            } else if (exists && !isReadable) {
                logger?.debug(`Config directory exists but is not readable: ${configDirPath}`);
            }
        } catch (error: any) {
            logger?.debug(`Error checking config directory ${configDirPath}: ${error.message}`);
        }

        // Move up one directory level
        const parentDir = path.dirname(currentDir);

        // Check if we've reached the root directory
        if (parentDir === currentDir) {
            logger?.debug('Reached filesystem root, stopping discovery');
            break;
        }

        currentDir = parentDir;
        level++;
    }

    logger?.debug(`Discovery complete. Found ${discoveredDirs.length} config directories`);
    return discoveredDirs;
}

/**
 * Loads and parses a configuration file from a directory.
 * 
 * @param configDir Path to the configuration directory
 * @param configFileName Name of the configuration file
 * @param encoding File encoding
 * @param logger Optional logger
 * @returns Promise resolving to parsed configuration object or null if not found
 */
export async function loadConfigFromDirectory(
    configDir: string,
    configFileName: string,
    encoding: string = 'utf8',
    logger?: Logger
): Promise<object | null> {
    const storage = createStorage({ log: logger?.debug || (() => { }) });
    const configFilePath = path.join(configDir, configFileName);

    try {
        logger?.debug(`Attempting to load config file: ${configFilePath}`);

        const exists = await storage.exists(configFilePath);
        if (!exists) {
            logger?.debug(`Config file does not exist: ${configFilePath}`);
            return null;
        }

        const isReadable = await storage.isFileReadable(configFilePath);
        if (!isReadable) {
            logger?.debug(`Config file exists but is not readable: ${configFilePath}`);
            return null;
        }

        const yamlContent = await storage.readFile(configFilePath, encoding);
        const parsedYaml = yaml.load(yamlContent);

        if (parsedYaml !== null && typeof parsedYaml === 'object') {
            logger?.debug(`Successfully loaded config from: ${configFilePath}`);
            return parsedYaml as object;
        } else {
            logger?.debug(`Config file contains invalid format: ${configFilePath}`);
            return null;
        }
    } catch (error: any) {
        logger?.debug(`Error loading config from ${configFilePath}: ${error.message}`);
        return null;
    }
}

/**
 * Deep merges multiple configuration objects with proper precedence.
 * 
 * Objects are merged from lowest precedence to highest precedence,
 * meaning that properties in later objects override properties in earlier objects.
 * Arrays are replaced entirely (not merged).
 * 
 * @param configs Array of configuration objects, ordered from lowest to highest precedence
 * @returns Merged configuration object
 * 
 * @example
 * ```typescript
 * const merged = deepMergeConfigs([
 *   { api: { timeout: 5000 }, debug: true },        // Lower precedence
 *   { api: { retries: 3 }, features: ['auth'] },    // Higher precedence
 * ]);
 * // Result: { api: { timeout: 5000, retries: 3 }, debug: true, features: ['auth'] }
 * ```
 */
export function deepMergeConfigs(configs: object[]): object {
    if (configs.length === 0) {
        return {};
    }

    if (configs.length === 1) {
        return { ...configs[0] };
    }

    return configs.reduce((merged, current) => {
        return deepMergeTwo(merged, current);
    }, {});
}

/**
 * Deep merges two objects with proper precedence.
 * 
 * @param target Target object (lower precedence)
 * @param source Source object (higher precedence)
 * @returns Merged object
 */
function deepMergeTwo(target: any, source: any): any {
    // Handle null/undefined
    if (source == null) return target;
    if (target == null) return source;

    // Handle non-objects (primitives, arrays, functions, etc.)
    if (typeof source !== 'object' || typeof target !== 'object') {
        return source; // Source takes precedence
    }

    // Handle arrays - replace entirely, don't merge
    if (Array.isArray(source)) {
        return [...source];
    }

    if (Array.isArray(target)) {
        return source; // Source object replaces target array
    }

    // Deep merge objects
    const result = { ...target };

    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            if (Object.prototype.hasOwnProperty.call(result, key) &&
                typeof result[key] === 'object' &&
                typeof source[key] === 'object' &&
                !Array.isArray(source[key]) &&
                !Array.isArray(result[key])) {
                // Recursively merge nested objects
                result[key] = deepMergeTwo(result[key], source[key]);
            } else {
                // Replace with source value (higher precedence)
                result[key] = source[key];
            }
        }
    }

    return result;
}

/**
 * Loads configurations from multiple directories and merges them with proper precedence.
 * 
 * This is the main function for hierarchical configuration loading. It:
 * 1. Discovers configuration directories up the directory tree
 * 2. Loads configuration files from each discovered directory
 * 3. Merges them with proper precedence (closer directories win)
 * 4. Returns the merged configuration with metadata
 * 
 * @param options Configuration options for hierarchical loading
 * @returns Promise resolving to hierarchical configuration result
 * 
 * @example
 * ```typescript
 * const result = await loadHierarchicalConfig({
 *   configDirName: '.kodrdriv',
 *   configFileName: 'config.yaml',
 *   startingDir: '/project/subdir',
 *   maxLevels: 5
 * });
 * 
 * // result.config contains merged configuration
 * // result.discoveredDirs shows where configs were found
 * // result.errors contains any non-fatal errors
 * ```
 */
export async function loadHierarchicalConfig(
    options: HierarchicalDiscoveryOptions
): Promise<HierarchicalConfigResult> {
    const { configFileName, encoding = 'utf8', logger } = options;

    logger?.debug('Starting hierarchical configuration loading');

    // Discover all configuration directories
    const discoveredDirs = await discoverConfigDirectories(options);

    if (discoveredDirs.length === 0) {
        logger?.debug('No configuration directories found');
        return {
            config: {},
            discoveredDirs: [],
            errors: []
        };
    }

    // Load configurations from each directory
    const configs: object[] = [];
    const errors: string[] = [];

    // Sort by level (highest level first = lowest precedence first)
    const sortedDirs = [...discoveredDirs].sort((a, b) => b.level - a.level);

    for (const dir of sortedDirs) {
        try {
            const config = await loadConfigFromDirectory(
                dir.path,
                configFileName,
                encoding,
                logger
            );

            if (config !== null) {
                configs.push(config);
                logger?.debug(`Loaded config from level ${dir.level}: ${dir.path}`);
            } else {
                logger?.debug(`No valid config found at level ${dir.level}: ${dir.path}`);
            }
        } catch (error: any) {
            const errorMsg = `Failed to load config from ${dir.path}: ${error.message}`;
            errors.push(errorMsg);
            logger?.debug(errorMsg);
        }
    }

    // Merge all configurations with proper precedence
    const mergedConfig = deepMergeConfigs(configs);

    logger?.debug(`Hierarchical loading complete. Merged ${configs.length} configurations`);

    return {
        config: mergedConfig,
        discoveredDirs,
        errors
    };
} 