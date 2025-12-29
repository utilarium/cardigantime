# Architecture

**Purpose**: High-level overview of the internal design of `cardigantime`.

## Module Structure

The project is organized into distinct logical modules:

*   **`src/cardigantime.ts`**: The main entry point. Exports the `create` factory and types.
*   **`src/configure.ts`**: Handles Commander.js integration and CLI option configuration.
*   **`src/read.ts`**: Core logic for reading files, merging sources, and applying path resolution.
*   **`src/validate.ts`**: Wrapper around Zod validation with custom error handling.
*   **`src/util/`**:
    *   **`hierarchical.ts`**: Logic for discovering and merging configuration from multiple directory levels.
    *   **`storage.ts`**: Abstracted file system operations (easier testing).
    *   **`schema-defaults.ts`**: Recursively extracts default values from Zod schemas for generation.
*   **`src/error/`**: Custom error types (`ConfigurationError`, `FileSystemError`, `ArgumentError`).

## Data Flow

1.  **Initialization**: User calls `create()` with schema and defaults.
2.  **Configuration**: `configure()` adds CLI flags to Commander.
3.  **Read Phase** (`read()`):
    *   **Discovery**: `hierarchical.ts` finds relevant config directories.
    *   **Loading**: `loadConfigFromDirectory` reads and parses YAML.
    *   **Merging**: `deepMergeConfigs` combines configs with precedence.
    *   **Resolution**: Paths are resolved relative to their source file.
    *   **Cleaning**: Undefined values are filtered out.
4.  **Validation**: The final object is passed to Zod for strict schema validation.

## Design Decisions

*   **Zod First**: We prioritize Zod for all validation to ensure single source of truth for types and constraints.
*   **Explicit Defaults**: We avoid "magic" defaults where possible. Explicit defaults in the schema are preferred over runtime fallbacks.
*   **Safety**: Path traversal checks and input validation are performed early in the pipeline (`read.ts` and `storage.ts`).
*   **Testability**: The `storage` module abstracts FS calls, allowing extensive mocking in tests without hitting the disk.

