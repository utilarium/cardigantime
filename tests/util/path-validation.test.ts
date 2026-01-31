import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { validatePath } from '../../src/util/path-validation';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('validatePath', () => {
    let tempDir: string;
    let existingFile: string;
    let existingDir: string;

    beforeEach(() => {
        // Create temporary test files
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cardigan-test-'));
        existingFile = path.join(tempDir, 'test.txt');
        existingDir = path.join(tempDir, 'subdir');

        fs.writeFileSync(existingFile, 'test content');
        fs.mkdirSync(existingDir);
    });

    afterEach(() => {
        // Clean up
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    describe('valid paths', () => {
        test('validates existing file', () => {
            expect(() => {
                validatePath(existingFile, 'inputFile', '/config/test.yaml');
            }).not.toThrow();
        });

        test('validates existing directory', () => {
            expect(() => {
                validatePath(existingDir, 'outputDir', '/config/test.yaml');
            }).not.toThrow();
        });

        test('returns value unchanged', () => {
            const result = validatePath(existingFile, 'test', '/config/test.yaml');
            expect(result).toBe(existingFile);
        });
    });

    describe('invalid paths', () => {
        test('throws error for non-existent file', () => {
            const nonExistent = path.join(tempDir, 'does-not-exist.txt');

            expect(() => {
                validatePath(nonExistent, 'inputFile', '/config/test.yaml');
            }).toThrow(/Path does not exist/);
        });

        test('error includes path in message', () => {
            const nonExistent = path.join(tempDir, 'missing.txt');

            expect(() => {
                validatePath(nonExistent, 'inputFile', '/config/test.yaml');
            }).toThrow(nonExistent);
        });

        test('error includes field name in message', () => {
            const nonExistent = path.join(tempDir, 'missing.txt');

            expect(() => {
                validatePath(nonExistent, 'inputFile', '/config/test.yaml');
            }).toThrow('Field: inputFile');
        });
    });

    describe('edge cases', () => {
        test('handles empty array', () => {
            expect(() => {
                validatePath([], 'empty', '/config/test.yaml');
            }).not.toThrow();
        });

        test('handles empty object', () => {
            expect(() => {
                validatePath({}, 'empty', '/config/test.yaml');
            }).not.toThrow();
        });
    });
});
