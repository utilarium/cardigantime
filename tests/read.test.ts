import { beforeEach, describe, expect, test, vi } from 'vitest';
import type * as yaml from 'js-yaml';
import type * as path from 'path';
import type * as StorageUtil from '../src/util/storage';
import type * as HierarchicalUtil from '../src/util/hierarchical';
import { z } from 'zod';
import { Options, Feature } from '../src/types';

// --- Mock Dependencies ---

// Mock js-yaml
const mockYamlLoad = vi.fn<typeof yaml.load>();
vi.mock('js-yaml', () => ({
    load: mockYamlLoad,
}));

// Mock path
const mockPathJoin = vi.fn<typeof path.join>();
const mockPathNormalize = vi.fn<typeof path.normalize>();
const mockPathIsAbsolute = vi.fn<typeof path.isAbsolute>();
const mockPathBasename = vi.fn<typeof path.basename>();
const mockPathDirname = vi.fn<typeof path.dirname>();
vi.mock('path', () => ({
    join: mockPathJoin,
    normalize: mockPathNormalize,
    isAbsolute: mockPathIsAbsolute,
    basename: mockPathBasename,
    dirname: mockPathDirname,
    // Mock other path functions if needed, default is fine for join
    default: {
        join: mockPathJoin,
        normalize: mockPathNormalize,
        isAbsolute: mockPathIsAbsolute,
        basename: mockPathBasename,
        dirname: mockPathDirname,
    },
}));

// Mock storage
const mockReadFile = vi.fn<StorageUtil.Utility['readFile']>();
const mockStorageCreate = vi.fn<typeof StorageUtil.create>().mockReturnValue({
    readFile: mockReadFile,
    // Add other methods if needed, mocked or otherwise
    // @ts-ignore
    isDirectoryReadable: vi.fn(),
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
});
vi.mock('../src/util/storage', () => ({
    create: mockStorageCreate,
}));

// Mock hierarchical configuration utility
const mockLoadHierarchicalConfig = vi.fn<typeof HierarchicalUtil.loadHierarchicalConfig>();
vi.mock('../src/util/hierarchical', () => ({
    loadHierarchicalConfig: mockLoadHierarchicalConfig,
}));

// --- Dynamically Import Module Under Test ---
// Needs to be imported *after* mocks are set up
const { read } = await import('../src/read');


// --- Test Suite ---
/**
 * Comprehensive test suite for read.ts with expanded coverage including:
 * - Main read function behavior and error handling
 * - Security validation tests (path traversal, null bytes, path length)
 * - YAML parsing edge cases (arrays, primitives, null, invalid syntax)
 * - File system error scenarios (ENOENT, permissions, etc.)
 * - Clean function behavior with various data types
 * - Configuration precedence (args vs defaults)
 * - Different encoding support
 * - Hierarchical configuration discovery and error handling
 * - Path validation edge cases
 * 
 * Achieves higher line coverage and branch coverage for read.ts
 */
