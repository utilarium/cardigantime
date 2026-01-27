import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
    checkConfig,
    sanitizeConfig,
    createCheckConfigHandler,
    CheckConfigOptions,
    MCPInvocationContext,
    FileConfigSource,
} from '../../../src/mcp';
import { ConfigFormat } from '../../../src/types';

describe('checkConfig', () => {
    const testSchema = z.object({
        port: z.number(),
        host: z.string(),
        apiKey: z.string().optional(),
    });

    const baseOptions: CheckConfigOptions = {
        appName: 'test-app',
        schema: testSchema,
    };

    it('should return config from MCP source', async () => {
        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await checkConfig({}, context, baseOptions);

        expect(result.source).toBe('mcp');
        expect(result.hierarchical).toBe(false);
        expect(result.configPaths).toBeUndefined();
        expect(result.config).toBeDefined();
        expect(result.summary).toContain('MCP invocation');
    });

    it('should return config from file source', async () => {
        const context: MCPInvocationContext = {
            workingDirectory: '/app',
        };

        const mockFileSource: FileConfigSource = {
            type: 'file',
            filePath: '/app/config.yaml',
            format: ConfigFormat.YAML,
        };

        const result = await checkConfig({}, context, {
            ...baseOptions,
            resolveFileConfig: vi.fn().mockResolvedValue(mockFileSource),
        });

        expect(result.source).toBe('file');
        expect(result.configPaths).toEqual(['/app/config.yaml']);
        expect(result.hierarchical).toBe(false);
    });

    it('should include config by default', async () => {
        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await checkConfig({}, context, baseOptions);

        expect(result.config).toBeDefined();
        expect(result.config?.port).toBe(3000);
        expect(result.config?.host).toBe('localhost');
    });

    it('should exclude config when includeConfig is false', async () => {
        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await checkConfig(
            { includeConfig: false },
            context,
            baseOptions
        );

        expect(result.config).toBeUndefined();
    });

    it('should sanitize sensitive values', async () => {
        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
                apiKey: 'secret-key-123',
            },
        };

        const result = await checkConfig({}, context, baseOptions);

        expect(result.config?.port).toBe(3000);
        expect(result.config?.host).toBe('localhost');
        expect(result.config?.apiKey).toBe('***');
    });

    it('should include value breakdown in verbose mode', async () => {
        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await checkConfig(
            { verbose: true },
            context,
            baseOptions
        );

        expect(result.valueBreakdown).toBeDefined();
        expect(result.valueBreakdown?.length).toBeGreaterThan(0);
        
        const portValue = result.valueBreakdown?.find(v => v.field === 'port');
        expect(portValue).toBeDefined();
        expect(portValue?.value).toBe(3000);
        expect(portValue?.source).toBe('MCP invocation');
        expect(portValue?.sanitized).toBe(false);
    });

    it('should mark sensitive fields in value breakdown', async () => {
        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
                apiKey: 'secret',
            },
        };

        const result = await checkConfig(
            { verbose: true },
            context,
            baseOptions
        );

        const apiKeyValue = result.valueBreakdown?.find(v => v.field === 'apiKey');
        expect(apiKeyValue).toBeDefined();
        expect(apiKeyValue?.value).toBe('***');
        expect(apiKeyValue?.sanitized).toBe(true);
    });

    it('should not include value breakdown when not verbose', async () => {
        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await checkConfig({}, context, baseOptions);

        expect(result.valueBreakdown).toBeUndefined();
    });

    it('should include documentation links', async () => {
        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await checkConfig({}, context, baseOptions);

        expect(result.documentation).toBeDefined();
        expect(result.documentation.configGuide).toBeDefined();
        expect(result.documentation.formatReference).toBeDefined();
        expect(result.documentation.mcpGuide).toBeDefined();
    });

    it('should use custom docs base URL', async () => {
        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await checkConfig({}, context, {
            ...baseOptions,
            docsBaseUrl: 'https://example.com/docs',
        });

        expect(result.documentation.configGuide).toContain('https://example.com/docs');
    });

    it('should detect warnings for many hierarchical configs', async () => {
        const context: MCPInvocationContext = {
            workingDirectory: '/app/src/api/handlers',
        };

        const mockFileSource: FileConfigSource = {
            type: 'file',
            filePath: '/app/src/api/handlers/config.yaml',
            format: ConfigFormat.YAML,
            parents: [
                { type: 'file', filePath: '/app/src/api/config.yaml', format: ConfigFormat.YAML },
                { type: 'file', filePath: '/app/src/config.yaml', format: ConfigFormat.YAML },
                { type: 'file', filePath: '/app/config.yaml', format: ConfigFormat.YAML },
                { type: 'file', filePath: '/config.yaml', format: ConfigFormat.YAML },
            ],
        };

        const result = await checkConfig({}, context, {
            ...baseOptions,
            resolveFileConfig: vi.fn().mockResolvedValue(mockFileSource),
        });

        expect(result.warnings).toBeDefined();
        expect(result.warnings?.length).toBeGreaterThan(0);
        expect(result.warnings?.[0]).toContain('merged from');
    });

    it('should not include warnings when none detected', async () => {
        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await checkConfig({}, context, baseOptions);

        expect(result.warnings).toBeUndefined();
    });
});

