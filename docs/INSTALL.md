# Installation Guide

## Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** 9.0.0 or higher (comes with Node.js)
- **Git** (for cloning the repository)

## Installation Methods

### Method 1: From Source (Recommended)

```bash
# Clone the repository
git clone https://github.com/gabrielee5/kript.git
cd kript

# Install all dependencies
npm install

# Build all packages
npm run build
```

### Method 2: Global CLI Installation

After building from source:

```bash
# Link the CLI globally
cd cli
npm link

# Now you can use 'kript' command directly
kript --help
```

### Method 3: Development Setup

```bash
# Clone and install
git clone https://github.com/gabrielee5/kript.git
cd kript
npm install

# Build core library first (required by CLI and web)
npm run build --workspace=@kript/core

# Run CLI in development
npm run cli -- --help

# Run web app in development
npm run dev
```

## Platform-Specific Instructions

### macOS

```bash
# Install Node.js via Homebrew
brew install node

# Verify installation
node --version  # Should be 18.x or higher
npm --version   # Should be 9.x or higher

# Clone and build
git clone https://github.com/gabrielee5/kript.git
cd kript
npm install
npm run build
```

### Linux (Ubuntu/Debian)

```bash
# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Clone and build
git clone https://github.com/gabrielee5/kript.git
cd kript
npm install
npm run build
```

### Linux (Fedora/RHEL)

```bash
# Install Node.js via NodeSource
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Clone and build
git clone https://github.com/gabrielee5/kript.git
cd kript
npm install
npm run build
```

### Windows

1. Download and install Node.js from [nodejs.org](https://nodejs.org/)
2. Open PowerShell or Command Prompt
3. Run:

```powershell
# Clone the repository
git clone https://github.com/gabrielee5/kript.git
cd kript

# Install dependencies
npm install

# Build all packages
npm run build
```

## Verification

After installation, verify everything works:

```bash
# Test CLI
npm run cli -- --version

# Run tests
npm test

# Start web app
npm run dev
```

## Troubleshooting

### Node.js Version Issues

If you see errors about Node.js version:

```bash
# Check your Node.js version
node --version

# Use nvm to install the correct version
nvm install 20
nvm use 20
```

### Build Failures

If the build fails:

```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

### Permission Errors on Linux/macOS

If you get permission errors:

```bash
# Don't use sudo with npm
# Instead, fix npm permissions:
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Windows Path Issues

On Windows, if the CLI doesn't work:

1. Ensure Node.js is in your PATH
2. Try running from the project directory with `npm run cli`
3. Use PowerShell instead of Command Prompt

## Updating

To update to the latest version:

```bash
cd kript
git pull
npm install
npm run build
```

## Uninstallation

```bash
# Remove global CLI link (if installed)
npm unlink kript

# Remove the directory
cd ..
rm -rf kript
```
