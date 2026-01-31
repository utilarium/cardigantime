import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectUnmarkedPaths } from '../../src/util/path-detection';

describe('detectUnmarkedPaths', () => {
    let consoleWarnSpy: any;

    beforeEach(() => {
        // Spy on console.warn to capture warnings
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        // Restore console.warn
        consoleWarnSpy.mockRestore();
    });

    describe('warning emission', () => {
        test('warns about unmarked relative path', () => {
            const config = {
                outputDir: './output',  // Not in pathFields
                name: 'test'
            };

            detectUnmarkedPaths(config, [], '/config/test.yaml');

            expect(consoleWarnSpy).toHaveBeenCalled();
            expect(consoleWarnSpy.mock.calls[0][0]).toContain('outputDir');
            expect(consoleWarnSpy.mock.calls[0][0]).toContain('./output');
        });

        test('warns about parent relative path', () => {
            const config = {
                sourceDir: '../../src'
            };

            detectUnmarkedPaths(config, [], '/config/test.yaml');

            expect(consoleWarnSpy).toHaveBeenCalled();
            expect(consoleWarnSpy.mock.calls[0][0]).toContain('sourceDir');
            expect(consoleWarnSpy.mock.calls[0][0]).toContain('../../src');
        });

        test('warns about paths in arrays', () => {
            const config = {
                includes: ['./src', './lib']
            };

            detectUnmarkedPaths(config, [], '/config/test.yaml');

            expect(consoleWarnSpy).toHaveBeenCalled();
            const warning = consoleWarnSpy.mock.calls[0][0];
            expect(warning).toContain('includes[0]');
            expect(warning).toContain('includes[1]');
        });
    });

    describe('skipping marked paths', () => {
        test('does not warn about paths in pathFields', () => {
            const config = {
                outputDir: './output',
                inputFile: './input.txt'
            };

            detectUnmarkedPaths(
                config,
                ['outputDir', 'inputFile'],
                '/config/test.yaml'
            );

            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        test('warns only about unmarked paths', () => {
            const config = {
                outputDir: './output',    // In pathFields
                tempDir: './temp'         // Not in pathFields
            };

            detectUnmarkedPaths(
                config,
                ['outputDir'],
                '/config/test.yaml'
            );

            expect(consoleWarnSpy).toHaveBeenCalled();
            const warning = consoleWarnSpy.mock.calls[0][0];
            expect(warning).toContain('tempDir');
            expect(warning).not.toContain('outputDir');
        });
    });

    describe('ignoring non-path values', () => {
        test('does not warn about strings without path indicators', () => {
            const config = {
                name: 'my-project',
                version: '1.0.0',
                description: 'A test project'
            };

            detectUnmarkedPaths(config, [], '/config/test.yaml');

            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        test('does not warn about non-string values', () => {
            const config = {
                count: 42,
                enabled: true,
                items: [1, 2, 3]
            };

            detectUnmarkedPaths(config, [], '/config/test.yaml');

            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });
    });

    describe('edge cases', () => {
        test('handles empty config', () => {
            detectUnmarkedPaths({}, [], '/config/test.yaml');
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        test('handles config with no paths', () => {
            const config = {
                name: 'test',
                version: '1.0.0'
            };

            detectUnmarkedPaths(config, [], '/config/test.yaml');
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });
    });
});
