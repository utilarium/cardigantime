# Error Handling

Comprehensive guide to handling errors in Cardigantime applications with structured error types and best practices.

## Error Types

Cardigantime provides structured error types that allow you to handle different failure scenarios programmatically.

### Importing Error Types

```typescript
import { 
  ConfigurationError, 
  FileSystemError, 
  ArgumentError 
} from '@utilarium/cardigantime';
```

### `ConfigurationError`

Thrown when configuration validation fails, contains extra keys, or schema issues occur.

```typescript
class ConfigurationError extends Error {
  errorType: 'validation' | 'schema' | 'extra_keys';
  details: any;
  configPath?: string;
}
```

**Properties:**
- **`errorType`**: Type of configuration error
- **`details`**: Additional error context (Zod error details, extra keys info, etc.)
- **`configPath`**: Path to the configuration file (when applicable)

### `FileSystemError`

Thrown when file system operations fail (directory access, file reading, etc.).

```typescript
class FileSystemError extends Error {
  errorType: 'not_found' | 'not_readable' | 'not_writable' | 'creation_failed' | 'operation_failed';
  path: string;
  operation: string;
  originalError?: Error;
}
```

**Properties:**
- **`errorType`**: Type of file system error
- **`path`**: The file/directory path that caused the error
- **`operation`**: The operation that failed
- **`originalError`**: The underlying error (when applicable)

### `ArgumentError`

Thrown when CLI arguments or function parameters are invalid.

```typescript
class ArgumentError extends Error {
  argument: string;
}
```

**Properties:**
- **`argument`**: The name of the invalid argument

## Basic Error Handling

### Simple Error Handling Pattern

```typescript
import { create, ConfigurationError, FileSystemError, ArgumentError } from '@utilarium/cardigantime';

async function setupApp() {
  const cardigantime = create({
    defaults: { configDirectory: './config' },
    configShape: MyConfigSchema.shape,
  });

  try {
    const config = await cardigantime.read(args);
    await cardigantime.validate(config);
    
    // Your app logic here
    await startApp(config);
    
  } catch (error) {
    if (error instanceof ConfigurationError) {
      handleConfigError(error);
    } else if (error instanceof FileSystemError) {
      handleFileSystemError(error);
    } else if (error instanceof ArgumentError) {
      handleArgumentError(error);
    } else {
      console.error('Unexpected error:', error.message);
      process.exit(1);
    }
  }
}
```

## Detailed Error Handling

### Configuration Error Handling

```typescript
function handleConfigError(error: ConfigurationError) {
  console.error('❌ Configuration Error');
  
  switch (error.errorType) {
    case 'validation':
      console.error('Configuration validation failed:');
      console.error(JSON.stringify(error.details, null, 2));
      console.error('\n💡 Tips:');
      console.error('  - Check data types (string vs number)');
      console.error('  - Verify required fields are present');
      console.error('  - Run --init-config to see valid format');
      break;
      
    case 'extra_keys':
      console.error('Unknown configuration keys found:');
      console.error(`Extra keys: ${error.details.extraKeys.join(', ')}`);
      console.error(`Allowed keys: ${error.details.allowedKeys.join(', ')}`);
      console.error('\n💡 Tips:');
      console.error('  - Check for typos in key names');
      console.error('  - Remove unknown keys or update your schema');
      break;
      
    case 'schema':
      console.error('Configuration schema is invalid:');
      console.error(error.details);
      console.error('\n💡 This is likely a programming error in schema definition');
      break;
  }
  
  if (error.configPath) {
    console.error(`\nConfiguration file: ${error.configPath}`);
  }
  
  process.exit(1);
}
```

### File System Error Handling

```typescript
function handleFileSystemError(error: FileSystemError) {
  console.error('❌ File System Error');
  
  switch (error.errorType) {
    case 'not_found':
      if (error.operation === 'directory_access') {
        console.error(`Configuration directory not found: ${error.path}`);
        console.error('\n💡 Solutions:');
        console.error(`  1. Create the directory: mkdir -p ${error.path}`);
        console.error('  2. Use a different directory with --config-directory');
        console.error('  3. Set isRequired: false in your options');
      } else {
        console.error(`Configuration file not found: ${error.path}`);
        console.error('\n💡 Solutions:');
        console.error('  1. Create the configuration file');
        console.error('  2. Check the file path and name');
        console.error('  3. Run --init-config to generate a config file');
      }
      break;
      
    case 'not_readable':
      console.error(`Cannot read ${error.path}`);
      console.error('\n💡 Solutions:');
      console.error(`  1. Check permissions: chmod +r ${error.path}`);
      console.error(`  2. Verify the file exists and is not corrupted`);
      console.error(`  3. Check if the file is locked by another process`);
      break;
      
    case 'not_writable':
      console.error(`Cannot write to ${error.path}`);
      console.error('\n💡 Solutions:');
      console.error(`  1. Check permissions: chmod +w ${error.path}`);
      console.error(`  2. Verify parent directory exists and is writable`);
      console.error(`  3. Check disk space availability`);
      break;
      
    case 'creation_failed':
      console.error(`Failed to create directory: ${error.path}`);
      console.error(`Original error: ${error.originalError?.message}`);
      console.error('\n💡 Solutions:');
      console.error('  1. Check parent directory permissions');
      console.error('  2. Verify disk space availability');
      console.error('  3. Check if path contains invalid characters');
      break;
      
    case 'operation_failed':
      console.error(`File operation failed: ${error.operation}`);
      console.error(`Path: ${error.path}`);
      console.error(`Error: ${error.originalError?.message}`);
      break;
  }
  
  process.exit(1);
}
```

