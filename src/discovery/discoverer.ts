/**
 * Configuration Discovery Implementation
 * 
 * Discovers configuration files using multiple naming patterns,
 * checking each pattern in priority order.
 * 
 * @module discovery/discoverer
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    ConfigDiscoveryOptions,
    ConfigNamingPattern,
    DiscoveredConfig,
    DiscoveryResult,
    Logger,
    MultipleConfigWarning,
} from '../types';
import { STANDARD_PATTERNS, DEFAULT_EXTENSIONS, expandPattern } from './patterns';

/**
 * Internal type for tracking discovery candidates.
 */
interface DiscoveryCandidate {
    relativePath: string;
    absolutePath: string;
    pattern: ConfigNamingPattern;
    extension: string | undefined;
}

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
 * Checks if a file exists at the given path.
 * 
 * @param filePath - Path to check
 * @returns True if file exists and is accessible
 */
async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.promises.access(filePath, fs.constants.R_OK);
        const stats = await fs.promises.stat(filePath);
        return stats.isFile();
    } catch {
        return false;
    }
}

/**
 * Generates all discovery candidates for a set of patterns and extensions.
 * Candidates are sorted by pattern priority.
 * 
 * @param directory - Base directory to search in
 * @param appName - Application name for pattern expansion
 * @param patterns - Patterns to use for discovery
 * @param extensions - File extensions to search for
 * @param searchHidden - Whether to include hidden patterns
 * @returns Array of discovery candidates sorted by priority
 */
function generateCandidates(
    directory: string,
    appName: string,
    patterns: ConfigNamingPattern[],
    extensions: string[],
    searchHidden: boolean
): DiscoveryCandidate[] {
    // Filter hidden patterns if not searching for them
    const activePatterns = searchHidden
        ? patterns
        : patterns.filter(p => !p.hidden);
    
    // Sort by priority (lower = higher priority)
    const sortedPatterns = [...activePatterns].sort((a, b) => a.priority - b.priority);
    
    const candidates: DiscoveryCandidate[] = [];
    
    for (const pattern of sortedPatterns) {
        const requiresExtension = pattern.pattern.includes('{ext}');
        
        if (requiresExtension) {
            // Generate a candidate for each extension
            for (const ext of extensions) {
                const relativePath = expandPattern(pattern.pattern, appName, ext);
                const absolutePath = path.join(directory, relativePath);
                candidates.push({
                    relativePath,
                    absolutePath,
                    pattern,
                    extension: ext,
                });
            }
        } else {
            // Pattern doesn't use extension (like .{app}rc)
            const relativePath = expandPattern(pattern.pattern, appName);
            const absolutePath = path.join(directory, relativePath);
            candidates.push({
                relativePath,
                absolutePath,
                pattern,
                extension: undefined,
            });
        }
    }
    
    return candidates;
}

/**
 * Discovers configuration files in a directory using multiple naming patterns.
 * 
 * Checks patterns in priority order and returns the first match.
 * If `warnOnMultipleConfigs` is enabled (default), continues scanning after
 * the first match to detect and warn about additional config files.
 * 
 * @param directory - Directory to search for configuration files
 * @param options - Discovery options including app name and patterns
 * @param logger - Optional logger for debug/info/warn messages
 * @returns Discovery result containing the found config and any warnings
 * 
 * @example
 * ```typescript
 * const result = await discoverConfig('/path/to/project', {
 *   appName: 'myapp',
 *   extensions: ['yaml', 'json'],
 * });
 * 
 * if (result.config) {
 *   console.log(`Found config: ${result.config.absolutePath}`);
 * }
 * 
 * if (result.multipleConfigWarning) {
 *   console.warn(`Multiple configs found. Using ${result.multipleConfigWarning.used.path}`);
 * }
 * ```
 */
