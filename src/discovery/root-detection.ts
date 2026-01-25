/**
 * Root Detection Module
 * 
 * Detects project root directories by looking for marker files or directories.
 * Used by hierarchical configuration to determine traversal boundaries.
 * 
 * @module discovery/root-detection
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { RootMarker, DEFAULT_ROOT_MARKERS, Logger } from '../types';

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
 * Checks if a root marker exists in the specified directory.
 * 
 * @param directory - Directory to check
 * @param marker - Root marker to look for
 * @returns True if the marker exists
 */
async function markerExists(directory: string, marker: RootMarker): Promise<boolean> {
    const markerPath = path.join(directory, marker.name);
    
    try {
        const stats = await fs.promises.stat(markerPath);
        
        if (marker.type === 'file' && stats.isFile()) {
            return true;
        }
        if (marker.type === 'directory' && stats.isDirectory()) {
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Result of root detection operation.
 */
export interface RootDetectionResult {
    /** Whether a root was found */
    found: boolean;
    /** Path to the detected root directory (if found) */
    rootPath?: string;
    /** The marker that triggered root detection (if found) */
    matchedMarker?: RootMarker;
}

/**
 * Checks if a directory is a project root based on the presence of root markers.
 * 
 * @param directory - Directory to check
 * @param markers - Root markers to look for (defaults to DEFAULT_ROOT_MARKERS)
 * @param logger - Optional logger for debug output
 * @returns True if the directory contains any of the root markers
 * 
 * @example
 * ```typescript
 * const isRoot = await isProjectRoot('/path/to/dir');
 * // Returns true if directory contains package.json, .git, etc.
 * ```
 */
export async function isProjectRoot(
    directory: string,
    markers: RootMarker[] = DEFAULT_ROOT_MARKERS,
    logger: Logger = noopLogger
): Promise<boolean> {
    logger.silly(`Checking if ${directory} is a project root`);
    
    for (const marker of markers) {
        if (await markerExists(directory, marker)) {
            logger.debug(`Found root marker '${marker.name}' in ${directory}`);
            return true;
        }
    }
    
    return false;
}

/**
 * Finds the project root by walking up from the starting directory.
 * 
 * @param startPath - Starting directory for the search
 * @param markers - Root markers to look for (defaults to DEFAULT_ROOT_MARKERS)
 * @param maxDepth - Maximum number of directories to traverse (default: 20)
 * @param logger - Optional logger for debug output
 * @returns Detection result with the root path if found
 * 
 * @example
 * ```typescript
 * const result = await findProjectRoot('/path/to/deep/nested/dir');
 * if (result.found) {
 *   console.log(`Project root: ${result.rootPath}`);
 *   console.log(`Detected by: ${result.matchedMarker?.name}`);
 * }
 * ```
 */
export async function findProjectRoot(
    startPath: string,
    markers: RootMarker[] = DEFAULT_ROOT_MARKERS,
    maxDepth: number = 20,
    logger: Logger = noopLogger
): Promise<RootDetectionResult> {
    logger.debug(`Finding project root from: ${startPath}`);
    
    if (markers.length === 0) {
        logger.debug('No root markers configured, skipping root detection');
        return { found: false };
    }
    
    let currentDir = path.resolve(startPath);
    let depth = 0;
    const visited = new Set<string>();
    
    while (depth < maxDepth) {
        // Prevent infinite loops with symlinks
        if (visited.has(currentDir)) {
            logger.debug(`Already visited ${currentDir}, stopping root detection`);
            break;
        }
        visited.add(currentDir);
        
        logger.silly(`Checking directory for root markers: ${currentDir}`);
        
        // Check each marker
        for (const marker of markers) {
            if (await markerExists(currentDir, marker)) {
                logger.info(`Found project root at ${currentDir} (marker: ${marker.name})`);
                return {
                    found: true,
                    rootPath: currentDir,
                    matchedMarker: marker,
                };
            }
        }
        
        // Move up one directory
        const parentDir = path.dirname(currentDir);
        
        // Check if we've reached the filesystem root
        if (parentDir === currentDir) {
            logger.debug('Reached filesystem root, no project root found');
            break;
        }
        
        currentDir = parentDir;
        depth++;
    }
    
    if (depth >= maxDepth) {
        logger.debug(`Reached max depth (${maxDepth}), no project root found`);
    }
    
    return { found: false };
}

/**
 * Checks if a directory name is in the stop-at list.
 * 
 * @param directory - Directory path to check
 * @param stopAtNames - List of directory names to stop at
 * @returns True if the directory should stop traversal
 * 
 * @example
 * ```typescript
 * const shouldStop = shouldStopAt('/path/to/node_modules/pkg', ['node_modules', 'vendor']);
 * // Returns false (parent 'node_modules' triggers stop, but current dir is 'pkg')
 * 
 * const shouldStop2 = shouldStopAt('/path/to/node_modules', ['node_modules', 'vendor']);
 * // Returns true (current directory is 'node_modules')
 * ```
 */
export function shouldStopAt(directory: string, stopAtNames: string[]): boolean {
    if (stopAtNames.length === 0) {
        return false;
    }
    
    const dirName = path.basename(directory);
    return stopAtNames.includes(dirName);
}

/**
 * Walks up the directory tree, checking each directory against root markers and stop conditions.
 * Yields each directory until a stop condition is met.
 * 
 * @param startPath - Starting directory
 * @param options - Walk options
 * @param logger - Optional logger
 * @yields Directory paths from start to root/stop condition
 * 
 * @example
 * ```typescript
 * for await (const dir of walkUpToRoot('/path/to/start', { maxDepth: 5 })) {
 *   console.log(`Processing: ${dir}`);
 * }
 * ```
 */
export async function* walkUpToRoot(
    startPath: string,
    options: {
        maxDepth?: number;
        rootMarkers?: RootMarker[];
        stopAt?: string[];
        stopAtRoot?: boolean;
    } = {},
    logger: Logger = noopLogger
): AsyncGenerator<string, void, undefined> {
    const {
        maxDepth = 10,
        rootMarkers = DEFAULT_ROOT_MARKERS,
        stopAt = [],
        stopAtRoot = true,
    } = options;
    
    let currentDir = path.resolve(startPath);
    let depth = 0;
    const visited = new Set<string>();
    
    while (depth < maxDepth) {
        // Prevent infinite loops with symlinks
        if (visited.has(currentDir)) {
            logger.debug(`Already visited ${currentDir}, stopping walk`);
            break;
        }
        visited.add(currentDir);
        
        // Check stop-at condition (before yielding)
        if (shouldStopAt(currentDir, stopAt)) {
            logger.debug(`Stopping at directory: ${currentDir} (in stop-at list)`);
            break;
        }
        
        // Yield current directory
        yield currentDir;
        
        // Check if this is a project root
        if (rootMarkers.length > 0) {
            const isRoot = await isProjectRoot(currentDir, rootMarkers, logger);
            if (isRoot && stopAtRoot) {
                logger.debug(`Stopping at project root: ${currentDir}`);
                break;
            }
        }
        
        // Move up one directory
        const parentDir = path.dirname(currentDir);
        
        // Check if we've reached the filesystem root
        if (parentDir === currentDir) {
            logger.debug('Reached filesystem root');
            break;
        }
        
        currentDir = parentDir;
        depth++;
    }
    
    if (depth >= maxDepth) {
        logger.debug(`Reached max depth: ${maxDepth}`);
    }
}

/**
 * Gets all directories from start to root (or stop condition) as an array.
 * Convenience wrapper around walkUpToRoot for when you need all directories at once.
 * 
 * @param startPath - Starting directory
 * @param options - Walk options
 * @param logger - Optional logger
 * @returns Array of directory paths
 */
export async function getDirectoriesToRoot(
    startPath: string,
    options: {
        maxDepth?: number;
        rootMarkers?: RootMarker[];
        stopAt?: string[];
        stopAtRoot?: boolean;
    } = {},
    logger: Logger = noopLogger
): Promise<string[]> {
    const directories: string[] = [];
    
    for await (const dir of walkUpToRoot(startPath, options, logger)) {
        directories.push(dir);
    }
    
    return directories;
}
