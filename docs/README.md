# Kript

A modern, open-source PGP encryption tool that runs entirely locally with both CLI and web interfaces.

## Features

- **Generate PGP key pairs** (RSA 2048/4096, Curve25519)
- **Import/export keys** in armored and binary formats
- **Encrypt/decrypt** messages and files
- **Sign messages** and verify signatures
- **Manage keyring** (list, delete, search keys)
- **Key revocation** certificate generation
- **Local storage only** - no cloud, no external APIs

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/gabrielee5/kript.git
cd kript

# Install dependencies
npm install

# Build all packages
npm run build
```

### CLI Usage

```bash
# Generate a new key pair
npm run cli -- generate

# List all keys
npm run cli -- list-keys

# Encrypt a file
npm run cli -- encrypt -r recipient@example.com message.txt -o message.txt.pgp

# Decrypt a file
npm run cli -- decrypt message.txt.pgp -o message.txt

# Sign a message
echo "Hello" | npm run cli -- sign

# Verify a signature
npm run cli -- verify signed-message.asc
```

### Web Application

```bash
# Start development server
npm run dev

# Or build and serve production
npm run build
npm run web
```

Then open http://localhost:3000 in your browser.

## Documentation

- [Installation Guide](./INSTALL.md) - Detailed setup instructions
- [API Reference](./API.md) - CLI commands and programmatic usage
- [Security Guide](./SECURITY.md) - Security best practices
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute

## Architecture

```
kript/
├── core/       # Shared crypto logic (OpenPGP.js wrapper)
├── cli/        # Terminal interface (Commander.js)
├── web/        # Web application (React + Vite)
├── docs/       # Documentation
└── tests/      # Unit and integration tests
```

## Security

- All cryptographic operations run locally
- No data is ever sent to external servers
- Private keys are stored encrypted
- Passphrase-protected key storage
- See [SECURITY.md](./SECURITY.md) for full details

## License

MIT License - see [LICENSE](../LICENSE) for details.
