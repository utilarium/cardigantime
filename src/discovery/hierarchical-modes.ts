/**
 * Hierarchical Mode Implementation
 * 
 * Implements different hierarchical configuration loading modes:
 * - enabled: Full hierarchical traversal with merging
 * - disabled: Single config only, no parent traversal
 * - root-only: Find first config without merging
 * - explicit: Only merge explicitly referenced configs
 * 
 * @module discovery/hierarchical-modes
 */

import * as path from 'node:path';
import {
    HierarchicalMode,
    HierarchicalOptions,
    ConfigDiscoveryOptions,
    DiscoveredConfig,
    Logger,
    DEFAULT_ROOT_MARKERS,
} from '../types';
import { discoverConfig } from './discoverer';
import { getDirectoriesToRoot } from './root-detection';

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
 * Result of hierarchical config discovery with mode awareness.
 */
export interface HierarchicalDiscoveryResult {
    /** The mode that was used for discovery */
    mode: HierarchicalMode;
    /** Primary config (if found) */
    primaryConfig: DiscoveredConfig | null;
    /** All configs found during traversal (for 'enabled' mode) */
    configs: DiscoveredConfig[];
    /** Directories that were searched */
    searchedDirectories: string[];
    /** Whether hierarchical loading should occur */
    shouldMerge: boolean;
}

/**
 * Resolves hierarchical options with defaults.
 * 
 * @param options - User-provided options
 * @returns Resolved options with defaults applied
 */
export function resolveHierarchicalOptions(
    options?: Partial<HierarchicalOptions>
): Required<HierarchicalOptions> {
    return {
        mode: options?.mode ?? 'enabled',
        maxDepth: options?.maxDepth ?? 10,
        stopAt: options?.stopAt ?? [],
        rootMarkers: options?.rootMarkers ?? DEFAULT_ROOT_MARKERS,
        stopAtRoot: options?.stopAtRoot ?? true,
    };
}

/**
 * Discovers configs using the 'disabled' mode.
 * Only looks in the starting directory, no parent traversal.
 * 
 * @param startPath - Starting directory
 * @param discoveryOptions - Config discovery options
 * @param logger - Optional logger
 * @returns Discovery result
 */
async function discoverDisabledMode(
    startPath: string,
    discoveryOptions: ConfigDiscoveryOptions,
    logger: Logger
): Promise<HierarchicalDiscoveryResult> {
    logger.debug('Using hierarchical mode: disabled (single directory only)');
    
    const result = await discoverConfig(startPath, discoveryOptions, logger);
    
    return {
        mode: 'disabled',
        primaryConfig: result.config,
        configs: result.config ? [result.config] : [],
        searchedDirectories: [startPath],
        shouldMerge: false,
    };
}

/**
 * Discovers configs using the 'root-only' mode.
 * Walks up to find the first config, but doesn't merge with others.
 * 
 * @param startPath - Starting directory
 * @param discoveryOptions - Config discovery options
 * @param hierarchicalOptions - Hierarchical options
 * @param logger - Optional logger
 * @returns Discovery result
 */
async function discoverRootOnlyMode(
    startPath: string,
    discoveryOptions: ConfigDiscoveryOptions,
    hierarchicalOptions: Required<HierarchicalOptions>,
    logger: Logger
): Promise<HierarchicalDiscoveryResult> {
    logger.debug('Using hierarchical mode: root-only (find first, no merge)');
    
    const searchedDirectories: string[] = [];
    
    // Get directories to search
    const directories = await getDirectoriesToRoot(startPath, {
        maxDepth: hierarchicalOptions.maxDepth,
        rootMarkers: hierarchicalOptions.rootMarkers,
        stopAt: hierarchicalOptions.stopAt,
        stopAtRoot: hierarchicalOptions.stopAtRoot,
    }, logger);
    
    // Search each directory until we find a config
    for (const dir of directories) {
        searchedDirectories.push(dir);
        const result = await discoverConfig(dir, { ...discoveryOptions, warnOnMultipleConfigs: false }, logger);
        
        if (result.config) {
            logger.info(`Found config in root-only mode: ${result.config.absolutePath}`);
            return {
                mode: 'root-only',
                primaryConfig: result.config,
                configs: [result.config],
                searchedDirectories,
                shouldMerge: false,
            };
        }
    }
    
    logger.debug('No config found in root-only mode');
    return {
        mode: 'root-only',
        primaryConfig: null,
        configs: [],
        searchedDirectories,
        shouldMerge: false,
    };
}

