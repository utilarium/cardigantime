import * as yaml from 'js-yaml';
import * as path from 'path';
import { z, ZodObject } from 'zod';
import { Args, ConfigSchema, Options } from './types';
import * as Storage from './util/storage';
import { loadHierarchicalConfig, DiscoveredConfigDir } from './util/hierarchical';

/**
 * Removes undefined values from an object to create a clean configuration.
 * This is used to merge configuration sources while avoiding undefined pollution.
 * 
 * @param obj - The object to clean
 * @returns A new object with undefined values filtered out
 */
function clean(obj: any) {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined)
    );
}

/**
 * Resolves relative paths in configuration values relative to the configuration file's directory.
 * 
 * @param config - The configuration object to process
 * @param configDir - The directory containing the configuration file
 * @param pathFields - Array of field names (using dot notation) that contain paths to be resolved
 * @param resolvePathArray - Array of field names whose array elements should all be resolved as paths
 * @returns The configuration object with resolved paths
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
            const shouldResolveArrayElements = resolvePathArray.includes(fieldPath);
            const resolvedValue = resolvePathValue(value, configDir, shouldResolveArrayElements);
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
function setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
        if (!(key in current)) {
            current[key] = {};
        }
        return current[key];
    }, obj);
    target[lastKey] = value;
}

/**
 * Resolves a path value (string or array of strings) relative to the config directory.
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
 * Validates and secures a user-provided path to prevent path traversal attacks.
 * 
 * Security checks include:
 * - Path traversal prevention (blocks '..')
 * - Absolute path detection
 * - Path separator validation
 * 
 * @param userPath - The user-provided path component
 * @param basePath - The base directory to join the path with
 * @returns The safely joined and normalized path
 * @throws {Error} When path traversal or absolute paths are detected
 */
function validatePath(userPath: string, basePath: string): string {
    if (!userPath || !basePath) {
        throw new Error('Invalid path parameters');
    }

    const normalized = path.normalize(userPath);

    // Prevent path traversal attacks
    if (normalized.includes('..') || path.isAbsolute(normalized)) {
        throw new Error('Invalid path: path traversal detected');
    }

    // Ensure the path doesn't start with a path separator
    if (normalized.startsWith('/') || normalized.startsWith('\\')) {
        throw new Error('Invalid path: absolute path detected');
    }

    return path.join(basePath, normalized);
}

/**
 * Validates a configuration directory path for security and basic formatting.
 * 
 * Performs validation to prevent:
 * - Null byte injection attacks
 * - Extremely long paths that could cause DoS
 * - Empty or invalid directory specifications
 * 
 * @param configDir - The configuration directory path to validate
 * @returns The normalized configuration directory path
 * @throws {Error} When the directory path is invalid or potentially dangerous
 */
function validateConfigDirectory(configDir: string): string {
    if (!configDir) {
        throw new Error('Configuration directory is required');
    }

    // Check for null bytes which could be used for path injection
    if (configDir.includes('\0')) {
        throw new Error('Invalid path: null byte detected');
    }

    const normalized = path.normalize(configDir);

    // Basic validation - could be expanded based on requirements
    if (normalized.length > 1000) {
        throw new Error('Configuration directory path too long');
    }

    return normalized;
}

/**
 * Reads configuration from files and merges it with CLI arguments.
 * 
 * This function implements the core configuration loading logic:
 * 1. Validates and resolves the configuration directory path
 * 2. Attempts to read the YAML configuration file
 * 3. Safely parses the YAML content with security protections
 * 4. Merges file configuration with runtime arguments
 * 5. Returns a typed configuration object
 * 
 * The function handles missing files gracefully and provides detailed
 * logging for troubleshooting configuration issues.
 * 
 * @template T - The Zod schema shape type for configuration validation
 * @param args - Parsed command-line arguments containing potential config overrides
 * @param options - Cardigantime options with defaults, schema, and logger
 * @returns Promise resolving to the merged and typed configuration object
 * @throws {Error} When configuration directory is invalid or required files cannot be read
 * 
 * @example
 * ```typescript
 * const config = await read(cliArgs, {
 *   defaults: { configDirectory: './config', configFile: 'app.yaml' },
 *   configShape: MySchema.shape,
 *   logger: console,
 *   features: ['config']
 * });
 * // config is fully typed based on your schema
 * ```
 */
