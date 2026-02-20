import { z } from 'zod';
import { PathSecurityOptions } from './types';

/**
 * Default path security options for securePath schema.
 */
const DEFAULT_PATH_OPTIONS: PathSecurityOptions = {
    maxPathLength: 500,
    allowHiddenFiles: false,
    allowAbsolutePaths: true,
};

/**
 * Path traversal patterns to detect.
 */
const TRAVERSAL_PATTERNS = [
    /\.\.\//,          // Unix-style traversal
    /\.\.\\/,          // Windows-style traversal
    /%2e%2e/i,         // URL-encoded dots (..)
    /%2e\./i,          // Mixed: %2e.
    /\.%2e/i,          // Mixed: .%2e
    /\.\.%2f/i,        // Mixed encoding
    /\.\.%5c/i,        // Mixed encoding
];

/**
 * Create a Zod schema for secure path validation.
 * 
 * @param options - Path security options
 * @returns Zod string schema with path security refinements
 * 
 * @example
 * ```typescript
 * const schema = z.object({
 *   configFile: securePath({ 
 *     allowedExtensions: ['.yaml', '.json'],
 *     maxPathLength: 200 
 *   }),
 * });
 * ```
 */
export function securePath(options: Partial<PathSecurityOptions> = {}) {
    const opts = { ...DEFAULT_PATH_OPTIONS, ...options };

    return z.string()
        .max(opts.maxPathLength ?? 500, {
            message: `Path exceeds maximum length of ${opts.maxPathLength} characters`,
        })
        .refine(
            (path) => !path.includes('\0'),
            { message: 'Path contains null bytes' }
        )
        .refine(
            // eslint-disable-next-line no-control-regex
            (path) => !/[\x00-\x1f\x7f]/.test(path),
            { message: 'Path contains control characters' }
        )
        .refine(
            (path) => !TRAVERSAL_PATTERNS.some(pattern => pattern.test(path)),
            { message: 'Path contains directory traversal sequences' }
        )
        .refine(
            (path) => {
                if (!opts.allowHiddenFiles) {
                    const basename = path.split(/[/\\]/).pop() || '';
                    return !basename.startsWith('.');
                }
                return true;
            },
            { message: 'Hidden files are not allowed' }
        )
        .refine(
            (path) => {
                if (!opts.allowAbsolutePaths) {
                    return !path.startsWith('/') && !path.match(/^[A-Za-z]:\\/);
                }
                return true;
            },
            { message: 'Absolute paths are not allowed' }
        )
        .refine(
            (path) => {
                if (opts.allowedExtensions && opts.allowedExtensions.length > 0) {
                    const ext = path.match(/\.[^.]+$/)?.[0]?.toLowerCase();
                    if (ext && !opts.allowedExtensions.includes(ext)) {
                        return false;
                    }
                }
                return true;
            },
            { 
                message: `File extension not allowed. Allowed: ${opts.allowedExtensions?.join(', ') || 'any'}` 
            }
        )
        .refine(
            (path) => {
                if (opts.allowedBaseDirs && opts.allowedBaseDirs.length > 0) {
                    return opts.allowedBaseDirs.some(base => 
                        path.startsWith(base) || path === base
                    );
                }
                return true;
            },
            { 
                message: `Path must be within allowed directories: ${opts.allowedBaseDirs?.join(', ') || 'any'}` 
            }
        );
}

/**
 * Create a Zod schema for secure directory path validation.
 * Same as securePath but with directory-specific defaults.
 */
export function secureDirectory(options: Partial<PathSecurityOptions> = {}) {
    return securePath({
        allowedExtensions: [], // Directories don't have extensions
        ...options,
    });
}

