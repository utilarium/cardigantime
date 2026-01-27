# Integration Guide

**Purpose**: Practical patterns for integrating Cardigantime into your CLI application, including build configuration, version management, and common integration scenarios.

## Quick Integration Checklist

When integrating Cardigantime into a new project:

1. ✅ Install dependencies (`@theunwalked/cardigantime`, `commander`, `zod`)
2. ✅ Define your configuration schema with Zod
3. ✅ Create a Cardigantime instance with your schema
4. ✅ Integrate with Commander.js
5. ✅ Set up build-time version injection (optional but recommended)
6. ✅ Add configuration file discovery patterns

## Basic Integration Pattern

### 1. Define Your Configuration Schema

Start by defining what your application needs to configure:

```typescript
// src/config/schema.ts
import { z } from 'zod';

export const AppConfigSchema = z.object({
  // Required fields
  apiKey: z.string().min(1, "API key is required"),
  
  // Optional fields with defaults
  port: z.number().min(1024).max(65535).default(3000),
  host: z.string().default('localhost'),
  
  // Complex nested objects
  database: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(5432),
    name: z.string(),
  }).optional(),
  
  // Arrays
  allowedOrigins: z.array(z.string()).default(['http://localhost:3000']),
  
  // Booleans
  debug: z.boolean().default(false),
  verbose: z.boolean().default(false),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
```

### 2. Create Cardigantime Instance

```typescript
// src/config/index.ts
import { create } from '@theunwalked/cardigantime';
import { AppConfigSchema } from './schema';

export const configManager = create({
  defaults: {
    configDirectory: './.myapp',  // Where to look for config files
    configFile: 'config.yaml',    // Default config filename
    isRequired: false,            // Config directory is optional
  },
  configShape: AppConfigSchema.shape,
  features: ['config', 'hierarchical'],  // Enable hierarchical discovery
});
```

### 3. Integrate with CLI

```typescript
// src/cli.ts
import { Command } from 'commander';
import { configManager } from './config';
import { VERSION, PROGRAM_NAME } from './constants';

export async function createCLI() {
  const program = new Command();
  
  program
    .name('myapp')
    .description('My awesome CLI application')
    .version(VERSION);  // Use your version constant
  
  // Let Cardigantime add its options (--config-directory, --check-config, etc.)
  await configManager.configure(program);
  
  // Add your application-specific options
  program
    .option('-k, --api-key <key>', 'API key for authentication')
    .option('-p, --port <number>', 'Port to listen on', parseInt)
    .option('--debug', 'Enable debug mode')
    .option('--verbose', 'Enable verbose logging');
  
  return program;
}
```

### 4. Main Application Entry Point

```typescript
// src/main.ts
import { createCLI } from './cli';
import { configManager } from './config';

async function main() {
  const program = await createCLI();
  program.parse();
  
  const cliArgs = program.opts();
  
  try {
    // Read and merge configuration from all sources
    const config = await configManager.read(cliArgs);
    
    // Validate the final configuration
    await configManager.validate(config);
    
    // Start your application with the validated config
    await startApp(config);
    
  } catch (error) {
    console.error('Configuration error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
```

## Build Configuration: Version Management with Git Info

One of the most valuable integration patterns is injecting detailed version information at build time. This gives you visibility into exactly which build is running in production.

### Setting Up Build-Time Version Injection

#### 1. Install Required Dependencies

```bash
npm install --save-dev @rollup/plugin-replace
```

#### 2. Configure vite.config.ts

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import replace from '@rollup/plugin-replace';
import { execSync } from 'node:child_process';

// Extract git information at build time
let gitInfo = {
    branch: '',
    commit: '',
    tags: '',
    commitDate: '',
};

try {
    gitInfo = {
        branch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim(),
        commit: execSync('git rev-parse --short HEAD').toString().trim(),
        tags: '',
        commitDate: execSync('git log -1 --format=%cd --date=iso').toString().trim(),
    };
    
    try {
        gitInfo.tags = execSync('git tag --points-at HEAD | paste -sd "," -').toString().trim();
    } catch {
        gitInfo.tags = '';
    }
} catch (error) {
    console.log('Not in a git repository, skipping git info');
}

export default defineConfig({
    plugins: [
        replace({
            '__VERSION__': JSON.stringify(process.env.npm_package_version),
            '__GIT_BRANCH__': JSON.stringify(gitInfo.branch),
            '__GIT_COMMIT__': JSON.stringify(gitInfo.commit),
            '__GIT_TAGS__': JSON.stringify(gitInfo.tags === '' ? '' : `T:${gitInfo.tags}`),
            '__GIT_COMMIT_DATE__': JSON.stringify(gitInfo.commitDate),
            '__SYSTEM_INFO__': JSON.stringify(`${process.platform} ${process.arch} ${process.version}`),
            preventAssignment: true,
        }),
        // ... your other plugins
    ],
    build: {
        // ... your build config
    },
});
```

#### 3. Create Constants File

```typescript
// src/constants.ts
/** Version string populated at build time with git and system information */
export const VERSION = '__VERSION__ (__GIT_BRANCH__/__GIT_COMMIT__ __GIT_TAGS__ __GIT_COMMIT_DATE__) __SYSTEM_INFO__';

