import { useState, useRef } from 'react';
import { Button, Card, TextArea, Select, Input, Alert, Spinner, Badge } from '../components/ui';
import { useKeyring } from '../hooks/useKeyring';
import { decrypt, decryptWithPassword, VerificationResult } from '@localpgp/core';

export default function DecryptPage() {
  const { keys, loading } = useKeyring();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [encryptedMessage, setEncryptedMessage] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [useSymmetric, setUseSymmetric] = useState(false);
  const [password, setPassword] = useState('');
  const [output, setOutput] = useState('');
  const [signatures, setSignatures] = useState<VerificationResult[]>([]);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const privateKeys = keys.filter((k) => k.privateKey);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setEncryptedMessage(reader.result as string);
    };
    reader.readAsText(file);
  };

  const handleDecrypt = async () => {
    setError(null);
    setOutput('');
    setSignatures([]);

    if (!encryptedMessage) {
      setError('Please enter or upload encrypted data');
      return;
    }

    try {
      setDecrypting(true);

      if (useSymmetric) {
        if (!password) {
          setError('Please enter a password');
          return;
        }
        const decrypted = await decryptWithPassword(encryptedMessage, password);
        setOutput(typeof decrypted === 'string' ? decrypted : new TextDecoder().decode(decrypted as Uint8Array));
      } else {
        if (!selectedKey) {
          setError('Please select a decryption key');
          return;
        }

        const keyEntry = keys.find((k) => k.fingerprint === selectedKey);
        if (!keyEntry?.privateKey) {
          setError('Private key not found');
          return;
        }

        // Get all public keys for signature verification
        const verificationKeys = keys.map((k) => k.publicKey);

        const result = await decrypt({
          message: encryptedMessage,
          decryptionKey: keyEntry.privateKey,
          passphrase: passphrase || undefined,
          verificationKeys,
        });

        const data = result.data;
        setOutput(typeof data === 'string' ? data : new TextDecoder().decode(data as Uint8Array));
        setSignatures(result.signatures);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decryption failed');
    } finally {
      setDecrypting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
  };

  const handleDownload = () => {
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName ? fileName.replace(/\.pgp$|\.asc$|\.gpg$/, '') : 'decrypted.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-2xl">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-xl">
        <h1 className="text-4xl font-semibold leading-tight">Decrypt</h1>
        <p className="text-text-secondary mt-tiny">Decrypt PGP encrypted messages and files</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Input */}
        <Card>
          <h2 className="text-lg font-semibold mb-md">Encrypted Data</h2>

          {error && <Alert variant="danger" className="mb-md">{error}</Alert>}

          {/* Mode Toggle */}
          <div className="flex gap-sm mb-md">
            <Button
              variant={!useSymmetric ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setUseSymmetric(false)}
            >
              Private Key
            </Button>
            <Button
              variant={useSymmetric ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setUseSymmetric(true)}
            >
              Password
            </Button>
          </div>

          {/* Key or Password */}
          {useSymmetric ? (
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter decryption password"
              className="mb-md"
            />
          ) : (
            <div className="flex flex-col gap-md mb-md">
              {privateKeys.length === 0 ? (
                <Alert variant="warning">
                  No private keys available. Import or generate a key first.
                </Alert>
              ) : (
                <Select
                  label="Decryption Key"
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  options={[
                    { value: '', label: 'Select key...' },
                    ...privateKeys.map((k) => ({
                      value: k.fingerprint,
                      label: `${k.keyInfo.userIds[0]?.email || k.keyId}`,
                    })),
                  ]}
                />
              )}
              <Input
                label="Passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter key passphrase"
              />
            </div>
          )}

          <TextArea
            label="Encrypted Message"
            value={encryptedMessage}
            onChange={(e) => setEncryptedMessage(e.target.value)}
            placeholder="Paste encrypted PGP message here..."
            className="min-h-[200px] mb-md"
          />

          <div className="flex gap-sm">
            <input
              ref={fileInputRef}
              type="file"
              accept=".asc,.pgp,.gpg"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Select File
            </Button>
            <Button onClick={handleDecrypt} loading={decrypting}>
              Decrypt
            </Button>
          </div>
        </Card>

        {/* Output */}
        <Card>
          <h2 className="text-lg font-semibold mb-md">Decrypted Output</h2>

          {/* Signature verification results */}
          {signatures.length > 0 && (
            <div className="mb-md">
              {signatures.map((sig, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-sm p-sm border mb-tiny ${
                    sig.valid
                      ? 'bg-success-bg border-success-border'
                      : 'bg-danger-bg border-danger-border'
                  }`}
                >
                  {sig.valid ? (
                    <svg className="w-5 h-5 text-success-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="square" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-danger-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="square" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className={`text-sm ${sig.valid ? 'text-success-text' : 'text-danger-text'}`}>
                    {sig.valid ? 'Valid signature' : 'Invalid signature'} from {sig.signedBy?.email || sig.keyId}
                  </span>
                </div>
              ))}
            </div>
          )}

          {output ? (
            <>
              <div className="bg-bg-secondary border border-border p-sm mb-md">
                <pre className="text-sm overflow-x-auto whitespace-pre-wrap break-all max-h-[400px]">
                  {output}
                </pre>
              </div>
              <div className="flex gap-sm">
                <Button variant="secondary" onClick={handleCopy}>
                  Copy
                </Button>
                <Button variant="secondary" onClick={handleDownload}>
                  Download
                </Button>
              </div>
            </>
          ) : (
            <div className="text-text-secondary text-sm">
              Decrypted output will appear here
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
