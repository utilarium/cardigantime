import { ZodObject, type ZodRawShape, type z } from 'zod';
import { EnvVarNamingConfig, EnvVarConfigSource } from './types';
import { readEnvVarsForSchema } from './reader';
import { parseEnvVar } from './parser';
import { EnvVarParseError, EnvVarValidationError } from './errors';
import { extractSchemaFields, getSchemaForField } from './schema-utils';

/**
 * Resolve configuration from environment variables
 * 
 * This is the main entry point for the env module. It orchestrates:
 * 1. Extracting field paths from the schema
 * 2. Reading environment variables
 * 3. Parsing values according to schema types
 * 4. Validating the final config with Zod
 * 
 * Returns null if no environment variables are found, allowing
 * the caller to fall back to other config sources.
 * 
 * Throws EnvVarParseError if a value cannot be parsed.
 * Throws EnvVarValidationError if the parsed config fails Zod validation.
 * 
 * @param schema - Zod schema defining config structure
 * @param config - Naming configuration (appName, envVarMap)
 * @returns Parsed config object and source information, or null if no env vars found
 */
export async function resolveEnvVarConfig<T extends ZodRawShape>(
    schema: ZodObject<T>,
    config: EnvVarNamingConfig
): Promise<{ config: z.infer<ZodObject<T>>; source: EnvVarConfigSource } | null> {
    // Extract field paths from schema
    const fieldPaths = extractSchemaFields(schema);

    // Read env vars
    const readResults = readEnvVarsForSchema(fieldPaths, config);

    if (readResults.size === 0) {
        return null; // No env vars found
    }

    // Parse values according to schema types
    const parsedConfig: Record<string, unknown> = {};

    for (const [fieldPath, readResult] of readResults) {
        const fieldSchema = getSchemaForField(schema, fieldPath);

        try {
            const parsedValue = parseEnvVar(readResult.value, fieldSchema);
            
            // Handle nested paths by building nested object
            if (fieldPath.includes('.')) {
                const parts = fieldPath.split('.');
                let current = parsedConfig;
                
                for (let i = 0; i < parts.length - 1; i++) {
                    const part = parts[i];
                    if (!(part in current)) {
                        current[part] = {};
                    }
                    current = current[part] as Record<string, unknown>;
                }
                
                current[parts[parts.length - 1]] = parsedValue;
            } else {
                parsedConfig[fieldPath] = parsedValue;
            }
        } catch (error) {
            if (error instanceof EnvVarParseError) {
                // Attach env var name to error for better error messages
                error.envVarName = readResult.envVarName;
            }
            throw error;
        }
    }

    // Validate with Zod schema
    const validationResult = schema.safeParse(parsedConfig);

    if (!validationResult.success) {
        throw new EnvVarValidationError(
            'Environment variable configuration failed validation',
            config.appName,
            validationResult.error
        );
    }

    return {
        config: validationResult.data,
        source: {
            type: 'env',
            values: readResults,
            readAt: new Date(),
        },
    };
}
