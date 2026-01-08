# Configuration Options Reference

Comprehensive guide to all configuration options available in Cardigantime for customizing behavior, file handling, and advanced features.

## Default Options (`defaults`)

All options passed to the `defaults` property when creating a Cardigantime instance.

### Required Options

#### `configDirectory` (string, required)

Directory path where configuration files are located.

**Examples:**
- `'./config'` - Relative to current working directory
- `'/etc/myapp'` - Absolute path
- `'~/.config/myapp'` - Home directory (expanded by shell)

**Behavior:**
- Will be resolved relative to the current working directory
- Can be overridden at runtime with `--config-directory` CLI option
- Used as starting point for hierarchical discovery when enabled

```typescript
defaults: {
  configDirectory: './config'
}
```

### Optional Options

#### `configFile` (string, optional)

Name of the configuration file within the config directory.

**Default:** `'config.yaml'`
**Supported formats:** `.yaml`, `.yml`

**Automatic Extension Fallback:** If the specified file is not found, Cardigantime will automatically try the alternative extension. For example, if `config.yaml` is not found, it will try `config.yml`, and vice versa.

**Examples:**
- `'app.yaml'`
- `'settings.yml'` 
- `'myapp-config.yaml'`

```typescript
defaults: {
  configDirectory: './config',
  configFile: 'app.yaml'
}
```

#### `isRequired` (boolean, optional)

Whether the configuration directory must exist.

**Default:** `false`

**When `true`:**
- Throws `FileSystemError` if directory doesn't exist
- Useful for production environments where config is mandatory

**When `false`:**
- Continues with empty config if directory is missing
- Useful for development or when configuration is optional

```typescript
// Require config directory to exist
defaults: {
  configDirectory: './config',
  isRequired: true
}

// Make config directory optional
defaults: {
  configDirectory: './config', 
  isRequired: false // default
}
```

#### `encoding` (BufferEncoding, optional)

File encoding for reading configuration files.

**Default:** `'utf8'`
**Common values:** `'utf8'`, `'ascii'`, `'utf16le'`, `'latin1'`

```typescript
defaults: {
  configDirectory: './config',
  encoding: 'utf8' // default
}
```

#### `pathResolution` (PathResolutionOptions, optional)

Configuration for resolving relative paths in configuration values.

**Interface:**
```typescript
interface PathResolutionOptions {
  pathFields?: string[];
  resolvePathArray?: string[];
}
```

**Purpose:** Makes configuration portable by resolving paths relative to the config file location.

##### `pathFields` (string[], optional)

Array of field names (using dot notation) that contain paths to be resolved.

**Examples:**
```typescript
pathResolution: {
  pathFields: [
    'outputDir',              // Top-level field
    'logFile',               // Top-level field
    'database.backupPath',   // Nested field using dot notation
    'ssl.certPath',          // Another nested field
    'ssl.keyPath'
  ]
}
```

**Configuration file at `./config/app.yaml`:**
```yaml
outputDir: ./build          # Resolved to ./config/build
logFile: ../logs/app.log    # Resolved to ./logs/app.log
database:
  backupPath: ./backups     # Resolved to ./config/backups
ssl:
  certPath: ./certs/cert.pem # Resolved to ./config/certs/cert.pem
  keyPath: ./certs/key.pem   # Resolved to ./config/certs/key.pem
```

##### `resolvePathArray` (string[], optional)

Array of field names whose array elements should all be resolved as paths.

**Examples:**
```typescript
pathResolution: {
  resolvePathArray: [
    'includePaths',          // Each element is resolved as a path
    'watchDirectories',      // Each element is resolved as a path
    'build.sources'          // Nested array field
  ]
}
```

**Configuration file:**
```yaml
includePaths:               # Each element resolved as path
  - ./src                   # -> ./config/src
  - ../shared              # -> ./shared
  - /absolute/path         # -> /absolute/path (unchanged)
watchDirectories:
  - ./watch1               # -> ./config/watch1
  - ./watch2               # -> ./config/watch2
```

**Complete path resolution example:**
```typescript
const cardigantime = create({
  defaults: {
    configDirectory: './config',
    pathResolution: {
      pathFields: ['outputDir', 'logFile', 'database.backupDir'],
      resolvePathArray: ['includePaths', 'watchDirectories']
    }
  },
  configShape: MySchema.shape
});
```