/** The program name used in CLI help and error messages */
export const PROGRAM_NAME = 'myapp';
```

#### 4. Use in Your Application

```typescript
import { VERSION, PROGRAM_NAME } from './constants';

// In --version flag
program.version(VERSION);

// In startup messages
console.log(`Starting ${PROGRAM_NAME}: ${VERSION}`);
// Output: Starting myapp: 1.0.0 (main/a1b2c3d  2026-01-27 11:11:46 -0800) darwin arm64 v24.8.0

// In error reports
console.error(`[${PROGRAM_NAME} ${VERSION}] Error: ${error.message}`);
```

### Alternative: Rollup Configuration

If you're using Rollup directly instead of Vite:

```javascript
// rollup.config.js
import replace from '@rollup/plugin-replace';
import { execSync } from 'child_process';

const gitInfo = {
    branch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim(),
    commit: execSync('git rev-parse --short HEAD').toString().trim(),
    commitDate: execSync('git log -1 --format=%cd --date=iso').toString().trim(),
};

export default {
    input: 'src/main.ts',
    output: {
        file: 'dist/bundle.js',
        format: 'esm'
    },
    plugins: [
        replace({
            '__VERSION__': JSON.stringify(process.env.npm_package_version),
            '__GIT_BRANCH__': JSON.stringify(gitInfo.branch),
            '__GIT_COMMIT__': JSON.stringify(gitInfo.commit),
            '__GIT_COMMIT_DATE__': JSON.stringify(gitInfo.commitDate),
            '__SYSTEM_INFO__': JSON.stringify(`${process.platform} ${process.arch} ${process.version}`),
            preventAssignment: true,
        }),
    ]
};
```

### Alternative: Webpack Configuration

For projects using Webpack:

```javascript
// webpack.config.js
const webpack = require('webpack');
const { execSync } = require('child_process');

const gitInfo = {
    branch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim(),
    commit: execSync('git rev-parse --short HEAD').toString().trim(),
    commitDate: execSync('git log -1 --format=%cd --date=iso').toString().trim(),
};

module.exports = {
    // ... other config
    plugins: [
        new webpack.DefinePlugin({
            '__VERSION__': JSON.stringify(process.env.npm_package_version),
            '__GIT_BRANCH__': JSON.stringify(gitInfo.branch),
            '__GIT_COMMIT__': JSON.stringify(gitInfo.commit),
            '__GIT_COMMIT_DATE__': JSON.stringify(gitInfo.commitDate),
            '__SYSTEM_INFO__': JSON.stringify(`${process.platform} ${process.arch} ${process.version}`),
        }),
    ],
};
```

## Configuration File Discovery Patterns

Cardigantime automatically searches for configuration files using multiple naming conventions. Here's how to structure your project:

### Recommended Project Structure

```
myapp/
├── .myapp/                    # Primary config directory (hidden)
│   └── config.yaml           # Main configuration file
├── myapp.config.yaml         # Alternative: visible config file
├── src/
│   ├── config/
│   │   ├── index.ts          # Cardigantime setup
│   │   └── schema.ts         # Zod schema definition
│   ├── constants.ts          # VERSION and other constants
│   ├── cli.ts                # Commander.js setup
│   └── main.ts               # Application entry point
├── vite.config.ts            # Build configuration
└── package.json
```

### Discovery Priority

Cardigantime searches in this order:

1. `myapp.config.{yaml,json,js,ts}` - Modern visible config
2. `myapp.conf.{yaml,json,js,ts}` - Alternative visible config
3. `.myapp/config.{yaml,json,js,ts}` - Hidden directory config
4. `.myapprc.{yaml,json,js,ts}` - RC file with extension
5. `.myapprc` - RC file without extension

### Format Priority

When multiple formats exist, Cardigantime uses:

1. TypeScript (`.ts`, `.mts`, `.cts`) - Highest priority
2. JavaScript (`.js`, `.mjs`, `.cjs`)
3. JSON (`.json`)
4. YAML (`.yaml`, `.yml`) - Lowest priority

## Common Integration Patterns

### Pattern 1: Simple CLI Tool

For straightforward CLI tools with basic configuration:

```typescript
import { create } from '@theunwalked/cardigantime';
import { Command } from 'commander';
import { z } from 'zod';

const schema = z.object({
  apiKey: z.string(),
  timeout: z.number().default(5000),
});

const config = create({
  configShape: schema.shape,
  defaults: { configDirectory: './.myapp' }
});

const program = new Command();
await config.configure(program);
program.parse();

