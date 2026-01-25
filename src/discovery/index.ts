/**
 * Configuration Discovery Module
 * 
 * Provides functionality for discovering configuration files in various
 * standard locations using customizable naming patterns.
 * 
 * @module discovery
 */

export {
    STANDARD_PATTERNS,
    DEFAULT_EXTENSIONS,
    expandPattern,
    getDiscoveryPaths,
} from './patterns';

export {
    discoverConfig,
    discoverConfigsInHierarchy,
    hasConfigFile,
} from './discoverer';

export {
    isProjectRoot,
    findProjectRoot,
    shouldStopAt,
    walkUpToRoot,
    getDirectoriesToRoot,
} from './root-detection';
export type { RootDetectionResult } from './root-detection';

export {
    discoverWithMode,
    resolveHierarchicalOptions,
    getHierarchicalModeOverride,
    getHierarchicalOptionsFromConfig,
} from './hierarchical-modes';
export type { HierarchicalDiscoveryResult } from './hierarchical-modes';

export {
    DEFAULT_TRAVERSAL_BOUNDARY,
    expandEnvironmentVariables,
    normalizePath,
    getPathDepth,
    isPathWithin,
    isPathAtOrAbove,
    checkTraversalBoundary,
    resolveTraversalBoundary,
    createBoundaryChecker,
    filterAllowedPaths,
} from './traversal-security';
