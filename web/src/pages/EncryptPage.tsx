import { useState, useRef } from 'react';
import { Button, Card, TextArea, Select, Input, Alert, Spinner } from '../components/ui';
import { useKeyring } from '../hooks/useKeyring';
import { encrypt, encryptWithPassword } from '@kript/core';

export default function EncryptPage() {
  const { keys, loading } = useKeyring();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [message, setMessage] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [useSymmetric, setUseSymmetric] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [output, setOutput] = useState('');
  const [encrypting, setEncrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileData, setFileData] = useState<Uint8Array | null>(null);

  const publicKeys = keys.filter((k) => k.publicKey);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as ArrayBuffer;
      setFileData(new Uint8Array(result));
      setMessage('');
    };
    reader.readAsArrayBuffer(file);
  };

  const clearFile = () => {
    setFileName(null);
    setFileData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEncrypt = async () => {
    setError(null);
    setOutput('');

    if (!message && !fileData) {
      setError('Please enter a message or select a file');
      return;
    }

    if (useSymmetric) {
      if (!password) {
        setError('Please enter a password');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    } else {
      if (!selectedRecipient) {
        setError('Please select a recipient');
        return;
      }
    }

    try {
      setEncrypting(true);

      const dataToEncrypt = fileData || message;

      if (useSymmetric) {
        const encrypted = await encryptWithPassword(dataToEncrypt, password, true);
        setOutput(encrypted as string);
      } else {
        const recipient = keys.find((k) => k.fingerprint === selectedRecipient);
        if (!recipient) {
          setError('Recipient key not found');
          return;
        }

        const result = await encrypt({
          message: dataToEncrypt,
          encryptionKeys: [recipient.publicKey],
          armor: true,
        });

        setOutput(result.data as string);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Encryption failed');
    } finally {
      setEncrypting(false);
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
    a.download = fileName ? `${fileName}.pgp` : 'encrypted.asc';
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
        <h1 className="text-3xl md:text-4xl font-semibold leading-tight">Encrypt</h1>
        <p className="text-text-secondary mt-tiny text-sm md:text-base">Encrypt messages and files with PGP</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Input */}
        <Card>
          <h2 className="text-lg font-semibold mb-md">Input</h2>

          {error && <Alert variant="danger" className="mb-md">{error}</Alert>}

          {/* Mode Toggle */}
          <div className="flex gap-sm mb-md">
            <Button
              variant={!useSymmetric ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setUseSymmetric(false)}
            >
              Public Key
            </Button>
            <Button
              variant={useSymmetric ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setUseSymmetric(true)}
            >
              Password
            </Button>
          </div>

          {/* Recipient or Password */}
          {useSymmetric ? (
            <div className="flex flex-col gap-md mb-md">
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter encryption password"
              />
              <Input
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
              />
            </div>
          ) : (
            <div className="mb-md">
              {publicKeys.length === 0 ? (
                <Alert variant="warning">
                  No public keys available. Import or generate a key first.
                </Alert>
              ) : (
                <Select
                  label="Recipient"
                  value={selectedRecipient}
                  onChange={(e) => setSelectedRecipient(e.target.value)}
                  options={[
                    { value: '', label: 'Select recipient...' },
                    ...publicKeys.map((k) => ({
                      value: k.fingerprint,
                      label: `${k.keyInfo.userIds[0]?.email || k.keyId}`,
                    })),
                  ]}
                />
              )}
            </div>
          )}

          {/* Message or File */}
          {fileName ? (
            <div className="mb-md">
              <div className="text-xs text-text-secondary uppercase tracking-wide mb-tiny">
                File
              </div>
              <div className="flex items-center justify-between border border-border p-sm">
                <span className="text-sm">{fileName}</span>
                <Button variant="secondary" size="sm" onClick={clearFile}>
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <TextArea
              label="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter message to encrypt..."
              className="min-h-[200px] mb-md"
            />
          )}

          <div className="flex flex-col md:flex-row gap-md md:gap-sm">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              className="w-full md:w-auto"
            >
              Select File
            </Button>
            <Button onClick={handleEncrypt} loading={encrypting} className="w-full md:w-auto">
              Encrypt
            </Button>
          </div>
        </Card>

        {/* Output */}
        <Card>
          <h2 className="text-lg font-semibold mb-md">Output</h2>

          {output ? (
            <>
              <div className="bg-bg-secondary border border-border p-sm mb-md">
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-[400px]">
                  {output}
                </pre>
              </div>
              <div className="flex flex-col md:flex-row gap-md md:gap-sm">
                <Button variant="secondary" onClick={handleCopy} className="w-full md:w-auto">
                  Copy
                </Button>
                <Button variant="secondary" onClick={handleDownload} className="w-full md:w-auto">
                  Download
                </Button>
              </div>
            </>
          ) : (
            <div className="text-text-secondary text-sm">
              Encrypted output will appear here
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