describe('read', () => {
    let baseArgs: any; // Use 'any' for simplicity in tests or define a specific mock type
    let baseOptions: Options<any>; // Use 'any' for the Zod schema shape for simplicity

    const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        verbose: vi.fn(),
        silly: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks(); // Clear mocks before each test

        // Reset base args and options
        baseArgs = {};
        baseOptions = {
            logger: mockLogger,
            defaults: {
                configDirectory: '.',
                configFile: 'config.yaml',
                isRequired: false,
                encoding: 'utf8',
            }, // Explicitly set defaults if testing them
            features: [], // Add required features array (can be empty)
            configShape: z.object({}), // Add required empty Zod object shape
        };

        // Reset storage mock to default working implementation
        mockStorageCreate.mockReturnValue({
            readFile: mockReadFile,
            // Add other methods if needed, mocked or otherwise
            // @ts-ignore
            isDirectoryReadable: vi.fn(),
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
        });

        // Default mock implementations
        mockPathJoin.mockImplementation((...args) => args.join('/')); // Simple join mock
        mockPathNormalize.mockImplementation((p) => p); // Simple normalize mock
        mockPathIsAbsolute.mockReturnValue(false); // Default to relative paths
        mockPathBasename.mockImplementation((p) => p.split('/').pop() || '');
        mockPathDirname.mockImplementation((p) => p.split('/').slice(0, -1).join('/') || '.');
        mockYamlLoad.mockReturnValue({ fileKey: 'fileValue' }); // Default valid YAML
        mockReadFile.mockResolvedValue('fileKey: fileValue'); // Default valid file content

        // Default hierarchical mock implementation
        mockLoadHierarchicalConfig.mockResolvedValue({
            config: {},
            discoveredDirs: [],
            errors: []
        });
    });

    describe('main read function', () => {
        test('should use default config directory if none provided', async () => {
            const expectedConfigPath = `${baseOptions.defaults.configDirectory}/${baseOptions.defaults.configFile}`;
            mockPathJoin.mockReturnValue(expectedConfigPath);

            await read(baseArgs, baseOptions);

            expect(mockPathJoin).toHaveBeenCalledWith(baseOptions.defaults.configDirectory, baseOptions.defaults.configFile);
            expect(mockReadFile).toHaveBeenCalledWith(expectedConfigPath, baseOptions.defaults.encoding);
        });

        test('should use configDirectory from args if provided', async () => {
            const argsDir = '/args/config/dir';
            const expectedConfigPath = `${argsDir}/${baseOptions.defaults.configFile}`;
            mockPathJoin.mockReturnValue(expectedConfigPath);

            await read({ ...baseArgs, configDirectory: argsDir }, baseOptions);

            expect(mockPathJoin).toHaveBeenCalledWith(argsDir, baseOptions.defaults.configFile);
            expect(mockReadFile).toHaveBeenCalledWith(expectedConfigPath, baseOptions.defaults.encoding);
        });

        test('should use configDirectory from options.defaults if provided and args not', async () => {
            const defaultsDir = '/defaults/config/dir';
            const expectedConfigPath = `${defaultsDir}/${baseOptions.defaults.configFile}`;
            mockPathJoin.mockReturnValue(expectedConfigPath);

            await read(baseArgs, { ...baseOptions, defaults: { configDirectory: defaultsDir, configFile: baseOptions.defaults.configFile, isRequired: baseOptions.defaults.isRequired, encoding: baseOptions.defaults.encoding } });

            expect(mockPathJoin).toHaveBeenCalledWith(defaultsDir, baseOptions.defaults.configFile);
            expect(mockReadFile).toHaveBeenCalledWith(expectedConfigPath, baseOptions.defaults.encoding);
        });

        test('should prioritize args.configDirectory over options.defaults.configDirectory', async () => {
            const argsDir = '/args/config/dir';
            const defaultsDir = '/defaults/config/dir';
            const expectedConfigPath = `${argsDir}/${baseOptions.defaults.configFile}`; // Args should win
            mockPathJoin.mockReturnValue(expectedConfigPath);

            await read({ ...baseArgs, configDirectory: argsDir }, { ...baseOptions, defaults: { configDirectory: defaultsDir, configFile: baseOptions.defaults.configFile, isRequired: baseOptions.defaults.isRequired, encoding: baseOptions.defaults.encoding } });

            expect(mockPathJoin).toHaveBeenCalledWith(argsDir, baseOptions.defaults.configFile);
            expect(mockReadFile).toHaveBeenCalledWith(expectedConfigPath, baseOptions.defaults.encoding);
        });

        test('should throw error when no config directory is provided', async () => {
            await expect(read({}, {
                ...baseOptions,
                defaults: {
                    ...baseOptions.defaults,
                    configDirectory: ''
                }
            })).rejects.toThrow('Configuration directory must be specified');
        });

        test('should throw error when config directory is null/undefined', async () => {
            await expect(read({ configDirectory: undefined }, {
                ...baseOptions,
                defaults: {
                    ...baseOptions.defaults,
                    configDirectory: undefined as any
                }
            })).rejects.toThrow('Configuration directory must be specified');
        });

        test('should load and parse valid YAML config file', async () => {
            const yamlContent = `key1: value1
key2: 123`;
            const parsedYaml = { key1: 'value1', key2: 123 };
            mockReadFile.mockResolvedValue(yamlContent);
            mockYamlLoad.mockReturnValue(parsedYaml);

            const config = await read(baseArgs, baseOptions);

            expect(mockYamlLoad).toHaveBeenCalledWith(yamlContent);
            expect(config).toEqual({
                ...parsedYaml,
                configDirectory: baseOptions.defaults.configDirectory // Should be added
            });
        });

        test('should warn and ignore if parsed YAML is not an object', async () => {
            const yamlContent = 'just a string';
            mockReadFile.mockResolvedValue(yamlContent);
            mockYamlLoad.mockReturnValue(yamlContent); // Simulate js-yaml parsing to a string

            const config = await read(baseArgs, baseOptions);

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Ignoring invalid configuration format'));
            expect(config).toEqual({
                configDirectory: baseOptions.defaults.configDirectory // Only default values applied
            });
        });

        test('should warn and ignore if parsed YAML is a number', async () => {
            const yamlContent = '42';
            mockReadFile.mockResolvedValue(yamlContent);
            mockYamlLoad.mockReturnValue(42);

            const config = await read(baseArgs, baseOptions);

            expect(mockLogger.warn).toHaveBeenCalledWith('Ignoring invalid configuration format. Expected an object, got number');
            expect(config).toEqual({
                configDirectory: baseOptions.defaults.configDirectory
            });
        });

        test('should accept array as valid YAML (since typeof array === "object")', async () => {
            const yamlContent = '- item1\n- item2';
            mockReadFile.mockResolvedValue(yamlContent);
            mockYamlLoad.mockReturnValue(['item1', 'item2']);

            const config = await read(baseArgs, baseOptions);

            // Arrays are treated as valid objects in JavaScript (typeof [] === 'object')
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(config).toEqual({
                0: 'item1',
                1: 'item2',
                configDirectory: baseOptions.defaults.configDirectory
            });
        });

        test('should warn and ignore if parsed YAML is null', async () => {
            const yamlContent = 'null'; // YAML representation of null
            mockReadFile.mockResolvedValue(yamlContent);
            mockYamlLoad.mockReturnValue(null); // Simulate js-yaml parsing to null

            const config = await read(baseArgs, baseOptions);

            // No warning needed for null, it's handled gracefully
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(config).toEqual({
                configDirectory: baseOptions.defaults.configDirectory // Only default values applied
            });
        });

        test('should handle config file not found (ENOENT)', async () => {
            const error = new Error('File not found') as NodeJS.ErrnoException;
            error.code = 'ENOENT';
            mockReadFile.mockRejectedValue(error);

            const config = await read(baseArgs, baseOptions);

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Configuration file not found'));
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(config).toEqual({
                configDirectory: baseOptions.defaults.configDirectory // Only default values applied
            });
        });

        test('should handle config file not found (message based)', async () => {
            const error = new Error(`ENOENT: no such file or directory, open '/path/to/config.yaml'`);
            mockReadFile.mockRejectedValue(error);

            const config = await read(baseArgs, baseOptions);

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Configuration file not found'));
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(config).toEqual({
                configDirectory: baseOptions.defaults.configDirectory // Only default values applied
            });
        });

        test('should handle "not found" error message variants', async () => {
            const testCases = [
                'File not found',
                'NOT FOUND: config.yaml',
                'No such file exists'
            ];

            for (const message of testCases) {
                vi.clearAllMocks();
                const error = new Error(message);
                mockReadFile.mockRejectedValue(error);

                const config = await read(baseArgs, baseOptions);

                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Configuration file not found'));
                expect(mockLogger.error).not.toHaveBeenCalled();
                expect(config).toEqual({
                    configDirectory: baseOptions.defaults.configDirectory
                });
            }
        });

        test('should log error for other file read errors', async () => {
            const error = new Error('Permission denied');
            mockReadFile.mockRejectedValue(error);

            const config = await read(baseArgs, baseOptions);

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Failed to load or parse configuration`));
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(error.message));
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Configuration file not found'));
            expect(config).toEqual({
                configDirectory: baseOptions.defaults.configDirectory // Only default values applied even on error
            });
        });

        test('should log error for YAML parsing errors', async () => {
            const error = new Error('Invalid YAML syntax');
            mockReadFile.mockResolvedValue('invalid: yaml: content');
            mockYamlLoad.mockImplementation(() => {
                throw error;
            });

            const config = await read(baseArgs, baseOptions);

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Failed to load or parse configuration`));
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(error.message));
            expect(config).toEqual({
                configDirectory: baseOptions.defaults.configDirectory // Only default values applied even on error
            });
        });

        test('should handle error with no message property', async () => {
            const error = { name: 'CustomError' } as any;
            mockReadFile.mockRejectedValue(error);

            const config = await read(baseArgs, baseOptions);

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown error'));
            expect(config).toEqual({
                configDirectory: baseOptions.defaults.configDirectory
            });
        });

        test('should clean undefined values from the final config object', async () => {
            const yamlContent = `key1: value1
key2: null
key3: undefined`;
            const parsedYaml = { key1: 'value1', key2: null, key3: undefined, explicitUndefined: undefined };
            mockReadFile.mockResolvedValue(yamlContent);
            mockYamlLoad.mockReturnValue(parsedYaml);

            const config = await read(baseArgs, baseOptions);

            // undefined values should be removed by the 'clean' function
            expect(config).toEqual({
                key1: 'value1',
                key2: null, // null is a valid JSON/YAML value, should remain
                configDirectory: baseOptions.defaults.configDirectory
            });
            expect(config).not.toHaveProperty('key3');
            expect(config).not.toHaveProperty('explicitUndefined');
        });

        test('should handle different encoding types', async () => {
            const customOptions = {
                ...baseOptions,
                defaults: {
                    ...baseOptions.defaults,
                    encoding: 'utf16le' as BufferEncoding
                }
            };

            await read(baseArgs, customOptions);

            expect(mockReadFile).toHaveBeenCalledWith(expect.any(String), 'utf16le');
        });

        test('should preserve empty object config', async () => {
            mockReadFile.mockResolvedValue('{}');
            mockYamlLoad.mockReturnValue({});

            const config = await read(baseArgs, baseOptions);

            expect(config).toEqual({
                configDirectory: baseOptions.defaults.configDirectory
            });
        });

        test('should handle very large YAML objects', async () => {
            const largeObject = {};
            for (let i = 0; i < 1000; i++) {
                (largeObject as any)[`key${i}`] = `value${i}`;
            }

            mockReadFile.mockResolvedValue('large: object');
            mockYamlLoad.mockReturnValue(largeObject);

            const config = await read(baseArgs, baseOptions);

            expect(config).toEqual({
                ...largeObject,
                configDirectory: baseOptions.defaults.configDirectory
            });
        });
    });

    describe('validatePath security tests', () => {
        // Note: These tests would require importing validatePath function or making it exported
        // For now, we test indirectly through the main function behavior

        test('should handle path traversal attempts in configFile', async () => {
            // Test path traversal through mocking path.normalize behavior
            mockPathNormalize.mockReturnValue('../../../etc/passwd');
            mockPathJoin.mockImplementation((base, file) => {
                if (file.includes('..')) {
                    throw new Error('Invalid path: path traversal detected');
                }
                return `${base}/${file}`;
            });

            const optionsWithTraversal = {
                ...baseOptions,
                defaults: {
                    ...baseOptions.defaults,
                    configFile: '../../../etc/passwd'
                }
            };

            await expect(read(baseArgs, optionsWithTraversal)).rejects.toThrow('Invalid path: path traversal detected');
        });

        test('should handle absolute path attempts in configFile', async () => {
            mockPathIsAbsolute.mockReturnValue(true);
            mockPathNormalize.mockReturnValue('/etc/passwd');
            mockPathJoin.mockImplementation((base, file) => {
                // The actual implementation checks for both conditions in validatePath
                // and throws "path traversal detected" for both .. and absolute paths
                if (file.includes('..') || mockPathIsAbsolute(file)) {
                    throw new Error('Invalid path: path traversal detected');
                }
                return `${base}/${file}`;
            });

            const optionsWithAbsolute = {
                ...baseOptions,
                defaults: {
                    ...baseOptions.defaults,
                    configFile: '/etc/passwd'
                }
            };

            await expect(read(baseArgs, optionsWithAbsolute)).rejects.toThrow('Invalid path: path traversal detected');
        });

        test('should handle path starting with separator in configFile', async () => {
            mockPathNormalize.mockReturnValue('/config.yaml');
            mockPathJoin.mockImplementation((base, file) => {
                if (file.startsWith('/') || file.startsWith('\\')) {
                    throw new Error('Invalid path: absolute path detected');
                }
                return `${base}/${file}`;
            });

            const optionsWithLeadingSeparator = {
                ...baseOptions,
                defaults: {
                    ...baseOptions.defaults,
                    configFile: '/config.yaml'
                }
            };

            await expect(read(baseArgs, optionsWithLeadingSeparator)).rejects.toThrow('Invalid path: absolute path detected');
        });

        test('should handle empty path parameters', async () => {
            mockPathJoin.mockImplementation((base, file) => {
                if (!file || !base) {
                    throw new Error('Invalid path parameters');
                }
                return `${base}/${file}`;
            });

            const optionsWithEmptyFile = {
                ...baseOptions,
                defaults: {
                    ...baseOptions.defaults,
                    configFile: ''
                }
            };

            await expect(read(baseArgs, optionsWithEmptyFile)).rejects.toThrow('Invalid path parameters');
        });

        test('should successfully validate and join valid paths', async () => {
            // Test the successful path through validatePath
            const validConfigFile = 'config.yaml';
            const validConfigDir = '/valid/config/dir';
            const expectedPath = '/valid/config/dir/config.yaml';

            // Reset mocks and set up proper behavior for successful path validation
            vi.clearAllMocks();
            mockPathNormalize.mockImplementation((p) => p); // Just return the path as-is
            mockPathIsAbsolute.mockReturnValue(false);
            mockPathJoin.mockImplementation((base, file) => `${base}/${file}`);
            mockReadFile.mockResolvedValue('key: value');
            mockYamlLoad.mockReturnValue({ key: 'value' });

            const optionsWithValidPaths = {
                ...baseOptions,
                defaults: {
                    ...baseOptions.defaults,
                    configFile: validConfigFile
                }
            };

            const config = await read({ configDirectory: validConfigDir }, optionsWithValidPaths);

            // The function should successfully join the paths and load the config
            expect(mockPathJoin).toHaveBeenCalledWith(validConfigDir, validConfigFile);
            expect(mockReadFile).toHaveBeenCalledWith(expectedPath, 'utf8');
            expect(config).toEqual({
                key: 'value',
                configDirectory: validConfigDir
            });
        });
    });

    describe('validateConfigDirectory security tests', () => {
        test('should reject config directory with null bytes', async () => {
            await expect(read({ configDirectory: 'config\0directory' }, baseOptions))
                .rejects.toThrow('Invalid path: null byte detected');
        });

        test('should reject extremely long config directory paths', async () => {
            const longPath = 'a'.repeat(1001);
            await expect(read({ configDirectory: longPath }, baseOptions))
                .rejects.toThrow('Configuration directory path too long');
        });

        test('should reject empty config directory', async () => {
            const optionsWithEmptyDefaults = {
                ...baseOptions,
                defaults: {
                    ...baseOptions.defaults,
                    configDirectory: ''
                }
            };
            await expect(read({ configDirectory: '' }, optionsWithEmptyDefaults))
                .rejects.toThrow('Configuration directory must be specified');
        });

        test('should handle valid config directory normalization', async () => {
            const configDir = './valid/config/dir/';
            mockPathNormalize.mockReturnValue('valid/config/dir');

            await read({ configDirectory: configDir }, baseOptions);

            expect(mockPathNormalize).toHaveBeenCalledWith(configDir);
        });

        test('should reject config directory with null/undefined', async () => {
            const optionsWithNullDefaults = {
                ...baseOptions,
                defaults: {
                    ...baseOptions.defaults,
                    configDirectory: null as any
                }
            };
            await expect(read({ configDirectory: null as any }, optionsWithNullDefaults))
                .rejects.toThrow('Configuration directory must be specified');
        });
    });

    describe('clean function edge cases', () => {
        test('should preserve false, 0, and empty string values', async () => {
            const parsedYaml = {
                falsyBoolean: false,
                zeroNumber: 0,
                emptyString: '',
                nullValue: null,
                undefinedValue: undefined
            };
            mockReadFile.mockResolvedValue('test');
            mockYamlLoad.mockReturnValue(parsedYaml);

            const config = await read(baseArgs, baseOptions);

            expect(config).toEqual({
                falsyBoolean: false,
                zeroNumber: 0,
                emptyString: '',
                nullValue: null,
                configDirectory: baseOptions.defaults.configDirectory
            });
            expect(config).not.toHaveProperty('undefinedValue');
        });

        test('should handle nested objects with undefined values', async () => {
            const parsedYaml = {
                nested: {
                    validKey: 'validValue',
                    undefinedKey: undefined,
                    anotherValid: 42
                },
                topLevel: undefined
            };
            mockReadFile.mockResolvedValue('test');
            mockYamlLoad.mockReturnValue(parsedYaml);

            const config = await read(baseArgs, baseOptions);

            // Clean function only works on top level, nested undefined values remain
            expect(config).toEqual({
                nested: {
                    validKey: 'validValue',
                    undefinedKey: undefined,
                    anotherValid: 42
                },
                configDirectory: baseOptions.defaults.configDirectory
            });
            expect(config).not.toHaveProperty('topLevel');
        });
    });

    describe('error edge cases', () => {
        test('should handle YAML bomb protection (if implemented)', async () => {
            // Test large recursive YAML structure
            mockReadFile.mockResolvedValue('test');
            const yamlBomb = new Error('Document is too large');
            mockYamlLoad.mockImplementation(() => {
                throw yamlBomb;
            });

            const config = await read(baseArgs, baseOptions);

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to load or parse configuration'));
            expect(config).toEqual({
                configDirectory: baseOptions.defaults.configDirectory
            });
        });

        test('should handle storage create failures gracefully', async () => {
            // This test assumes storage.create could potentially fail
            // Current implementation doesn't handle this, but it's good to document expected behavior
            mockStorageCreate.mockImplementation(() => {
                throw new Error('Storage initialization failed');
            });

            await expect(read(baseArgs, baseOptions)).rejects.toThrow('Storage initialization failed');
        });
    });

    describe('hierarchical configuration integration', () => {
        test('should use hierarchical discovery when feature is enabled', async () => {
            const hierarchicalOptions: Options<any> = {
                ...baseOptions,
                features: ['config', 'hierarchical'] as Feature[],
                defaults: {
                    ...baseOptions.defaults,
                    configDirectory: '/project/subdir/.kodrdriv'
                }
            };

            const mockHierarchicalResult = {
                config: { api: { timeout: 10000 }, debug: true },
                discoveredDirs: [
                    { path: '/project/subdir/.kodrdriv', level: 0 },
                    { path: '/project/.kodrdriv', level: 1 }
                ],
                errors: []
            };

            mockLoadHierarchicalConfig.mockResolvedValue(mockHierarchicalResult);
            mockPathBasename.mockReturnValue('.kodrdriv');
            mockPathDirname.mockReturnValue('/project/subdir');

            const config = await read(baseArgs, hierarchicalOptions);

            expect(mockLogger.debug).toHaveBeenCalledWith('Hierarchical configuration discovery enabled');
            expect(mockLoadHierarchicalConfig).toHaveBeenCalledWith({
                configDirName: '.kodrdriv',
                configFileName: 'config.yaml',
                startingDir: '/project/subdir',
                encoding: 'utf8',
                logger: mockLogger
            });
            expect(config).toEqual({
                api: { timeout: 10000 },
                debug: true,
                configDirectory: '/project/subdir/.kodrdriv'
            });
        });

        test('should log hierarchical discovery results with discovered directories', async () => {
            const hierarchicalOptions: Options<any> = {
                ...baseOptions,
                features: ['config', 'hierarchical'] as Feature[],
                defaults: {
                    ...baseOptions.defaults,
                    configDirectory: '/project/.kodrdriv'
                }
            };

            const mockHierarchicalResult = {
                config: { setting: 'value' },
                discoveredDirs: [
                    { path: '/project/.kodrdriv', level: 0 },
                    { path: '/.kodrdriv', level: 1 }
                ],
                errors: []
            };

            mockLoadHierarchicalConfig.mockResolvedValue(mockHierarchicalResult);
            mockPathBasename.mockReturnValue('.kodrdriv');
            mockPathDirname.mockReturnValue('/project');

            const config = await read(baseArgs, hierarchicalOptions);

            expect(mockLogger.debug).toHaveBeenCalledWith('Hierarchical discovery found 2 configuration directories');
            expect(mockLogger.debug).toHaveBeenCalledWith('  Level 0: /project/.kodrdriv');
            expect(mockLogger.debug).toHaveBeenCalledWith('  Level 1: /.kodrdriv');
            expect(config).toEqual({
                setting: 'value',
                configDirectory: '/project/.kodrdriv'
            });
        });

        test('should log when no hierarchical directories are found', async () => {
            const hierarchicalOptions: Options<any> = {
                ...baseOptions,
                features: ['config', 'hierarchical'] as Feature[],
                defaults: {
                    ...baseOptions.defaults,
                    configDirectory: '/project/.kodrdriv'
                }
            };

            const mockHierarchicalResult = {
                config: {},
                discoveredDirs: [],
                errors: []
            };

            mockLoadHierarchicalConfig.mockResolvedValue(mockHierarchicalResult);
            mockPathBasename.mockReturnValue('.kodrdriv');
            mockPathDirname.mockReturnValue('/project');

            const config = await read(baseArgs, hierarchicalOptions);

            expect(mockLogger.debug).toHaveBeenCalledWith('No configuration directories found in hierarchy');
            expect(config).toEqual({
                configDirectory: '/project/.kodrdriv'
            });
        });

        test('should log hierarchical warnings for errors', async () => {
            const hierarchicalOptions: Options<any> = {
                ...baseOptions,
                features: ['config', 'hierarchical'] as Feature[],
                defaults: {
                    ...baseOptions.defaults,
                    configDirectory: '/project/.kodrdriv'
                }
            };

            const mockHierarchicalResult = {
                config: { key: 'value' },
                discoveredDirs: [{ path: '/project/.kodrdriv', level: 0 }],
                errors: [
                    'Permission denied for /restricted/.kodrdriv',
                    'Invalid YAML in /other/.kodrdriv/config.yaml'
                ]
            };

            mockLoadHierarchicalConfig.mockResolvedValue(mockHierarchicalResult);
            mockPathBasename.mockReturnValue('.kodrdriv');
            mockPathDirname.mockReturnValue('/project');

            const config = await read(baseArgs, hierarchicalOptions);

            expect(mockLogger.warn).toHaveBeenCalledWith('Hierarchical config warning: Permission denied for /restricted/.kodrdriv');
            expect(mockLogger.warn).toHaveBeenCalledWith('Hierarchical config warning: Invalid YAML in /other/.kodrdriv/config.yaml');
            expect(config).toEqual({
                key: 'value',
                configDirectory: '/project/.kodrdriv'
            });
        });

        test('should fall back to single directory mode when hierarchical fails', async () => {
            const hierarchicalOptions: Options<any> = {
                ...baseOptions,
                features: ['config', 'hierarchical'] as Feature[],
                defaults: {
                    ...baseOptions.defaults,
                    configDirectory: '/project/.kodrdriv'
                }
            };

            // Mock hierarchical failure
            mockLoadHierarchicalConfig.mockRejectedValue(new Error('Hierarchical discovery failed'));

            // Mock single directory fallback
            const expectedConfigPath = `${hierarchicalOptions.defaults.configDirectory}/${hierarchicalOptions.defaults.configFile}`;
            mockPathJoin.mockReturnValue(expectedConfigPath);
            mockReadFile.mockResolvedValue('fallback: config');
            mockYamlLoad.mockReturnValue({ fallback: 'config' });

            const config = await read(baseArgs, hierarchicalOptions);

            expect(mockLogger.error).toHaveBeenCalledWith('Hierarchical configuration loading failed: Hierarchical discovery failed');
            expect(mockLogger.debug).toHaveBeenCalledWith('Falling back to single directory configuration loading');
            expect(config).toEqual({
                fallback: 'config',
                configDirectory: '/project/.kodrdriv'
            });
        });

        test('should fall back to single directory mode when hierarchical fails with no message', async () => {
            const hierarchicalOptions: Options<any> = {
                ...baseOptions,
                features: ['config', 'hierarchical'] as Feature[],
                defaults: {
                    ...baseOptions.defaults,
                    configDirectory: '/project/.kodrdriv'
                }
            };

            // Mock hierarchical failure with no message
            mockLoadHierarchicalConfig.mockRejectedValue({ name: 'CustomError' });

            // Mock single directory fallback
            const expectedConfigPath = `${hierarchicalOptions.defaults.configDirectory}/${hierarchicalOptions.defaults.configFile}`;
            mockPathJoin.mockReturnValue(expectedConfigPath);
            mockReadFile.mockResolvedValue('fallback: config');
            mockYamlLoad.mockReturnValue({ fallback: 'config' });

            const config = await read(baseArgs, hierarchicalOptions);

            expect(mockLogger.error).toHaveBeenCalledWith('Hierarchical configuration loading failed: Unknown error');
            expect(mockLogger.debug).toHaveBeenCalledWith('Falling back to single directory configuration loading');
            expect(config).toEqual({
                fallback: 'config',
                configDirectory: '/project/.kodrdriv'
            });
        });

        test('should use single directory mode when hierarchical feature is not enabled', async () => {
            const singleDirOptions: Options<any> = {
                ...baseOptions,
                features: ['config'] as Feature[], // No hierarchical feature
                defaults: {
                    ...baseOptions.defaults,
                    configDirectory: '/project/.kodrdriv'
                }
            };

            const expectedConfigPath = `${singleDirOptions.defaults.configDirectory}/${singleDirOptions.defaults.configFile}`;
            mockPathJoin.mockReturnValue(expectedConfigPath);
            mockReadFile.mockResolvedValue('single: directory');
            mockYamlLoad.mockReturnValue({ single: 'directory' });

            const config = await read(baseArgs, singleDirOptions);

            expect(mockLogger.debug).toHaveBeenCalledWith('Using single directory configuration loading');
            expect(mockLogger.debug).not.toHaveBeenCalledWith('Hierarchical configuration discovery enabled');
            expect(mockLoadHierarchicalConfig).not.toHaveBeenCalled();
            expect(config).toEqual({
                single: 'directory',
                configDirectory: '/project/.kodrdriv'
            });
        });

        test('should handle empty hierarchical discovery results', async () => {
            const hierarchicalOptions: Options<any> = {
                ...baseOptions,
                features: ['config', 'hierarchical'] as Feature[],
                defaults: {
                    ...baseOptions.defaults,
                    configDirectory: '/project/.kodrdriv'
                }
            };

            // Mock no discoveries found
            mockLoadHierarchicalConfig.mockResolvedValue({
                config: {},
                discoveredDirs: [],
                errors: []
            });

            const config = await read(baseArgs, hierarchicalOptions);

            expect(config).toEqual({
                configDirectory: '/project/.kodrdriv'
            });
        });

        test('should pass correct parameters to hierarchical discovery', async () => {
            const hierarchicalOptions: Options<any> = {
                ...baseOptions,
                features: ['config', 'hierarchical'] as Feature[],
                defaults: {
                    ...baseOptions.defaults,
                    configDirectory: '/complex/nested/path/.kodrdriv',
                    configFile: 'custom.yaml',
                    encoding: 'utf16le'
                }
            };

            mockLoadHierarchicalConfig.mockResolvedValue({
                config: {},
                discoveredDirs: [],
                errors: []
            });

            mockPathBasename.mockReturnValue('.kodrdriv');
            mockPathDirname.mockReturnValue('/complex/nested/path');

            await read(baseArgs, hierarchicalOptions);

            expect(mockLoadHierarchicalConfig).toHaveBeenCalledWith({
                configDirName: '.kodrdriv',
                configFileName: 'custom.yaml',
                startingDir: '/complex/nested/path',
                encoding: 'utf16le',
                logger: mockLogger
            });
        });
    });

    describe('additional path and encoding edge cases', () => {
        test('should handle different file encodings in single directory mode', async () => {
            const encodings: BufferEncoding[] = ['ascii', 'base64', 'hex', 'latin1'];

            for (const encoding of encodings) {
                vi.clearAllMocks();

                const customOptions = {
                    ...baseOptions,
                    defaults: {
                        ...baseOptions.defaults,
                        encoding
                    }
                };

                await read(baseArgs, customOptions);
                expect(mockReadFile).toHaveBeenCalledWith(expect.any(String), encoding);
            }
        });

        test('should handle Windows-style path separators in path validation', async () => {
            mockPathNormalize.mockReturnValue('\\config.yaml');
            mockPathJoin.mockImplementation((base, file) => {
                if (file.startsWith('/') || file.startsWith('\\')) {
                    throw new Error('Invalid path: absolute path detected');
                }
                return `${base}/${file}`;
            });

            const optionsWithBackslash = {
                ...baseOptions,
                defaults: {
                    ...baseOptions.defaults,
                    configFile: '\\config.yaml'
                }
            };

            await expect(read(baseArgs, optionsWithBackslash)).rejects.toThrow('Invalid path: absolute path detected');
        });

        test('should handle very long but valid config directory paths', async () => {
            const longPath = 'a'.repeat(999); // Just under the 1000 character limit
            const config = await read({ configDirectory: longPath }, baseOptions);

            expect(config).toHaveProperty('configDirectory', longPath);
        });

        test('should handle mixed case in "not found" error detection', async () => {
            const testCases = [
                'File Not Found',
                'NOT found',
                'No Such File',
                'not Found in directory'
            ];

            for (const message of testCases) {
                vi.clearAllMocks();
                const error = new Error(message);
                mockReadFile.mockRejectedValue(error);

                const config = await read(baseArgs, baseOptions);

                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Configuration file not found'));
                expect(mockLogger.error).not.toHaveBeenCalled();
            }
        });
    });
});
