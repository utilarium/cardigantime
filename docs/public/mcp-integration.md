# MCP Integration

CardiganTime provides first-class support for the Model Context Protocol (MCP), enabling AI assistants like Claude in Cursor to configure tools directly through MCP invocations.

## What is MCP?

The Model Context Protocol (MCP) is a standard for AI assistants to interact with tools and services. When an AI assistant invokes a tool via MCP, it can provide configuration directly in the invocation, eliminating the need for separate configuration files.

## Why MCP Support?

Traditional CLI tools require configuration files that users must create and maintain. With MCP support:

- **AI assistants can configure tools dynamically** based on context
- **No configuration files needed** for MCP-invoked tools
- **Consistent configuration** across different projects
- **Easier debugging** with the built-in CheckConfig tool

## Configuration Priority

CardiganTime uses a simple priority model:

```
MCP Config Provided?
  ├─ YES → Use MCP config exclusively
  └─ NO → Fall back to file-based discovery
```

**The Simplifying Assumption:** If MCP configuration is provided, it is the complete configuration. No merging with file-based config occurs.

This makes configuration predictable and easy to debug.

## Quick Start

### For Tool Developers

Add MCP support to your CardiganTime-based tool:

```typescript
import { createMCPIntegration } from '@theunwalked/cardigantime/mcp';
import { z } from 'zod';

// Define your config schema
const myConfigSchema = z.object({
  port: z.number().default(3000),
  host: z.string().default('localhost'),
  apiKey: z.string().optional(),
});

// Create MCP integration
const integration = createMCPIntegration({
  appName: 'myapp',
  configSchema: myConfigSchema,
});

// Register CheckConfig tool with your MCP server
server.registerTool(
  integration.checkConfig.descriptor,
  integration.checkConfig.handler
);

// Use in your tools
async function myToolHandler(input: any, context: MCPInvocationContext) {
  const resolved = await integration.resolveConfig(context);
  const config = resolved.config;
  
  // Use config...
  return { result: 'success' };
}
```

### For Users (Cursor Configuration)

Configure a CardiganTime-based tool in Cursor's MCP settings (`.cursor/mcp_servers.json`):

```json
{
  "myapp": {
    "command": "npx",
    "args": ["myapp-mcp"],
    "config": {
      "port": 3000,
      "host": "localhost",
      "features": ["validation"],
      "output": {
        "directory": "./output",
        "format": "json"
      }
    }
  }
}
```

## Configuration Resolution

### MCP Configuration

When MCP config is provided:

```typescript
// MCP invocation
{
  "config": {
    "port": 8080,
    "host": "0.0.0.0"
  }
}

// Result: Uses MCP config exclusively
// No file-based config is loaded
```

### File-Based Fallback

When MCP config is not provided:

```typescript
// MCP invocation
{
  "workingDirectory": "/app/src",
  "targetFile": "/app/src/handler.ts"
}

// Discovery process:
// 1. Start from target file directory: /app/src/
// 2. Walk up: /app/src/ → /app/ → /
// 3. Use first config found
```

## CheckConfig Tool

Every CardiganTime-based MCP tool automatically includes the `check_config` tool.

### Basic Usage

```json
{
  "tool": "check_config",
  "input": {}
}
```

**Output:**
```json
{
  "source": "mcp",
  "hierarchical": false,
  "config": {
    "port": 3000,
    "host": "localhost",
    "apiKey": "***"
  },
  "summary": "Configuration loaded from MCP invocation",
  "documentation": {
    "configGuide": "https://...",
    "formatReference": "https://...",
    "mcpGuide": "https://..."
  }
}
```

### Verbose Mode

```json
{
  "tool": "check_config",
  "input": {
    "verbose": true
  }
}
```

Shows detailed breakdown of configuration sources and which values came from where.

### Summary Only

```json
{
  "tool": "check_config",
  "input": {
    "includeConfig": false
  }
}
```

Shows only summary information without exposing configuration values.

## Integration Patterns

### Pattern 1: Manual Resolution

Resolve configuration manually in each tool handler:

```typescript
import { createConfigResolver } from '@theunwalked/cardigantime/mcp';

const resolveConfig = createConfigResolver({
  appName: 'myapp',
  configSchema: myConfigSchema,
});

async function myToolHandler(input: any, context: MCPInvocationContext) {
  const resolved = await resolveConfig(context);
  const config = resolved.config;
  
  // Use config...
}
```

### Pattern 2: Config Injection

Automatically inject config into your handlers:

```typescript
import { createMCPIntegration } from '@theunwalked/cardigantime/mcp';

const integration = createMCPIntegration({
  appName: 'myapp',
  configSchema: myConfigSchema,
});

// Wrap your handler
const wrappedHandler = integration.withConfig(
  async (input, context) => {
    // Config is automatically available
    const config = context.resolvedConfig.config;
    
    // Use config...
    return { result: 'success' };
  }
);

server.registerTool('my_tool', wrappedHandler);
```

### Pattern 3: Complete Integration

Use all integration helpers together:

```typescript
import { createMCPIntegration } from '@theunwalked/cardigantime/mcp';

const integration = createMCPIntegration({
  appName: 'myapp',
  configSchema: myConfigSchema,
  resolveFileConfig: async (dir) => loadMyConfig(dir),
});

// Register CheckConfig
server.registerTool(
  integration.checkConfig.descriptor,
  integration.checkConfig.handler
);

// Register your tools with config injection
const tool1 = integration.withConfig(tool1Handler);
const tool2 = integration.withConfig(tool2Handler);

server.registerTool('tool1', tool1);
server.registerTool('tool2', tool2);
```

