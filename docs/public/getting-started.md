# Getting Started with Cardigantime

This guide will walk you through setting up Cardigantime for your CLI application, from basic usage to understanding core concepts.

## Who Is This For?

This documentation is for **tool developers** building CLI applications who want robust configuration management. If you're an end user of a tool built with Cardigantime, you don't need to read this - just enjoy the consistent, powerful configuration experience!

As a tool developer, you'll define your configuration schema once with Zod, and Cardigantime automatically handles:
- **Multiple config formats**: YAML, JSON, JavaScript, and TypeScript - your users choose
- **CLI option generation**: Automatic Commander.js integration
- **Deep merging**: Config files + CLI args + defaults with proper precedence
- **Type safety**: Full TypeScript support throughout

## Prerequisites

- Node.js 16+ 
- A CLI application using Commander.js
- Basic familiarity with TypeScript and Zod schemas

## Installation

```bash
npm install @theunwalked/cardigantime commander zod
# or
yarn add @theunwalked/cardigantime commander zod
# or
pnpm add @theunwalked/cardigantime commander zod
```

## Basic Setup

### 1. Define Your Configuration Schema

Start by defining your configuration structure using Zod:

```typescript
import { z } from 'zod';

const MyConfigSchema = z.object({
  // Required fields
  apiKey: z.string().min(1, "API key is required"),
  
  // Optional fields with defaults
  timeout: z.number().min(1000).default(5000),
  retries: z.number().min(0).max(10).default(3),
  debug: z.boolean().default(false),
  
  // Nested configuration
  database: z.object({
    host: z.string().default('localhost'),
    port: z.number().min(1).max(65535).default(5432),
    ssl: z.boolean().default(false),
  }),
  
  // Arrays
  features: z.array(z.enum(['auth', 'analytics', 'logging'])).default([]),
});

// Export the inferred type for use in your application
export type MyConfig = z.infer<typeof MyConfigSchema>;
```

### 2. Create Cardigantime Instance

```typescript
import { create } from '@theunwalked/cardigantime';

const cardigantime = create({
  defaults: {
    configDirectory: './config', // Where to look for config files
    configFile: 'myapp.yaml',   // Optional: specific filename
    isRequired: false,          // Optional: whether directory must exist
  },
  configShape: MyConfigSchema.shape,
  features: ['config'], // Start with basic features
});
```

### 3. Integrate with Commander.js

```typescript
import { Command } from 'commander';

async function setupCLI() {
  const program = new Command();
  
  program
    .name('myapp')
    .description('My awesome CLI application')
    .version('1.0.0');

  // Let Cardigantime add its options
  await cardigantime.configure(program);
  
  // Add your custom options
  program
    .option('-k, --api-key <key>', 'API key for authentication')
    .option('-t, --timeout <ms>', 'Request timeout in milliseconds', parseInt)
    .option('--debug', 'Enable debug mode')
    .option('--database-host <host>', 'Database host')
    .option('--database-port <port>', 'Database port', parseInt);

  return program;
}
```

### 4. Load and Use Configuration

```typescript
async function main() {
  const program = await setupCLI();
  program.parse();
  const args = program.opts();

  try {
    // Read configuration from all sources
    const config: MyConfig = await cardigantime.read(args);
    
    // Validate against schema
    await cardigantime.validate(config);
    
    console.log('✅ Configuration loaded successfully');
    
    // Use configuration in your app
    await runApplication(config);
    
  } catch (error) {
    console.error('❌ Configuration error:', error.message);
    process.exit(1);
  }
}

async function runApplication(config: MyConfig) {
  console.log(`🚀 Starting app with API key: ${config.apiKey.substring(0, 8)}...`);
  console.log(`📡 Database: ${config.database.host}:${config.database.port}`);
  console.log(`⚙️ Features enabled: ${config.features.join(', ')}`);
  
  if (config.debug) {
    console.log('🐛 Debug mode enabled');
  }
  
  // Your application logic here
}

main().catch(console.error);
```

## Configuration File Setup

### Creating Configuration Directory

```bash
# Create config directory
mkdir config

# Create initial config file
cat > config/myapp.yaml << EOF
# My Application Configuration

# Required settings
apiKey: "your-api-key-here"

# Connection settings
timeout: 10000
retries: 5

# Database configuration
database:
  host: localhost
  port: 5432
  ssl: false

# Feature flags
features:
  - auth
  - logging

# Development settings
debug: true
EOF
```

### Configuration File Formats

Cardigantime supports multiple configuration formats out of the box - define your schema once and your users can use whichever format they prefer:

| Format | Extensions | Best For |
|--------|------------|----------|
| YAML | `.yaml`, `.yml` | Human-readable, hand-edited configs |
| JSON | `.json` | Programmatic generation, strict syntax |
| JavaScript | `.js`, `.mjs`, `.cjs` | Dynamic configs, environment-based logic |
| TypeScript | `.ts`, `.mts`, `.cts` | Type-safe configs, IDE support |

When multiple formats exist, Cardigantime uses this priority order (highest to lowest):
1. TypeScript (`config.ts`)
2. JavaScript (`config.js`)
3. JSON (`config.json`)
4. YAML (`config.yaml` / `config.yml`)

**YAML example (`config/myapp.yaml`):**
```yaml
apiKey: "sk-abc123def456ghi789"
timeout: 15000
database:
  host: prod.db.example.com
  port: 5432
  ssl: true
features: [auth, analytics, logging]
debug: false
```

