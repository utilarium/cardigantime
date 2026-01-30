# Cardigantime Security Guide

## Overview

Cardigantime provides comprehensive security validation for CLI arguments and
configuration files. This guide explains the security features and how to use
them effectively.

## Threat Model

### What We Protect Against

1. **Path Traversal Attacks**
   - Directory traversal sequences (`../`, `..\\`)
   - URL-encoded traversal (`%2e%2e/`)
   - Symlink escapes

2. **Numeric Attacks**
   - Integer overflow/underflow
   - Resource exhaustion via extreme values
   - NaN/Infinity injection

3. **String Injection**
   - Null byte injection
   - Control character injection
   - Log injection via ANSI escapes
   - Command injection patterns

4. **Configuration Attacks**
   - Malicious configuration files
   - Supply chain attacks via checked-in configs
   - Environment variable manipulation

### What We Don't Protect Against

- Memory corruption (use memory-safe language)
- Side-channel attacks
- Physical access attacks
- Social engineering

## Quick Start

### Enable Security Validation

```typescript
import { create } from '@utilarium/cardigantime';
import { z } from 'zod';

const cardigantime = create({
  defaults: {
    configDirectory: './config',
    configFile: 'config.yaml',
    isRequired: false,
    encoding: 'utf8',
    security: {
      profile: 'production', // Enable strict validation
    },
  },
  configShape: z.object({
    apiEndpoint: z.string(),
    timeout: z.number().min(0).max(60000),
  }).shape,
  features: ['config'],
  logger: console,
});
```

### Use Secure Schema Extensions

```typescript
import { securePath, secureNumber, secureString } from '@utilarium/cardigantime';
import { z } from 'zod';

const schema = z.object({
  // Path with traversal protection
  configFile: securePath({
    allowedExtensions: ['.yaml', '.json'],
    allowHiddenFiles: false,
  }),
  
  // Number with bounds
  timeout: secureNumber(0, 60000, { integer: true }),
  
  // String with pattern
  model: secureString({
    pattern: /^[a-z0-9-]+$/i,
    maxLength: 100,
  }),
});
```

## Security Profiles

### Development Profile

- Warnings instead of errors
- Permissive path validation
- Verbose error messages
- Enabled by default

### Production Profile

- Strict validation, fail-fast
- Restricted paths
- Sanitized error messages
- Enabled via `profile: 'production'` or `NODE_ENV=production`

### Custom Profile

```typescript
import { createProfile } from '@utilarium/cardigantime';

const customConfig = createProfile('production')
  .restrictPathsTo(['/app/config', '/app/data'])
  .allowExtensions(['.yaml', '.yml'])
  .failFast(true)
  .build();
```

## Best Practices

### 1. Always Use Bounds for Numbers

```typescript
// ❌ Bad: Unbounded number
timeout: z.number()

// ✅ Good: Bounded number
timeout: z.number().min(0).max(60000)

// ✅ Better: Use secureNumber
timeout: secureNumber(0, 60000)
```

### 2. Validate Paths Explicitly

```typescript
// ❌ Bad: Trust any path
configFile: z.string()

// ✅ Good: Use path validation
configFile: securePath({
  allowedExtensions: ['.yaml'],
  allowedBaseDirs: ['./config'],
})
```

### 3. Restrict String Formats

```typescript
// ❌ Bad: Accept any string
modelName: z.string()

// ✅ Good: Restrict format
modelName: z.string().regex(/^[a-z0-9-]+$/i).max(100)

// ✅ Better: Use preset
modelName: secureModelName()
```

### 4. Validate Config Files Too

Configuration files should be validated with the same rigor as CLI arguments:

```typescript
const cardigantime = create({
  defaults: {
    configDirectory: './config',
    configFile: 'config.yaml',
    isRequired: false,
    encoding: 'utf8',
    security: {
      profile: 'production',
      // Config and CLI get same validation
    },
  },
  // ...
});
```

### 5. Use Environment-Based Profiles

```bash
# Development (permissive)
NODE_ENV=development npm start

# Production (strict)
NODE_ENV=production npm start

# Explicit override
CARDIGANTIME_SECURITY_PROFILE=production npm start
```

## API Reference

### Secure Zod Extensions

#### `securePath(options)`

