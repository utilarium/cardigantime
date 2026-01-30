/**
 * MCP Configuration Discovery
 * 
 * This module provides utilities for discovering configuration files
 * when MCP configuration is not provided. It integrates CardiganTime's
 * existing discovery functionality with the MCP invocation context.
 * 
 * @module mcp/discovery
 */

import path from 'path';
import { Cardigantime } from '../types';
import { FileConfigSource } from './types';
import { ConfigFormat } from '../types';
import { detectConfigFormat } from '../config/format-detector';
import { create as createStorage } from '../util/storage';
import { DEFAULT_CONFIG_FILE } from '../constants';

/**
 * Options for file-based configuration discovery.
 */
export interface FileDiscoveryOptions {
    /**
     * CardiganTime instance to use for discovery.
     * This provides access to the full configuration discovery functionality.
     */
    cardigantime: Cardigantime<any>;

    /**
     * Arguments to pass to CardiganTime's read function.
     * These typically come from CLI parsing.
     */
    args?: Record<string, any>;
}

/**
 * Discovers configuration starting from a target file's location.
 * 
 * This implements the "detective work" pattern where the tool looks at
 * the target file's location and walks up the directory tree to find
 * configuration files.
 * 
 * @param targetFile - Path to the target file being operated on
 * @param options - Discovery options
 * @returns Promise resolving to FileConfigSource or null if not found
 * 
 * @example
 * ```typescript
 * const config = await discoverFromTargetFile(
 *   '/app/src/api/handler.ts',
 *   { cardigantime: myCardiganTimeInstance }
 * );
 * 
 * if (config) {
 *   console.log('Found config at:', config.filePath);
 * }
 * ```
 */
export async function discoverFromTargetFile(
    targetFile: string,
    options: FileDiscoveryOptions
): Promise<FileConfigSource | null> {
    try {
        // Start discovery from the target file's directory
        const targetDir = path.dirname(targetFile);
        
        // Use CardiganTime's read function to discover and load config
        const config = await options.cardigantime.read({
            ...options.args,
            configDirectory: targetDir,
        }) as { resolvedConfigDirs?: string[] };

        // Extract source information from the loaded config
        if (config.resolvedConfigDirs && config.resolvedConfigDirs.length > 0) {
            // Build FileConfigSource from the resolved config
            const primaryDir = config.resolvedConfigDirs[0];
            
            // Detect the actual config file format
            const storage = createStorage({ log: () => {} });
            const configFileName = options.args?.configFile || DEFAULT_CONFIG_FILE;
            const detectedFormat = await detectConfigFormat({
                configFileName,
                configDirectory: primaryDir,
                storage,
            });
            
            const format = detectedFormat?.format || ConfigFormat.YAML;
            const filePath = detectedFormat?.filePath || path.join(primaryDir, configFileName);
            
            return {
                type: 'file',
                filePath,
                format,
            };
        }

        return null;
    } catch {
        // Config not found or error during discovery
        return null;
    }
}

/**
 * Discovers configuration starting from a working directory.
 * 
 * This is the fallback when no target file is specified. It starts
 * discovery from the working directory provided by the MCP invocation.
 * 
 * @param workingDirectory - Working directory to start discovery from
 * @param options - Discovery options
 * @returns Promise resolving to FileConfigSource or null if not found
 * 
 * @example
 * ```typescript
 * const config = await discoverFromWorkingDirectory(
 *   '/app',
 *   { cardigantime: myCardiganTimeInstance }
 * );
 * ```
 */
export async function discoverFromWorkingDirectory(
    workingDirectory: string,
    options: FileDiscoveryOptions
): Promise<FileConfigSource | null> {
    try {
        // Use CardiganTime's read function with the working directory
        const config = await options.cardigantime.read({
            ...options.args,
            configDirectory: workingDirectory,
        }) as { resolvedConfigDirs?: string[] };

        // Extract source information
        if (config.resolvedConfigDirs && config.resolvedConfigDirs.length > 0) {
            const primaryDir = config.resolvedConfigDirs[0];
            
            // Detect the actual config file format
            const storage = createStorage({ log: () => {} });
            const configFileName = options.args?.configFile || DEFAULT_CONFIG_FILE;
            const detectedFormat = await detectConfigFormat({
                configFileName,
                configDirectory: primaryDir,
                storage,
            });
            
            const format = detectedFormat?.format || ConfigFormat.YAML;
            const filePath = detectedFormat?.filePath || path.join(primaryDir, configFileName);
            
            return {
                type: 'file',
                filePath,
                format,
            };
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Creates a file discovery function for use with the MCP resolver.
 * 
 * This is a convenience function that creates a `resolveFileConfig` function
 * compatible with the MCP resolver. It automatically tries target file
 * discovery first, then falls back to working directory discovery.
 * 
 * @param options - Discovery options
 * @returns File config resolver function
 * 
 * @example
 * ```typescript
 * import { createFileDiscovery } from '@utilarium/cardigantime/mcp';
 * import { createMCPIntegration } from '@utilarium/cardigantime/mcp';
 * 
 * const fileDiscovery = createFileDiscovery({
 *   cardigantime: myCardiganTimeInstance,
 * });
 * 
 * const integration = createMCPIntegration({
 *   appName: 'myapp',
 *   configSchema: mySchema,
 *   resolveFileConfig: fileDiscovery,
 * });
 * ```
 */
export function createFileDiscovery(
    options: FileDiscoveryOptions
): (workingDirectory: string, targetFile?: string) => Promise<FileConfigSource | null> {
    return async (
        workingDirectory: string,
        targetFile?: string
    ): Promise<FileConfigSource | null> => {
        // Try target file first if provided
        if (targetFile) {
            const config = await discoverFromTargetFile(targetFile, options);
            if (config) {
                return config;
            }
        }

        // Fall back to working directory
        return discoverFromWorkingDirectory(workingDirectory, options);
    };
}

/**
 * Logs the configuration discovery process.
 * 
 * This is useful for debugging configuration issues. It shows which
 * directories were checked and why a particular config was selected.
 * 
 * @param message - Log message
 * @param details - Additional details to log
 * 
 * @example
 * ```typescript
 * logDiscovery('Checking for config', {
 *   directory: '/app/src',
 *   found: true,
 * });
 * ```
 */
export function logDiscovery(message: string, details?: Record<string, any>): void {
    if (process.env.DEBUG) {
        // eslint-disable-next-line no-console
        console.log(`[MCP Discovery] ${message}`, details || '');
    }
}
