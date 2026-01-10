# Security Fix: Prototype Pollution Prevention

## Issue
CodeQL identified a prototype pollution vulnerability in the `setNestedValue` function. This function is used to set nested configuration values using dot notation (e.g., `"path.to.value"`), and it was vulnerable to prototype pollution attacks through special property names like `__proto__`, `constructor`, and `prototype`.

## Impact
If an attacker could control configuration file contents or path field names, they could potentially:
- Modify `Object.prototype` to inject properties into all JavaScript objects
- Tamper with application logic
- Potentially escalate to remote code execution or cross-site scripting

## Fix Applied
The fix was applied to two locations where `setNestedValue` is defined:

### 1. `/src/read.ts` (lines 61-92)
Added the `isUnsafeKey` helper function and modified `setNestedValue` to:
- Check if any key in the path (including the final key) is a dangerous property name
- Return early without making any assignments if dangerous keys are detected
- Add defensive checks in the reduce callback to skip unsafe keys

### 2. `/src/util/hierarchical.ts` (lines 43-67)
Applied the same fix pattern as above.

## Implementation Details

```typescript
/**
 * Checks if a key is unsafe for prototype pollution prevention.
 */
function isUnsafeKey(key: string): boolean {
    return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

/**
 * Sets a nested value in an object using dot notation.
 * Prevents prototype pollution by rejecting dangerous property names.
 */
function setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;

    // Prevent prototype pollution via special property names
    if (isUnsafeKey(lastKey) || keys.some(isUnsafeKey)) {
        return;
    }

    const target = keys.reduce((current, key) => {
        // Skip if this is an unsafe key (already checked above, but defensive)
        if (isUnsafeKey(key)) {
            return current;
        }
        if (!(key in current)) {
            current[key] = {};
        }
        return current[key];
    }, obj);
    target[lastKey] = value;
}
```

## Behavior
- **Normal keys**: Function works exactly as before
- **Dangerous keys**: Paths containing `__proto__`, `constructor`, or `prototype` are silently ignored
  - No error is thrown (acceptable for a config-path convenience feature)
  - The configuration simply won't include those dangerous paths

## Testing
- All existing tests pass (465 tests)
- The fix is localized and doesn't break any existing functionality
- No new dependencies or imports required

## References
- [CWE-1321: Improperly Controlled Modification of Object Prototype Attributes](https://cwe.mitre.org/data/definitions/1321.html)
- [MDN: Object.prototype.__proto__](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/proto)
- CodeQL Rule: `js/prototype-polluting-assignment`

