/**
 * Convert camelCase to SCREAMING_SNAKE_CASE
 * 
 * Examples:
 *   planDirectory -> PLAN_DIRECTORY
 *   apiKey -> API_KEY
 *   maxRetryCount -> MAX_RETRY_COUNT
 *   openaiAPIKey -> OPENAI_API_KEY
 *   api.key -> API_KEY (dots converted to underscores)
 * 
 * @param camelCase - The camelCase string to convert
 * @returns The SCREAMING_SNAKE_CASE version
 */
export function toScreamingSnakeCase(camelCase: string): string {
    if (!camelCase) {
        return '';
    }

    // First, replace dots with underscores (for nested paths)
    // Then insert underscore before uppercase letters (but not at the start)
    // Handle consecutive capitals by keeping them together until a lowercase follows
    const result = camelCase
        .replace(/\./g, '_')  // Convert dots to underscores
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')  // Insert _ between lower/digit and upper
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2') // Insert _ between consecutive capitals when followed by lowercase
        .toUpperCase();

    return result;
}

/**
 * Flatten nested field path to single-underscore format
 * 
 * Examples:
 *   ['api', 'key'] -> 'api.key'
 *   ['config', 'server', 'port'] -> 'config.server.port'
 * 
 * @param path - Array of field path segments
 * @returns Dot-notation string
 */
export function flattenFieldPath(path: string[]): string {
    return path.join('.');
}

/**
 * Generate full env var name with prefix
 * 
 * Examples:
 *   ('riotplan', 'planDirectory') -> 'RIOTPLAN_PLAN_DIRECTORY'
 *   ('protokoll', ['api', 'key']) -> 'PROTOKOLL_API_KEY'
 *   ('MyApp', 'setting') -> 'MYAPP_SETTING'
 * 
 * @param appName - Application name to use as prefix
 * @param fieldPath - Field path as string or array
 * @returns Full environment variable name
 */
export function generateEnvVarName(
    appName: string,
    fieldPath: string | string[]
): string {
    // Convert app name to uppercase
    const prefix = appName.toUpperCase();

    // Convert field path to string if it's an array
    const fieldStr = Array.isArray(fieldPath) 
        ? flattenFieldPath(fieldPath) 
        : fieldPath;

    // Convert the field path to screaming snake case
    const fieldName = toScreamingSnakeCase(fieldStr);

    // Combine prefix and field name
    return `${prefix}_${fieldName}`;
}