## Security

### Sensitive Value Sanitization

CheckConfig automatically sanitizes sensitive configuration values:

**Sanitized Patterns:**
- `password`, `secret`, `token`
- `apiKey`, `api_key`
- `auth`, `credential`
- `privateKey`, `private_key`
- `accessKey`, `access_key`

**Example:**
```json
{
  "config": {
    "port": 3000,
    "apiKey": "***",      // Sanitized
    "password": "***"     // Sanitized
  }
}
```

### Configuration Validation

All MCP configuration is validated against your Zod schema:

```typescript
// Invalid config throws MCPConfigError
{
  "config": {
    "port": "not-a-number"  // ❌ Validation fails
  }
}
```

## Error Handling

### MCPConfigError

Thrown when MCP configuration is invalid:

```typescript
try {
  const resolved = await integration.resolveConfig(context);
} catch (error) {
  if (error instanceof MCPConfigError) {
    console.error('Invalid MCP config:', error.message);
    console.error('Details:', error.getDetailedMessage());
  }
}
```

### MCPContextError

Thrown when required context is missing:

```typescript
// Neither config nor workingDirectory provided
{
  // ❌ Throws MCPContextError
}
```

## Best Practices

### For Tool Developers

1. **Define clear schemas** - Use Zod with sensible defaults
2. **Mark sensitive fields** - Use conventional names (`apiKey`, `password`, etc.)
3. **Test both modes** - Test with MCP config and file-based config
4. **Document your schema** - Users need to know what's configurable
5. **Use CheckConfig** - Test your integration with CheckConfig

### For AI Assistants

1. **Use CheckConfig first** - When debugging configuration issues
2. **Check verbose output** - To understand hierarchical merging
3. **Verify MCP config** - Confirm it's being used when expected
4. **Don't expose secrets** - CheckConfig sanitizes, but be careful
5. **Guide users** - Help them understand configuration sources

### For Users

1. **Start with MCP config** - Simpler than file-based for MCP tools
2. **Use CheckConfig** - To verify your configuration
3. **Keep it simple** - Only configure what you need to change
4. **Test incrementally** - Add config options one at a time
5. **Check documentation** - Each tool documents its schema

## FAQ

### Can I use both MCP and file config?

No. If MCP config is provided, it's used exclusively. This "simplifying assumption" makes configuration predictable and prevents confusion about which values come from where.

### How do I know which config is being used?

Use the `check_config` tool. It shows the source (`mcp`, `file`, or `defaults`) and the actual configuration values.

### What happens if MCP config is invalid?

The tool throws an `MCPConfigError` with detailed validation errors showing exactly which fields are invalid and why.

### Can I override just one field via MCP?

No. MCP config must be complete. If you provide MCP config, it replaces all file-based config. This prevents confusion about value sources.

### How do I migrate from file-based to MCP config?

1. Use CheckConfig to see your current file-based config
2. Copy the configuration values
3. Convert to JSON format
4. Add to your MCP server configuration
5. Optionally remove file-based config files

### What if I need different configs for different projects?

Use file-based config. MCP config is typically global per tool, while file-based config can vary by project directory.

## Examples

### Example 1: Basic MCP Configuration

```json
{
  "myapp": {
    "command": "npx",
    "args": ["myapp-mcp"],
    "config": {
      "port": 3000,
      "debug": true
    }
  }
}
```

### Example 2: Complex Nested Configuration

```json
{
  "myapp": {
    "command": "npx",
    "args": ["myapp-mcp"],
    "config": {
      "server": {
        "port": 3000,
        "host": "localhost",
        "ssl": {
          "enabled": true,
          "certPath": "/certs/server.crt"
        }
      },
      "database": {
        "host": "localhost",
        "port": 5432,
        "name": "myapp"
      },
      "features": ["validation", "logging", "metrics"]
    }
  }
}
```

### Example 3: Using CheckConfig

```typescript
// AI assistant checks configuration
{
  "tool": "check_config",
  "input": {
    "verbose": true
  }
}

// Response
{
  "source": "mcp",
  "config": { /* ... */ },
  "summary": "Configuration loaded from MCP invocation"
}
```

## API Reference

### `createMCPIntegration(options)`

Creates a complete MCP integration with all helpers.

**Parameters:**
- `appName` - Application name
- `configSchema` - Zod schema for configuration
- `docsBaseUrl` - Optional base URL for documentation
- `resolveFileConfig` - Optional file config resolver

**Returns:**
- `checkConfig` - CheckConfig tool descriptor and handler
- `resolveConfig` - Configuration resolver function
- `withConfig` - Handler wrapper for config injection
- `options` - Integration options

### `createCheckConfigTool(options)`

Creates just the CheckConfig tool.

**Parameters:** Same as `createMCPIntegration`

**Returns:**
- `descriptor` - MCP tool descriptor
- `handler` - Tool handler function

### `createConfigResolver(options)`

Creates a configuration resolver function.

**Parameters:** Same as `createMCPIntegration`

**Returns:** Function that resolves configuration from MCP or files

### `withConfig(handler, options)`

Wraps a handler to inject resolved configuration.

**Parameters:**
- `handler` - Your tool handler function
- `options` - Integration options

**Returns:** Wrapped handler with config injection

## Related Documentation

- [CheckConfig Tool Reference](./check-config-tool.md)
- [Configuration Discovery](./configuration-discovery.md)
- [Core Concepts](./core-concepts.md)
- [Getting Started](./getting-started.md)