#### `fieldOverlaps` (FieldOverlapOptions, optional)

Configuration for how array fields should be merged in hierarchical mode.

**Interface:**
```typescript
interface FieldOverlapOptions {
  [fieldPath: string]: 'override' | 'append' | 'prepend';
}
```

**Only applies when:** `features: ['config', 'hierarchical']` is enabled.

**Default behavior:** All arrays use `'override'` (higher precedence arrays replace lower precedence arrays).

##### Overlap Modes

**`override` (default):**
Higher precedence arrays completely replace lower precedence arrays.

**`append`:**
Higher precedence array elements are appended to lower precedence arrays.

**`prepend`:**
Higher precedence array elements are prepended to lower precedence arrays.

##### Examples

**Basic field overlap configuration:**
```typescript
fieldOverlaps: {
  'features': 'append',              // Combine features from all levels
  'excludePatterns': 'prepend',      // Higher precedence first
  'middleware.stack': 'override'     // Replace entirely (default)
}
```

**Nested field configuration:**
```typescript
fieldOverlaps: {
  'api.endpoints': 'append',
  'database.migrations': 'prepend',
  'config.features.experimental': 'override'
}
```

**Hierarchical example:**

*Configuration hierarchy:*
```
/workspace/.myapp/config.yaml (Level 2 - lowest precedence)
/workspace/team/.myapp/config.yaml (Level 1 - medium precedence)  
/workspace/team/project/.myapp/config.yaml (Level 0 - highest precedence)
```

*Configuration files:*
```yaml
# Level 2 (lowest precedence)
features: ['auth', 'logging']
excludePatterns: ['*.tmp', '*.cache']

# Level 1 (medium precedence)
features: ['analytics', 'metrics']
excludePatterns: ['*.log']

# Level 0 (highest precedence)
features: ['debug-mode']
excludePatterns: ['*.debug']
```

*With field overlap configuration:*
```typescript
fieldOverlaps: {
  'features': 'append',
  'excludePatterns': 'prepend'
}
```

*Final merged result:*
```yaml
features: ['auth', 'logging', 'analytics', 'metrics', 'debug-mode']  # append mode
excludePatterns: ['*.debug', '*.log', '*.tmp', '*.cache']            # prepend mode
```

## Instance Options

Options passed directly to the `create()` function.

### `features` (Feature[], optional)

Array of features to enable in the Cardigantime instance.

**Type:** `Feature[]`
**Default:** `['config']`

**Available features:**
- `'config'`: Basic configuration file loading and validation (always enabled)
- `'hierarchical'`: Hierarchical configuration discovery and merging

**Examples:**
```typescript
// Basic configuration only
features: ['config']

// Hierarchical configuration
features: ['config', 'hierarchical']
```

### `configShape` (ZodRawShape, required)

Zod schema shape defining your configuration structure.

**Type:** `T extends ZodRawShape`
**Must be:** The `.shape` property of a Zod object schema

**Example:**
```typescript
const MyConfigSchema = z.object({
  port: z.number().default(3000),
  host: z.string().default('localhost'),
  database: z.object({
    url: z.string().url(),
    maxConnections: z.number().default(10),
  }),
});

// Use the .shape property
configShape: MyConfigSchema.shape
```

### `logger` (Logger, optional)

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

**Winston example:**
```typescript
import winston from 'winston';

const customLogger = winston.createLogger({
  level: 'debug',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'app.log' }),
    new winston.transports.Console()
  ]
});

const cardigantime = create({
  defaults: { configDirectory: './config' },
  configShape: MySchema.shape,
  logger: customLogger
});
```

## Environment-Specific Configuration

Configure Cardigantime dynamically based on environment variables.

### Environment-Based Directory

```typescript
const environment = process.env.NODE_ENV || 'development';

const cardigantime = create({
  defaults: {
    configDirectory: `./config/${environment}`,
    configFile: `${environment}.yaml`,
    isRequired: environment === 'production', // Require config in prod
  },
  features: environment === 'development' ? ['config'] : ['config', 'hierarchical'],
  configShape: MySchema.shape
});
```

### Development vs Production

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

