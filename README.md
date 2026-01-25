# Cardigantime

A robust TypeScript library for configuration management in command-line applications. Cardigantime provides type-safe configuration loading, validation, and CLI integration with Commander.js and Zod schemas.

## What is Cardigantime?

Cardigantime is a configuration management library designed to solve the common problem of handling configuration in CLI applications. It provides a unified way to:

- **Read configuration from multiple formats** (YAML, JSON, JavaScript, TypeScript) with intelligent file discovery
- **Validate configuration** using Zod schemas for type safety
- **Integrate with CLI frameworks** like Commander.js seamlessly
- **Merge configuration sources** (files, CLI args, defaults) with proper precedence
- **Handle errors gracefully** with comprehensive logging and user-friendly error messages

## Why Cardigantime?

Building CLI applications with proper configuration management is harder than it should be. **Cardigantime was created specifically to solve the complex problem of supporting sophisticated configuration systems that seamlessly merge command-line arguments, configuration files, and default values.**

Without Cardigantime, you need to manually handle:
- Multi-layered configuration sources with proper precedence
- Nested configuration objects with deep validation
- Type safety throughout the configuration pipeline
- Graceful error handling with actionable messages

Cardigantime provides a complete, battle-tested solution for all of this complexity.

### One Schema, Multiple Formats

Define your configuration schema once with Zod, and Cardigantime automatically supports:
- **YAML** (`.yaml`, `.yml`) - Human-readable, great for hand-edited configs
- **JSON** (`.json`) - Strict syntax, ideal for programmatic generation
- **JavaScript** (`.js`, `.mjs`, `.cjs`) - Dynamic configs with environment logic
- **TypeScript** (`.ts`, `.mts`, `.cts`) - Type-safe configs with IDE support

No additional code or schema definitions needed per format. Your users choose their preferred format, and Cardigantime handles parsing, validation, and merging automatically.

## Who Uses Cardigantime?

Cardigantime serves two distinct audiences:

### Tool Developers
Developers building CLI applications who want robust configuration management without the boilerplate. You integrate Cardigantime once, define your Zod schema, and get:
- Multi-format config file support out of the box
- Automatic CLI option generation
- Deep merging with proper precedence
- Hierarchical config discovery (like `.eslintrc` or `.gitignore`)
- Type safety throughout your codebase

### End Users
Users of tools built with Cardigantime benefit from a consistent, powerful configuration experience without needing to know Cardigantime exists. They get:
- Freedom to use their preferred config format (YAML, JSON, JS, or TS)
- Consistent CLI options across tools
- Clear, actionable error messages
- Built-in config generation (`--init-config`) and analysis (`--check-config`)

## Installation

```bash
npm install @theunwalked/cardigantime
# or
yarn add @theunwalked/cardigantime
# or
pnpm add @theunwalked/cardigantime
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

### Configuration File Examples

Cardigantime supports multiple configuration formats. Choose the one that best fits your workflow:

#### YAML (`config/myapp.yaml`)
```yaml
apiKey: "your-secret-api-key"
timeout: 10000
retries: 5
debug: true
```

#### JSON (`config/myapp.json`)
```json
{
  "apiKey": "your-secret-api-key",
  "timeout": 10000,
  "retries": 5,
  "debug": true
}
```

#### JavaScript (`config/myapp.js`)
```javascript
module.exports = {
  apiKey: process.env.API_KEY || "your-secret-api-key",
  timeout: 10000,
  retries: 5,
  debug: process.env.NODE_ENV === 'development'
};
```

#### TypeScript (`config/myapp.ts`)
```typescript
export default {
  apiKey: process.env.API_KEY || "your-secret-api-key",
  timeout: 10000,
  retries: 5,
  debug: process.env.NODE_ENV === 'development'
} as const;
```

**Format Priority:** When multiple config files exist, Cardigantime uses this priority order:
1. TypeScript (`.ts`, `.mts`, `.cts`) - Highest priority
2. JavaScript (`.js`, `.mjs`, `.cjs`)
3. JSON (`.json`)
4. YAML (`.yaml`, `.yml`) - Lowest priority

You can override automatic detection with `--config-format`:
```bash
./myapp --config-format yaml  # Force YAML even if JSON exists
```

### Example Usage

```bash
# Use config from file
./myapp

# Override config with CLI arguments
./myapp --api-key "different-key" --timeout 15000

# Use different config directory
./myapp --config-directory /etc/myapp

# Generate initial configuration file
./myapp --init-config

# Analyze configuration with source tracking
./myapp --check-config
```

## Key Features

### Configuration Sources & Precedence
Merges configuration from multiple sources in order of precedence:
1. **Command-line arguments** (highest priority)
2. **Configuration file(s)** (medium priority)  
3. **Default values** (lowest priority)

### Multi-Format Configuration
Supports YAML (`.yaml`, `.yml`), JSON (`.json`), JavaScript (`.js`, `.mjs`, `.cjs`), and TypeScript (`.ts`, `.mts`, `.cts`) configuration files. When multiple formats exist, Cardigantime uses automatic format detection with configurable priority.

### Configuration Discovery

Cardigantime automatically searches for configuration files using multiple naming conventions, similar to how tools like Vite, ESLint, and TypeScript work:

| Priority | Pattern | Example |
|----------|---------|---------|
| 1 | `{app}.config.{ext}` | `myapp.config.yaml` |
| 2 | `{app}.conf.{ext}` | `myapp.conf.yaml` |
| 3 | `.{app}/config.{ext}` | `.myapp/config.yaml` |
| 4 | `.{app}rc.{ext}` | `.myapprc.yaml` |
| 5 | `.{app}rc` | `.myapprc` |

Modern visible config files (like `myapp.config.yaml`) are checked first for better discoverability.

### Hierarchical Configuration Discovery
Supports hierarchical configuration discovery, similar to how `.gitignore`, `.eslintrc`, or `package.json` work - searching up the directory tree for configuration directories.

**Hierarchical Modes:**
- `enabled` (default) - Merge configs from parent directories
- `disabled` - Use only the config in the starting directory
- `root-only` - Find first config, no merging
- `explicit` - Only merge explicitly referenced configs

```yaml
# Disable hierarchical for isolated projects
hierarchical:
  mode: disabled
```

### Type Safety & Validation
Full TypeScript support with Zod schema validation for robust, type-safe configuration management.

### Error Handling
Comprehensive error handling with detailed, actionable error messages to help users fix configuration issues quickly.

## Documentation

📚 **[Complete Documentation](https://utilarium.github.io/cardigantime/)** - Full documentation site

**Quick Links:**
- [Getting Started Guide](https://utilarium.github.io/cardigantime/#getting-started) - Detailed setup and basic concepts
- [Core Concepts](https://utilarium.github.io/cardigantime/#core-concepts) - Configuration sources, hierarchical discovery
- [API Reference](https://utilarium.github.io/cardigantime/#api-reference) - Complete API documentation
- [Configuration Options](https://utilarium.github.io/cardigantime/#configuration-options) - All available options
- [Debugging & Analysis](https://utilarium.github.io/cardigantime/#debugging-analysis) - Tools for analyzing config
- [Advanced Usage](https://utilarium.github.io/cardigantime/#advanced-usage) - Complex examples and scenarios
- [Error Handling](https://utilarium.github.io/cardigantime/#error-handling) - Comprehensive error handling guide

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

Apache-2.0 - see [LICENSE](LICENSE) file for details.

## Why "Cardigantime"?

Because configuration management should be as comfortable and reliable as your favorite cardigan. Just like a good cardigan keeps you warm and comfortable, Cardigantime keeps your application configuration cozy and well-organized.

