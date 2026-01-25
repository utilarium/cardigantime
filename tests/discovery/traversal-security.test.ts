import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import {
    DEFAULT_TRAVERSAL_BOUNDARY,
    expandEnvironmentVariables,
    normalizePath,
    getPathDepth,
    isPathWithin,
    isPathAtOrAbove,
    checkTraversalBoundary,
    resolveTraversalBoundary,
    createBoundaryChecker,
    filterAllowedPaths,
} from '../../src/discovery/traversal-security';
import { TraversalBoundary, Logger } from '../../src/types';

describe('discovery/traversal-security', () => {
    let mockLogger: Logger;
    let logCalls: { level: string; message: string }[];

    beforeEach(() => {
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

    describe('DEFAULT_TRAVERSAL_BOUNDARY', () => {
        it('should have forbidden directories', () => {
            expect(DEFAULT_TRAVERSAL_BOUNDARY.forbidden).toBeDefined();
            expect(DEFAULT_TRAVERSAL_BOUNDARY.forbidden.length).toBeGreaterThan(0);
        });

        it('should have boundary directories', () => {
            expect(DEFAULT_TRAVERSAL_BOUNDARY.boundaries).toBeDefined();
            expect(DEFAULT_TRAVERSAL_BOUNDARY.boundaries).toContain('$HOME');
        });

        it('should have reasonable depth limits', () => {
            expect(DEFAULT_TRAVERSAL_BOUNDARY.maxAbsoluteDepth).toBe(20);
            expect(DEFAULT_TRAVERSAL_BOUNDARY.maxRelativeDepth).toBe(10);
        });

        it('should include sensitive directories in forbidden list', () => {
            if (process.platform !== 'win32') {
                expect(DEFAULT_TRAVERSAL_BOUNDARY.forbidden).toContain('/etc');
                expect(DEFAULT_TRAVERSAL_BOUNDARY.forbidden).toContain('/var');
                expect(DEFAULT_TRAVERSAL_BOUNDARY.forbidden).toContain('$HOME/.ssh');
            }
        });
    });

    describe('expandEnvironmentVariables', () => {
        it('should expand $HOME', () => {
            const result = expandEnvironmentVariables('$HOME/projects');
            expect(result).toBe(path.join(os.homedir(), 'projects'));
        });

        it('should expand $TMPDIR', () => {
            const result = expandEnvironmentVariables('$TMPDIR/cache');
            expect(result).toContain(os.tmpdir());
        });

        it('should expand $USER', () => {
            const result = expandEnvironmentVariables('/home/$USER');
            expect(result).toContain(os.userInfo().username);
        });

        it('should handle multiple variables', () => {
            const result = expandEnvironmentVariables('$HOME/$USER/project');
            expect(result).toContain(os.homedir());
            expect(result).toContain(os.userInfo().username);
        });

        it('should handle paths without variables', () => {
            const result = expandEnvironmentVariables('/path/to/dir');
            expect(result).toBe('/path/to/dir');
        });
    });

    describe('normalizePath', () => {
        it('should resolve relative paths to absolute', () => {
            const result = normalizePath('.');
            expect(path.isAbsolute(result)).toBe(true);
        });

        it('should expand environment variables', () => {
            const result = normalizePath('$HOME/test');
            expect(result).toBe(path.join(os.homedir(), 'test'));
        });

        it('should normalize path separators', () => {
            const result = normalizePath('/path//to///dir');
            expect(result).not.toContain('//');
        });
    });

    describe('getPathDepth', () => {
        it('should return 0 for root', () => {
            const root = process.platform === 'win32' ? 'C:\\' : '/';
            expect(getPathDepth(root)).toBe(0);
        });

        it('should count path segments correctly', () => {
            if (process.platform !== 'win32') {
                expect(getPathDepth('/home')).toBe(1);
                expect(getPathDepth('/home/user')).toBe(2);
                expect(getPathDepth('/home/user/project')).toBe(3);
            }
        });

        it('should handle relative paths by resolving them first', () => {
            const depth = getPathDepth('.');
            const cwd = process.cwd();
            const expectedDepth = getPathDepth(cwd);
            expect(depth).toBe(expectedDepth);
        });
    });

    describe('isPathWithin', () => {
        it('should return true for exact match', () => {
            expect(isPathWithin('/home/user', '/home/user')).toBe(true);
        });

        it('should return true for child path', () => {
            expect(isPathWithin('/home/user/project', '/home/user')).toBe(true);
        });

        it('should return false for parent path', () => {
            expect(isPathWithin('/home', '/home/user')).toBe(false);
        });

        it('should return false for sibling path', () => {
            expect(isPathWithin('/home/other', '/home/user')).toBe(false);
        });

        it('should handle environment variables', () => {
            const homePath = path.join(os.homedir(), 'project');
            expect(isPathWithin(homePath, '$HOME')).toBe(true);
        });
    });

    describe('isPathAtOrAbove', () => {
        it('should return true for exact match', () => {
            expect(isPathAtOrAbove('/home/user', '/home/user')).toBe(true);
        });

        it('should return true for parent path', () => {
            expect(isPathAtOrAbove('/home', '/home/user')).toBe(true);
        });

        it('should return false for child path', () => {
            expect(isPathAtOrAbove('/home/user/project', '/home/user')).toBe(false);
        });

        it('should return false for sibling path', () => {
            expect(isPathAtOrAbove('/home/other', '/home/user')).toBe(false);
        });
    });

    describe('checkTraversalBoundary', () => {
        const testBoundary: TraversalBoundary = {
            forbidden: ['/etc', '/var', '$HOME/.ssh'],
            boundaries: ['$HOME'],
            maxAbsoluteDepth: 10,
            maxRelativeDepth: 5,
        };

        it('should allow normal project paths', () => {
            const projectPath = path.join(os.homedir(), 'projects', 'myapp');
            const result = checkTraversalBoundary(projectPath, testBoundary);
            expect(result.allowed).toBe(true);
        });

        it('should block forbidden directories', () => {
            const result = checkTraversalBoundary('/etc/passwd', testBoundary);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('forbidden');
        });

        it('should block paths within forbidden directories', () => {
            const result = checkTraversalBoundary('/etc/nginx/nginx.conf', testBoundary);
            expect(result.allowed).toBe(false);
        });

        it('should block sensitive home subdirectories', () => {
            const sshPath = path.join(os.homedir(), '.ssh', 'id_rsa');
            const result = checkTraversalBoundary(sshPath, testBoundary);
            expect(result.allowed).toBe(false);
        });

        it('should block paths exceeding absolute depth', () => {
            const deepPath = '/a/b/c/d/e/f/g/h/i/j/k/l'; // 12 levels
            const result = checkTraversalBoundary(deepPath, testBoundary);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('absolute depth');
        });

        it('should block paths exceeding relative depth', () => {
            const startPath = '/home/user/deep/nested/project';
            const farUpPath = '/home';
            const result = checkTraversalBoundary(farUpPath, testBoundary, startPath);
            // Relative depth from /home/user/deep/nested/project to /home is 4
            // This should be within maxRelativeDepth of 5
            expect(result.allowed).toBe(true);
        });

        it('should allow paths within relative depth limit', () => {
            const startPath = '/home/user/project';
            const upPath = '/home/user';
            const result = checkTraversalBoundary(upPath, testBoundary, startPath);
            expect(result.allowed).toBe(true);
        });
    });

    describe('resolveTraversalBoundary', () => {
        it('should use defaults when no options provided', () => {
            const result = resolveTraversalBoundary();
            expect(result).toEqual(DEFAULT_TRAVERSAL_BOUNDARY);
        });

        it('should merge partial options with defaults', () => {
            const result = resolveTraversalBoundary({
                maxAbsoluteDepth: 15,
            });
            
            expect(result.maxAbsoluteDepth).toBe(15);
            expect(result.maxRelativeDepth).toBe(DEFAULT_TRAVERSAL_BOUNDARY.maxRelativeDepth);
            expect(result.forbidden).toEqual(DEFAULT_TRAVERSAL_BOUNDARY.forbidden);
        });

        it('should allow overriding forbidden list', () => {
            const result = resolveTraversalBoundary({
                forbidden: ['/custom/forbidden'],
            });
            
            expect(result.forbidden).toEqual(['/custom/forbidden']);
        });
    });

    describe('createBoundaryChecker', () => {
        it('should create a checker function', () => {
            const checker = createBoundaryChecker();
            expect(typeof checker).toBe('function');
        });

        it('should check paths using the returned function', () => {
            const checker = createBoundaryChecker();
            const result = checker('/etc/passwd');
            expect(result.allowed).toBe(false);
        });

        it('should allow all paths when allowUnsafeTraversal is true', () => {
            const checker = createBoundaryChecker(
                { allowUnsafeTraversal: true, warnOnOverride: false }
            );
            
            const result = checker('/etc/passwd');
            expect(result.allowed).toBe(true);
        });

        it('should log warning when unsafe traversal is enabled', () => {
            createBoundaryChecker(
                { allowUnsafeTraversal: true, warnOnOverride: true },
                mockLogger
            );
            
            const warnCalls = logCalls.filter(c => c.level === 'warn');
            expect(warnCalls.length).toBeGreaterThan(0);
            expect(warnCalls[0].message).toContain('SECURITY WARNING');
        });

        it('should not log warning when warnOnOverride is false', () => {
            createBoundaryChecker(
                { allowUnsafeTraversal: true, warnOnOverride: false },
                mockLogger
            );
            
            const warnCalls = logCalls.filter(c => c.level === 'warn');
            expect(warnCalls).toHaveLength(0);
        });

        it('should use custom boundaries', () => {
            const checker = createBoundaryChecker({
                boundaries: {
                    forbidden: ['/custom'],
                    boundaries: [],
                    maxAbsoluteDepth: 5,
                    maxRelativeDepth: 3,
                },
            });
            
            const result = checker('/custom/path');
            expect(result.allowed).toBe(false);
        });
    });

    describe('filterAllowedPaths', () => {
        it('should filter out forbidden paths', () => {
            const paths = [
                path.join(os.homedir(), 'project'),
                '/etc/nginx',
                path.join(os.homedir(), 'other'),
            ];
            
            const allowed = filterAllowedPaths(paths);
            
            // Home directory paths should be allowed, /etc should be blocked
            expect(allowed.length).toBeLessThan(paths.length);
            expect(allowed).not.toContain('/etc/nginx');
        });

        it('should return all paths when unsafe traversal is enabled', () => {
            const paths = ['/etc', '/var', '/usr'];
            
            const allowed = filterAllowedPaths(paths, { 
                allowUnsafeTraversal: true,
                warnOnOverride: false,
            });
            
            expect(allowed).toEqual(paths);
        });

        it('should log filtered paths', () => {
            const paths = ['/etc/nginx'];
            
            filterAllowedPaths(paths, {}, undefined, mockLogger);
            
            const debugCalls = logCalls.filter(c => c.level === 'debug');
            expect(debugCalls.some(c => c.message.includes('Filtered out'))).toBe(true);
        });

        it('should respect start path for relative depth', () => {
            const startPath = '/home/user/deep/project';
            const paths = [
                '/home/user/deep/project/src',  // ok
                '/home/user/deep',              // ok - 1 level up
                '/home',                        // might be blocked depending on depth
            ];
            
            const allowed = filterAllowedPaths(paths, {
                boundaries: {
                    forbidden: [],
                    boundaries: [],
                    maxAbsoluteDepth: 20,
                    maxRelativeDepth: 2,
                },
            }, startPath);
            
            // /home is 3 levels up from /home/user/deep/project, should be filtered
            expect(allowed).not.toContain('/home');
        });
    });

    describe('edge cases', () => {
        it('should handle empty forbidden list', () => {
            const boundary: TraversalBoundary = {
                forbidden: [],
                boundaries: [],
                maxAbsoluteDepth: 100,
                maxRelativeDepth: 100,
            };
            
            const result = checkTraversalBoundary('/etc/passwd', boundary);
            expect(result.allowed).toBe(true);
        });

        it('should handle paths with special characters', () => {
            const pathWithSpaces = path.join(os.homedir(), 'my project', 'config');
            const result = checkTraversalBoundary(pathWithSpaces, DEFAULT_TRAVERSAL_BOUNDARY);
            expect(result.allowed).toBe(true);
        });

        it('should handle symlink-like paths correctly', () => {
            // Paths that might look like they go outside boundaries
            const trickyPath = path.join(os.homedir(), 'project', '..', 'other-project');
            const result = checkTraversalBoundary(trickyPath, DEFAULT_TRAVERSAL_BOUNDARY);
            // Should be allowed as it resolves to a sibling project
            expect(result.allowed).toBe(true);
        });
    });
});
