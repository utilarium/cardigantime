# API Reference

Complete reference for all Cardigantime methods, parameters, and options.

## `create(options)`

Creates a new Cardigantime instance with the specified configuration.

### Parameters

```typescript
function create<T extends ZodRawShape>(options: {
  defaults: DefaultOptions;
  configShape: T;
  features?: Feature[];
  logger?: Logger;
}): Cardigantime<T>
```

#### `options.defaults` (required)

Default configuration options that define how Cardigantime behaves.

**Type:** `DefaultOptions`

```typescript
interface DefaultOptions {
  configDirectory: string;
  configFile?: string;
  isRequired?: boolean;
  encoding?: BufferEncoding;
  pathResolution?: PathResolutionOptions;
  fieldOverlaps?: FieldOverlapOptions;
}
```

**Properties:**

- **`configDirectory`** (string, required): Directory path where configuration files are located
- **`configFile`** (string, optional): Name of the configuration file. Default: `'config.yaml'`
- **`isRequired`** (boolean, optional): Whether the config directory must exist. Default: `false`
- **`encoding`** (BufferEncoding, optional): File encoding for reading config files. Default: `'utf8'`
- **`pathResolution`** (PathResolutionOptions, optional): Configuration for resolving relative paths
- **`fieldOverlaps`** (FieldOverlapOptions, optional): Array merge behavior for hierarchical mode

#### `options.configShape` (required)

Zod schema shape defining your configuration structure.

**Type:** `T extends ZodRawShape`

**Example:**
```typescript
const MyConfigSchema = z.object({
  port: z.number().default(3000),
  host: z.string().default('localhost'),
});

configShape: MyConfigSchema.shape
```

#### `options.features` (optional)

Array of features to enable in the Cardigantime instance.

**Type:** `Feature[]`
**Default:** `['config']`

**Available features:**
- `'config'`: Basic configuration file loading and validation
- `'hierarchical'`: Hierarchical configuration discovery and merging

#### `options.logger` (optional)

Custom logger implementation for debugging and error reporting.

**Type:** `Logger`
**Default:** Console-based logger

**Interface:**
```typescript
interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  verbose(message: string, ...args: any[]): void;
  silly(message: string, ...args: any[]): void;
}
```

### Returns

**Type:** `Cardigantime<T>`

A Cardigantime instance with the following methods:
- `configure(command)`: Add CLI options to Commander.js command
- `read(args)`: Read and merge configuration from all sources
- `validate(config)`: Validate configuration against schema
- `generateConfig(dir?)`: Generate config file with defaults
- `checkConfig(args)`: Analyze configuration with source tracking
- `setLogger(logger)`: Set custom logger

### Example

```typescript
import { create } from '@theunwalked/cardigantime';
import { z } from 'zod';

const ConfigSchema = z.object({
  port: z.number().default(3000),
  host: z.string().default('localhost'),
  database: z.object({
    url: z.string().url(),
    maxConnections: z.number().default(10),
  }),
});

const cardigantime = create({
  defaults: {
    configDirectory: './config',
    configFile: 'app.yaml',
    isRequired: true,
  },
  configShape: ConfigSchema.shape,
  features: ['config', 'hierarchical'],
});
```

---

## `cardigantime.configure(command)`

Adds Cardigantime's CLI options to a Commander.js command.

### Parameters

```typescript
configure(command: Command): Promise<Command>
```

- **`command`** (Command, required): Commander.js Command instance

### Returns

**Type:** `Promise<Command>`

The modified Commander.js command with added CLI options.

### Added CLI Options

- **`-c, --config-directory <path>`**: Override the default configuration directory path
- **`--init-config`**: Generate initial configuration file with default values and exit
- **`--check-config`**: Display resolved configuration with source tracking and exit

### Example

```typescript
import { Command } from 'commander';

const program = new Command();

program
  .name('myapp')
  .description('My CLI application')
  .version('1.0.0');

// Add Cardigantime options
await cardigantime.configure(program);

// Add your own options
program
  .option('-p, --port <port>', 'Server port', parseInt)
  .option('--host <host>', 'Server host');

program.parse();
```

---

## `cardigantime.read(args)`

Reads and merges configuration from all sources according to precedence rules.

### Parameters

```typescript
read(args: Record<string, any>): Promise<ConfigType>
```

