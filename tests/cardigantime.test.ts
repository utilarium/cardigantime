import { describe, expect, beforeEach, test, vi } from 'vitest';
import type { Command } from 'commander';
import { z } from 'zod';
import { DefaultOptions, Logger, Feature, Args } from '../src/types';

// --- Mock Dependencies ---

// Mock the imported modules
vi.mock('../src/configure', () => ({
    configure: vi.fn().mockResolvedValue({} as Command),
}));

vi.mock('../src/validate', () => ({
    validate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/read', () => ({
    read: vi.fn().mockResolvedValue({}),
}));

// Mock yaml module
vi.mock('js-yaml', () => ({
    dump: vi.fn().mockReturnValue('mocked yaml content\n'),
}));

// Mock storage utility
const mockStorage = {
    exists: vi.fn(),
    isDirectoryWritable: vi.fn(),
    createDirectory: vi.fn(),
    writeFile: vi.fn(),
};

vi.mock('../src/util/storage', () => ({
    create: vi.fn(() => mockStorage),
}));

// Mock schema defaults utility
vi.mock('../src/util/schema-defaults', () => ({
    generateDefaultConfig: vi.fn().mockReturnValue({ test: 'default' }),
}));

// --- Dynamically Import Module Under Test ---
const { create } = await import('../src/cardigantime');
const { configure } = await import('../src/configure');
const { validate } = await import('../src/validate');
const { read } = await import('../src/read');

// --- Test Suite ---

