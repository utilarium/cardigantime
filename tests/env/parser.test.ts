import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { 
    parseBoolean, 
    parseNumber, 
    parseArray, 
    parseEnvVar 
} from '../../src/env/parser';
import { EnvVarParseError } from '../../src/env/errors';

describe('parseBoolean', () => {
    it('parses true variations', () => {
        expect(parseBoolean('true')).toBe(true);
        expect(parseBoolean('True')).toBe(true);
        expect(parseBoolean('TRUE')).toBe(true);
        expect(parseBoolean('1')).toBe(true);
        expect(parseBoolean('yes')).toBe(true);
        expect(parseBoolean('Yes')).toBe(true);
        expect(parseBoolean('YES')).toBe(true);
        expect(parseBoolean('y')).toBe(true);
        expect(parseBoolean('Y')).toBe(true);
        expect(parseBoolean('on')).toBe(true);
        expect(parseBoolean('ON')).toBe(true);
    });

    it('parses false variations', () => {
        expect(parseBoolean('false')).toBe(false);
        expect(parseBoolean('False')).toBe(false);
        expect(parseBoolean('FALSE')).toBe(false);
        expect(parseBoolean('0')).toBe(false);
        expect(parseBoolean('no')).toBe(false);
        expect(parseBoolean('No')).toBe(false);
        expect(parseBoolean('NO')).toBe(false);
        expect(parseBoolean('n')).toBe(false);
        expect(parseBoolean('N')).toBe(false);
        expect(parseBoolean('off')).toBe(false);
        expect(parseBoolean('OFF')).toBe(false);
        expect(parseBoolean('')).toBe(false);
    });

    it('throws on invalid values', () => {
        expect(() => parseBoolean('maybe')).toThrow(EnvVarParseError);
        expect(() => parseBoolean('invalid')).toThrow(EnvVarParseError);
        expect(() => parseBoolean('2')).toThrow(EnvVarParseError);
    });

    it('throws with descriptive error message', () => {
        try {
            parseBoolean('invalid');
            expect.fail('Should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(EnvVarParseError);
            expect((error as EnvVarParseError).value).toBe('invalid');
            expect((error as EnvVarParseError).expectedType).toBe('boolean');
            expect((error as EnvVarParseError).message).toContain('Cannot parse');
        }
    });
});

describe('parseNumber', () => {
    it('parses integers', () => {
        expect(parseNumber('42')).toBe(42);
        expect(parseNumber('0')).toBe(0);
        expect(parseNumber('-10')).toBe(-10);
        expect(parseNumber('999999')).toBe(999999);
    });

    it('parses floats', () => {
        expect(parseNumber('3.14')).toBe(3.14);
        expect(parseNumber('0.5')).toBe(0.5);
        expect(parseNumber('-2.7')).toBe(-2.7);
        expect(parseNumber('0.0001')).toBe(0.0001);
    });

    it('parses scientific notation', () => {
        expect(parseNumber('1e6')).toBe(1000000);
        expect(parseNumber('1.5e3')).toBe(1500);
        expect(parseNumber('2e-3')).toBe(0.002);
        expect(parseNumber('1E6')).toBe(1000000);
    });

    it('parses hex', () => {
        expect(parseNumber('0xFF')).toBe(255);
        expect(parseNumber('0x10')).toBe(16);
        expect(parseNumber('0x0')).toBe(0);
        expect(parseNumber('0XFF')).toBe(255);
    });

    it('throws on invalid values', () => {
        expect(() => parseNumber('not-a-number')).toThrow(EnvVarParseError);
        expect(() => parseNumber('12.34.56')).toThrow(EnvVarParseError);
        expect(() => parseNumber('abc')).toThrow(EnvVarParseError);
    });

    it('parses empty string as 0', () => {
        // Number('') returns 0, which is valid
        expect(parseNumber('')).toBe(0);
    });

    it('throws with descriptive error message', () => {
        try {
            parseNumber('invalid');
            expect.fail('Should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(EnvVarParseError);
            expect((error as EnvVarParseError).value).toBe('invalid');
            expect((error as EnvVarParseError).expectedType).toBe('number');
        }
    });
});

describe('parseArray', () => {
    it('parses space-separated strings', () => {
        expect(parseArray('tag1 tag2 tag3', z.string()))
            .toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('parses space-separated numbers', () => {
        expect(parseArray('1 2 3', z.number()))
            .toEqual([1, 2, 3]);
    });

    it('parses space-separated booleans', () => {
        expect(parseArray('true false yes no', z.boolean()))
            .toEqual([true, false, true, false]);
    });

    it('handles empty string', () => {
        expect(parseArray('', z.string())).toEqual(['']);
    });

    it('handles single item', () => {
        expect(parseArray('single', z.string())).toEqual(['single']);
    });

    it('trims whitespace', () => {
        expect(parseArray('  a  b  c  ', z.string()))
            .toEqual(['a', 'b', 'c']);
    });

    it('handles multiple spaces between items', () => {
        expect(parseArray('a    b    c', z.string()))
            .toEqual(['a', 'b', 'c']);
    });

    it('handles tabs as separators', () => {
        expect(parseArray('a\tb\tc', z.string()))
            .toEqual(['a', 'b', 'c']);
    });

    it('handles mixed whitespace', () => {
        expect(parseArray('a \t b  \t  c', z.string()))
            .toEqual(['a', 'b', 'c']);
    });

    it('throws when array element parsing fails', () => {
        expect(() => parseArray('1 2 invalid', z.number()))
            .toThrow(EnvVarParseError);
    });
});

describe('parseEnvVar', () => {
    it('delegates to correct parser based on Zod type', () => {
        expect(parseEnvVar('true', z.boolean())).toBe(true);
        expect(parseEnvVar('42', z.number())).toBe(42);
        expect(parseEnvVar('a b', z.array(z.string()))).toEqual(['a', 'b']);
        expect(parseEnvVar('text', z.string())).toBe('text');
    });

    it('returns undefined for undefined value', () => {
        expect(parseEnvVar(undefined, z.string())).toBeUndefined();
        expect(parseEnvVar(undefined, z.number())).toBeUndefined();
        expect(parseEnvVar(undefined, z.boolean())).toBeUndefined();
    });

    it('throws EnvVarParseError on parse failure', () => {
        expect(() => parseEnvVar('not-a-number', z.number()))
            .toThrow(EnvVarParseError);
        expect(() => parseEnvVar('not-a-boolean', z.boolean()))
            .toThrow(EnvVarParseError);
    });

    it('handles nested arrays', () => {
        expect(parseEnvVar('1 2 3', z.array(z.number())))
            .toEqual([1, 2, 3]);
    });

    it('returns string for unknown Zod types', () => {
        // For types we don't explicitly handle, return the string
        expect(parseEnvVar('value', z.object({ key: z.string() })))
            .toBe('value');
    });

    it('handles empty string for strings', () => {
        expect(parseEnvVar('', z.string())).toBe('');
    });

    it('handles empty string for booleans', () => {
        expect(parseEnvVar('', z.boolean())).toBe(false);
    });
});
