/**
 * Configuration for environment variable naming
 */
export interface EnvVarNamingConfig {
    /** Application name used as prefix (e.g., 'riotplan') */
    appName: string;
    /** Custom env var name overrides */
    envVarMap?: Record<string, string>;
}

/**
 * Result of env var name generation
 */
export interface EnvVarName {
    /** Full env var name (e.g., 'RIOTPLAN_PLAN_DIRECTORY') */
    name: string;
    /** Field path in config (e.g., 'planDirectory' or ['api', 'key']) */
    fieldPath: string | string[];
    /** Whether this is a custom override */
    isCustom: boolean;
}

/**
 * Result of reading an environment variable
 */
export interface EnvVarReadResult {
    /** Full env var name that was read */
    envVarName: string;
    /** Value from process.env (undefined if not set) */
    value: string | undefined;
    /** Whether this used a custom mapping */
    isCustom: boolean;
    /** Field path in config */
    fieldPath: string | string[];
}

/**
 * Source information for env var config
 */
export interface EnvVarConfigSource {
    type: 'env';
    /** Map of field paths to env var read results */
    values: Map<string, EnvVarReadResult>;
    /** When the env vars were read */
    readAt: Date;
}
