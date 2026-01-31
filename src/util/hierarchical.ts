import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { create as createStorage } from './storage';
import { Logger, FieldOverlapOptions, ArrayOverlapMode } from '../types';
import { normalizePathInput } from './path-normalization';

/**
 * Resolves relative paths in configuration values relative to the configuration file's directory.
 */
function resolveConfigPaths(
    config: any,
    configDir: string,
    pathFields: string[] = [],
    resolvePathArray: string[] = []
): any {
    if (!config || typeof config !== 'object' || pathFields.length === 0) {
        return config;
    }

    const resolvedConfig = { ...config };

    for (const fieldPath of pathFields) {
        const value = getNestedValue(resolvedConfig, fieldPath);
        if (value !== undefined) {
            // Step 1: Normalize input (convert file:// URLs, reject http/https)
            const normalizedValue = normalizePathInput(value);
            
            // Step 2: Resolve paths relative to config directory
            const shouldResolveArrayElements = resolvePathArray.includes(fieldPath);
            const resolvedValue = resolvePathValue(normalizedValue, configDir, shouldResolveArrayElements);
            setNestedValue(resolvedConfig, fieldPath, resolvedValue);
        }
    }

    return resolvedConfig;
}

/**
 * Gets a nested value from an object using dot notation.
 */
function getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Sets a nested value in an object using dot notation.
 */
function isUnsafeKey(key: string): boolean {
    return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

function setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;

    // Prevent prototype pollution via special property names
    if (isUnsafeKey(lastKey) || keys.some(isUnsafeKey)) {
        return;
    }

    const target = keys.reduce((current, key) => {
        // Skip if this is an unsafe key (already checked above, but defensive)
        if (isUnsafeKey(key)) {
            return current;
        }
        if (!(key in current)) {
            current[key] = {};
        }
        return current[key];
    }, obj);
    target[lastKey] = value;
}

/**
 * Resolves a path value (string, array, or object) relative to the config directory.
 * 
 * Handles:
 * - Strings: Resolved relative to configDir
 * - Arrays: Elements resolved if resolveArrayElements is true
 * - Objects: All string values and array elements resolved recursively
 * - Other types: Returned unchanged
 */
function resolvePathValue(value: any, configDir: string, resolveArrayElements: boolean): any {
    if (typeof value === 'string') {
        return resolveSinglePath(value, configDir);
    }

    if (Array.isArray(value) && resolveArrayElements) {
        return value.map(item =>
            typeof item === 'string' ? resolveSinglePath(item, configDir) : item
        );
    }

    // NEW: Handle objects with string values
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const resolved: any = {};
        for (const [key, val] of Object.entries(value)) {
            if (typeof val === 'string') {
                resolved[key] = resolveSinglePath(val, configDir);
            } else if (Array.isArray(val)) {
                // Also handle arrays within objects
                resolved[key] = val.map(item =>
                    typeof item === 'string' ? resolveSinglePath(item, configDir) : item
                );
            } else {
                // Keep other types unchanged
                resolved[key] = val;
            }
        }
        return resolved;
    }

    return value;
}

/**
 * Resolves a single path string relative to the config directory if it's a relative path.
 */
function resolveSinglePath(pathStr: string, configDir: string): string {
    if (!pathStr || path.isAbsolute(pathStr)) {
        return pathStr;
    }

    return path.resolve(configDir, pathStr);
}

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
    /** Array of field names that contain paths to be resolved */
    pathFields?: string[];
    /** Array of field names whose array elements should all be resolved as paths */
    resolvePathArray?: string[];
    /** Configuration for how array fields should be merged in hierarchical mode */
    fieldOverlaps?: FieldOverlapOptions;
}

/**
 * Result of loading configurations from multiple directories.
 */
export interface HierarchicalConfigResult {
    /** Merged configuration object with proper precedence */
    config: object;
    /** Array of directories where configuration was found */
    discoveredDirs: DiscoveredConfigDir[];
    /** Array of directories that actually contained valid configuration files */
    resolvedConfigDirs: DiscoveredConfigDir[];
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

    logger?.verbose(`Discovery complete. Found ${discoveredDirs.length} config directories`);
    return discoveredDirs;
}

/**
 * Tries to find a config file with alternative extensions (.yaml or .yml).
 * 
 * @param storage Storage instance to use for file operations
 * @param configDir The directory containing the config file
 * @param configFileName The base config file name (may have .yaml or .yml extension)
 * @param logger Optional logger for debugging
 * @returns Promise resolving to the found config file path or null if not found
 */