- **`args`** (Record<string, any>, required): Parsed command-line arguments object

### Returns

**Type:** `Promise<ConfigType>`

Merged and typed configuration object. The type is inferred from your Zod schema.

### Behavior

1. **Loads schema defaults**: Applies default values from your Zod schema
2. **Discovers configuration files**: Finds and loads configuration files (hierarchical if enabled)
3. **Merges configurations**: Deep merges with proper precedence (CLI > files > defaults)
4. **Resolves paths**: Applies path resolution if configured
5. **Returns typed config**: Provides full TypeScript support

### Example

```typescript
const program = new Command();
await cardigantime.configure(program);
program.parse();

const args = program.opts();
const config = await cardigantime.read(args);

// config is fully typed based on your schema
console.log(`Server: ${config.host}:${config.port}`);
```

---

## `cardigantime.validate(config)`

Validates configuration against the schema and checks for extra keys.

### Parameters

```typescript
validate(config: any): Promise<void>
```

- **`config`** (any, required): Configuration object to validate

### Returns

**Type:** `Promise<void>`

Resolves if validation passes, throws if validation fails.

### Throws

- **`ConfigurationError`**: When validation fails or extra keys are found

### Example

```typescript
try {
  const config = await cardigantime.read(args);
  await cardigantime.validate(config);
  
  console.log('✅ Configuration is valid');
  await startApplication(config);
  
} catch (error) {
  console.error('❌ Configuration validation failed:', error.message);
  process.exit(1);
}
```

---

## `cardigantime.generateConfig(configDirectory?)`

Generates a configuration file with default values from your Zod schema.

### Parameters

```typescript
generateConfig(configDirectory?: string): Promise<void>
```

- **`configDirectory`** (string, optional): Target directory for the config file. Uses default if not specified.

### Returns

**Type:** `Promise<void>`

Resolves when file is created successfully.

### Behavior

- **Creates directory**: Creates the target directory if it doesn't exist
- **Generates YAML**: Creates YAML file with all default values from your schema
- **Adds comments**: Includes helpful comments and formatting
- **Prevents overwrite**: Won't overwrite existing files (shows preview instead)

### Example

```typescript
// Generate config in default directory
await cardigantime.generateConfig();

// Generate config in specific directory
await cardigantime.generateConfig('./production-config');
```

### Generated File Example

```yaml
# Configuration file generated by Cardigantime
# This file contains default values for your application configuration.
# Modify the values below to customize your application's behavior.

host: localhost
port: 3000
database:
  maxConnections: 10
  url: ""
debug: false
features: []
```

---

## `cardigantime.checkConfig(args)`

Analyzes and displays resolved configuration with detailed source tracking.

### Parameters

```typescript
checkConfig(args: Record<string, any>): Promise<void>
```

- **`args`** (Record<string, any>, required): Parsed command-line arguments object

### Returns

**Type:** `Promise<void>`

Displays analysis and exits the process.

### Output Features

- **Source tracking**: Shows which file/level contributed each configuration value
- **Git blame-like format**: Easy to understand source attribution
- **Hierarchical visualization**: Displays precedence levels clearly
- **Summary statistics**: Overview of configuration sources

### Example

```typescript
// This is typically called automatically via CLI
// ./myapp --check-config

// Or programmatically
await cardigantime.checkConfig(args);
```

### Example Output

```
================================================================================
CONFIGURATION SOURCE ANALYSIS
================================================================================

DISCOVERED CONFIGURATION HIERARCHY:
  Level 0: /project/subdir/.myapp (highest precedence)
  Level 1: /project/.myapp (lowest precedence)

RESOLVED CONFIGURATION WITH SOURCES:
Format: [Source] key: value

[Level 0: subdir        ] host                : "localhost"
[Level 1: project       ] port                : 3000
[CLI argument           ] database.url        : "postgres://localhost/db"
[Schema default         ] database.maxConnections : 10

--------------------------------------------------------------------------------
SUMMARY:
  Total configuration keys: 4
  Configuration sources: 3
  Values by source:
    Level 0: subdir: 1 value(s)
    Level 1: project: 1 value(s)
    CLI argument: 1 value(s)
    Schema default: 1 value(s)
================================================================================
```

---

## `cardigantime.setLogger(logger)`

Sets a custom logger for debugging and error reporting.

### Parameters

```typescript
setLogger(logger: Logger): void
```

