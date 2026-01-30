# AI Agent Guide: cardigantime

**Role**: You are an AI assistant tasked with understanding, integrating, or extending `cardigantime` configuration management in applications.

**Goal**: Provide a comprehensive understanding of `cardigantime`'s capabilities, architecture, and usage patterns to facilitate correct implementation and extension.

## Target Audiences

When generating code or documentation for cardigantime, be aware of the two distinct personas:

### Tool Developers
Developers building CLI applications who integrate cardigantime for configuration management. They:
- Define Zod schemas for their application's configuration
- Integrate cardigantime with Commander.js
- May extend or customize cardigantime's behavior
- Care about API design, type safety, and developer experience

### End Users
Users of CLI tools built with cardigantime. They:
- Write configuration files (YAML, JSON, JS, or TS)
- Use CLI options to override configuration
- Benefit from cardigantime features without knowing it exists
- Care about clear error messages and flexible configuration formats

When writing documentation or code comments, consider which audience you're addressing.

## Core Capabilities

`cardigantime` is a robust configuration management library for TypeScript/Node.js applications. It prioritizes type safety, schema validation, and flexible loading strategies.

*   **Type-Safe**: Built on `zod` for runtime schema validation and static type inference.
*   **One Schema, Multiple Formats**: Tool developers define their configuration schema once with Zod, and cardigantime automatically supports YAML, JSON, JavaScript, and TypeScript configuration files. No additional code or schema definitions needed per format.
*   **Hierarchical Loading**: Supports loading configuration from multiple directory levels (e.g., project root, user home, system) with customizable precedence.
*   **Flexible Sources**: Merges configuration from:
    *   CLI Arguments (via `commander`)
    *   Configuration Files (YAML, JSON, JavaScript, or TypeScript)
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
import { create } from '@utilarium/cardigantime';
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

*   [Integration Guide](./integration.md): **Start here** - Practical patterns for integrating Cardigantime into your application, including build configuration and version management.
*   [Configuration](./configuration.md): Deep dive into configuration options and schema definition.
*   [Usage Patterns](./usage.md): Common patterns for CLI integration, testing, and production setup.
*   [Architecture](./architecture.md): Internal design, module structure, and data flow.
*   [Development](./development.md): Guide for contributing to `cardigantime` itself.
*   [MCP Configuration](./mcp-configuration.md): Guide for configuring CardiganTime-based tools via Model Context Protocol (MCP).
*   [CheckConfig Tool](./check-config.md): Reference for the built-in CheckConfig diagnostic tool available in all MCP tools.