async function findConfigFileWithExtension(
    storage: any,
    configDir: string,
    configFileName: string,
    logger?: Logger
): Promise<string | null> {
    const configFilePath = path.join(configDir, configFileName);
    
    // First try the exact filename as specified
    const exists = await storage.exists(configFilePath);
    if (exists) {
        const isReadable = await storage.isFileReadable(configFilePath);
        if (isReadable) {
            return configFilePath;
        }
    }
    
    // If the exact filename doesn't exist or isn't readable, try alternative extensions
    // Only do this if the filename has a .yaml or .yml extension
    const ext = path.extname(configFileName);
    if (ext === '.yaml' || ext === '.yml') {
        const baseName = path.basename(configFileName, ext);
        const alternativeExt = ext === '.yaml' ? '.yml' : '.yaml';
        const alternativePath = path.join(configDir, baseName + alternativeExt);
        
        logger?.debug(`Config file not found at ${configFilePath}, trying alternative: ${alternativePath}`);
        
        const altExists = await storage.exists(alternativePath);
        if (altExists) {
            const altIsReadable = await storage.isFileReadable(alternativePath);
            if (altIsReadable) {
                logger?.debug(`Found config file with alternative extension: ${alternativePath}`);
                return alternativePath;
            }
        }
    }
    
    return null;
}

/**
 * Loads and parses a configuration file from a directory.
 * 
 * @param configDir Path to the configuration directory
 * @param configFileName Name of the configuration file
 * @param encoding File encoding
 * @param logger Optional logger
 * @param pathFields Optional array of field names that contain paths to be resolved
 * @param resolvePathArray Optional array of field names whose array elements should all be resolved as paths
 * @returns Promise resolving to parsed configuration object or null if not found
 */
export async function loadConfigFromDirectory(
    configDir: string,
    configFileName: string,
    encoding: string = 'utf8',
    logger?: Logger,
    pathFields?: string[],
    resolvePathArray?: string[]
): Promise<object | null> {
    const storage = createStorage({ log: logger?.debug || (() => { }) });
    
    try {
        logger?.verbose(`Attempting to load config file: ${path.join(configDir, configFileName)}`);

        // Try to find the config file with alternative extensions
        const configFilePath = await findConfigFileWithExtension(storage, configDir, configFileName, logger);
        
        if (!configFilePath) {
            logger?.debug(`Config file does not exist: ${path.join(configDir, configFileName)}`);
            return null;
        }

        const yamlContent = await storage.readFile(configFilePath, encoding);
        const parsedYaml = yaml.load(yamlContent);

        if (parsedYaml !== null && typeof parsedYaml === 'object') {
            let config = parsedYaml as object;

            // Apply path resolution if configured
            if (pathFields && pathFields.length > 0) {
                config = resolveConfigPaths(config, configDir, pathFields, resolvePathArray || []);
            }

            logger?.verbose(`Successfully loaded config from: ${configFilePath}`);
            return config;
        } else {
            logger?.debug(`Config file contains invalid format: ${configFilePath}`);
            return null;
        }
    } catch (error: any) {
        logger?.debug(`Error loading config from ${path.join(configDir, configFileName)}: ${error.message}`);
        return null;
    }
}

/**
 * Deep merges multiple configuration objects with proper precedence and configurable array overlap behavior.
 * 
 * Objects are merged from lowest precedence to highest precedence,
 * meaning that properties in later objects override properties in earlier objects.
 * Arrays can be merged using different strategies based on the fieldOverlaps configuration.
 * 
 * @param configs Array of configuration objects, ordered from lowest to highest precedence
 * @param fieldOverlaps Configuration for how array fields should be merged (optional)
 * @returns Merged configuration object
 * 
 * @example
 * ```typescript
 * const merged = deepMergeConfigs([
 *   { api: { timeout: 5000 }, features: ['auth'] },        // Lower precedence
 *   { api: { retries: 3 }, features: ['analytics'] },      // Higher precedence
 * ], {
 *   'features': 'append'  // Results in features: ['auth', 'analytics']
 * });
 * ```
 */
export function deepMergeConfigs(configs: object[], fieldOverlaps?: FieldOverlapOptions): object {
    if (configs.length === 0) {
        return {};
    }

    if (configs.length === 1) {
        return { ...configs[0] };
    }

    return configs.reduce((merged, current) => {
        return deepMergeTwo(merged, current, fieldOverlaps);
    }, {});
}

/**
 * Deep merges two objects with proper precedence and configurable array overlap behavior.
 * 
 * @param target Target object (lower precedence)
 * @param source Source object (higher precedence)
 * @param fieldOverlaps Configuration for how array fields should be merged (optional)
 * @param currentPath Current field path for nested merging (used internally)
 * @returns Merged object
 */
