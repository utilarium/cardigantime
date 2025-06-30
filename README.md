# Cardigantime

A robust TypeScript library for configuration management in command-line applications. Cardigantime provides type-safe configuration loading, validation, and CLI integration with Commander.js and Zod schemas.

## What is Cardigantime?

Cardigantime is a configuration management library designed to solve the common problem of handling configuration in CLI applications. It provides a unified way to:

- **Read configuration from YAML files** with intelligent file discovery
- **Validate configuration** using Zod schemas for type safetygit sta
- **Integrate with CLI frameworks** like Commander.js seamlessly
- **Merge configuration sources** (files, CLI args, defaults) with proper precedence
- **Handle errors gracefully** with comprehensive logging and user-friendly error messages

## Why Cardigantime?

Building CLI applications with proper configuration management is harder than it should be. **Cardigantime was created specifically to solve the complex problem of supporting sophisticated configuration systems that seamlessly merge command-line arguments, configuration files, and default values.**

### The Configuration Complexity Problem

Modern CLI applications need to handle increasingly complex configuration scenarios:

- **Multi-layered configuration sources** with proper precedence (CLI args > config files > defaults)
- **Nested configuration objects** with deep validation requirements
- **Environment-specific configurations** (development, staging, production)
- **Dynamic feature flags** and optional modules
- **Type safety** throughout the entire configuration pipeline
- **User-friendly error messages** when configuration goes wrong

### What You Need to Handle

Without Cardigantime, building robust configuration management requires:

1. **Parse command-line arguments** - handled by Commander.js, but integration is manual
2. **Read configuration files** - YAML/JSON parsing with proper error handling
3. **Implement sophisticated merging logic** - CLI args should override file config, which should override defaults, with proper deep merging
4. **Validate complex nested structures** - ensure required fields exist, types are correct, and business rules are followed
5. **Handle edge cases gracefully** - missing files, malformed YAML, permission errors, invalid paths
6. **Provide actionable error messages** - users need to know exactly what's wrong and how to fix it
7. **Maintain type safety** - TypeScript support with proper IntelliSense throughout the entire pipeline
8. **Support advanced scenarios** - schema evolution, backward compatibility, configuration discovery

### The Manual Approach Pain Points

Implementing this manually leads to common problems:

```typescript
// Typical manual configuration merging - fragile and error-prone
const config = {
  ...defaultConfig,          // Defaults
  ...yamlConfig,            // File config
  ...processCliArgs(args),  // CLI overrides
};

// Problems:
// ❌ Shallow merging loses nested structure
// ❌ No validation until runtime failures
// ❌ Poor error messages: "Cannot read property 'x' of undefined"
// ❌ Type safety lost after merging
// ❌ No protection against typos in config files
// ❌ Manual path resolution and security checks
```

### How Cardigantime Solves This

Cardigantime provides a complete, battle-tested solution:

```typescript
// Cardigantime approach - robust and type-safe
const cardigantime = create({
  defaults: { configDirectory: './config' },
  configShape: ComplexConfigSchema.shape, // Full type safety
});

const config = await cardigantime.read(args);  // Smart merging
await cardigantime.validate(config);           // Comprehensive validation

// Benefits:
// ✅ Deep merging preserves nested structures
// ✅ Schema validation with detailed error messages
// ✅ Full TypeScript support with IntelliSense
// ✅ Typo detection and helpful suggestions
// ✅ Built-in security protections
// ✅ Graceful error handling with actionable messages
```

### Real-World Example: Complex Configuration

Here's the kind of complex configuration Cardigantime was designed to handle:

