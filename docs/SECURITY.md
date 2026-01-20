# Security Guide

## Overview

LocalPGP is designed with security as a primary concern. This document outlines our security model, best practices, and known limitations.

## Threat Model

### What LocalPGP Protects Against

1. **Eavesdropping** - Encrypted messages cannot be read by third parties
2. **Tampering** - Signed messages cannot be modified without detection
3. **Impersonation** - Digital signatures prove the identity of the signer
4. **Key Compromise** - Passphrase-protected private keys require the passphrase to use

### What LocalPGP Does NOT Protect Against

1. **Compromised Endpoints** - If your device is compromised, an attacker may access keys in memory
2. **Social Engineering** - Users may be tricked into trusting malicious keys
3. **Side-Channel Attacks** - Timing attacks and other hardware-level attacks
4. **Key Management Errors** - Lost keys, forgotten passphrases, etc.

## Security Features

### Cryptographic Algorithms

- **RSA 2048** - Minimum recommended key size for RSA
- **RSA 4096** - High security RSA option
- **Curve25519** - Modern elliptic curve cryptography (recommended)
- **AES-256** - Symmetric encryption for message content
- **SHA-256** - Cryptographic hashing

### Key Storage

**CLI:**
- Keys stored in `~/.localpgp/` directory
- Private keys are encrypted with user passphrase
- File permissions should be set to 600 (owner read/write only)

**Web:**
- Keys stored in browser IndexedDB
- Private keys are encrypted with user passphrase
- Data never leaves the browser
- Cleared on browser data clear

### No External Communication

LocalPGP operates entirely offline:
- No telemetry or analytics
- No automatic updates
- No key server integration by default
- No cloud backup

## Best Practices

### Key Generation

1. **Use Strong Passphrases**
   - Minimum 12 characters
   - Mix of uppercase, lowercase, numbers, and symbols
   - Consider using a password manager

2. **Choose Appropriate Algorithm**
   - Curve25519 for most use cases (modern, fast, secure)
   - RSA 4096 for maximum compatibility and security
   - RSA 2048 only if required for compatibility

3. **Set Key Expiration**
   - Recommended: 1-2 years
   - Forces regular key rotation
   - Limits damage from key compromise

### Key Management

1. **Backup Your Private Keys**
   - Store in multiple secure locations
   - Consider encrypted USB drives
   - Store revocation certificate separately

2. **Verify Key Fingerprints**
   - Always verify out-of-band before trusting
   - Use secure channels (in-person, phone call)
   - Don't trust fingerprints received over email

3. **Revoke Compromised Keys**
   - Generate revocation certificate when creating key
   - Store revocation certificate securely
   - Publish revocation immediately if compromised

### Operational Security

1. **Secure Your Environment**
   - Use on trusted devices only
   - Keep operating system and browser updated
   - Use full-disk encryption

2. **Clear Sensitive Data**
   - Close browser/terminal after use
   - Clear clipboard after copying keys
   - Don't leave unlocked keys in memory

3. **Verify Before Decrypting**
   - Be suspicious of unexpected encrypted messages
   - Verify sender identity before acting on content
   - Malicious files can be encrypted too

## Known Limitations

### Browser Security Model

The web interface runs in a browser sandbox with limitations:

1. **Memory Protection** - JavaScript cannot guarantee memory clearing
2. **Browser Extensions** - Malicious extensions could access data
3. **Local Storage** - Data persists until explicitly cleared
4. **Cross-Site Scripting** - Potential XSS vulnerabilities in browsers

**Mitigation:** For high-security use cases, prefer the CLI tool.

### Cryptographic Limitations

1. **No Perfect Forward Secrecy** - PGP doesn't provide PFS
2. **Metadata Exposure** - Key IDs may be visible in encrypted messages
3. **Timing Attacks** - JavaScript timing is not constant-time

### Implementation Notes

1. **OpenPGP.js** - We use the widely audited OpenPGP.js library
2. **No Custom Crypto** - We don't implement any cryptographic primitives
3. **Security Updates** - Keep dependencies updated for security patches

## Security Checklist

### Before Using LocalPGP

- [ ] Generated keys on a trusted device
- [ ] Used a strong passphrase
- [ ] Backed up private key securely
- [ ] Stored revocation certificate separately
- [ ] Set appropriate key expiration

### When Exchanging Keys

- [ ] Verified fingerprint out-of-band
- [ ] Used secure channel for verification
- [ ] Didn't trust fingerprints from email/chat

### During Regular Use

- [ ] Cleared clipboard after use
- [ ] Closed application when done
- [ ] Kept software updated
- [ ] Monitored for suspicious activity

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** disclose publicly
2. Email security@yourdomain.com
3. Include detailed reproduction steps
4. Allow reasonable time for fix before disclosure

## Audit Status

LocalPGP has not undergone a formal security audit. While we follow security best practices and use well-audited libraries, users requiring certified security should wait for formal audit completion.

## References

- [OpenPGP.js Security Considerations](https://github.com/openpgpjs/openpgpjs/blob/main/README.md#security)
- [RFC 4880 - OpenPGP Message Format](https://tools.ietf.org/html/rfc4880)
- [NIST Key Management Guidelines](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)
