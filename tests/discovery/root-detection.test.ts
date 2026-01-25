import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    isProjectRoot,
    findProjectRoot,
    shouldStopAt,
    walkUpToRoot,
    getDirectoriesToRoot,
} from '../../src/discovery/root-detection';
import { RootMarker, DEFAULT_ROOT_MARKERS, Logger } from '../../src/types';

describe('discovery/root-detection', () => {
    let tempDir: string;
    let mockLogger: Logger;
    let logCalls: { level: string; message: string }[];

    beforeEach(async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cardigantime-root-test-'));
        
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

    async function createFile(relativePath: string, content: string = ''): Promise<string> {
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

    describe('isProjectRoot', () => {
        it('should detect package.json as root marker', async () => {
            await createFile('package.json', '{}');
            
            const result = await isProjectRoot(tempDir);
            expect(result).toBe(true);
        });

        it('should detect .git directory as root marker', async () => {
            await createDir('.git');
            
            const result = await isProjectRoot(tempDir);
            expect(result).toBe(true);
        });

        it('should return false when no markers exist', async () => {
            const result = await isProjectRoot(tempDir);
            expect(result).toBe(false);
        });

        it('should use custom markers', async () => {
            await createFile('custom-marker.txt');
            
            const customMarkers: RootMarker[] = [
                { type: 'file', name: 'custom-marker.txt' },
            ];
            
            const result = await isProjectRoot(tempDir, customMarkers);
            expect(result).toBe(true);
        });

        it('should distinguish between file and directory markers', async () => {
            // Create a file named 'marker'
            await createFile('marker', 'content');
            
            // Looking for a directory named 'marker' should fail
            const dirMarkers: RootMarker[] = [
                { type: 'directory', name: 'marker' },
            ];
            const dirResult = await isProjectRoot(tempDir, dirMarkers);
            expect(dirResult).toBe(false);
            
            // Looking for a file named 'marker' should succeed
            const fileMarkers: RootMarker[] = [
                { type: 'file', name: 'marker' },
            ];
            const fileResult = await isProjectRoot(tempDir, fileMarkers);
            expect(fileResult).toBe(true);
        });

        it('should return false for empty markers array', async () => {
            await createFile('package.json', '{}');
            
            const result = await isProjectRoot(tempDir, []);
            expect(result).toBe(false);
        });
    });

    describe('findProjectRoot', () => {
        it('should find project root with package.json', async () => {
            // Create nested structure
            await createFile('package.json', '{}');
            const subDir = await createDir('src/components');
            
            const result = await findProjectRoot(subDir);
            
            expect(result.found).toBe(true);
            expect(result.rootPath).toBe(tempDir);
            expect(result.matchedMarker?.name).toBe('package.json');
        });

        it('should find nearest root when multiple exist', async () => {
            // Create nested project structure
            await createFile('package.json', '{}'); // root level
            await createFile('packages/app/package.json', '{}'); // nested
            const deepDir = await createDir('packages/app/src');
            
            const result = await findProjectRoot(deepDir);
            
            expect(result.found).toBe(true);
            expect(result.rootPath).toBe(path.join(tempDir, 'packages/app'));
        });

        it('should return not found when no markers exist', async () => {
            const subDir = await createDir('deep/nested/dir');
            
            const result = await findProjectRoot(subDir, []);
            
            expect(result.found).toBe(false);
            expect(result.rootPath).toBeUndefined();
        });

        it('should respect maxDepth', async () => {
            await createFile('package.json', '{}');
            const deepDir = await createDir('a/b/c/d/e');
            
            // With maxDepth=2, shouldn't find root that's 5 levels up
            const result = await findProjectRoot(deepDir, DEFAULT_ROOT_MARKERS, 2);
            
            expect(result.found).toBe(false);
        });

        it('should use custom markers', async () => {
            await createFile('my-root-file.txt');
            const subDir = await createDir('sub');
            
            const customMarkers: RootMarker[] = [
                { type: 'file', name: 'my-root-file.txt' },
            ];
            
            const result = await findProjectRoot(subDir, customMarkers);
            
            expect(result.found).toBe(true);
            expect(result.rootPath).toBe(tempDir);
        });
    });

    describe('shouldStopAt', () => {
        it('should return true when directory name is in stop list', () => {
            expect(shouldStopAt('/path/to/node_modules', ['node_modules'])).toBe(true);
            expect(shouldStopAt('/path/to/vendor', ['node_modules', 'vendor'])).toBe(true);
        });

        it('should return false when directory name is not in stop list', () => {
            expect(shouldStopAt('/path/to/src', ['node_modules'])).toBe(false);
            expect(shouldStopAt('/path/to/project', ['node_modules', 'vendor'])).toBe(false);
        });

        it('should return false for empty stop list', () => {
            expect(shouldStopAt('/path/to/node_modules', [])).toBe(false);
        });

        it('should only check the basename, not full path', () => {
            // Even though 'node_modules' is in the path, the basename is 'pkg'
            expect(shouldStopAt('/path/to/node_modules/pkg', ['node_modules'])).toBe(false);
        });
    });

    describe('walkUpToRoot', () => {
        it('should yield directories up to root', async () => {
            await createFile('package.json', '{}');
            const deepDir = await createDir('src/components/Button');
            
            const dirs: string[] = [];
            for await (const dir of walkUpToRoot(deepDir, { rootMarkers: DEFAULT_ROOT_MARKERS })) {
                dirs.push(dir);
            }
            
            expect(dirs.length).toBe(4); // Button, components, src, tempDir
            expect(dirs[0]).toBe(deepDir);
            expect(dirs[dirs.length - 1]).toBe(tempDir);
        });

        it('should respect maxDepth', async () => {
            const deepDir = await createDir('a/b/c/d/e');
            
            const dirs: string[] = [];
            for await (const dir of walkUpToRoot(deepDir, { maxDepth: 2, rootMarkers: [] })) {
                dirs.push(dir);
            }
            
            expect(dirs.length).toBe(2);
        });

        it('should stop at directories in stopAt list', async () => {
            await createDir('project/node_modules/pkg/src');
            const startDir = path.join(tempDir, 'project/node_modules/pkg/src');
            
            const dirs: string[] = [];
            for await (const dir of walkUpToRoot(startDir, { 
                stopAt: ['node_modules'],
                rootMarkers: [],
            })) {
                dirs.push(dir);
            }
            
            // Should stop before reaching node_modules
            expect(dirs).not.toContain(path.join(tempDir, 'project/node_modules'));
            expect(dirs.length).toBe(2); // src and pkg
        });

        it('should stop at root markers when stopAtRoot is true', async () => {
            await createFile('package.json', '{}');
            const deepDir = await createDir('src/deep');
            
            const dirs: string[] = [];
            for await (const dir of walkUpToRoot(deepDir, {
                rootMarkers: DEFAULT_ROOT_MARKERS,
                stopAtRoot: true,
            })) {
                dirs.push(dir);
            }
            
            // Should include the root but stop there
            expect(dirs).toContain(tempDir);
            // Should not go beyond tempDir
            const lastDir = dirs[dirs.length - 1];
            expect(lastDir).toBe(tempDir);
        });
    });

    describe('getDirectoriesToRoot', () => {
        it('should return array of directories', async () => {
            await createFile('package.json', '{}');
            const subDir = await createDir('src');
            
            const dirs = await getDirectoriesToRoot(subDir, { rootMarkers: DEFAULT_ROOT_MARKERS });
            
            expect(Array.isArray(dirs)).toBe(true);
            expect(dirs.length).toBe(2);
            expect(dirs[0]).toBe(subDir);
            expect(dirs[1]).toBe(tempDir);
        });

        it('should return single directory when at root', async () => {
            await createFile('package.json', '{}');
            
            const dirs = await getDirectoriesToRoot(tempDir, { rootMarkers: DEFAULT_ROOT_MARKERS });
            
            expect(dirs.length).toBe(1);
            expect(dirs[0]).toBe(tempDir);
        });
    });
});
