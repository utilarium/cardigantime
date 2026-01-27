/**
 * MCP (Model Context Protocol) integration module.
 * 
 * This module provides types and utilities for integrating CardiganTime
 * with MCP servers, enabling AI assistants to provide configuration
 * to tools at invocation time.
 * 
 * @module mcp
 */

export type {
    MCPConfigSource,
    FileConfigSource,
    ConfigSource,
    ResolvedConfig,
    MCPInvocationContext,
} from './types';

export {
    MCPConfigError,
    MCPContextError,
} from './errors';

export {
    parseMCPConfig,
    expandEnvironmentVariables,
    resolveConfigPaths,
    mergeMCPConfigWithDefaults,
} from './parser';

export type {
    ParseMCPConfigOptions,
} from './parser';

export {
    resolveConfig,
    explainResolution,
    isMCPConfig,
    isFileConfig,
    getConfigFiles,
} from './resolver';

export type {
    ConfigResolverOptions,
} from './resolver';

// Export CheckConfig tool types and utilities
export type {
    CheckConfigInput,
    CheckConfigResult,
    CheckConfigToolDescriptor,
    ConfigSourceType,
    ConfigValueSource,
} from './tools';

export {
    CHECK_CONFIG_TOOL_DESCRIPTOR,
    SENSITIVE_FIELD_PATTERNS,
    isSensitiveField,
    sanitizeValue,
    checkConfig,
    sanitizeConfig,
    createCheckConfigHandler,
} from './tools';

export type {
    CheckConfigOptions,
} from './tools';

// Export MCP integration utilities
export {
    createCheckConfigTool,
    createConfigResolver,
    withConfig,
    createMCPIntegration,
} from './integration';

export type {
    MCPIntegrationOptions,
} from './integration';

// Export MCP discovery utilities
export {
    discoverFromTargetFile,
    discoverFromWorkingDirectory,
    createFileDiscovery,
    logDiscovery,
} from './discovery';

export type {
    FileDiscoveryOptions,
} from './discovery';