describe('cardigantime', () => {
    let mockLogger: Logger;
    let mockCommand: Command;
    let baseConfigShape: z.ZodObject<{ testField: z.ZodString }>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mock logger
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            verbose: vi.fn(),
            silly: vi.fn(),
        };

        // Setup mock command
        mockCommand = {} as Command;

        // Setup test config shape
        baseConfigShape = z.object({
            testField: z.string(),
        });
    });

    describe('create function', () => {
        test('should create cardigantime instance with minimal required options', () => {
            const result = create({
                defaults: {
                    configDirectory: '/test/config',
                },
                configShape: baseConfigShape.shape,
            });

            expect(result).toBeDefined();
            expect(typeof result.configure).toBe('function');
            expect(typeof result.validate).toBe('function');
            expect(typeof result.read).toBe('function');
            expect(typeof result.setLogger).toBe('function');
            expect(typeof result.generateConfig).toBe('function');
        });

        test('should create cardigantime instance with all options provided', () => {
            const customFeatures: Feature[] = ['config'];
            const customDefaults: Pick<DefaultOptions, 'configDirectory'> & Partial<Omit<DefaultOptions, 'configDirectory'>> = {
                configDirectory: '/custom/config',
                configFile: 'custom.yaml',
                isRequired: true,
                encoding: 'utf-16',
            };

            const result = create({
                defaults: customDefaults,
                features: customFeatures,
                configShape: baseConfigShape.shape,
                logger: mockLogger,
            });

            expect(result).toBeDefined();
            expect(typeof result.configure).toBe('function');
            expect(typeof result.validate).toBe('function');
            expect(typeof result.read).toBe('function');
            expect(typeof result.setLogger).toBe('function');
            expect(typeof result.generateConfig).toBe('function');
        });

        test('should merge defaults with DEFAULT_OPTIONS correctly', () => {
            const partialDefaults = {
                configDirectory: '/test/config',
                configFile: 'test.yaml',
            };

            const result = create({
                defaults: partialDefaults,
                configShape: baseConfigShape.shape,
            });

            // Test that the instance was created successfully
            expect(result).toBeDefined();

            // We can't directly test the merged defaults, but we can test
            // that the methods are callable (which would fail if defaults weren't merged properly)
            expect(() => result.configure(mockCommand)).not.toThrow();
        });

        test('should use DEFAULT_FEATURES when features not provided', () => {
            const result = create({
                defaults: {
                    configDirectory: '/test/config',
                },
                configShape: baseConfigShape.shape,
            });

            expect(result).toBeDefined();
        });

        test('should use DEFAULT_LOGGER when logger not provided', () => {
            const result = create({
                defaults: {
                    configDirectory: '/test/config',
                },
                configShape: baseConfigShape.shape,
            });

            expect(result).toBeDefined();
        });

        test('should use provided logger when given', () => {
            const result = create({
                defaults: {
                    configDirectory: '/test/config',
                },
                configShape: baseConfigShape.shape,
                logger: mockLogger,
            });

            expect(result).toBeDefined();
        });
    });

    describe('returned instance methods', () => {
        let instance: any; // Use any to avoid complex generic type constraints in tests

        beforeEach(() => {
            instance = create({
                defaults: {
                    configDirectory: '/test/config',
                },
                configShape: baseConfigShape.shape,
                logger: mockLogger,
            });
        });

        describe('setLogger', () => {
            test('should update logger when setLogger is called', () => {
                const newLogger: Logger = {
                    debug: vi.fn(),
                    info: vi.fn(),
                    warn: vi.fn(),
                    error: vi.fn(),
                    verbose: vi.fn(),
                    silly: vi.fn(),
                };

                // Should not throw
                expect(() => instance.setLogger(newLogger)).not.toThrow();
            });
        });

        describe('configure', () => {
            test('should call configure function with command and options', async () => {
                await instance.configure(mockCommand);

                expect(configure).toHaveBeenCalledTimes(1);
                expect(configure).toHaveBeenCalledWith(mockCommand, expect.objectContaining({
                    defaults: expect.any(Object),
                    features: expect.any(Array),
                    configShape: expect.any(Object),
                    logger: mockLogger,
                }));
            });

            test('should return the result from configure function', async () => {
                const expectedResult = { test: 'command' } as unknown as Command;
                vi.mocked(configure).mockResolvedValueOnce(expectedResult);

                const result = await instance.configure(mockCommand);

                expect(result).toBe(expectedResult);
            });
        });

        describe('validate', () => {
            test('should call validate function with config and options', async () => {
                const testConfig = { configDirectory: '/test', testField: 'value' };

                await instance.validate(testConfig);

                expect(validate).toHaveBeenCalledTimes(1);
                expect(validate).toHaveBeenCalledWith(testConfig, expect.objectContaining({
                    defaults: expect.any(Object),
                    features: expect.any(Array),
                    configShape: expect.any(Object),
                    logger: mockLogger,
                }));
            });
        });

        describe('read', () => {
            test('should call read function with args and options', async () => {
                const testArgs: Args = { configDirectory: '/test/config' };

                await instance.read(testArgs);

                expect(read).toHaveBeenCalledTimes(1);
                expect(read).toHaveBeenCalledWith(testArgs, expect.objectContaining({
                    defaults: expect.any(Object),
                    features: expect.any(Array),
                    configShape: expect.any(Object),
                    logger: mockLogger,
                }));
            });

            test('should return the result from read function', async () => {
                const expectedResult = { configDirectory: '/test', testField: 'value' };
                vi.mocked(read).mockResolvedValueOnce(expectedResult);

                const testArgs: Args = { configDirectory: '/test/config' };
                const result = await instance.read(testArgs);

                expect(result).toBe(expectedResult);
            });
        });

        describe('generateConfig', () => {
            beforeEach(() => {
                // Reset all mocks before each test
                vi.clearAllMocks();
                mockStorage.exists.mockResolvedValue(false);
                mockStorage.isDirectoryWritable.mockResolvedValue(true);
                mockStorage.createDirectory.mockResolvedValue(undefined);
                mockStorage.writeFile.mockResolvedValue(undefined);
            });

            test('should generate config file successfully', async () => {
                mockStorage.exists.mockResolvedValueOnce(false); // Directory doesn't exist
                mockStorage.exists.mockResolvedValueOnce(false); // Config file doesn't exist

                await instance.generateConfig();

                expect(mockStorage.createDirectory).toHaveBeenCalledWith('/test/config');
                expect(mockStorage.writeFile).toHaveBeenCalledWith(
                    '/test/config/config.yaml',
                    expect.stringContaining('# Configuration file generated by Cardigantime'),
                    'utf8'
                );
                expect(mockLogger.info).toHaveBeenCalledWith('Creating configuration directory: /test/config');
                expect(mockLogger.info).toHaveBeenCalledWith('Configuration file generated successfully: /test/config/config.yaml');
            });

            test('should use custom config directory when provided', async () => {
                const customDir = '/custom/config';
                mockStorage.exists.mockResolvedValueOnce(false); // Directory doesn't exist
                mockStorage.exists.mockResolvedValueOnce(false); // Config file doesn't exist

                await instance.generateConfig(customDir);

                expect(mockStorage.createDirectory).toHaveBeenCalledWith(customDir);
                expect(mockStorage.writeFile).toHaveBeenCalledWith(
                    '/custom/config/config.yaml',
                    expect.stringContaining('# Configuration file generated by Cardigantime'),
                    'utf8'
                );
            });

            test('should not create directory if it already exists', async () => {
                mockStorage.exists.mockResolvedValueOnce(true); // Directory exists
                mockStorage.exists.mockResolvedValueOnce(false); // Config file doesn't exist

                await instance.generateConfig();

                expect(mockStorage.createDirectory).not.toHaveBeenCalled();
                expect(mockStorage.writeFile).toHaveBeenCalled();
            });

            test('should show default config content if config file already exists', async () => {
                mockStorage.exists.mockResolvedValueOnce(true); // Directory exists
                mockStorage.exists.mockResolvedValueOnce(true); // Config file exists

                await instance.generateConfig();

                expect(mockStorage.writeFile).not.toHaveBeenCalled();
                expect(mockLogger.warn).toHaveBeenCalledWith('Configuration file already exists: /test/config/config.yaml');
                expect(mockLogger.warn).toHaveBeenCalledWith('This file was not overwritten, but here is what the default configuration looks like if you want to copy it:');
                expect(mockLogger.info).toHaveBeenCalledWith('\n' + '='.repeat(60));
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('# Configuration file generated by Cardigantime'));
                expect(mockLogger.info).toHaveBeenCalledWith('='.repeat(60));
            });

            test('should throw error if directory is not writable', async () => {
                mockStorage.exists.mockResolvedValueOnce(true); // Directory exists
                mockStorage.isDirectoryWritable.mockResolvedValueOnce(false); // Directory not writable

                await expect(instance.generateConfig()).rejects.toThrow('Configuration directory is not writable');
            });

            test('should throw error if directory creation fails', async () => {
                const error = new Error('Permission denied');
                mockStorage.exists.mockResolvedValueOnce(false); // Directory doesn't exist
                mockStorage.createDirectory.mockRejectedValueOnce(error);

                await expect(instance.generateConfig()).rejects.toThrow();
            });

            test('should throw error if file write fails', async () => {
                const error = new Error('Disk full');
                mockStorage.exists.mockResolvedValueOnce(true); // Directory exists
                mockStorage.exists.mockResolvedValueOnce(false); // Config file doesn't exist
                mockStorage.writeFile.mockRejectedValueOnce(error);

                await expect(instance.generateConfig()).rejects.toThrow();
            });

            test('should include proper YAML content with header', async () => {
                mockStorage.exists.mockResolvedValueOnce(true); // Directory exists
                mockStorage.exists.mockResolvedValueOnce(false); // Config file doesn't exist

                await instance.generateConfig();

                expect(mockStorage.writeFile).toHaveBeenCalledWith(
                    '/test/config/config.yaml',
                    expect.stringMatching(/^# Configuration file generated by Cardigantime\n/),
                    'utf8'
                );
            });
        });
    });

    describe('logger updates', () => {
        test('should update logger in options when setLogger is called', async () => {
            const instance = create({
                defaults: {
                    configDirectory: '/test/config',
                },
                configShape: baseConfigShape.shape,
                logger: mockLogger,
            });

            const newLogger: Logger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
                verbose: vi.fn(),
                silly: vi.fn(),
            };

            // Update logger
            instance.setLogger(newLogger);

            // Test that the new logger is used in subsequent calls
            await instance.configure(mockCommand);

            expect(configure).toHaveBeenCalledWith(mockCommand, expect.objectContaining({
                logger: newLogger,
            }));
        });
    });

    describe('type safety with different config shapes', () => {
        test('should work with simple config shape', () => {
            const simpleShape = z.object({
                name: z.string(),
            });

            const result = create({
                defaults: {
                    configDirectory: '/test/config',
                },
                configShape: simpleShape.shape,
            });

            expect(result).toBeDefined();
        });

        test('should work with complex config shape', () => {
            const complexShape = z.object({
                database: z.object({
                    host: z.string(),
                    port: z.number(),
                }),
                features: z.array(z.string()),
                debug: z.boolean().optional(),
            });

            const result = create({
                defaults: {
                    configDirectory: '/test/config',
                },
                configShape: complexShape.shape,
            });

            expect(result).toBeDefined();
        });

        test('should work with empty config shape', () => {
            const emptyShape = z.object({});

            const result = create({
                defaults: {
                    configDirectory: '/test/config',
                },
                configShape: emptyShape.shape,
            });

            expect(result).toBeDefined();
        });
    });

    describe('options passing', () => {
        test('should pass all options correctly to dependent functions', async () => {
            const customFeatures: Feature[] = ['config'];
            const customDefaults = {
                configDirectory: '/custom/config',
                configFile: 'custom.yaml',
                isRequired: true,
                encoding: 'utf-16',
            };

            const instance = create({
                defaults: customDefaults,
                features: customFeatures,
                configShape: baseConfigShape.shape,
                logger: mockLogger,
            });

            const testArgs: Args = { configDirectory: '/test' };
            const testConfig = { configDirectory: '/test', testField: 'value' };

            // Test all methods to ensure they receive correct options
            await instance.configure(mockCommand);
            await instance.validate(testConfig);
            await instance.read(testArgs);

            // Verify each function was called with the expected options structure
            const expectedOptions = expect.objectContaining({
                defaults: expect.objectContaining(customDefaults),
                features: customFeatures,
                configShape: baseConfigShape.shape,
                logger: mockLogger,
            });

            expect(configure).toHaveBeenCalledWith(mockCommand, expectedOptions);
            expect(validate).toHaveBeenCalledWith(testConfig, expectedOptions);
            expect(read).toHaveBeenCalledWith(testArgs, expectedOptions);
        });
    });
}); 