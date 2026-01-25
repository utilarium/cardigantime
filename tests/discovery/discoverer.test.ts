import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    discoverConfig,
    discoverConfigsInHierarchy,
    hasConfigFile,
} from '../../src/discovery/discoverer';
import { STANDARD_PATTERNS } from '../../src/discovery/patterns';
import { ConfigNamingPattern, Logger } from '../../src/types';

describe('discovery/discoverer', () => {
    let tempDir: string;
    let mockLogger: Logger;
    let logCalls: { level: string; message: string }[];

    beforeEach(async () => {
        // Create a unique temp directory for each test
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cardigantime-test-'));
        
        // Create mock logger that captures calls
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
        // Clean up temp directory
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    async function createFile(relativePath: string, content: string = 'test: value'): Promise<string> {
        const fullPath = path.join(tempDir, relativePath);
        const dir = path.dirname(fullPath);
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(fullPath, content);
        return fullPath;
    }

    describe('discoverConfig', () => {
        describe('single pattern match', () => {
            it('should find app.config.yaml', async () => {
                await createFile('myapp.config.yaml');

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                });

                expect(result.config).not.toBeNull();
                expect(result.config?.path).toBe('myapp.config.yaml');
                expect(result.config?.pattern.pattern).toBe('{app}.config.{ext}');
            });

            it('should find app.conf.json', async () => {
                await createFile('myapp.conf.json', '{}');

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['json'],
                });

                expect(result.config).not.toBeNull();
                expect(result.config?.path).toBe('myapp.conf.json');
            });

            it('should find .app/config.yaml (directory pattern)', async () => {
                await createFile('.myapp/config.yaml');

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                });

                expect(result.config).not.toBeNull();
                expect(result.config?.path).toBe('.myapp/config.yaml');
                expect(result.config?.pattern.hidden).toBe(true);
            });

            it('should find .apprc (no extension pattern)', async () => {
                await createFile('.myapprc', 'key: value');

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                });

                expect(result.config).not.toBeNull();
                expect(result.config?.path).toBe('.myapprc');
            });

            it('should find .apprc.yaml', async () => {
                await createFile('.myapprc.yaml');

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                });

                expect(result.config).not.toBeNull();
                expect(result.config?.path).toBe('.myapprc.yaml');
            });
        });

        describe('priority order', () => {
            it('should return highest priority match when multiple exist', async () => {
                // Create multiple configs with different priorities
                await createFile('myapp.config.yaml'); // priority 1
                await createFile('myapp.conf.yaml');   // priority 2
                await createFile('.myapp/config.yaml'); // priority 3

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                });

                expect(result.config?.path).toBe('myapp.config.yaml');
                expect(result.config?.pattern.priority).toBe(1);
            });

            it('should return priority 2 if priority 1 is missing', async () => {
                await createFile('myapp.conf.yaml');    // priority 2
                await createFile('.myapp/config.yaml'); // priority 3

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                });

                expect(result.config?.path).toBe('myapp.conf.yaml');
            });

            it('should respect extension order within same pattern', async () => {
                // Create both ts and yaml configs
                await createFile('myapp.config.ts', 'export default {}');
                await createFile('myapp.config.yaml');

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['ts', 'yaml'], // ts comes first
                });

                expect(result.config?.path).toBe('myapp.config.ts');
            });
        });

        describe('no match found', () => {
            it('should return null config when no files exist', async () => {
                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                });

                expect(result.config).toBeNull();
                expect(result.multipleConfigWarning).toBeUndefined();
            });

            it('should return null when only wrong app name configs exist', async () => {
                await createFile('otherapp.config.yaml');

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                });

                expect(result.config).toBeNull();
            });
        });

        describe('hidden files', () => {
            it('should exclude hidden patterns when searchHidden is false', async () => {
                await createFile('.myapp/config.yaml'); // hidden pattern

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                    searchHidden: false,
                });

                expect(result.config).toBeNull();
            });

            it('should include hidden patterns by default', async () => {
                await createFile('.myapp/config.yaml');

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                });

                expect(result.config).not.toBeNull();
                expect(result.config?.path).toBe('.myapp/config.yaml');
            });

            it('should prefer visible configs over hidden when both exist', async () => {
                await createFile('myapp.config.yaml'); // visible, priority 1
                await createFile('.myapp/config.yaml'); // hidden, priority 3

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                });

                expect(result.config?.path).toBe('myapp.config.yaml');
                expect(result.config?.pattern.hidden).toBe(false);
            });
        });

        describe('multiple configs warning', () => {
            it('should emit warning when multiple configs exist', async () => {
                await createFile('myapp.config.yaml'); // will be used
                await createFile('myapp.conf.yaml');   // will be ignored

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                    warnOnMultipleConfigs: true,
                }, mockLogger);

                expect(result.multipleConfigWarning).toBeDefined();
                expect(result.multipleConfigWarning?.used.path).toBe('myapp.config.yaml');
                expect(result.multipleConfigWarning?.ignored).toHaveLength(1);
                expect(result.multipleConfigWarning?.ignored[0].path).toBe('myapp.conf.yaml');

                // Check warn was called
                const warnCalls = logCalls.filter(c => c.level === 'warn');
                expect(warnCalls.length).toBeGreaterThan(0);
                expect(warnCalls[0].message).toContain('Multiple config files found');
                expect(warnCalls[0].message).toContain('myapp.config.yaml');
                expect(warnCalls[0].message).toContain('myapp.conf.yaml');
            });

            it('should include all ignored configs in warning', async () => {
                await createFile('myapp.config.yaml');  // priority 1
                await createFile('myapp.conf.yaml');    // priority 2
                await createFile('.myapp/config.yaml'); // priority 3

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                });

                expect(result.multipleConfigWarning?.ignored).toHaveLength(2);
                const ignoredPaths = result.multipleConfigWarning?.ignored.map(c => c.path);
                expect(ignoredPaths).toContain('myapp.conf.yaml');
                expect(ignoredPaths).toContain('.myapp/config.yaml');
            });

            it('should not emit warning when only one config exists', async () => {
                await createFile('myapp.config.yaml');

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                }, mockLogger);

                expect(result.multipleConfigWarning).toBeUndefined();

                const warnCalls = logCalls.filter(c => c.level === 'warn');
                expect(warnCalls).toHaveLength(0);
            });

            it('should not check for multiple configs when disabled', async () => {
                await createFile('myapp.config.yaml');
                await createFile('myapp.conf.yaml');

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                    warnOnMultipleConfigs: false,
                }, mockLogger);

                // Should find the first config
                expect(result.config?.path).toBe('myapp.config.yaml');
                // But no warning
                expect(result.multipleConfigWarning).toBeUndefined();

                const warnCalls = logCalls.filter(c => c.level === 'warn');
                expect(warnCalls).toHaveLength(0);
            });
        });

        describe('custom patterns', () => {
            it('should use custom patterns when provided', async () => {
                await createFile('custom-myapp.yaml');

                const customPatterns: ConfigNamingPattern[] = [
                    { pattern: 'custom-{app}.{ext}', priority: 1, hidden: false },
                ];

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                    patterns: customPatterns,
                });

                expect(result.config?.path).toBe('custom-myapp.yaml');
            });

            it('should ignore standard patterns when custom patterns provided', async () => {
                await createFile('myapp.config.yaml'); // standard pattern
                await createFile('special-myapp.yaml'); // custom pattern

                const customPatterns: ConfigNamingPattern[] = [
                    { pattern: 'special-{app}.{ext}', priority: 1, hidden: false },
                ];

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                    patterns: customPatterns,
                });

                expect(result.config?.path).toBe('special-myapp.yaml');
            });
        });

        describe('logging', () => {
            it('should log discovery process at debug level', async () => {
                await createFile('myapp.config.yaml');

                await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                }, mockLogger);

                const debugCalls = logCalls.filter(c => c.level === 'debug');
                expect(debugCalls.length).toBeGreaterThan(0);
                expect(debugCalls.some(c => c.message.includes('Starting config discovery'))).toBe(true);
            });

            it('should log found config at info level', async () => {
                await createFile('myapp.config.yaml');

                await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                }, mockLogger);

                const infoCalls = logCalls.filter(c => c.level === 'info');
                expect(infoCalls.length).toBeGreaterThan(0);
                expect(infoCalls.some(c => c.message.includes('Found config'))).toBe(true);
            });

            it('should log "no config found" at debug level when none exists', async () => {
                await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                }, mockLogger);

                const debugCalls = logCalls.filter(c => c.level === 'debug');
                expect(debugCalls.some(c => c.message.includes('No config file found'))).toBe(true);
            });
        });

        describe('absolute paths', () => {
            it('should include absolute path in result', async () => {
                const expectedPath = await createFile('myapp.config.yaml');

                const result = await discoverConfig(tempDir, {
                    appName: 'myapp',
                    extensions: ['yaml'],
                });

                expect(result.config?.absolutePath).toBe(expectedPath);
            });
        });
    });

    describe('discoverConfigsInHierarchy', () => {
        let subDir: string;
        let parentDir: string;

        beforeEach(async () => {
            subDir = path.join(tempDir, 'project', 'src');
            parentDir = path.join(tempDir, 'project');
            await fs.promises.mkdir(subDir, { recursive: true });
        });

        it('should discover configs in multiple directories', async () => {
            await createFile('project/src/myapp.config.yaml');
            await createFile('project/myapp.config.yaml');

            const results = await discoverConfigsInHierarchy(
                [subDir, parentDir],
                { appName: 'myapp', extensions: ['yaml'] }
            );

            expect(results).toHaveLength(2);
            expect(results[0].config?.absolutePath).toContain('src');
            expect(results[1].config?.absolutePath).not.toContain('src');
        });

        it('should only return directories with configs', async () => {
            await createFile('project/myapp.config.yaml');
            // No config in subDir

            const results = await discoverConfigsInHierarchy(
                [subDir, parentDir],
                { appName: 'myapp', extensions: ['yaml'] }
            );

            expect(results).toHaveLength(1);
            expect(results[0].config?.absolutePath).toContain('project');
            expect(results[0].config?.absolutePath).not.toContain('src');
        });

        it('should preserve directory order', async () => {
            await createFile('project/src/myapp.config.yaml');
            await createFile('project/myapp.config.yaml');

            const results = await discoverConfigsInHierarchy(
                [subDir, parentDir],
                { appName: 'myapp', extensions: ['yaml'] }
            );

            // First result should be from subDir (first in the list)
            expect(results[0].config?.absolutePath).toContain('src');
        });

        it('should return empty array when no configs found', async () => {
            const results = await discoverConfigsInHierarchy(
                [subDir, parentDir],
                { appName: 'myapp', extensions: ['yaml'] }
            );

            expect(results).toHaveLength(0);
        });
    });

    describe('hasConfigFile', () => {
        it('should return true when config exists', async () => {
            await createFile('myapp.config.yaml');

            const result = await hasConfigFile(tempDir, {
                appName: 'myapp',
                extensions: ['yaml'],
            });

            expect(result).toBe(true);
        });

        it('should return false when no config exists', async () => {
            const result = await hasConfigFile(tempDir, {
                appName: 'myapp',
                extensions: ['yaml'],
            });

            expect(result).toBe(false);
        });

        it('should respect searchHidden option', async () => {
            await createFile('.myapp/config.yaml');

            const withHidden = await hasConfigFile(tempDir, {
                appName: 'myapp',
                extensions: ['yaml'],
                searchHidden: true,
            });

            const withoutHidden = await hasConfigFile(tempDir, {
                appName: 'myapp',
                extensions: ['yaml'],
                searchHidden: false,
            });

            expect(withHidden).toBe(true);
            expect(withoutHidden).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('should handle empty extensions array', async () => {
            await createFile('.myapprc');

            const result = await discoverConfig(tempDir, {
                appName: 'myapp',
                extensions: [], // Only patterns without {ext} will match
            });

            // .myapprc pattern doesn't need extension
            expect(result.config?.path).toBe('.myapprc');
        });

        it('should handle app names with special characters', async () => {
            await createFile('my-app.config.yaml');

            const result = await discoverConfig(tempDir, {
                appName: 'my-app',
                extensions: ['yaml'],
            });

            expect(result.config?.path).toBe('my-app.config.yaml');
        });

        it('should not match directories as files', async () => {
            // Create a directory with the config name (not a file)
            await fs.promises.mkdir(path.join(tempDir, 'myapp.config.yaml'), { recursive: true });

            const result = await discoverConfig(tempDir, {
                appName: 'myapp',
                extensions: ['yaml'],
            });

            expect(result.config).toBeNull();
        });

        it('should handle non-existent directory', async () => {
            const result = await discoverConfig('/nonexistent/path', {
                appName: 'myapp',
                extensions: ['yaml'],
            });

            expect(result.config).toBeNull();
        });
    });
});
