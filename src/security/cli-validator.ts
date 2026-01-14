import { z } from 'zod';
import { PathGuard, createPathGuard } from './path-guard';
import { NumericGuard, createNumericGuard } from './numeric-guard';
import { StringGuard, createStringGuard } from './string-guard';
import { SecurityValidationConfig, SecurityValidationResult, SecurityValidationError } from './types';
import { DEVELOPMENT_SECURITY_CONFIG } from './defaults';

/**
 * Metadata about a CLI option for security validation.
 */
export interface CLIOptionSecurityMeta {
  /** Option name (e.g., '--config-directory') */
  name: string;
  /** Type of validation to apply */
  type: 'path' | 'number' | 'string' | 'enum' | 'boolean';
  /** Whether this is a path that needs security validation */
  isPath?: boolean;
  /** Numeric bounds if type is 'number' */
  bounds?: { min: number; max: number; integer?: boolean };
  /** Pattern if type is 'string' */
  pattern?: RegExp;
  /** Allowed values if type is 'enum' */
  allowedValues?: string[];
  /** Whether the option is required */
  required?: boolean;
}

/**
 * CLIValidator provides security validation for Commander.js options.
 */
export class CLIValidator {
    private pathGuard: PathGuard;
    private numericGuard: NumericGuard;
    private stringGuard: StringGuard;
    private config: SecurityValidationConfig;
    private optionMeta: Map<string, CLIOptionSecurityMeta> = new Map();

    constructor(config: Partial<SecurityValidationConfig> = {}) {
        this.config = { ...DEVELOPMENT_SECURITY_CONFIG, ...config };
        this.pathGuard = createPathGuard(this.config.paths);
        this.numericGuard = createNumericGuard(this.config.numbers);
        this.stringGuard = createStringGuard(this.config.strings);
    }

    /**
   * Register security metadata for a CLI option.
   */
    registerOption(meta: CLIOptionSecurityMeta): this {
        this.optionMeta.set(meta.name, meta);
        return this;
    }

    /**
   * Register multiple options at once.
   */
    registerOptions(metas: CLIOptionSecurityMeta[]): this {
        for (const meta of metas) {
            this.registerOption(meta);
        }
        return this;
    }

    /**
   * Extract security metadata from a Zod schema.
   * Looks for special markers in the schema to determine validation requirements.
   */
    registerFromSchema<T extends z.ZodRawShape>(
        schema: z.ZodObject<T>,
        optionMapping: Record<string, string> = {}
    ): this {
    // Walk the schema and extract validation requirements
        for (const [key, fieldSchema] of Object.entries(schema.shape)) {
            const optionName = optionMapping[key] || `--${this.camelToKebab(key)}`;
            const meta = this.extractMetaFromZod(fieldSchema as z.ZodTypeAny, optionName, key);
            if (meta) {
                this.registerOption(meta);
            }
        }
        return this;
    }

    /**
   * Validate all CLI arguments against registered security metadata.
   */
    validateArgs(args: Record<string, unknown>): SecurityValidationResult {
        const errors: SecurityValidationError[] = [];
        const warnings: SecurityValidationResult['warnings'] = [];

        for (const [optionName, meta] of this.optionMeta) {
            // Convert option name to arg key (--config-directory -> configDirectory)
            const argKey = this.optionNameToArgKey(optionName);
            const value = args[argKey];

            // Skip undefined/null unless required
            if (value === undefined || value === null) {
                if (meta.required) {
                    errors.push({
                        field: argKey,
                        message: `${optionName} is required`,
                        code: 'VALIDATION_FAILED',
                        source: 'cli',
                    });
                }
                continue;
            }

            // Validate based on type
            try {
                this.validateValue(value, meta, argKey);
            } catch (error: unknown) {
                const err = error as { errors?: SecurityValidationError[]; message?: string };
                if (err.errors) {
                    errors.push(...err.errors.map((e: SecurityValidationError) => ({
                        ...e,
                        source: 'cli' as const,
                    })));
                } else {
                    errors.push({
                        field: argKey,
                        message: err.message || 'Validation failed',
                        code: 'VALIDATION_FAILED',
                        source: 'cli',
                    });
                }
            }
        }

        // Check for unregistered options in production mode
        if (this.config.profile === 'production') {
            for (const argKey of Object.keys(args)) {
                const optionName = `--${this.camelToKebab(argKey)}`;
                if (!this.optionMeta.has(optionName) && args[argKey] !== undefined) {
                    warnings.push({
                        field: argKey,
                        message: `Unregistered option ${optionName} - no security validation applied`,
                        code: 'PERMISSIVE_PATTERN',
                    });
                }
            }
        }

        const valid = errors.length === 0 || !this.config.failOnError;

        return { valid, errors, warnings, source: 'cli' };
    }