### Argument Error Handling

```typescript
function handleArgumentError(error: ArgumentError) {
  console.error('❌ Argument Error');
  console.error(`Invalid argument: ${error.argument}`);
  console.error(`Error: ${error.message}`);
  
  console.error('\n💡 Solutions:');
  console.error('  1. Check your command line arguments');
  console.error('  2. Use --help to see available options');
  console.error('  3. Verify argument values and types');
  
  // Show help for common argument errors
  if (error.argument === 'config-directory') {
    console.error('\nExample: --config-directory ./my-config');
  }
  
  process.exit(1);
}
```

## Graceful Error Recovery

### Fallback Configuration

```typescript
async function setupAppWithFallbacks() {
  const cardigantime = create({
    defaults: { configDirectory: './config' },
    configShape: MyConfigSchema.shape,
  });

  try {
    const config = await cardigantime.read(args);
    await cardigantime.validate(config);
    return config;
    
  } catch (error) {
    if (error instanceof FileSystemError && error.errorType === 'not_found') {
      console.warn('⚠️  Configuration not found, using defaults');
      return getDefaultConfig();
    }
    
    if (error instanceof ConfigurationError && error.errorType === 'extra_keys') {
      console.warn('⚠️  Unknown config keys found, continuing with valid keys only');
      
      // Filter out extra keys and retry
      const rawConfig = await loadRawConfig();
      const cleanConfig = removeExtraKeys(rawConfig, error.details.allowedKeys);
      
      await cardigantime.validate(cleanConfig);
      return cleanConfig;
    }
    
    // Re-throw other errors
    throw error;
  }
}

function getDefaultConfig(): MyConfigType {
  // Return a valid default configuration
  return {
    port: 3000,
    host: 'localhost',
    database: {
      host: 'localhost',
      port: 5432,
      ssl: false,
    },
    features: [],
    debug: false,
  };
}

function removeExtraKeys(config: any, allowedKeys: string[]): any {
  const cleaned: any = {};
  
  for (const key of allowedKeys) {
    if (key in config) {
      cleaned[key] = config[key];
    }
  }
  
  return cleaned;
}
```

### Configuration Healing

```typescript
class ConfigurationHealer {
  constructor(private schema: z.ZodSchema<any>) {}
  
  async healConfiguration(config: any): Promise<{ healed: any; warnings: string[] }> {
    const warnings: string[] = [];
    const healed = { ...config };
    
    try {
      // Try validation first
      this.schema.parse(healed);
      return { healed, warnings };
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          const path = issue.path.join('.');
          
          switch (issue.code) {
            case 'invalid_type':
              if (this.tryTypeCoercion(healed, issue.path, issue.expected)) {
                warnings.push(`Converted ${path} from ${issue.received} to ${issue.expected}`);
              }
              break;
              
            case 'too_small':
              if (issue.type === 'number' && typeof healed[path] === 'number') {
                healed[path] = Math.max(healed[path], issue.minimum || 0);
                warnings.push(`Adjusted ${path} to minimum value ${issue.minimum}`);
              }
              break;
              
            case 'too_big':
              if (issue.type === 'number' && typeof healed[path] === 'number') {
                healed[path] = Math.min(healed[path], issue.maximum || 0);
                warnings.push(`Adjusted ${path} to maximum value ${issue.maximum}`);
              }
              break;
          }
        }
      }
    }
    
    return { healed, warnings };
  }
  
  private tryTypeCoercion(obj: any, path: (string | number)[], expectedType: string): boolean {
    const value = this.getNestedValue(obj, path);
    
    switch (expectedType) {
      case 'number':
        const num = Number(value);
        if (!isNaN(num)) {
          this.setNestedValue(obj, path, num);
          return true;
        }
        break;
        
      case 'string':
        this.setNestedValue(obj, path, String(value));
        return true;
        
      case 'boolean':
        if (typeof value === 'string') {
          const bool = value.toLowerCase() === 'true';
          this.setNestedValue(obj, path, bool);
          return true;
        }
        break;
    }
    
    return false;
  }
  
  private getNestedValue(obj: any, path: (string | number)[]): any {
    return path.reduce((current, key) => current?.[key], obj);
  }
  
  private setNestedValue(obj: any, path: (string | number)[], value: any): void {
    const lastKey = path[path.length - 1];
    const parent = path.slice(0, -1).reduce((current, key) => current[key], obj);
    parent[lastKey] = value;
  }
}

// Usage
async function setupAppWithHealing() {
  try {
    const config = await cardigantime.read(args);
    await cardigantime.validate(config);
    return config;
  } catch (error) {
    if (error instanceof ConfigurationError && error.errorType === 'validation') {
      console.warn('⚠️  Configuration validation failed, attempting to heal...');
      
      const healer = new ConfigurationHealer(MyConfigSchema);
      const rawConfig = await loadRawConfig();
      const { healed, warnings } = await healer.healConfiguration(rawConfig);
      
      if (warnings.length > 0) {
        console.warn('Configuration healing applied:');
        warnings.forEach(warning => console.warn(`  - ${warning}`));
      }
      
      await cardigantime.validate(healed);
      return healed;
    }
    
    throw error;
  }
}
```

