/**
 * Directory Traversal Security
 * 
 * Implements security boundaries for directory traversal to prevent
 * configuration lookup from accessing sensitive directories.
 * 
 * @module discovery/traversal-security
 */

import * as path from 'node:path';
import * as os from 'node:os';
import {
    TraversalBoundary,
    TraversalCheckResult,
    TraversalSecurityOptions,
    Logger,
} from '../types';

/**
 * Default logger that does nothing (no-op).
 */
const noopLogger: Logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    verbose: () => {},
    silly: () => {},
};

/**
 * Platform-specific forbidden directories.
 * These are system directories that should never be accessed by config traversal.
 */
const UNIX_FORBIDDEN = [
    '/etc',
    '/usr',
    '/var',
    '/sys',
    '/proc',
    '/bin',
    '/sbin',
    '/lib',
    '/lib64',
    '/opt',
    '/root',
    '$HOME/.ssh',
    '$HOME/.gnupg',
    '$HOME/.aws',
    '$HOME/.config/gcloud',
];

const WINDOWS_FORBIDDEN = [
    'C:\\Windows',
    'C:\\Windows\\System32',
    'C:\\Program Files',
    'C:\\Program Files (x86)',
    '$HOME\\.ssh',
    '$HOME\\.aws',
];

/**
 * Gets platform-specific forbidden directories.
 * Filters out any forbidden path that matches the current user's home directory,
 * since the home directory must remain accessible for config traversal.
 */
function getPlatformForbidden(): string[] {
    const rawList = process.platform === 'win32' ? WINDOWS_FORBIDDEN : UNIX_FORBIDDEN;
    const home = os.homedir();

    // Filter out forbidden entries that would block the user's own home directory.
    // This handles the case where a user is root (/root is in the forbidden list)
    // or has a home directory within a system path.
    return rawList.filter(entry => {
        const expanded = expandEnvironmentVariables(entry);
        const resolved = path.resolve(expanded);
        return resolved !== home;
    });
}

/**
 * Gets platform-specific soft boundaries.
 */
function getPlatformBoundaries(): string[] {
    if (process.platform === 'win32') {
        return ['$HOME', 'C:\\Users'];
    }
    return ['$HOME', '/tmp', '/private/tmp', '/Users'];
}

/**
 * Default traversal boundaries.
 * These provide safe defaults for most use cases.
 */
export const DEFAULT_TRAVERSAL_BOUNDARY: TraversalBoundary = {
    forbidden: getPlatformForbidden(),
    boundaries: getPlatformBoundaries(),
    maxAbsoluteDepth: 20,
    maxRelativeDepth: 10,
};

/**
 * Expands environment variable placeholders in a path.
 * Supports $HOME, $USER, and $TMPDIR.
 * 
 * @param pathStr - Path string with potential variable placeholders
 * @returns Expanded path string
 */
export function expandEnvironmentVariables(pathStr: string): string {
    const home = os.homedir();
    const tmpDir = os.tmpdir();

    // os.userInfo() can throw in some container environments
    let user: string;
    try {
        user = os.userInfo().username;
    } catch {
        user = process.env.USER || process.env.USERNAME || 'unknown';
    }

    return pathStr
        .replace(/\$HOME/g, home)
        .replace(/%HOME%/gi, home)
        .replace(/%USERPROFILE%/gi, home)
        .replace(/\$USER/g, user)
        .replace(/\$TMPDIR/g, tmpDir)
        .replace(/%TEMP%/gi, tmpDir)
        .replace(/%TMP%/gi, tmpDir);
}

/**
 * Normalizes a path for comparison.
 * Resolves to absolute path and normalizes separators.
 * 
 * @param pathStr - Path to normalize
 * @returns Normalized absolute path
 */
export function normalizePath(pathStr: string): string {
    const expanded = expandEnvironmentVariables(pathStr);
    return path.resolve(expanded);
}