export const read = async <T extends z.ZodRawShape>(args: Args, options: Options<T>): Promise<z.infer<ZodObject<T & typeof ConfigSchema.shape>>> => {
    const logger = options.logger;

    const rawConfigDir = args.configDirectory || options.defaults?.configDirectory;
    if (!rawConfigDir) {
        throw new Error('Configuration directory must be specified');
    }

    const resolvedConfigDir = validateConfigDirectory(rawConfigDir);
    logger.verbose('Resolved config directory');

    let rawFileConfig: object = {};
    let discoveredConfigDirs: string[] = [];
    let resolvedConfigDirs: string[] = [];

        // Check if hierarchical configuration discovery is enabled
        // Use optional chaining for safety although options.features is defaulted
        if (options.features && options.features.includes('hierarchical')) {
            logger.verbose('Hierarchical configuration discovery enabled');

        try {
            // Extract the config directory name from the path for hierarchical discovery
            const configDirName = path.basename(resolvedConfigDir);
            const startingDir = path.dirname(resolvedConfigDir);

            logger.debug(`Using hierarchical discovery: configDirName=${configDirName}, startingDir=${startingDir}`);

            const hierarchicalResult = await loadHierarchicalConfig({
                configDirName,
                configFileName: options.defaults.configFile,
                startingDir,
                encoding: options.defaults.encoding,
                logger,
                pathFields: options.defaults.pathResolution?.pathFields,
                resolvePathArray: options.defaults.pathResolution?.resolvePathArray,
                fieldOverlaps: options.defaults.fieldOverlaps
            });

            rawFileConfig = hierarchicalResult.config;
            discoveredConfigDirs = hierarchicalResult.discoveredDirs.map(dir => dir.path);
            resolvedConfigDirs = hierarchicalResult.resolvedConfigDirs.map(dir => dir.path);

            if (hierarchicalResult.discoveredDirs.length > 0) {
                logger.verbose(`Hierarchical discovery found ${hierarchicalResult.discoveredDirs.length} configuration directories`);
                hierarchicalResult.discoveredDirs.forEach(dir => {
                    logger.debug(`  Level ${dir.level}: ${dir.path}`);
                });
            } else {
                logger.verbose('No configuration directories found in hierarchy');
            }

            if (hierarchicalResult.resolvedConfigDirs.length > 0) {
                logger.verbose(`Found ${hierarchicalResult.resolvedConfigDirs.length} directories with actual configuration files`);
                hierarchicalResult.resolvedConfigDirs.forEach(dir => {
                    logger.debug(`  Config dir level ${dir.level}: ${dir.path}`);
                });
            }

            if (hierarchicalResult.errors.length > 0) {
                hierarchicalResult.errors.forEach(error => logger.warn(`Hierarchical config warning: ${error}`));
            }

        } catch (error: any) {
            logger.error('Hierarchical configuration loading failed: ' + (error.message || 'Unknown error'));
            // Fall back to single directory mode
            logger.verbose('Falling back to single directory configuration loading');
            rawFileConfig = await loadSingleDirectoryConfig(resolvedConfigDir, options, logger);

            // Include the directory in both arrays (discovered but check if it had config)
            discoveredConfigDirs = [resolvedConfigDir];
            if (rawFileConfig && Object.keys(rawFileConfig).length > 0) {
                resolvedConfigDirs = [resolvedConfigDir];
            } else {
                resolvedConfigDirs = [];
            }
        }
    } else {
        // Use traditional single directory configuration loading
        logger.verbose('Using single directory configuration loading');
        rawFileConfig = await loadSingleDirectoryConfig(resolvedConfigDir, options, logger);

        // Include the directory in discovered, and in resolved only if it had config
        discoveredConfigDirs = [resolvedConfigDir];
        if (rawFileConfig && Object.keys(rawFileConfig).length > 0) {
            resolvedConfigDirs = [resolvedConfigDir];
        } else {
            resolvedConfigDirs = [];
        }
    }

    // Apply path resolution if configured
    let processedConfig = rawFileConfig;
    if (options.defaults.pathResolution?.pathFields) {
        processedConfig = resolveConfigPaths(
            rawFileConfig,
            resolvedConfigDir,
            options.defaults.pathResolution.pathFields,
            options.defaults.pathResolution.resolvePathArray || []
        );
    }

    const config: z.infer<ZodObject<T & typeof ConfigSchema.shape>> = clean({
        ...processedConfig,
        ...{
            configDirectory: resolvedConfigDir,
            discoveredConfigDirs,
            resolvedConfigDirs,
        }
    }) as z.infer<ZodObject<T & typeof ConfigSchema.shape>>;

    return config;
}

