import { z, ZodObject, ZodTypeAny } from 'zod';

/**
 * Recursively unwraps Zod wrapper types (Optional, Nullable, Default) to get the inner schema.
 * This handles multiple layers of wrappers like z.optional(z.nullable(z.default(z.object({...})))).
 * 
 * @param schema - The Zod schema to unwrap
 * @returns The innermost schema after unwrapping all wrapper types
 */
function unwrapSchema(schema: ZodTypeAny): ZodTypeAny {
    let current: ZodTypeAny = schema;
    
    // Keep unwrapping until we hit a non-wrapper type
    while (
        current instanceof z.ZodOptional ||
        current instanceof z.ZodNullable ||
        current instanceof z.ZodDefault
    ) {
        if (current instanceof z.ZodDefault) {
            // ZodDefault stores the inner type in _def.innerType
            // Cast through unknown to handle Zod 4's internal type differences
            current = (current._def as unknown as { innerType: ZodTypeAny }).innerType;
        } else {
            current = current.unwrap() as ZodTypeAny;
        }
    }
    
    return current;
}

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

        // Recursively unwrap all wrapper types to check for nested objects
        const unwrapped = unwrapSchema(value as ZodTypeAny);

        // Handle nested objects
        if (unwrapped instanceof z.ZodObject) {
            const nestedFields = extractSchemaFields(unwrapped);
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
        // Unwrap wrappers before checking if it's an object for navigation
        const unwrapped = unwrapSchema(current);
        
        if (unwrapped instanceof z.ZodObject) {
            current = unwrapped.shape[part];
            if (!current) {
                throw new Error(`Field not found in schema: ${fieldPath}`);
            }
        } else {
            throw new Error(`Cannot navigate to field: ${fieldPath}`);
        }
    }

    return current;
}
