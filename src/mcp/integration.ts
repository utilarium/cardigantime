/**
 * MCP Integration Utilities
 * 
 * This module provides utilities and patterns for integrating CardiganTime
 * with MCP (Model Context Protocol) servers. Since CardiganTime is a configuration
 * library and not an MCP server framework, these utilities help you wire up
 * configuration handling in your MCP server implementation.
 * 
 * @module mcp/integration
 */

import { ZodSchema } from 'zod';
import { MCPInvocationContext, ResolvedConfig } from './types';
import { resolveConfig } from './resolver';
import { checkConfig, CheckConfigOptions } from './tools/check-config';
import { CHECK_CONFIG_TOOL_DESCRIPTOR } from './tools/check-config-types';

/**
 * Options for creating MCP integration helpers.
 */
export interface MCPIntegrationOptions {
    /**
     * Application name (used in CheckConfig documentation links).
     */
    appName: string;

    /**
     * Zod schema for configuration validation.
     */
    configSchema: ZodSchema;

    /**
     * Base URL for documentation links.
     * @default "https://github.com/utilarium/cardigantime"
     */
    docsBaseUrl?: string;

    /**
     * Function to resolve file-based configuration.
     * Called when MCP config is not provided.
     */
    resolveFileConfig?: (workingDirectory: string) => Promise<any>;
}

/**
 * Creates a CheckConfig tool handler for your MCP server.
 * 
 * This is a convenience function that returns a ready-to-use handler
 * for the CheckConfig tool. Register this with your MCP server to
 * automatically provide configuration inspection capabilities.
 * 
 * @param options - Integration options
 * @returns Object with tool descriptor and handler
 * 
 * @example
 * ```typescript
 * import { createCheckConfigTool } from '@utilarium/cardigantime/mcp';
 * 
 * const checkConfigTool = createCheckConfigTool({
 *   appName: 'myapp',
 *   configSchema: myConfigSchema,
 *   resolveFileConfig: async (dir) => loadMyConfig(dir),
 * });
 * 
 * // Register with your MCP server
 * server.registerTool(
 *   checkConfigTool.descriptor,
 *   checkConfigTool.handler
 * );
 * ```
 */
export function createCheckConfigTool(options: MCPIntegrationOptions) {
    const checkConfigOptions: CheckConfigOptions = {
        appName: options.appName,
        schema: options.configSchema,
        docsBaseUrl: options.docsBaseUrl,
        resolveFileConfig: options.resolveFileConfig,
    };

    return {
        descriptor: CHECK_CONFIG_TOOL_DESCRIPTOR,
        handler: async (input: any, context: MCPInvocationContext) => {
            return checkConfig(input, context, checkConfigOptions);
        },
    };
}

/**
 * Creates a configuration resolver for MCP tool handlers.
 * 
 * This function returns a resolver that you can call at the beginning
 * of your tool handlers to get the resolved configuration. It handles
 * both MCP-provided config and file-based fallback.
 * 
 * @param options - Integration options
 * @returns Configuration resolver function
 * 
 * @example
 * ```typescript
 * import { createConfigResolver } from '@utilarium/cardigantime/mcp';
 * 
 * const resolveMyConfig = createConfigResolver({
 *   appName: 'myapp',
 *   configSchema: myConfigSchema,
 *   resolveFileConfig: async (dir) => loadMyConfig(dir),
 * });
 * 
 * // In your tool handler
 * async function myToolHandler(input: any, context: MCPInvocationContext) {
 *   const config = await resolveMyConfig(context);
 *   
 *   // Use config.config for the resolved configuration
 *   console.log('Port:', config.config.port);
 *   
 *   // ... rest of tool logic
 * }
 * ```
 */
export function createConfigResolver<T = unknown>(
    options: MCPIntegrationOptions
): (context: MCPInvocationContext) => Promise<ResolvedConfig<T>> {
    return async (context: MCPInvocationContext) => {
        return resolveConfig<T>(context, {
            schema: options.configSchema,
            resolveFileConfig: options.resolveFileConfig,
        });
    };
}

/**
 * Wraps a tool handler to automatically inject resolved configuration.
 * 
 * This higher-order function wraps your tool handler and automatically
 * resolves configuration before calling your handler. The resolved config
 * is added to the context object.
 * 
 * @param handler - Your tool handler function
 * @param options - Integration options
 * @returns Wrapped handler with config injection
 * 
 * @example
 * ```typescript
 * import { withConfig } from '@utilarium/cardigantime/mcp';
 * 
 * // Your tool handler
 * async function myTool(input: any, context: any) {
 *   // Config is automatically available in context
 *   console.log('Port:', context.resolvedConfig.config.port);
 *   
 *   return { result: 'success' };
 * }
 * 
 * // Wrap with config injection
 * const wrappedHandler = withConfig(myTool, {
 *   appName: 'myapp',
 *   configSchema: myConfigSchema,
 *   resolveFileConfig: async (dir) => loadMyConfig(dir),
 * });
 * 
 * // Register wrapped handler with your MCP server
 * server.registerTool('my_tool', wrappedHandler);
 * ```
 */
export function withConfig<TInput = any, TOutput = any, TConfig = unknown>(
    handler: (
        input: TInput,
        context: MCPInvocationContext & { resolvedConfig: ResolvedConfig<TConfig> }
    ) => Promise<TOutput>,
    options: MCPIntegrationOptions
): (input: TInput, context: MCPInvocationContext) => Promise<TOutput> {
    const resolver = createConfigResolver<TConfig>(options);

    return async (input: TInput, context: MCPInvocationContext): Promise<TOutput> => {
        const resolvedConfig = await resolver(context);

        return handler(input, {
            ...context,
            resolvedConfig,
        });
    };
}

/**
 * Creates a complete set of MCP integration helpers.
 * 
 * This is a convenience function that returns all the integration helpers
 * you need in one call. Use this if you want a complete integration setup.
 * 
 * @param options - Integration options
 * @returns Object with all integration helpers
 * 
 * @example
 * ```typescript
 * import { createMCPIntegration } from '@utilarium/cardigantime/mcp';
 * 
 * const integration = createMCPIntegration({
 *   appName: 'myapp',
 *   configSchema: myConfigSchema,
 *   resolveFileConfig: async (dir) => loadMyConfig(dir),
 * });
 * 
 * // Register CheckConfig tool
 * server.registerTool(
 *   integration.checkConfig.descriptor,
 *   integration.checkConfig.handler
 * );
 * 
 * // Use config resolver in your tools
 * async function myTool(input: any, context: MCPInvocationContext) {
 *   const config = await integration.resolveConfig(context);
 *   // ... use config
 * }
 * 
 * // Or wrap your handlers with config injection
 * const wrappedHandler = integration.withConfig(myToolHandler);
 * server.registerTool('my_tool', wrappedHandler);
 * ```
 */
export function createMCPIntegration<TConfig = unknown>(
    options: MCPIntegrationOptions
) {
    return {
        /**
         * CheckConfig tool ready for registration.
         */
        checkConfig: createCheckConfigTool(options),

        /**
         * Configuration resolver function.
         */
        resolveConfig: createConfigResolver<TConfig>(options),

        /**
         * Higher-order function to wrap handlers with config injection.
         */
        withConfig: <TInput = any, TOutput = any>(
            handler: (
                input: TInput,
                context: MCPInvocationContext & { resolvedConfig: ResolvedConfig<TConfig> }
            ) => Promise<TOutput>
        ) => withConfig<TInput, TOutput, TConfig>(handler, options),

        /**
         * Integration options (for reference).
         */
        options,
    };
}