describe('sanitizeConfig', () => {
    it('should sanitize sensitive fields', () => {
        const config = {
            port: 3000,
            host: 'localhost',
            password: 'secret123',
            apiKey: 'key-456',
        };

        const sanitized = sanitizeConfig(config);

        expect(sanitized.port).toBe(3000);
        expect(sanitized.host).toBe('localhost');
        expect(sanitized.password).toBe('***');
        expect(sanitized.apiKey).toBe('***');
    });

    it('should sanitize nested sensitive fields', () => {
        const config = {
            server: {
                port: 3000,
                apiKey: 'secret',
                timeout: 5000,
            },
        };

        const sanitized = sanitizeConfig(config);

        expect(sanitized.server).toBeDefined();
        const server = sanitized.server as Record<string, unknown>;
        expect(server.port).toBe(3000);
        expect(server.apiKey).toBe('***');
        expect(server.timeout).toBe(5000);
    });

    it('should sanitize sensitive fields in arrays', () => {
        const config = {
            servers: [
                { host: 'server1', password: 'pass1' },
                { host: 'server2', password: 'pass2' },
            ],
        };

        const sanitized = sanitizeConfig(config);

        expect(Array.isArray(sanitized.servers)).toBe(true);
        const servers = sanitized.servers as Array<Record<string, unknown>>;
        expect(servers[0].host).toBe('server1');
        expect(servers[0].password).toBe('***');
        expect(servers[1].host).toBe('server2');
        expect(servers[1].password).toBe('***');
    });

    it('should handle empty objects', () => {
        const config = {};
        const sanitized = sanitizeConfig(config);
        expect(sanitized).toEqual({});
    });

    it('should handle null values', () => {
        const config = {
            port: 3000,
            host: null,
        };

        const sanitized = sanitizeConfig(config);

        expect(sanitized.port).toBe(3000);
        expect(sanitized.host).toBe(null);
    });

    it('should handle undefined values', () => {
        const config = {
            port: 3000,
            host: undefined,
        };

        const sanitized = sanitizeConfig(config);

        expect(sanitized.port).toBe(3000);
        expect(sanitized.host).toBe(undefined);
    });

    it('should preserve non-sensitive array values', () => {
        const config = {
            ports: [3000, 3001, 3002],
            hosts: ['host1', 'host2'],
        };

        const sanitized = sanitizeConfig(config);

        expect(sanitized.ports).toEqual([3000, 3001, 3002]);
        expect(sanitized.hosts).toEqual(['host1', 'host2']);
    });

    it('should handle deeply nested objects', () => {
        const config = {
            level1: {
                level2: {
                    level3: {
                        port: 3000,
                        secret: 'hidden',
                    },
                },
            },
        };

        const sanitized = sanitizeConfig(config);

        const level1 = sanitized.level1 as Record<string, unknown>;
        const level2 = level1.level2 as Record<string, unknown>;
        const level3 = level2.level3 as Record<string, unknown>;
        
        expect(level3.port).toBe(3000);
        expect(level3.secret).toBe('***');
    });
});

describe('createCheckConfigHandler', () => {
    const testSchema = z.object({
        port: z.number(),
        host: z.string(),
    });

    it('should create a handler function', () => {
        const handler = createCheckConfigHandler({
            appName: 'test-app',
            schema: testSchema,
        });

        expect(typeof handler).toBe('function');
    });

    it('should handle MCP config', async () => {
        const handler = createCheckConfigHandler({
            appName: 'test-app',
            schema: testSchema,
        });

        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await handler({}, context);

        expect(result.source).toBe('mcp');
        expect(result.config).toBeDefined();
    });

    it('should handle file config', async () => {
        const mockFileSource: FileConfigSource = {
            type: 'file',
            filePath: '/app/config.yaml',
            format: ConfigFormat.YAML,
        };

        const handler = createCheckConfigHandler({
            appName: 'test-app',
            schema: testSchema,
            resolveFileConfig: vi.fn().mockResolvedValue(mockFileSource),
        });

        const context: MCPInvocationContext = {
            workingDirectory: '/app',
        };

        const result = await handler({}, context);

        expect(result.source).toBe('file');
        expect(result.configPaths).toEqual(['/app/config.yaml']);
    });

    it('should pass through input options', async () => {
        const handler = createCheckConfigHandler({
            appName: 'test-app',
            schema: testSchema,
        });

        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await handler({ verbose: true }, context);

        expect(result.valueBreakdown).toBeDefined();
    });
});
