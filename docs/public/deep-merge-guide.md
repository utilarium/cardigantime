# Deep Merge in Hierarchical Configuration

Cardigantime automatically performs **deep merging** of nested objects when using hierarchical configuration discovery. This means that nested objects like `scopeRoots`, `database`, `api`, etc. are merged intelligently rather than completely replaced.

## The Problem

Traditional configuration systems often replace entire objects when merging configurations from multiple sources. This means if you have:

**Parent config:**
```yaml
scopeRoots:
  "@theunwalked": "../../tobrien"
  "@riotprompt": "../../tobrien"
```

**Child config:**
```yaml
scopeRoots:
  "@powerfuck": "../../powerfuck"
```

You'd typically lose the parent configuration and only get `@powerfuck`.

## The Solution: Deep Merge

Cardigantime automatically performs **deep merging**, which means nested objects are combined intelligently:

**Result:**
```yaml
scopeRoots:
  "@powerfuck": "../../powerfuck"        # From child config
  "@theunwalked": "../../"  # From parent config  
  "@riotprompt": "../../StJustReckoning"      # From parent config
```

## How It Works

### 1. Enable Hierarchical Discovery

```typescript
import { create } from '@theunwalked/cardigantime';

const cardigantime = create({
  defaults: {
    configDirectory: '.kodrdriv',
    configFile: 'config.yaml',
  },
  features: ['config', 'hierarchical'], // Enable hierarchical discovery
  configShape: YourSchema.shape
});
```

### 2. Directory Structure

```
/workspace/
├── .kodrdriv/
│   └── config.yaml              # Level 2 (lowest precedence)
├── project/
│   ├── .kodrdriv/
│   │   └── config.yaml          # Level 1 (medium precedence)
│   └── subproject/
│       ├── .kodrdriv/
│       │   └── config.yaml      # Level 0 (highest precedence)
│       └── your-app.js
```

### 3. Configuration Files

**Level 2 (`/workspace/.kodrdriv/config.yaml`):**
```yaml
link:
scopeRoots:
  "@theunwalked": "../../tobrien"
  "@riotprompt": "../../tobrien"
database:
  host: localhost
  port: 5432
```

**Level 1 (`/workspace/project/.kodrdriv/config.yaml`):**
```yaml
link:
scopeRoots:
  "@powerfuck": "../../powerfuck"
database:
  port: 5433
  ssl: true
```

**Level 0 (`/workspace/project/subproject/.kodrdriv/config.yaml`):**
```yaml
scopeRoots:
  "@local": "./local-modules"
```

### 4. Merged Result

When running from `/workspace/project/subproject/`, cardigantime produces:

```yaml
link:
scopeRoots:
  "@local": "./local-modules"           # From Level 0
  "@powerfuck": "../../powerfuck"       # From Level 1
  "@theunwalked": "../../tobrien"  # From Level 2
  "@riotprompt": "../../tobrien"      # From Level 2
database:
  host: localhost                       # From Level 2
  port: 5433                           # From Level 1 (overrides Level 2)
  ssl: true                            # From Level 1
```

## Deep Merge Rules

### Objects
- Nested objects are merged recursively
- Properties from higher precedence configs override lower precedence
- Properties that exist in only one config are preserved

### Arrays
- **Default behavior**: Arrays are replaced entirely (higher precedence wins)
- **Configurable**: You can change this with `fieldOverlaps` configuration

### Primitives
- Higher precedence values override lower precedence values

## Real-World Examples

### MyApp Use Case

This is perfect for the MyApp scenario mentioned in your question:

**`../../.kodrdriv/config.yaml`:**
```yaml
link:
scopeRoots:
  "@theunwalked": "../../tobrien"
  "@riotprompt": "../../tobrien"
```

**`../.kodrdriv/config.yaml`:**
```yaml
link:
scopeRoots:
  "@powerfuck": "../../powerfuck"
```

**Automatic result:**
```yaml
link:
scopeRoots:
  "@powerfuck": "../../powerfuck"
  "@theunwalked": "../../tobrien"
  "@riotprompt": "../../tobrien"
```

### Monorepo Configuration

