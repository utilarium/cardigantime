import { DefaultOptions, Feature, Logger } from "./types";

export const VERSION = '__VERSION__ (__GIT_BRANCH__/__GIT_COMMIT__ __GIT_TAGS__ __GIT_COMMIT_DATE__) __SYSTEM_INFO__';
export const PROGRAM_NAME = 'cardigantime';
export const DEFAULT_ENCODING = 'utf8';
export const DEFAULT_CONFIG_FILE = 'config.yaml';

export const DEFAULT_OPTIONS: Partial<DefaultOptions> = {
    configFile: DEFAULT_CONFIG_FILE,
    isRequired: false,
    encoding: DEFAULT_ENCODING,
}

export const DEFAULT_FEATURES: Feature[] = ['config'];

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
