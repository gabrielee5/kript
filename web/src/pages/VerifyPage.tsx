import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, TextArea, Alert, Spinner, Badge } from '../components/ui';
import { useKeyring } from '../hooks/useKeyring';
import { verify, VerificationResult, extractCleartextMessage } from '@kript/core';

export default function VerifyPage() {
  const { t } = useTranslation();
  const { keys, loading } = useKeyring();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigFileInputRef = useRef<HTMLInputElement>(null);

  const [signedMessage, setSignedMessage] = useState('');
  const [detachedSignature, setDetachedSignature] = useState('');
  const [originalMessage, setOriginalMessage] = useState('');
  const [useDetached, setUseDetached] = useState(false);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [extractedMessage, setExtractedMessage] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (useDetached) {
        setOriginalMessage(reader.result as string);
      } else {
        setSignedMessage(reader.result as string);
      }
    };
    reader.readAsText(file);
  };

  const handleSigFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setDetachedSignature(reader.result as string);
    };
    reader.readAsText(file);
  };

  const handleVerify = async () => {
    setError(null);
    setResults([]);
    setExtractedMessage('');
    setVerified(false);

    if (useDetached) {
      if (!originalMessage) {
        setError(t('verify.errors.noOriginalMessage'));
        return;
      }
      if (!detachedSignature) {
        setError(t('verify.errors.noSignature'));
        return;
      }
    } else {
      if (!signedMessage) {
        setError(t('verify.errors.noSignedMessage'));
        return;
      }
    }

    try {
      setVerifying(true);

      const verificationKeys = keys.map((k) => k.publicKey);

      if (verificationKeys.length === 0) {
        setError(t('verify.noPublicKeys'));
        return;
      }

      let verificationResults: VerificationResult[];

      if (useDetached) {
        verificationResults = await verify({
          message: originalMessage,
          signature: detachedSignature,
          verificationKeys,
        });
      } else {
        verificationResults = await verify({
          message: signedMessage,
          verificationKeys,
        });

        // Try to extract the message
        if (signedMessage.includes('-----BEGIN PGP SIGNED MESSAGE-----')) {
          try {
            const extracted = await extractCleartextMessage(signedMessage);
            setExtractedMessage(extracted);
          } catch {
            // Ignore extraction errors
          }
        }
      }

      setResults(verificationResults);
      setVerified(verificationResults.every((r) => r.valid));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('verify.errors.verificationFailed'));
    } finally {
      setVerifying(false);
    }
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
        <h1 className="text-3xl md:text-4xl font-semibold leading-tight">{t('verify.title')}</h1>
        <p className="text-text-secondary mt-tiny text-sm md:text-base">{t('verify.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Input */}
        <Card>
          <h2 className="text-lg font-semibold mb-md">{t('verify.input')}</h2>

          {error && <Alert variant="danger" className="mb-md">{error}</Alert>}

          {/* Mode Toggle */}
          <div className="flex gap-sm mb-md">
            <Button
              variant={!useDetached ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setUseDetached(false)}
            >
              {t('verify.cleartextMode')}
            </Button>
            <Button
              variant={useDetached ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setUseDetached(true)}
            >
              {t('verify.detachedMode')}
            </Button>
          </div>

          {useDetached ? (
            <>
              <TextArea
                label={t('verify.originalMessage')}
                value={originalMessage}
                onChange={(e) => setOriginalMessage(e.target.value)}
                placeholder={t('verify.originalMessagePlaceholder')}
                className="min-h-[150px] mb-md"
              />

              <TextArea
                label={t('verify.detachedSignature')}
                value={detachedSignature}
                onChange={(e) => setDetachedSignature(e.target.value)}
                placeholder={t('verify.detachedSignaturePlaceholder')}
                className="min-h-[100px] mb-md"
              />

              <div className="flex gap-sm mb-md">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t('verify.loadMessage')}
                </Button>
                <input
                  ref={sigFileInputRef}
                  type="file"
                  accept=".sig,.asc"
                  onChange={handleSigFileSelect}
                  className="hidden"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => sigFileInputRef.current?.click()}
                >
                  {t('verify.loadSignature')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <TextArea
                label={t('verify.signedMessage')}
                value={signedMessage}
                onChange={(e) => setSignedMessage(e.target.value)}
                placeholder={t('verify.signedMessagePlaceholder')}
                className="min-h-[250px] mb-md"
              />

              <div className="flex gap-sm mb-md">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".asc,.sig"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t('verify.loadFile')}
                </Button>
              </div>
            </>
          )}

          <Button onClick={handleVerify} loading={verifying} className="w-full md:w-auto">
            {t('verify.verifyButton')}
          </Button>
        </Card>

        {/* Results */}
        <Card>
          <h2 className="text-lg font-semibold mb-md">{t('verify.results')}</h2>

          {results.length > 0 ? (
            <>
              {/* Overall status */}
              <div
                className={`p-md mb-md border ${
                  verified
                    ? 'bg-success-bg border-success-border'
                    : 'bg-danger-bg border-danger-border'
                }`}
              >
                <div className="flex items-center gap-sm">
                  {verified ? (
                    <svg className="w-6 h-6 text-success-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="square" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-danger-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="square" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className={`font-semibold ${verified ? 'text-success-text' : 'text-danger-text'}`}>
                    {verified ? t('verify.signatureValid') : t('verify.signatureInvalid')}
                  </span>
                </div>
              </div>

              {/* Individual signatures */}
              <div className="flex flex-col gap-sm mb-md">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-sm border ${
                      result.valid
                        ? 'bg-success-bg border-success-border'
                        : 'bg-danger-bg border-danger-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`text-sm font-medium ${result.valid ? 'text-success-text' : 'text-danger-text'}`}>
                          {result.signedBy?.email || t('verify.keyId', { keyId: result.keyId })}
                        </div>
                        {result.signedBy?.name && (
                          <div className="text-xs text-text-secondary">
                            {result.signedBy.name}
                          </div>
                        )}
                      </div>
                      <Badge variant={result.valid ? 'success' : 'danger'}>
                        {result.valid ? t('common.valid') : t('common.invalid')}
                      </Badge>
                    </div>
                    {result.error && (
                      <div className="text-xs text-danger-text mt-tiny">
                        {result.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Extracted message */}
              {extractedMessage && (
                <div>
                  <div className="text-sm text-text-secondary uppercase tracking-wide mb-tiny">
                    {t('verify.messageContent')}
                  </div>
                  <div className="bg-bg-secondary border border-border p-sm">
                    <pre className="text-sm whitespace-pre-wrap break-all">
                      {extractedMessage}
                    </pre>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-text-secondary text-sm">
              {t('verify.resultsPlaceholder')}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
