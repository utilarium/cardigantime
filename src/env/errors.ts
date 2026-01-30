import { z } from 'zod';

/**
 * Error thrown when env var parsing fails
 */
export class EnvVarParseError extends Error {
    constructor(
        message: string,
        public readonly value: string,
        public readonly expectedType: string,
        public envVarName?: string
    ) {
        super(message);
        this.name = 'EnvVarParseError';
    }
}

/**
 * Error thrown when env var validation fails
 */
export class EnvVarValidationError extends Error {
    constructor(
        message: string,
        public readonly envVarName: string,
        public readonly zodError: z.ZodError
    ) {
        super(message);
        this.name = 'EnvVarValidationError';
    }
}
