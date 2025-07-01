import { Command } from 'commander';
import { Args, DefaultOptions, Feature, Cardigantime, Logger, Options } from 'types';
import { z, ZodObject } from 'zod';
import { configure } from './configure';
import { DEFAULT_FEATURES, DEFAULT_LOGGER, DEFAULT_OPTIONS } from './constants';
import { read } from './read';
import { ConfigSchema } from 'types';
import { validate } from './validate';

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
 *     }
 *   },
 *   configShape: MyConfigSchema.shape,
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

    return {
        setLogger,
        configure: (command: Command) => configure(command, options),
        validate: (config: z.infer<ZodObject<T & typeof ConfigSchema.shape>>) => validate(config, options),
        read: (args: Args) => read(args, options),
    }
}





