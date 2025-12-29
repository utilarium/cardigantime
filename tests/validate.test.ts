import { beforeEach, describe, expect, test, vi } from 'vitest';
import { z } from 'zod';
import type * as StorageUtil from '../src/util/storage';
import { ConfigSchema, Logger, Options } from '../src/types';
import { ArgumentError } from '../src/error/ArgumentError'; // Import even if just re-exported

// --- Mock Dependencies ---

// Mock storage
const mockIsDirectoryReadable = vi.fn<StorageUtil.Utility['isDirectoryReadable']>();
const mockExists = vi.fn<StorageUtil.Utility['exists']>();
const mockStorageCreate = vi.fn<typeof StorageUtil.create>().mockReturnValue({
    isDirectoryReadable: mockIsDirectoryReadable,
    // Add other methods if needed, mocked or otherwise
    // Use ts-ignore for methods not explicitly mocked if necessary
    // @ts-ignore
    readFile: vi.fn(),
    // @ts-ignore
    isDirectoryWritable: vi.fn(),
    // @ts-ignore
    forEachFileIn: vi.fn(),
    // @ts-ignore
    writeFile: vi.fn(),
    // @ts-ignore
    ensureDir: vi.fn(),
    // @ts-ignore
    remove: vi.fn(),
    // @ts-ignore
    pathExists: vi.fn(),
    // @ts-ignore
    copyFile: vi.fn(),
    // @ts-ignore
    moveFile: vi.fn(),
    // @ts-ignore
    listFiles: vi.fn(),
    // @ts-ignore
    createReadStream: vi.fn(),
    // @ts-ignore
    createWriteStream: vi.fn(),
    // @ts-ignore
    exists: mockExists,
});
vi.mock('../src/util/storage', () => ({
    create: mockStorageCreate,
}));

// --- Dynamically Import Module Under Test ---
// Needs to be imported *after* mocks are set up
const { validate, listZodKeys, listObjectKeys, checkForExtraKeys } = await import('../src/validate');

// --- Test Suite ---