/**
 * Calculates the depth of a path (number of segments from root).
 * 
 * @param pathStr - Absolute path
 * @returns Number of path segments
 * 
 * @example
 * ```typescript
 * getPathDepth('/'); // 0
 * getPathDepth('/home'); // 1
 * getPathDepth('/home/user/project'); // 3
 * ```
 */
export function getPathDepth(pathStr: string): number {
    const normalized = path.resolve(pathStr);
    const root = path.parse(normalized).root;
    
    if (normalized === root) {
        return 0;
    }
    
    // Remove the root and count remaining segments
    const relativePart = normalized.slice(root.length);
    const segments = relativePart.split(path.sep).filter(s => s.length > 0);
    
    return segments.length;
}

/**
 * Checks if a path is at or within a boundary path.
 * 
 * @param checkPath - Path to check
 * @param boundaryPath - Boundary path
 * @returns True if checkPath is at or within boundaryPath
 */
export function isPathWithin(checkPath: string, boundaryPath: string): boolean {
    const normalizedCheck = normalizePath(checkPath);
    const normalizedBoundary = normalizePath(boundaryPath);
    
    // Exact match
    if (normalizedCheck === normalizedBoundary) {
        return true;
    }
    
    // Check if checkPath is a child of boundaryPath
    const relative = path.relative(normalizedBoundary, normalizedCheck);
    
    // If the relative path starts with '..', checkPath is not within boundaryPath
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return false;
    }
    
    return true;
}

/**
 * Checks if a path is at or above a boundary path.
 * Used to check if traversal would go beyond soft boundaries.
 * 
 * @param checkPath - Path to check
 * @param boundaryPath - Boundary path
 * @returns True if checkPath is at or above (parent of) boundaryPath
 */
export function isPathAtOrAbove(checkPath: string, boundaryPath: string): boolean {
    const normalizedCheck = normalizePath(checkPath);
    const normalizedBoundary = normalizePath(boundaryPath);
    
    // Exact match
    if (normalizedCheck === normalizedBoundary) {
        return true;
    }
    
    // Check if boundaryPath is within checkPath (meaning checkPath is above boundaryPath)
    const relative = path.relative(normalizedCheck, normalizedBoundary);
    
    // If the relative path doesn't start with '..', boundaryPath is within checkPath
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
        return true;
    }
    
    return false;
}

/**
 * Checks if a path is allowed according to traversal boundaries.
 * 
 * @param pathToCheck - Path to check
 * @param boundary - Traversal boundaries to enforce
 * @param startPath - Optional starting path for relative depth calculation
 * @returns Check result with allowed status and reason
 * 
 * @example
 * ```typescript
 * const result = checkTraversalBoundary('/etc/passwd', DEFAULT_TRAVERSAL_BOUNDARY);
 * if (!result.allowed) {
 *   console.error(`Access denied: ${result.reason}`);
 * }
 * ```
 */
export function checkTraversalBoundary(
    pathToCheck: string,
    boundary: TraversalBoundary,
    startPath?: string
): TraversalCheckResult {
    const normalizedPath = normalizePath(pathToCheck);
    
    // Check forbidden directories
    for (const forbidden of boundary.forbidden) {
        const normalizedForbidden = normalizePath(forbidden);
        
        if (isPathWithin(normalizedPath, normalizedForbidden)) {
            return {
                allowed: false,
                reason: `Path '${normalizedPath}' is within forbidden directory '${normalizedForbidden}'`,
                violatedBoundary: normalizedForbidden,
            };
        }
        
        // Also check if the path equals the forbidden (at the boundary exactly)
        if (normalizedPath === normalizedForbidden) {
            return {
                allowed: false,
                reason: `Path '${normalizedPath}' is a forbidden directory`,
                violatedBoundary: normalizedForbidden,
            };
        }
    }
    
    // Check absolute depth
    const depth = getPathDepth(normalizedPath);
    if (depth > boundary.maxAbsoluteDepth) {
        return {
            allowed: false,
            reason: `Path depth (${depth}) exceeds maximum absolute depth (${boundary.maxAbsoluteDepth})`,
        };
    }
    
    // Check relative depth if start path is provided
    if (startPath) {
        const normalizedStart = normalizePath(startPath);
        const startDepth = getPathDepth(normalizedStart);
        const pathDepth = getPathDepth(normalizedPath);
        
        // If pathToCheck is above startPath, calculate the relative depth
        if (pathDepth < startDepth) {
            const relativeDepth = startDepth - pathDepth;
            if (relativeDepth > boundary.maxRelativeDepth) {
                return {
                    allowed: false,
                    reason: `Relative traversal depth (${relativeDepth}) exceeds maximum (${boundary.maxRelativeDepth})`,
                };
            }
        }
    }
    
    return { allowed: true };
}

