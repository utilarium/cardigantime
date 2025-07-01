import { DefaultOptions, Feature, Logger } from "./types";

/** Version string populated at build time with git and system information */
export const VERSION = '__VERSION__ (__GIT_BRANCH__/__GIT_COMMIT__ __GIT_TAGS__ __GIT_COMMIT_DATE__) __SYSTEM_INFO__';

/** The program name used in CLI help and error messages */
export const PROGRAM_NAME = 'cardigantime';

/** Default file encoding for reading configuration files */
export const DEFAULT_ENCODING = 'utf8';

/** Default configuration file name to look for in the config directory */
export const DEFAULT_CONFIG_FILE = 'config.yaml';

/**
 * Default configuration options applied when creating a Cardigantime instance.
 * These provide sensible defaults that work for most use cases.
 */
export const DEFAULT_OPTIONS: Partial<DefaultOptions> = {
    configFile: DEFAULT_CONFIG_FILE,
    isRequired: false,
    encoding: DEFAULT_ENCODING,
    pathResolution: undefined, // No path resolution by default
}

/**
 * Default features enabled when creating a Cardigantime instance.
 * Currently includes only the 'config' feature for configuration file support.
 */
export const DEFAULT_FEATURES: Feature[] = ['config'];

/**
 * Default logger implementation using console methods.
 * Provides basic logging functionality when no custom logger is specified.
 * The verbose and silly methods are no-ops to avoid excessive output.
 */
export const DEFAULT_LOGGER: Logger = {
    // eslint-disable-next-line no-console
    debug: console.debug,
    // eslint-disable-next-line no-console
    info: console.info,
    // eslint-disable-next-line no-console
    warn: console.warn,
    // eslint-disable-next-line no-console
    error: console.error,

    verbose: () => { },

    silly: () => { },
}
