/**
 * Path validation utilities for checking path existence on the filesystem
 */

import * as fs from 'node:fs';

/**
 * Validates that paths exist on the filesystem
 * @param value - The value to validate (string, array, object, or other)
 * @param fieldName - The config field name (for error messages)
 * @param configPath - The config file path (for error messages)
 * @returns The value unchanged if validation passes
 * @throws Error if any path doesn't exist
 */
export function validatePath(
    value: any,
    fieldName: string,
    configPath: string
): any {
    if (typeof value === 'string') {
        validatePathString(value, fieldName, configPath);
        return value;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            if (typeof item === 'string') {
                validatePathString(item, `${fieldName}[${index}]`, configPath);
            }
        });
        return value;
    }

    if (value && typeof value === 'object') {
        for (const [key, val] of Object.entries(value)) {
            if (typeof val === 'string') {
                validatePathString(val, `${fieldName}.${key}`, configPath);
            } else if (Array.isArray(val)) {
                val.forEach((item, index) => {
                    if (typeof item === 'string') {
                        validatePathString(item, `${fieldName}.${key}[${index}]`, configPath);
                    }
                });
            }
        }
        return value;
    }

    return value;
}

/**
 * Validates that a single path string exists on the filesystem
 * @param pathStr - The path to validate
 * @param fieldName - The field name for error messages
 * @param configPath - The config file path for error messages
 * @throws Error if path doesn't exist
 */
function validatePathString(
    pathStr: string,
    fieldName: string,
    configPath: string
): void {
    try {
        fs.statSync(pathStr);
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(
                `Path does not exist: ${pathStr}\n` +
                `  Field: ${fieldName}\n` +
                `  Config: ${configPath}\n` +
                `  Hint: Check that the path is correct and the file/directory exists`
            );
        }
        throw new Error(
            `Failed to validate path: ${pathStr}\n` +
            `  Field: ${fieldName}\n` +
            `  Config: ${configPath}\n` +
            `  Error: ${(err as Error).message}`
        );
    }
}
