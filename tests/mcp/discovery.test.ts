import { describe, it, expect, vi } from 'vitest';
import {
    discoverFromTargetFile,
    discoverFromWorkingDirectory,
    createFileDiscovery,
    logDiscovery,
} from '../../src/mcp/discovery';
import { Cardigantime } from '../../src/types';

describe('discoverFromTargetFile', () => {
    it('should discover config from target file directory', async () => {
        const mockCardigantime = {
            read: vi.fn().mockResolvedValue({
                resolvedConfigDirs: ['/app/src'],
                configDirectory: '/app/src',
                discoveredConfigDirs: ['/app/src', '/app'],
            }),
        } as unknown as Cardigantime<any>;

        const result = await discoverFromTargetFile(
            '/app/src/handler.ts',
            { cardigantime: mockCardigantime }
        );

        expect(result).toBeDefined();
        expect(result?.type).toBe('file');
        expect(mockCardigantime.read).toHaveBeenCalledWith(
            expect.objectContaining({
                configDirectory: '/app/src',
            })
        );
    });

    it('should return null when no config found', async () => {
        const mockCardigantime = {
            read: vi.fn().mockResolvedValue({
                resolvedConfigDirs: [],
                configDirectory: '/app/src',
                discoveredConfigDirs: [],
            }),
        } as unknown as Cardigantime<any>;

        const result = await discoverFromTargetFile(
            '/app/src/handler.ts',
            { cardigantime: mockCardigantime }
        );

        expect(result).toBeNull();
    });

    it('should return null on error', async () => {
        const mockCardigantime = {
            read: vi.fn().mockRejectedValue(new Error('Config not found')),
        } as unknown as Cardigantime<any>;

        const result = await discoverFromTargetFile(
            '/app/src/handler.ts',
            { cardigantime: mockCardigantime }
        );

        expect(result).toBeNull();
    });

    it('should pass additional args to read', async () => {
        const mockCardigantime = {
            read: vi.fn().mockResolvedValue({
                resolvedConfigDirs: ['/app'],
                configDirectory: '/app',
                discoveredConfigDirs: ['/app'],
            }),
        } as unknown as Cardigantime<any>;

        await discoverFromTargetFile(
            '/app/handler.ts',
            {
                cardigantime: mockCardigantime,
                args: { verbose: true },
            }
        );

        expect(mockCardigantime.read).toHaveBeenCalledWith(
            expect.objectContaining({
                verbose: true,
                configDirectory: '/app',
            })
        );
    });
});

describe('discoverFromWorkingDirectory', () => {
    it('should discover config from working directory', async () => {
        const mockCardigantime = {
            read: vi.fn().mockResolvedValue({
                resolvedConfigDirs: ['/app'],
                configDirectory: '/app',
                discoveredConfigDirs: ['/app'],
            }),
        } as unknown as Cardigantime<any>;

        const result = await discoverFromWorkingDirectory(
            '/app',
            { cardigantime: mockCardigantime }
        );

        expect(result).toBeDefined();
        expect(result?.type).toBe('file');
        expect(mockCardigantime.read).toHaveBeenCalledWith(
            expect.objectContaining({
                configDirectory: '/app',
            })
        );
    });

    it('should return null when no config found', async () => {
        const mockCardigantime = {
            read: vi.fn().mockResolvedValue({
                resolvedConfigDirs: [],
                configDirectory: '/app',
                discoveredConfigDirs: [],
            }),
        } as unknown as Cardigantime<any>;

        const result = await discoverFromWorkingDirectory(
            '/app',
            { cardigantime: mockCardigantime }
        );

        expect(result).toBeNull();
    });

    it('should return null on error', async () => {
        const mockCardigantime = {
            read: vi.fn().mockRejectedValue(new Error('Config not found')),
        } as unknown as Cardigantime<any>;

        const result = await discoverFromWorkingDirectory(
            '/app',
            { cardigantime: mockCardigantime }
        );

        expect(result).toBeNull();
    });

    it('should pass additional args to read', async () => {
        const mockCardigantime = {
            read: vi.fn().mockResolvedValue({
                resolvedConfigDirs: ['/app'],
                configDirectory: '/app',
                discoveredConfigDirs: ['/app'],
            }),
        } as unknown as Cardigantime<any>;

        await discoverFromWorkingDirectory(
            '/app',
            {
                cardigantime: mockCardigantime,
                args: { debug: true },
            }
        );

        expect(mockCardigantime.read).toHaveBeenCalledWith(
            expect.objectContaining({
                debug: true,
                configDirectory: '/app',
            })
        );
    });
});