/**
 * Discovers configs using the 'enabled' mode.
 * Full hierarchical traversal with config merging.
 * 
 * @param startPath - Starting directory
 * @param discoveryOptions - Config discovery options
 * @param hierarchicalOptions - Hierarchical options
 * @param logger - Optional logger
 * @returns Discovery result
 */
async function discoverEnabledMode(
    startPath: string,
    discoveryOptions: ConfigDiscoveryOptions,
    hierarchicalOptions: Required<HierarchicalOptions>,
    logger: Logger
): Promise<HierarchicalDiscoveryResult> {
    logger.debug('Using hierarchical mode: enabled (full traversal with merge)');
    
    const searchedDirectories: string[] = [];
    const configs: DiscoveredConfig[] = [];
    
    // Get directories to search
    const directories = await getDirectoriesToRoot(startPath, {
        maxDepth: hierarchicalOptions.maxDepth,
        rootMarkers: hierarchicalOptions.rootMarkers,
        stopAt: hierarchicalOptions.stopAt,
        stopAtRoot: hierarchicalOptions.stopAtRoot,
    }, logger);
    
    // Search each directory for configs
    for (const dir of directories) {
        searchedDirectories.push(dir);
        const result = await discoverConfig(dir, { ...discoveryOptions, warnOnMultipleConfigs: false }, logger);
        
        if (result.config) {
            configs.push(result.config);
            logger.debug(`Found config at ${result.config.absolutePath}`);
        }
    }
    
    logger.debug(`Found ${configs.length} configs in enabled mode`);
    
    return {
        mode: 'enabled',
        primaryConfig: configs[0] ?? null,
        configs,
        searchedDirectories,
        shouldMerge: configs.length > 1,
    };
}

/**
 * Discovers configs using the 'explicit' mode.
 * Only merges configs that are explicitly referenced via 'extends'.
 * For now, this behaves like 'disabled' but the config can specify extends.
 * 
 * @param startPath - Starting directory
 * @param discoveryOptions - Config discovery options
 * @param logger - Optional logger
 * @returns Discovery result
 */
async function discoverExplicitMode(
    startPath: string,
    discoveryOptions: ConfigDiscoveryOptions,
    logger: Logger
): Promise<HierarchicalDiscoveryResult> {
    logger.debug('Using hierarchical mode: explicit (only merge explicitly referenced configs)');
    
    // In explicit mode, we only look at the starting directory
    // The config itself may specify 'extends' which would be handled by the config loader
    const result = await discoverConfig(startPath, discoveryOptions, logger);
    
    return {
        mode: 'explicit',
        primaryConfig: result.config,
        configs: result.config ? [result.config] : [],
        searchedDirectories: [startPath],
        shouldMerge: false, // Merging is handled by explicit 'extends' in config
    };
}

/**
 * Discovers configuration files using the specified hierarchical mode.
 * 
 * @param startPath - Starting directory for discovery
 * @param discoveryOptions - Config discovery options (app name, patterns, etc.)
 * @param hierarchicalOptions - Hierarchical mode options
 * @param logger - Optional logger
 * @returns Hierarchical discovery result
 * 
 * @example
 * ```typescript
 * // Disabled mode - only check starting directory
 * const result = await discoverWithMode('/project/src', 
 *   { appName: 'myapp' },
 *   { mode: 'disabled' }
 * );
 * 
 * // Enabled mode - full hierarchical traversal
 * const result = await discoverWithMode('/project/src',
 *   { appName: 'myapp' },
 *   { mode: 'enabled', maxDepth: 5 }
 * );
 * ```
 */
