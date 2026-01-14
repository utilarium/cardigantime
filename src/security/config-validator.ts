import * as path from 'node:path';
import { z } from 'zod';
import { PathGuard, createPathGuard } from './path-guard';
import { NumericGuard, createNumericGuard } from './numeric-guard';
import { StringGuard, createStringGuard } from './string-guard';
import { SecurityValidationConfig, SecurityValidationResult, SecurityValidationError } from './types';
import { DEVELOPMENT_SECURITY_CONFIG } from './defaults';

/**
 * Field-level security metadata for config validation.
 */
export interface ConfigFieldSecurityMeta {
  /** Field path in dot notation (e.g., 'api.timeout') */
  fieldPath: string;
  /** Type of validation to apply */
  type: 'path' | 'number' | 'string' | 'enum' | 'array' | 'object';
  /** Whether this field contains a path */
  isPath?: boolean;
  /** Numeric bounds if type is 'number' */
  bounds?: { min: number; max: number; integer?: boolean };
  /** Pattern if type is 'string' */
  pattern?: RegExp;
  /** Allowed values if type is 'enum' */
  allowedValues?: string[];
  /** Array element validation (recursive) */
  arrayElementMeta?: Omit<ConfigFieldSecurityMeta, 'fieldPath'>;
}

/**
 * Context about where a config value came from.
 */
export interface ConfigValueSource {
  /** Which config file the value came from */
  file: string;
  /** Line number in the file (if available) */
  line?: number;
  /** Hierarchical level (0 = most specific) */
  level: number;
}

/**
 * ConfigValidator provides security validation for configuration file values.
 */
export class ConfigValidator {
    private pathGuard: PathGuard;
    private numericGuard: NumericGuard;
    private stringGuard: StringGuard;
    private config: SecurityValidationConfig;
    private fieldMeta: Map<string, ConfigFieldSecurityMeta> = new Map();

    constructor(config: Partial<SecurityValidationConfig> = {}) {
        this.config = { ...DEVELOPMENT_SECURITY_CONFIG, ...config };
        this.pathGuard = createPathGuard(this.config.paths);
        this.numericGuard = createNumericGuard(this.config.numbers);
        this.stringGuard = createStringGuard(this.config.strings);
    }

    /**
   * Register security metadata for a config field.
   */
    registerField(meta: ConfigFieldSecurityMeta): this {
        this.fieldMeta.set(meta.fieldPath, meta);
        return this;
    }

    /**
   * Register multiple fields at once.
   */
    registerFields(metas: ConfigFieldSecurityMeta[]): this {
        for (const meta of metas) {
            this.registerField(meta);
        }
        return this;
    }

