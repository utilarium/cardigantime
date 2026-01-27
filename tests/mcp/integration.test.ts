import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
    createCheckConfigTool,
    createConfigResolver,
    withConfig,
    createMCPIntegration,
    MCPInvocationContext,
    FileConfigSource,
} from '../../src/mcp';
import { ConfigFormat } from '../../src/types';

describe('createCheckConfigTool', () => {
    const testSchema = z.object({
        port: z.number(),
        host: z.string(),
    });

    it('should create a tool with descriptor and handler', () => {
        const tool = createCheckConfigTool({
            appName: 'test-app',
            configSchema: testSchema,
        });

        expect(tool.descriptor).toBeDefined();
        expect(tool.descriptor.name).toBe('check_config');
        expect(typeof tool.handler).toBe('function');
    });

    it('should handle MCP config', async () => {
        const tool = createCheckConfigTool({
            appName: 'test-app',
            configSchema: testSchema,
        });

        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await tool.handler({}, context);

        expect(result.source).toBe('mcp');
        expect(result.config).toBeDefined();
    });

    it('should handle file config', async () => {
        const mockFileSource: FileConfigSource = {
            type: 'file',
            filePath: '/app/config.yaml',
            format: ConfigFormat.YAML,
        };

        const tool = createCheckConfigTool({
            appName: 'test-app',
            configSchema: testSchema,
            resolveFileConfig: vi.fn().mockResolvedValue(mockFileSource),
        });

        const context: MCPInvocationContext = {
            workingDirectory: '/app',
        };

        const result = await tool.handler({}, context);

        expect(result.source).toBe('file');
        expect(result.configPaths).toEqual(['/app/config.yaml']);
    });

    it('should use custom docs base URL', async () => {
        const tool = createCheckConfigTool({
            appName: 'test-app',
            configSchema: testSchema,
            docsBaseUrl: 'https://example.com/docs',
        });

        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await tool.handler({}, context);

        expect(result.documentation.configGuide).toContain('https://example.com/docs');
    });
});

describe('createConfigResolver', () => {
    const testSchema = z.object({
        port: z.number(),
        host: z.string(),
    });

    it('should create a resolver function', () => {
        const resolver = createConfigResolver({
            appName: 'test-app',
            configSchema: testSchema,
        });

        expect(typeof resolver).toBe('function');
    });

    it('should resolve MCP config', async () => {
        const resolver = createConfigResolver({
            appName: 'test-app',
            configSchema: testSchema,
        });

        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await resolver(context);

        expect(result.source.type).toBe('mcp');
        expect(result.hierarchical).toBe(false);
    });

    it('should resolve file config', async () => {
        const mockFileSource: FileConfigSource = {
            type: 'file',
            filePath: '/app/config.yaml',
            format: ConfigFormat.YAML,
        };

        const resolver = createConfigResolver({
            appName: 'test-app',
            configSchema: testSchema,
            resolveFileConfig: vi.fn().mockResolvedValue(mockFileSource),
        });

        const context: MCPInvocationContext = {
            workingDirectory: '/app',
        };

        const result = await resolver(context);

        expect(result.source.type).toBe('file');
    });
});