Creates a Zod schema for secure path validation.

```typescript
securePath({
  maxPathLength?: number;      // Default: 500
  allowHiddenFiles?: boolean;  // Default: false
  allowAbsolutePaths?: boolean; // Default: true
  allowedExtensions?: string[];
  allowedBaseDirs?: string[];
})
```

#### `secureNumber(min, max, options)`

Creates a Zod schema for secure numeric validation.

```typescript
secureNumber(0, 100, {
  integer?: boolean;
  allowNaN?: boolean;    // Default: false
  allowInfinity?: boolean; // Default: false
})
```

#### `secureString(options)`

Creates a Zod schema for secure string validation.

```typescript
secureString({
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  allowNullBytes?: boolean;    // Default: false
  allowControlChars?: boolean; // Default: false
})
```

### Guards

#### `PathGuard`

Runtime path validation with comprehensive security checks.

```typescript
import { createPathGuard } from '@utilarium/cardigantime';

const guard = createPathGuard({
  allowedBaseDirs: ['/app/config'],
  maxPathLength: 500,
});

guard.validate('/app/config/settings.yaml'); // OK
guard.validate('../../../etc/passwd'); // Throws
```

#### `NumericGuard`

Runtime numeric validation with bounds checking.

```typescript
import { createNumericGuard, SAFE_RANGES } from '@utilarium/cardigantime';

const guard = createNumericGuard();

guard.validate(8080, { min: 1, max: 65535, integer: true }); // OK
guard.validateRange(8080, 'port'); // OK using preset
```

#### `StringGuard`

Runtime string validation with pattern matching.

```typescript
import { createStringGuard } from '@utilarium/cardigantime';

const guard = createStringGuard();

guard.validateModelName('gpt-4o'); // OK
guard.detectInjection("'; DROP TABLE users;"); // { suspicious: true }
```

### Validators

#### `SecurityValidator`

Unified validation across CLI and config sources.

```typescript
import { createSecurityValidator } from '@utilarium/cardigantime';

const validator = createSecurityValidator({ profile: 'production' });
validator.registerSchema(schema);

const result = validator.validateMerged(merged, cliArgs, configValues);
```

## Migration Guide

### From Unsecured Configuration

**Before:**
```typescript
const schema = z.object({
  configPath: z.string(),
  timeout: z.number(),
  model: z.string(),
});
```

**After:**
```typescript
import { securePath, secureNumber, secureString } from '@utilarium/cardigantime';

const schema = z.object({
  configPath: securePath({ allowedExtensions: ['.yaml'] }),
  timeout: secureNumber(0, 60000),
  model: secureString({ pattern: /^[a-z0-9-]+$/i }),
});
```

### Gradual Adoption

1. Start with `profile: 'development'` to see warnings
2. Fix validation issues one by one
3. Switch to `profile: 'production'` when ready

## Error Handling

### Development Mode Errors

```
Security warning for CLI: configDirectory: Path contains shell metacharacters
```

### Production Mode Errors

```
Configuration validation failed:
  - configDirectory: Path security validation failed
```

Detailed error information is logged but not exposed to users in production.

## Audit Logging

Enable audit logging to track security events:

```typescript
const cardigantime = create({
  defaults: {
    security: {
      auditLogging: true,
    },
  },
  // ...
});
```

Log output:
```
[SECURITY:VALIDATION_STARTED] Security validation started for cli
[SECURITY:PATH_BLOCKED] Path blocked: contains traversal sequences
[SECURITY:VALIDATION_FAILED] Security validation failed with 1 error(s)
```

## FAQ

### Q: Why does cardigantime validate config files?

Config files can be:
- Checked into repos by attackers (supply chain)
- Modified by malware on the system
- Loaded from user-controlled locations

They deserve the same validation as direct user input.

### Q: Can I disable security validation?

Yes, but it's not recommended:

```typescript
security: {
  profile: 'development',
  failOnError: false,
}
```

### Q: How do I allow a specific "unsafe" path?

Use the `allowedBaseDirs` option:

```typescript
securePath({
  allowedBaseDirs: ['/opt/myapp', '/etc/myapp'],
})
```

### Q: What's the performance impact?

Security validation adds minimal overhead (<1ms per validation in typical usage).