**JSON example (`config/myapp.json`):**
```json
{
  "apiKey": "sk-abc123def456ghi789",
  "timeout": 15000,
  "database": {
    "host": "prod.db.example.com",
    "port": 5432,
    "ssl": true
  },
  "features": ["auth", "analytics", "logging"],
  "debug": false
}
```

**TypeScript example (`config/myapp.config.ts`):**
```typescript
export default {
  apiKey: process.env.API_KEY ?? "sk-abc123def456ghi789",
  timeout: 15000,
  database: {
    host: process.env.DB_HOST ?? "prod.db.example.com",
    port: 5432,
    ssl: true
  },
  features: ["auth", "analytics", "logging"],
  debug: process.env.NODE_ENV === "development"
};
```

## Understanding Configuration Precedence

Cardigantime merges configuration from multiple sources in this order (highest to lowest priority):

1. **Command-line arguments** (highest priority)
2. **Configuration files**
3. **Schema defaults** (lowest priority)

### Example Precedence

**Configuration file (`config/myapp.yaml`):**
```yaml
timeout: 5000
debug: false
database:
  host: localhost
  port: 5432
```

**Command line:**
```bash
./myapp --timeout 10000 --database-host prod.db.example.com
```

**Final resolved configuration:**
```typescript
{
  timeout: 10000,              // From CLI (overrides file)
  debug: false,                // From file
  database: {
    host: "prod.db.example.com", // From CLI (overrides file)  
    port: 5432,                  // From file
    ssl: false                   // From schema default
  }
}
```

## Common CLI Patterns

### Environment-Specific Configuration

```bash
# Development
./myapp --config-directory ./config/dev

# Production  
./myapp --config-directory ./config/prod

# Staging with overrides
./myapp --config-directory ./config/staging --timeout 30000
```

### Configuration Generation

```bash
# Generate initial config file
./myapp --init-config

# Generate in specific directory
./myapp --config-directory ./prod-config --init-config
```

### Configuration Analysis

```bash
# See where each config value comes from
./myapp --check-config

# Analyze specific environment
./myapp --config-directory ./prod-config --check-config
```

## Adding Validation Rules

Enhance your schema with robust validation:

```typescript
const MyConfigSchema = z.object({
  // String validation
  apiKey: z.string()
    .min(32, "API key must be at least 32 characters")
    .regex(/^sk-[a-zA-Z0-9]+$/, "Invalid API key format"),
  
  // Number validation with ranges
  timeout: z.number()
    .min(1000, "Timeout must be at least 1 second")
    .max(60000, "Timeout cannot exceed 60 seconds")
    .default(5000),
  
  // URL validation
  webhookUrl: z.string().url().optional(),
  
  // Email validation
  notificationEmail: z.string().email().optional(),
  
  // Enum validation
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // Array validation
  allowedOrigins: z.array(z.string().url()).default([]),
  
  // Conditional validation
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

## Error Handling Basics

```typescript
try {
  const config = await cardigantime.read(args);
  await cardigantime.validate(config);
} catch (error) {
  if (error.message.includes('validation failed')) {
    console.error('❌ Invalid configuration values:');
    console.error(error.message);
    console.error('\n💡 Run --init-config to see valid configuration format');
  } else if (error.message.includes('not found')) {
    console.error('❌ Configuration directory not found');
    console.error('💡 Create it with: mkdir -p ./config');
  } else {
    console.error('❌ Unexpected error:', error.message);
  }
  process.exit(1);
}
```

## Next Steps

Once you have basic configuration working:

1. **[Core Concepts](core-concepts.md)** - Learn about hierarchical configuration and advanced features
2. **[MCP Integration](mcp-integration.md)** - Add Model Context Protocol support for AI assistants
3. **[API Reference](api-reference.md)** - Explore all available methods and options
4. **[Configuration Options](configuration-options.md)** - Customize path resolution, file encoding, etc.
5. **[Debugging & Analysis](debugging-and-analysis.md)** - Master configuration troubleshooting tools
6. **[Advanced Usage](advanced-usage.md)** - Complex schemas, custom loggers, and environment-specific setups

## Common Gotchas

### Schema Shape vs Schema Instance

❌ **Wrong:**
```typescript
configShape: MyConfigSchema, // This is the schema instance
```

✅ **Correct:**
```typescript
configShape: MyConfigSchema.shape, // This is the shape property
```

### CLI Option Naming

Cardigantime automatically converts nested config keys to CLI options:

```typescript
// Config: { database: { host: "localhost" } }
// CLI option: --database-host localhost
```

### Required vs Optional Directories

```typescript
// Directory must exist (throws error if missing)
defaults: { configDirectory: './config', isRequired: true }

// Directory optional (continues with defaults if missing)  
defaults: { configDirectory: './config', isRequired: false }
```

## Troubleshooting

**Problem: "Cannot find config directory"**
- Check the path exists: `ls -la ./config`
- Try absolute path: `--config-directory /full/path/to/config`
- Make directory optional: `isRequired: false`

**Problem: "Validation failed" errors**
- Generate reference config: `./myapp --init-config`
- Check current config: `./myapp --check-config`
- Review schema requirements

**Problem: CLI options not working**
- Ensure `await cardigantime.configure(program)` is called
- Check option naming: nested keys use dashes (e.g., `--database-host`)
- Verify option types match schema (e.g., use `parseInt` for numbers) 