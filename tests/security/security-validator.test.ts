import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
    SecurityValidator,
    createSecurityValidator,
    createSecurityValidatorForProfile,
} from '../../src/security/security-validator';
import { Logger } from '../../src/types';

describe('SecurityValidator', () => {
    const mockLogger: Logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        verbose: vi.fn(),
        silly: vi.fn(),
    };

    describe('constructor', () => {
        it('should create validator with default config', () => {
            const validator = new SecurityValidator();
            expect(validator).toBeInstanceOf(SecurityValidator);
        });

        it('should create validator with custom config', () => {
            const validator = new SecurityValidator({
                failOnError: true,
                profile: 'production',
            });
            expect(validator).toBeInstanceOf(SecurityValidator);
        });

        it('should create validator with logger', () => {
            const validator = new SecurityValidator({}, mockLogger);
            expect(validator).toBeInstanceOf(SecurityValidator);
        });
    });

    describe('registerSchema', () => {
        it('should register schema for validation', () => {
            const validator = new SecurityValidator();
            const schema = z.object({
                model: z.string(),
                timeout: z.number(),
            });
            
            const result = validator.registerSchema(schema);
            expect(result).toBe(validator); // chainable
        });

        it('should set hasSchema to true after registration', () => {
            const validator = new SecurityValidator();
            expect(validator.hasSchema()).toBe(false);
            
            validator.registerSchema(z.object({ model: z.string() }));
            expect(validator.hasSchema()).toBe(true);
        });
    });

    describe('validateCLI', () => {
        it('should validate CLI arguments', () => {
            const validator = new SecurityValidator();
            const schema = z.object({
                model: z.string(),
            });
            
            validator.registerSchema(schema);
            const result = validator.validateCLI({ model: 'gpt-4' });
            
            expect(result.valid).toBe(true);
            expect(result.source).toBe('cli');
        });

        it('should reject invalid CLI arguments with failOnError', () => {
            const validator = new SecurityValidator({ failOnError: true });
            const schema = z.object({
                configFile: z.string(),
            });
            
            validator.registerSchema(schema);
            const result = validator.validateCLI({ configFile: '../../../etc/passwd' });
            
            expect(result.valid).toBe(false);
        });
    });

    describe('validateConfig', () => {
        it('should validate config values', () => {
            const validator = new SecurityValidator();
            const schema = z.object({
                model: z.string(),
            });
            
            validator.registerSchema(schema);
            const result = validator.validateConfig({ model: 'gpt-4' });
            
            expect(result.valid).toBe(true);
            expect(result.source).toBe('config');
        });

        it('should reject invalid config values with failOnError', () => {
            const validator = new SecurityValidator({ failOnError: true });
            const schema = z.object({
                configFile: z.string(),
            });
            
            validator.registerSchema(schema);
            const result = validator.validateConfig({ configFile: '../../../etc/passwd' });
            
            expect(result.valid).toBe(false);
        });
    });

    describe('validateConfigFile', () => {
        it('should validate single config file', () => {
            const validator = new SecurityValidator();
            const schema = z.object({
                model: z.string(),
            });
            
            validator.registerSchema(schema);
            const result = validator.validateConfigFile(
                { model: 'gpt-4' },
                '/path/to/config.yaml',
                0
            );
            
            expect(result.valid).toBe(true);
        });
    });

    describe('validateMerged', () => {
        it('should validate merged CLI and config', () => {
            const validator = new SecurityValidator();
            const schema = z.object({
                model: z.string(),
                timeout: z.number(),
            });
            
            validator.registerSchema(schema);
            const result = validator.validateMerged(
                { model: 'gpt-4', timeout: 5000 },
                { model: 'gpt-4' },
                { timeout: 5000 }
            );
            
            expect(result.valid).toBe(true);
            expect(result.bySource.cli).toBeDefined();
            expect(result.bySource.config).toBeDefined();
        });

        it('should aggregate errors from both sources with failOnError', () => {
            const validator = new SecurityValidator({ failOnError: true });
            const schema = z.object({
                configFile: z.string(),
                outputPath: z.string(),
            });
            
            validator.registerSchema(schema);
            const result = validator.validateMerged(
                { configFile: '../../../etc/passwd', outputPath: '../../../etc/shadow' },
                { configFile: '../../../etc/passwd' },
                { outputPath: '../../../etc/shadow' }
            );
            
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThanOrEqual(1);
        });

        it('should handle empty config values', () => {
            const validator = new SecurityValidator();
            const schema = z.object({
                model: z.string(),
            });
            
            validator.registerSchema(schema);
            const result = validator.validateMerged(
                { model: 'default-model' },
                {},
                {}
            );
            
            expect(result.valid).toBe(true);
        });
    });

    describe('validateValue', () => {
        it('should validate path value', () => {
            const validator = new SecurityValidator({ failOnError: true });
            
            expect(() => {
                validator.validateValue('../../../etc/passwd', 'path', { fieldName: 'file' });
            }).toThrow();
        });

        it('should validate number value with bounds', () => {
            const validator = new SecurityValidator({ failOnError: true });
            
            expect(() => {
                validator.validateValue(999999, 'number', { 
                    fieldName: 'timeout',
                    bounds: { min: 0, max: 60000 }
                });
            }).toThrow();
        });

        it('should validate string value with pattern', () => {
            const validator = new SecurityValidator({ failOnError: true });
            
            expect(() => {
                validator.validateValue('invalid!', 'string', { 
                    fieldName: 'model',
                    pattern: /^[a-z0-9-]+$/
                });
            }).toThrow();
        });
    });

    describe('getProfile', () => {
        it('should return current profile', () => {
            const validator = new SecurityValidator({ profile: 'production' });
            expect(validator.getProfile()).toBe('production');
        });

        it('should default to development', () => {
            const validator = new SecurityValidator();
            expect(validator.getProfile()).toBe('development');
        });
    });

    describe('shouldFailOnError', () => {
        it('should return failOnError setting', () => {
            const validator = new SecurityValidator({ failOnError: true });
            expect(validator.shouldFailOnError()).toBe(true);
        });

        it('should default to false in development', () => {
            const validator = new SecurityValidator();
            expect(validator.shouldFailOnError()).toBe(false);
        });
    });

    describe('createSecurityValidator', () => {
        it('should create validator with factory function', () => {
            const validator = createSecurityValidator();
            expect(validator).toBeInstanceOf(SecurityValidator);
        });

        it('should create validator with config', () => {
            const validator = createSecurityValidator({ failOnError: true });
            expect(validator).toBeInstanceOf(SecurityValidator);
        });

        it('should create validator with logger', () => {
            const validator = createSecurityValidator({}, mockLogger);
            expect(validator).toBeInstanceOf(SecurityValidator);
        });
    });

    describe('createSecurityValidatorForProfile', () => {
        it('should create development validator', () => {
            const validator = createSecurityValidatorForProfile('development');
            expect(validator).toBeInstanceOf(SecurityValidator);
            expect(validator.getProfile()).toBe('development');
        });

        it('should create production validator', () => {
            const validator = createSecurityValidatorForProfile('production');
            expect(validator).toBeInstanceOf(SecurityValidator);
            expect(validator.getProfile()).toBe('production');
        });

        it('should create validator with logger', () => {
            const validator = createSecurityValidatorForProfile('production', mockLogger);
            expect(validator).toBeInstanceOf(SecurityValidator);
        });
    });

    describe('cross-source validation', () => {
        it('should detect CLI overrides in debug logging', () => {
            const debugFn = vi.fn();
            const loggerWithDebug: Logger = {
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
                debug: debugFn,
                verbose: vi.fn(),
                silly: vi.fn(),
            };
            
            const validator = new SecurityValidator({ auditLogging: true }, loggerWithDebug);
            const schema = z.object({
                model: z.string(),
            });
            
            validator.registerSchema(schema);
            
            // Validate both sources with same key
            validator.validateMerged(
                { model: 'cli-model' },
                { model: 'cli-model' },
                { model: 'config-model' }
            );
            
            // Debug should have been called about override
            expect(debugFn).toHaveBeenCalled();
        });
    });

    describe('suspicious pattern detection', () => {
        it('should warn about home directory in production', () => {
            const validator = new SecurityValidator({ 
                profile: 'production',
                failOnError: false 
            });
            const schema = z.object({
                configPath: z.string(),
            });
            
            validator.registerSchema(schema);
            const result = validator.validateMerged(
                { configPath: '~/config' },
                {},
                { configPath: '~/config' }
            );
            
            expect(result.warnings.some(w => w.message.includes('~'))).toBe(true);
        });

        it('should warn about env vars in production', () => {
            const validator = new SecurityValidator({ 
                profile: 'production',
                failOnError: false 
            });
            const schema = z.object({
                configPath: z.string(),
            });
            
            validator.registerSchema(schema);
            const result = validator.validateMerged(
                { configPath: '$HOME/config' },
                {},
                { configPath: '$HOME/config' }
            );
            
            expect(result.warnings.some(w => w.message.includes('environment variable'))).toBe(true);
        });
    });

    describe('audit logging', () => {
        it('should log validation results when enabled', () => {
            const warnFn = vi.fn();
            const loggerWithWarn: Logger = {
                info: vi.fn(),
                warn: warnFn,
                error: vi.fn(),
                debug: vi.fn(),
                verbose: vi.fn(),
                silly: vi.fn(),
            };
            
            const validator = new SecurityValidator(
                { auditLogging: true, failOnError: true },
                loggerWithWarn
            );
            const schema = z.object({
                configFile: z.string(),
            });
            
            validator.registerSchema(schema);
            validator.validateCLI({ configFile: '../../../etc/passwd' });
            
            expect(warnFn).toHaveBeenCalled();
        });
    });
});
