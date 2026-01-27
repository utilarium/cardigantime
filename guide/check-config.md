# CheckConfig Tool Guide

The `check_config` tool is automatically available in all CardiganTime-based MCP tools. It helps AI assistants understand how a tool is configured.

## Purpose

CheckConfig provides visibility into:
- Where configuration came from (MCP, file, or defaults)
- Which configuration files were used (if file-based)
- The current configuration values (with sensitive values sanitized)
- Whether hierarchical configuration is active

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
    }
  }
}
```

## Input Parameters

### `targetFile` (optional)

Specify a file path to check configuration for that specific location. Useful in hierarchical mode to see which config applies to a particular file.

```json
{
  "targetFile": "/app/src/api/handler.ts"
}
```

### `verbose` (optional, default: false)

Include detailed breakdown showing:
- All configuration sources checked
- Merge order (if hierarchical)
- Which values came from which source

```json
{
  "verbose": true
}
```

### `includeConfig` (optional, default: true)

Whether to include the full configuration in the output. Set to `false` to only see summary information without actual config values.

```json
{
  "includeConfig": false
}
```

## Output Format

### Basic Output (MCP Config)

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

### Basic Output (File Config)

```json
{
  "source": "file",
  "configPaths": ["/app/config.yaml"],
  "hierarchical": false,
  "config": {
    "port": 3000,
    "host": "localhost"
  },
  "summary": "Configuration loaded from /app/config.yaml",
  "documentation": {
    "configGuide": "https://...",
    "formatReference": "https://...",
    "mcpGuide": "https://..."
  }
}
```

### Verbose Output (Hierarchical)

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

## Use Cases

### 1. Debugging Configuration Issues

**Scenario**: Tool isn't behaving as expected

**Action**: Run CheckConfig with verbose mode

```json
{
  "tool": "check_config",
  "input": {
    "verbose": true
  }
}
```

**Analysis**: Check the output to see:
- Is MCP config being used?
- Which files were loaded?
- Are the config values what you expect?

### 2. Verifying MCP Configuration

**Scenario**: You added MCP config and want to confirm it's being used

**Action**: Run CheckConfig without config output

```json
{
  "tool": "check_config",
  "input": {
    "includeConfig": false
  }
}
```

**Analysis**: Check `source` field:
- `"mcp"` = MCP config is active ✓
- `"file"` = File config is being used (MCP config not working)

### 3. Understanding Hierarchical Configuration

**Scenario**: Multiple config files exist and you want to know which values come from where

**Action**: Run CheckConfig in verbose mode

```json
{
  "tool": "check_config",
  "input": {
    "verbose": true,
    "targetFile": "/app/src/api/handler.ts"
  }
}
```

**Analysis**: Look at `valueBreakdown` to see which file contributed each value

### 4. Checking Configuration for Specific File

**Scenario**: Tool operates on files in different directories with different configs

**Action**: Run CheckConfig with target file

```json
{
  "tool": "check_config",
  "input": {
    "targetFile": "/app/src/api/handler.ts",
    "verbose": true
  }
}
```

**Analysis**: See which config applies to that specific file location

## Interpreting Output

### Source Field

- `"mcp"` - Configuration from MCP invocation (no file fallback)
- `"file"` - Configuration from files (MCP config not provided)
- `"defaults"` - No configuration found, using defaults

### Hierarchical Field

- `true` - Multiple config files were merged
- `false` - Single config source (or MCP)

### Config Paths

Array of file paths, ordered from most specific (closest) to least specific (furthest):

```json
"configPaths": [
  "/app/src/api/config.yaml",  // Most specific
  "/app/src/config.yaml",
  "/app/config.yaml"            // Least specific
]
```

### Value Breakdown (Verbose Mode)

Shows which file contributed each configuration value:

```json
{
  "field": "port",
  "value": 3000,
  "source": "/app/src/api/config.yaml",
  "sanitized": false
}
```

- `field` - Configuration field path (dot notation)
- `value` - The value (sanitized if sensitive)
- `source` - Where this value came from
- `sanitized` - Whether the value was sanitized

### Warnings

Array of potential issues detected:

```json
"warnings": [
  "Configuration merged from 5 files. Consider consolidating to improve maintainability."
]
```

## Sensitive Value Sanitization

CheckConfig automatically sanitizes sensitive fields to prevent accidental exposure:

### Sanitized Patterns

- `password`, `secret`, `token`
- `apiKey`, `api_key`
- `auth`, `credential`
- `privateKey`, `private_key`
- `accessKey`, `access_key`

### Example

```json
{
  "config": {
    "port": 3000,
    "apiKey": "***",      // Sanitized
    "password": "***"     // Sanitized
  }
}
```

In verbose mode, sanitized values are marked:

```json
{
  "field": "apiKey",
  "value": "***",
  "source": "/app/config.yaml",
  "sanitized": true
}
```

## Common Scenarios

### Scenario: MCP Config Not Working

**Symptoms**: You added MCP config but tool uses file config

**CheckConfig Output**:
```json
{
  "source": "file",
  "configPaths": ["/app/config.yaml"]
}
```

**Diagnosis**: MCP config not being provided in invocation

**Solution**: Verify MCP server configuration includes `"config"` field

### Scenario: Wrong Config Being Used

**Symptoms**: Tool uses unexpected configuration values

**CheckConfig Output** (verbose):
```json
{
  "valueBreakdown": [
    {
      "field": "port",
      "value": 8080,
      "source": "/app/src/config.yaml"
    }
  ]
}
```

**Diagnosis**: Child config overrides parent config

**Solution**: Either:
- Update the child config file
- Use MCP config to override completely
- Remove child config file

### Scenario: Too Many Config Files

**Symptoms**: Configuration is confusing with many files

**CheckConfig Output**:
```json
{
  "configPaths": [
    "/app/src/api/handlers/config.yaml",
    "/app/src/api/config.yaml",
    "/app/src/config.yaml",
    "/app/config.yaml",
    "/config.yaml"
  ],
  "warnings": [
    "Configuration merged from 5 files. Consider consolidating..."
  ]
}
```

**Diagnosis**: Too many config files in hierarchy

**Solution**: Consolidate configs or use MCP config

## Best Practices

### For AI Assistants

1. **Run CheckConfig first** when debugging config issues
2. **Use verbose mode** to understand hierarchical merging
3. **Check source field** to verify MCP vs file config
4. **Don't expose full output** to users (may contain sensitive data)
5. **Summarize findings** in user-friendly language

### For Tool Developers

1. **Test CheckConfig** with your tool
2. **Document your schema** so CheckConfig output is meaningful
3. **Use conventional names** for sensitive fields
4. **Provide good defaults** so CheckConfig shows reasonable values
5. **Link to your docs** in the documentation URLs

### For Users

1. **Use CheckConfig** when tool behavior is unexpected
2. **Start with basic mode** then use verbose if needed
3. **Check warnings** for configuration issues
4. **Verify MCP config** is active when expected
5. **Consolidate configs** if too many files are found

## Related Documentation

- [MCP Configuration Guide](./mcp-configuration.md)
- [Configuration Formats](./index.md#configuration-formats)
- [Hierarchical Configuration](./index.md#hierarchical-configuration)