describe('createFileDiscovery', () => {
    it('should create a discovery function', () => {
        const mockCardigantime = {
            read: vi.fn(),
        } as unknown as Cardigantime<any>;

        const discovery = createFileDiscovery({
            cardigantime: mockCardigantime,
        });

        expect(typeof discovery).toBe('function');
    });

    it('should try target file first when provided', async () => {
        const mockCardigantime = {
            read: vi.fn().mockResolvedValue({
                resolvedConfigDirs: ['/app/src'],
                configDirectory: '/app/src',
                discoveredConfigDirs: ['/app/src'],
            }),
        } as unknown as Cardigantime<any>;

        const discovery = createFileDiscovery({
            cardigantime: mockCardigantime,
        });

        const result = await discovery('/app', '/app/src/handler.ts');

        expect(result).toBeDefined();
        expect(mockCardigantime.read).toHaveBeenCalledWith(
            expect.objectContaining({
                configDirectory: '/app/src',
            })
        );
    });

    it('should fall back to working directory when target file has no config', async () => {
        const mockCardigantime = {
            read: vi.fn()
                .mockResolvedValueOnce({
                    // First call (target file) - no config
                    resolvedConfigDirs: [],
                    configDirectory: '/app/src',
                    discoveredConfigDirs: [],
                })
                .mockResolvedValueOnce({
                    // Second call (working dir) - has config
                    resolvedConfigDirs: ['/app'],
                    configDirectory: '/app',
                    discoveredConfigDirs: ['/app'],
                }),
        } as unknown as Cardigantime<any>;

        const discovery = createFileDiscovery({
            cardigantime: mockCardigantime,
        });

        const result = await discovery('/app', '/app/src/handler.ts');

        expect(result).toBeDefined();
        expect(mockCardigantime.read).toHaveBeenCalledTimes(2);
    });

    it('should use working directory when no target file provided', async () => {
        const mockCardigantime = {
            read: vi.fn().mockResolvedValue({
                resolvedConfigDirs: ['/app'],
                configDirectory: '/app',
                discoveredConfigDirs: ['/app'],
            }),
        } as unknown as Cardigantime<any>;

        const discovery = createFileDiscovery({
            cardigantime: mockCardigantime,
        });

        const result = await discovery('/app');

        expect(result).toBeDefined();
        expect(mockCardigantime.read).toHaveBeenCalledWith(
            expect.objectContaining({
                configDirectory: '/app',
            })
        );
    });

    it('should return null when no config found anywhere', async () => {
        const mockCardigantime = {
            read: vi.fn().mockResolvedValue({
                resolvedConfigDirs: [],
                configDirectory: '/app',
                discoveredConfigDirs: [],
            }),
        } as unknown as Cardigantime<any>;

        const discovery = createFileDiscovery({
            cardigantime: mockCardigantime,
        });

        const result = await discovery('/app', '/app/src/handler.ts');

        expect(result).toBeNull();
    });
});

describe('logDiscovery', () => {
    it('should log when DEBUG is set', () => {
        const originalDebug = process.env.DEBUG;
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        try {
            process.env.DEBUG = '1';

            logDiscovery('Test message', { foo: 'bar' });

            expect(consoleSpy).toHaveBeenCalledWith(
                '[MCP Discovery] Test message',
                { foo: 'bar' }
            );
        } finally {
            if (originalDebug !== undefined) {
                process.env.DEBUG = originalDebug;
            } else {
                delete process.env.DEBUG;
            }
            consoleSpy.mockRestore();
        }
    });

    it('should not log when DEBUG is not set', () => {
        const originalDebug = process.env.DEBUG;
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        try {
            delete process.env.DEBUG;

            logDiscovery('Test message');

            expect(consoleSpy).not.toHaveBeenCalled();
        } finally {
            if (originalDebug !== undefined) {
                process.env.DEBUG = originalDebug;
            }
            consoleSpy.mockRestore();
        }
    });

    it('should handle missing details', () => {
        const originalDebug = process.env.DEBUG;
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        try {
            process.env.DEBUG = '1';

            logDiscovery('Test message');

            expect(consoleSpy).toHaveBeenCalledWith(
                '[MCP Discovery] Test message',
                ''
            );
        } finally {
            if (originalDebug !== undefined) {
                process.env.DEBUG = originalDebug;
            } else {
                delete process.env.DEBUG;
            }
            consoleSpy.mockRestore();
        }
    });
});