const cardigantime = create({
  defaults: {
    configDirectory: isDevelopment ? './dev-config' : '/etc/myapp',
    isRequired: !isDevelopment,
    encoding: 'utf8',
    pathResolution: isDevelopment ? {
      pathFields: ['outputDir'],
      resolvePathArray: ['includePaths']
    } : undefined
  },
  configShape: MySchema.shape,
  logger: isDevelopment ? console : productionLogger
});
```

## Complete Configuration Examples

### Basic Application

```typescript
const cardigantime = create({
  defaults: {
    configDirectory: './config',
    configFile: 'app.yaml',
    isRequired: false,
    encoding: 'utf8'
  },
  configShape: BasicConfigSchema.shape,
  features: ['config']
});
```

### Hierarchical Application

```typescript
const cardigantime = create({
  defaults: {
    configDirectory: '.myapp',
    configFile: 'config.yaml',
    fieldOverlaps: {
      'features': 'append',
      'excludePatterns': 'prepend',
      'api.middleware': 'append',
      'security.allowedOrigins': 'append'
    }
  },
  configShape: HierarchicalConfigSchema.shape,
  features: ['config', 'hierarchical']
});
```

### Production Application

```typescript
import winston from 'winston';

const productionLogger = winston.createLogger({
  level: 'warn',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '/var/log/myapp/error.log', level: 'error' }),
    new winston.transports.File({ filename: '/var/log/myapp/combined.log' })
  ]
});

const cardigantime = create({
  defaults: {
    configDirectory: '/etc/myapp',
    configFile: 'production.yaml',
    isRequired: true,
    encoding: 'utf8',
    pathResolution: {
      pathFields: ['ssl.certPath', 'ssl.keyPath', 'logging.file'],
      resolvePathArray: ['backup.directories']
    }
  },
  configShape: ProductionConfigSchema.shape,
  features: ['config', 'hierarchical'],
  logger: productionLogger
});
```

### Development Application with Path Resolution

```typescript
const cardigantime = create({
  defaults: {
    configDirectory: './config',
    configFile: 'dev.yaml',
    isRequired: false,
    pathResolution: {
      pathFields: [
        'outputDir',
        'logFile', 
        'database.backupPath',
        'ssl.certPath',
        'ssl.keyPath'
      ],
      resolvePathArray: [
        'includePaths',
        'watchDirectories',
        'asset.sources'
      ]
    }
  },
  configShape: DevConfigSchema.shape,
  features: ['config']
});
```

## Validation and Error Handling

### Configuration Validation

All options are validated when creating a Cardigantime instance:

**Invalid configDirectory:**
```typescript
// ❌ This will throw an ArgumentError
defaults: { configDirectory: "" }
```

**Invalid configShape:**
```typescript
// ❌ This will throw during schema compilation
configShape: "not-a-schema"
```

**Invalid features:**
```typescript
// ❌ This will throw an ArgumentError
features: ['config', 'nonexistent-feature']
```

### Runtime Validation

**Missing required directory:**
```typescript
// With isRequired: true, throws FileSystemError if directory doesn't exist
defaults: {
  configDirectory: '/nonexistent',
  isRequired: true
}
```

**File encoding issues:**
```typescript
// Invalid encoding throws during file reading
defaults: {
  configDirectory: './config',
  encoding: 'invalid-encoding' as BufferEncoding
}
```

## Best Practices

### Directory Structure

**Recommended structure:**
```
project/
├── config/
│   ├── app.yaml              # Main configuration
│   ├── development.yaml      # Development overrides
│   ├── production.yaml       # Production overrides
│   └── test.yaml            # Test configuration
├── src/
└── package.json
```

### Path Resolution Guidelines

1. **Use relative paths** in configuration files for portability
2. **Configure path resolution** for any fields that contain file paths
3. **Test path resolution** with `--check-config` to verify resolved paths

### Hierarchical Configuration Guidelines

1. **Plan your hierarchy** before implementation
2. **Use meaningful directory names** (e.g., `.myapp`, `.project-config`)
3. **Configure array overlap** thoughtfully based on your use case
4. **Document your configuration structure** for team members

### Performance Considerations

1. **Minimize path resolution** to only necessary fields
2. **Use appropriate encoding** for your configuration files
3. **Consider file sizes** when using hierarchical discovery
4. **Cache configuration** in your application when possible 