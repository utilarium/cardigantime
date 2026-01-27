/**
 * MCP tools module.
 * 
 * This module exports built-in MCP tools that are automatically available
 * in all CardiganTime-based MCP servers.
 * 
 * @module mcp/tools
 */

export type {
    CheckConfigInput,
    CheckConfigResult,
    CheckConfigToolDescriptor,
    ConfigSourceType,
    ConfigValueSource,
} from './check-config-types';

export {
    CHECK_CONFIG_TOOL_DESCRIPTOR,
    SENSITIVE_FIELD_PATTERNS,
    isSensitiveField,
    sanitizeValue,
} from './check-config-types';

export {
    checkConfig,
    sanitizeConfig,
    createCheckConfigHandler,
} from './check-config';

export type {
    CheckConfigOptions,
} from './check-config';
