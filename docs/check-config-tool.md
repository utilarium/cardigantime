# CheckConfig Tool

The `check_config` tool is a built-in diagnostic tool automatically available in all CardiganTime-based MCP servers. It helps AI assistants understand how a tool is configured.

## Purpose

When an AI assistant (like Claude in Cursor) invokes a tool through MCP, it may need to understand:

- Where the tool's configuration came from (MCP, file, or defaults)
- Which configuration files were used
- What the current configuration values are
- Whether hierarchical configuration is being used

The CheckConfig tool provides this information in a structured, AI-friendly format.

## Tool Descriptor

```json
{
  "name": "check_config",
  "description": "Check and display the current configuration for this tool. Shows where configuration came from (MCP, file, or defaults), which files were used, and the resolved configuration values. Use this to debug configuration issues or understand how the tool is configured.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "targetFile": {
        "type": "string",
        "description": "Optional file path to check configuration for. When provided, shows the most relevant configuration for this file (useful in hierarchical mode)."
      },
      "verbose": {
        "type": "boolean",
        "description": "Include detailed breakdown of configuration sources and merge order. Shows which values came from which files.",
        "default": false
      },
      "includeConfig": {
        "type": "boolean",
        "description": "Include the full resolved configuration in the output. When false, only shows summary information.",
        "default": true
      }
    },
    "additionalProperties": false
  }
}
```

## Input Parameters

### `targetFile` (optional)

**Type:** `string`

Optional file path to check configuration for. When provided in hierarchical mode, the tool determines the most relevant configuration for that specific file.

**Example:**
```json
{
  "targetFile": "/app/src/api/handler.ts"
}
```

### `verbose` (optional)

**Type:** `boolean`  
**Default:** `false`

When `true`, includes detailed breakdown of:
- All configuration sources that were checked
- Merge order (if hierarchical)
- Which values came from which source

**Example:**
```json
{
  "verbose": true
}
```

### `includeConfig` (optional)

**Type:** `boolean`  
**Default:** `true`

When `false`, only shows summary information without the actual configuration values. Useful when you only need to know where config comes from.

**Example:**
```json
{
  "includeConfig": false
}
```

## Output Format

### Basic Output

```json
{
  "source": "file",
  "configPaths": ["/app/config.yaml"],
  "hierarchical": false,
  "config": {
    "port": 3000,
    "host": "localhost",
    "apiKey": "***"
  },
  "summary": "Configuration loaded from /app/config.yaml",
  "documentation": {
    "configGuide": "https://...",
    "formatReference": "https://...",
    "mcpGuide": "https://..."
  }
}
```

### Verbose Output

```json
{
  "source": "file",
  "configPaths": [
    "/app/src/api/config.yaml",
    "/app/src/config.yaml",
    "/app/config.yaml"
  ],
  "hierarchical": true,
  "config": {
    "port": 3000,
    "host": "localhost",
    "apiKey": "***"
  },
  "valueBreakdown": [
    {
      "field": "port",
      "value": 3000,
      "source": "/app/src/api/config.yaml",
      "sanitized": false
    },
    {
      "field": "host",
      "value": "localhost",
      "source": "/app/config.yaml",
      "sanitized": false
    },
    {
      "field": "apiKey",
      "value": "***",
      "source": "/app/src/config.yaml",
      "sanitized": true
    }
  ],
  "summary": "Configuration merged from 3 files: /app/src/api/config.yaml, /app/src/config.yaml, /app/config.yaml",
  "documentation": {
    "configGuide": "https://...",
    "formatReference": "https://...",
    "mcpGuide": "https://..."
  }
}
```

### MCP Configuration Output

```json
{
  "source": "mcp",
  "hierarchical": false,
  "config": {
    "port": 8080,
    "host": "0.0.0.0"
  },
  "summary": "Configuration loaded from MCP invocation",
  "documentation": {
    "configGuide": "https://...",
    "formatReference": "https://...",
    "mcpGuide": "https://..."
  }
}
```

## Configuration Sources

### MCP Source

When configuration is provided via MCP invocation:
- `source`: `"mcp"`
- `configPaths`: Not present
- `hierarchical`: Always `false`