```typescript
const ComplexConfigSchema = z.object({
  // Database configuration with multiple environments
  database: z.object({
    primary: z.object({
      host: z.string().default('localhost'),
      port: z.number().min(1).max(65535).default(5432),
      ssl: z.boolean().default(false),
    }),
    replicas: z.array(z.string().url()).default([]),
    maxConnections: z.number().positive().default(10),
  }),
  
  // Feature flags and optional modules
  features: z.record(z.boolean()).default({}),
  
  // API configuration with validation
  api: z.object({
    key: z.string().min(32, "API key must be at least 32 characters"),
    timeout: z.number().min(1000).max(30000).default(5000),
    retries: z.number().min(0).max(10).default(3),
    baseUrl: z.string().url(),
  }),
  
  // Logging configuration
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    outputs: z.array(z.enum(['console', 'file', 'syslog'])).default(['console']),
    rotation: z.object({
      maxSize: z.string().regex(/^\d+[KMG]B$/),
      maxFiles: z.number().positive().default(5),
    }).optional(),
  }),
});

// Users can now run:
// ./myapp --api-timeout 10000 --features-analytics true --config-directory ./prod-config
// And everything just works with full validation and type safety
```

Cardigantime handles all of this complexity while providing excellent developer experience and robust error handling. **It was specifically created because existing solutions either lacked the sophistication needed for complex configuration scenarios or required too much boilerplate code to achieve proper integration between CLI arguments, configuration files, and defaults.**

## Installation

```bash
npm install @theunwalked/cardigantime
# or
pnpm add @theunwalked/cardigantime
# or
yarn add @theunwalked/cardigantime
```

## Quick Start

Here's a complete example of building a CLI tool with Cardigantime:

```typescript
import { Command } from 'commander';
import { create } from '@theunwalked/cardigantime';
import { z } from 'zod';

// Define your configuration schema using Zod
const MyConfigSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  timeout: z.number().min(1000).default(5000),
  retries: z.number().min(0).max(10).default(3),
  debug: z.boolean().default(false),
});

// Create a Cardigantime instance
const cardigantime = create({
  defaults: {
    configDirectory: './config', // Required: where to look for config files
    configFile: 'myapp.yaml',   // Optional: defaults to 'config.yaml'
    isRequired: false,          // Optional: whether config directory must exist
  },
  configShape: MyConfigSchema.shape, // Your Zod schema
  features: ['config'],              // Optional: enabled features
});

// Set up your CLI with Commander.js
async function main() {
  const program = new Command();
  
  program
    .name('myapp')
    .description('My awesome CLI application')
    .version('1.0.0');

  // Let Cardigantime add its CLI options (like --config-directory)
  await cardigantime.configure(program);
  
  // Add your own CLI options
  program
    .option('-k, --api-key <key>', 'API key for authentication')
    .option('-t, --timeout <ms>', 'Request timeout in milliseconds', parseInt)
    .option('--debug', 'Enable debug mode');

  program.parse();
  const args = program.opts();

  try {
    // Read and validate configuration
    const config = await cardigantime.read(args);
    await cardigantime.validate(config);

    console.log('Configuration loaded successfully:', config);
    
    // Your application logic here
    await runMyApp(config);
    
  } catch (error) {
    console.error('Configuration error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
```

### Example Configuration File (`config/myapp.yaml`)

```yaml
apiKey: "your-secret-api-key"
timeout: 10000
retries: 5
debug: true
```

### Example Usage

```bash
# Use config from file
./myapp

# Override config with CLI arguments
./myapp --api-key "different-key" --timeout 15000

# Use different config directory
./myapp --config-directory /etc/myapp

# Enable debug mode
./myapp --debug
```

## Core Concepts

### 1. Configuration Sources & Precedence

Cardigantime merges configuration from multiple sources in this order (highest to lowest priority):

1. **Command-line arguments** (highest priority)
2. **Configuration file(s)** (medium priority)  
3. **Default values** (lowest priority)

```typescript
// If you have this config file:
// timeout: 5000
// debug: false

// And run: ./myapp --timeout 10000

// The final config will be:
// timeout: 10000  (from CLI, overrides file)
// debug: false    (from file)
```

### 2. Hierarchical Configuration Discovery

Cardigantime supports hierarchical configuration discovery, similar to how tools like `.gitignore`, `.eslintrc`, or `package.json` work. When the `hierarchical` feature is enabled, Cardigantime will:

1. **Start from the specified config directory** (e.g., `./project/subdir/.kodrdriv`)
2. **Search up the directory tree** for additional config directories with the same name
3. **Merge configurations** with proper precedence (closer directories win)
4. **Apply CLI arguments** as the final override

#### Example Directory Structure

```
/home/user/projects/
├── .kodrdriv/
│   └── config.yaml          # Root-level config
├── myproject/
│   ├── .kodrdriv/
│   │   └── config.yaml      # Project-level config  
│   └── submodule/
│       ├── .kodrdriv/
│       │   └── config.yaml  # Submodule-level config
│       └── my-script.js
```

#### Hierarchical Discovery Behavior

When running from `/home/user/projects/myproject/submodule/` with hierarchical discovery:

1. **Level 0 (Highest Priority)**: `/home/user/projects/myproject/submodule/.kodrdriv/config.yaml`
2. **Level 1**: `/home/user/projects/myproject/.kodrdriv/config.yaml`  
3. **Level 2 (Lowest Priority)**: `/home/user/projects/.kodrdriv/config.yaml`

Configurations are deep-merged, with closer directories taking precedence:

```yaml
# /home/user/projects/.kodrdriv/config.yaml (Level 2)
database:
  host: localhost
  port: 5432
  ssl: false
logging:
  level: info

# /home/user/projects/myproject/.kodrdriv/config.yaml (Level 1)  
database:
  port: 5433
  ssl: true
api:
  timeout: 5000

# /home/user/projects/myproject/submodule/.kodrdriv/config.yaml (Level 0)
database:
  host: dev.example.com
logging:
  level: debug

# Final merged configuration:
database:
  host: dev.example.com    # From Level 0 (highest precedence)
  port: 5433               # From Level 1  
  ssl: true                # From Level 1
api:
  timeout: 5000            # From Level 1
logging:
  level: debug             # From Level 0 (highest precedence)
```

#### Enabling Hierarchical Discovery

```typescript
const cardigantime = create({
  defaults: { 
    configDirectory: '.kodrdriv',
    configFile: 'config.yaml'
  },
  configShape: MyConfigSchema.shape,
  features: ['config', 'hierarchical'], // Enable hierarchical discovery
});
```

#### Hierarchical Discovery Options

The hierarchical discovery has several built-in protections and features:

- **Maximum traversal depth**: Prevents infinite loops (default: 10 levels)
- **Symlink protection**: Tracks visited paths to prevent circular references
- **Graceful fallback**: Falls back to single-directory mode if discovery fails
- **Error tolerance**: Continues discovery even if some directories are unreadable
- **Root detection**: Automatically stops at filesystem root

#### Use Cases for Hierarchical Configuration

1. **Monorepos**: Share common configuration across multiple packages
2. **Project inheritance**: Override team/organization defaults for specific projects  
3. **Environment layering**: Different configs for development/staging/production
4. **Tool configuration**: Similar to how ESLint or Prettier find configs up the tree
5. **Multi-tenant applications**: Tenant-specific overrides of global settings

### 3. Schema Validation

All configuration is validated against your Zod schema:

```typescript
const ConfigSchema = z.object({
  port: z.number().min(1).max(65535),
  host: z.string().ip().or(z.literal('localhost')),
  database: z.object({
    url: z.string().url(),
    maxConnections: z.number().positive().default(10),
  }),
  features: z.array(z.enum(['auth', 'analytics', 'logging'])).default([]),
});

const cardigantime = create({
  defaults: { configDirectory: './config' },
  configShape: ConfigSchema.shape,
});
```

### 4. Type Safety

Cardigantime provides full TypeScript support:

```typescript
// The config object is fully typed
const config = await cardigantime.read(args);
// config.database.maxConnections is number
// config.features is ('auth' | 'analytics' | 'logging')[]
// config.port is number

// IntelliSense works everywhere
if (config.features.includes('auth')) {
  // Setup authentication
}
```

### 5. Error Handling

Cardigantime provides detailed error messages for common issues:

```typescript
try {
  await cardigantime.validate(config);
} catch (error) {
  // Detailed validation errors:
  // "Configuration validation failed: port must be between 1 and 65535"
  // "Unknown configuration keys found: typoKey. Allowed keys are: port, host, database"
  // "Config directory does not exist and is required: /nonexistent/path"
}
```

## API Reference

### `create(options)`

Creates a new Cardigantime instance.

**Parameters:**
- `options.defaults` (required): Default configuration options
  - `configDirectory` (required): Directory to look for config files
  - `configFile` (optional): Config filename, defaults to `'config.yaml'`
  - `isRequired` (optional): Whether config directory must exist, defaults to `false`
  - `encoding` (optional): File encoding, defaults to `'utf8'`
- `options.configShape` (required): Zod schema shape for validation
- `options.features` (optional): Array of features to enable, defaults to `['config']`
- `options.logger` (optional): Custom logger implementation

**Returns:** `Cardigantime` instance

### `cardigantime.configure(command)`

Adds Cardigantime's CLI options to a Commander.js command.

**Parameters:**
- `command`: Commander.js Command instance

**Returns:** Promise<Command> - The modified command

**Added Options:**
- `-c, --config-directory <path>`: Override config directory

### `cardigantime.read(args)`

Reads and merges configuration from all sources.

**Parameters:**
- `args`: Parsed command-line arguments object

**Returns:** Promise<Config> - Merged and typed configuration object

### `cardigantime.validate(config)`

Validates configuration against the schema.

**Parameters:**
- `config`: Configuration object to validate

**Returns:** Promise<void> - Throws on validation failure

### `cardigantime.setLogger(logger)`

Sets a custom logger for debugging and error reporting.

**Parameters:**
- `logger`: Logger implementing the Logger interface

## Advanced Usage

### Hierarchical Configuration Discovery

Here's a complete example of using hierarchical configuration discovery for a monorepo setup:

```typescript
import { create } from '@theunwalked/cardigantime';
import { z } from 'zod';

// Define a comprehensive configuration schema
const ProjectConfigSchema = z.object({
  projectName: z.string(),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  database: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(5432),
    ssl: z.boolean().default(false),
    maxConnections: z.number().default(10),
  }),
  api: z.object({
    baseUrl: z.string().url(),
    timeout: z.number().default(5000),
    retries: z.number().default(3),
  }),
  features: z.record(z.boolean()).default({}),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    outputs: z.array(z.string()).default(['console']),
  }),
});

// Enable hierarchical discovery
const cardigantime = create({
  defaults: {
    configDirectory: '.myapp',
    configFile: 'config.yaml',
  },
  configShape: ProjectConfigSchema.shape,
  features: ['config', 'hierarchical'], // Enable hierarchical discovery
});

// Usage in a CLI tool
async function setupProject() {
  try {
    const config = await cardigantime.read(process.argv);
    await cardigantime.validate(config);
    
    console.log(`Setting up ${config.projectName} in ${config.environment} mode`);
    console.log(`Database: ${config.database.host}:${config.database.port}`);
    console.log(`API: ${config.api.baseUrl}`);
    
    return config;
  } catch (error) {
    console.error('Configuration error:', error.message);
    process.exit(1);
  }
}
```

**Directory Structure:**
```
/workspace/
├── .myapp/
│   └── config.yaml              # Global defaults
├── team-frontend/
│   ├── .myapp/
│   │   └── config.yaml          # Team-specific settings
│   ├── app1/
│   │   ├── .myapp/
│   │   │   └── config.yaml      # App-specific overrides
│   │   └── package.json
│   └── app2/
│       └── package.json         # Uses team + global config
```

**Configuration Files:**
```yaml
# /workspace/.myapp/config.yaml (Global)
database:
  host: prod.db.company.com
  ssl: true
api:
  baseUrl: https://api.company.com
logging:
  level: warn
  outputs: [console, file]

# /workspace/team-frontend/.myapp/config.yaml (Team)
database:
  host: team-frontend.db.company.com
api:
  timeout: 3000
features:
  analytics: true
  darkMode: true

# /workspace/team-frontend/app1/.myapp/config.yaml (App)
projectName: frontend-app1
environment: development
database:
  host: localhost  # Override for local development
logging:
  level: debug
```

