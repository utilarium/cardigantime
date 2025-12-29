# Development Guide

**Purpose**: Instructions for contributing to and developing `cardigantime`.

## Setup

1.  **Install Dependencies**: `npm install`
2.  **Build**: `npm run build`

## Testing

We use **Vitest** for testing.

*   **Run Tests**: `npm test`
*   **Coverage**: `npm run test` (configured to run with coverage by default)

### Testing Strategy

*   **Unit Tests**: Located in `tests/`. We aim for high coverage (>90%).
    *   `tests/util/`: Tests for internal utilities (storage, hierarchy, schema extraction).
    *   `tests/error/`: Tests for custom error classes.
*   **Mocking**: We use `vi.mock` extensively for filesystem operations to avoid side effects and test error conditions (permissions, missing files).

## Linting & Formatting

*   **Lint**: `npm run lint`
*   **Fix**: `npm run lint:fix`

We use ESLint with strict TypeScript rules.

## Release Process

1.  Update version in `package.json`.
2.  Run `npm run build`.
3.  Ensure tests pass.
4.  Commit and push.
5.  CI/CD pipeline handles publishing to NPM (if configured).

## Adding Features

1.  **Design**: Create a new module in `src/` if the feature is substantial.
2.  **Types**: Update `src/types.ts` if public interfaces change.
3.  **Tests**: Write tests *before* or *with* implementation (TDD encouraged).
4.  **Documentation**: Update the `guide/` directory if architectural changes occur.