    /**
   * Extract security metadata from a Zod schema.
   */
    registerFromSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>): this {
        this.walkSchema(schema, '');
        return this;
    }

    /**
   * Validate a configuration object with source tracking.
   */
    validateConfig(
        config: Record<string, unknown>,
        sources: Map<string, ConfigValueSource> = new Map()
    ): SecurityValidationResult {
        const errors: SecurityValidationError[] = [];
        const warnings: SecurityValidationResult['warnings'] = [];

        // Validate all values recursively
        this.validateObject(config, '', sources, errors, warnings);

        // Check for unregistered fields in production mode
        if (this.config.profile === 'production') {
            this.checkUnregisteredFields(config, '', warnings);
        }

        const valid = errors.length === 0 || !this.config.failOnError;

        return { valid, errors, warnings, source: 'config' };
    }

    /**
   * Validate a single config file's content before merging.
   */
    validateSingleFile(
        content: Record<string, unknown>,
        filePath: string,
        level: number = 0
    ): SecurityValidationResult {
        const sources = new Map<string, ConfigValueSource>();
    
        // Create source entries for all fields
        this.walkObject(content, '', (fieldPath) => {
            sources.set(fieldPath, { file: filePath, level });
        });

        return this.validateConfig(content, sources);
    }

    /**
   * Recursively validate an object and its nested values.
   */
    private validateObject(
        obj: Record<string, unknown>,
        prefix: string,
        sources: Map<string, ConfigValueSource>,
        errors: SecurityValidationError[],
        warnings: SecurityValidationResult['warnings']
    ): void {
        for (const [key, value] of Object.entries(obj)) {
            const fieldPath = prefix ? `${prefix}.${key}` : key;
            const meta = this.fieldMeta.get(fieldPath);
            const source = sources.get(fieldPath);

            if (value === undefined || value === null) {
                continue;
            }

            // Get source info for error messages
            const sourceInfo = source 
                ? ` (from ${path.basename(source.file)})`
                : '';

            // Validate based on registered metadata
            if (meta) {
                try {
                    this.validateValue(value, meta, fieldPath, sourceInfo);
                } catch (error: unknown) {
                    const err = error as { errors?: SecurityValidationError[]; message?: string };
                    const errorSource = source?.file ? 'config' : 'unknown';
                    if (err.errors) {
                        errors.push(...err.errors.map((e: SecurityValidationError) => ({
                            ...e,
                            source: errorSource as 'config',
                            field: `${e.field}${sourceInfo}`,
                        })));
                    } else {
                        errors.push({
                            field: `${fieldPath}${sourceInfo}`,
                            message: err.message || 'Validation failed',
                            code: 'VALIDATION_FAILED',
                            source: errorSource as 'config',
                        });
                    }
                }
            }

            // Recurse into nested objects
            if (typeof value === 'object' && !Array.isArray(value)) {
                this.validateObject(
          value as Record<string, unknown>,
          fieldPath,
          sources,
          errors,
          warnings
                );
            }

            // Handle arrays
            if (Array.isArray(value) && meta?.arrayElementMeta) {
                for (let i = 0; i < value.length; i++) {
                    const elementPath = `${fieldPath}[${i}]`;
                    const elementMeta = { ...meta.arrayElementMeta, fieldPath: elementPath };
          
                    try {
                        this.validateValue(value[i], elementMeta, elementPath, sourceInfo);
                    } catch (error: unknown) {
                        const err = error as { message?: string };
                        errors.push({
                            field: `${elementPath}${sourceInfo}`,
                            message: err.message || 'Validation failed',
                            code: 'VALIDATION_FAILED',
                            source: 'config',
                        });
                    }
                }
            }
        }
    }

    /**
   * Validate a single value against its security metadata.
   */
    private validateValue(
        value: unknown,
        meta: ConfigFieldSecurityMeta,
        fieldPath: string,
        _sourceInfo: string
    ): void {
        switch (meta.type) {
            case 'path':
                if (typeof value === 'string') {
                    this.pathGuard.validate(value, `config field ${fieldPath}`);
                }
                break;

            case 'number':
                if (meta.bounds) {
                    this.numericGuard.validate(value, meta.bounds, fieldPath);
                }
                break;

            case 'string': {
                const constraints: Parameters<StringGuard['validate']>[1] = {};
                if (meta.pattern) {
                    constraints.pattern = meta.pattern;
                }
                this.stringGuard.validate(value, constraints, fieldPath);
                break;
            }

            case 'enum':
                if (meta.allowedValues) {
                    this.stringGuard.validateEnum(value, meta.allowedValues, fieldPath);
                }
                break;
        }

        // Additional path validation for fields marked as paths
        if (meta.isPath && typeof value === 'string') {
            this.pathGuard.validate(value, `config field ${fieldPath}`);
        }
    }

    /**
   * Check for fields not covered by security metadata.
   */
    private checkUnregisteredFields(
        obj: Record<string, unknown>,
        prefix: string,
        warnings: SecurityValidationResult['warnings']
    ): void {
        for (const [key, value] of Object.entries(obj)) {
            const fieldPath = prefix ? `${prefix}.${key}` : key;

            if (!this.fieldMeta.has(fieldPath)) {
                warnings.push({
                    field: fieldPath,
                    message: `Unregistered field ${fieldPath} - no security validation applied`,
                    code: 'PERMISSIVE_PATTERN',
                });
            }

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                this.checkUnregisteredFields(value as Record<string, unknown>, fieldPath, warnings);
            }
        }
    }

    /**
   * Walk a Zod schema to extract field metadata.
   */
    private walkSchema(schema: z.ZodTypeAny, prefix: string): void {
    // Unwrap optional/nullable
        let innerSchema: z.ZodTypeAny = schema;
        if (innerSchema instanceof z.ZodOptional || innerSchema instanceof z.ZodNullable) {
            innerSchema = innerSchema.unwrap() as z.ZodTypeAny;
        }

        if (innerSchema instanceof z.ZodObject) {
            for (const [key, fieldSchema] of Object.entries(innerSchema.shape)) {
                const fieldPath = prefix ? `${prefix}.${key}` : key;
                const meta = this.extractMetaFromZod(fieldSchema as z.ZodTypeAny, fieldPath, key);
        
                if (meta) {
                    this.registerField(meta);
                }

                // Recurse into nested objects
                this.walkSchema(fieldSchema as z.ZodTypeAny, fieldPath);
            }
        }
    }

    /**
   * Extract field metadata from a Zod schema.
   */
    private extractMetaFromZod(
        schema: z.ZodTypeAny,
        fieldPath: string,
        fieldName: string
    ): ConfigFieldSecurityMeta | null {
        let innerSchema: z.ZodTypeAny = schema;
        if (innerSchema instanceof z.ZodOptional || innerSchema instanceof z.ZodNullable) {
            innerSchema = innerSchema.unwrap() as z.ZodTypeAny;
        }

        // Determine type and extract constraints
        if (innerSchema instanceof z.ZodString) {
            const isPath = fieldName.toLowerCase().includes('path') ||
                    fieldName.toLowerCase().includes('directory') ||
                    fieldName.toLowerCase().includes('file');

            return {
                fieldPath,
                type: isPath ? 'path' : 'string',
                isPath,
            };
        }

        if (innerSchema instanceof z.ZodNumber) {
            const checks = (innerSchema as unknown as { _def?: { checks?: Array<{ kind: string; value?: number }> } })._def?.checks || [];
            let min: number | undefined;
            let max: number | undefined;
            let integer = false;

            for (const check of checks) {
                if (check.kind === 'min') min = check.value;
                if (check.kind === 'max') max = check.value;
                if (check.kind === 'int') integer = true;
            }

            return {
                fieldPath,
                type: 'number',
                bounds: min !== undefined && max !== undefined ? { min, max, integer } : undefined,
            };
        }

        if (innerSchema instanceof z.ZodEnum) {
            return {
                fieldPath,
                type: 'enum',
                allowedValues: innerSchema.options as string[],
            };
        }

        if (innerSchema instanceof z.ZodArray) {
            const elementMeta = this.extractMetaFromZod(innerSchema.element as z.ZodTypeAny, '', '');
            if (elementMeta) {
                // Remove fieldPath from element meta since arrayElementMeta uses Omit<..., 'fieldPath'>
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { fieldPath: _removed, ...elementMetaWithoutPath } = elementMeta;
                return {
                    fieldPath,
                    type: 'array',
                    arrayElementMeta: elementMetaWithoutPath,
                };
            }
            return {
                fieldPath,
                type: 'array',
            };
        }

        return null;
    }

    /**
   * Walk an object and call a callback for each field path.
   */
    private walkObject(
        obj: Record<string, unknown>,
        prefix: string,
        callback: (fieldPath: string) => void
    ): void {
        for (const [key, value] of Object.entries(obj)) {
            const fieldPath = prefix ? `${prefix}.${key}` : key;
            callback(fieldPath);

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                this.walkObject(value as Record<string, unknown>, fieldPath, callback);
            }
        }
    }
}

/**
 * Create a config validator with the given configuration.
 */
export function createConfigValidator(config?: Partial<SecurityValidationConfig>): ConfigValidator {
    return new ConfigValidator(config);
}

