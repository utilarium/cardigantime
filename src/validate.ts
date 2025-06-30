import { z, ZodObject } from "zod";
import { ArgumentError } from "./error/ArgumentError";
import { ConfigSchema, Logger, Options } from "./types";
import * as Storage from "./util/storage";
export { ArgumentError };

export const listZodKeys = (schema: z.ZodTypeAny, prefix = ''): string[] => {
    // Check if schema has unwrap method (which both ZodOptional and ZodNullable have)
    if (schema._def && (schema._def.typeName === 'ZodOptional' || schema._def.typeName === 'ZodNullable')) {
        // Use type assertion to handle the unwrap method
        const unwrappable = schema as z.ZodOptional<any> | z.ZodNullable<any>;
        return listZodKeys(unwrappable.unwrap(), prefix);
    }

    // Handle ZodAny and ZodRecord - these accept any keys, so don't introspect
    if (schema._def && (schema._def.typeName === 'ZodAny' || schema._def.typeName === 'ZodRecord')) {
        return prefix ? [prefix] : [];
    }

    if (schema._def && schema._def.typeName === 'ZodArray') {
        // Use type assertion to handle the element property
        const arraySchema = schema as z.ZodArray<any>;
        return listZodKeys(arraySchema.element, prefix);
    }
    if (schema._def && schema._def.typeName === 'ZodObject') {
        // Use type assertion to handle the shape property
        const objectSchema = schema as z.ZodObject<any>;
        return Object.entries(objectSchema.shape).flatMap(([key, subschema]) => {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            const nested = listZodKeys(subschema as z.ZodTypeAny, fullKey);
            return nested.length ? nested : fullKey;
        });
    }
    return [];
}

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



export const checkForExtraKeys = (mergedSources: object, fullSchema: ZodObject<any>, logger: Logger | typeof console): void => {
    const allowedKeys = new Set(listZodKeys(fullSchema));
    const actualKeys = listObjectKeys(mergedSources as Record<string, unknown>);

    // Filter out keys that are under a record type (ZodRecord accepts any keys)
    const recordPrefixes = new Set<string>();

    // Find all prefixes that are ZodRecord types
    const findRecordPrefixes = (schema: z.ZodTypeAny, prefix = ''): void => {
        if (schema._def && (schema._def.typeName === 'ZodOptional' || schema._def.typeName === 'ZodNullable')) {
            const unwrappable = schema as z.ZodOptional<any> | z.ZodNullable<any>;
            findRecordPrefixes(unwrappable.unwrap(), prefix);
            return;
        }

        if (schema._def && (schema._def.typeName === 'ZodAny' || schema._def.typeName === 'ZodRecord')) {
            if (prefix) recordPrefixes.add(prefix);
            return;
        }

        if (schema._def && schema._def.typeName === 'ZodObject') {
            const objectSchema = schema as z.ZodObject<any>;
            Object.entries(objectSchema.shape).forEach(([key, subschema]) => {
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
        const allowedKeysString = Array.from(allowedKeys).join(', ');
        const extraKeysString = extraKeys.join(', ');
        const errorMessage = `Unknown configuration keys found: ${extraKeysString}. Allowed keys are: ${allowedKeysString}`;
        logger.error(errorMessage);
        throw new Error(`Configuration validation failed: Unknown keys found (${extraKeysString}). Check logs for details.`);
    }
}

const validateConfigDirectory = async (configDirectory: string, isRequired: boolean): Promise<void> => {
    // eslint-disable-next-line no-console
    const storage = Storage.create({ log: console.log });
    const exists = await storage.exists(configDirectory);
    if (!exists) {
        if (isRequired) {
            throw new Error(`Config directory does not exist and is required: ${configDirectory}`);
        }
    } else if (exists) {
        const isReadable = await storage.isDirectoryReadable(configDirectory);
        if (!isReadable) {
            throw new Error(`Config directory exists but is not readable: ${configDirectory}`);
        }
    }
}

export const validate = async <T extends z.ZodRawShape>(config: z.infer<ZodObject<T & typeof ConfigSchema.shape>>, options: Options<T>): Promise<void> => {
    const logger = options.logger;

    if (options.features.includes('config') && config.configDirectory) {
        await validateConfigDirectory(config.configDirectory, options.defaults.isRequired);
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
        logger.error('Configuration validation failed: %s', JSON.stringify(validationResult.error.format(), null, 2));
        throw new Error(`Configuration validation failed. Check logs for details.`);
    }

    return;
}

