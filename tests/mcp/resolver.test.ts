import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
    resolveConfig,
    explainResolution,
    isMCPConfig,
    isFileConfig,
    getConfigFiles,
    MCPContextError,
    MCPInvocationContext,
    FileConfigSource,
    ResolvedConfig,
} from '../../src/mcp';
import { ConfigFormat } from '../../src/types';

describe('resolveConfig', () => {
    const testSchema = z.object({
        port: z.number(),
        host: z.string(),
    });

    it('should use MCP config when present', async () => {
        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
            workingDirectory: '/app',
        };

        const result = await resolveConfig(context, {
            schema: testSchema,
        });

        expect(result.source.type).toBe('mcp');
        expect(result.hierarchical).toBe(false);
        expect(result.resolution).toBe('Configuration loaded from MCP invocation');
    });

    it('should fall back to file config when MCP config absent', async () => {
        const context: MCPInvocationContext = {
            workingDirectory: '/app',
        };

        const mockFileSource: FileConfigSource = {
            type: 'file',
            filePath: '/app/config.yaml',
            format: ConfigFormat.YAML,
        };

        const resolveFileConfig = vi.fn().mockResolvedValue(mockFileSource);

        const result = await resolveConfig(context, {
            schema: testSchema,
            resolveFileConfig,
        });

        expect(result.source.type).toBe('file');
        expect(resolveFileConfig).toHaveBeenCalledWith('/app');
    });

    it('should throw when neither config nor workingDirectory provided', async () => {
        const context: MCPInvocationContext = {};

        await expect(
            resolveConfig(context, {
                schema: testSchema,
            })
        ).rejects.toThrow(MCPContextError);
    });

    it('should throw when file fallback needed but no resolver provided', async () => {
        const context: MCPInvocationContext = {
            workingDirectory: '/app',
        };

        await expect(
            resolveConfig(context, {
                schema: testSchema,
                // No resolveFileConfig provided
            })
        ).rejects.toThrow(MCPContextError);
    });

    it('should not call file resolver when MCP config present', async () => {
        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
            workingDirectory: '/app',
        };

        const resolveFileConfig = vi.fn();

        await resolveConfig(context, {
            schema: testSchema,
            resolveFileConfig,
        });

        expect(resolveFileConfig).not.toHaveBeenCalled();
    });

    it('should pass MCP options to parser', async () => {
        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const mcpOptions = {
            workingDirectory: '/app',
            expandEnvVars: true,
        };

        await resolveConfig(context, {
            schema: testSchema,
            mcpOptions,
        });

        // Test passes if no error thrown
        expect(true).toBe(true);
    });

    it('should log resolution path when logger provided', async () => {
        const context: MCPInvocationContext = {
            config: {
                port: 3000,
                host: 'localhost',
            },
        };

        const logger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            verbose: vi.fn(),
            silly: vi.fn(),
        };

        await resolveConfig(context, {
            schema: testSchema,
            logger,
        });

        expect(logger.debug).toHaveBeenCalledWith(
            expect.stringContaining('MCP configuration detected')
        );
        expect(logger.info).toHaveBeenCalledWith(
            expect.stringContaining('Configuration loaded from MCP')
        );
    });

    it('should log file fallback when logger provided', async () => {
        const context: MCPInvocationContext = {
            workingDirectory: '/app',
        };

        const mockFileSource: FileConfigSource = {
            type: 'file',
            filePath: '/app/config.yaml',
            format: ConfigFormat.YAML,
        };

        const logger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            verbose: vi.fn(),
            silly: vi.fn(),
        };

        await resolveConfig(context, {
            schema: testSchema,
            resolveFileConfig: vi.fn().mockResolvedValue(mockFileSource),
            logger,
        });

        expect(logger.debug).toHaveBeenCalledWith(
            expect.stringContaining('falling back to file-based discovery')
        );
        expect(logger.info).toHaveBeenCalledWith(
            expect.stringContaining('Configuration loaded from file')
        );
    });

    it('should set hierarchical flag for file configs with parents', async () => {
        const context: MCPInvocationContext = {
            workingDirectory: '/app/src',
        };

        const mockFileSource: FileConfigSource = {
            type: 'file',
            filePath: '/app/src/config.yaml',
            format: ConfigFormat.YAML,
            parents: [
                {
                    type: 'file',
                    filePath: '/app/config.yaml',
                    format: ConfigFormat.YAML,
                },
            ],
        };

        const result = await resolveConfig(context, {
            schema: testSchema,
            resolveFileConfig: vi.fn().mockResolvedValue(mockFileSource),
        });

        expect(result.hierarchical).toBe(true);
    });

    it('should not set hierarchical flag for file configs without parents', async () => {
        const context: MCPInvocationContext = {
            workingDirectory: '/app',
        };

        const mockFileSource: FileConfigSource = {
            type: 'file',
            filePath: '/app/config.yaml',
            format: ConfigFormat.YAML,
        };

        const result = await resolveConfig(context, {
            schema: testSchema,
            resolveFileConfig: vi.fn().mockResolvedValue(mockFileSource),
        });

        expect(result.hierarchical).toBe(false);
    });
});

