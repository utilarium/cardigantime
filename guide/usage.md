# Usage Patterns

**Purpose**: Common patterns for integrating `cardigantime` into applications.

## CLI Integration (Commander.js)

`cardigantime` is designed to work seamlessly with `commander`.

```typescript
import { Command } from 'commander';
import { create } from '@utilarium/cardigantime';

// 1. Setup
const program = new Command();
const manager = create({ ... });

// 2. Configure (Adds -c/--config-directory flags)
await manager.configure(program);

// 3. Parse CLI args
program.parse();
const options = program.opts();

// 4. Read & Validate Config
// 'options' contains the parsed CLI args which override file config
const config = await manager.read(options); 

console.log(`Server starting on port ${config.port}`);
```

## Hierarchical Configuration

Enable the `hierarchical` feature to support cascading configuration (e.g., System -> User -> Project).

1.  **Enable Feature**: `features: ['hierarchical']`
2.  **Directory Structure**:
    *   `/etc/myapp/config.yaml` (System level)
    *   `~/.myapp/config.yaml` (User level)
    *   `./.myapp/config.yaml` (Project level)

`cardigantime` will automatically discover these directories by traversing up from the `configDirectory` (or current working directory) and merge them based on precedence (closest directory wins).

## Generating Configuration

You can generate a default configuration file for users to start with.

```typescript
// Generate config in the specified directory
await manager.generateConfig('./config');
```

This uses the defaults defined in your Zod schema to populate the YAML file.

## Validating Configuration

If you have a config object from another source (e.g., API response) and just want to validate it:

```typescript
try {
    const validated = manager.validate(externalConfig);
} catch (error) {
    console.error('Invalid configuration:', error.message);
}
```

## Debugging

To see how configuration is being resolved, use the `checkConfig` method. This prints a report showing which file contributed which value.

```typescript
await manager.checkConfig(cliOptions);
```

Or pass `--check-config` if you integrated with `configure()`.

