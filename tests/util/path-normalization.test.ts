import { describe, test, expect } from 'vitest';
import { normalizePathInput } from '../../src/util/path-normalization';

describe('normalizePathInput', () => {
    describe('file:// URL conversion', () => {
        test('converts file:// URL to path', () => {
            const input = 'file:///Users/me/project/config.yaml';
            const result = normalizePathInput(input);
            expect(result).toBe('/Users/me/project/config.yaml');
        });

        test('converts file:// URL with spaces', () => {
            const input = 'file:///Users/me/My%20Project/config.yaml';
            const result = normalizePathInput(input);
            expect(result).toBe('/Users/me/My Project/config.yaml');
        });

        test('handles file:// URLs in arrays', () => {
            const input = [
                'file:///path/one',
                './relative/path',
                'file:///path/two'
            ];
            const result = normalizePathInput(input);
            expect(result).toEqual([
                '/path/one',
                './relative/path',
                '/path/two'
            ]);
        });

        test('handles file:// URLs in objects', () => {
            const input = {
                path1: 'file:///absolute/path',
                path2: './relative/path'
            };
            const result = normalizePathInput(input);
            expect(result).toEqual({
                path1: '/absolute/path',
                path2: './relative/path'
            });
        });
    });

    describe('non-file URL rejection', () => {
        test('rejects http:// URLs', () => {
            const input = 'http://example.com/file.txt';
            expect(() => normalizePathInput(input)).toThrow(
                'Non-file URLs are not supported in path fields: http://example.com/file.txt'
            );
        });

        test('rejects https:// URLs', () => {
            const input = 'https://example.com/file.txt';
            expect(() => normalizePathInput(input)).toThrow(
                'Non-file URLs are not supported in path fields: https://example.com/file.txt'
            );
        });

        test('rejects http URLs in arrays', () => {
            const input = ['./valid/path', 'http://example.com/invalid'];
            expect(() => normalizePathInput(input)).toThrow(
                'Non-file URLs are not supported'
            );
        });

        test('rejects https URLs in objects', () => {
            const input = {
                valid: './path',
                invalid: 'https://example.com/file'
            };
            expect(() => normalizePathInput(input)).toThrow(
                'Non-file URLs are not supported'
            );
        });
    });

    describe('regular path handling', () => {
        test('returns regular paths unchanged', () => {
            const input = './relative/path';
            const result = normalizePathInput(input);
            expect(result).toBe('./relative/path');
        });

        test('returns absolute paths unchanged', () => {
            const input = '/absolute/path';
            const result = normalizePathInput(input);
            expect(result).toBe('/absolute/path');
        });

        test('handles arrays of regular paths', () => {
            const input = ['./src', '/absolute', '../parent'];
            const result = normalizePathInput(input);
            expect(result).toEqual(['./src', '/absolute', '../parent']);
        });
    });

    describe('edge cases', () => {
        test('handles empty strings', () => {
            const input = '';
            const result = normalizePathInput(input);
            expect(result).toBe('');
        });

        test('handles empty arrays', () => {
            const input: string[] = [];
            const result = normalizePathInput(input);
            expect(result).toEqual([]);
        });

        test('handles empty objects', () => {
            const input = {};
            const result = normalizePathInput(input);
            expect(result).toEqual({});
        });

        test('handles non-string values', () => {
            const input = {
                path: './src',
                count: 42,
                enabled: true,
                nothing: null
            };
            const result = normalizePathInput(input);
            expect(result).toEqual({
                path: './src',
                count: 42,
                enabled: true,
                nothing: null
            });
        });

        test('handles nested objects', () => {
            const input = {
                outer: {
                    inner: 'file:///path'
                }
            };
            const result = normalizePathInput(input);
            expect(result).toEqual({
                outer: {
                    inner: '/path'
                }
            });
        });
    });

    describe('invalid file:// URLs', () => {
        test('throws error for malformed file:// URL', () => {
            const input = 'file://[invalid]';  // Invalid characters in URL
            expect(() => normalizePathInput(input)).toThrow('Invalid file:// URL');
        });
    });
});
