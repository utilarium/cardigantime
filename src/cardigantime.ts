import { Command } from 'commander';
import { Args, DefaultOptions, Feature, Cardigantime, Logger, Options } from 'types';
import { z, ZodObject } from 'zod';
import { configure } from './configure';
import { DEFAULT_FEATURES, DEFAULT_LOGGER, DEFAULT_OPTIONS } from './constants';
import { read, checkConfig } from './read';
import { ConfigSchema } from 'types';
import { validate } from './validate';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { generateDefaultConfig } from './util/schema-defaults';
import * as Storage from './util/storage';
import { FileSystemError } from './error/FileSystemError';

export * from './types';
export { ArgumentError, ConfigurationError, FileSystemError } from './validate';

/**
 * Creates a new Cardigantime instance for configuration management.
 * 
 * Cardigantime handles the complete configuration lifecycle including:
 * - Reading configuration from YAML files
 * - Validating configuration against Zod schemas
 * - Merging CLI arguments with file configuration and defaults
 * - Providing type-safe configuration objects
 * 
 * @template T - The Zod schema shape type for your configuration
 * @param pOptions - Configuration options for the Cardigantime instance
 * @param pOptions.defaults - Default configuration settings
 * @param pOptions.defaults.configDirectory - Directory to search for configuration files (required)
 * @param pOptions.defaults.configFile - Name of the configuration file (optional, defaults to 'config.yaml')
 * @param pOptions.defaults.isRequired - Whether the config directory must exist (optional, defaults to false)
 * @param pOptions.defaults.encoding - File encoding for reading config files (optional, defaults to 'utf8')
 * @param pOptions.defaults.pathResolution - Configuration for resolving relative paths in config values relative to the config file's directory (optional)
 * @param pOptions.features - Array of features to enable (optional, defaults to ['config'])
 * @param pOptions.configShape - Zod schema shape defining your configuration structure (required)
 * @param pOptions.logger - Custom logger implementation (optional, defaults to console logger)
 * @returns A Cardigantime instance with methods for configure, read, validate, and setLogger
 * 
 * @example
 * ```typescript
 * import { create } from '@theunwalked/cardigantime';
 * import { z } from 'zod';
 * 
 * const MyConfigSchema = z.object({
 *   apiKey: z.string().min(1),
 *   timeout: z.number().default(5000),
 *   debug: z.boolean().default(false),
 *   contextDirectories: z.array(z.string()).optional(),
 * });
 * 
 * const cardigantime = create({
 *   defaults: {
 *     configDirectory: './config',
 *     configFile: 'myapp.yaml',
 *     // Resolve relative paths in contextDirectories relative to config file location
 *     pathResolution: {
 *       pathFields: ['contextDirectories'],
 *       resolvePathArray: ['contextDirectories']
 *     },
 *     // Configure how array fields are merged in hierarchical mode
 *     fieldOverlaps: {
 *       'features': 'append',              // Accumulate features from all levels
 *       'excludePatterns': 'prepend'       // Higher precedence patterns come first
 *     }
 *   },
 *   configShape: MyConfigSchema.shape,
 *   features: ['config', 'hierarchical'],   // Enable hierarchical discovery
 * });
 * 
 * // If config file is at ../config/myapp.yaml and contains:
 * // contextDirectories: ['./context', './data']
 * // These paths will be resolved relative to ../config/ directory
 * ```
 */
export const create = <T extends z.ZodRawShape>(pOptions: {
    defaults: Pick<DefaultOptions, 'configDirectory'> & Partial<Omit<DefaultOptions, 'configDirectory'>>,
    features?: Feature[],
    configShape: T, // Make configShape mandatory
    logger?: Logger,
}): Cardigantime<T> => {

    // Validate that configDirectory is a string
    if (!pOptions.defaults.configDirectory || typeof pOptions.defaults.configDirectory !== 'string') {
        throw new Error(`Configuration directory must be a string, received: ${typeof pOptions.defaults.configDirectory} (${JSON.stringify(pOptions.defaults.configDirectory)})`);
    }

    const defaults: DefaultOptions = { ...DEFAULT_OPTIONS, ...pOptions.defaults } as DefaultOptions;
    const features = pOptions.features || DEFAULT_FEATURES;
    const configShape = pOptions.configShape;
    let logger = pOptions.logger || DEFAULT_LOGGER;

    const options: Options<T> = {
        defaults,
        features,
        configShape, // Store the shape
        logger,
    }

    const setLogger = (pLogger: Logger) => {
        logger = pLogger;
        options.logger = pLogger;
    }

    const generateConfig = async (configDirectory?: string): Promise<void> => {
        const targetDir = configDirectory || options.defaults.configDirectory;
        const configFile = options.defaults.configFile;
        const encoding = options.defaults.encoding;

        // Validate that targetDir is a string
        if (!targetDir || typeof targetDir !== 'string') {
            throw new Error(`Configuration directory must be a string, received: ${typeof targetDir} (${JSON.stringify(targetDir)})`);
        }

        logger.verbose(`Generating configuration file in: ${targetDir}`);

        // Create storage utility
        const storage = Storage.create({ log: logger.debug });

        // Ensure the target directory exists
        const dirExists = await storage.exists(targetDir);
        if (!dirExists) {
            logger.info(`Creating configuration directory: ${targetDir}`);
            try {
                await storage.createDirectory(targetDir);
            } catch (error: any) {
                throw FileSystemError.directoryCreationFailed(targetDir, error);
            }
        }

        // Check if directory is writable
        const isWritable = await storage.isDirectoryWritable(targetDir);
        if (!isWritable) {
            throw new FileSystemError('not_writable', 'Configuration directory is not writable', targetDir, 'directory_write');
        }

        // Build the full config file path
        const configFilePath = path.join(targetDir, configFile);

        // Generate default configuration
        logger.debug(`Generating defaults for schema with keys: ${Object.keys(options.configShape).join(', ')}`);
        const defaultConfig = generateDefaultConfig(options.configShape, targetDir);
        logger.debug(`Generated default config: ${JSON.stringify(defaultConfig, null, 2)}`);

        // Convert to YAML with nice formatting
        const yamlContent = yaml.dump(defaultConfig, {
            indent: 2,
            lineWidth: 120,
            noRefs: true,
            sortKeys: true
        });

        // Add header comment to the YAML file
        const header = `# Configuration file generated by Cardigantime
# This file contains default values for your application configuration.
# Modify the values below to customize your application's behavior.
#
# For more information about Cardigantime configuration:
# https://github.com/tobrien/cardigantime

`;

        const finalContent = header + yamlContent;

        // Check if config file already exists
        const configExists = await storage.exists(configFilePath);
        if (configExists) {
            logger.warn(`Configuration file already exists: ${configFilePath}`);
            logger.warn('This file was not overwritten, but here is what the default configuration looks like if you want to copy it:');
            logger.info('\n' + '='.repeat(60));
            logger.info(finalContent.trim());
            logger.info('='.repeat(60));
            return;
        }

        // Write the configuration file
        try {
            await storage.writeFile(configFilePath, finalContent, encoding);
            logger.info(`Configuration file generated successfully: ${configFilePath}`);
        } catch (error: any) {
            throw FileSystemError.operationFailed('write configuration file', configFilePath, error);
        }
    };

    return {
        setLogger,
        configure: (command: Command) => configure(command, options),
        validate: (config: z.infer<ZodObject<T & typeof ConfigSchema.shape>>) => validate(config, options),
        read: (args: Args) => read(args, options),
        generateConfig,
        checkConfig: (args: Args) => checkConfig(args, options),
    }
}





