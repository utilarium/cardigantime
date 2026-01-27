# Core Concepts

This guide covers the fundamental concepts that make Cardigantime powerful and flexible for complex configuration scenarios.

> **Note for Tool Developers**: This documentation is written for you - developers integrating Cardigantime into CLI applications. Your end users will benefit from these features without needing to understand the internals.

## One Schema, Multiple Formats

One of Cardigantime's most powerful features is automatic multi-format support. Define your configuration schema once with Zod, and your users can write configuration in their preferred format:

| Format | Extensions | Best For |
|--------|------------|----------|
| YAML | `.yaml`, `.yml` | Human-readable, hand-edited configs |
| JSON | `.json` | Programmatic generation, strict syntax |
| JavaScript | `.js`, `.mjs`, `.cjs` | Dynamic configs, environment-based logic |
| TypeScript | `.ts`, `.mts`, `.cts` | Type-safe configs, IDE support |

**No additional code or configuration needed per format.** Cardigantime automatically:
- Detects the format based on file extension
- Parses the file using the appropriate parser
- Validates against your Zod schema
- Merges with CLI arguments and defaults

This means tool developers write one schema, and end users get format flexibility for free.

## Configuration Sources & Precedence

Cardigantime merges configuration from multiple sources with a clear precedence hierarchy:

### Precedence Order (Highest to Lowest)

1. **Command-line arguments** (highest priority)
2. **Configuration file(s)** (medium priority)  
3. **Schema defaults** (lowest priority)

### MCP Configuration (Special Case)

When using CardiganTime with Model Context Protocol (MCP), configuration follows a different model:

- **MCP config present** → Use exclusively (no file fallback, no merging)
- **MCP config absent** → Fall back to file-based discovery

This "simplifying assumption" makes MCP configuration predictable. See [MCP Integration](mcp-integration.md) for details.

### Deep Merging Example

Configuration isn't just replaced at the top level - Cardigantime performs intelligent deep merging:

**Schema defaults:**
```typescript
const schema = z.object({
  database: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(5432),
    ssl: z.boolean().default(false),
    maxConnections: z.number().default(10),
  }),
  api: z.object({
    timeout: z.number().default(5000),
    retries: z.number().default(3),
  }),
});
```

**Configuration file (`config/app.yaml`):**
```yaml
database:
  host: prod.db.example.com
  ssl: true
api:
  timeout: 10000
```

**Command line:**
```bash
./myapp --database-port 5433 --api-retries 5
```

**Final merged result:**
```typescript
{
  database: {
    host: "prod.db.example.com", // From config file
    port: 5433,                  // From CLI
    ssl: true,                   // From config file
    maxConnections: 10           // From schema default
  },
  api: {
    timeout: 10000,              // From config file
    retries: 5                   // From CLI
  }
}
```

## Hierarchical Configuration Discovery

Hierarchical configuration allows you to create layered configuration systems, similar to how tools like `.gitignore`, `.eslintrc`, or `package.json` work.

### How Hierarchical Discovery Works

When enabled with `features: ['config', 'hierarchical']`, Cardigantime:

1. **Starts from the specified config directory**
2. **Searches up the directory tree** for additional config directories with the same name
3. **Merges configurations** with proper precedence (closer directories win)
4. **Applies CLI arguments** as the final override

### Directory Structure Example

```
/workspace/
├── .myapp/
│   └── config.yaml              # Root level (Level 2 - lowest precedence)
├── team-frontend/
│   ├── .myapp/
│   │   └── config.yaml          # Team level (Level 1 - medium precedence)
│   └── my-project/
│       ├── .myapp/
│       │   └── config.yaml      # Project level (Level 0 - highest precedence)
│       └── my-script.js
```

### Configuration Merging

When running from `/workspace/team-frontend/my-project/`, Cardigantime discovers and merges:

**Level 2 (Root) - `/workspace/.myapp/config.yaml`:**
```yaml
database:
  host: localhost
  port: 5432
  ssl: false
logging:
  level: info
features:
  - auth
  - basic-logging
```

**Level 1 (Team) - `/workspace/team-frontend/.myapp/config.yaml`:**
```yaml
database:
  port: 5433
  ssl: true
api:
  timeout: 5000
features:
  - advanced-logging
  - metrics
```

**Level 0 (Project) - `/workspace/team-frontend/my-project/.myapp/config.yaml`:**
```yaml
database:
  host: dev.example.com
logging:
  level: debug
features:
  - debug-mode
```

