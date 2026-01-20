# LocalPGP Examples

This directory contains example code demonstrating how to use LocalPGP.

## Running Examples

First, build the project:

```bash
cd /path/to/localpgp
npm install
npm run build
```

Then run an example:

```bash
npx ts-node examples/basic-usage.ts
```

## Available Examples

### basic-usage.ts

Demonstrates:
- Key pair generation
- Encrypting messages between users
- Decrypting messages
- Signing messages
- Verifying signatures
- Using the keyring

### file-encryption.ts

Demonstrates:
- Encrypting files
- Decrypting files
- Preserving filenames
- Signature verification on files

### symmetric-encryption.ts

Demonstrates:
- Password-based encryption (no keys needed)
- Password-based decryption
- Binary data encryption

## Common Patterns

### Generate a Key Pair

```typescript
import { generateKeyPair } from '@localpgp/core';

const keys = await generateKeyPair({
  algorithm: 'curve25519',
  userIds: [{ name: 'Your Name', email: 'you@example.com' }],
  passphrase: 'your-secure-passphrase',
});

// keys.publicKey - share this
// keys.privateKey - keep this secret!
// keys.revocationCertificate - store safely
```

### Encrypt for a Recipient

```typescript
import { encrypt } from '@localpgp/core';

const result = await encrypt({
  message: 'Secret message',
  encryptionKeys: [recipientPublicKey],
});
// result.data contains the encrypted message
```

### Decrypt a Message

```typescript
import { decrypt } from '@localpgp/core';

const result = await decrypt({
  message: encryptedMessage,
  decryptionKey: yourPrivateKey,
  passphrase: 'your-passphrase',
});
// result.data contains the decrypted message
```

### Sign a Message

```typescript
import { sign } from '@localpgp/core';

const result = await sign({
  message: 'Message to sign',
  signingKey: yourPrivateKey,
  passphrase: 'your-passphrase',
});
// result.data contains the signed message
```

### Verify a Signature

```typescript
import { verify } from '@localpgp/core';

const results = await verify({
  message: signedMessage,
  verificationKeys: [signerPublicKey],
});
// results[0].valid indicates if signature is valid
```
