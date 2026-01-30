import * as path from 'node:path';
import * as fs from 'node:fs';
import { PathSecurityOptions, SecurityValidationError } from './types';

/**
 * All known path traversal patterns including encoded variants.
 * Note: No global flag to avoid state persistence issues with .test()
 */
const TRAVERSAL_PATTERNS = [
    /\.\.\//,               // Unix parent: ../
    /\.\.\\/,               // Windows parent: ..\
    /%2e%2e/i,             // URL encoded: %2e%2e
    /%252e%252e/i,         // Double encoded
    /\.%2e/i,              // Mixed: .%2e
    /%2e\./i,              // Mixed: %2e.
    /\.\.[/\\]/,           // Standard variants
];

/**
 * Null byte and special character patterns.
 * These patterns intentionally match control characters for security validation.
 * Note: No global flag to avoid state persistence issues with .test()
 */
/* eslint-disable no-control-regex */
const DANGEROUS_CHARS = [
    /\0/,                   // Null byte (truncation attacks)
    /[\x00-\x1f]/,         // Control characters
];
/* eslint-enable no-control-regex */

/**
 * PathGuard provides comprehensive path security validation.
 */
export class PathGuard {
    private options: PathSecurityOptions;
    private resolvedBaseDirs: string[] = [];

    constructor(options: Partial<PathSecurityOptions> = {}) {
        this.options = {
            maxPathLength: 500,
            allowHiddenFiles: false,
            validateSymlinks: true,
            allowAbsolutePaths: true,
            ...options,
        };

        // Pre-resolve base directories for efficient comparison
        if (this.options.allowedBaseDirs) {
            this.resolvedBaseDirs = this.options.allowedBaseDirs.map(dir => 
                path.resolve(dir)
            );
        }
    }

    /**
   * Validate a path for security issues.
   * 
   * @param inputPath - The path to validate
   * @param operation - The intended operation (for error messages)
   * @returns The validated and normalized path
   * @throws Error if validation fails
   */
    validate(inputPath: string, operation: string = 'access'): string {
        const errors: SecurityValidationError[] = [];

        // Check for dangerous characters first (before any path operations)
        this.checkDangerousChars(inputPath, errors);

        // Check path length
        this.checkPathLength(inputPath, errors);

        // Check for traversal patterns in the raw input
        this.checkTraversalPatterns(inputPath, errors);

        // Check absolute path policy
        this.checkAbsolutePath(inputPath, errors);

        if (errors.length > 0) {
            throw this.createError(errors, operation);
        }

        // Normalize and resolve the path
        const normalizedPath = path.normalize(inputPath);
        const resolvedPath = path.resolve(inputPath);

        // Check for traversal after normalization (catches edge cases)
        this.checkTraversalAfterNormalize(inputPath, normalizedPath, resolvedPath, errors);

        // Check hidden files
        this.checkHiddenFiles(normalizedPath, errors);

        // Check file extension
        this.checkExtension(normalizedPath, errors);

        // Check base directory constraints
        this.checkBaseDirConstraints(resolvedPath, errors);

        // Check symlinks if enabled and path exists
        if (this.options.validateSymlinks) {
            this.checkSymlinks(resolvedPath, errors);
        }

        if (errors.length > 0) {
            throw this.createError(errors, operation);
        }

        return normalizedPath;
    }

    /**
   * Validate a path or throw with security error details.
   */
    validateOrThrow(inputPath: string, operation: string = 'access'): string {
        return this.validate(inputPath, operation);
    }

    /**
   * Validate a path and return result without throwing.
   */
    validateSafe(inputPath: string): { valid: boolean; path?: string; errors: SecurityValidationError[] } {
        try {
            const validPath = this.validate(inputPath);
            return { valid: true, path: validPath, errors: [] };
        } catch (error: unknown) {
            const err = error as { errors?: SecurityValidationError[]; message?: string };
            return { 
                valid: false, 
                errors: err.errors || [{ 
                    field: 'path', 
                    message: err.message || 'Unknown error', 
                    code: 'VALIDATION_FAILED',
                    source: 'unknown'
                }] 
            };
        }
    }

    private checkDangerousChars(inputPath: string, errors: SecurityValidationError[]): void {
        for (const pattern of DANGEROUS_CHARS) {
            if (pattern.test(inputPath)) {
                errors.push({
                    field: 'path',
                    message: 'Path contains dangerous characters',
                    code: 'PATH_TRAVERSAL',
                    value: this.sanitizeForError(inputPath),
                    source: 'unknown',
                });
                break;
            }
        }
    }

    private checkPathLength(inputPath: string, errors: SecurityValidationError[]): void {
        if (inputPath.length > (this.options.maxPathLength || 500)) {
            errors.push({
                field: 'path',
                message: `Path exceeds maximum length of ${this.options.maxPathLength} characters`,
                code: 'PATH_TOO_LONG',
                source: 'unknown',
            });
        }
    }

    private checkTraversalPatterns(inputPath: string, errors: SecurityValidationError[]): void {
        for (const pattern of TRAVERSAL_PATTERNS) {
            if (pattern.test(inputPath)) {
                errors.push({
                    field: 'path',
                    message: 'Path contains directory traversal sequences',
                    code: 'PATH_TRAVERSAL',
                    value: this.sanitizeForError(inputPath),
                    source: 'unknown',
                });
                break;
            }
        }
    }