When running from `/workspace/team-frontend/app1/`, the final merged configuration will be:

```yaml
projectName: frontend-app1           # From app level
environment: development             # From app level  
database:
  host: localhost                   # From app level (highest precedence)
  ssl: true                         # From global level
api:
  baseUrl: https://api.company.com  # From global level
  timeout: 3000                     # From team level
features:
  analytics: true                   # From team level
  darkMode: true                    # From team level
logging:
  level: debug                      # From app level (highest precedence)
  outputs: [console, file]          # From global level
```

### Custom Logger

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'app.log' }),
    new winston.transports.Console(),
  ],
});

const cardigantime = create({
  defaults: { configDirectory: './config' },
  configShape: MyConfigSchema.shape,
  logger, // Use Winston for logging
});
```

### Complex Configuration Schema

```typescript
const DatabaseConfig = z.object({
  host: z.string(),
  port: z.number().min(1).max(65535),
  username: z.string(),
  password: z.string(),
  ssl: z.boolean().default(false),
});

const AppConfigSchema = z.object({
  app: z.object({
    name: z.string(),
    version: z.string(),
    environment: z.enum(['development', 'staging', 'production']),
  }),
  database: DatabaseConfig,
  redis: z.object({
    url: z.string().url(),
    ttl: z.number().positive().default(3600),
  }),
  features: z.record(z.boolean()).default({}), // Dynamic feature flags
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    file: z.string().optional(),
  }),
});
```

### Environment-Specific Configuration

```typescript
// Use different config directories for different environments
const environment = process.env.NODE_ENV || 'development';

const cardigantime = create({
  defaults: {
    configDirectory: `./config/${environment}`,
    configFile: 'app.yaml',
  },
  configShape: AppConfigSchema.shape,
});
```

### Configuration File Discovery

```typescript
// Cardigantime will look for config files in this order:
// 1. CLI argument: --config-directory /path/to/config
// 2. Default directory: ./config
// 3. If not found and isRequired: false, continues with empty config
// 4. If not found and isRequired: true, throws error
```

## Error Handling

Cardigantime provides structured error types that allow you to handle different failure scenarios programmatically. All custom errors extend the standard JavaScript `Error` class and can be imported from the main package.

### Error Types

```typescript
import { 
  ConfigurationError, 
  FileSystemError, 
  ArgumentError 
} from '@theunwalked/cardigantime';
```

#### ConfigurationError

Thrown when configuration validation fails, contains extra keys, or schema issues occur.

**Properties:**
- `errorType`: `'validation' | 'schema' | 'extra_keys'`
- `details`: Additional error context (e.g., Zod error details, extra keys info)
- `configPath`: Path to the configuration file (when applicable)

#### FileSystemError

Thrown when file system operations fail (directory access, file reading, etc.).

**Properties:**
- `errorType`: `'not_found' | 'not_readable' | 'not_writable' | 'creation_failed' | 'operation_failed'`
- `path`: The file/directory path that caused the error
- `operation`: The operation that failed
- `originalError`: The underlying error (when applicable)

#### ArgumentError

Thrown when CLI arguments or function parameters are invalid.

**Properties:**
- `argument`: The name of the invalid argument

### Error Handling Examples

#### Basic Error Handling

```typescript
import { create, ConfigurationError, FileSystemError, ArgumentError } from '@theunwalked/cardigantime';

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

#### Detailed Configuration Error Handling