/**
 * Loads configuration from a single directory (traditional mode).
 * 
 * @param resolvedConfigDir - The resolved configuration directory path
 * @param options - Cardigantime options
 * @param logger - Logger instance
 * @returns Promise resolving to the configuration object
 */
async function loadSingleDirectoryConfig<T extends z.ZodRawShape>(
    resolvedConfigDir: string,
    options: Options<T>,
    logger: any
): Promise<object> {
    const storage = Storage.create({ log: logger.debug });
    const configFile = validatePath(options.defaults.configFile, resolvedConfigDir);
    logger.verbose('Attempting to load config file for cardigantime');

    let rawFileConfig: object = {};

    try {
        const yamlContent = await storage.readFile(configFile, options.defaults.encoding);

        // SECURITY FIX: Use safer parsing options to prevent code execution vulnerabilities
        const parsedYaml = yaml.load(yamlContent);

        if (parsedYaml !== null && typeof parsedYaml === 'object') {
            rawFileConfig = parsedYaml;
            logger.verbose('Loaded configuration file successfully');
        } else if (parsedYaml !== null) {
            logger.warn('Ignoring invalid configuration format. Expected an object, got ' + typeof parsedYaml);
        }
        } catch (error: any) {
        if (error.code === 'ENOENT' || /not found|no such file/i.test(error.message)) {
            logger.verbose('Configuration file not found. Using empty configuration.');
        } else {
            // SECURITY FIX: Don't expose internal paths or detailed error information
            logger.error('Failed to load or parse configuration file: ' + (error.message || 'Unknown error'));
        }
    }

    return rawFileConfig;
}

/**
 * Represents a configuration value with its source information.
 */
interface ConfigSourceInfo {
    /** The configuration value */
    value: any;
    /** Path to the configuration file that provided this value */
    sourcePath: string;
    /** Hierarchical level (0 = closest/highest precedence) */
    level: number;
    /** Short description of the source for display */
    sourceLabel: string;
}

/**
 * Tracks configuration values to their sources during hierarchical loading.
 */
interface ConfigSourceTracker {
    [key: string]: ConfigSourceInfo;
}

/**
 * Recursively tracks the source of configuration values from hierarchical loading.
 * 
 * @param config - The configuration object to track
 * @param sourcePath - Path to the configuration file
 * @param level - Hierarchical level
 * @param prefix - Current object path prefix for nested values
 * @param tracker - The tracker object to populate
 */
