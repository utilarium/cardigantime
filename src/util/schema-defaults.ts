import { z } from 'zod';

/**
 * Extracts default values from a Zod schema recursively.
 * 
 * This function traverses a Zod schema and builds an object containing
 * all the default values defined in the schema. It handles:
 * - ZodDefault types with explicit default values
 * - ZodOptional/ZodNullable types by unwrapping them
 * - ZodObject types by recursively processing their shape
 * - ZodArray types by providing an empty array as default
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
    // Handle ZodDefault - extract the default value
    if (schema._def && schema._def.typeName === 'ZodDefault') {
        const defaultSchema = schema as z.ZodDefault<any>;
        return defaultSchema._def.defaultValue();
    }

    // Handle ZodOptional and ZodNullable - only recurse if there's an explicit default
    if (schema._def && (schema._def.typeName === 'ZodOptional' || schema._def.typeName === 'ZodNullable')) {
        const unwrappable = schema as z.ZodOptional<any> | z.ZodNullable<any>;
        const unwrapped = unwrappable.unwrap();

        // Only provide defaults if the unwrapped schema has explicit defaults
        // This prevents optional arrays/objects from automatically getting [] or {} defaults
        if (unwrapped._def && unwrapped._def.typeName === 'ZodDefault') {
            return extractSchemaDefaults(unwrapped);
        }

        // For optional fields without explicit defaults, return undefined
        return undefined;
    }

    // Handle ZodObject - recursively process shape
    if (schema._def && schema._def.typeName === 'ZodObject') {
        const objectSchema = schema as z.ZodObject<any>;
        const result: any = {};

        for (const [key, subschema] of Object.entries(objectSchema.shape)) {
            const defaultValue = extractSchemaDefaults(subschema as z.ZodTypeAny);
            if (defaultValue !== undefined) {
                result[key] = defaultValue;
            }
        }

        return Object.keys(result).length > 0 ? result : undefined;
    }

    // Handle ZodArray - provide empty array as default
    if (schema._def && schema._def.typeName === 'ZodArray') {
        const arraySchema = schema as z.ZodArray<any>;
        const elementDefaults = extractSchemaDefaults(arraySchema.element);
        // Return an empty array, or an array with one example element if it has defaults
        return elementDefaults !== undefined ? [elementDefaults] : [];
    }

    // Handle ZodRecord - provide empty object as default
    if (schema._def && schema._def.typeName === 'ZodRecord') {
        return {};
    }

    // For other types, return undefined (no default available)
    return undefined;
};

/**
 * Extracts meaningful defaults for config file generation, including sensible defaults for optional fields.
 * This is more generous than extractSchemaDefaults for the purpose of creating helpful config files.
 */
export const extractConfigFileDefaults = (schema: z.ZodTypeAny): any => {
    // Handle ZodDefault - extract the default value
    if (schema._def && schema._def.typeName === 'ZodDefault') {
        const defaultSchema = schema as z.ZodDefault<any>;
        return defaultSchema._def.defaultValue();
    }

    // Handle ZodOptional and ZodNullable - provide sensible defaults for config generation
    if (schema._def && (schema._def.typeName === 'ZodOptional' || schema._def.typeName === 'ZodNullable')) {
        const unwrappable = schema as z.ZodOptional<any> | z.ZodNullable<any>;
        const unwrapped = unwrappable.unwrap();

        // Recurse into the unwrapped schema to get its default or provide a sensible one
        const unwrappedDefault = extractConfigFileDefaults(unwrapped);
        if (unwrappedDefault !== undefined) {
            return unwrappedDefault;
        }

        // Provide sensible defaults for common types when generating config files
        if (unwrapped._def) {
            switch (unwrapped._def.typeName) {
                case 'ZodBoolean':
                    return false;
                case 'ZodNumber':
                    return 0;
                case 'ZodString':
                    return '';
                case 'ZodArray':
                    return [];
                case 'ZodRecord':
                    return {};
                case 'ZodObject':
                    return extractConfigFileDefaults(unwrapped);
            }
        }

        return undefined;
    }

    // Handle ZodObject - recursively process shape
    if (schema._def && schema._def.typeName === 'ZodObject') {
        const objectSchema = schema as z.ZodObject<any>;
        const result: any = {};

        for (const [key, subschema] of Object.entries(objectSchema.shape)) {
            const defaultValue = extractConfigFileDefaults(subschema as z.ZodTypeAny);
            if (defaultValue !== undefined) {
                result[key] = defaultValue;
            }
        }

        return Object.keys(result).length > 0 ? result : {};
    }

    // Handle ZodArray - provide empty array as default
    if (schema._def && schema._def.typeName === 'ZodArray') {
        return [];
    }

    // Handle ZodRecord - provide empty object as default
    if (schema._def && schema._def.typeName === 'ZodRecord') {
        return {};
    }

    // For other types, return undefined (no default available)
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