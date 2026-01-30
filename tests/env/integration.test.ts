import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { resolveEnvVarConfig } from '../../src/env/resolver';
import { EnvVarParseError, EnvVarValidationError } from '../../src/env/errors';

describe('resolveEnvVarConfig', () => {
    const schema = z.object({
        planDirectory: z.string(),
        port: z.number(),
        verbose: z.boolean(),
    });

    beforeEach(() => {
        delete process.env.RIOTPLAN_PLAN_DIRECTORY;
        delete process.env.RIOTPLAN_PORT;
        delete process.env.RIOTPLAN_VERBOSE;
    });

    afterEach(() => {
        delete process.env.RIOTPLAN_PLAN_DIRECTORY;
        delete process.env.RIOTPLAN_PORT;
        delete process.env.RIOTPLAN_VERBOSE;
        delete process.env.OPENAI_API_KEY;
    });

    it('resolves complete config from env vars', async () => {
        process.env.RIOTPLAN_PLAN_DIRECTORY = '/plans';
        process.env.RIOTPLAN_PORT = '3000';
        process.env.RIOTPLAN_VERBOSE = 'true';

        const result = await resolveEnvVarConfig(schema, {
            appName: 'riotplan',
        });

        expect(result).not.toBeNull();
        expect(result!.config).toEqual({
            planDirectory: '/plans',
            port: 3000,
            verbose: true,
        });
        expect(result!.source.type).toBe('env');
        expect(result!.source.values.size).toBe(3);
    });

    it('returns null when no env vars found', async () => {
        const result = await resolveEnvVarConfig(schema, {
            appName: 'riotplan',
        });

        expect(result).toBeNull();
    });

    it('resolves partial config from env vars', async () => {
        process.env.RIOTPLAN_PORT = '3000';

        const partialSchema = z.object({
            planDirectory: z.string().optional(),
            port: z.number(),
            verbose: z.boolean().optional(),
        });

        const result = await resolveEnvVarConfig(partialSchema, {
            appName: 'riotplan',
        });

        expect(result).not.toBeNull();
        expect(result!.config).toEqual({
            port: 3000,
        });
    });

    it('throws on parse error', async () => {
        process.env.RIOTPLAN_PORT = 'not-a-number';

        await expect(
            resolveEnvVarConfig(schema, { appName: 'riotplan' })
        ).rejects.toThrow(EnvVarParseError);
    });

    it('parse error includes env var name', async () => {
        process.env.RIOTPLAN_PORT = 'not-a-number';

        try {
            await resolveEnvVarConfig(schema, { appName: 'riotplan' });
            expect.fail('Should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(EnvVarParseError);
            expect((error as EnvVarParseError).envVarName).toBe('RIOTPLAN_PORT');
        }
    });

    it('throws on validation error', async () => {
        const constrainedSchema = z.object({
            port: z.number().min(1).max(65535),
        });

        process.env.RIOTPLAN_PORT = '-1';

        await expect(
            resolveEnvVarConfig(constrainedSchema, { appName: 'riotplan' })
        ).rejects.toThrow(EnvVarValidationError);
    });

    it('handles custom env var mappings', async () => {
        process.env.OPENAI_API_KEY = 'sk-test';

        const customSchema = z.object({
            openaiApiKey: z.string(),
        });

        const result = await resolveEnvVarConfig(customSchema, {
            appName: 'riotplan',
            envVarMap: { openaiApiKey: 'OPENAI_API_KEY' },
        });

        expect(result).not.toBeNull();
        expect(result!.config.openaiApiKey).toBe('sk-test');
        expect(result!.source.values.get('openaiApiKey')?.isCustom).toBe(true);
    });

    it('handles nested objects', async () => {
        const nestedSchema = z.object({
            api: z.object({
                key: z.string(),
                timeout: z.number(),
            }),
        });

        process.env.RIOTPLAN_API_KEY = 'test-key';
        process.env.RIOTPLAN_API_TIMEOUT = '5000';

        const result = await resolveEnvVarConfig(nestedSchema, {
            appName: 'riotplan',
        });

        expect(result).not.toBeNull();
        expect(result!.config).toEqual({
            api: {
                key: 'test-key',
                timeout: 5000,
            },
        });
    });

    it('handles arrays', async () => {
        const arraySchema = z.object({
            tags: z.array(z.string()),
        });

        process.env.RIOTPLAN_TAGS = 'tag1 tag2 tag3';

        const result = await resolveEnvVarConfig(arraySchema, {
            appName: 'riotplan',
        });

        expect(result).not.toBeNull();
        expect(result!.config.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('handles boolean variations', async () => {
        const boolSchema = z.object({
            enabled: z.boolean(),
        });

        // Test 'yes'
        process.env.RIOTPLAN_ENABLED = 'yes';
        let result = await resolveEnvVarConfig(boolSchema, {
            appName: 'riotplan',
        });
        expect(result!.config.enabled).toBe(true);

        // Test '0'
        process.env.RIOTPLAN_ENABLED = '0';
        result = await resolveEnvVarConfig(boolSchema, {
            appName: 'riotplan',
        });
        expect(result!.config.enabled).toBe(false);
    });

    it('handles number formats', async () => {
        const numSchema = z.object({
            hex: z.number(),
            scientific: z.number(),
            float: z.number(),
        });

        process.env.RIOTPLAN_HEX = '0xFF';
        process.env.RIOTPLAN_SCIENTIFIC = '1e6';
        process.env.RIOTPLAN_FLOAT = '3.14';

        const result = await resolveEnvVarConfig(numSchema, {
            appName: 'riotplan',
        });

        expect(result).not.toBeNull();
        expect(result!.config).toEqual({
            hex: 255,
            scientific: 1000000,
            float: 3.14,
        });
    });

    it('source includes readAt timestamp', async () => {
        process.env.RIOTPLAN_PORT = '3000';

        const result = await resolveEnvVarConfig(
            z.object({ port: z.number() }),
            { appName: 'riotplan' }
        );

        expect(result).not.toBeNull();
        expect(result!.source.readAt).toBeInstanceOf(Date);
    });

    it('handles mix of set and unset env vars', async () => {
        const mixedSchema = z.object({
            required: z.string(),
            optional: z.string().optional(),
        });

        process.env.RIOTPLAN_REQUIRED = 'value';
        // RIOTPLAN_OPTIONAL not set

        const result = await resolveEnvVarConfig(mixedSchema, {
            appName: 'riotplan',
        });

        expect(result).not.toBeNull();
        expect(result!.config).toEqual({
            required: 'value',
        });
    });
});
