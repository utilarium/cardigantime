# Configuration Discovery

**Purpose**: Documents how Cardigantime discovers and loads configuration files, including naming conventions, hierarchical modes, and security boundaries.

## Overview

Cardigantime uses a flexible discovery system that supports multiple configuration file naming conventions. This allows tools to adopt modern, visible config file patterns (like `vite.config.ts`) while maintaining backward compatibility with hidden directory patterns (like `.eslintrc`).

## Naming Conventions

Configuration files are discovered using these patterns, checked in priority order:

| Priority | Pattern | Example | Hidden |
|----------|---------|---------|--------|
| 1 | `{app}.config.{ext}` | `protokoll.config.yaml` | No |
| 2 | `{app}.conf.{ext}` | `protokoll.conf.yaml` | No |
| 3 | `.{app}/config.{ext}` | `.protokoll/config.yaml` | Yes |
| 4 | `.{app}rc.{ext}` | `.protokollrc.yaml` | Yes |
| 5 | `.{app}rc` | `.protokollrc` | Yes |

**Design Rationale:**
- Visible files (priority 1-2) are preferred for discoverability
- Hidden patterns (priority 3-5) maintain compatibility with existing conventions
- The `{app}.config.{ext}` pattern follows modern tools like Vite, Next.js

### Format Extensions

For patterns with `{ext}`, these extensions are checked (in order):
1. TypeScript: `.ts`, `.mts`, `.cts`
2. JavaScript: `.js`, `.mjs`, `.cjs`
3. JSON: `.json`
4. YAML: `.yaml`, `.yml`

## Hierarchical Configuration

Cardigantime can search up the directory tree for configuration files, merging them with proper precedence (closer configs win).

### Hierarchical Modes

```typescript
type HierarchicalMode = 'enabled' | 'disabled' | 'root-only' | 'explicit';
```

| Mode | Behavior | Use Case |
|------|----------|----------|
| `enabled` | Walk up tree, merge configs | Most projects (default) |
| `disabled` | Single directory only | MCP configs, isolated projects |
| `root-only` | Find first config, no merge | Simple discovery without inheritance |
| `explicit` | Only merge referenced configs | Fine-grained control via `extends` |

### Configuration Example

```yaml
# In a child config that should be isolated
hierarchical:
  mode: disabled
```

### Root Markers

Hierarchical discovery stops at project root boundaries, detected by:
- `package.json`
- `.git` directory
- `pnpm-workspace.yaml`
- `lerna.json`
- `nx.json`

### Options

```typescript
interface HierarchicalOptions {
  mode?: HierarchicalMode;      // Default: 'enabled'
  maxDepth?: number;            // Default: 10
  stopAt?: string[];            // Directory names to stop at
  rootMarkers?: RootMarker[];   // Custom root markers
  stopAtRoot?: boolean;         // Default: true
}
```

## Security Boundaries

Cardigantime enforces security boundaries to prevent configuration discovery from accessing sensitive directories.

### Forbidden Directories

These system directories are never accessed:
- `/etc`, `/usr`, `/var`, `/sys`, `/proc`
- `$HOME/.ssh`, `$HOME/.gnupg`, `$HOME/.aws`

### Depth Limits

- **maxAbsoluteDepth**: 20 (from filesystem root)
- **maxRelativeDepth**: 10 (from starting directory)

### Override (Use With Caution)

```typescript
// Only for trusted environments
const options = {
  allowUnsafeTraversal: true  // Bypasses security checks
};
```

## Discovery API

### Basic Discovery

```typescript
import { discoverConfig } from '@utilarium/cardigantime/discovery';

const result = await discoverConfig('/project/src', {
  appName: 'myapp',
  extensions: ['yaml', 'json'],
});

if (result.config) {
  console.log(`Found: ${result.config.absolutePath}`);
}
```

### Hierarchical Discovery

```typescript
import { discoverWithMode } from '@utilarium/cardigantime/discovery';

const result = await discoverWithMode(
  '/project/src',
  { appName: 'myapp', extensions: ['yaml'] },
  { mode: 'enabled', maxDepth: 5 }
);

// result.configs contains all configs found in hierarchy
```

### Multiple Config Warning

When multiple config files exist at the same level, Cardigantime warns:

```
Multiple config files found. Using 'myapp.config.yaml' (priority 1).
Ignored: '.myapprc.yaml'. Consider removing unused config files.
```

Disable with `warnOnMultipleConfigs: false`.

## Migration Guide

### From Hidden Directory Pattern

If migrating from `.protokoll/config.yaml` to visible config:

1. Create `protokoll.config.yaml` at project root
2. Copy content from `.protokoll/config.yaml`
3. Optionally remove `.protokoll/` directory
4. Both work simultaneously during transition (visible takes priority)

### Disabling Hierarchical for MCP

MCP servers typically want isolated configuration:

```yaml
# mcp-server.config.yaml
hierarchical:
  mode: disabled
```

## Troubleshooting

### Config Not Found

1. Check naming pattern matches one of the standard conventions
2. Verify file is in the search path
3. Use `--check-config` to see discovery process
4. Check file permissions

### Wrong Config Being Used

1. Check priority order - visible configs take precedence
2. Use `warnOnMultipleConfigs` to detect duplicates
3. Remove unused config files

### Hierarchical Not Working

1. Verify mode is `enabled` (default)
2. Check maxDepth setting
3. Ensure not blocked by root markers
4. Check for mode overrides in parent configs
