import { describe, expect, it } from 'vitest';
import { ArgumentError, ConfigurationError, FileSystemError } from '../../src/error/index';

describe('Error Index Exports', () => {
    describe('ArgumentError export', () => {
        it('should export ArgumentError class correctly', () => {
            expect(ArgumentError).toBeDefined();
            expect(typeof ArgumentError).toBe('function');
        });

        it('should create ArgumentError instances through index export', () => {
            const error = new ArgumentError('testArg', 'Test message');

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(ArgumentError);
            expect(error.name).toBe('ArgumentError');
            expect(error.message).toBe('Test message');
            expect(error.argument).toBe('testArg');
        });

        it('should provide the same ArgumentError class as direct import', async () => {
            const { ArgumentError: DirectArgumentError } = await import('../../src/error/ArgumentError');
            expect(ArgumentError).toBe(DirectArgumentError);
        });
    });

    describe('ConfigurationError export', () => {
        it('should export ConfigurationError class correctly', () => {
            expect(ConfigurationError).toBeDefined();
            expect(typeof ConfigurationError).toBe('function');
        });

        it('should create ConfigurationError instances through index export', () => {
            const error = new ConfigurationError('validation', 'Test message', { detail: 'test' }, '/config');

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(ConfigurationError);
            expect(error.name).toBe('ConfigurationError');
            expect(error.message).toBe('Test message');
            expect(error.errorType).toBe('validation');
            expect(error.details).toEqual({ detail: 'test' });
            expect(error.configPath).toBe('/config');
        });

        it('should provide static methods through index export', () => {
            const validationError = ConfigurationError.validation('Validation failed');
            const extraKeysError = ConfigurationError.extraKeys(['unknown'], ['known']);
            const schemaError = ConfigurationError.schema('Schema invalid');

            expect(validationError.errorType).toBe('validation');
            expect(extraKeysError.errorType).toBe('extra_keys');
            expect(schemaError.errorType).toBe('schema');
        });

        it('should provide the same ConfigurationError class as direct import', async () => {
            const { ConfigurationError: DirectConfigurationError } = await import('../../src/error/ConfigurationError');
            expect(ConfigurationError).toBe(DirectConfigurationError);
        });
    });

    describe('FileSystemError export', () => {
        it('should export FileSystemError class correctly', () => {
            expect(FileSystemError).toBeDefined();
            expect(typeof FileSystemError).toBe('function');
        });

        it('should create FileSystemError instances through index export', () => {
            const originalError = new Error('Original');
            const error = new FileSystemError('not_found', 'File not found', '/path', 'read', originalError);

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(FileSystemError);
            expect(error.name).toBe('FileSystemError');
            expect(error.message).toBe('File not found');
            expect(error.errorType).toBe('not_found');
            expect(error.path).toBe('/path');
            expect(error.operation).toBe('read');
            expect(error.originalError).toBe(originalError);
        });

        it('should provide static methods through index export', () => {
            const dirNotFound = FileSystemError.directoryNotFound('/config');
            const dirNotReadable = FileSystemError.directoryNotReadable('/restricted');
            const fileNotFound = FileSystemError.fileNotFound('/file.txt');
            const operationFailed = FileSystemError.operationFailed('copy', '/src', new Error('Failed'));
            const creationFailed = FileSystemError.directoryCreationFailed('/new', new Error('Permission denied'));

            expect(dirNotFound.errorType).toBe('not_found');
            expect(dirNotReadable.errorType).toBe('not_readable');
            expect(fileNotFound.errorType).toBe('not_found');
            expect(operationFailed.errorType).toBe('operation_failed');
            expect(creationFailed.errorType).toBe('creation_failed');
        });

        it('should provide the same FileSystemError class as direct import', async () => {
            const { FileSystemError: DirectFileSystemError } = await import('../../src/error/FileSystemError');
            expect(FileSystemError).toBe(DirectFileSystemError);
        });
    });

    describe('All exports together', () => {
        it('should export exactly three error classes', () => {
            const exports = { ArgumentError, ConfigurationError, FileSystemError };
            const exportNames = Object.keys(exports);

            expect(exportNames).toHaveLength(3);
            expect(exportNames).toContain('ArgumentError');
            expect(exportNames).toContain('ConfigurationError');
            expect(exportNames).toContain('FileSystemError');
        });

        it('should allow instanceof checks for all error types', () => {
            const argError = new ArgumentError('test', 'message');
            const configError = new ConfigurationError('validation', 'message');
            const fsError = new FileSystemError('not_found', 'message', '/path', 'operation');

            // Check they are instances of their specific types
            expect(argError instanceof ArgumentError).toBe(true);
            expect(configError instanceof ConfigurationError).toBe(true);
            expect(fsError instanceof FileSystemError).toBe(true);

            // Check they are all instances of Error
            expect(argError instanceof Error).toBe(true);
            expect(configError instanceof Error).toBe(true);
            expect(fsError instanceof Error).toBe(true);

            // Check cross-instance checks are false
            expect(argError instanceof ConfigurationError).toBe(false);
            expect(argError instanceof FileSystemError).toBe(false);
            expect(configError instanceof ArgumentError).toBe(false);
            expect(configError instanceof FileSystemError).toBe(false);
            expect(fsError instanceof ArgumentError).toBe(false);
            expect(fsError instanceof ConfigurationError).toBe(false);
        });

        it('should allow error type checking in catch blocks', () => {
            const errors = [
                new ArgumentError('arg', 'message'),
                new ConfigurationError('validation', 'message'),
                new FileSystemError('not_found', 'message', '/path', 'op')
            ];

            errors.forEach(error => {
                try {
                    throw error;
                } catch (caught) {
                    expect(caught instanceof Error).toBe(true);

                    if (caught instanceof ArgumentError) {
                        expect(caught.argument).toBeDefined();
                    } else if (caught instanceof ConfigurationError) {
                        expect(caught.errorType).toBeDefined();
                    } else if (caught instanceof FileSystemError) {
                        expect(caught.path).toBeDefined();
                        expect(caught.operation).toBeDefined();
                    }
                }
            });
        });
    });
});
