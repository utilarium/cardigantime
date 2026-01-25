import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    discoverWithMode,
    resolveHierarchicalOptions,
    getHierarchicalModeOverride,
    getHierarchicalOptionsFromConfig,
} from '../../src/discovery/hierarchical-modes';
import { HierarchicalOptions, Logger, DEFAULT_ROOT_MARKERS } from '../../src/types';

describe('discovery/hierarchical-modes', () => {
    let tempDir: string;
    let mockLogger: Logger;
    let logCalls: { level: string; message: string }[];

    beforeEach(async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cardigantime-modes-test-'));
        
        logCalls = [];
        mockLogger = {
            debug: (msg: string) => logCalls.push({ level: 'debug', message: msg }),
            info: (msg: string) => logCalls.push({ level: 'info', message: msg }),
            warn: (msg: string) => logCalls.push({ level: 'warn', message: msg }),
            error: (msg: string) => logCalls.push({ level: 'error', message: msg }),
            verbose: (msg: string) => logCalls.push({ level: 'verbose', message: msg }),
            silly: (msg: string) => logCalls.push({ level: 'silly', message: msg }),
        };
    });

    afterEach(async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    async function createFile(relativePath: string, content: string = 'test: value'): Promise<string> {
        const fullPath = path.join(tempDir, relativePath);
        const dir = path.dirname(fullPath);
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(fullPath, content);
        return fullPath;
    }

    async function createDir(relativePath: string): Promise<string> {
        const fullPath = path.join(tempDir, relativePath);
        await fs.promises.mkdir(fullPath, { recursive: true });
        return fullPath;
    }

    describe('resolveHierarchicalOptions', () => {
        it('should return defaults when no options provided', () => {
            const result = resolveHierarchicalOptions();
            
            expect(result.mode).toBe('enabled');
            expect(result.maxDepth).toBe(10);
            expect(result.stopAt).toEqual([]);
            expect(result.rootMarkers).toEqual(DEFAULT_ROOT_MARKERS);
            expect(result.stopAtRoot).toBe(true);
        });

        it('should merge provided options with defaults', () => {
            const result = resolveHierarchicalOptions({
                mode: 'disabled',
                maxDepth: 5,
            });
            
            expect(result.mode).toBe('disabled');
            expect(result.maxDepth).toBe(5);
            expect(result.stopAt).toEqual([]); // default
            expect(result.rootMarkers).toEqual(DEFAULT_ROOT_MARKERS); // default
        });

        it('should allow empty rootMarkers', () => {
            const result = resolveHierarchicalOptions({
                rootMarkers: [],
            });
            
            expect(result.rootMarkers).toEqual([]);
        });
    });

    describe('discoverWithMode', () => {
        describe('disabled mode', () => {
            it('should only search starting directory', async () => {
                // Create configs at multiple levels
                await createFile('myapp.config.yaml');
                await createFile('sub/myapp.config.yaml');
                const subDir = path.join(tempDir, 'sub');
                
                const result = await discoverWithMode(
                    subDir,
                    { appName: 'myapp', extensions: ['yaml'] },
                    { mode: 'disabled' },
                    mockLogger
                );
                
                expect(result.mode).toBe('disabled');
                expect(result.searchedDirectories).toHaveLength(1);
                expect(result.searchedDirectories[0]).toBe(subDir);
                expect(result.configs).toHaveLength(1);
                expect(result.shouldMerge).toBe(false);
            });

            it('should return null when no config in starting directory', async () => {
                await createFile('myapp.config.yaml'); // at root, not in sub
                const subDir = await createDir('sub');
                
                const result = await discoverWithMode(
                    subDir,
                    { appName: 'myapp', extensions: ['yaml'] },
                    { mode: 'disabled' }
                );
                
                expect(result.primaryConfig).toBeNull();
                expect(result.configs).toHaveLength(0);
            });
        });

        describe('root-only mode', () => {
            it('should find first config without merging', async () => {
                await createFile('package.json', '{}'); // root marker
                await createFile('myapp.config.yaml');
                await createFile('sub/myapp.config.yaml');
                const subDir = path.join(tempDir, 'sub');
                
                const result = await discoverWithMode(
                    subDir,
                    { appName: 'myapp', extensions: ['yaml'] },
                    { mode: 'root-only' },
                    mockLogger
                );
                
                expect(result.mode).toBe('root-only');
                expect(result.configs).toHaveLength(1);
                expect(result.primaryConfig?.absolutePath).toContain('sub');
                expect(result.shouldMerge).toBe(false);
            });

            it('should walk up to find config', async () => {
                await createFile('package.json', '{}');
                await createFile('myapp.config.yaml'); // only at root
                const subDir = await createDir('deep/nested');
                
                const result = await discoverWithMode(
                    subDir,
                    { appName: 'myapp', extensions: ['yaml'] },
                    { mode: 'root-only' }
                );
                
                expect(result.primaryConfig).not.toBeNull();
                expect(result.primaryConfig?.absolutePath).toBe(path.join(tempDir, 'myapp.config.yaml'));
            });
        });

        describe('enabled mode', () => {
            it('should find all configs in hierarchy', async () => {
                await createFile('package.json', '{}');
                await createFile('myapp.config.yaml');
                await createFile('sub/myapp.config.yaml');
                const subDir = path.join(tempDir, 'sub');
                
                const result = await discoverWithMode(
                    subDir,
                    { appName: 'myapp', extensions: ['yaml'] },
                    { mode: 'enabled' },
                    mockLogger
                );
                
                expect(result.mode).toBe('enabled');
                expect(result.configs).toHaveLength(2);
                expect(result.shouldMerge).toBe(true);
            });

            it('should set shouldMerge to false when only one config', async () => {
                await createFile('package.json', '{}');
                await createFile('myapp.config.yaml');
                const subDir = await createDir('sub');
                
                const result = await discoverWithMode(
                    subDir,
                    { appName: 'myapp', extensions: ['yaml'] },
                    { mode: 'enabled' }
                );
                
                expect(result.configs).toHaveLength(1);
                expect(result.shouldMerge).toBe(false);
            });

            it('should respect maxDepth', async () => {
                await createFile('myapp.config.yaml'); // too far up
                await createFile('a/b/c/myapp.config.yaml');
                const startDir = path.join(tempDir, 'a/b/c');
                
                const result = await discoverWithMode(
                    startDir,
                    { appName: 'myapp', extensions: ['yaml'] },
                    { mode: 'enabled', maxDepth: 1, rootMarkers: [] }
                );
                
                // Should only find config at a/b/c, not at root
                expect(result.configs).toHaveLength(1);
            });

            it('should stop at root markers', async () => {
                await createFile('myapp.config.yaml'); // above root
                await createFile('project/package.json', '{}'); // root marker
                await createFile('project/myapp.config.yaml');
                await createFile('project/sub/myapp.config.yaml');
                const startDir = path.join(tempDir, 'project/sub');
                
                const result = await discoverWithMode(
                    startDir,
                    { appName: 'myapp', extensions: ['yaml'] },
                    { mode: 'enabled', stopAtRoot: true }
                );
                
                // Should find configs in sub and project, but not above project
                expect(result.configs).toHaveLength(2);
                expect(result.configs.every(c => c.absolutePath.includes('project'))).toBe(true);
            });

            it('should stop at stopAt directories', async () => {
                await createFile('myapp.config.yaml');
                await createFile('node_modules/pkg/myapp.config.yaml');
                const startDir = path.join(tempDir, 'node_modules/pkg');
                
                const result = await discoverWithMode(
                    startDir,
                    { appName: 'myapp', extensions: ['yaml'] },
                    { mode: 'enabled', stopAt: ['node_modules'], rootMarkers: [] }
                );
                
                // Should only find config in pkg, stop before node_modules
                expect(result.configs).toHaveLength(1);
            });
        });

        describe('explicit mode', () => {
            it('should only search starting directory', async () => {
                await createFile('myapp.config.yaml');
                await createFile('sub/myapp.config.yaml');
                const subDir = path.join(tempDir, 'sub');
                
                const result = await discoverWithMode(
                    subDir,
                    { appName: 'myapp', extensions: ['yaml'] },
                    { mode: 'explicit' }
                );
                
                expect(result.mode).toBe('explicit');
                expect(result.searchedDirectories).toHaveLength(1);
                expect(result.configs).toHaveLength(1);
                expect(result.shouldMerge).toBe(false);
            });
        });

        describe('default mode', () => {
            it('should default to enabled mode', async () => {
                await createFile('package.json', '{}');
                await createFile('myapp.config.yaml');
                
                const result = await discoverWithMode(
                    tempDir,
                    { appName: 'myapp', extensions: ['yaml'] }
                    // No hierarchical options provided
                );
                
                expect(result.mode).toBe('enabled');
            });
        });
    });

    describe('getHierarchicalModeOverride', () => {
        it('should return mode from config', () => {
            const config = {
                hierarchical: {
                    mode: 'disabled',
                },
            };
            
            expect(getHierarchicalModeOverride(config)).toBe('disabled');
        });

        it('should return undefined for invalid mode', () => {
            const config = {
                hierarchical: {
                    mode: 'invalid',
                },
            };
            
            expect(getHierarchicalModeOverride(config)).toBeUndefined();
        });

        it('should return undefined when no hierarchical config', () => {
            expect(getHierarchicalModeOverride({})).toBeUndefined();
            expect(getHierarchicalModeOverride(null)).toBeUndefined();
            expect(getHierarchicalModeOverride(undefined)).toBeUndefined();
        });

        it('should handle all valid modes', () => {
            expect(getHierarchicalModeOverride({ hierarchical: { mode: 'enabled' } })).toBe('enabled');
            expect(getHierarchicalModeOverride({ hierarchical: { mode: 'disabled' } })).toBe('disabled');
            expect(getHierarchicalModeOverride({ hierarchical: { mode: 'root-only' } })).toBe('root-only');
            expect(getHierarchicalModeOverride({ hierarchical: { mode: 'explicit' } })).toBe('explicit');
        });
    });

    describe('getHierarchicalOptionsFromConfig', () => {
        it('should extract all hierarchical options', () => {
            const config = {
                hierarchical: {
                    mode: 'disabled',
                    maxDepth: 5,
                    stopAt: ['node_modules', 'vendor'],
                    stopAtRoot: false,
                },
            };
            
            const result = getHierarchicalOptionsFromConfig(config);
            
            expect(result).toBeDefined();
            expect(result?.mode).toBe('disabled');
            expect(result?.maxDepth).toBe(5);
            expect(result?.stopAt).toEqual(['node_modules', 'vendor']);
            expect(result?.stopAtRoot).toBe(false);
        });

        it('should return undefined when no hierarchical config', () => {
            expect(getHierarchicalOptionsFromConfig({})).toBeUndefined();
            expect(getHierarchicalOptionsFromConfig(null)).toBeUndefined();
        });

        it('should only include valid options', () => {
            const config = {
                hierarchical: {
                    mode: 'disabled',
                    unknownOption: 'value',
                },
            };
            
            const result = getHierarchicalOptionsFromConfig(config);
            
            expect(result).toBeDefined();
            expect(result?.mode).toBe('disabled');
            expect((result as any)?.unknownOption).toBeUndefined();
        });

        it('should filter non-string items from stopAt', () => {
            const config = {
                hierarchical: {
                    stopAt: ['node_modules', 123, 'vendor', null],
                },
            };
            
            const result = getHierarchicalOptionsFromConfig(config);
            
            expect(result?.stopAt).toEqual(['node_modules', 'vendor']);
        });
    });
});
