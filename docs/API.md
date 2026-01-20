# API Reference

## CLI Commands

### Key Generation

```bash
localpgp generate [options]
```

Generate a new PGP key pair.

**Options:**
- `-n, --name <name>` - Your name
- `-e, --email <email>` - Your email address
- `-c, --comment <comment>` - Comment for the key
- `-a, --algorithm <algorithm>` - Key algorithm (rsa2048, rsa4096, ecc, curve25519)
- `--expires <days>` - Key expiration in days (0 = never)
- `--no-passphrase` - Generate key without passphrase

**Examples:**
```bash
# Interactive generation
localpgp generate

# Non-interactive with options
localpgp generate -n "John Doe" -e "john@example.com" -a curve25519
```

### Encryption

```bash
localpgp encrypt [file] [options]
```

Encrypt a message or file.

**Options:**
- `-r, --recipient <keyid>` - Recipient key ID (can use multiple times)
- `-o, --output <file>` - Output file
- `-a, --armor` - Output ASCII armored text (default)
- `--binary` - Output binary format
- `-s, --sign` - Sign the message
- `--sign-key <keyid>` - Key ID to sign with
- `-c, --symmetric` - Use symmetric encryption with password

**Examples:**
```bash
# Encrypt to recipient
localpgp encrypt -r bob@example.com message.txt -o message.txt.pgp

# Encrypt with password
localpgp encrypt -c secret.txt -o secret.txt.pgp

# Encrypt and sign
localpgp encrypt -r bob@example.com -s message.txt

# Encrypt from stdin
echo "Secret message" | localpgp encrypt -r bob@example.com
```

### Decryption

```bash
localpgp decrypt [file] [options]
```

Decrypt a message or file.

**Options:**
- `-o, --output <file>` - Output file
- `-k, --key <keyid>` - Decryption key ID
- `-c, --symmetric` - Use symmetric decryption with password

**Examples:**
```bash
# Decrypt file
localpgp decrypt message.txt.pgp -o message.txt

# Decrypt with specific key
localpgp decrypt -k ABCD1234 message.txt.pgp

# Decrypt password-protected
localpgp decrypt -c secret.txt.pgp
```

### Signing

```bash
localpgp sign [file] [options]
```

Sign a message or file.

**Options:**
- `-o, --output <file>` - Output file
- `-k, --key <keyid>` - Signing key ID
- `-d, --detached` - Create detached signature
- `-a, --armor` - Output ASCII armored text (default)

**Examples:**
```bash
# Sign a file
localpgp sign document.txt -o document.txt.sig

# Create detached signature
localpgp sign -d document.txt -o document.txt.sig

# Sign from stdin
echo "Important message" | localpgp sign
```

### Verification

```bash
localpgp verify [file] [options]
```

Verify a signature.

**Options:**
- `-s, --signature <file>` - Detached signature file
- `--show-message` - Display the signed message content

**Examples:**
```bash
# Verify signed message
localpgp verify signed-message.asc

# Verify detached signature
localpgp verify document.txt -s document.txt.sig
```

### Key Management

#### List Keys

```bash
localpgp list-keys [options]
```

**Options:**
- `-v, --verbose` - Show detailed key information
- `--public` - Show only public keys
- `--private` - Show only private keys

#### Import Key

```bash
localpgp import-key [file]
```

Import a key from file or stdin.

```bash
# From file
localpgp import-key pubkey.asc

# From stdin
cat pubkey.asc | localpgp import-key
```

#### Export Key

```bash
localpgp export-key <keyid> [options]
```

**Options:**
- `-o, --output <file>` - Output file
- `--private` - Export private key

```bash
# Export public key
localpgp export-key john@example.com -o pubkey.asc

# Export private key (use with caution!)
localpgp export-key john@example.com --private -o privkey.asc
```

#### Delete Key

```bash
localpgp delete-key <keyid> [options]
```

**Options:**
- `-f, --force` - Skip confirmation

#### Search Keys

```bash
localpgp search <query>
```

Search keys by name or email.

#### Revoke Key