/**
 * Resolves traversal boundaries with defaults.
 * 
 * @param options - User-provided options
 * @returns Complete traversal boundary configuration
 */
export function resolveTraversalBoundary(
    options?: Partial<TraversalBoundary>
): TraversalBoundary {
    return {
        forbidden: options?.forbidden ?? DEFAULT_TRAVERSAL_BOUNDARY.forbidden,
        boundaries: options?.boundaries ?? DEFAULT_TRAVERSAL_BOUNDARY.boundaries,
        maxAbsoluteDepth: options?.maxAbsoluteDepth ?? DEFAULT_TRAVERSAL_BOUNDARY.maxAbsoluteDepth,
        maxRelativeDepth: options?.maxRelativeDepth ?? DEFAULT_TRAVERSAL_BOUNDARY.maxRelativeDepth,
    };
}

/**
 * Creates a boundary checker function with the specified options.
 * Useful for repeated checks with the same configuration.
 * 
 * @param options - Security options
 * @param logger - Optional logger
 * @returns Boundary checker function
 * 
 * @example
 * ```typescript
 * const checker = createBoundaryChecker({ allowUnsafeTraversal: false });
 * 
 * const result = checker('/path/to/check', '/start/path');
 * if (!result.allowed) {
 *   console.error(result.reason);
 * }
 * ```
 */
export function createBoundaryChecker(
    options: TraversalSecurityOptions = {},
    logger: Logger = noopLogger
): (pathToCheck: string, startPath?: string) => TraversalCheckResult {
    const {
        boundaries,
        allowUnsafeTraversal = false,
        warnOnOverride = true,
    } = options;
    
    const resolvedBoundary = resolveTraversalBoundary(boundaries);
    
    if (allowUnsafeTraversal && warnOnOverride) {
        logger.warn(
            'SECURITY WARNING: Unsafe traversal is enabled. ' +
            'This bypasses security boundaries and allows access to sensitive directories.'
        );
    }
    
    return (pathToCheck: string, startPath?: string): TraversalCheckResult => {
        if (allowUnsafeTraversal) {
            logger.debug(`Unsafe traversal enabled, allowing: ${pathToCheck}`);
            return { allowed: true };
        }
        
        const result = checkTraversalBoundary(pathToCheck, resolvedBoundary, startPath);
        
        if (!result.allowed) {
            logger.debug(`Traversal blocked: ${result.reason}`);
        }
        
        return result;
    };
}

/**
 * Filters an array of paths to only include those within traversal boundaries.
 * 
 * @param paths - Paths to filter
 * @param options - Security options
 * @param startPath - Starting path for relative depth calculation
 * @param logger - Optional logger
 * @returns Filtered array of allowed paths
 */
export function filterAllowedPaths(
    paths: string[],
    options: TraversalSecurityOptions = {},
    startPath?: string,
    logger: Logger = noopLogger
): string[] {
    const checker = createBoundaryChecker(options, logger);
    
    return paths.filter(p => {
        const result = checker(p, startPath);
        if (!result.allowed) {
            logger.debug(`Filtered out path: ${p} (${result.reason})`);
        }
        return result.allowed;
    });
}