export async function discoverWithMode(
    startPath: string,
    discoveryOptions: ConfigDiscoveryOptions,
    hierarchicalOptions?: Partial<HierarchicalOptions>,
    logger: Logger = noopLogger
): Promise<HierarchicalDiscoveryResult> {
    const resolvedOptions = resolveHierarchicalOptions(hierarchicalOptions);
    const resolvedStartPath = path.resolve(startPath);
    
    logger.verbose(`Starting hierarchical discovery at: ${resolvedStartPath}`);
    logger.verbose(`Mode: ${resolvedOptions.mode}, maxDepth: ${resolvedOptions.maxDepth}`);
    
    switch (resolvedOptions.mode) {
        case 'disabled':
            return discoverDisabledMode(resolvedStartPath, discoveryOptions, logger);
            
        case 'root-only':
            return discoverRootOnlyMode(resolvedStartPath, discoveryOptions, resolvedOptions, logger);
            
        case 'explicit':
            return discoverExplicitMode(resolvedStartPath, discoveryOptions, logger);
            
        case 'enabled':
        default:
            return discoverEnabledMode(resolvedStartPath, discoveryOptions, resolvedOptions, logger);
    }
}

/**
 * Checks if a config content specifies a hierarchical mode override.
 * Configs can set `hierarchical.mode: disabled` to prevent parent merging.
 * 
 * @param configContent - Parsed config content
 * @returns The override mode if specified, undefined otherwise
 */
export function getHierarchicalModeOverride(configContent: unknown): HierarchicalMode | undefined {
    if (!configContent || typeof configContent !== 'object') {
        return undefined;
    }
    
    const config = configContent as Record<string, unknown>;
    const hierarchical = config.hierarchical;
    
    if (!hierarchical || typeof hierarchical !== 'object') {
        return undefined;
    }
    
    const hierarchicalObj = hierarchical as Record<string, unknown>;
    const mode = hierarchicalObj.mode;
    
    if (typeof mode === 'string' && 
        ['enabled', 'disabled', 'root-only', 'explicit'].includes(mode)) {
        return mode as HierarchicalMode;
    }
    
    return undefined;
}

/**
 * Gets hierarchical options from a config content.
 * Extracts any hierarchical settings from the config.
 * 
 * @param configContent - Parsed config content
 * @returns Partial hierarchical options, or undefined if none
 */
export function getHierarchicalOptionsFromConfig(
    configContent: unknown
): Partial<HierarchicalOptions> | undefined {
    if (!configContent || typeof configContent !== 'object') {
        return undefined;
    }
    
    const config = configContent as Record<string, unknown>;
    const hierarchical = config.hierarchical;
    
    if (!hierarchical || typeof hierarchical !== 'object') {
        return undefined;
    }
    
    const hierarchicalObj = hierarchical as Record<string, unknown>;
    const result: Partial<HierarchicalOptions> = {};
    
    // Extract mode
    const modeOverride = getHierarchicalModeOverride(configContent);
    if (modeOverride) {
        result.mode = modeOverride;
    }
    
    // Extract maxDepth
    if (typeof hierarchicalObj.maxDepth === 'number') {
        result.maxDepth = hierarchicalObj.maxDepth;
    }
    
    // Extract stopAt
    if (Array.isArray(hierarchicalObj.stopAt)) {
        result.stopAt = hierarchicalObj.stopAt.filter(
            (item): item is string => typeof item === 'string'
        );
    }
    
    // Extract stopAtRoot
    if (typeof hierarchicalObj.stopAtRoot === 'boolean') {
        result.stopAtRoot = hierarchicalObj.stopAtRoot;
    }
    
    return Object.keys(result).length > 0 ? result : undefined;
}
