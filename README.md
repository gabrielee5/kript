# LocalPGP

A modern, open-source PGP encryption tool that runs entirely locally with both CLI and web interfaces.

![CI](https://github.com/yourusername/localpgp/workflows/CI/badge.svg)
![License](https://img.shields.io/github/license/yourusername/localpgp)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)

## Features

- **Key Generation** - Create RSA (2048/4096) and ECC (Curve25519) key pairs
- **Encryption/Decryption** - Encrypt messages and files with public key or password
- **Digital Signatures** - Sign and verify messages and files
- **Key Management** - Import, export, search, and manage your keyring
- **Dual Interface** - Both CLI and web interfaces available
- **Local Only** - All operations run locally, no data leaves your device
- **Open Source** - MIT licensed, fully auditable

## Quick Start

```bash
# Clone and install
git clone https://github.com/yourusername/localpgp.git
cd localpgp
npm install
npm run build

# Generate a new key pair
npm run cli -- generate

# Encrypt a message
echo "Hello, World!" | npm run cli -- encrypt -r recipient@example.com

# Start the web interface
npm run dev
```

## Documentation

- [Installation Guide](./docs/INSTALL.md)
- [API Reference](./docs/API.md)
- [Security Guide](./docs/SECURITY.md)
- [Contributing](./docs/CONTRIBUTING.md)

## CLI Usage

```bash
# Key Management
localpgp generate              # Generate new key pair
localpgp list-keys             # List all keys
localpgp import-key <file>     # Import a key
localpgp export-key <keyid>    # Export a key
localpgp delete-key <keyid>    # Delete a key

# Encryption
localpgp encrypt <file> -r <recipient>    # Encrypt with public key
localpgp encrypt <file> -c                # Encrypt with password
localpgp decrypt <file>                   # Decrypt

# Signing
localpgp sign <file>           # Sign a message
localpgp verify <file>         # Verify a signature
```

## Web Interface

Start the development server:

```bash
npm run dev
```

Or build and serve:

```bash
npm run build
npm run web
```

The web interface provides:
- Key generation and management
- Message encryption/decryption
- Digital signature creation and verification
- Settings configuration

## Architecture

```
localpgp/
├── core/       # Shared cryptographic library
├── cli/        # Command-line interface
├── web/        # React web application
└── docs/       # Documentation
```

## Security

- All cryptographic operations use [OpenPGP.js](https://openpgpjs.org/)
- No data is ever sent to external servers
- Private keys are stored encrypted with your passphrase
- See [SECURITY.md](./docs/SECURITY.md) for full details

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Acknowledgments

- [OpenPGP.js](https://openpgpjs.org/) - The cryptographic foundation
- [Commander.js](https://github.com/tj/commander.js/) - CLI framework
- [React](https://react.dev/) - Web UI framework
- [Vite](https://vitejs.dev/) - Build tooling
