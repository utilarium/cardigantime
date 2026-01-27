import { ZodError } from 'zod';

/**
 * Error thrown when MCP configuration is invalid or cannot be parsed.
 * 
 * This error is thrown when:
 * - The MCP configuration doesn't match the expected schema
 * - Required fields are missing
 * - Field values are invalid
 * 
 * The error includes the original Zod validation error for detailed diagnostics.
 * 
 * @example
 * ```typescript
 * try {
 *   await parseMCPConfig(rawConfig, schema);
 * } catch (error) {
 *   if (error instanceof MCPConfigError) {
 *     console.error('MCP config validation failed:', error.message);
 *     if (error.validationError) {
 *       console.error('Details:', error.validationError.format());
 *     }
 *   }
 * }
 * ```
 */
export class MCPConfigError extends Error {
    /**
     * The name of the error class.
     * Always set to 'MCPConfigError'.
     */
    public readonly name = 'MCPConfigError';

    /**
     * Creates a new MCPConfigError.
     * 
     * @param message - Human-readable error message
     * @param validationError - Optional Zod validation error with detailed field-level errors
     */
    constructor(
        message: string,
        public readonly validationError?: ZodError
    ) {
        super(message);
        
        // Maintain proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, MCPConfigError.prototype);
    }

    /**
     * Returns a formatted error message including validation details.
     * 
     * @returns Formatted error message with validation issues
     */
    public getDetailedMessage(): string {
        if (!this.validationError) {
            return this.message;
        }

        const issues = this.validationError.issues
            .map(issue => {
                const path = issue.path.join('.');
                return `  - ${path || 'root'}: ${issue.message}`;
            })
            .join('\n');

        return `${this.message}\n\nValidation errors:\n${issues}`;
    }
}

/**
 * Error thrown when MCP invocation context is missing required information.
 * 
 * This error is thrown when:
 * - Neither MCP config nor working directory is provided
 * - Required context fields are missing for the operation
 * 
 * @example
 * ```typescript
 * if (!context.config && !context.workingDirectory) {
 *   throw new MCPContextError(
 *     'MCP invocation must provide either config or workingDirectory'
 *   );
 * }
 * ```
 */
export class MCPContextError extends Error {
    /**
     * The name of the error class.
     * Always set to 'MCPContextError'.
     */
    public readonly name = 'MCPContextError';

    /**
     * Creates a new MCPContextError.
     * 
     * @param message - Human-readable error message
     */
    constructor(message: string) {
        super(message);
        
        // Maintain proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, MCPContextError.prototype);
    }
}
