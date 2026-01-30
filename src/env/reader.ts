import { EnvVarNamingConfig, EnvVarReadResult } from './types';
import { generateEnvVarName } from './naming';

/**
 * Read environment variable value
 * 
 * This is a simple wrapper around process.env access for testability
 * and consistency. It does not throw errors for missing variables.
 * 
 * @param envVarName - Full env var name (e.g., 'RIOTPLAN_PLAN_DIRECTORY')
 * @returns Value from process.env or undefined if not set
 */
export function readEnvVar(envVarName: string): string | undefined {
    return process.env[envVarName];
}

/**
 * Read environment variable for a config field
 * 
 * Checks custom mapping first (from envVarMap), then falls back to
 * auto-generated name. This allows users to override the default
 * naming convention for specific fields.
 * 
 * Example:
 *   readEnvVarForField('openaiApiKey', {
 *     appName: 'riotplan',
 *     envVarMap: { openaiApiKey: 'OPENAI_API_KEY' }
 *   })
 *   // Reads from OPENAI_API_KEY instead of RIOTPLAN_OPENAI_API_KEY
 * 
 * @param fieldPath - Field path in config (e.g., 'planDirectory' or ['api', 'key'])
 * @param config - Naming configuration with appName and envVarMap
 * @returns Object with env var name and value
 */
export function readEnvVarForField(
    fieldPath: string | string[],
    config: EnvVarNamingConfig
): EnvVarReadResult {
    const fieldKey = Array.isArray(fieldPath) 
        ? fieldPath.join('.') 
        : fieldPath;

    // Check for custom mapping first
    if (config.envVarMap && fieldKey in config.envVarMap) {
        const customName = config.envVarMap[fieldKey];
        const value = readEnvVar(customName);
        return {
            envVarName: customName,
            value,
            isCustom: true,
            fieldPath,
        };
    }

    // Use auto-generated name
    const autoName = generateEnvVarName(config.appName, fieldPath);
    const value = readEnvVar(autoName);
    return {
        envVarName: autoName,
        value,
        isCustom: false,
        fieldPath,
    };
}

/**
 * Read all environment variables for a schema
 * 
 * Returns a map of field paths to env var values. Only includes
 * fields that have corresponding environment variables set.
 * Missing env vars are not included in the result.
 * 
 * This is useful for batch reading all env vars for a config schema
 * at once, which can then be merged with other config sources.
 * 
 * @param fieldPaths - All field paths from schema
 * @param config - Naming configuration
 * @returns Map of field paths to read results (only includes set vars)
 */
export function readEnvVarsForSchema(
    fieldPaths: string[],
    config: EnvVarNamingConfig
): Map<string, EnvVarReadResult> {
    const results = new Map<string, EnvVarReadResult>();

    for (const fieldPath of fieldPaths) {
        const result = readEnvVarForField(fieldPath, config);
        if (result.value !== undefined) {
            results.set(fieldPath, result);
        }
    }

    return results;
}
