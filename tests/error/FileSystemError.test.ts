import { describe, expect, it } from 'vitest';
import { FileSystemError } from '../../src/error/FileSystemError';

describe('FileSystemError', () => {
    it('should create a FileSystemError with correct properties', () => {
        const originalError = new Error('Original error');
        const error = new FileSystemError('not_found', 'File not found', '/test/path', 'read', originalError);

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('FileSystemError');
        expect(error.message).toBe('File not found');
        expect(error.errorType).toBe('not_found');
        expect(error.path).toBe('/test/path');
        expect(error.operation).toBe('read');
        expect(error.originalError).toBe(originalError);
    });

    it('should create a directory not found error using static method', () => {
        const error = FileSystemError.directoryNotFound('/config', false);

        expect(error.errorType).toBe('not_found');
        expect(error.message).toBe('Configuration directory not found');
        expect(error.path).toBe('/config');
        expect(error.operation).toBe('directory_access');
    });

    it('should create a required directory not found error using static method', () => {
        const error = FileSystemError.directoryNotFound('/config', true);

        expect(error.errorType).toBe('not_found');
        expect(error.message).toBe('Configuration directory does not exist and is required');
        expect(error.path).toBe('/config');
        expect(error.operation).toBe('directory_access');
    });

    it('should create a directory not readable error using static method', () => {
        const error = FileSystemError.directoryNotReadable('/restricted');

        expect(error.errorType).toBe('not_readable');
        expect(error.message).toBe('Configuration directory exists but is not readable');
        expect(error.path).toBe('/restricted');
        expect(error.operation).toBe('directory_read');
    });

    it('should create a directory creation failed error using static method', () => {
        const originalError = new Error('Permission denied');
        const error = FileSystemError.directoryCreationFailed('/output', originalError);

        expect(error.errorType).toBe('creation_failed');
        expect(error.message).toBe('Failed to create directory: Permission denied');
        expect(error.path).toBe('/output');
        expect(error.operation).toBe('directory_create');
        expect(error.originalError).toBe(originalError);
    });

    it('should create an operation failed error using static method', () => {
        const originalError = new Error('Glob failed');
        const error = FileSystemError.operationFailed('glob pattern *.js', '/src', originalError);

        expect(error.errorType).toBe('operation_failed');
        expect(error.message).toBe('Failed to glob pattern *.js: Glob failed');
        expect(error.path).toBe('/src');
        expect(error.operation).toBe('glob pattern *.js');
        expect(error.originalError).toBe(originalError);
    });

    it('should create a directory creation failed error with default fallback message', () => {
        const errorWithNoMsg = new Error();
        const error = FileSystemError.directoryCreationFailed('/output', errorWithNoMsg);

        expect(error.errorType).toBe('creation_failed');
        expect(error.message).toBe('Failed to create directory: Unknown error');
        expect(error.path).toBe('/output');
        expect(error.operation).toBe('directory_create');
        expect(error.originalError).toBe(errorWithNoMsg);
    });

    it('should create an operation failed error with default fallback message', () => {
        const errorWithNoMsg = new Error();
        const error = FileSystemError.operationFailed('read', '/src', errorWithNoMsg);

        expect(error.errorType).toBe('operation_failed');
        expect(error.message).toBe('Failed to read: Unknown error');
        expect(error.path).toBe('/src');
        expect(error.operation).toBe('read');
        expect(error.originalError).toBe(errorWithNoMsg);
    });

    it('should create a file not found error using static method', () => {
        const error = FileSystemError.fileNotFound('/config/app.yaml');

        expect(error.errorType).toBe('not_found');
        expect(error.message).toBe('Configuration file not found');
        expect(error.path).toBe('/config/app.yaml');
        expect(error.operation).toBe('file_read');
    });

    it('should work without optional parameters', () => {
        const error = new FileSystemError('not_found', 'Simple error', '/path', 'operation');

        expect(error.errorType).toBe('not_found');
        expect(error.message).toBe('Simple error');
        expect(error.path).toBe('/path');
        expect(error.operation).toBe('operation');
        expect(error.originalError).toBeUndefined();
    });

    it('should be catchable as different error types', () => {
        const error = FileSystemError.fileNotFound('/config');

        expect(error instanceof Error).toBe(true);
        expect(error instanceof FileSystemError).toBe(true);
    });
}); 