import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
    readEnvVar, 
    readEnvVarForField, 
    readEnvVarsForSchema 
} from '../../src/env/reader';

describe('readEnvVar', () => {
    beforeEach(() => {
        // Clear env vars before each test
        delete process.env.TEST_VAR;
    });

    afterEach(() => {
        // Clean up after tests
        delete process.env.TEST_VAR;
    });

    it('reads existing env var', () => {
        process.env.TEST_VAR = 'test-value';
        expect(readEnvVar('TEST_VAR')).toBe('test-value');
    });

    it('returns undefined for missing env var', () => {
        expect(readEnvVar('NONEXISTENT')).toBeUndefined();
    });

    it('handles empty string value', () => {
        process.env.TEST_VAR = '';
        expect(readEnvVar('TEST_VAR')).toBe('');
    });

    it('handles numeric string values', () => {
        process.env.TEST_VAR = '42';
        expect(readEnvVar('TEST_VAR')).toBe('42');
    });

    it('handles boolean string values', () => {
        process.env.TEST_VAR = 'true';
        expect(readEnvVar('TEST_VAR')).toBe('true');
    });
});

describe('readEnvVarForField', () => {
    beforeEach(() => {
        delete process.env.RIOTPLAN_PLAN_DIRECTORY;
        delete process.env.OPENAI_API_KEY;
        delete process.env.RIOTPLAN_API_KEY;
    });

    afterEach(() => {
        delete process.env.RIOTPLAN_PLAN_DIRECTORY;
        delete process.env.OPENAI_API_KEY;
        delete process.env.RIOTPLAN_API_KEY;
    });

    it('reads auto-generated env var name', () => {
        process.env.RIOTPLAN_PLAN_DIRECTORY = '/path/to/plans';

        const result = readEnvVarForField('planDirectory', {
            appName: 'riotplan',
        });

        expect(result.envVarName).toBe('RIOTPLAN_PLAN_DIRECTORY');
        expect(result.value).toBe('/path/to/plans');
        expect(result.isCustom).toBe(false);
        expect(result.fieldPath).toBe('planDirectory');
    });

    it('reads custom env var name from envVarMap', () => {
        process.env.OPENAI_API_KEY = 'sk-test-key';

        const result = readEnvVarForField('openaiApiKey', {
            appName: 'riotplan',
            envVarMap: {
                openaiApiKey: 'OPENAI_API_KEY',
            },
        });

        expect(result.envVarName).toBe('OPENAI_API_KEY');
        expect(result.value).toBe('sk-test-key');
        expect(result.isCustom).toBe(true);
    });

    it('handles nested field paths as array', () => {
        process.env.RIOTPLAN_API_KEY = 'test-key';

        const result = readEnvVarForField(['api', 'key'], {
            appName: 'riotplan',
        });

        expect(result.envVarName).toBe('RIOTPLAN_API_KEY');
        expect(result.value).toBe('test-key');
        expect(result.fieldPath).toEqual(['api', 'key']);
    });

    it('returns undefined value for missing env var', () => {
        const result = readEnvVarForField('missing', {
            appName: 'riotplan',
        });

        expect(result.value).toBeUndefined();
        expect(result.envVarName).toBe('RIOTPLAN_MISSING');
    });

    it('custom mapping takes precedence over auto-generated', () => {
        // Set both custom and auto-generated env vars
        process.env.OPENAI_API_KEY = 'custom-value';
        process.env.RIOTPLAN_OPENAI_API_KEY = 'auto-value';

        const result = readEnvVarForField('openaiApiKey', {
            appName: 'riotplan',
            envVarMap: {
                openaiApiKey: 'OPENAI_API_KEY',
            },
        });

        // Should use custom mapping
        expect(result.value).toBe('custom-value');
        expect(result.isCustom).toBe(true);
    });

    it('handles nested paths in envVarMap', () => {
        process.env.CUSTOM_KEY = 'custom-value';

        const result = readEnvVarForField(['api', 'key'], {
            appName: 'riotplan',
            envVarMap: {
                'api.key': 'CUSTOM_KEY',
            },
        });

        expect(result.envVarName).toBe('CUSTOM_KEY');
        expect(result.value).toBe('custom-value');
        expect(result.isCustom).toBe(true);
    });
});

describe('readEnvVarsForSchema', () => {
    beforeEach(() => {
        delete process.env.RIOTPLAN_PLAN_DIRECTORY;
        delete process.env.RIOTPLAN_PORT;
        delete process.env.RIOTPLAN_VERBOSE;
        delete process.env.OPENAI_API_KEY;
    });

    afterEach(() => {
        delete process.env.RIOTPLAN_PLAN_DIRECTORY;
        delete process.env.RIOTPLAN_PORT;
        delete process.env.RIOTPLAN_VERBOSE;
        delete process.env.OPENAI_API_KEY;
    });

    it('reads multiple env vars', () => {
        process.env.RIOTPLAN_PLAN_DIRECTORY = '/plans';
        process.env.RIOTPLAN_PORT = '3000';

        const results = readEnvVarsForSchema(
            ['planDirectory', 'port', 'verbose'],
            { appName: 'riotplan' }
        );

        expect(results.size).toBe(2); // Only set vars
        expect(results.get('planDirectory')?.value).toBe('/plans');
        expect(results.get('port')?.value).toBe('3000');
        expect(results.has('verbose')).toBe(false); // Not set
    });

    it('handles empty schema', () => {
        const results = readEnvVarsForSchema([], { appName: 'riotplan' });
        expect(results.size).toBe(0);
    });

    it('respects custom env var mappings', () => {
        process.env.OPENAI_API_KEY = 'sk-key';

        const results = readEnvVarsForSchema(
            ['openaiApiKey'],
            {
                appName: 'riotplan',
                envVarMap: { openaiApiKey: 'OPENAI_API_KEY' },
            }
        );

        expect(results.get('openaiApiKey')?.envVarName).toBe('OPENAI_API_KEY');
        expect(results.get('openaiApiKey')?.isCustom).toBe(true);
        expect(results.get('openaiApiKey')?.value).toBe('sk-key');
    });

    it('only includes set env vars in results', () => {
        process.env.RIOTPLAN_FIELD1 = 'value1';
        // RIOTPLAN_FIELD2 not set
        process.env.RIOTPLAN_FIELD3 = 'value3';

        const results = readEnvVarsForSchema(
            ['field1', 'field2', 'field3'],
            { appName: 'riotplan' }
        );

        expect(results.size).toBe(2);
        expect(results.has('field1')).toBe(true);
        expect(results.has('field2')).toBe(false);
        expect(results.has('field3')).toBe(true);
    });

    it('handles mix of custom and auto-generated names', () => {
        process.env.RIOTPLAN_FIELD1 = 'auto-value';
        process.env.CUSTOM_FIELD2 = 'custom-value';

        const results = readEnvVarsForSchema(
            ['field1', 'field2'],
            {
                appName: 'riotplan',
                envVarMap: { field2: 'CUSTOM_FIELD2' },
            }
        );

        expect(results.size).toBe(2);
        expect(results.get('field1')?.isCustom).toBe(false);
        expect(results.get('field2')?.isCustom).toBe(true);
    });

    it('handles empty string values', () => {
        process.env.RIOTPLAN_FIELD = '';

        const results = readEnvVarsForSchema(
            ['field'],
            { appName: 'riotplan' }
        );

        expect(results.size).toBe(1);
        expect(results.get('field')?.value).toBe('');
    });
});
