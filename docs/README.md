# Cardigantime Documentation Site

This directory contains a modern Vite + React documentation site that renders the main project README.md with proper syntax highlighting and a beautiful UI.

## Features

- ⚡ **Vite-powered** - Fast development and optimized builds
- ⚛️ **React-based** - Modern component architecture
- 📝 **Markdown rendering** - Powered by `react-markdown` with GitHub Flavored Markdown support
- 🎨 **Syntax highlighting** - Beautiful code blocks with `react-syntax-highlighter`
- 📱 **Responsive design** - Works great on all devices
- 🚀 **GitHub Pages ready** - Automatic deployment via GitHub Actions
- 🧪 **Comprehensive testing** - Unit tests, integration tests, and accessibility tests

## Development

### Quick Start

From the root project directory:

```bash
# Start the documentation site in development mode
npm run docs:dev

# Build the documentation site
npm run docs:build

# Preview the built documentation site
npm run docs:preview

# Run tests
npm run docs:test

# Run tests with coverage
npm run docs:coverage
```

### Manual Setup

If you want to work directly in the docs directory:

```bash
cd docs

# Install dependencies
npm install

# Copy the README to public directory
cp ../README.md public/

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run coverage
```

## Testing

The documentation site includes comprehensive tests:

### Test Structure

```
src/test/
├── setup.ts                     # Test setup and global mocks
├── simple.test.tsx              # Basic test examples
├── App.test.tsx                 # Main App component tests
├── components/                  # Component-specific tests
│   ├── LoadingSpinner.test.tsx
│   └── ErrorMessage.test.tsx
├── markdown/                    # Markdown rendering tests
│   └── MarkdownRenderer.test.tsx
├── integration/                 # Integration tests
│   └── App.integration.test.tsx
├── accessibility/               # Accessibility tests
│   └── App.a11y.test.tsx
└── utils/                       # Test utilities
    └── testUtils.tsx
```

### Test Categories

1. **Unit Tests** - Test individual components and functions
2. **Integration Tests** - Test complete user flows
3. **Accessibility Tests** - Ensure proper ARIA attributes and keyboard navigation
4. **Markdown Tests** - Verify markdown rendering and syntax highlighting

### Running Tests

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run coverage

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with UI (interactive)
npm run test:ui

# Run tests once (for CI)
npm run test:run
```

### Writing Tests

Tests use **Vitest** and **React Testing Library**:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from '../App'

describe('App Component', () => {
  it('renders loading state', () => {
    render(<App />)
    expect(screen.getByText('Loading documentation...')).toBeInTheDocument()
  })
})
```

## How It Works

1. **Content Source**: The site fetches and renders the main project `README.md`
2. **React Components**: The `App.tsx` component handles loading and rendering
3. **Markdown Processing**: Uses `react-markdown` with GitHub Flavored Markdown support
4. **Syntax Highlighting**: Code blocks are highlighted using `react-syntax-highlighter`
5. **Build Process**: Vite compiles everything into a static site for deployment
6. **Testing**: Vitest provides fast unit testing with jsdom environment

## Deployment

The documentation site is automatically built and deployed to GitHub Pages when changes are pushed to the `main` branch. The GitHub Actions workflow:

1. Builds the main library
2. Installs docs dependencies
3. Copies the README.md to the docs public directory
4. Builds the Vite documentation site
5. Deploys to GitHub Pages

## Customization

To customize the documentation site:

- **Styling**: Edit `src/App.css` and `src/index.css`
- **Layout**: Modify `src/App.tsx`
- **Content**: The site automatically uses the main project README.md
- **Dependencies**: Add new packages in `package.json`
- **Tests**: Add new test files in `src/test/`

## Technologies Used

- **Vite** - Build tool and development server
- **React 18** - UI framework
- **TypeScript** - Type safety
- **react-markdown** - Markdown rendering
- **react-syntax-highlighter** - Code syntax highlighting
- **remark-gfm** - GitHub Flavored Markdown support
- **Vitest** - Fast unit testing framework
- **React Testing Library** - Component testing utilities
- **jsdom** - DOM testing environment 