**Final merged configuration:**
```yaml
database:
  host: dev.example.com    # From Level 0 (highest precedence)
  port: 5433               # From Level 1  
  ssl: true                # From Level 1
api:
  timeout: 5000            # From Level 1
logging:
  level: debug             # From Level 0 (highest precedence)
features:
  - debug-mode             # From Level 0 (arrays override by default)
```

### Array Overlap Behavior

By default, arrays follow **override** behavior - arrays from higher precedence levels completely replace arrays from lower precedence levels. However, you can configure custom overlap behavior:

```typescript
const cardigantime = create({
  defaults: {
    configDirectory: '.myapp',
    fieldOverlaps: {
      'features': 'append',           // Combine features from all levels
      'excludePatterns': 'prepend',   // Higher precedence first
      'middlewares': 'override'       // Replace entirely (default)
    }
  },
  features: ['config', 'hierarchical'],
  configShape: MySchema.shape
});
```

**Available overlap modes:**
- **`override`** (default): Higher precedence arrays completely replace lower precedence arrays
- **`append`**: Higher precedence array elements are appended to lower precedence arrays  
- **`prepend`**: Higher precedence array elements are prepended to lower precedence arrays

**Example with custom array overlap:**

With `features: 'append'` configuration:

```yaml
# Root level
features: ['auth', 'logging']

# Team level  
features: ['analytics', 'metrics']

# Project level
features: ['debug-mode']
```

Results in:
```yaml
features: ['auth', 'logging', 'analytics', 'metrics', 'debug-mode']
```

### Enabling Hierarchical Discovery

```typescript
const cardigantime = create({
  defaults: { 
    configDirectory: '.myapp',
    configFile: 'config.yaml'
  },
  configShape: MyConfigSchema.shape,
  features: ['config', 'hierarchical'], // Enable hierarchical discovery
});
```

### Built-in Protections

Hierarchical discovery includes several safety features:

- **Maximum traversal depth**: Prevents infinite loops (default: 10 levels)
- **Symlink protection**: Tracks visited paths to prevent circular references
- **Graceful fallback**: Falls back to single-directory mode if discovery fails
- **Error tolerance**: Continues discovery even if some directories are unreadable
- **Root detection**: Automatically stops at filesystem root

### Use Cases for Hierarchical Configuration

1. **Monorepos**: Share common configuration across multiple packages
2. **Project inheritance**: Override team/organization defaults for specific projects  
3. **Environment layering**: Different configs for development/staging/production
4. **Tool configuration**: Similar to how ESLint or Prettier find configs up the tree
5. **Multi-tenant applications**: Tenant-specific overrides of global settings

## Schema Validation & Type Safety

Cardigantime leverages Zod for robust schema validation and TypeScript integration.

### Schema Definition

```typescript
const ConfigSchema = z.object({
  // Basic types with validation
  port: z.number().min(1).max(65535),
  host: z.string().ip().or(z.literal('localhost')),
  
  // Nested objects
  database: z.object({
    url: z.string().url(),
    maxConnections: z.number().positive().default(10),
  }),
  
  // Arrays with validation
  features: z.array(z.enum(['auth', 'analytics', 'logging'])).default([]),
  
  // Optional fields
  webhookUrl: z.string().url().optional(),
  
  // Complex validation
  ssl: z.object({
    enabled: z.boolean().default(false),
    certPath: z.string().optional(),
    keyPath: z.string().optional(),
  }).refine(
    (data) => !data.enabled || (data.certPath && data.keyPath),
    {
      message: "SSL cert and key paths required when SSL is enabled",
      path: ['certPath', 'keyPath'],
    }
  ),
});
```

### Type Inference

Cardigantime provides full TypeScript support with automatic type inference:

```typescript
// Create instance with schema
const cardigantime = create({
  defaults: { configDirectory: './config' },
  configShape: ConfigSchema.shape,
});

// Config is fully typed
const config = await cardigantime.read(args);
// config.database.maxConnections is number
// config.features is ('auth' | 'analytics' | 'logging')[]
// config.port is number

// IntelliSense works everywhere
if (config.features.includes('auth')) {
  // TypeScript knows this is valid
  setupAuthentication(config);
}

// Type-safe usage
function setupDatabase(dbConfig: typeof config.database) {
  console.log(`Connecting to ${dbConfig.url}`);
  // Full type safety and IntelliSense
}
```

