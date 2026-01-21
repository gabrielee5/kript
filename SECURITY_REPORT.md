# Kript Security Audit Report

**Date:** January 21, 2026
**Auditor:** Claude Code Security Analysis
**Target:** Kript v1.0.0 - Local-first PGP encryption tool
**Scope:** Full codebase (core, cli, web packages)

---

## Executive Summary

This security audit of the Kript application reveals **4 critical**, **5 high**, **10 medium**, and **4 low** severity vulnerabilities. The most serious issues involve unencrypted storage of private keys in browser storage and improper handling of sensitive data in memory.

While the application uses sound cryptographic primitives (OpenPGP.js) and the React frontend shows no direct XSS vulnerabilities, the operational security implementation requires significant hardening before production deployment.

---

## Vulnerability Summary

| ID | Severity | Category | Description | Location |
|----|----------|----------|-------------|----------|
| KRIPT-001 | CRITICAL | Storage | Unencrypted private keys in browser storage | `core/src/keyring.ts:71-84, 162` |
| KRIPT-002 | CRITICAL | Memory | Passphrases never cleared from memory | `core/src/keys.ts:317`, `encrypt.ts:96-100`, `sign.ts:71-77` |
| KRIPT-003 | CRITICAL | Storage | Plaintext backup export | `core/src/keyring.ts:281-283` |
| KRIPT-004 | CRITICAL | Input | Path traversal in CLI storage | `cli/src/storage.ts:33-36` |
| KRIPT-005 | HIGH | DoS | No file size limits | `web/src/pages/*.tsx`, `core/src/encrypt.ts:38-61` |
| KRIPT-006 | HIGH | Crypto | Key ID collision vulnerability | `core/src/sign.ts:213, 274` |
| KRIPT-007 | HIGH | Headers | Missing security headers | `web/server.js` |
| KRIPT-008 | HIGH | Config | Source maps enabled in production | `web/vite.config.ts:14` |
| KRIPT-009 | HIGH | Timing | Timing attack in key matching | `core/src/sign.ts:213`, `keyring.ts:146` |
| KRIPT-010 | MEDIUM | Validation | Weak email validation | `core/src/utils.ts:113-116` |
| KRIPT-011 | MEDIUM | Crypto | RSA-2048 still supported | `core/src/keys.ts:30-31` |
| KRIPT-012 | MEDIUM | RNG | Modulo bias in ID generation | `core/src/utils.ts:105` |
| KRIPT-013 | MEDIUM | Auth | No passphrase strength enforcement | `core/src/utils.ts:122-159` |
| KRIPT-014 | MEDIUM | Config | OpenPGP.js unconfigured | Multiple files |
| KRIPT-015 | MEDIUM | Input | Unsafe filename in download | `web/src/pages/DecryptPage.tsx:97` |
| KRIPT-016 | MEDIUM | Input | parseInt without validation | `cli/src/commands/generate.ts:115` |
| KRIPT-017 | MEDIUM | Crypto | No key expiration enforcement | `core/src/encrypt.ts:66-141` |
| KRIPT-018 | MEDIUM | Input | Unicode normalization missing | `core/src/utils.ts:23-37` |
| KRIPT-019 | MEDIUM | Input | Prototype pollution risk | `core/src/keyring.ts:34-56, 290` |
| KRIPT-020 | LOW | Auth | No rate limiting on decryption | `core/src/keys.ts:315-336` |
| KRIPT-021 | LOW | Error | Stream error handling missing | `core/src/encrypt.ts:20-33` |
| KRIPT-022 | LOW | Config | Test credentials hardcoded | `core/src/keys.test.ts` |
| KRIPT-023 | LOW | Input | Hex conversion validation | `core/src/utils.ts:204-210` |

---

## Critical Vulnerabilities (KRIPT-001 to KRIPT-004)

### KRIPT-001: Unencrypted Private Keys in Browser Storage

**Severity:** CRITICAL
**CVSS Score:** 9.1
**CWE:** CWE-312 (Cleartext Storage of Sensitive Information)

**Description:**
Private keys are stored in plaintext in browser localStorage/IndexedDB. The `KeyringEntry` interface stores the `privateKey` field as an unencrypted string, making it accessible to any JavaScript running on the page.

**Affected Code:**
```typescript
// core/src/keyring.ts:162
export interface KeyringEntry {
  keyId: string;
  fingerprint: string;
  publicKey: string;
  privateKey?: string;  // STORED IN PLAINTEXT
  keyInfo: KeyInfo;
  addedAt: Date;
  lastUsed?: Date;
}

// core/src/keyring.ts:71-84 - save() writes unencrypted JSON
async save(): Promise<void> {
  const data: Record<string, KeyringEntry> = {};
  for (const [key, entry] of this.entries) {
    data[key] = entry;  // privateKey included as plaintext
  }
  await this.storage.save(KEYRING_STORAGE_KEY, JSON.stringify(data));
}
```