**Root level (`/monorepo/.myapp/config.yaml`):**
```yaml
database:
  host: shared-db.example.com
  port: 5432
api:
  baseUrl: https://api.example.com
  timeout: 5000
scopeRoots:
  "@shared": "../../packages/shared"
  "@utils": "../../packages/utils"
```

**Team level (`/monorepo/teams/frontend/.myapp/config.yaml`):**
```yaml
api:
  timeout: 10000
scopeRoots:
  "@components": "../shared/components"
  "@styles": "../shared/styles"
```

**Project level (`/monorepo/teams/frontend/my-app/.myapp/config.yaml`):**
```yaml
database:
  ssl: true
scopeRoots:
  "@local": "./src/modules"
```

**Final merged configuration:**
```yaml
database:
  host: shared-db.example.com    # From root
  port: 5432                     # From root
  ssl: true                      # From project
api:
  baseUrl: https://api.example.com  # From root
  timeout: 10000                 # From team (overrides root)
scopeRoots:
  "@local": "./src/modules"      # From project
  "@components": "../shared/components"  # From team
  "@styles": "../shared/styles"  # From team
  "@shared": "../../packages/shared"    # From root
  "@utils": "../../packages/utils"      # From root
```

## Edge Cases and Advanced Behavior

### Property Conflicts

When the same property exists at multiple levels, higher precedence wins:

```yaml
# Level 2 (lower precedence)
scopeRoots:
  "@shared": "../../old-location"

# Level 1 (higher precedence)  
scopeRoots:
  "@shared": "../../new-location"

# Result
scopeRoots:
  "@shared": "../../new-location"  # Higher precedence wins
```

### Mixed Data Types

Objects can be merged even when they contain different data types:

```yaml
# Config 1
settings:
  debug: true
  timeout: 5000

# Config 2
settings:
  features: ["auth", "logging"]
  debug: false

# Result
settings:
  debug: false                    # Overridden
  timeout: 5000                   # Preserved
  features: ["auth", "logging"]   # Added
```

### Deeply Nested Objects

Deep merging works at any nesting level:

```yaml
# Config 1
api:
  endpoints:
    auth:
      login: "/api/v1/auth/login"
      logout: "/api/v1/auth/logout"
    users:
      list: "/api/v1/users"

# Config 2
api:
  endpoints:
    auth:
      refresh: "/api/v1/auth/refresh"
    posts:
      list: "/api/v1/posts"

# Result
api:
  endpoints:
    auth:
      login: "/api/v1/auth/login"      # From config 1
      logout: "/api/v1/auth/logout"    # From config 1
      refresh: "/api/v1/auth/refresh"  # From config 2
    users:
      list: "/api/v1/users"            # From config 1
    posts:
      list: "/api/v1/posts"            # From config 2
```

## No Additional Configuration Needed

This deep merge behavior is **built-in and automatic** when you enable hierarchical configuration. You don't need to configure anything special - it just works!

The only requirement is to enable the hierarchical feature:

```typescript
const cardigantime = create({
  defaults: {
    configDirectory: '.kodrdriv',
    configFile: 'config.yaml',
  },
  features: ['config', 'hierarchical'], // This enables deep merge
  configShape: YourSchema.shape
});
```

## Testing Deep Merge

You can test this functionality directly using the `deepMergeConfigs` function:

```typescript
import { deepMergeConfigs } from '@theunwalked/cardigantime/dist/util/hierarchical';

const configs = [
  // Lower precedence
  {
    scopeRoots: {
      "@theunwalked": "../../tobrien",
      "@riotprompt": "../../tobrien"
    }
  },
  // Higher precedence
  {
    scopeRoots: {
      "@powerfuck": "../../powerfuck"
    }
  }
];

const result = deepMergeConfigs(configs);
console.log(result);
// Output: All scopeRoots merged together
```

## Summary

**Yes, cardigantime already has the deepmerge functionality you need!** 

✅ **Nested objects are merged intelligently**  
✅ **All keys from all configurations are preserved**  
✅ **Higher precedence configs can override specific properties**  
✅ **Works automatically with hierarchical discovery**  
✅ **No additional configuration required**

Your exact `scopeRoots` use case will work perfectly with cardigantime's existing hierarchical configuration feature. 