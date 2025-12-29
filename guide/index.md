# AI Agent Guide: cardigantime

**Role**: You are an AI assistant tasked with understanding, integrating, or extending `cardigantime` configuration management in applications.

**Goal**: Provide a comprehensive understanding of `cardigantime`'s capabilities, architecture, and usage patterns to facilitate correct implementation and extension.

## Core Capabilities

`cardigantime` is a robust configuration management library for TypeScript/Node.js applications. It prioritizes type safety, schema validation, and flexible loading strategies.

*   **Type-Safe**: Built on `zod` for runtime schema validation and static type inference.
*   **Hierarchical Loading**: Supports loading configuration from multiple directory levels (e.g., project root, user home, system) with customizable precedence.
*   **Flexible Sources**: Merges configuration from:
    *   CLI Arguments (via `commander`)
    *   YAML Files
    *   Environment Variables (implicit via custom loaders or explicit defaults)
    *   Runtime Defaults
*   **Path Resolution**: Automatically resolves relative paths in configuration files relative to the file's location.
*   **Security**: Includes safeguards against path traversal and other common configuration vulnerabilities.

## Quick Start Context

When analyzing or generating code using `cardigantime`, keep these patterns in mind:

1.  **Define Schema**: Always start with a Zod schema.
2.  **Create Instance**: Use `create()` with the schema shape and defaults.
3.  **Integrate CLI**: Use `.configure(program)` to bind to Commander.js.
4.  **Read Config**: Use `.read(options)` to load and validate.

```typescript
import { create } from '@theunwalked/cardigantime';
import { z } from 'zod';

const schema = z.object({
  port: z.number().default(3000),
  db: z.string()
});

const config = create({
  configShape: schema.shape,
  defaults: { configDirectory: './config' }
});
```

## Documentation Structure

This guide directory contains specialized documentation for different aspects of the system:

*   [Configuration](./configuration.md): Deep dive into configuration options and schema definition.
*   [Usage Patterns](./usage.md): Common patterns for CLI integration, testing, and production setup.
*   [Architecture](./architecture.md): Internal design, module structure, and data flow.
*   [Development](./development.md): Guide for contributing to `cardigantime` itself.