const finalConfig = await config.read(program.opts());
```

### Pattern 2: Complex Application with Hierarchical Config

For applications that need system, user, and project-level configuration:

```typescript
const config = create({
  configShape: schema.shape,
  defaults: { 
    configDirectory: './.myapp',
    pathResolution: {
      pathFields: ['dataDir', 'outputDir'],
      resolvePathArray: ['includePaths']
    }
  },
  features: ['config', 'hierarchical']
});
```

This enables:
- `/etc/myapp/config.yaml` (system-wide)
- `~/.myapp/config.yaml` (user-specific)
- `./.myapp/config.yaml` (project-specific)

### Pattern 3: Library Integration

When building a library that uses Cardigantime internally:

```typescript
// Export your config manager for advanced users
export { configManager } from './config';

// But also provide a simple API
export async function initialize(options?: Partial<AppConfig>) {
  const config = await configManager.read(options || {});
  await configManager.validate(config);
  return config;
}
```

### Pattern 4: Testing Integration

For testing applications that use Cardigantime:

```typescript
// test/helpers/config.ts
import { create } from '@theunwalked/cardigantime';
import { AppConfigSchema } from '../../src/config/schema';

export function createTestConfig(overrides = {}) {
  const manager = create({
    configShape: AppConfigSchema.shape,
    defaults: { 
      configDirectory: './test/fixtures',
      isRequired: false 
    }
  });
  
  return manager.read(overrides);
}

// In your tests
describe('MyApp', () => {
  it('should work with custom config', async () => {
    const config = await createTestConfig({ 
      port: 9999,
      debug: true 
    });
    
    const app = new MyApp(config);
    // ... test assertions
  });
});
```

## Real-World Examples

### Example: Protokoll (Audio Transcription Tool)

Protokoll uses Cardigantime for managing complex configuration including context directories, AI model settings, and output options:

```typescript
// From protokoll's configuration
const ProtokolConfig = z.object({
  transcriptionModel: z.string().default('whisper-1'),
  model: z.string().default('gpt-5.2'),
  contextDirectories: z.array(z.string()).optional(),
  outputDirectory: z.string().default('./output'),
  debug: z.boolean().default(false),
  // ... many more options
});

const configManager = create({
  defaults: {
    configDirectory: './.protokoll',
    pathResolution: {
      pathFields: ['outputDirectory', 'tempDirectory'],
      resolvePathArray: ['contextDirectories']
    }
  },
  configShape: ProtokolConfig.shape,
  features: ['config', 'hierarchical'],
});
```

### Example: Cardigantime's Own Version Info

Cardigantime itself uses this pattern:

```typescript
// From @theunwalked/cardigantime
import { VERSION, PROGRAM_NAME } from '@theunwalked/cardigantime';

console.log(`Using ${PROGRAM_NAME}: ${VERSION}`);
// Output: Using cardigantime: 0.0.22-dev.0 (working/a1b2c3d  2026-01-27 11:11:46 -0800) darwin arm64 v24.8.0
```

## Best Practices

### 1. Always Validate After Reading

```typescript
const config = await manager.read(args);
await manager.validate(config);  // Don't skip this!
```

### 2. Provide Sensible Defaults

```typescript
const schema = z.object({
  port: z.number().default(3000),  // Good: has default
  apiKey: z.string(),               // OK: required field
  timeout: z.number(),              // Bad: no default, not required
});
```

### 3. Use Path Resolution for File Paths

```typescript
const config = create({
  defaults: {
    configDirectory: './.myapp',
    pathResolution: {
      pathFields: ['dataDir', 'logDir'],
      resolvePathArray: ['includePaths']
    }
  },
  // ...
});
```

### 4. Document Your Configuration Schema

```typescript
const schema = z.object({
  /** API key for authentication (required) */
  apiKey: z.string().describe('API key for authentication'),
  
  /** Port number for the server (default: 3000) */
  port: z.number().default(3000).describe('Port number for the server'),
});
```

### 5. Provide Config Generation

```typescript
// Add a --init-config command
program
  .command('init')
  .description('Generate a default configuration file')
  .action(async () => {
    await configManager.generateConfig();
    console.log('Configuration file created!');
  });
```

## Troubleshooting

### Config Not Found

If Cardigantime can't find your config:

1. Check the config directory exists
2. Verify the config filename matches
3. Use `--check-config` to see what's being searched
4. Try `--config-directory` to specify explicitly

### Version Not Showing Git Info

If VERSION shows placeholders instead of git info:

1. Ensure you're running the **built** version, not source
2. Check that git commands work in your build environment
3. Verify the replace plugin is configured correctly
4. Build the project: `npm run build`

### Type Errors with Config

If TypeScript complains about config types:

1. Ensure you're using `z.infer<typeof Schema>` for types
2. Check that all required fields are provided
3. Use `.validate()` to catch runtime type issues

## Summary

Integrating Cardigantime into your CLI application provides:

- ✅ **Type-safe configuration** with Zod validation
- ✅ **Multiple configuration formats** (YAML, JSON, JS, TS)
- ✅ **Hierarchical discovery** for system/user/project configs
- ✅ **Build-time version injection** for production visibility
- ✅ **Automatic CLI integration** with Commander.js
- ✅ **Path resolution** for relative paths in config files

Follow the patterns in this guide to get up and running quickly, and refer to the other guide documents for deeper dives into specific features.