    private checkAbsolutePath(inputPath: string, errors: SecurityValidationError[]): void {
        if (!this.options.allowAbsolutePaths) {
            const isAbsolute = path.isAbsolute(inputPath) || /^[A-Za-z]:[\\/]/.test(inputPath);
            if (isAbsolute) {
                errors.push({
                    field: 'path',
                    message: 'Absolute paths are not allowed',
                    code: 'PATH_ABSOLUTE_NOT_ALLOWED',
                    source: 'unknown',
                });
            }
        }
    }

    private checkTraversalAfterNormalize(
        inputPath: string, 
        normalizedPath: string, 
        _resolvedPath: string,
        errors: SecurityValidationError[]
    ): void {
    // If normalization significantly changed the path, suspicious
        const originalSegments = inputPath.split(/[/\\]/).length;
        const normalizedSegments = normalizedPath.split(/[/\\]/).length;
    
        if (normalizedSegments < originalSegments - 2) {
            errors.push({
                field: 'path',
                message: 'Path normalization detected potential traversal',
                code: 'PATH_TRAVERSAL',
                value: this.sanitizeForError(inputPath),
                source: 'unknown',
            });
        }
    }

    private checkHiddenFiles(normalizedPath: string, errors: SecurityValidationError[]): void {
        if (!this.options.allowHiddenFiles) {
            const segments = normalizedPath.split(/[/\\]/);
            for (const segment of segments) {
                if (segment.startsWith('.') && segment !== '.' && segment !== '..') {
                    errors.push({
                        field: 'path',
                        message: 'Hidden files and directories are not allowed',
                        code: 'PATH_HIDDEN_FILE',
                        source: 'unknown',
                    });
                    break;
                }
            }
        }
    }

    private checkExtension(normalizedPath: string, errors: SecurityValidationError[]): void {
        if (this.options.allowedExtensions && this.options.allowedExtensions.length > 0) {
            const ext = path.extname(normalizedPath).toLowerCase();
            // Only check if there is an extension (directories won't have one)
            if (ext && !this.options.allowedExtensions.includes(ext)) {
                errors.push({
                    field: 'path',
                    message: `File extension "${ext}" is not allowed. Allowed: ${this.options.allowedExtensions.join(', ')}`,
                    code: 'PATH_INVALID_EXTENSION',
                    source: 'unknown',
                });
            }
        }
    }

    private checkBaseDirConstraints(resolvedPath: string, errors: SecurityValidationError[]): void {
        if (this.resolvedBaseDirs.length > 0) {
            const isWithinAllowed = this.resolvedBaseDirs.some(baseDir => {
                const relative = path.relative(baseDir, resolvedPath);
                // Path is within base if relative path doesn't start with .. and isn't absolute
                return !relative.startsWith('..') && !path.isAbsolute(relative);
            });

            if (!isWithinAllowed) {
                errors.push({
                    field: 'path',
                    message: 'Path is outside allowed directories',
                    code: 'PATH_OUTSIDE_ALLOWED',
                    source: 'unknown',
                });
            }
        }
    }

    private checkSymlinks(resolvedPath: string, errors: SecurityValidationError[]): void {
        try {
            // Only check if the path exists
            if (fs.existsSync(resolvedPath)) {
                const realPath = fs.realpathSync(resolvedPath);
        
                // If the real path is different after symlink resolution, validate it too
                if (realPath !== resolvedPath && this.resolvedBaseDirs.length > 0) {
                    const isRealPathAllowed = this.resolvedBaseDirs.some(baseDir => {
                        const relative = path.relative(baseDir, realPath);
                        return !relative.startsWith('..') && !path.isAbsolute(relative);
                    });

                    if (!isRealPathAllowed) {
                        errors.push({
                            field: 'path',
                            message: 'Symlink target is outside allowed directories',
                            code: 'PATH_SYMLINK_ESCAPE',
                            source: 'unknown',
                        });
                    }
                }
            }
        } catch {
            // File doesn't exist or can't be accessed - that's okay for validation
        }
    }

    private sanitizeForError(value: string): string {
    // Sanitize value for error messages to prevent log injection
    // eslint-disable-next-line no-control-regex
        return value.substring(0, 100).replace(/[\x00-\x1f]/g, '?');
    }

    private createError(errors: SecurityValidationError[], operation: string): Error {
        const error = new Error(
            `Path security validation failed for ${operation}: ${errors.map(e => e.message).join('; ')}`
        );
        (error as { errors?: SecurityValidationError[]; code?: string }).errors = errors;
        (error as { errors?: SecurityValidationError[]; code?: string }).code = 'PATH_SECURITY_ERROR';
        return error;
    }
}

/**
 * Global PathGuard instance with default options.
 */
let defaultPathGuard: PathGuard | null = null;

/**
 * Get the default PathGuard instance.
 */
export function getPathGuard(): PathGuard {
    if (!defaultPathGuard) {
        defaultPathGuard = new PathGuard();
    }
    return defaultPathGuard;
}

/**
 * Create a new PathGuard with custom options.
 */
export function createPathGuard(options: Partial<PathSecurityOptions>): PathGuard {
    return new PathGuard(options);
}

/**
 * Configure the default PathGuard instance.
 */
export function configurePathGuard(options: Partial<PathSecurityOptions>): void {
    defaultPathGuard = new PathGuard(options);
}

