# Configuration Reference

**Purpose**: Detailed guide on configuring `cardigantime` instances and defining schemas.

## Schema Definition (Zod)

`cardigantime` relies heavily on `zod` for schema definition. This provides both runtime validation and static type inference.

### Best Practices

1.  **Defaults**: Use `.default()` extensively. This allows `cardigantime` to generate complete configuration files.
2.  **Descriptions**: Use `.describe()` to document fields. These descriptions may be used in future auto-generated documentation.
3.  **Environment Variables**: While `cardigantime` doesn't automatically map env vars to config keys (to avoid ambiguity), you can use `z.string().default(process.env.MY_VAR)` for explicit mapping.

```typescript
const ConfigSchema = z.object({
    server: z.object({
        host: z.string().default('localhost'),
        port: z.number().min(1).max(65535).default(3000),
    }),
    logging: z.object({
        level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    })
});
```

## Instance Configuration (`create`)

The `create` function is the entry point. It accepts a strictly typed options object.

### Options

| Option | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `configShape` | `ZodRawShape` | Yes | The `.shape` property of your Zod object schema. |
| `defaults` | `DefaultOptions` | Yes | Core runtime defaults. |
| `features` | `Feature[]` | No | Array of enabled features (e.g., `['hierarchical']`). |
| `logger` | `Logger` | No | Custom logger implementation. |

### Defaults Object

The `defaults` object controls file loading behavior:

*   `configDirectory` (Required): Base path to look for configuration.
*   `configFile` (Optional): Name of the file (default: `config.yaml`).
*   `encoding` (Optional): File encoding (default: `utf8`).
*   `pathResolution`: Configure how relative paths in values are resolved.
*   `fieldOverlaps`: Configure array merging strategies (`append`, `prepend`, `override`).

### Path Resolution

Automatically resolve relative paths in your config relative to the config file's location.

```typescript
defaults: {
    configDirectory: './config',
    pathResolution: {
        // These fields will be resolved to absolute paths
        pathFields: ['storage.dataDir', 'plugins.path'],
        // For arrays of paths
        resolvePathArray: ['plugins.path'] 
    }
}
```

### Array Merging (Hierarchical)

When using `hierarchical` feature, you can control how arrays from different levels merge.

```typescript
defaults: {
    // ...
    fieldOverlaps: {
        'plugins': 'append',       // Add plugins from user config to system config
        'denyList': 'prepend',     // User deny list comes before system deny list
        'overrides': 'override'    // Default behavior
    }
}
```

