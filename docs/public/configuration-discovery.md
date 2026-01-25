# Configuration Discovery

Cardigantime provides a flexible configuration discovery system that automatically finds configuration files using multiple naming conventions and supports hierarchical configuration inheritance.

## Naming Conventions

Cardigantime searches for configuration files using these patterns (checked in priority order):

| Priority | Pattern | Example | Description |
|----------|---------|---------|-------------|
| 1 | `{app}.config.{ext}` | `myapp.config.yaml` | Modern style (recommended) |
| 2 | `{app}.conf.{ext}` | `myapp.conf.yaml` | Unix-style configuration |
| 3 | `.{app}/config.{ext}` | `.myapp/config.yaml` | Hidden directory style |
| 4 | `.{app}rc.{ext}` | `.myapprc.yaml` | RC file with extension |
| 5 | `.{app}rc` | `.myapprc` | RC file without extension |

### Format Priority

Within each naming pattern, file formats are checked in this order:

1. **TypeScript** (`.ts`, `.mts`, `.cts`) - Highest priority
2. **JavaScript** (`.js`, `.mjs`, `.cjs`)
3. **JSON** (`.json`)
4. **YAML** (`.yaml`, `.yml`) - Lowest priority

### Example

For an app named "protokoll" with YAML config:

```
protokoll.config.yaml     ← Checked first (priority 1)
protokoll.conf.yaml       ← Checked second (priority 2)
.protokoll/config.yaml    ← Checked third (priority 3)
.protokollrc.yaml         ← Checked fourth (priority 4)
.protokollrc              ← Checked fifth (priority 5)
```

The first file found is used.

## Hierarchical Configuration

Cardigantime can search up the directory tree and merge configurations from multiple levels, similar to how `.gitignore` or `.eslintrc` work.

### Hierarchical Modes

Control hierarchical behavior with the `mode` option:

| Mode | Description | Use Case |
|------|-------------|----------|
| `enabled` | Walk up tree, merge configs (default) | Most projects |
| `disabled` | Single directory only | MCP configs, isolated projects |
| `root-only` | Find first config, don't merge | Simple discovery |
| `explicit` | Only merge via `extends` | Fine-grained control |

### Setting the Mode

In your configuration file:

```yaml
# Disable hierarchical inheritance
hierarchical:
  mode: disabled
```

Or programmatically:

```typescript
const result = await discoverWithMode(startPath, options, {
  mode: 'disabled'
});
```

### Root Detection

Hierarchical traversal automatically stops at project roots, detected by:

- `package.json`
- `.git` directory
- `pnpm-workspace.yaml`
- `lerna.json`
- `nx.json`

### Options

```typescript
interface HierarchicalOptions {
  mode?: 'enabled' | 'disabled' | 'root-only' | 'explicit';
  maxDepth?: number;        // Maximum directories to traverse (default: 10)
  stopAt?: string[];        // Directory names to stop at
  rootMarkers?: RootMarker[]; // Custom root detection markers
  stopAtRoot?: boolean;     // Stop at root markers (default: true)
}
```

## Security

Cardigantime enforces security boundaries to prevent configuration discovery from accessing sensitive system directories.

### Forbidden Directories

These directories are never accessed during discovery:

**Unix/macOS:**
- `/etc`, `/usr`, `/var`, `/sys`, `/proc`
- `/bin`, `/sbin`, `/lib`, `/opt`, `/root`
- `$HOME/.ssh`, `$HOME/.gnupg`, `$HOME/.aws`

**Windows:**
- `C:\Windows`, `C:\Program Files`
- `$HOME\.ssh`, `$HOME\.aws`

### Depth Limits

- **Maximum absolute depth**: 20 levels from filesystem root
- **Maximum relative depth**: 10 levels from starting directory

### Unsafe Traversal

For trusted environments where you need to bypass security checks:

