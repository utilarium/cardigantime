import { z, ZodObject } from "zod";
import { ArgumentError } from "./error/ArgumentError";
import { ConfigurationError } from "./error/ConfigurationError";
import { FileSystemError } from "./error/FileSystemError";
import { ConfigSchema, Logger, Options } from "./types";
import * as Storage from "./util/storage";
export { ArgumentError, ConfigurationError, FileSystemError };

/**
 * Recursively extracts all keys from a Zod schema in dot notation.
 *
 * This function traverses a Zod schema structure and builds a flat list
 * of all possible keys, using dot notation for nested objects. It handles
 * optional/nullable types by unwrapping them and supports arrays by
 * introspecting their element type.
 *
 * Special handling for:
 * - ZodOptional/ZodNullable: Unwraps to get the underlying type
 * - ZodAny/ZodRecord: Accepts any keys, returns the prefix or empty array
 * - ZodArray: Introspects the element type
 * - ZodObject: Recursively processes all shape properties
 *
 * @param schema - The Zod schema to introspect
 * @param prefix - Internal parameter for building nested key paths
 * @returns Array of strings representing all possible keys in dot notation
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   user: z.object({
 *     name: z.string(),
 *     settings: z.object({ theme: z.string() })
 *   }),
 *   debug: z.boolean()
 * });
 *
 * const keys = listZodKeys(schema);
 * // Returns: ['user.name', 'user.settings.theme', 'debug']
 * ```
 */
export const listZodKeys = (schema: z.ZodTypeAny, prefix = ''): string[] => {
    // Handle ZodOptional and ZodNullable - unwrap to get the underlying type
    if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
        return listZodKeys(schema.unwrap() as z.ZodTypeAny, prefix);
    }

    // Handle ZodAny and ZodRecord - these accept any keys, so don't introspect
    if (schema instanceof z.ZodAny || schema instanceof z.ZodRecord) {
        return prefix ? [prefix] : [];
    }

    if (schema instanceof z.ZodArray) {
        return listZodKeys(schema.element as z.ZodTypeAny, prefix);
    }

    if (schema instanceof z.ZodObject) {
        return Object.entries(schema.shape).flatMap(([key, subschema]) => {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            const nested = listZodKeys(subschema as z.ZodTypeAny, fullKey);
            return nested.length ? nested : fullKey;
        });
    }
    return [];
}

/**
 * Type guard to check if a value is a plain object (not array, null, or other types).
 *
 * @param value - The value to check
 * @returns True if the value is a plain object
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    // Check if it's an object, not null, and not an array.
    return value !== null && typeof value === 'object' && !Array.isArray(value);
};

/**
 * Generates a list of all keys within a JavaScript object, using dot notation for nested keys.
 * Mimics the behavior of listZodKeys but operates on plain objects.
 * For arrays, it inspects the first element that is a plain object to determine nested keys.
 * If an array contains no plain objects, or is empty, the key for the array itself is listed.
 *
 * @param obj The object to introspect.
 * @param prefix Internal use for recursion: the prefix for the current nesting level.
 * @returns An array of strings representing all keys in dot notation.
 */
export const listObjectKeys = (obj: Record<string, unknown>, prefix = ''): string[] => {
    const keys = new Set<string>(); // Use Set to automatically handle duplicates from array recursion

    for (const key in obj) {
        // Ensure it's an own property, not from the prototype chain
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            const fullKey = prefix ? `${prefix}.${key}` : key;

            if (Array.isArray(value)) {
                // Find the first element that is a plain object to determine structure
                const firstObjectElement = value.find(isPlainObject);
                if (firstObjectElement) {
                    // Recurse into the structure of the first object element found
                    const nestedKeys = listObjectKeys(firstObjectElement, fullKey);
                    nestedKeys.forEach(k => keys.add(k));
                } else {
                    // Array is empty or contains no plain objects, list the array key itself
                    keys.add(fullKey);
                }
            } else if (isPlainObject(value)) {
                // Recurse into nested plain objects
                const nestedKeys = listObjectKeys(value, fullKey);
                nestedKeys.forEach(k => keys.add(k));
            } else {
                // It's a primitive, null, or other non-plain object/array type
                keys.add(fullKey);
            }
        }
    }
    return Array.from(keys); // Convert Set back to Array
};

/**
 * Validates that the configuration object contains only keys allowed by the schema.
 *
 * This function prevents configuration errors by detecting typos or extra keys
 * that aren't defined in the Zod schema. It intelligently handles:
 * - ZodRecord types that accept arbitrary keys
 * - Nested objects and their key structures
 * - Arrays and their element key structures
 *
 * The function throws a ConfigurationError if extra keys are found, providing
 * helpful information about what keys are allowed vs. what was found.
 *
 * @param mergedSources - The merged configuration object to validate
 * @param fullSchema - The complete Zod schema including base and user schemas
 * @param logger - Logger for error reporting
 * @throws {ConfigurationError} When extra keys are found that aren't in the schema
 *
 * @example
 * ```typescript
 * const schema = z.object({ name: z.string(), age: z.number() });
 * const config = { name: 'John', age: 30, typo: 'invalid' };
 *
 * checkForExtraKeys(config, schema, console);
 * // Throws: ConfigurationError with details about 'typo' being an extra key
 * ```
 */