**Impact:**
- Any XSS vulnerability would expose all private keys
- Malicious browser extensions can read localStorage/IndexedDB
- Physical access to the machine allows key extraction via browser dev tools
- Browser sync features may upload keys to cloud services

**Remediation:**
1. Encrypt private keys using AES-256-GCM before storage
2. Derive encryption key from master passphrase using PBKDF2 (100,000+ iterations)
3. Store only the encrypted form with IV and authentication tag
4. Require master passphrase on application start

---

### KRIPT-002: Passphrases Never Cleared from Memory

**Severity:** CRITICAL
**CVSS Score:** 7.5
**CWE:** CWE-316 (Cleartext Storage in Memory)

**Description:**
Passphrase strings are never cleared after use. The application defines a `secureClear()` function but never calls it. JavaScript strings are immutable, meaning the original passphrase persists in memory until garbage collection.

**Affected Code:**
```typescript
// core/src/keys.ts:317
const decrypted = await openpgp.decryptKey({
  privateKey: key,
  passphrase,  // Never cleared after use
});

// core/src/utils.ts:177-190 - Function exists but is NEVER CALLED
export function secureClear(str: string): void {
  if (typeof str === 'string' && str.length > 0) {
    const arr = str.split('');
    for (let i = 0; i < arr.length; i++) {
      arr[i] = '\0';
    }
  }
}
```

**Impact:**
- Memory dumps can reveal passphrases
- Debugging tools can extract sensitive data
- Swap files may contain passphrases

**Remediation:**
1. Use try/finally blocks to ensure cleanup
2. Convert passphrases to Uint8Array for better clearing
3. Call secureClear() or equivalent after every use
4. Document JavaScript memory limitations

---

### KRIPT-003: Plaintext Backup Export

**Severity:** CRITICAL
**CVSS Score:** 8.2
**CWE:** CWE-312 (Cleartext Storage of Sensitive Information)

**Description:**
The `exportAll()` function exports the entire keyring, including private keys, as unencrypted JSON.

**Affected Code:**
```typescript
// core/src/keyring.ts:281-283
async exportAll(): Promise<string> {
  await this.ensureLoaded();
  return JSON.stringify(Object.fromEntries(this.entries));
  // Exports private keys as PLAINTEXT!
}
```

**Impact:**
- Backup files contain unencrypted private keys
- Users unknowingly save sensitive data to disk
- Backup files may be synced to cloud storage

**Remediation:**
1. Always encrypt exports with a user-provided passphrase
2. Use a secure format (encrypted JSON or standard encrypted backup format)
3. Warn users about the sensitivity of backup files

---

### KRIPT-004: Path Traversal in CLI Storage

**Severity:** CRITICAL
**CVSS Score:** 8.8
**CWE:** CWE-22 (Path Traversal)

**Description:**
The CLI storage adapter concatenates user-controlled key names directly into file paths without validation, allowing path traversal attacks.

**Affected Code:**
```typescript
// cli/src/storage.ts:33-36
async save(key: string, value: string): Promise<void> {
  await ensureConfigDir();
  const filePath = join(this.dir, `${key}.json`);  // NO VALIDATION
  await fs.writeFile(filePath, value, 'utf-8');
}
```

**Attack Vector:**
```javascript
key = "../../../etc/cron.d/malicious"
// Results in: ~/.kript/../../../etc/cron.d/malicious.json
```

**Impact:**
- Write arbitrary files outside .kript directory
- Potential privilege escalation via cron jobs or config files
- Data corruption or system compromise

**Remediation:**
1. Validate key names against a whitelist pattern (alphanumeric + limited chars)
2. Use path.resolve() and verify result is within config directory
3. Hash key names before using as filenames

---

## High Vulnerabilities (KRIPT-005 to KRIPT-009)

### KRIPT-005: No File Size Limits (DoS)

**Severity:** HIGH
**CWE:** CWE-400 (Uncontrolled Resource Consumption)

**Affected Code:**
```typescript
// web/src/pages/EncryptPage.tsx:23-35
reader.readAsArrayBuffer(file);  // No size check

// core/src/encrypt.ts:38-61
while (!done) {
  chunks.push(result.value);
  totalLength += result.value.length;  // Unbounded accumulation
}
```

**Remediation:** Add file size validation (e.g., 50MB max) before processing.

---

### KRIPT-006: Key ID Collision Vulnerability

**Severity:** HIGH
**CWE:** CWE-327 (Use of Broken Crypto Algorithm)

**Affected Code:**
```typescript
// core/src/sign.ts:213
if (fingerprint.endsWith(sigKeyId)) {
  signedBy = getPrimaryUserId(pubKey);
  break;  // First match wins
}
```

