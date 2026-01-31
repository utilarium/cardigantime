# Protokoll Integration Guide

## Overview

This document describes how to update Protokoll to use the new CardiganTime path resolution features, specifically for `scopeRoots` configuration.

## Background

CardiganTime now supports automatic path resolution for objects with string values. This means that `scopeRoots` (an object mapping scope names to directory paths) can now be automatically resolved without manual intervention.

## Required Changes

### 1. Update CardiganTime Configuration

In Protokoll's CardiganTime setup (likely in a file like `src/config.ts` or `src/index.ts`), add `scopeRoots` to the `pathFields` array:

**Before:**
```typescript
const configManager = create({
    defaults: {
        pathResolution: {
            pathFields: ['outputDirectory', 'tempDirectory'],
            resolvePathArray: []
        }
    }
});
```

**After:**
```typescript
const configManager = create({
    defaults: {
        pathResolution: {
            pathFields: ['outputDirectory', 'tempDirectory', 'scopeRoots'],
            resolvePathArray: []
        }
    }
});
```

### 2. Remove Manual Path Resolution (if any)

If Protokoll has any manual path resolution code for `scopeRoots`, it can be removed:

**Remove this pattern if it exists:**
```typescript
// OLD - Manual resolution (remove this)
if (config.scopeRoots) {
    for (const [key, value] of Object.entries(config.scopeRoots)) {
        config.scopeRoots[key] = path.resolve(configDir, value);
    }
}
```

### 3. Update Tests

Update any Protokoll tests that check `scopeRoots` values to expect absolute paths:

**Before:**
```typescript
expect(config.scopeRoots['@utilarium']).toBe('../../utilarium');
```

**After:**
```typescript
expect(config.scopeRoots['@utilarium']).toBe('/project/utilarium');
```

### 4. Update Documentation

Update Protokoll's documentation to note:
- Paths in `scopeRoots` are automatically resolved relative to the config file
- Both relative and absolute paths are supported
- file:// URLs are supported

## Example Configuration

After these changes, this Protokoll config will work correctly:

```yaml
# .protokoll/config.yaml
scopeRoots:
  "@utilarium": "../../utilarium"
  "@kjerneverk": "../../kjerneverk"
  "@test": "./test-scope"
```

The paths will be automatically resolved to absolute paths relative to the config file's directory.

## Benefits

1. **Automatic Resolution**: No manual path resolution needed
2. **Portability**: Configs work regardless of where the tool is invoked
3. **Consistency**: Same resolution behavior as other path fields
4. **file:// URL Support**: Can use file:// URLs in addition to regular paths

## Testing

After making these changes:

1. Run Protokoll's test suite: `npm test`
2. Test with a real config file containing `scopeRoots`
3. Verify that paths are resolved correctly
4. Ensure no regressions in existing functionality

## Notes

- This change is backward compatible with existing configs
- The enhancement was added in CardiganTime v0.0.25
- See CardiganTime's CHANGELOG for full details
