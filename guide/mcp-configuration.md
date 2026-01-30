# MCP Configuration

CardiganTime provides first-class support for Model Context Protocol (MCP) configuration, enabling AI assistants to configure tools directly through MCP invocations.

## Overview

When a CardiganTime-based tool is invoked via MCP, configuration can be provided in three ways (in priority order):

1. **MCP Configuration** - Provided in the MCP invocation (highest priority)
2. **File-Based Configuration** - Discovered from target file or working directory
3. **Default Configuration** - Built-in defaults

## The Simplifying Assumption

**If MCP configuration is provided, it is the complete configuration.**

This means:
- MCP config takes exclusive precedence
- No merging with file-based config
- No fallback to file config
- Predictable and debuggable behavior

## MCP Configuration Format

MCP configuration is provided as JSON in the MCP invocation:

```json
{
  "config": {
    "port": 3000,
    "host": "localhost",
    "features": ["validation", "logging"],
    "output": {
      "directory": "./output",
      "format": "json"
    }
  }
}
```

## Configuration Priority Model

```
MCP Config Present?
  ├─ YES → Use MCP config exclusively
  └─ NO → Discover from files
      ├─ Target file location?
      │   ├─ YES → Start discovery from target file directory
      │   └─ NO → Use working directory
      └─ Walk up directory tree looking for config files
```

## File-Based Fallback

When MCP config is not provided, CardiganTime discovers configuration files:

### Target File Discovery

If a target file is specified (e.g., audio file to transcribe):

```typescript
// MCP invocation
{
  "targetFile": "/app/src/api/handler.ts",
  "workingDirectory": "/app"
}

// Discovery starts from: /app/src/api/
// Walks up: /app/src/api/ → /app/src/ → /app/
```

### Working Directory Discovery

If no target file is specified:

```typescript
// MCP invocation
{
  "workingDirectory": "/app"
}

// Discovery starts from: /app/
// Walks up: /app/ → /
```

## CheckConfig Tool

Every CardiganTime-based MCP tool automatically includes the `check_config` tool for inspecting configuration.

### Usage

```json
{
  "tool": "check_config",
  "input": {
    "verbose": true,
    "includeConfig": true
  }
}
```

### Output

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

### When to Use CheckConfig

- **Debugging**: When a tool isn't behaving as expected
- **Verification**: To confirm MCP config is being used
- **Discovery**: To see which config files were found
- **Documentation**: To understand the tool's configuration

## Integration Patterns

### Basic Integration

```typescript
import { createMCPIntegration } from '@utilarium/cardigantime/mcp';

const integration = createMCPIntegration({
  appName: 'myapp',
  configSchema: myConfigSchema,
});

// Register CheckConfig tool
server.registerTool(
  integration.checkConfig.descriptor,
  integration.checkConfig.handler
);

// Use in your tools
async function myTool(input: any, context: MCPInvocationContext) {
  const resolved = await integration.resolveConfig(context);
  const config = resolved.config;
  
  // Use config...
}
```

### With Config Injection

```typescript
// Wrap your handler to automatically inject config
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

## Configuration Schema

Define your configuration schema using Zod:

```typescript
import { z } from 'zod';

const myConfigSchema = z.object({
  // Server settings
  port: z.number().default(3000),
  host: z.string().default('localhost'),
  
  // Features
  features: z.array(z.string()).default([]),
  
  // Output configuration
  output: z.object({
    directory: z.string(),
    format: z.enum(['json', 'yaml']).default('json'),
  }),
  
  // API keys (will be sanitized in CheckConfig)
  apiKey: z.string().optional(),
});
```

## Security Considerations

### Sensitive Values

CheckConfig automatically sanitizes sensitive configuration values:

- `password`, `secret`, `token`
- `apiKey`, `api_key`
- `auth`, `credential`
- `privateKey`, `private_key`
- `accessKey`, `access_key`

These are replaced with `"***"` in CheckConfig output.

### Validation

All MCP configuration is validated against your Zod schema before use:

```typescript
// Invalid config throws MCPConfigError
{
  "config": {
    "port": "not-a-number"  // ❌ Validation fails
  }
}
```

## Error Handling

### Invalid MCP Config

```typescript
try {
  const resolved = await resolveConfig(context, options);
} catch (error) {
  if (error instanceof MCPConfigError) {
    // Handle validation error
    console.error('Invalid MCP config:', error.message);
    console.error('Details:', error.getDetailedMessage());
  }
}
```

### Missing Context

```typescript
// Neither config nor workingDirectory provided
{
  // ❌ Throws MCPContextError
}
```

## Best Practices

### For Tool Developers

1. **Define clear schemas** - Use Zod with good defaults
2. **Mark sensitive fields** - Use conventional names (`apiKey`, `password`, etc.)
3. **Provide good defaults** - Make tools work with minimal config
4. **Document your schema** - Users need to know what's configurable
5. **Test both modes** - Test with MCP config and file-based config

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

No. If MCP config is provided, it's used exclusively. This is the "simplifying assumption" that makes configuration predictable.

### How do I know which config is being used?

Use the `check_config` tool. It shows the source (`mcp`, `file`, or `defaults`) and the actual configuration values.

### What happens if MCP config is invalid?

The tool throws an `MCPConfigError` with detailed validation errors. Use CheckConfig to verify your configuration before running tools.

### Can I override just one field via MCP?

No. MCP config must be complete. If you provide MCP config, it replaces all file-based config. This prevents confusion about which values come from where.

### How do I migrate from file-based to MCP config?

1. Use CheckConfig to see your current file-based config
2. Copy the configuration values
3. Convert to JSON format
4. Add to your MCP server configuration
5. Optionally remove file-based config files

## Examples

### Cursor MCP Configuration

Add to `.cursor/mcp_servers.json`:

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

### Checking Configuration

```typescript
// AI assistant invokes check_config
{
  "tool": "check_config",
  "input": {
    "verbose": true
  }
}

// Response shows MCP config is being used
{
  "source": "mcp",
  "config": { /* ... */ },
  "summary": "Configuration loaded from MCP invocation"
}
```

### File-Based Fallback

```typescript
// No MCP config provided
{
  "workingDirectory": "/app/src",
  "targetFile": "/app/src/handler.ts"
}

// CheckConfig shows file-based config
{
  "source": "file",
  "configPaths": ["/app/src/config.yaml", "/app/config.yaml"],
  "hierarchical": true,
  "summary": "Configuration merged from 2 files: ..."
}
```

## Related Documentation

- [CheckConfig Tool Guide](./check-config.md)
- [Configuration Formats](./index.md#configuration-formats)
- [Hierarchical Configuration](./index.md#hierarchical-configuration)
