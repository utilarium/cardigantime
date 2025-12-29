# Cardigantime

A robust TypeScript library for configuration management in command-line applications. Cardigantime provides type-safe configuration loading, validation, and CLI integration with Commander.js and Zod schemas.

## What is Cardigantime?

Cardigantime is a configuration management library designed to solve the common problem of handling configuration in CLI applications. It provides a unified way to:

- **Read configuration from YAML files** with intelligent file discovery
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

### Hierarchical Configuration Discovery
Supports hierarchical configuration discovery, similar to how `.gitignore`, `.eslintrc`, or `package.json` work - searching up the directory tree for configuration directories.

### Type Safety & Validation
Full TypeScript support with Zod schema validation for robust, type-safe configuration management.

### Error Handling
Comprehensive error handling with detailed, actionable error messages to help users fix configuration issues quickly.

## Documentation

📚 **[Complete Documentation](https://semicolonambulance.github.io/cardigantime/)** - Full documentation site

**Quick Links:**
- [Getting Started Guide](https://semicolonambulance.github.io/cardigantime/#getting-started) - Detailed setup and basic concepts
- [Core Concepts](https://semicolonambulance.github.io/cardigantime/#core-concepts) - Configuration sources, hierarchical discovery
- [API Reference](https://semicolonambulance.github.io/cardigantime/#api-reference) - Complete API documentation
- [Configuration Options](https://semicolonambulance.github.io/cardigantime/#configuration-options) - All available options
- [Debugging & Analysis](https://semicolonambulance.github.io/cardigantime/#debugging-analysis) - Tools for analyzing config
- [Advanced Usage](https://semicolonambulance.github.io/cardigantime/#advanced-usage) - Complex examples and scenarios
- [Error Handling](https://semicolonambulance.github.io/cardigantime/#error-handling) - Comprehensive error handling guide

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

Apache-2.0 - see [LICENSE](LICENSE) file for details.

## Why "Cardigantime"?

Because configuration management should be as comfortable and reliable as your favorite cardigan. Just like a good cardigan keeps you warm and comfortable, Cardigantime keeps your application configuration cozy and well-organized.