export const checkForExtraKeys = (mergedSources: object, fullSchema: ZodObject<any>, logger: Logger | typeof console): void => {
    const allowedKeys = new Set(listZodKeys(fullSchema));
    const actualKeys = listObjectKeys(mergedSources as Record<string, unknown>);

    // Filter out keys that are under a record type (ZodRecord accepts any keys)
    const recordPrefixes = new Set<string>();

    // Find all prefixes that are ZodRecord types
    const findRecordPrefixes = (schema: z.ZodTypeAny, prefix = ''): void => {
        if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
            findRecordPrefixes(schema.unwrap() as z.ZodTypeAny, prefix);
            return;
        }

        if (schema instanceof z.ZodAny || schema instanceof z.ZodRecord) {
            if (prefix) recordPrefixes.add(prefix);
            return;
        }

        if (schema instanceof z.ZodObject) {
            Object.entries(schema.shape).forEach(([key, subschema]) => {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                findRecordPrefixes(subschema as z.ZodTypeAny, fullKey);
            });
        }
    };

    findRecordPrefixes(fullSchema);

    // Filter out keys that are under record prefixes
    const extraKeys = actualKeys.filter(key => {
        if (allowedKeys.has(key)) return false;

        // Check if this key is under a record prefix
        for (const recordPrefix of recordPrefixes) {
            if (key.startsWith(recordPrefix + '.')) {
                return false; // This key is allowed under a record
            }
        }

        return true; // This is an extra key
    });

    if (extraKeys.length > 0) {
        const allowedKeysArray = Array.from(allowedKeys);
        const error = ConfigurationError.extraKeys(extraKeys, allowedKeysArray);
        logger.error(error.message);
        throw error;
    }
}

/**
 * Validates that a configuration directory exists and is accessible.
 *
 * This function performs file system checks to ensure the configuration
 * directory can be used. It handles the isRequired flag to determine
 * whether a missing directory should cause an error or be silently ignored.
 *
 * @param configDirectory - Path to the configuration directory
 * @param isRequired - Whether the directory must exist
 * @param logger - Optional logger for debug information
 * @throws {FileSystemError} When the directory is required but missing or unreadable
 */
const validateConfigDirectory = async (configDirectory: string, isRequired: boolean, logger?: Logger): Promise<void> => {
    const storage = Storage.create({ log: logger?.debug || (() => { }) });
    const exists = await storage.exists(configDirectory);
    if (!exists) {
        if (isRequired) {
            throw FileSystemError.directoryNotFound(configDirectory, true);
        }
    } else if (exists) {
        const isReadable = await storage.isDirectoryReadable(configDirectory);
        if (!isReadable) {
            throw FileSystemError.directoryNotReadable(configDirectory);
        }
    }
}

/**
 * Validates a configuration object against the combined Zod schema.
 *
 * This is the main validation function that:
 * 1. Validates the configuration directory (if config feature enabled)
 * 2. Combines the base ConfigSchema with user-provided schema shape
 * 3. Checks for extra keys not defined in the schema
 * 4. Validates all values against their schema definitions
 * 5. Provides detailed error reporting for validation failures
 *
 * The validation is comprehensive and catches common configuration errors
 * including typos, missing required fields, wrong types, and invalid values.
 *
 * @template T - The Zod schema shape type for configuration validation
 * @param config - The merged configuration object to validate
 * @param options - Cardigantime options containing schema, defaults, and logger
 * @throws {ConfigurationError} When configuration validation fails
 * @throws {FileSystemError} When configuration directory validation fails
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   apiKey: z.string().min(1),
 *   timeout: z.number().positive(),
 * });
 *
 * await validate(config, {
 *   configShape: schema.shape,
 *   defaults: { configDirectory: './config', isRequired: true },
 *   logger: console,
 *   features: ['config']
 * });
 * // Throws detailed errors if validation fails
 * ```
 */
export const validate = async <T extends z.ZodRawShape>(config: z.infer<ZodObject<T & typeof ConfigSchema.shape>>, options: Options<T>): Promise<void> => {
    const logger = options.logger;

    if (options.features.includes('config') && (config as any).configDirectory) {
        await validateConfigDirectory((config as any).configDirectory, options.defaults.isRequired, logger);
    }

    // Combine the base schema with the user-provided shape
    const fullSchema = z.object({
        ...ConfigSchema.shape,
        ...options.configShape,
    });

    // Validate the merged sources against the full schema
    const validationResult = fullSchema.safeParse(config);

    // Check for extraneous keys
    checkForExtraKeys(config, fullSchema, logger);

    if (!validationResult.success) {
        const formattedError = JSON.stringify(validationResult.error.format(), null, 2);
        logger.error('Configuration validation failed. Check logs for details.');
        logger.silly('Configuration validation failed: %s', formattedError);
        throw ConfigurationError.validation('Configuration validation failed. Check logs for details.', validationResult.error);
    }

    return;
}

