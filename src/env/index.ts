// Core functions
export { 
    toScreamingSnakeCase, 
    generateEnvVarName, 
    flattenFieldPath 
} from './naming';

export { 
    parseEnvVar, 
    parseBoolean, 
    parseNumber, 
    parseArray 
} from './parser';

export { 
    readEnvVar, 
    readEnvVarForField, 
    readEnvVarsForSchema 
} from './reader';

export { 
    extractSchemaFields, 
    getSchemaForField 
} from './schema-utils';

// High-level API
export { 
    resolveEnvVarConfig 
} from './resolver';

// Errors
export { 
    EnvVarParseError, 
    EnvVarValidationError 
} from './errors';

// Types
export type { 
    EnvVarNamingConfig, 
    EnvVarName,
    EnvVarReadResult,
    EnvVarConfigSource
} from './types';