- **`logger`** (Logger, required): Logger implementing the Logger interface

### Example

```typescript
import winston from 'winston';

const customLogger = winston.createLogger({
  level: 'debug',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'app.log' }),
    new winston.transports.Console(),
  ],
});

cardigantime.setLogger(customLogger);
```

---

## Type Definitions

### `PathResolutionOptions`

Configuration for resolving relative paths in configuration values.

```typescript
interface PathResolutionOptions {
  pathFields?: string[];
  resolvePathArray?: string[];
}
```

**Properties:**
- **`pathFields`**: Array of field names (using dot notation) that contain paths to be resolved
- **`resolvePathArray`**: Array of field names whose array elements should all be resolved as paths

**Example:**
```typescript
pathResolution: {
  pathFields: ['outputDir', 'logFile', 'database.backupPath'],
  resolvePathArray: ['includePaths', 'watchDirectories']
}
```

### `FieldOverlapOptions`

Configuration for how array fields should be merged in hierarchical mode.

```typescript
interface FieldOverlapOptions {
  [fieldPath: string]: 'override' | 'append' | 'prepend';
}
```

**Values:**
- **`override`** (default): Higher precedence arrays completely replace lower precedence arrays
- **`append`**: Higher precedence array elements are appended to lower precedence arrays
- **`prepend`**: Higher precedence array elements are prepended to lower precedence arrays

**Example:**
```typescript
fieldOverlaps: {
  'features': 'append',              // Combine features from all levels
  'excludePatterns': 'prepend',      // Higher precedence first
  'api.endpoints': 'append',         // Nested field configuration
  'middleware.stack': 'override'     // Replace entirely (default)
}
```

### `Feature`

Available features that can be enabled in Cardigantime.

```typescript
type Feature = 'config' | 'hierarchical';
```

### `Logger`

Interface for custom logger implementations.

```typescript
interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  verbose(message: string, ...args: any[]): void;
  silly(message: string, ...args: any[]): void;
}
```

---

## Error Types

### `ConfigurationError`

Thrown when configuration validation fails or contains extra keys.

```typescript
class ConfigurationError extends Error {
  errorType: 'validation' | 'schema' | 'extra_keys';
  details: any;
  configPath?: string;
}
```

### `FileSystemError`

Thrown when file system operations fail.

```typescript
class FileSystemError extends Error {
  errorType: 'not_found' | 'not_readable' | 'not_writable' | 'creation_failed' | 'operation_failed';
  path: string;
  operation: string;
  originalError?: Error;
}
```

### `ArgumentError`

Thrown when CLI arguments or function parameters are invalid.

```typescript
class ArgumentError extends Error {
  argument: string;
}
```

---

## Usage Patterns

### Basic Setup

```typescript
const cardigantime = create({
  defaults: { configDirectory: './config' },
  configShape: MyConfigSchema.shape,
});

const program = new Command();
await cardigantime.configure(program);
program.parse();

const config = await cardigantime.read(program.opts());
await cardigantime.validate(config);
```

### With Hierarchical Configuration

```typescript
const cardigantime = create({
  defaults: { 
    configDirectory: '.myapp',
    fieldOverlaps: {
      'features': 'append',
      'excludePatterns': 'prepend'
    }
  },
  configShape: MyConfigSchema.shape,
  features: ['config', 'hierarchical'],
});
```

### With Path Resolution

```typescript
const cardigantime = create({
  defaults: {
    configDirectory: './config',
    pathResolution: {
      pathFields: ['outputDir', 'logFile'],
      resolvePathArray: ['includePaths']
    }
  },
  configShape: MyConfigSchema.shape,
});
```

### With Custom Logger

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'debug',
  transports: [new winston.transports.Console()]
});

const cardigantime = create({
  defaults: { configDirectory: './config' },
  configShape: MyConfigSchema.shape,
  logger,
});
```

### Error Handling

```typescript
import { ConfigurationError, FileSystemError, ArgumentError } from '@theunwalked/cardigantime';

try {
  const config = await cardigantime.read(args);
  await cardigantime.validate(config);
} catch (error) {
  if (error instanceof ConfigurationError) {
    // Handle validation errors
  } else if (error instanceof FileSystemError) {
    // Handle file system errors
  } else if (error instanceof ArgumentError) {
    // Handle argument errors
  }
}
``` 