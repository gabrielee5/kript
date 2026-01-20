# Contributing to Kript

Thank you for your interest in contributing to Kript! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](../CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

1. Check existing issues to avoid duplicates
2. Use the bug report template
3. Include:
   - Clear description of the issue
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, browser)
   - Relevant logs or screenshots

### Suggesting Features

1. Check existing issues and discussions
2. Use the feature request template
3. Explain the use case and expected behavior
4. Consider security implications

### Pull Requests

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Write/update tests
5. Update documentation
6. Submit a pull request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/kript.git
cd kript

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Start web development server
npm run dev
```

## Project Structure

```
kript/
├── core/           # Shared crypto logic
│   └── src/
│       ├── types.ts      # Type definitions
│       ├── utils.ts      # Utility functions
│       ├── keys.ts       # Key management
│       ├── encrypt.ts    # Encryption/decryption
│       ├── sign.ts       # Signing/verification
│       └── keyring.ts    # Keyring storage
├── cli/            # CLI application
│   └── src/
│       ├── commands/     # Individual commands
│       ├── storage.ts    # File storage adapter
│       └── utils.ts      # CLI utilities
├── web/            # Web application
│   └── src/
│       ├── components/   # React components
│       ├── pages/        # Page components
│       └── hooks/        # Custom hooks
└── docs/           # Documentation
```

## Coding Standards

### TypeScript

- Use strict mode
- Provide explicit return types for functions
- Document public APIs with JSDoc
- Avoid `any` type

```typescript
/**
 * Encrypts a message for the specified recipients.
 * @param options - Encryption options
 * @returns Encrypted message data
 * @throws {PGPError} If encryption fails
 */
export async function encrypt(options: EncryptOptions): Promise<EncryptResult> {
  // Implementation
}
```

### React Components

- Use functional components with hooks
- Follow the design system in `design.md`
- Keep components focused and small
- Use TypeScript interfaces for props

```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
  children: React.ReactNode;
}

export function Button({ variant = 'primary', onClick, children }: ButtonProps) {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick}>
      {children}
    </button>
  );
}
```

### Testing

- Write tests for new features
- Maintain >80% code coverage
- Use descriptive test names
- Test edge cases and error conditions

```typescript
describe('encrypt', () => {
  it('should encrypt a message for a single recipient', async () => {
    // Test implementation
  });

  it('should throw PGPError when recipient key is invalid', async () => {
    await expect(encrypt({ ... })).rejects.toThrow(PGPError);
  });
});
```

### Commits

Follow conventional commits:

```
feat: add support for ECC keys
fix: correct passphrase validation
docs: update API documentation
test: add tests for key generation
refactor: simplify encryption logic
chore: update dependencies
```

## Security Guidelines

### Never:
- Log private keys or passphrases
- Store sensitive data in plain text
- Use insecure cryptographic practices
- Ignore security warnings

### Always:
- Validate all inputs
- Handle errors properly
- Clear sensitive data from memory
- Follow the principle of least privilege

## Review Process

1. All PRs require at least one review
2. CI must pass (tests, lint, type check)
3. Documentation must be updated
4. Security implications must be considered

## Design System

When contributing to the web interface, follow the design guidelines in `design.md`:

- No rounded corners (except for circles)
- Use 0.85px borders
- Monospace fonts only
- Black/white/gray color scheme
- No shadows or gradients

## Getting Help

- Open an issue for questions
- Join our discussions on GitHub
- Check existing documentation

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes
- Project documentation

Thank you for contributing to Kript!