    /**
   * Validate a single value against its security metadata.
   */
    private validateValue(
        value: unknown,
        meta: CLIOptionSecurityMeta,
        fieldName: string
    ): void {
        switch (meta.type) {
            case 'path':
                if (typeof value === 'string') {
                    this.pathGuard.validate(value, `CLI option ${meta.name}`);
                }
                break;

            case 'number':
                if (meta.bounds) {
                    this.numericGuard.validate(value, meta.bounds, fieldName);
                }
                break;

            case 'string': {
                const constraints: Parameters<StringGuard['validate']>[1] = {};
                if (meta.pattern) {
                    constraints.pattern = meta.pattern;
                }
                this.stringGuard.validate(value, constraints, fieldName);
                break;
            }

            case 'enum':
                if (meta.allowedValues) {
                    this.stringGuard.validateEnum(
                        value,
                        meta.allowedValues,
                        fieldName
                    );
                }
                break;

            case 'boolean':
                // Booleans don't need security validation
                break;
        }

        // Additional path validation for fields marked as paths
        if (meta.isPath && typeof value === 'string') {
            this.pathGuard.validate(value, `CLI option ${meta.name}`);
        }
    }

    /**
   * Extract validation metadata from a Zod field schema.
   */
    private extractMetaFromZod(
        schema: z.ZodTypeAny,
        optionName: string,
        fieldName: string
    ): CLIOptionSecurityMeta | null {
    // Unwrap optional/nullable
        let innerSchema: z.ZodTypeAny = schema;
        let required = true;

        if (innerSchema instanceof z.ZodOptional || innerSchema instanceof z.ZodNullable) {
            innerSchema = innerSchema.unwrap() as z.ZodTypeAny;
            required = false;
        }

        // Determine type from schema
        if (innerSchema instanceof z.ZodString) {
            // Check if it looks like a path field
            const isPath = fieldName.toLowerCase().includes('path') ||
                    fieldName.toLowerCase().includes('directory') ||
                    fieldName.toLowerCase().includes('file');

            return {
                name: optionName,
                type: isPath ? 'path' : 'string',
                isPath,
                required,
            };
        }

        if (innerSchema instanceof z.ZodNumber) {
            // Try to extract min/max from refinements
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
                name: optionName,
                type: 'number',
                bounds: min !== undefined && max !== undefined 
                    ? { min, max, integer } 
                    : undefined,
                required,
            };
        }

        if (innerSchema instanceof z.ZodEnum) {
            return {
                name: optionName,
                type: 'enum',
                allowedValues: innerSchema.options as string[],
                required,
            };
        }

        if (innerSchema instanceof z.ZodBoolean) {
            return {
                name: optionName,
                type: 'boolean',
                required,
            };
        }

        return null;
    }

    /**
   * Convert camelCase to kebab-case.
   */
    private camelToKebab(str: string): string {
        return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    }

    /**
   * Convert option name (--config-directory) to arg key (configDirectory).
   */
    private optionNameToArgKey(optionName: string): string {
        return optionName
            .replace(/^--?/, '')
            .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    }
}

/**
 * Create a CLI validator with the given configuration.
 */
export function createCLIValidator(config?: Partial<SecurityValidationConfig>): CLIValidator {
    return new CLIValidator(config);
}

