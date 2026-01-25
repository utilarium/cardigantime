/**
 * Configuration Discovery Patterns
 * 
 * Defines standard naming patterns for discovering configuration files
 * in various locations. These patterns follow conventions used by popular
 * JavaScript tools like Vite, ESLint, Prettier, and TypeScript.
 * 
 * @module discovery/patterns
 */

import { ConfigNamingPattern } from '../types';

/**
 * Standard configuration file naming patterns.
 * 
 * These patterns cover the most common conventions used by modern JavaScript tools:
 * 
 * 1. **Modern explicit pattern** (`{app}.config.{ext}`) - Used by Vite, Next.js, etc.
 * 2. **Short explicit pattern** (`{app}.conf.{ext}`) - Unix-style configuration
 * 3. **Hidden directory pattern** (`.{app}/config.{ext}`) - Current CardiganTime default
 * 4. **RC file with extension** (`.{app}rc.{ext}`) - ESLint legacy, Babel
 * 5. **RC file without extension** (`.{app}rc`) - Prettier, npm
 * 
 * Patterns are ordered by priority (lower = checked first). This order prefers:
 * - Visible files over hidden files (easier to discover)
 * - Explicit naming over implicit (clearer intent)
 * - Modern conventions over legacy conventions
 * 
 * @example
 * ```typescript
 * import { STANDARD_PATTERNS, expandPattern } from './patterns';
 * 
 * // List all patterns for 'protokoll' app with YAML extension
 * const files = STANDARD_PATTERNS.map(p => 
 *   expandPattern(p.pattern, 'protokoll', 'yaml')
 * );
 * // ['protokoll.config.yaml', 'protokoll.conf.yaml', '.protokoll/config.yaml', ...]
 * ```
 */
export const STANDARD_PATTERNS: ConfigNamingPattern[] = [
    {
        pattern: '{app}.config.{ext}',
        priority: 1,
        hidden: false,
    },
    {
        pattern: '{app}.conf.{ext}',
        priority: 2,
        hidden: false,
    },
    {
        pattern: '.{app}/config.{ext}',
        priority: 3,
        hidden: true,
    },
    {
        pattern: '.{app}rc.{ext}',
        priority: 4,
        hidden: true,
    },
    {
        pattern: '.{app}rc',
        priority: 5,
        hidden: true,
    },
];

/**
 * Expands a naming pattern into an actual file path segment.
 * 
 * @param pattern - The pattern template with placeholders
 * @param appName - The application name to substitute for `{app}`
 * @param extension - The file extension to substitute for `{ext}` (optional)
 * @returns The expanded file path segment
 * 
 * @example
 * ```typescript
 * expandPattern('{app}.config.{ext}', 'myapp', 'yaml');
 * // Returns: 'myapp.config.yaml'
 * 
 * expandPattern('.{app}rc', 'myapp');
 * // Returns: '.myapprc'
 * 
 * expandPattern('.{app}/config.{ext}', 'protokoll', 'json');
 * // Returns: '.protokoll/config.json'
 * ```
 */
export function expandPattern(
    pattern: string,
    appName: string,
    extension?: string
): string {
    let result = pattern.replace(/{app}/g, appName);
    
    if (extension !== undefined) {
        result = result.replace(/{ext}/g, extension);
    }
    
    return result;
}

/**
 * Gets all file paths to check for a given app name and extensions.
 * Expands all standard patterns with the provided extensions.
 * 
 * @param appName - The application name
 * @param extensions - Array of file extensions to search for
 * @param options - Optional configuration
 * @param options.includeHidden - Whether to include hidden file patterns (default: true)
 * @param options.patterns - Custom patterns to use instead of STANDARD_PATTERNS
 * @returns Array of file paths to check, ordered by priority
 * 
 * @example
 * ```typescript
 * const paths = getDiscoveryPaths('myapp', ['yaml', 'json']);
 * // Returns (in priority order):
 * // ['myapp.config.yaml', 'myapp.config.json', 'myapp.conf.yaml', ...]
 * ```
 */
export function getDiscoveryPaths(
    appName: string,
    extensions: string[],
    options?: {
        includeHidden?: boolean;
        patterns?: ConfigNamingPattern[];
    }
): string[] {
    const includeHidden = options?.includeHidden ?? true;
    const patterns = options?.patterns ?? STANDARD_PATTERNS;
    
    // Filter out hidden patterns if not included
    const activePatterns = includeHidden 
        ? patterns 
        : patterns.filter(p => !p.hidden);
    
    // Sort by priority
    const sortedPatterns = [...activePatterns].sort((a, b) => a.priority - b.priority);
    
    const paths: string[] = [];
    
    for (const pattern of sortedPatterns) {
        // Check if pattern requires an extension
        const requiresExtension = pattern.pattern.includes('{ext}');
        
        if (requiresExtension) {
            // Expand pattern with each extension
            for (const ext of extensions) {
                paths.push(expandPattern(pattern.pattern, appName, ext));
            }
        } else {
            // Pattern doesn't use extension (like .{app}rc)
            paths.push(expandPattern(pattern.pattern, appName));
        }
    }
    
    return paths;
}

/**
 * Default file extensions supported for configuration discovery.
 * Ordered by priority (TypeScript > JavaScript > JSON > YAML).
 */
export const DEFAULT_EXTENSIONS = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs', 'json', 'yaml', 'yml'];
