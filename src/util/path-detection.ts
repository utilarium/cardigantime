/**
 * Path detection utilities for warning about unmarked paths in configuration
 */

/**
 * Detects config values that look like paths but aren't in pathFields
 * Emits warnings to help developers catch misconfigured path fields
 * @param config - The raw config object (before resolution)
 * @param pathFields - List of fields configured as paths
 * @param configPath - The config file path (for warning messages)
 */
export function detectUnmarkedPaths(
    config: Record<string, any>,
    pathFields: string[],
    configPath: string
): void {
    const warnings: string[] = [];

    // Scan all config fields
    for (const [field, value] of Object.entries(config)) {
        // Skip fields that are already in pathFields
        if (pathFields.includes(field)) {
            continue;
        }

        // Check if value looks like a path
        const suspiciousPaths = findSuspiciousPaths(value, field);
        warnings.push(...suspiciousPaths);
    }

    // Emit warnings
    if (warnings.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(
            `\n⚠️  Potential unmarked paths detected in ${configPath}:\n` +
            warnings.map(w => `   ${w}`).join('\n') +
            `\n\n   These values look like paths but aren't in pathFields.\n` +
            `   If they are paths, add them to pathResolution.pathFields.\n` +
            `   To disable this warning, set pathResolution.warnUnmarkedPaths: false\n`
        );
    }
}

/**
 * Recursively finds values that look like paths
 * @param value - The value to scan
 * @param fieldPath - The current field path (for reporting)
 * @returns Array of warning messages
 */
function findSuspiciousPaths(value: any, fieldPath: string): string[] {
    const warnings: string[] = [];

    if (typeof value === 'string') {
        if (looksLikePath(value)) {
            warnings.push(`${fieldPath}: "${value}"`);
        }
    } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
            if (typeof item === 'string' && looksLikePath(item)) {
                warnings.push(`${fieldPath}[${index}]: "${item}"`);
            }
        });
    } else if (value && typeof value === 'object') {
        for (const [key, val] of Object.entries(value)) {
            const nested = findSuspiciousPaths(val, `${fieldPath}.${key}`);
            warnings.push(...nested);
        }
    }

    return warnings;
}

/**
 * Checks if a string looks like a relative path
 * @param str - The string to check
 * @returns True if the string contains path indicators
 */
function looksLikePath(str: string): boolean {
    // Check for relative path indicators
    return str.includes('./') || str.includes('../');
}