function deepMergeTwo(target: any, source: any, fieldOverlaps?: FieldOverlapOptions, currentPath: string = ''): any {
    // Handle null/undefined
    if (source == null) return target;
    if (target == null) return source;

    // Handle non-objects (primitives, arrays, functions, etc.)
    if (typeof source !== 'object' || typeof target !== 'object') {
        return source; // Source takes precedence
    }

    // Handle arrays with configurable overlap behavior
    if (Array.isArray(source)) {
        if (Array.isArray(target) && fieldOverlaps) {
            const overlapMode = getOverlapModeForPath(currentPath, fieldOverlaps);
            return mergeArrays(target, source, overlapMode);
        } else {
            // Default behavior: replace entirely
            return [...source];
        }
    }

    if (Array.isArray(target)) {
        return source; // Source object replaces target array
    }

    // Deep merge objects
    const result = { ...target };

    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            const fieldPath = currentPath ? `${currentPath}.${key}` : key;

            if (Object.prototype.hasOwnProperty.call(result, key) &&
                typeof result[key] === 'object' &&
                typeof source[key] === 'object' &&
                !Array.isArray(source[key]) &&
                !Array.isArray(result[key])) {
                // Recursively merge nested objects
                result[key] = deepMergeTwo(result[key], source[key], fieldOverlaps, fieldPath);
            } else {
                // Handle arrays and primitives with overlap consideration
                if (Array.isArray(source[key]) && Array.isArray(result[key]) && fieldOverlaps) {
                    const overlapMode = getOverlapModeForPath(fieldPath, fieldOverlaps);
                    result[key] = mergeArrays(result[key], source[key], overlapMode);
                } else {
                    // Replace with source value (higher precedence)
                    result[key] = source[key];
                }
            }
        }
    }

    return result;
}

/**
 * Determines the overlap mode for a given field path.
 * 
 * @param fieldPath The current field path (dot notation)
 * @param fieldOverlaps Configuration mapping field paths to overlap modes
 * @returns The overlap mode to use for this field path
 */
function getOverlapModeForPath(fieldPath: string, fieldOverlaps: FieldOverlapOptions): ArrayOverlapMode {
    // Check for exact match first
    if (fieldPath in fieldOverlaps) {
        return fieldOverlaps[fieldPath];
    }

    // Check for any parent path matches (for nested configurations)
    const pathParts = fieldPath.split('.');
    for (let i = pathParts.length - 1; i > 0; i--) {
        const parentPath = pathParts.slice(0, i).join('.');
        if (parentPath in fieldOverlaps) {
            return fieldOverlaps[parentPath];
        }
    }

    // Default to override if no specific configuration found
    return 'override';
}

/**
 * Merges two arrays based on the specified overlap mode.
 * 
 * @param targetArray The lower precedence array
 * @param sourceArray The higher precedence array
 * @param mode The overlap mode to use
 * @returns The merged array
 */
function mergeArrays(targetArray: any[], sourceArray: any[], mode: ArrayOverlapMode): any[] {
    switch (mode) {
        case 'append':
            return [...targetArray, ...sourceArray];
        case 'prepend':
            return [...sourceArray, ...targetArray];
        case 'override':
        default:
            return [...sourceArray];
    }
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
 *   maxLevels: 5,
 *   fieldOverlaps: {
 *     'features': 'append',
 *     'excludePatterns': 'prepend'
 *   }
 * });
 * 
 * // result.config contains merged configuration with custom array merging
 * // result.discoveredDirs shows where configs were found
 * // result.errors contains any non-fatal errors
 * ```
 */
export async function loadHierarchicalConfig(
    options: HierarchicalDiscoveryOptions
): Promise<HierarchicalConfigResult> {
    const { configFileName, encoding = 'utf8', logger, pathFields, resolvePathArray, fieldOverlaps } = options;

    logger?.verbose('Starting hierarchical configuration loading');

    // Discover all configuration directories
    const discoveredDirs = await discoverConfigDirectories(options);

    if (discoveredDirs.length === 0) {
        logger?.verbose('No configuration directories found');
        return {
            config: {},
            discoveredDirs: [],
            resolvedConfigDirs: [],
            errors: []
        };
    }

    // Load configurations from each directory
    const configs: object[] = [];
    const resolvedConfigDirs: DiscoveredConfigDir[] = [];
    const errors: string[] = [];

    // Sort by level (highest level first = lowest precedence first)
    const sortedDirs = [...discoveredDirs].sort((a, b) => b.level - a.level);

    for (const dir of sortedDirs) {
        try {
            const config = await loadConfigFromDirectory(
                dir.path,
                configFileName,
                encoding,
                logger,
                pathFields,
                resolvePathArray
            );

            if (config !== null) {
                configs.push(config);
                resolvedConfigDirs.push(dir);
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

    // Merge all configurations with proper precedence and configurable array overlap
    const mergedConfig = deepMergeConfigs(configs, fieldOverlaps);

    logger?.verbose(`Hierarchical loading complete. Merged ${configs.length} configurations`);

    return {
        config: mergedConfig,
        discoveredDirs,
        resolvedConfigDirs,
        errors
    };
} 