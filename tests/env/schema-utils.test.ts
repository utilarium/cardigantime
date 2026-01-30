import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { extractSchemaFields, getSchemaForField } from '../../src/env/schema-utils';

describe('extractSchemaFields', () => {
    it('extracts simple fields', () => {
        const schema = z.object({
            name: z.string(),
            age: z.number(),
            active: z.boolean(),
        });

        const fields = extractSchemaFields(schema);

        expect(fields).toEqual(['name', 'age', 'active']);
    });

    it('extracts nested fields', () => {
        const schema = z.object({
            user: z.object({
                name: z.string(),
                email: z.string(),
            }),
        });

        const fields = extractSchemaFields(schema);

        expect(fields).toContain('user');
        expect(fields).toContain('user.name');
        expect(fields).toContain('user.email');
    });

    it('extracts deeply nested fields', () => {
        const schema = z.object({
            api: z.object({
                config: z.object({
                    key: z.string(),
                    timeout: z.number(),
                }),
            }),
        });

        const fields = extractSchemaFields(schema);

        expect(fields).toContain('api');
        expect(fields).toContain('api.config');
        expect(fields).toContain('api.config.key');
        expect(fields).toContain('api.config.timeout');
    });

    it('handles empty schema', () => {
        const schema = z.object({});

        const fields = extractSchemaFields(schema);

        expect(fields).toEqual([]);
    });

    it('handles mixed nested and flat fields', () => {
        const schema = z.object({
            name: z.string(),
            api: z.object({
                key: z.string(),
            }),
            port: z.number(),
        });

        const fields = extractSchemaFields(schema);

        expect(fields).toContain('name');
        expect(fields).toContain('api');
        expect(fields).toContain('api.key');
        expect(fields).toContain('port');
    });
});

describe('getSchemaForField', () => {
    it('gets schema for simple field', () => {
        const schema = z.object({
            name: z.string(),
            age: z.number(),
        });

        const nameSchema = getSchemaForField(schema, 'name');
        const ageSchema = getSchemaForField(schema, 'age');

        expect(nameSchema).toBeInstanceOf(z.ZodString);
        expect(ageSchema).toBeInstanceOf(z.ZodNumber);
    });

    it('gets schema for nested field', () => {
        const schema = z.object({
            user: z.object({
                name: z.string(),
                age: z.number(),
            }),
        });

        const nameSchema = getSchemaForField(schema, 'user.name');
        const ageSchema = getSchemaForField(schema, 'user.age');

        expect(nameSchema).toBeInstanceOf(z.ZodString);
        expect(ageSchema).toBeInstanceOf(z.ZodNumber);
    });

    it('gets schema for deeply nested field', () => {
        const schema = z.object({
            api: z.object({
                config: z.object({
                    key: z.string(),
                }),
            }),
        });

        const keySchema = getSchemaForField(schema, 'api.config.key');

        expect(keySchema).toBeInstanceOf(z.ZodString);
    });

    it('throws error for invalid field path', () => {
        const schema = z.object({
            name: z.string(),
        });

        expect(() => getSchemaForField(schema, 'invalid')).toThrow(
            'Field not found in schema: invalid'
        );
    });

    it('throws error for invalid nested path', () => {
        const schema = z.object({
            user: z.object({
                name: z.string(),
            }),
        });

        expect(() => getSchemaForField(schema, 'user.invalid')).toThrow(
            'Field not found in schema: user.invalid'
        );
    });

    it('throws error when navigating through non-object', () => {
        const schema = z.object({
            name: z.string(),
        });

        expect(() => getSchemaForField(schema, 'name.invalid')).toThrow(
            'Cannot navigate to field: name.invalid'
        );
    });
});