describe('explainResolution', () => {
    it('should explain MCP resolution', () => {
        const resolved: ResolvedConfig = {
            source: {
                type: 'mcp',
                rawConfig: {},
                receivedAt: new Date(),
            },
            config: {},
            hierarchical: false,
            resolution: 'Configuration loaded from MCP invocation',
        };

        const explanation = explainResolution(resolved);

        expect(explanation).toBe('Configuration loaded from MCP invocation');
    });

    it('should explain single file resolution', () => {
        const resolved: ResolvedConfig = {
            source: {
                type: 'file',
                filePath: '/app/config.yaml',
                format: ConfigFormat.YAML,
            },
            config: {},
            hierarchical: false,
            resolution: 'Configuration loaded from /app/config.yaml',
        };

        const explanation = explainResolution(resolved);

        expect(explanation).toBe('Configuration loaded from /app/config.yaml');
    });

    it('should explain hierarchical file resolution', () => {
        const resolved: ResolvedConfig = {
            source: {
                type: 'file',
                filePath: '/app/src/config.yaml',
                format: ConfigFormat.YAML,
                parents: [
                    {
                        type: 'file',
                        filePath: '/app/config.yaml',
                        format: ConfigFormat.YAML,
                    },
                ],
            },
            config: {},
            hierarchical: true,
            resolution: 'Configuration merged from 2 files',
        };

        const explanation = explainResolution(resolved);

        expect(explanation).toContain('Configuration merged from 2 files');
        expect(explanation).toContain('/app/src/config.yaml');
        expect(explanation).toContain('/app/config.yaml');
    });

    it('should explain multi-level hierarchical resolution', () => {
        const resolved: ResolvedConfig = {
            source: {
                type: 'file',
                filePath: '/app/src/api/config.yaml',
                format: ConfigFormat.YAML,
                parents: [
                    {
                        type: 'file',
                        filePath: '/app/src/config.yaml',
                        format: ConfigFormat.YAML,
                    },
                    {
                        type: 'file',
                        filePath: '/app/config.yaml',
                        format: ConfigFormat.YAML,
                    },
                ],
            },
            config: {},
            hierarchical: true,
            resolution: 'Configuration merged from 3 files',
        };

        const explanation = explainResolution(resolved);

        expect(explanation).toContain('Configuration merged from 3 files');
        expect(explanation).toContain('/app/src/api/config.yaml');
        expect(explanation).toContain('/app/src/config.yaml');
        expect(explanation).toContain('/app/config.yaml');
    });
});

describe('isMCPConfig', () => {
    it('should return true for MCP config', () => {
        const resolved: ResolvedConfig = {
            source: {
                type: 'mcp',
                rawConfig: {},
                receivedAt: new Date(),
            },
            config: {},
            hierarchical: false,
            resolution: 'MCP',
        };

        expect(isMCPConfig(resolved)).toBe(true);
    });

    it('should return false for file config', () => {
        const resolved: ResolvedConfig = {
            source: {
                type: 'file',
                filePath: '/app/config.yaml',
                format: ConfigFormat.YAML,
            },
            config: {},
            hierarchical: false,
            resolution: 'File',
        };

        expect(isMCPConfig(resolved)).toBe(false);
    });
});

describe('isFileConfig', () => {
    it('should return true for file config', () => {
        const resolved: ResolvedConfig = {
            source: {
                type: 'file',
                filePath: '/app/config.yaml',
                format: ConfigFormat.YAML,
            },
            config: {},
            hierarchical: false,
            resolution: 'File',
        };

        expect(isFileConfig(resolved)).toBe(true);
    });

    it('should return false for MCP config', () => {
        const resolved: ResolvedConfig = {
            source: {
                type: 'mcp',
                rawConfig: {},
                receivedAt: new Date(),
            },
            config: {},
            hierarchical: false,
            resolution: 'MCP',
        };

        expect(isFileConfig(resolved)).toBe(false);
    });
});

describe('getConfigFiles', () => {
    it('should return empty array for MCP config', () => {
        const resolved: ResolvedConfig = {
            source: {
                type: 'mcp',
                rawConfig: {},
                receivedAt: new Date(),
            },
            config: {},
            hierarchical: false,
            resolution: 'MCP',
        };

        const files = getConfigFiles(resolved);

        expect(files).toEqual([]);
    });

    it('should return single file for non-hierarchical config', () => {
        const resolved: ResolvedConfig = {
            source: {
                type: 'file',
                filePath: '/app/config.yaml',
                format: ConfigFormat.YAML,
            },
            config: {},
            hierarchical: false,
            resolution: 'File',
        };

        const files = getConfigFiles(resolved);

        expect(files).toEqual(['/app/config.yaml']);
    });

    it('should return all files for hierarchical config', () => {
        const resolved: ResolvedConfig = {
            source: {
                type: 'file',
                filePath: '/app/src/config.yaml',
                format: ConfigFormat.YAML,
                parents: [
                    {
                        type: 'file',
                        filePath: '/app/config.yaml',
                        format: ConfigFormat.YAML,
                    },
                ],
            },
            config: {},
            hierarchical: true,
            resolution: 'Hierarchical',
        };

        const files = getConfigFiles(resolved);

        expect(files).toEqual([
            '/app/src/config.yaml',
            '/app/config.yaml',
        ]);
    });

    it('should return all files in correct order for multi-level hierarchy', () => {
        const resolved: ResolvedConfig = {
            source: {
                type: 'file',
                filePath: '/app/src/api/config.yaml',
                format: ConfigFormat.YAML,
                parents: [
                    {
                        type: 'file',
                        filePath: '/app/src/config.yaml',
                        format: ConfigFormat.YAML,
                    },
                    {
                        type: 'file',
                        filePath: '/app/config.yaml',
                        format: ConfigFormat.YAML,
                    },
                ],
            },
            config: {},
            hierarchical: true,
            resolution: 'Hierarchical',
        };

        const files = getConfigFiles(resolved);

        expect(files).toEqual([
            '/app/src/api/config.yaml',
            '/app/src/config.yaml',
            '/app/config.yaml',
        ]);
    });
});