**Remediation:** Use full 160-bit fingerprints instead of 8-byte key IDs.

---

### KRIPT-007: Missing Security Headers

**Severity:** HIGH
**CWE:** CWE-693 (Protection Mechanism Failure)

**Affected Code:**
```javascript
// web/server.js - No security headers
app.use(express.static(join(__dirname, 'dist')));
```

**Missing Headers:**
- Content-Security-Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security
- X-XSS-Protection: 1; mode=block

---

### KRIPT-008: Source Maps in Production

**Severity:** HIGH
**CWE:** CWE-200 (Information Exposure)

**Affected Code:**
```typescript
// web/vite.config.ts:14
build: {
  sourcemap: true,  // Exposes source code
}
```

**Remediation:** Set `sourcemap: false` for production builds.

---

### KRIPT-009: Timing Attack in Key Matching

**Severity:** HIGH
**CWE:** CWE-208 (Observable Timing Discrepancy)

**Affected Code:**
```typescript
// core/src/sign.ts:213
if (fingerprint.endsWith(sigKeyId))  // Timing-dependent

// core/src/utils.ts:164-174 - EXISTS BUT NEVER USED
export function constantTimeCompare(a: string, b: string): boolean
```

**Remediation:** Use the existing `constantTimeCompare()` function for all security-sensitive comparisons.

---

## Medium Vulnerabilities (KRIPT-010 to KRIPT-019)

| ID | Issue | Remediation |
|----|-------|-------------|
| KRIPT-010 | Weak email regex allows invalid formats | Use RFC 5322 compliant validation |
| KRIPT-011 | RSA-2048 cryptographically weak for long-term | Deprecate, default to curve25519 |
| KRIPT-012 | Modulo bias: `256 % 62 = 6` | Use rejection sampling |
| KRIPT-013 | No entropy estimation in passphrase check | Implement zxcvbn-style validation |
| KRIPT-014 | Default OpenPGP.js config | Set S2K iterations to max (255) |
| KRIPT-015 | User filename used in download | Sanitize filename characters |
| KRIPT-016 | parseInt without bounds check | Validate range and type |
| KRIPT-017 | Expired keys usable for encryption | Call validateKey() before use |
| KRIPT-018 | No Unicode normalization | Apply NFC normalization |
| KRIPT-019 | JSON.parse without proto check | Use Object.create(null) or sanitize |

---

## Low Vulnerabilities (KRIPT-020 to KRIPT-023)

| ID | Issue | Remediation |
|----|-------|-------------|
| KRIPT-020 | Unlimited decryption attempts | Add rate limiting/delay |
| KRIPT-021 | No stream timeout | Add timeout mechanism |
| KRIPT-022 | Weak test passphrases | Use env vars or strong test values |
| KRIPT-023 | Invalid hex produces NaN | Validate hex format before conversion |

---

## Positive Security Findings

1. **No XSS Vulnerabilities:** No use of `dangerouslySetInnerHTML`, `innerHTML`, or `document.write`
2. **React Auto-Escaping:** JSX properly escapes user content
3. **Modern Crypto Library:** OpenPGP.js v5.11.0 is current
4. **Local-First Architecture:** No data sent to external servers
5. **TypeScript:** Strong typing catches many bugs at compile time

---

## Remediation Priority

### Phase 1: CRITICAL (Immediate - This Sprint)
1. KRIPT-001: Encrypt stored private keys
2. KRIPT-002: Implement passphrase clearing
3. KRIPT-003: Encrypt backup exports
4. KRIPT-004: Sanitize storage key paths

### Phase 2: HIGH (Next 2 Weeks)
1. KRIPT-005: Add file size limits
2. KRIPT-007: Add security headers
3. KRIPT-008: Disable source maps
4. KRIPT-009: Use constant-time comparison

### Phase 3: MEDIUM (Next Month)
- Address remaining medium-severity issues

---

## Testing Requirements

Each fix must include:
1. Unit tests for the specific vulnerability
2. Integration tests for affected workflows
3. Manual verification of the fix
4. Regression testing of existing functionality

---

## Compliance Notes

- **OWASP Top 10 2021:** Addresses A02 (Cryptographic Failures), A03 (Injection), A05 (Misconfiguration)
- **CWE Top 25:** Addresses CWE-312, CWE-22, CWE-327, CWE-400
- **Not suitable for:** Highly regulated environments (HIPAA, PCI-DSS) without all fixes implemented

---

## Conclusion

The Kript application shows solid architectural decisions but requires critical security hardening before production deployment. The unencrypted storage of private keys (KRIPT-001) is the most severe issue and must be addressed immediately. With the recommended fixes, the application can provide strong security for personal encryption use cases.