describe('validate', () => {
    let mockLogger: any;
    let baseOptions: Options<any>; // Use 'any' for simplicity in tests

    beforeEach(() => {
        vi.clearAllMocks(); // Clear mocks before each test

        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            verbose: vi.fn(),
            silly: vi.fn(),
        } as unknown as Record<keyof Logger, ReturnType<typeof vi.fn>>;

        baseOptions = {
            logger: mockLogger,
            configShape: z.object({}), // Default empty shape
            features: ['config'], // Default feature set including 'config'
            defaults: {
                configDirectory: '.',
                configFile: 'config.yaml',
                isRequired: false,
                encoding: 'utf8',
            }, // Default empty defaults
        };

        // Default mock implementations
        mockIsDirectoryReadable.mockResolvedValue(true); // Assume readable by default
    });

    // --- Basic Validation Tests ---

    test('should pass validation for a valid config', async () => {
        const shape = z.object({ port: z.number() });
        const config = {
            port: 8080,
            configDirectory: '/config',
            discoveredConfigDirs: ['/config'],
            resolvedConfigDirs: ['/config']
        };
        const options: Options<typeof shape.shape> = { ...baseOptions, configShape: shape.shape };

        await expect(validate(config, options)).resolves.toBeUndefined();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should pass validation when configDirectory is not provided', async () => {
        const shape = z.object({ port: z.number() });
        const config = {
            port: 8080,
            configDirectory: '.',
            discoveredConfigDirs: ['.'],
            resolvedConfigDirs: ['.']
        }; // Add required configDirectory
        const options: Options<typeof shape.shape> = { ...baseOptions, configShape: shape.shape };

        await expect(validate(config, options)).resolves.toBeUndefined();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should pass validation when features do not include config', async () => {
        const shape = z.object({ port: z.number() });
        const config = {
            port: 8080,
            configDirectory: '/config',
            discoveredConfigDirs: ['/config'],
            resolvedConfigDirs: ['/config']
        };
        const options: Options<typeof shape.shape> = {
            ...baseOptions,
            configShape: shape.shape,
            features: [] // No 'config' feature
        };

        await expect(validate(config, options)).resolves.toBeUndefined();
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockStorageCreate).not.toHaveBeenCalled(); // No config directory validation
    });

    test('should pass validation with empty config when configDirectory does not exist and isRequired is false', async () => {
        const config = {
            configDirectory: '/nonexistent',
            discoveredConfigDirs: [],
            resolvedConfigDirs: []
        };
        const options: Options<any> = {
            ...baseOptions,
            configShape: z.object({}).shape, // Fix: provide proper configShape
            defaults: { ...baseOptions.defaults, isRequired: false }
        };
        mockExists.mockResolvedValue(false);

        await expect(validate(config, options)).resolves.toBeUndefined();
        expect(mockExists).toHaveBeenCalledWith('/nonexistent');
        expect(mockIsDirectoryReadable).not.toHaveBeenCalled(); // Should not check readability if directory doesn't exist
    });

    // --- Extra Keys Check ---

    test('should throw error for extra keys not defined in schema', async () => {
        const shape = z.object({ port: z.number() });
        const config = {
            port: 8080,
            extraKey: 'unexpected',
            configDirectory: '/config',
            discoveredConfigDirs: ['/config'],
            resolvedConfigDirs: ['/config']
        };
        const options: Options<typeof shape.shape> = { ...baseOptions, configShape: shape.shape };

        await expect(validate(config, options)).rejects.toThrow('Unknown configuration keys found: extraKey. Allowed keys are: configDirectory, discoveredConfigDirs, resolvedConfigDirs, port');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown configuration keys found: extraKey. Allowed keys are:'));
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('configDirectory, discoveredConfigDirs, resolvedConfigDirs, port')); // Check allowed keys listing
    });

    // --- configDirectory Validation Tests ---

    test('should throw error if configDirectory is not readable and feature "config" is enabled', async () => {
        const configDir = '/invalid/config/dir';
        const config = {
            configDirectory: configDir,
            discoveredConfigDirs: [],
            resolvedConfigDirs: []
        };
        const options: Options<any> = { ...baseOptions, features: ['config'] };
        mockExists.mockResolvedValue(true);
        mockIsDirectoryReadable.mockResolvedValue(false);

        await expect(validate(config, options)).rejects.toThrow('Configuration directory exists but is not readable');
        expect(mockStorageCreate).toHaveBeenCalled();
        expect(mockIsDirectoryReadable).toHaveBeenCalledWith(configDir);
    });

    test('should throw error if configDirectory does not exist and feature "config" is enabled and isRequired is true', async () => {
        const configDir = '/invalid/config/dir';
        const config = {
            configDirectory: configDir,
            discoveredConfigDirs: [],
            resolvedConfigDirs: []
        };
        const options: Options<any> = { ...baseOptions, defaults: { ...baseOptions.defaults, isRequired: true }, features: ['config'] };
        mockExists.mockResolvedValue(false);

        await expect(validate(config, options)).rejects.toThrow('Configuration directory does not exist and is required');
        expect(mockStorageCreate).toHaveBeenCalled();
        expect(mockExists).toHaveBeenCalledWith(configDir);
    });

    test('should work if configDirectory does not exist, isRequired is false, config is empty, and feature "config" is enabled', async () => {
        const configDir = '/invalid/config/dir';
        const shape = z.object({
            server: z.object({ host: z.string(), port: z.number() }).optional(),
            logging: z.object({ level: z.string() }).optional()
        });
        const config = {
            configDirectory: configDir,
            discoveredConfigDirs: [],
            resolvedConfigDirs: []
        };
        const options: Options<typeof shape.shape> = { ...baseOptions, defaults: { ...baseOptions.defaults, isRequired: false }, features: ['config'], configShape: shape.shape };
        mockExists.mockResolvedValue(false);
        mockIsDirectoryReadable.mockResolvedValue(false);

        await validate(config as any, options);
        expect(mockExists).toHaveBeenCalledWith(configDir);
    });

    // --- Nested Schema Tests ---

    test('should pass validation for valid nested config', async () => {
        const shape = z.object({
            server: z.object({ host: z.string(), port: z.number() }),
            logging: z.object({ level: z.string() })
        });
        const config = {
            server: { host: 'localhost', port: 3000 },
            logging: { level: 'info' },
            configDirectory: '/config',
            discoveredConfigDirs: ['/config'],
            resolvedConfigDirs: ['/config']
        };
        const options: Options<typeof shape.shape> = { ...baseOptions, configShape: shape.shape };

        await expect(validate(config, options)).resolves.toBeUndefined();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should throw validation error for invalid nested config', async () => {
        const shape = z.object({
            server: z.object({ host: z.string(), port: z.number() }),
        });
        const config = {
            server: { host: 'localhost', port: '3000' }, // port is string
            configDirectory: '/config',
            discoveredConfigDirs: [],
            resolvedConfigDirs: []
        };
        const options: Options<typeof shape.shape> = { ...baseOptions, configShape: shape.shape };

        await expect(validate(config as any, options)).rejects.toThrow('Configuration validation failed. Check logs for details.');
        expect(mockLogger.error).toHaveBeenCalledWith('Configuration validation failed. Check logs for details.');
        expect(mockLogger.silly).toHaveBeenCalledWith(expect.stringContaining('Configuration validation failed:'), expect.any(String));
    });

    test('should throw error for extra nested keys', async () => {
        const shape = z.object({ server: z.object({ port: z.number() }) });
        const config = {
            server: { port: 8080, unexpected: true }, // Extra key within server
            configDirectory: '/config',
            discoveredConfigDirs: ['/config'],
            resolvedConfigDirs: ['/config']
        };
        const options: Options<typeof shape.shape> = { ...baseOptions, configShape: shape.shape };

        // Note: Zod's default behavior is to strip extra keys during parsing.
        // The checkForExtraKeys function operates on the *original* config object *before* Zod parsing strips keys.
        // However, listZodKeys *only* lists keys defined in the schema.
        // So, this test case checks if the top-level keys are allowed. Nested extra keys are implicitly handled (stripped) by Zod's safeParse.
        // Let's add a top-level extra key to trigger our custom check explicitly.
        const configWithTopLevelExtra = {
            ...config,
            anotherExtra: 'value'
        }

        // Check the type passed to validate - it expects the inferred type
        const typedConfig: z.infer<typeof shape> & { configDirectory: string, anotherExtra: string, discoveredConfigDirs: string[], resolvedConfigDirs: string[] } = configWithTopLevelExtra;

        await expect(validate(typedConfig, options)).rejects.toThrow('Unknown configuration keys found: server.unexpected, anotherExtra. Allowed keys are: configDirectory, discoveredConfigDirs, resolvedConfigDirs, server.port');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown configuration keys found: server.unexpected, anotherExtra. Allowed keys are:'));
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('configDirectory, discoveredConfigDirs, resolvedConfigDirs, server.port'));
    });


    // --- Optional Keys ---

    test('should pass validation when optional keys are missing', async () => {
        const shape = z.object({
            required: z.string(),
            optional: z.number().optional()
        });
        const config = {
            required: 'hello',
            configDirectory: '/config',
            discoveredConfigDirs: ['/config'],
            resolvedConfigDirs: ['/config']
        }; // optional is missing
        const options: Options<typeof shape.shape> = { ...baseOptions, configShape: shape.shape };

        await expect(validate(config, options)).resolves.toBeUndefined();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should pass validation when optional keys are present', async () => {
        const shape = z.object({
            required: z.string(),
            optional: z.number().optional()
        });
        const config = {
            required: 'hello',
            optional: 123,
            configDirectory: '/config',
            discoveredConfigDirs: ['/config'],
            resolvedConfigDirs: ['/config']
        };
        const options: Options<typeof shape.shape> = { ...baseOptions, configShape: shape.shape };

        await expect(validate(config, options)).resolves.toBeUndefined();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // --- Helper Function Tests (Optional but good practice) ---
    describe('listZodKeys', () => {
        test('should list keys for a simple object', () => {
            const schema = z.object({ a: z.string(), b: z.number() });
            expect(listZodKeys(schema)).toEqual(['a', 'b']);
        });

        test('should list keys for a nested object', () => {
            const schema = z.object({ a: z.string(), b: z.object({ c: z.boolean(), d: z.number() }) });
            expect(listZodKeys(schema)).toEqual(['a', 'b.c', 'b.d']);
        });

        test('should handle optional keys', () => {
            const schema = z.object({ a: z.string().optional(), b: z.number() });
            expect(listZodKeys(schema)).toEqual(['a', 'b']);
        });

        test('should handle nullable keys', () => {
            const schema = z.object({ a: z.string().nullable(), b: z.number() });
            expect(listZodKeys(schema)).toEqual(['a', 'b']);
        });

        test('should handle arrays (stops at array level)', () => {
            const schema = z.object({ a: z.array(z.string()), b: z.number() });
            // listZodKeys traverses *into* arrays to find nested object keys if they exist
            expect(listZodKeys(schema)).toEqual(['a', 'b']);
        });

        test('should handle arrays of objects', () => {
            const schema = z.object({ a: z.array(z.object({ id: z.number(), name: z.string() })), b: z.number() });
            expect(listZodKeys(schema)).toEqual(['a.id', 'a.name', 'b']);
        });

        test('should handle ZodRecord types', () => {
            const schema = z.object({
                a: z.record(z.string(), z.string()),
                b: z.number()
            });
            expect(listZodKeys(schema)).toEqual(['a', 'b']);
        });

        test('should handle ZodAny types', () => {
            const schema = z.object({
                a: z.any(),
                b: z.number()
            });
            expect(listZodKeys(schema)).toEqual(['a', 'b']);
        });

        test('should handle nested optional and nullable wrappers', () => {
            const schema = z.object({
                a: z.string().optional().nullable(),
                b: z.object({ c: z.number() }).nullable().optional()
            });
            expect(listZodKeys(schema)).toEqual(['a', 'b.c']);
        });

        test('should handle deeply nested objects', () => {
            const schema = z.object({
                level1: z.object({
                    level2: z.object({
                        level3: z.string()
                    })
                })
            });
            expect(listZodKeys(schema)).toEqual(['level1.level2.level3']);
        });

        test('should return empty for non-object types', () => {
            expect(listZodKeys(z.string())).toEqual([]);
            expect(listZodKeys(z.number())).toEqual([]);
            expect(listZodKeys(z.boolean())).toEqual([]);
        });

        test('should handle complex mixed schemas', () => {
            const schema = z.object({
                simple: z.string(),
                optional: z.number().optional(),
                nullable: z.boolean().nullable(),
                nested: z.object({
                    deep: z.string(),
                    array: z.array(z.object({ item: z.number() }))
                }),
                record: z.record(z.string(), z.string()),
                any: z.any()
            });
            expect(listZodKeys(schema)).toEqual([
                'simple',
                'optional',
                'nullable',
                'nested.deep',
                'nested.array.item',
                'record',
                'any'
            ]);
        });
    });

    describe('listObjectKeys', () => {
        test('should list keys for a simple object', () => {
            const obj = { a: 'string', b: 123 };
            expect(listObjectKeys(obj)).toEqual(['a', 'b']);
        });

        test('should list keys for nested objects', () => {
            const obj = {
                a: 'string',
                b: {
                    c: 'nested',
                    d: 456
                }
            };
            expect(listObjectKeys(obj)).toEqual(['a', 'b.c', 'b.d']);
        });

        test('should handle arrays with objects', () => {
            const obj = {
                a: 'string',
                b: [
                    { id: 1, name: 'first' },
                    { id: 2, name: 'second' }
                ]
            };
            expect(listObjectKeys(obj)).toEqual(['a', 'b.id', 'b.name']);
        });

        test('should handle arrays without objects', () => {
            const obj = {
                a: 'string',
                b: [1, 2, 3],
                c: ['hello', 'world']
            };
            expect(listObjectKeys(obj)).toEqual(['a', 'b', 'c']);
        });

        test('should handle empty arrays', () => {
            const obj = {
                a: 'string',
                b: []
            };
            expect(listObjectKeys(obj)).toEqual(['a', 'b']);
        });

        test('should handle mixed arrays (objects and primitives)', () => {
            const obj = {
                a: 'string',
                b: [
                    { id: 1 },
                    'primitive',
                    123
                ]
            };
            // Should use first object element found
            expect(listObjectKeys(obj)).toEqual(['a', 'b.id']);
        });

        test('should handle deeply nested objects', () => {
            const obj = {
                level1: {
                    level2: {
                        level3: {
                            deep: 'value'
                        }
                    }
                }
            };
            expect(listObjectKeys(obj)).toEqual(['level1.level2.level3.deep']);
        });

        test('should handle null and undefined values', () => {
            const obj = {
                a: 'string',
                b: null,
                c: undefined,
                d: 0,
                e: false,
                f: ''
            };
            expect(listObjectKeys(obj)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
        });

        test('should handle complex nested structures', () => {
            const obj = {
                simple: 'value',
                nested: {
                    inner: 'innerValue',
                    array: [
                        { item: 'first' },
                        { item: 'second' }
                    ]
                },
                primitiveArray: [1, 2, 3],
                mixedArray: [
                    { name: 'object' },
                    'string',
                    123
                ]
            };
            expect(listObjectKeys(obj)).toEqual([
                'simple',
                'nested.inner',
                'nested.array.item',
                'primitiveArray',
                'mixedArray.name'
            ]);
        });

        test('should handle arrays nested in objects nested in arrays', () => {
            const obj = {
                items: [
                    {
                        metadata: {
                            tags: ['tag1', 'tag2'],
                            properties: [
                                { key: 'prop1', value: 'val1' }
                            ]
                        }
                    }
                ]
            };
            expect(listObjectKeys(obj)).toEqual([
                'items.metadata.tags',
                'items.metadata.properties.key',
                'items.metadata.properties.value'
            ]);
        });

        test('should handle objects with non-plain objects (dates, functions, etc)', () => {
            const obj = {
                a: 'string',
                b: new Date(),
                c: () => { },
                d: /regex/,
                e: { nested: 'plain' }
            };
            // Non-plain objects (Date, Function, RegExp) are treated as primitives and only their key is listed
            // Only plain objects get recursed into
            const result = listObjectKeys(obj);
            expect(result).toContain('a');     // string primitive
            expect(result).toContain('c');     // function (treated as primitive)
            expect(result).toContain('e.nested'); // plain object (recursed into)
            // Note: Date and RegExp objects are filtered out by isPlainObject so 'b' and 'd' won't appear
        });

        test('should handle empty objects', () => {
            expect(listObjectKeys({})).toEqual([]);
        });

        test('should deduplicate keys from array processing', () => {
            const obj = {
                items: [
                    { id: 1, name: 'first' },
                    { id: 2, name: 'second' },
                    { id: 3, name: 'third' }
                ]
            };
            // All objects have same structure, should not have duplicates
            expect(listObjectKeys(obj)).toEqual(['items.id', 'items.name']);
        });
    });

    describe('checkForExtraKeys', () => {
        let schema: z.ZodObject<any>;
        let logger: any;

        beforeEach(() => {
            schema = z.object({ known: z.string(), nested: z.object({ deep: z.number() }) });
            logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), verbose: vi.fn(), silly: vi.fn() }; // Provide mock logger
        });

        test('should not throw or log if no extra keys', () => {
            const config = { known: 'value', nested: { deep: 123 } };
            expect(() => checkForExtraKeys(config, schema, logger)).not.toThrow();
            expect(logger.error).not.toHaveBeenCalled();
        });

        test('should throw and log if extra top-level keys exist', () => {
            const config = { known: 'value', nested: { deep: 123 }, extra: 'bad' };
            expect(() => checkForExtraKeys(config, schema, logger)).toThrow('Unknown configuration keys found: extra. Allowed keys are: known, nested.deep');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown configuration keys found: extra. Allowed keys are: known, nested.deep'));
        });

        test('should throw and log if extra nested keys exist (passed as top level)', () => {
            // Our check works on the flattened keys derived from the schema vs the top-level keys of the config object.
            // It won't inherently detect { nested: { deep: 1, extra: 'bad' } } unless 'nested.extra' is somehow a top-level key
            // in the mergedSources object passed to it. Let's simulate that scenario.
            const config = { known: 'value', 'nested.deep': 123, 'nested.extra': 'bad' };
            expect(() => checkForExtraKeys(config, schema, logger)).toThrow('Unknown configuration keys found: nested.extra. Allowed keys are: known, nested.deep');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown configuration keys found: nested.extra. Allowed keys are: known, nested.deep'));
        });

        test('should correctly identify allowed keys from complex schema', () => {
            const complexSchema = z.object({
                a: z.string(),
                b: z.object({ c: z.number(), d: z.boolean().optional() }),
                e: z.array(z.object({ f: z.string() }))
            });
            const config = { a: '1', b: { c: 2 }, e: [{ f: '3' }], extra: true };
            expect(() => checkForExtraKeys(config, complexSchema, logger)).toThrow('Unknown configuration keys found: extra. Allowed keys are: a, b.c, b.d, e.f');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown configuration keys found: extra. Allowed keys are: a, b.c, b.d, e.f'));
        });

        test('should allow extra keys under ZodRecord types', () => {
            const recordSchema = z.object({
                metadata: z.record(z.string(), z.string()),
                config: z.object({ port: z.number() })
            });
            const config = {
                metadata: {
                    'custom.key': 'value',
                    'another.custom': 'value2'
                },
                config: { port: 8080 },
                'metadata.anykey': 'should be allowed',
                'metadata.another.deep.key': 'should be allowed'
            };
            expect(() => checkForExtraKeys(config, recordSchema, logger)).not.toThrow();
            expect(logger.error).not.toHaveBeenCalled();
        });

        test('should allow extra keys under ZodAny types', () => {
            const anySchema = z.object({
                dynamic: z.any(),
                fixed: z.string()
            });
            const config = {
                dynamic: { anything: 'goes' },
                fixed: 'value',
                'dynamic.anything': 'should be allowed',
                'dynamic.deep.nested': 'should be allowed'
            };
            expect(() => checkForExtraKeys(config, anySchema, logger)).not.toThrow();
            expect(logger.error).not.toHaveBeenCalled();
        });

        test('should handle optional and nullable wrappers around records', () => {
            const optionalRecordSchema = z.object({
                optional: z.record(z.string(), z.string()).optional(),
                nullable: z.record(z.string(), z.number()).nullable(),
                both: z.record(z.string(), z.boolean()).optional().nullable()
            });
            const config = {
                'optional.custom': 'allowed',
                'nullable.custom': 123,
                'both.custom': true
            };
            expect(() => checkForExtraKeys(config, optionalRecordSchema, logger)).not.toThrow();
            expect(logger.error).not.toHaveBeenCalled();
        });

        test('should handle nested records', () => {
            const nestedRecordSchema = z.object({
                level1: z.object({
                    level2: z.record(z.string(), z.string())
                })
            });
            const config = {
                'level1.level2.anykey': 'allowed',
                'level1.level2.deep.nested': 'allowed'
            };
            expect(() => checkForExtraKeys(config, nestedRecordSchema, logger)).not.toThrow();
            expect(logger.error).not.toHaveBeenCalled();
        });

        test('should still catch extra keys outside of record prefixes', () => {
            const mixedSchema = z.object({
                metadata: z.record(z.string(), z.string()),
                config: z.object({ port: z.number() })
            });
            const config = {
                metadata: { custom: 'value' },
                config: { port: 8080 },
                'metadata.custom': 'allowed',
                'config.extraKey': 'not allowed',
                'topLevel.extra': 'not allowed'
            };
            expect(() => checkForExtraKeys(config, mixedSchema, logger)).toThrow('Unknown configuration keys found: config.extraKey, topLevel.extra. Allowed keys are: metadata, config.port');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown configuration keys found: config.extraKey, topLevel.extra'));
        });

        test('should handle multiple record types in one schema', () => {
            const multiRecordSchema = z.object({
                metadata: z.record(z.string(), z.string()),
                data: z.record(z.string(), z.number()),
                config: z.object({ port: z.number() })
            });
            const config = {
                'metadata.anything': 'allowed',
                'data.anything': 123,
                'config.port': 8080,
                'config.extra': 'not allowed'
            };
            expect(() => checkForExtraKeys(config, multiRecordSchema, logger)).toThrow('Unknown configuration keys found: config.extra. Allowed keys are: metadata, data, config.port');
        });

        test('should use console as fallback logger', () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            const config = { known: 'value', extra: 'bad' };

            try {
                expect(() => checkForExtraKeys(config, schema, console)).toThrow();
                expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown configuration keys found: extra'));
            } finally {
                consoleErrorSpy.mockRestore();
            }
        });
    });

});

// Export something to make it a module
export { };
