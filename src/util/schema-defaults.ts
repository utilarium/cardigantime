import { z } from 'zod';

/**
 * Extracts default values from a Zod schema recursively using Zod v4's parsing mechanisms.
 *
 * This function leverages Zod's own parsing behavior to extract defaults rather than
 * accessing internal properties. It works by:
 * 1. For ZodDefault types: parsing undefined to trigger the default
 * 2. For ZodObject types: creating a minimal object and parsing to get all defaults
 * 3. For wrapped types: unwrapping and recursing
 *
 * @param schema - The Zod schema to extract defaults from
 * @returns An object containing all default values from the schema
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   name: z.string().default('app'),
 *   port: z.number().default(3000),
 *   debug: z.boolean().default(false),
 *   database: z.object({
 *     host: z.string().default('localhost'),
 *     port: z.number().default(5432)
 *   })
 * });
 *
 * const defaults = extractSchemaDefaults(schema);
 * // Returns: { name: 'app', port: 3000, debug: false, database: { host: 'localhost', port: 5432 } }
 * ```
 */
export const extractSchemaDefaults = (schema: z.ZodTypeAny): any => {
    // Handle ZodDefault - parse undefined to get the default value
    if (schema instanceof z.ZodDefault) {
        try {
            return schema.parse(undefined);
        } catch {
            // If parsing undefined fails, return undefined
            return undefined;
        }
    }

    // Handle ZodOptional and ZodNullable by unwrapping
    if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
        return extractSchemaDefaults(schema.unwrap() as any);
    }

    // Handle ZodObject - create an object with defaults by parsing an empty object
    if (schema instanceof z.ZodObject) {
        const defaults: any = {};
        const shape = schema.shape;

        // First, try to extract defaults from individual fields
        for (const [key, subschema] of Object.entries(shape)) {
            const defaultValue = extractSchemaDefaults(subschema as any);
            if (defaultValue !== undefined) {
                defaults[key] = defaultValue;
            }
        }

        // Then parse an empty object to trigger any schema-level defaults
        const result = schema.safeParse({});
        if (result.success) {
            // Merge the parsed result with our extracted defaults
            return { ...defaults, ...result.data };
        }

        return Object.keys(defaults).length > 0 ? defaults : undefined;
    }

    // Handle ZodArray - return empty array as a reasonable default
    if (schema instanceof z.ZodArray) {
        const elementDefaults = extractSchemaDefaults(schema.element as any);
        return elementDefaults !== undefined ? [elementDefaults] : [];
    }

    // Handle ZodRecord - return empty object as default
    if (schema instanceof z.ZodRecord) {
        return {};
    }

    // No default available for other schema types
    return undefined;
};

/**
 * Extracts default values that should be included in generated config files.
 *
 * This function is similar to extractSchemaDefaults but filters out certain types
 * of defaults that shouldn't appear in generated configuration files, such as
 * computed defaults or system-specific values.
 *
 * @param schema - The Zod schema to extract config file defaults from
 * @returns An object containing default values suitable for config files
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   appName: z.string().default('my-app'),
 *   timestamp: z.number().default(() => Date.now()), // Excluded from config files
 *   port: z.number().default(3000)
 * });
 *
 * const configDefaults = extractConfigFileDefaults(schema);
 * // Returns: { appName: 'my-app', port: 3000 }
 * // Note: timestamp is excluded because it's a function-based default
 * ```
 */
export const extractConfigFileDefaults = (schema: z.ZodTypeAny): any => {
    // Handle ZodDefault - parse undefined to get the default value
    if (schema instanceof z.ZodDefault) {
        try {
            const defaultValue = schema.parse(undefined);
            // Exclude function-generated defaults from config files
            // These are typically runtime-computed values
            if (typeof defaultValue === 'function') {
                return undefined;
            }
            return defaultValue;
        } catch {
            return undefined;
        }
    }

    // Handle ZodOptional and ZodNullable by unwrapping
    if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
        return extractConfigFileDefaults(schema.unwrap() as any);
    }

    // Handle ZodObject - extract defaults suitable for config files
    if (schema instanceof z.ZodObject) {
        const defaults: any = {};
        const shape = schema.shape;

        for (const [key, subschema] of Object.entries(shape)) {
            const defaultValue = extractConfigFileDefaults(subschema as any);
            if (defaultValue !== undefined) {
                defaults[key] = defaultValue;
            }
        }

        // Parse an empty object to get any schema-level defaults
        const result = schema.safeParse({});
        if (result.success) {
            // Filter out any function-based or computed values
            const filteredData: any = {};
            for (const [key, value] of Object.entries(result.data)) {
                if (typeof value !== 'function' && value !== null) {
                    filteredData[key] = value;
                }
            }
            return { ...defaults, ...filteredData };
        }

        return Object.keys(defaults).length > 0 ? defaults : undefined;
    }

    // Handle ZodArray - typically don't include array defaults in config files
    if (schema instanceof z.ZodArray) {
        // For config files, we usually don't want to pre-populate arrays
        return undefined;
    }

    // Handle ZodRecord - return empty object as default for config files
    if (schema instanceof z.ZodRecord) {
        return {};
    }

    // No default available for other schema types
    return undefined;
};

/**
 * Generates a complete configuration object with all default values populated.
 *
 * This function combines the base ConfigSchema with a user-provided schema shape
 * and extracts all available default values to create a complete configuration
 * example that can be serialized to YAML.
 *
 * @template T - The Zod schema shape type
 * @param configShape - The user's configuration schema shape
 * @param configDirectory - The configuration directory to include in the defaults
 * @returns An object containing all default values suitable for YAML serialization
 *
 * @example
 * ```typescript
 * const shape = z.object({
 *   apiKey: z.string().describe('Your API key'),
 *   timeout: z.number().default(5000).describe('Request timeout in milliseconds'),
 *   features: z.array(z.string()).default(['auth', 'logging'])
 * }).shape;
 *
 * const config = generateDefaultConfig(shape, './config');
 * // Returns: { timeout: 5000, features: ['auth', 'logging'] }
 * // Note: apiKey is not included since it has no default
 * ```
 */
export const generateDefaultConfig = <T extends z.ZodRawShape>(
    configShape: T,
    _configDirectory: string
): Record<string, any> => {
    // Create the full schema by combining base and user schema
    const fullSchema = z.object({
        ...configShape,
    });

    // Extract defaults from the full schema using only explicit defaults
    const defaults = extractSchemaDefaults(fullSchema);

    // Don't include configDirectory in the generated file since it's runtime-specific
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { configDirectory: _, ...configDefaults } = defaults || {};

    return configDefaults || {};
};