```typescript
const checker = createBoundaryChecker({
  allowUnsafeTraversal: true,  // ⚠️ Use with caution
  warnOnOverride: true
});
```

## Multiple Config Warning

When multiple configuration files exist at the same directory level, Cardigantime warns you:

```
Multiple config files found. Using 'myapp.config.yaml' (priority 1).
Ignored: '.myapprc.yaml' (priority 4). Consider removing unused config files.
```

Disable this warning if needed:

```typescript
await discoverConfig(directory, {
  appName: 'myapp',
  warnOnMultipleConfigs: false
});
```

## API Reference

### discoverConfig

Discover a single configuration file:

```typescript
import { discoverConfig } from '@theunwalked/cardigantime/discovery';

const result = await discoverConfig('/project', {
  appName: 'myapp',
  extensions: ['yaml', 'json'],
  searchHidden: true,
  warnOnMultipleConfigs: true
});

if (result.config) {
  console.log(`Found: ${result.config.absolutePath}`);
  console.log(`Pattern: ${result.config.pattern.pattern}`);
}

if (result.multipleConfigWarning) {
  console.warn('Multiple configs found!');
}
```

### discoverWithMode

Discover with hierarchical mode support:

```typescript
import { discoverWithMode } from '@theunwalked/cardigantime/discovery';

const result = await discoverWithMode(
  '/project/src/deep',
  { appName: 'myapp', extensions: ['yaml'] },
  { mode: 'enabled', maxDepth: 5 }
);

console.log(`Mode: ${result.mode}`);
console.log(`Configs found: ${result.configs.length}`);
console.log(`Should merge: ${result.shouldMerge}`);
```

### hasConfigFile

Quick check if any config exists:

```typescript
import { hasConfigFile } from '@theunwalked/cardigantime/discovery';

const exists = await hasConfigFile('/project', {
  appName: 'myapp',
  extensions: ['yaml', 'json']
});
```

## Migration Guide

### From Hidden to Visible Config

If you're currently using `.myapp/config.yaml` and want to switch to visible config files:

1. **Create the new file**:
   ```bash
   # Copy content to new location
   cp .myapp/config.yaml myapp.config.yaml
   ```

2. **Both files work during transition**:
   - Cardigantime checks `myapp.config.yaml` first (priority 1)
   - Falls back to `.myapp/config.yaml` (priority 3) if not found

3. **Remove the old directory when ready**:
   ```bash
   rm -rf .myapp/
   ```

### For MCP Servers

MCP (Model Context Protocol) servers typically want isolated configuration without hierarchical inheritance:

```yaml
# mcp-server.config.yaml
hierarchical:
  mode: disabled

# Your MCP config here
server:
  port: 8080
```

## Troubleshooting

### "Config file not found"

1. **Check file name matches a standard pattern**:
   - `myapp.config.yaml` ✓
   - `myapp-config.yaml` ✗ (wrong pattern)

2. **Verify file extension is supported**:
   - `.yaml`, `.yml`, `.json`, `.js`, `.ts` ✓
   - `.cfg`, `.ini` ✗

3. **Use `--check-config` to see what's being searched**:
   ```bash
   myapp --check-config
   ```

### "Wrong config file is being used"

1. **Check priority order** - visible files take precedence:
   - `myapp.config.yaml` beats `.myapprc.yaml`
   - TypeScript beats JavaScript beats JSON beats YAML

2. **Look for duplicate configs**:
   ```bash
   ls myapp.config.* .myapp/ .myapprc*
   ```

3. **Remove unused config files** to avoid confusion

### "Hierarchical config not merging"

1. **Verify mode is `enabled`** (the default):
   ```yaml
   hierarchical:
     mode: enabled  # or remove this section entirely
   ```

2. **Check for root markers** blocking traversal:
   - Discovery stops at `package.json`, `.git`, etc.
   - Use `stopAtRoot: false` to continue past roots

3. **Check depth limits**:
   - Default maxDepth is 10
   - Increase if your project structure is deeper
