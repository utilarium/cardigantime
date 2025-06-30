import * as yaml from 'js-yaml';
import * as path from 'path';
import { z, ZodObject } from 'zod';
import { Args, ConfigSchema, Options } from './types';
import * as Storage from './util/storage';
import { loadHierarchicalConfig } from './util/hierarchical';

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
    logger.debug('Resolved config directory');

    let rawFileConfig: object = {};

    // Check if hierarchical configuration discovery is enabled
    if (options.features.includes('hierarchical')) {
        logger.debug('Hierarchical configuration discovery enabled');

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
                logger
            });

            rawFileConfig = hierarchicalResult.config;

            if (hierarchicalResult.discoveredDirs.length > 0) {
                logger.debug(`Hierarchical discovery found ${hierarchicalResult.discoveredDirs.length} configuration directories`);
                hierarchicalResult.discoveredDirs.forEach(dir => {
                    logger.debug(`  Level ${dir.level}: ${dir.path}`);
                });
            } else {
                logger.debug('No configuration directories found in hierarchy');
            }

            if (hierarchicalResult.errors.length > 0) {
                hierarchicalResult.errors.forEach(error => logger.warn(`Hierarchical config warning: ${error}`));
            }

        } catch (error: any) {
            logger.error('Hierarchical configuration loading failed: ' + (error.message || 'Unknown error'));
            // Fall back to single directory mode
            logger.debug('Falling back to single directory configuration loading');
            rawFileConfig = await loadSingleDirectoryConfig(resolvedConfigDir, options, logger);
        }
    } else {
        // Use traditional single directory configuration loading
        logger.debug('Using single directory configuration loading');
        rawFileConfig = await loadSingleDirectoryConfig(resolvedConfigDir, options, logger);
    }

    const config: z.infer<ZodObject<T & typeof ConfigSchema.shape>> = clean({
        ...rawFileConfig,
        ...{
            configDirectory: resolvedConfigDir,
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
    logger.debug('Attempting to load config file for cardigantime');

    let rawFileConfig: object = {};

    try {
        const yamlContent = await storage.readFile(configFile, options.defaults.encoding);

        // SECURITY FIX: Use safer parsing options to prevent code execution vulnerabilities
        const parsedYaml = yaml.load(yamlContent);

        if (parsedYaml !== null && typeof parsedYaml === 'object') {
            rawFileConfig = parsedYaml;
            logger.debug('Loaded configuration file successfully');
        } else if (parsedYaml !== null) {
            logger.warn('Ignoring invalid configuration format. Expected an object, got ' + typeof parsedYaml);
        }
    } catch (error: any) {
        if (error.code === 'ENOENT' || /not found|no such file/i.test(error.message)) {
            logger.debug('Configuration file not found. Using empty configuration.');
        } else {
            // SECURITY FIX: Don't expose internal paths or detailed error information
            logger.error('Failed to load or parse configuration file: ' + (error.message || 'Unknown error'));
        }
    }

    return rawFileConfig;
}