export async function discoverConfig(
    directory: string,
    options: ConfigDiscoveryOptions,
    logger: Logger = noopLogger
): Promise<DiscoveryResult> {
    const {
        appName,
        patterns = STANDARD_PATTERNS,
        extensions = DEFAULT_EXTENSIONS,
        searchHidden = true,
        warnOnMultipleConfigs = true,
    } = options;
    
    logger.debug(`Starting config discovery in: ${directory}`);
    logger.debug(`App name: ${appName}`);
    logger.debug(`Patterns: ${patterns.map(p => p.pattern).join(', ')}`);
    logger.debug(`Extensions: ${extensions.join(', ')}`);
    logger.debug(`Search hidden: ${searchHidden}`);
    
    // Generate all candidates
    const candidates = generateCandidates(directory, appName, patterns, extensions, searchHidden);
    
    logger.debug(`Generated ${candidates.length} discovery candidates`);
    
    // Find the first match
    let primaryMatch: DiscoveredConfig | null = null;
    const additionalMatches: DiscoveredConfig[] = [];
    
    for (const candidate of candidates) {
        logger.silly(`Checking: ${candidate.relativePath}`);
        
        if (await fileExists(candidate.absolutePath)) {
            const discovered: DiscoveredConfig = {
                path: candidate.relativePath,
                absolutePath: candidate.absolutePath,
                pattern: candidate.pattern,
            };
            
            if (primaryMatch === null) {
                primaryMatch = discovered;
                logger.info(`Found config: ${candidate.relativePath} (pattern: ${candidate.pattern.pattern}, priority: ${candidate.pattern.priority})`);
                
                // If we don't need to check for multiple configs, we're done
                if (!warnOnMultipleConfigs) {
                    break;
                }
            } else {
                // Found an additional config file
                additionalMatches.push(discovered);
                logger.debug(`Found additional config: ${candidate.relativePath} (will be ignored)`);
            }
        }
    }
    
    // Build result
    const result: DiscoveryResult = {
        config: primaryMatch,
    };
    
    // Add warning if multiple configs were found
    if (primaryMatch && additionalMatches.length > 0) {
        const warning: MultipleConfigWarning = {
            used: primaryMatch,
            ignored: additionalMatches,
        };
        result.multipleConfigWarning = warning;
        
        const ignoredPaths = additionalMatches.map(c => `'${c.path}'`).join(', ');
        logger.warn(
            `Multiple config files found. Using '${primaryMatch.path}' (priority ${primaryMatch.pattern.priority}). ` +
            `Ignored: ${ignoredPaths}. Consider removing unused config files.`
        );
    }
    
    if (!primaryMatch) {
        logger.debug('No config file found');
    }
    
    return result;
}

/**
 * Discovers configuration files across multiple directories.
 * Useful for hierarchical configuration where multiple directories may contain config files.
 * 
 * @param directories - Directories to search, in order of precedence (first = highest)
 * @param options - Discovery options
 * @param logger - Optional logger
 * @returns Array of discovery results, one per directory that had a config
 * 
 * @example
 * ```typescript
 * const results = await discoverConfigsInHierarchy(
 *   ['/project/subdir', '/project', '/home/user'],
 *   { appName: 'myapp' }
 * );
 * 
 * // results[0] = config from /project/subdir (if exists)
 * // results[1] = config from /project (if exists)
 * // etc.
 * ```
 */
export async function discoverConfigsInHierarchy(
    directories: string[],
    options: ConfigDiscoveryOptions,
    logger: Logger = noopLogger
): Promise<DiscoveryResult[]> {
    logger.debug(`Discovering configs in ${directories.length} directories`);
    
    const results: DiscoveryResult[] = [];
    
    for (const directory of directories) {
        const result = await discoverConfig(directory, options, logger);
        if (result.config) {
            results.push(result);
        }
    }
    
    logger.debug(`Found ${results.length} config files across hierarchy`);
    
    return results;
}

/**
 * Quickly checks if any config file exists in a directory.
 * More efficient than `discoverConfig` when you only need to know if a config exists,
 * not which one it is.
 * 
 * @param directory - Directory to check
 * @param options - Discovery options
 * @returns True if any config file exists
 */
export async function hasConfigFile(
    directory: string,
    options: ConfigDiscoveryOptions
): Promise<boolean> {
    const {
        appName,
        patterns = STANDARD_PATTERNS,
        extensions = DEFAULT_EXTENSIONS,
        searchHidden = true,
    } = options;
    
    const candidates = generateCandidates(directory, appName, patterns, extensions, searchHidden);
    
    for (const candidate of candidates) {
        if (await fileExists(candidate.absolutePath)) {
            return true;
        }
    }
    
    return false;
}