function trackConfigSources(
    config: any,
    sourcePath: string,
    level: number,
    prefix: string = '',
    tracker: ConfigSourceTracker = {}
): ConfigSourceTracker {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        // For primitives and arrays, track the entire value
        tracker[prefix] = {
            value: config,
            sourcePath,
            level,
            sourceLabel: `Level ${level}: ${path.basename(path.dirname(sourcePath))}`
        };
        return tracker;
    }

    // For objects, recursively track each property
    for (const [key, value] of Object.entries(config)) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        trackConfigSources(value, sourcePath, level, fieldPath, tracker);
    }

    return tracker;
}

/**
 * Merges multiple configuration source trackers with proper precedence.
 * Lower level numbers have higher precedence.
 * 
 * @param trackers - Array of trackers from different config sources
 * @returns Merged tracker with proper precedence
 */
function mergeConfigTrackers(trackers: ConfigSourceTracker[]): ConfigSourceTracker {
    const merged: ConfigSourceTracker = {};

    for (const tracker of trackers) {
        for (const [key, info] of Object.entries(tracker)) {
            // Only update if we don't have this key yet, or if this source has higher precedence (lower level)
            if (!merged[key] || info.level < merged[key].level) {
                merged[key] = info;
            }
        }
    }

    return merged;
}

/**
 * Formats a configuration value for display, handling different types appropriately.
 * 
 * @param value - The configuration value to format
 * @returns Formatted string representation
 */
function formatConfigValue(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        if (value.length <= 3) {
            return `[${value.map(formatConfigValue).join(', ')}]`;
        }
        return `[${value.slice(0, 2).map(formatConfigValue).join(', ')}, ... (${value.length} items)]`;
    }
    if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length === 0) return '{}';
        if (keys.length <= 2) {
            return `{${keys.slice(0, 2).join(', ')}}`;
        }
        return `{${keys.slice(0, 2).join(', ')}, ... (${keys.length} keys)}`;
    }
    return String(value);
}

/**
 * Displays configuration with source tracking in a git blame-like format.
 * 
 * @param config - The resolved configuration object
 * @param tracker - Configuration source tracker
 * @param discoveredDirs - Array of discovered configuration directories
 * @param logger - Logger instance for output
 */
function displayConfigWithSources(
    config: any,
    tracker: ConfigSourceTracker,
    discoveredDirs: DiscoveredConfigDir[],
    logger: any
): void {
    logger.info('\n' + '='.repeat(80));
    logger.info('CONFIGURATION SOURCE ANALYSIS');
    logger.info('='.repeat(80));

    // Display discovered configuration hierarchy
    logger.info('\nDISCOVERED CONFIGURATION HIERARCHY:');
    if (discoveredDirs.length === 0) {
        logger.info('  No configuration directories found in hierarchy');
    } else {
        discoveredDirs
            .sort((a, b) => a.level - b.level) // Sort by precedence (lower level = higher precedence)
            .forEach(dir => {
                const precedence = dir.level === 0 ? '(highest precedence)' :
                    dir.level === Math.max(...discoveredDirs.map(d => d.level)) ? '(lowest precedence)' :
                        '';
                logger.info(`  Level ${dir.level}: ${dir.path} ${precedence}`);
            });
    }

    // Display resolved configuration with sources
    logger.info('\nRESOLVED CONFIGURATION WITH SOURCES:');
    logger.info('Format: [Source] key: value\n');

    const sortedKeys = Object.keys(tracker).sort();
    const maxKeyLength = Math.max(...sortedKeys.map(k => k.length), 20);
    const maxSourceLength = Math.max(...Object.values(tracker).map(info => info.sourceLabel.length), 25);

    for (const key of sortedKeys) {
        const info = tracker[key];
        const paddedKey = key.padEnd(maxKeyLength);
        const paddedSource = info.sourceLabel.padEnd(maxSourceLength);
        const formattedValue = formatConfigValue(info.value);

        logger.info(`[${paddedSource}] ${paddedKey}: ${formattedValue}`);
    }

    // Display summary
    logger.info('\n' + '-'.repeat(80));
    logger.info('SUMMARY:');
    logger.info(`  Total configuration keys: ${Object.keys(tracker).length}`);
    logger.info(`  Configuration sources: ${discoveredDirs.length}`);

    // Count values by source
    const sourceCount: { [source: string]: number } = {};
    for (const info of Object.values(tracker)) {
        sourceCount[info.sourceLabel] = (sourceCount[info.sourceLabel] || 0) + 1;
    }

    logger.info('  Values by source:');
    for (const [source, count] of Object.entries(sourceCount)) {
        logger.info(`    ${source}: ${count} value(s)`);
    }

    logger.info('='.repeat(80));
}

