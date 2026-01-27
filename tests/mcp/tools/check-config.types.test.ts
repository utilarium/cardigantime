import { describe, it, expect } from 'vitest';
import {
    CHECK_CONFIG_TOOL_DESCRIPTOR,
    SENSITIVE_FIELD_PATTERNS,
    isSensitiveField,
    sanitizeValue,
} from '../../../src/mcp/tools/index';

describe('CHECK_CONFIG_TOOL_DESCRIPTOR', () => {
    it('should have correct tool name', () => {
        expect(CHECK_CONFIG_TOOL_DESCRIPTOR.name).toBe('check_config');
    });

    it('should have description', () => {
        expect(CHECK_CONFIG_TOOL_DESCRIPTOR.description).toBeDefined();
        expect(CHECK_CONFIG_TOOL_DESCRIPTOR.description.length).toBeGreaterThan(0);
    });

    it('should have input schema', () => {
        expect(CHECK_CONFIG_TOOL_DESCRIPTOR.inputSchema).toBeDefined();
        expect(CHECK_CONFIG_TOOL_DESCRIPTOR.inputSchema.type).toBe('object');
    });

    it('should define targetFile parameter', () => {
        const targetFile = CHECK_CONFIG_TOOL_DESCRIPTOR.inputSchema.properties.targetFile;
        
        expect(targetFile).toBeDefined();
        expect(targetFile?.type).toBe('string');
        expect(targetFile?.description).toBeDefined();
    });

    it('should define verbose parameter with default', () => {
        const verbose = CHECK_CONFIG_TOOL_DESCRIPTOR.inputSchema.properties.verbose;
        
        expect(verbose).toBeDefined();
        expect(verbose?.type).toBe('boolean');
        expect(verbose?.default).toBe(false);
        expect(verbose?.description).toBeDefined();
    });

    it('should define includeConfig parameter with default', () => {
        const includeConfig = CHECK_CONFIG_TOOL_DESCRIPTOR.inputSchema.properties.includeConfig;
        
        expect(includeConfig).toBeDefined();
        expect(includeConfig?.type).toBe('boolean');
        expect(includeConfig?.default).toBe(true);
        expect(includeConfig?.description).toBeDefined();
    });

    it('should not allow additional properties', () => {
        expect(CHECK_CONFIG_TOOL_DESCRIPTOR.inputSchema.additionalProperties).toBe(false);
    });
});

describe('SENSITIVE_FIELD_PATTERNS', () => {
    it('should be an array of RegExp patterns', () => {
        expect(Array.isArray(SENSITIVE_FIELD_PATTERNS)).toBe(true);
        expect(SENSITIVE_FIELD_PATTERNS.length).toBeGreaterThan(0);
        
        SENSITIVE_FIELD_PATTERNS.forEach(pattern => {
            expect(pattern).toBeInstanceOf(RegExp);
        });
    });

    it('should match common sensitive field names', () => {
        const sensitiveNames = [
            'password',
            'secret',
            'token',
            'apiKey',
            'api_key',
            'auth',
            'credential',
            'privateKey',
            'private_key',
            'accessKey',
            'access_key',
        ];

        sensitiveNames.forEach(name => {
            const matched = SENSITIVE_FIELD_PATTERNS.some(pattern => pattern.test(name));
            expect(matched).toBe(true);
        });
    });

    it('should be case-insensitive', () => {
        const variations = [
            'PASSWORD',
            'Password',
            'SECRET',
            'Secret',
            'TOKEN',
            'Token',
        ];

        variations.forEach(name => {
            const matched = SENSITIVE_FIELD_PATTERNS.some(pattern => pattern.test(name));
            expect(matched).toBe(true);
        });
    });

    it('should not match non-sensitive field names', () => {
        const nonSensitiveNames = [
            'port',
            'host',
            'timeout',
            'maxRetries',
            'enabled',
            'path',
        ];

        nonSensitiveNames.forEach(name => {
            const matched = SENSITIVE_FIELD_PATTERNS.some(pattern => pattern.test(name));
            expect(matched).toBe(false);
        });
    });
});

