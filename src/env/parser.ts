import { z, ZodTypeAny } from 'zod';
import yn from 'yn';
import { EnvVarParseError } from './errors';

/**
 * Parse environment variable value based on Zod schema type
 * 
 * This function inspects the Zod schema type and delegates to the appropriate
 * parser function. It supports boolean, number, array, and string types.
 * 
 * @param value - Raw string value from process.env
 * @param zodType - Zod schema type to parse into
 * @returns Parsed value of appropriate type
 * @throws EnvVarParseError if parsing fails
 */
export function parseEnvVar(
    value: string | undefined,
    zodType: ZodTypeAny
): unknown {
    if (value === undefined) {
        return undefined;
    }

    // Detect Zod type and parse accordingly
    if (zodType instanceof z.ZodBoolean) {
        return parseBoolean(value);
    }

    if (zodType instanceof z.ZodNumber) {
        return parseNumber(value);
    }

    if (zodType instanceof z.ZodArray) {
        return parseArray(value, zodType._def.element as ZodTypeAny);
    }

    if (zodType instanceof z.ZodString) {
        return value; // Already a string
    }

    // For other types, return string and let Zod validate
    return value;
}

/**
 * Parse boolean from various string formats
 * 
 * Uses the 'yn' library (https://github.com/sindresorhus/yn) which is
 * well-maintained with 7.1M weekly downloads. Supports case-insensitive:
 * - true/false
 * - yes/no
 * - y/n
 * - 1/0
 * - on/off
 * 
 * Empty string is treated as false.
 * 
 * @param value - String value to parse
 * @returns Boolean value
 * @throws EnvVarParseError if value cannot be parsed as boolean
 */
export function parseBoolean(value: string): boolean {
    // Handle empty string explicitly as false
    if (value === '') {
        return false;
    }

    const result = yn(value, { default: undefined });

    if (result === undefined) {
        throw new EnvVarParseError(
            `Cannot parse "${value}" as boolean. Expected: true/false, yes/no, 1/0, or empty string`,
            value,
            'boolean'
        );
    }

    return result;
}

/**
 * Parse number from string
 * 
 * Supports:
 * - Integers: 42, -10, 0
 * - Floats: 3.14, -2.7, 0.5
 * - Scientific notation: 1e6, 1.5e3, 2e-3
 * - Hexadecimal: 0xFF, 0x10
 * 
 * @param value - String value to parse
 * @returns Number value
 * @throws EnvVarParseError if value cannot be parsed as number
 */
export function parseNumber(value: string): number {
    // Handle hex (0xFF)
    if (value.startsWith('0x') || value.startsWith('0X')) {
        const parsed = parseInt(value, 16);
        if (isNaN(parsed)) {
            throw new EnvVarParseError(
                `Cannot parse "${value}" as hexadecimal number`,
                value,
                'number'
            );
        }
        return parsed;
    }

    // Handle scientific notation, floats, and integers
    const parsed = Number(value);

    if (isNaN(parsed)) {
        throw new EnvVarParseError(
            `Cannot parse "${value}" as number`,
            value,
            'number'
        );
    }

    return parsed;
}

/**
 * Parse array from space-separated string
 * 
 * Example: "tag1 tag2 tag3" -> ['tag1', 'tag2', 'tag3']
 * 
 * Each item is parsed according to the element type of the array schema.
 * Multiple spaces are treated as a single separator.
 * Leading and trailing whitespace is trimmed.
 * 
 * Note: Items with spaces are not supported in this version.
 * 
 * @param value - Space-separated string value
 * @param elementType - Zod schema type for array elements
 * @returns Array of parsed values
 */
export function parseArray(
    value: string,
    elementType: ZodTypeAny
): unknown[] {
    // Handle empty string as empty array
    const trimmed = value.trim();
    if (trimmed === '') {
        return [];
    }

    const items = trimmed.split(/\s+/);

    // Parse each item according to element type
    return items.map(item => parseEnvVar(item, elementType));
}
