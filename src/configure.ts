import { Command } from "commander";
import { z } from "zod";
import { ArgumentError } from "./error/ArgumentError";
import { Options } from "./types";
export { ArgumentError };

/**
 * Validates a configuration directory path to ensure it's safe and valid.
 * 
 * Performs security and safety checks including:
 * - Non-empty string validation
 * - Null byte injection prevention
 * - Path length validation
 * - Type checking
 * 
 * @param configDirectory - The configuration directory path to validate
 * @param _testThrowNonArgumentError - Internal testing parameter to simulate non-ArgumentError exceptions
 * @returns The trimmed and validated configuration directory path
 * @throws {ArgumentError} When the directory path is invalid
 * 
 * @example
 * ```typescript
 * const validDir = validateConfigDirectory('./config'); // Returns './config'
 * const invalidDir = validateConfigDirectory(''); // Throws ArgumentError
 * ```
 */
export function validateConfigDirectory(configDirectory: string, _testThrowNonArgumentError?: boolean): string {
    if (_testThrowNonArgumentError) {
        throw new Error('Test non-ArgumentError for coverage');
    }

    if (!configDirectory) {
        throw new ArgumentError('configDirectory', 'Configuration directory cannot be empty');
    }

    if (typeof configDirectory !== 'string') {
        throw new ArgumentError('configDirectory', 'Configuration directory must be a string');
    }

    const trimmed = configDirectory.trim();
    if (trimmed.length === 0) {
        throw new ArgumentError('configDirectory', 'Configuration directory cannot be empty or whitespace only');
    }

    // Check for obviously invalid paths
    if (trimmed.includes('\0')) {
        throw new ArgumentError('configDirectory', 'Configuration directory contains invalid null character');
    }

    // Validate path length (reasonable limit)
    if (trimmed.length > 1000) {
        throw new ArgumentError('configDirectory', 'Configuration directory path is too long (max 1000 characters)');
    }

    return trimmed;
}

/**
 * Configures a Commander.js command with Cardigantime's CLI options.
 * 
 * This function adds command-line options that allow users to override
 * configuration settings at runtime, such as:
 * - --config-directory: Override the default configuration directory
 * 
 * The function validates both the command object and the options to ensure
 * they meet the requirements for proper integration.
 * 
 * @template T - The Zod schema shape type for configuration validation
 * @param command - The Commander.js Command instance to configure
 * @param options - Cardigantime options containing defaults and schema
 * @param _testThrowNonArgumentError - Internal testing parameter
 * @returns Promise resolving to the configured Command instance
 * @throws {ArgumentError} When command or options are invalid
 * 
 * @example
 * ```typescript
 * import { Command } from 'commander';
 * import { configure } from './configure';
 * 
 * const program = new Command();
 * const configuredProgram = await configure(program, options);
 * 
 * // Now the program accepts: --config-directory <path>
 * ```
 */
export const configure = async <T extends z.ZodRawShape>(
    command: Command,
    options: Options<T>,
    _testThrowNonArgumentError?: boolean
): Promise<Command> => {
    // Validate the command object
    if (!command) {
        throw new ArgumentError('command', 'Command instance is required');
    }

    if (typeof command.option !== 'function') {
        throw new ArgumentError('command', 'Command must be a valid Commander.js Command instance');
    }

    // Validate options
    if (!options) {
        throw new ArgumentError('options', 'Options object is required');
    }

    if (!options.defaults) {
        throw new ArgumentError('options.defaults', 'Options must include defaults configuration');
    }

    if (!options.defaults.configDirectory) {
        throw new ArgumentError('options.defaults.configDirectory', 'Default config directory is required');
    }

    // Validate the default config directory
    const validatedDefaultDir = validateConfigDirectory(options.defaults.configDirectory, _testThrowNonArgumentError);

    let retCommand = command;

    // Add the config directory option with validation
    retCommand = retCommand.option(
        '-c, --config-directory <configDirectory>',
        'Configuration directory path',
        (value: string) => {
            try {
                return validateConfigDirectory(value, _testThrowNonArgumentError);
            } catch (error) {
                if (error instanceof ArgumentError) {
                    // Re-throw with more specific context for CLI usage
                    throw new ArgumentError('config-directory', `Invalid --config-directory: ${error.message}`);
                }
                throw error;
            }
        },
        validatedDefaultDir
    );

    // Add the init config option
    retCommand = retCommand.option(
        '--init-config',
        'Generate initial configuration file and exit'
    );

    // Add the check config option
    retCommand = retCommand.option(
        '--check-config',
        'Display resolved configuration with source tracking and exit'
    );

    return retCommand;
}




