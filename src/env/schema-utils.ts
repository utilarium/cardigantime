import { z, ZodObject, ZodTypeAny } from 'zod';

/**
 * Extract all field paths from a Zod schema
 * 
 * Handles nested objects by flattening to dot notation.
 * This allows us to generate environment variable names for all
 * fields in a schema, including nested ones.
 * 
 * Example:
 *   schema = z.object({ api: z.object({ key: z.string() }) })
 *   extractSchemaFields(schema) => ['api', 'api.key']
 * 
 * @param schema - Zod object schema
 * @returns Array of field paths in dot notation
 */
export function extractSchemaFields(schema: ZodObject<any>): string[] {
    const fields: string[] = [];

    for (const [key, value] of Object.entries(schema.shape)) {
        fields.push(key);

        // Handle nested objects
        if (value instanceof z.ZodObject) {
            const nestedFields = extractSchemaFields(value);
            fields.push(...nestedFields.map(f => `${key}.${f}`));
        }
    }

    return fields;
}

/**
 * Get Zod schema for a specific field path
 * 
 * Navigates through nested objects using dot notation to find
 * the schema for a specific field. This is used to determine
 * the correct parser for each field.
 * 
 * Example:
 *   schema = z.object({ api: z.object({ key: z.string() }) })
 *   getSchemaForField(schema, 'api.key') => z.string()
 * 
 * @param schema - Zod object schema
 * @param fieldPath - Field path in dot notation
 * @returns Zod schema for the field
 * @throws Error if field path is invalid
 */
export function getSchemaForField(
    schema: ZodObject<any>,
    fieldPath: string
): ZodTypeAny {
    const parts = fieldPath.split('.');
    let current: any = schema;

    for (const part of parts) {
        if (current instanceof z.ZodObject) {
            current = current.shape[part];
            if (!current) {
                throw new Error(`Field not found in schema: ${fieldPath}`);
            }
        } else {
            throw new Error(`Cannot navigate to field: ${fieldPath}`);
        }
    }

    return current;
}
