import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, TextArea, Select, Input, Alert, Spinner } from '../components/ui';
import { useKeyring } from '../hooks/useKeyring';
import { sign } from '@kript/core';

export default function SignPage() {
  const { t } = useTranslation();
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
      setError(t('sign.errors.noInput'));
      return;
    }

    if (!selectedKey) {
      setError(t('sign.errors.noKey'));
      return;
    }

    try {
      setSigning(true);

      const keyEntry = keys.find((k) => k.fingerprint === selectedKey);
      if (!keyEntry?.privateKey) {
        setError(t('sign.errors.privateKeyNotFound'));
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
      setError(err instanceof Error ? err.message : t('sign.errors.signingFailed'));
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
        <h1 className="text-3xl md:text-4xl font-semibold leading-tight">{t('sign.title')}</h1>
        <p className="text-text-secondary mt-tiny text-sm md:text-base">{t('sign.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Input */}
        <Card>
          <h2 className="text-lg font-semibold mb-md">{t('sign.input')}</h2>

          {error && <Alert variant="danger" className="mb-md">{error}</Alert>}

          {/* Signing Key */}
          {privateKeys.length === 0 ? (
            <Alert variant="warning" className="mb-md">
              {t('sign.noPrivateKeys')}
            </Alert>
          ) : (
            <Select
              label={t('sign.signingKey')}
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              options={[
                { value: '', label: t('sign.selectKey') },
                ...privateKeys.map((k) => ({
                  value: k.fingerprint,
                  label: `${k.keyInfo.userIds[0]?.email || k.keyId}`,
                })),
              ]}
              className="mb-md"
            />
          )}

          <Input
            label={t('common.passphrase')}
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder={t('sign.enterPassphrase')}
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
              {t('sign.createDetached')}
            </label>
          </div>

          {/* Message or File */}
          {fileName ? (
            <div className="mb-md">
              <div className="text-sm text-text-secondary uppercase tracking-wide mb-tiny">
                {t('common.file')}
              </div>
              <div className="flex items-center justify-between border border-border p-sm">
                <span className="text-sm">{fileName}</span>
                <Button variant="secondary" size="sm" onClick={clearFile}>
                  {t('common.remove')}
                </Button>
              </div>
            </div>
          ) : (
            <TextArea
              label={t('common.message')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('sign.messagePlaceholder')}
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
              {t('common.selectFile')}
            </Button>
            <Button onClick={handleSign} loading={signing} className="w-full md:w-auto">
              {t('common.sign')}
            </Button>
          </div>
        </Card>

        {/* Output */}
        <Card>
          <h2 className="text-lg font-semibold mb-md">
            {detached ? t('sign.signatureTitle') : t('sign.outputTitle')}
          </h2>

          {(output || signature) ? (
            <>
              <div className="bg-bg-secondary border border-border p-sm mb-md">
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-[400px]">
                  {detached ? signature : output}
                </pre>
              </div>
              <div className="flex flex-col md:flex-row gap-md md:gap-sm">
                <Button variant="secondary" onClick={handleCopyOutput} className="w-full md:w-auto">
                  {t('common.copy')}
                </Button>
                <Button variant="secondary" onClick={handleDownloadOutput} className="w-full md:w-auto">
                  {t('common.download')}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-text-secondary text-sm">
              {detached ? t('sign.signaturePlaceholder') : t('sign.outputPlaceholder')}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