```typescript
function handleConfigError(error: ConfigurationError) {
  switch (error.errorType) {
    case 'validation':
      console.error('❌ Configuration validation failed');
      console.error('Details:', JSON.stringify(error.details, null, 2));
      console.error('Please check your configuration values against the schema.');
      break;
      
    case 'extra_keys':
      console.error('❌ Unknown configuration keys found');
      console.error('Extra keys:', error.details.extraKeys.join(', '));
      console.error('Allowed keys:', error.details.allowedKeys.join(', '));
      console.error('Please remove the unknown keys or update your schema.');
      break;
      
    case 'schema':
      console.error('❌ Configuration schema is invalid');
      console.error('Details:', error.details);
      break;
  }
  
  if (error.configPath) {
    console.error(`Configuration file: ${error.configPath}`);
  }
  
  process.exit(1);
}
```

#### File System Error Handling

```typescript
function handleFileSystemError(error: FileSystemError) {
  switch (error.errorType) {
    case 'not_found':
      if (error.operation === 'directory_access') {
        console.error(`❌ Configuration directory not found: ${error.path}`);
        console.error('Solutions:');
        console.error('  1. Create the directory: mkdir -p ' + error.path);
        console.error('  2. Use a different directory with --config-directory');
        console.error('  3. Set isRequired: false in your options');
      } else {
        console.error(`❌ Configuration file not found: ${error.path}`);
        console.error('Create the configuration file or check the path.');
      }
      break;
      
    case 'not_readable':
      console.error(`❌ Cannot read ${error.path}`);
      console.error('Check file/directory permissions:');
      console.error(`  chmod +r ${error.path}`);
      break;
      
    case 'creation_failed':
      console.error(`❌ Failed to create directory: ${error.path}`);
      console.error('Original error:', error.originalError?.message);
      console.error('Check parent directory permissions.');
      break;
      
    case 'operation_failed':
      console.error(`❌ File operation failed: ${error.operation}`);
      console.error('Path:', error.path);
      console.error('Error:', error.originalError?.message);
      break;
  }
  
  process.exit(1);
}
```

#### Argument Error Handling

```typescript
function handleArgumentError(error: ArgumentError) {
  console.error(`❌ Invalid argument: ${error.argument}`);
  console.error(`Error: ${error.message}`);
  console.error('Please check your command line arguments or function parameters.');
  process.exit(1);
}
```

#### Graceful Degradation

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
      const cleanConfig = removeExtraKeys(config, error.details.allowedKeys);
      await cardigantime.validate(cleanConfig);
      return cleanConfig;
    }
    
    // Re-throw other errors
    throw error;
  }
}
```

### Error Messages and Troubleshooting

#### Common Configuration Errors

**Schema validation failed:**
```typescript
// Error type: ConfigurationError with errorType: 'validation'
{
  "port": {
    "_errors": ["Number must be greater than or equal to 1"]
  }
}
```
*Solution:* Fix the configuration values to match your schema requirements.

**Unknown configuration keys:**
```typescript
// Error type: ConfigurationError with errorType: 'extra_keys'
// error.details.extraKeys: ['databse']
// error.details.allowedKeys: ['database', 'port', 'host']
```
*Solution:* Fix typos in your configuration file or update your schema.

#### Common File System Errors

**Configuration directory not found:**
```typescript
// Error type: FileSystemError with errorType: 'not_found'
// error.path: '/etc/myapp'
// error.operation: 'directory_access'
```
*Solutions:*
- Create the directory: `mkdir -p /etc/myapp`
- Use a different directory: `--config-directory ./config`
- Make it optional: `isRequired: false`

**Directory not readable:**
```typescript
// Error type: FileSystemError with errorType: 'not_readable'
// error.path: '/etc/restricted'
// error.operation: 'directory_read'
```
*Solution:* Check file permissions: `chmod +r /etc/restricted`

#### Common Argument Errors

**Invalid config directory argument:**
```typescript
// Error type: ArgumentError with argument: 'config-directory'
// Triggered by: --config-directory ""
```
*Solution:* Provide a valid directory path: `--config-directory ./config`

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

Apache-2.0 - see [LICENSE](LICENSE) file for details.

## Why "Cardigantime"?

Because configuration management should be as comfortable and reliable as your favorite cardigan. Just like a good cardigan keeps you warm and comfortable, Cardigantime keeps your application configuration cozy and well-organized.