describe('withConfig', () => {
    const testSchema = z.object({
        port: z.number(),
        host: z.string(),
    });

    it('should wrap handler and inject config', async () => {
        const mockHandler = vi.fn().mockResolvedValue({ result: 'success' });

        const wrapped = withConfig(mockHandler, {
            appName: 'test-app',
            configSchema: testSchema,
        });

        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await wrapped({ input: 'test' }, context);

        expect(result).toEqual({ result: 'success' });
        expect(mockHandler).toHaveBeenCalledWith(
            { input: 'test' },
            expect.objectContaining({
                config: expect.objectContaining({
                    port: 3000,
                    host: 'localhost',
                }),
                resolvedConfig: expect.objectContaining({
                    source: expect.objectContaining({
                        type: 'mcp',
                    }),
                }),
            })
        );
    });

    it('should pass through handler return value', async () => {
        const mockHandler = vi.fn().mockResolvedValue({ data: [1, 2, 3] });

        const wrapped = withConfig(mockHandler, {
            appName: 'test-app',
            configSchema: testSchema,
        });

        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await wrapped({}, context);

        expect(result).toEqual({ data: [1, 2, 3] });
    });

    it('should resolve file config before calling handler', async () => {
        const mockFileSource: FileConfigSource = {
            type: 'file',
            filePath: '/app/config.yaml',
            format: ConfigFormat.YAML,
        };

        const mockHandler = vi.fn().mockResolvedValue({ result: 'success' });

        const wrapped = withConfig(mockHandler, {
            appName: 'test-app',
            configSchema: testSchema,
            resolveFileConfig: vi.fn().mockResolvedValue(mockFileSource),
        });

        const context: MCPInvocationContext = {
            workingDirectory: '/app',
        };

        await wrapped({}, context);

        expect(mockHandler).toHaveBeenCalledWith(
            {},
            expect.objectContaining({
                resolvedConfig: expect.objectContaining({
                    source: expect.objectContaining({
                        type: 'file',
                    }),
                }),
            })
        );
    });

    it('should propagate handler errors', async () => {
        const mockHandler = vi.fn().mockRejectedValue(new Error('Handler error'));

        const wrapped = withConfig(mockHandler, {
            appName: 'test-app',
            configSchema: testSchema,
        });

        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        await expect(wrapped({}, context)).rejects.toThrow('Handler error');
    });
});

describe('createMCPIntegration', () => {
    const testSchema = z.object({
        port: z.number(),
        host: z.string(),
    });

    it('should create integration with all helpers', () => {
        const integration = createMCPIntegration({
            appName: 'test-app',
            configSchema: testSchema,
        });

        expect(integration.checkConfig).toBeDefined();
        expect(integration.checkConfig.descriptor).toBeDefined();
        expect(typeof integration.checkConfig.handler).toBe('function');
        expect(typeof integration.resolveConfig).toBe('function');
        expect(typeof integration.withConfig).toBe('function');
        expect(integration.options).toBeDefined();
    });

    it('should have working checkConfig tool', async () => {
        const integration = createMCPIntegration({
            appName: 'test-app',
            configSchema: testSchema,
        });

        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await integration.checkConfig.handler({}, context);

        expect(result.source).toBe('mcp');
        expect(result.config).toBeDefined();
    });

    it('should have working resolveConfig function', async () => {
        const integration = createMCPIntegration({
            appName: 'test-app',
            configSchema: testSchema,
        });

        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await integration.resolveConfig(context);

        expect(result.source.type).toBe('mcp');
    });

    it('should have working withConfig wrapper', async () => {
        const integration = createMCPIntegration({
            appName: 'test-app',
            configSchema: testSchema,
        });

        const mockHandler = vi.fn().mockResolvedValue({ result: 'success' });
        const wrapped = integration.withConfig(mockHandler);

        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const result = await wrapped({}, context);

        expect(result).toEqual({ result: 'success' });
        expect(mockHandler).toHaveBeenCalled();
    });

    it('should preserve options', () => {
        const options = {
            appName: 'test-app',
            configSchema: testSchema,
            docsBaseUrl: 'https://example.com',
        };

        const integration = createMCPIntegration(options);

        expect(integration.options).toEqual(options);
    });

    it('should use custom resolveFileConfig', async () => {
        const mockFileSource: FileConfigSource = {
            type: 'file',
            filePath: '/app/config.yaml',
            format: ConfigFormat.YAML,
        };

        const mockResolveFileConfig = vi.fn().mockResolvedValue(mockFileSource);

        const integration = createMCPIntegration({
            appName: 'test-app',
            configSchema: testSchema,
            resolveFileConfig: mockResolveFileConfig,
        });

        const context: MCPInvocationContext = {
            workingDirectory: '/app',
        };

        await integration.resolveConfig(context);

        expect(mockResolveFileConfig).toHaveBeenCalledWith('/app');
    });
});