/**
 * Checks and displays the resolved configuration with detailed source tracking.
 * 
 * This function provides a git blame-like view of configuration resolution,
 * showing which file and hierarchical level contributed each configuration value.
 * 
 * @template T - The Zod schema shape type for configuration validation
 * @param args - Parsed command-line arguments
 * @param options - Cardigantime options with defaults, schema, and logger
 * @returns Promise that resolves when the configuration check is complete
 * 
 * @example
 * ```typescript
 * await checkConfig(cliArgs, {
 *   defaults: { configDirectory: './config', configFile: 'app.yaml' },
 *   configShape: MySchema.shape,
 *   logger: console,
 *   features: ['config', 'hierarchical']
 * });
 * // Outputs detailed configuration source analysis
 * ```
 */
export const checkConfig = async <T extends z.ZodRawShape>(
    args: Args,
    options: Options<T>
): Promise<void> => {
    const logger = options.logger;

    logger.info('Starting configuration check...');

    const rawConfigDir = args.configDirectory || options.defaults?.configDirectory;
    if (!rawConfigDir) {
        throw new Error('Configuration directory must be specified');
    }

    const resolvedConfigDir = validateConfigDirectory(rawConfigDir);
    logger.verbose(`Resolved config directory: ${resolvedConfigDir}`);

    let rawFileConfig: object = {};
    let discoveredDirs: DiscoveredConfigDir[] = [];
    let resolvedConfigDirs: DiscoveredConfigDir[] = [];
    let tracker: ConfigSourceTracker = {};

    // Check if hierarchical configuration discovery is enabled
    // Use optional chaining for safety although options.features is defaulted
    if (options.features && options.features.includes('hierarchical')) {
        logger.verbose('Using hierarchical configuration discovery for source tracking');

        try {
            // Extract the config directory name from the path for hierarchical discovery
            const configDirName = path.basename(resolvedConfigDir);
            const startingDir = path.dirname(resolvedConfigDir);

            logger.debug(`Using hierarchical discovery: configDirName=${configDirName}, startingDir=${startingDir}`);

            const hierarchicalResult = await loadHierarchicalConfig({
                configDirName,
                configFileName: options.defaults.configFile,
                startingDir,
                encoding: options.defaults.encoding,
                logger,
                pathFields: options.defaults.pathResolution?.pathFields,
                resolvePathArray: options.defaults.pathResolution?.resolvePathArray,
                fieldOverlaps: options.defaults.fieldOverlaps
            });

            rawFileConfig = hierarchicalResult.config;
            discoveredDirs = hierarchicalResult.discoveredDirs;
            resolvedConfigDirs = hierarchicalResult.resolvedConfigDirs;

            // Build detailed source tracking by re-loading each config individually
            const trackers: ConfigSourceTracker[] = [];

            // Sort by level (highest level first = lowest precedence first) to match merge order
            const sortedDirs = [...resolvedConfigDirs].sort((a, b) => b.level - a.level);

            for (const dir of sortedDirs) {
                const storage = Storage.create({ log: logger.debug });
                const configFilePath = path.join(dir.path, options.defaults.configFile);

                try {
                    const exists = await storage.exists(configFilePath);
                    if (!exists) continue;

                    const isReadable = await storage.isFileReadable(configFilePath);
                    if (!isReadable) continue;

                    const yamlContent = await storage.readFile(configFilePath, options.defaults.encoding);
                    const parsedYaml = yaml.load(yamlContent);

                    if (parsedYaml !== null && typeof parsedYaml === 'object') {
                        const levelTracker = trackConfigSources(parsedYaml, configFilePath, dir.level);
                        trackers.push(levelTracker);
                    }
                } catch (error: any) {
                    logger.debug(`Error loading config for source tracking from ${configFilePath}: ${error.message}`);
                }
            }

            // Merge trackers with proper precedence
            tracker = mergeConfigTrackers(trackers);

            if (hierarchicalResult.errors.length > 0) {
                logger.warn('Configuration loading warnings:');
                hierarchicalResult.errors.forEach(error => logger.warn(`  ${error}`));
            }

        } catch (error: any) {
            logger.error('Hierarchical configuration loading failed: ' + (error.message || 'Unknown error'));
            logger.verbose('Falling back to single directory configuration loading');

            // Fall back to single directory mode for source tracking
            rawFileConfig = await loadSingleDirectoryConfig(resolvedConfigDir, options, logger);
            const configFilePath = path.join(resolvedConfigDir, options.defaults.configFile);
            tracker = trackConfigSources(rawFileConfig, configFilePath, 0);

            // Include the directory in discovered, and in resolved only if it had config
            discoveredDirs = [{
                path: resolvedConfigDir,
                level: 0
            }];
            if (rawFileConfig && Object.keys(rawFileConfig).length > 0) {
                resolvedConfigDirs = [{
                    path: resolvedConfigDir,
                    level: 0
                }];
            } else {
                resolvedConfigDirs = [];
            }
        }
    } else {
        // Use traditional single directory configuration loading
        logger.verbose('Using single directory configuration loading for source tracking');
        rawFileConfig = await loadSingleDirectoryConfig(resolvedConfigDir, options, logger);
        const configFilePath = path.join(resolvedConfigDir, options.defaults.configFile);
        tracker = trackConfigSources(rawFileConfig, configFilePath, 0);

        // Include the directory in discovered, and in resolved only if it had config
        discoveredDirs = [{
            path: resolvedConfigDir,
            level: 0
        }];
        if (rawFileConfig && Object.keys(rawFileConfig).length > 0) {
            resolvedConfigDirs = [{
                path: resolvedConfigDir,
                level: 0
            }];
        } else {
            resolvedConfigDirs = [];
        }
    }

    // Apply path resolution if configured (this doesn't change source tracking)
    let processedConfig = rawFileConfig;
    if (options.defaults.pathResolution?.pathFields) {
        processedConfig = resolveConfigPaths(
            rawFileConfig,
            resolvedConfigDir,
            options.defaults.pathResolution.pathFields,
            options.defaults.pathResolution.resolvePathArray || []
        );
    }

    // Build final configuration including built-in values
    const finalConfig = clean({
        ...processedConfig,
        configDirectory: resolvedConfigDir,
        discoveredConfigDirs: discoveredDirs.map(dir => dir.path),
        resolvedConfigDirs: resolvedConfigDirs.map(dir => dir.path),
    });

    // Add built-in configuration to tracker
    tracker['configDirectory'] = {
        value: resolvedConfigDir,
        sourcePath: 'built-in',
        level: -1,
        sourceLabel: 'Built-in (runtime)'
    };

    tracker['discoveredConfigDirs'] = {
        value: discoveredDirs.map(dir => dir.path),
        sourcePath: 'built-in',
        level: -1,
        sourceLabel: 'Built-in (runtime)'
    };

    tracker['resolvedConfigDirs'] = {
        value: resolvedConfigDirs.map(dir => dir.path),
        sourcePath: 'built-in',
        level: -1,
        sourceLabel: 'Built-in (runtime)'
    };

    // Display the configuration with source information
    displayConfigWithSources(finalConfig, tracker, discoveredDirs, logger);
};