**Behavior:** MCP configuration takes exclusive precedence. No file-based config is loaded.

### File Source

When configuration is loaded from files:
- `source`: `"file"`
- `configPaths`: Array of file paths (most specific to least specific)
- `hierarchical`: `true` if multiple files were merged

**Behavior:** Files are discovered using standard naming patterns and merged according to hierarchical rules.

### Defaults Source

When no configuration is found:
- `source`: `"defaults"`
- `configPaths`: Not present
- `hierarchical`: `false`

**Behavior:** Tool uses built-in default values.

## Sensitive Value Sanitization

CheckConfig automatically sanitizes sensitive configuration values to prevent accidental exposure. Fields matching these patterns are sanitized:

- `password`
- `secret`
- `token`
- `apiKey` / `api_key`
- `auth`
- `credential`
- `privateKey` / `private_key`
- `accessKey` / `access_key`

Sanitized values are replaced with `"***"` and marked with `sanitized: true` in verbose mode.

## Use Cases

### Debugging Configuration Issues

```typescript
// AI assistant wants to understand why a tool isn't working
const result = await checkConfig({ verbose: true });
// Shows exactly which config files were loaded and their values
```

### Understanding Hierarchical Configuration

```typescript
// Check what config applies to a specific file
const result = await checkConfig({
  targetFile: "/app/src/api/handler.ts",
  verbose: true
});
// Shows the merged config for that location
```

### Verifying MCP Configuration

```typescript
// Confirm MCP config is being used
const result = await checkConfig({ includeConfig: false });
// Shows source without exposing config values
```

## Integration with CardiganTime

CheckConfig is automatically available when you use CardiganTime's MCP server helpers. No manual registration required.

```typescript
import { createMCPServer } from '@theunwalked/cardigantime';

const server = createMCPServer({
  name: 'my-tool',
  configSchema: mySchema,
  // CheckConfig is automatically registered
});
```

## Documentation Links

The tool provides links to:

1. **Configuration Guide**: How to configure CardiganTime-based tools
2. **Format Reference**: Supported formats (YAML, JSON, JS, TS)
3. **MCP Guide**: How MCP configuration works

These links help AI assistants find relevant documentation when needed.

## Best Practices

### For AI Assistants

1. **Use CheckConfig first** when debugging configuration issues
2. **Use verbose mode** to understand hierarchical merging
3. **Check targetFile** to see config for specific locations
4. **Don't expose** the full config output to users (may contain sensitive data)

### For Tool Developers

1. **Document your config schema** so CheckConfig output is meaningful
2. **Mark sensitive fields** appropriately in your schema
3. **Test CheckConfig** in both MCP and file-based modes
4. **Provide helpful documentation links** in your tool

## Example Scenarios

### Scenario 1: Tool Not Finding Config

**AI Assistant Action:**
```json
{
  "tool": "check_config",
  "input": {
    "verbose": true
  }
}
```

**Result:** Shows that `source: "defaults"` and no config files were found. AI can then guide user to create a config file.

### Scenario 2: Wrong Config Being Used

**AI Assistant Action:**
```json
{
  "tool": "check_config",
  "input": {
    "targetFile": "/app/src/api/handler.ts",
    "verbose": true
  }
}
```

**Result:** Shows which config files were merged and in what order. AI can explain why certain values are being used.

### Scenario 3: MCP Config Not Working

**AI Assistant Action:**
```json
{
  "tool": "check_config",
  "input": {
    "includeConfig": false
  }
}
```

**Result:** Shows `source: "file"` instead of `"mcp"`, indicating MCP config wasn't provided correctly. AI can help fix the MCP invocation.

## Technical Details

### Priority Model

CheckConfig respects the CardiganTime priority model:

1. **MCP config present** → Use exclusively (no file fallback)
2. **MCP config absent** → Fall back to file-based discovery
3. **No merging** between MCP and file configs

This "simplifying assumption" makes configuration predictable and debuggable.

### Performance

CheckConfig is designed to be fast:
- Reads existing resolved config (doesn't re-parse files)
- Sanitization is done on-demand
- Verbose mode adds minimal overhead

### Security

- Sensitive values are automatically sanitized
- No secrets are exposed in output
- Safe to use in untrusted environments