## Error Monitoring and Reporting

### Integration with Error Tracking Services

```typescript
import * as Sentry from '@sentry/node';

// Initialize Sentry for error tracking
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

function reportConfigurationError(error: Error, context: any = {}) {
  // Add configuration context to error reporting
  Sentry.withScope((scope) => {
    scope.setTag('error_category', 'configuration');
    scope.setContext('configuration', context);
    
    if (error instanceof ConfigurationError) {
      scope.setTag('config_error_type', error.errorType);
      scope.setExtra('config_details', error.details);
      scope.setExtra('config_path', error.configPath);
    } else if (error instanceof FileSystemError) {
      scope.setTag('fs_error_type', error.errorType);
      scope.setExtra('fs_path', error.path);
      scope.setExtra('fs_operation', error.operation);
    }
    
    Sentry.captureException(error);
  });
}

// Enhanced error handling with monitoring
async function setupAppWithMonitoring() {
  try {
    const config = await cardigantime.read(args);
    await cardigantime.validate(config);
    return config;
  } catch (error) {
    // Report error to monitoring service
    reportConfigurationError(error, {
      configDirectory: './config',
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version,
    });
    
    // Handle error based on type
    if (error instanceof ConfigurationError) {
      handleConfigError(error);
    } else if (error instanceof FileSystemError) {
      handleFileSystemError(error);
    } else {
      throw error;
    }
  }
}
```

### Configuration Validation Metrics

```typescript
class ConfigurationMetrics {
  private metrics: Map<string, number> = new Map();
  
  recordValidationError(errorType: string) {
    const key = `validation_error_${errorType}`;
    this.metrics.set(key, (this.metrics.get(key) || 0) + 1);
  }
  
  recordFileSystemError(errorType: string) {
    const key = `filesystem_error_${errorType}`;
    this.metrics.set(key, (this.metrics.get(key) || 0) + 1);
  }
  
  recordSuccessfulLoad() {
    this.metrics.set('successful_loads', (this.metrics.get('successful_loads') || 0) + 1);
  }
  
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }
  
  logMetrics() {
    console.log('Configuration Metrics:', this.getMetrics());
  }
}

const configMetrics = new ConfigurationMetrics();

// Use in error handling
async function loadConfigWithMetrics() {
  try {
    const config = await cardigantime.read(args);
    await cardigantime.validate(config);
    
    configMetrics.recordSuccessfulLoad();
    return config;
  } catch (error) {
    if (error instanceof ConfigurationError) {
      configMetrics.recordValidationError(error.errorType);
    } else if (error instanceof FileSystemError) {
      configMetrics.recordFileSystemError(error.errorType);
    }
    
    throw error;
  }
}

// Log metrics periodically
setInterval(() => {
  configMetrics.logMetrics();
}, 60000); // Every minute
```

## Best Practices

### Error Handling Guidelines

1. **Always handle specific error types** rather than catching generic errors
2. **Provide actionable error messages** with clear solutions
3. **Use structured logging** to capture error context
4. **Implement graceful degradation** where possible
5. **Monitor configuration errors** in production
6. **Test error scenarios** in your test suite

### Testing Error Conditions

```typescript
import { describe, it, expect } from 'vitest';

describe('Configuration Error Handling', () => {
  it('should handle missing config directory gracefully', async () => {
    const cardigantime = create({
      defaults: { 
        configDirectory: './nonexistent',
        isRequired: false 
      },
      configShape: MyConfigSchema.shape,
    });
    
    // Should not throw, should use defaults
    const config = await cardigantime.read({});
    expect(config).toBeDefined();
  });
  
  it('should throw FileSystemError for required missing directory', async () => {
    const cardigantime = create({
      defaults: { 
        configDirectory: './nonexistent',
        isRequired: true 
      },
      configShape: MyConfigSchema.shape,
    });
    
    await expect(cardigantime.read({})).rejects.toThrow(FileSystemError);
  });
  
  it('should handle validation errors with details', async () => {
    // Mock invalid configuration
    const mockConfig = { port: 'invalid' }; // Should be number
    
    await expect(cardigantime.validate(mockConfig)).rejects.toThrow(ConfigurationError);
  });
});
```

This comprehensive error handling approach ensures your application can gracefully handle configuration issues while providing clear guidance for resolution. 