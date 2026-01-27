import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { MCPConfigError, MCPContextError } from '../../src/mcp';

describe('MCPConfigError', () => {
    it('should create error with message only', () => {
        const error = new MCPConfigError('Configuration is invalid');

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(MCPConfigError);
        expect(error.name).toBe('MCPConfigError');
        expect(error.message).toBe('Configuration is invalid');
        expect(error.validationError).toBeUndefined();
    });

    it('should create error with validation error', () => {
        const schema = z.object({
            port: z.number(),
            host: z.string(),
        });

        const result = schema.safeParse({
            port: 'not-a-number',
            host: 123,
        });

        expect(result.success).toBe(false);

        if (!result.success) {
            const error = new MCPConfigError(
                'Validation failed',
                result.error
            );

            expect(error.name).toBe('MCPConfigError');
            expect(error.message).toBe('Validation failed');
            expect(error.validationError).toBeDefined();
            expect(error.validationError).toBe(result.error);
        }
    });

    it('should return simple message when no validation error', () => {
        const error = new MCPConfigError('Simple error');

        expect(error.getDetailedMessage()).toBe('Simple error');
    });

    it('should return detailed message with validation errors', () => {
        const schema = z.object({
            port: z.number(),
            host: z.string(),
            nested: z.object({
                value: z.string(),
            }),
        });

        const result = schema.safeParse({
            port: 'invalid',
            host: 123,
            nested: {
                value: 456,
            },
        });

        if (!result.success) {
            const error = new MCPConfigError(
                'Multiple validation errors',
                result.error
            );

            const detailed = error.getDetailedMessage();

            expect(detailed).toContain('Multiple validation errors');
            expect(detailed).toContain('Validation errors:');
            expect(detailed).toContain('port');
            expect(detailed).toContain('host');
            expect(detailed).toContain('nested.value');
        }
    });

    it('should handle root-level validation errors', () => {
        const schema = z.string();
        const result = schema.safeParse(123);

        if (!result.success) {
            const error = new MCPConfigError(
                'Root validation error',
                result.error
            );

            const detailed = error.getDetailedMessage();

            expect(detailed).toContain('Root validation error');
            expect(detailed).toContain('root:');
        }
    });

    it('should maintain prototype chain for instanceof', () => {
        const error = new MCPConfigError('Test');

        expect(error instanceof MCPConfigError).toBe(true);
        expect(error instanceof Error).toBe(true);
        expect(Object.getPrototypeOf(error)).toBe(MCPConfigError.prototype);
    });

    it('should be catchable as Error', () => {
        try {
            throw new MCPConfigError('Test error');
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(MCPConfigError);
        }
    });

    it('should preserve stack trace', () => {
        const error = new MCPConfigError('Test error');

        expect(error.stack).toBeDefined();
        expect(error.stack).toContain('MCPConfigError');
    });
});

describe('MCPContextError', () => {
    it('should create error with message', () => {
        const error = new MCPContextError('Missing required context');

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(MCPContextError);
        expect(error.name).toBe('MCPContextError');
        expect(error.message).toBe('Missing required context');
    });

    it('should maintain prototype chain for instanceof', () => {
        const error = new MCPContextError('Test');

        expect(error instanceof MCPContextError).toBe(true);
        expect(error instanceof Error).toBe(true);
        expect(Object.getPrototypeOf(error)).toBe(MCPContextError.prototype);
    });

    it('should be catchable as Error', () => {
        try {
            throw new MCPContextError('Context missing');
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(MCPContextError);
        }
    });

    it('should preserve stack trace', () => {
        const error = new MCPContextError('Test error');

        expect(error.stack).toBeDefined();
        expect(error.stack).toContain('MCPContextError');
    });

    it('should be distinguishable from MCPConfigError', () => {
        const configError = new MCPConfigError('Config error');
        const contextError = new MCPContextError('Context error');

        expect(configError instanceof MCPConfigError).toBe(true);
        expect(configError instanceof MCPContextError).toBe(false);

        expect(contextError instanceof MCPContextError).toBe(true);
        expect(contextError instanceof MCPConfigError).toBe(false);
    });
});