```bash
localpgp revoke <keyid> [options]
```

Generate a revocation certificate.

**Options:**
- `-o, --output <file>` - Output file
- `-r, --reason <reason>` - Reason for revocation

---

## Programmatic API

### Core Module

```typescript
import {
  generateKeyPair,
  encrypt,
  decrypt,
  sign,
  verify,
  Keyring,
  IndexedDBStorageAdapter,
} from '@localpgp/core';
```

### Key Generation

```typescript
import { generateKeyPair } from '@localpgp/core';

const result = await generateKeyPair({
  algorithm: 'curve25519', // or 'rsa2048', 'rsa4096'
  userIds: [{ name: 'John Doe', email: 'john@example.com' }],
  passphrase: 'optional-passphrase',
  expirationTime: 365 * 24 * 60 * 60, // 1 year in seconds
});

console.log(result.publicKey);
console.log(result.privateKey);
console.log(result.revocationCertificate);
console.log(result.keyInfo);
```

### Encryption

```typescript
import { encrypt, decrypt } from '@localpgp/core';

// Encrypt
const encrypted = await encrypt({
  message: 'Secret message',
  encryptionKeys: [recipientPublicKey],
  signingKey: senderPrivateKey, // optional
  signingKeyPassphrase: 'passphrase', // if signing key is encrypted
});

// Decrypt
const decrypted = await decrypt({
  message: encrypted.data,
  decryptionKey: recipientPrivateKey,
  passphrase: 'passphrase',
  verificationKeys: [senderPublicKey], // optional, for signature verification
});

console.log(decrypted.data);
console.log(decrypted.signatures);
```

### Signing

```typescript
import { sign, verify } from '@localpgp/core';

// Sign
const signed = await sign({
  message: 'Message to sign',
  signingKey: privateKey,
  passphrase: 'passphrase',
  detached: false, // true for detached signature
});

// Verify
const results = await verify({
  message: signed.data,
  verificationKeys: [publicKey],
});

console.log(results[0].valid);
console.log(results[0].signedBy);
```

### Keyring Management

```typescript
import { Keyring, IndexedDBStorageAdapter } from '@localpgp/core';

// Create keyring with browser storage
const storage = new IndexedDBStorageAdapter();
const keyring = new Keyring(storage);
await keyring.load();

// Add a key
await keyring.addKey(publicKey, privateKey);

// Get a key
const entry = await keyring.getKey('fingerprint-or-keyid');

// Search keys
const results = await keyring.searchKeys('john@example.com');

// Delete a key
await keyring.deleteKey('fingerprint');

// Get stats
const stats = await keyring.getStats();
```

### Types

```typescript
interface KeyGenerationOptions {
  algorithm: 'rsa2048' | 'rsa4096' | 'ecc' | 'curve25519';
  userIds: UserId[];
  passphrase?: string;
  expirationTime?: number;
}

interface UserId {
  name: string;
  email: string;
  comment?: string;
}

interface KeyInfo {
  keyId: string;
  fingerprint: string;
  algorithm: string;
  bitLength?: number;
  curve?: string;
  creationTime: Date;
  expirationTime?: Date;
  userIds: UserId[];
  revoked: boolean;
  isPrivate: boolean;
  subkeys: SubkeyInfo[];
}

interface EncryptOptions {
  message: string | Uint8Array;
  encryptionKeys: string[];
  signingKey?: string;
  signingKeyPassphrase?: string;
  armor?: boolean;
}

interface DecryptOptions {
  message: string | Uint8Array;
  decryptionKey: string;
  passphrase?: string;
  verificationKeys?: string[];
}

interface SignOptions {
  message: string | Uint8Array;
  signingKey: string;
  passphrase?: string;
  detached?: boolean;
  armor?: boolean;
}

interface VerifyOptions {
  message: string | Uint8Array;
  signature?: string | Uint8Array;
  verificationKeys: string[];
}

interface VerificationResult {
  valid: boolean;
  keyId: string;
  fingerprint?: string;
  signedBy?: UserId;
  signatureTime?: Date;
  error?: string;
}
```