### Validation Error Handling

Cardigantime provides detailed validation error messages:

```typescript
try {
  await cardigantime.validate(config);
} catch (error) {
  console.error('Validation failed:', error.message);
  // Example output:
  // "Configuration validation failed: 
  //  - port must be between 1 and 65535
  //  - database.url must be a valid URL"
}
```

## Path Resolution

Cardigantime can automatically resolve relative paths in your configuration relative to the config file location.

### Basic Path Resolution

```typescript
const cardigantime = create({
  defaults: {
    configDirectory: './config',
    pathResolution: {
      pathFields: ['outputDir', 'logFile'],
      resolvePathArray: ['includePaths']
    }
  },
  configShape: MySchema.shape
});
```

**Configuration file at `./config/app.yaml`:**
```yaml
outputDir: ./build          # Resolved to ./config/build
logFile: ../logs/app.log    # Resolved to ./logs/app.log
includePaths:               # Each element resolved as path
  - ./src
  - ../shared
```

### Nested Path Fields

Use dot notation for nested fields:

```typescript
pathResolution: {
  pathFields: ['database.backupDir', 'logging.file'],
  resolvePathArray: ['build.includePaths']
}
```

### Why Path Resolution Matters

Path resolution makes configuration portable across environments:

```yaml
# Without path resolution
outputDir: /home/user/project/config/build  # Absolute, not portable

# With path resolution  
outputDir: ./build                          # Relative to config file, portable
```

## CLI Integration

Cardigantime seamlessly integrates with Commander.js by automatically generating CLI options from your schema.

### Automatic Option Generation

```typescript
const schema = z.object({
  database: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(5432),
  }),
  features: z.array(z.string()).default([]),
});

// After calling cardigantime.configure(program), these options are available:
// --database-host <host>
// --database-port <port>  
// --features <features...>
```

### Custom CLI Options

You can add your own options alongside Cardigantime's:

```typescript
await cardigantime.configure(program);

program
  .option('-k, --api-key <key>', 'API key for authentication')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Show what would be done without executing');
```

### Built-in CLI Options

Cardigantime automatically adds these options:

- `-c, --config-directory <path>`: Override the default configuration directory
- `--init-config`: Generate initial configuration file and exit
- `--check-config`: Display resolved configuration with source tracking and exit

## Features System

Cardigantime uses a feature system to enable different capabilities:

### Available Features

```typescript
const cardigantime = create({
  defaults: { configDirectory: './config' },
  configShape: MySchema.shape,
  features: ['config', 'hierarchical'], // Enable specific features
});
```

**Available features:**
- **`config`**: Basic configuration file loading and validation (always enabled)
- **`hierarchical`**: Hierarchical configuration discovery and merging

### Feature Combinations

```typescript
// Basic configuration only
features: ['config']

// Hierarchical configuration
features: ['config', 'hierarchical']

// Future features will be added here
features: ['config', 'hierarchical', 'future-feature']
```

## Error Handling Philosophy

Cardigantime provides structured, actionable error messages:

### Error Categories

1. **Configuration Errors**: Schema validation, unknown keys, file format issues
2. **File System Errors**: Missing directories, permission issues, file read/write failures
3. **Argument Errors**: Invalid CLI arguments or function parameters

### Actionable Error Messages

Instead of generic errors, Cardigantime provides specific guidance:

```typescript
// Generic error
"Error: Configuration invalid"

// Cardigantime error
"Configuration validation failed: port must be between 1 and 65535
 💡 Run --init-config to see valid configuration format"
```

## Performance Considerations

### Efficient Configuration Loading

- **Lazy loading**: Configuration is only loaded when `read()` is called
- **Caching**: Schema compilation and validation are cached
- **Minimal file system operations**: Only reads necessary configuration files

### Hierarchical Discovery Optimization

- **Early termination**: Stops at filesystem root or when max depth reached
- **Symlink detection**: Prevents infinite loops from circular symlinks
- **Selective loading**: Only loads configuration files that exist

## Next Steps

Now that you understand the core concepts:

1. **[API Reference](api-reference.md)** - Explore all available methods and their parameters
2. **[Configuration Options](configuration-options.md)** - Deep dive into all configuration options
3. **[Advanced Usage](advanced-usage.md)** - Complex schemas, environment-specific setups, and custom loggers
4. **[Debugging & Analysis](debugging-and-analysis.md)** - Master the configuration analysis tools 