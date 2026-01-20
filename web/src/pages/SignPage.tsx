import { useState, useRef } from 'react';
import { Button, Card, TextArea, Select, Input, Alert, Spinner } from '../components/ui';
import { useKeyring } from '../hooks/useKeyring';
import { sign } from '@localpgp/core';

export default function SignPage() {
  const { keys, loading } = useKeyring();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [message, setMessage] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [detached, setDetached] = useState(false);
  const [output, setOutput] = useState('');
  const [signature, setSignature] = useState('');
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileData, setFileData] = useState<Uint8Array | null>(null);

  const privateKeys = keys.filter((k) => k.privateKey);

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

  const handleSign = async () => {
    setError(null);
    setOutput('');
    setSignature('');

    if (!message && !fileData) {
      setError('Please enter a message or select a file');
      return;
    }

    if (!selectedKey) {
      setError('Please select a signing key');
      return;
    }

    try {
      setSigning(true);

      const keyEntry = keys.find((k) => k.fingerprint === selectedKey);
      if (!keyEntry?.privateKey) {
        setError('Private key not found');
        return;
      }

      const dataToSign = fileData || message;

      const result = await sign({
        message: dataToSign,
        signingKey: keyEntry.privateKey,
        passphrase: passphrase || undefined,
        detached,
        armor: true,
      });

      if (detached) {
        setOutput(typeof dataToSign === 'string' ? dataToSign : new TextDecoder().decode(dataToSign));
        setSignature(result.signature as string);
      } else {
        setOutput(result.data as string);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signing failed');
    } finally {
      setSigning(false);
    }
  };

  const handleCopyOutput = () => {
    navigator.clipboard.writeText(detached ? signature : output);
  };

  const handleDownloadOutput = () => {
    const content = detached ? signature : output;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName ? `${fileName}.sig` : 'signed.asc';
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
        <h1 className="text-4xl font-semibold leading-tight">Sign</h1>
        <p className="text-text-secondary mt-tiny">Create digital signatures for messages and files</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Input */}
        <Card>
          <h2 className="text-lg font-semibold mb-md">Input</h2>

          {error && <Alert variant="danger" className="mb-md">{error}</Alert>}

          {/* Signing Key */}
          {privateKeys.length === 0 ? (
            <Alert variant="warning" className="mb-md">
              No private keys available. Import or generate a key first.
            </Alert>
          ) : (
            <Select
              label="Signing Key"
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              options={[
                { value: '', label: 'Select key...' },
                ...privateKeys.map((k) => ({
                  value: k.fingerprint,
                  label: `${k.keyInfo.userIds[0]?.email || k.keyId}`,
                })),
              ]}
              className="mb-md"
            />
          )}

          <Input
            label="Passphrase"
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Enter key passphrase"
            className="mb-md"
          />

          {/* Detached toggle */}
          <div className="flex items-center gap-sm mb-md">
            <input
              type="checkbox"
              id="detached"
              checked={detached}
              onChange={(e) => setDetached(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="detached" className="text-sm">
              Create detached signature
            </label>
          </div>

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
              placeholder="Enter message to sign..."
              className="min-h-[200px] mb-md"
            />
          )}

          <div className="flex gap-sm">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Select File
            </Button>
            <Button onClick={handleSign} loading={signing}>
              Sign
            </Button>
          </div>
        </Card>

        {/* Output */}
        <Card>
          <h2 className="text-lg font-semibold mb-md">
            {detached ? 'Signature' : 'Signed Message'}
          </h2>

          {(output || signature) ? (
            <>
              <div className="bg-bg-secondary border border-border p-sm mb-md">
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-[400px]">
                  {detached ? signature : output}
                </pre>
              </div>
              <div className="flex gap-sm">
                <Button variant="secondary" onClick={handleCopyOutput}>
                  Copy
                </Button>
                <Button variant="secondary" onClick={handleDownloadOutput}>
                  Download
                </Button>
              </div>
            </>
          ) : (
            <div className="text-text-secondary text-sm">
              {detached ? 'Detached signature' : 'Signed message'} will appear here
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