describe('isSensitiveField', () => {
    it('should return true for password fields', () => {
        expect(isSensitiveField('password')).toBe(true);
        expect(isSensitiveField('userPassword')).toBe(true);
        expect(isSensitiveField('PASSWORD')).toBe(true);
    });

    it('should return true for secret fields', () => {
        expect(isSensitiveField('secret')).toBe(true);
        expect(isSensitiveField('apiSecret')).toBe(true);
        expect(isSensitiveField('SECRET')).toBe(true);
    });

    it('should return true for token fields', () => {
        expect(isSensitiveField('token')).toBe(true);
        expect(isSensitiveField('authToken')).toBe(true);
        expect(isSensitiveField('TOKEN')).toBe(true);
    });

    it('should return true for API key fields', () => {
        expect(isSensitiveField('apiKey')).toBe(true);
        expect(isSensitiveField('api_key')).toBe(true);
        expect(isSensitiveField('API_KEY')).toBe(true);
    });

    it('should return true for auth fields', () => {
        expect(isSensitiveField('auth')).toBe(true);
        expect(isSensitiveField('authentication')).toBe(true);
        expect(isSensitiveField('AUTH')).toBe(true);
    });

    it('should return true for credential fields', () => {
        expect(isSensitiveField('credential')).toBe(true);
        expect(isSensitiveField('credentials')).toBe(true);
        expect(isSensitiveField('CREDENTIAL')).toBe(true);
    });

    it('should return true for private key fields', () => {
        expect(isSensitiveField('privateKey')).toBe(true);
        expect(isSensitiveField('private_key')).toBe(true);
        expect(isSensitiveField('PRIVATE_KEY')).toBe(true);
    });

    it('should return true for access key fields', () => {
        expect(isSensitiveField('accessKey')).toBe(true);
        expect(isSensitiveField('access_key')).toBe(true);
        expect(isSensitiveField('ACCESS_KEY')).toBe(true);
    });

    it('should return false for non-sensitive fields', () => {
        expect(isSensitiveField('port')).toBe(false);
        expect(isSensitiveField('host')).toBe(false);
        expect(isSensitiveField('timeout')).toBe(false);
        expect(isSensitiveField('maxRetries')).toBe(false);
        expect(isSensitiveField('enabled')).toBe(false);
        expect(isSensitiveField('path')).toBe(false);
    });

    it('should handle empty strings', () => {
        expect(isSensitiveField('')).toBe(false);
    });

    it('should handle field names with dots', () => {
        expect(isSensitiveField('server.password')).toBe(true);
        expect(isSensitiveField('server.port')).toBe(false);
    });
});

describe('sanitizeValue', () => {
    it('should return *** for strings', () => {
        expect(sanitizeValue('my-secret-key')).toBe('***');
        expect(sanitizeValue('password123')).toBe('***');
        expect(sanitizeValue('')).toBe('***');
    });

    it('should return *** for numbers', () => {
        expect(sanitizeValue(12345)).toBe('***');
        expect(sanitizeValue(0)).toBe('***');
        expect(sanitizeValue(-1)).toBe('***');
    });

    it('should return *** for booleans', () => {
        expect(sanitizeValue(true)).toBe('***');
        expect(sanitizeValue(false)).toBe('***');
    });

    it('should return *** for objects', () => {
        expect(sanitizeValue({ key: 'value' })).toBe('***');
        expect(sanitizeValue({})).toBe('***');
    });

    it('should return *** for arrays', () => {
        expect(sanitizeValue([1, 2, 3])).toBe('***');
        expect(sanitizeValue([])).toBe('***');
    });

    it('should return *** for null', () => {
        expect(sanitizeValue(null)).toBe('***');
    });

    it('should return *** for undefined', () => {
        expect(sanitizeValue(undefined)).toBe('***');
    });
});
