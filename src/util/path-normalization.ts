/**
 * Path normalization utilities for handling file:// URLs and rejecting non-file URLs
 */

/**
 * Normalizes path input by converting file:// URLs to paths and rejecting non-file URLs
 * @param value - The value to normalize (string, array, object, or other)
 * @returns Normalized value with file:// URLs converted to paths
 * @throws Error if value contains http://, https://, or other non-file URLs
 */
export function normalizePathInput(value: any): any {
    if (typeof value === 'string') {
        return normalizePathString(value);
    }

    if (Array.isArray(value)) {
        return value.map(item =>
            typeof item === 'string' ? normalizePathString(item) : item
        );
    }

    if (value && typeof value === 'object') {
        const normalized: any = {};
        for (const [key, val] of Object.entries(value)) {
            normalized[key] = normalizePathInput(val); // Recursive for nested objects
        }
        return normalized;
    }

    return value;
}

/**
 * Normalizes a single path string by converting file:// URLs and rejecting non-file URLs
 * @param str - The string to normalize
 * @returns Normalized path string
 * @throws Error if string contains non-file URLs
 */
function normalizePathString(str: string): string {
    // Check for null bytes which could be used for path truncation attacks
    if (str.includes('\0')) {
        throw new Error('Path contains null bytes');
    }

    // Check for non-file URLs and reject them
    if (/^https?:\/\//i.test(str)) {
        throw new Error(`Non-file URLs are not supported in path fields: ${str}`);
    }

    // Convert file:// URLs to regular paths
    if (/^file:\/\//i.test(str)) {
        try {
            const url = new URL(str);
            // Decode URL-encoded characters (like %20 for spaces)
            const decoded = decodeURIComponent(url.pathname);
            // Re-check for null bytes after decoding
            if (decoded.includes('\0')) {
                throw new Error('Decoded path contains null bytes');
            }
            return decoded;
        } catch (e) {
            if (e instanceof Error && e.message.includes('null bytes')) {
                throw e;
            }
            throw new Error(`Invalid file:// URL: ${str}`);
        }
    }

    // Return regular paths unchanged
    return str;
}
