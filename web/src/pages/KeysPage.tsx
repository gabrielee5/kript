import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Badge, Modal, Input, Select, Alert, Spinner } from '../components/ui';
import { useKeyring } from '../hooks/useKeyring';
import { useSettings } from '../hooks/useSettings';
import { daysUntilExpiration, KeyAlgorithm, checkPassphraseStrength, decryptPrivateKey, readKey, exportKeyBinary, binaryKeyToArmored } from '@kript/core';

/**
 * Download a file with the given content
 */
function downloadFile(content: string | Uint8Array, filename: string, mimeType: string) {
  let blobPart: BlobPart;
  if (content instanceof Uint8Array) {
    // Create a new ArrayBuffer copy to satisfy TypeScript's BlobPart type
    const buffer = new ArrayBuffer(content.length);
    new Uint8Array(buffer).set(content);
    blobPart = buffer;
  } else {
    blobPart = content;
  }
  const blob = new Blob([blobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function KeysPage() {
  const { t } = useTranslation();
  const { keys, loading, error, deleteKey, generateKey, addKey } = useKeyring();
  const { settings } = useSettings();

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [revocationCert, setRevocationCert] = useState<string | null>(null);

  // Export private key state
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [verifyingPassphrase, setVerifyingPassphrase] = useState(false);

  // Generate form state
  const [genName, setGenName] = useState('');
  const [genEmail, setGenEmail] = useState('');
  const [genComment, setGenComment] = useState('');
  const [genAlgorithm, setGenAlgorithm] = useState<KeyAlgorithm>(settings.defaultAlgorithm);
  const [genPassphrase, setGenPassphrase] = useState('');
  const [genConfirmPassphrase, setGenConfirmPassphrase] = useState('');
  const [genExpiration, setGenExpiration] = useState(settings.defaultExpirationDays.toString());

  // Import form state
  const [importText, setImportText] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleGenerate = async () => {
    setGenError(null);

    if (!genName.trim()) {
      setGenError(t('keys.errors.nameRequired'));
      return;
    }
    if (!genEmail.trim()) {
      setGenError(t('keys.errors.emailRequired'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(genEmail)) {
      setGenError(t('keys.errors.invalidEmail'));
      return;
    }
    if (genPassphrase && genPassphrase !== genConfirmPassphrase) {
      setGenError(t('keys.errors.passphrasesMismatch'));
      return;
    }

    try {
      setGenerating(true);
      const result = await generateKey({
        algorithm: genAlgorithm,
        userIds: [{
          name: genName.trim(),
          email: genEmail.trim(),
          comment: genComment.trim() || undefined,
        }],
        passphrase: genPassphrase || undefined,
        expirationDays: parseInt(genExpiration) || undefined,
      });

      setRevocationCert(result.revocationCertificate);
      setShowGenerateModal(false);
      resetGenerateForm();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : t('keys.errors.generationFailed'));
    } finally {
      setGenerating(false);
    }
  };

  const handleImport = async () => {
    setImportError(null);

    if (!importText.trim()) {
      setImportError(t('keys.errors.pleaseEnterKey'));
      return;
    }

    try {
      setImporting(true);
      const isPrivate = importText.includes('-----BEGIN PGP PRIVATE KEY BLOCK-----');
      await addKey(importText, isPrivate ? importText : undefined);
      setShowImportModal(false);
      setImportText('');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t('keys.errors.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setImportError(null);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    const fileName = file.name.toLowerCase();

    try {
      if (fileName.endsWith('.gpg')) {
        // Binary file - read as ArrayBuffer and convert to armored
        const buffer = await file.arrayBuffer();
        const binary = new Uint8Array(buffer);
        const armored = await binaryKeyToArmored(binary);
        setImportText(armored);
      } else {
        // Text file (.asc or other) - read as text
        const text = await file.text();
        setImportText(text);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t('keys.errors.importFailed'));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileName = file.name.toLowerCase();
    setImportError(null);

    try {
      if (fileName.endsWith('.gpg')) {
        // Binary file
        const buffer = await file.arrayBuffer();
        const binary = new Uint8Array(buffer);
        const armored = await binaryKeyToArmored(binary);
        setImportText(armored);
      } else {
        // Text file
        const text = await file.text();
        setImportText(text);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t('keys.errors.importFailed'));
    }

    // Reset the input so the same file can be selected again
    e.target.value = '';
  };

  const handleDelete = async (keyId: string) => {
    if (confirm(t('keys.deleteConfirm'))) {
      await deleteKey(keyId);
    }
  };

  const resetGenerateForm = () => {
    setGenName('');
    setGenEmail('');
    setGenComment('');
    setGenPassphrase('');
    setGenConfirmPassphrase('');
    setGenError(null);
  };

  const resetExportState = () => {
    setShowPrivateKey(false);
    setExportPassphrase('');
    setExportError(null);
    setVerifyingPassphrase(false);
  };

  const handleVerifyPassphrase = async (privateKey: string) => {
    setExportError(null);
    setVerifyingPassphrase(true);

    try {
      await decryptPrivateKey(privateKey, exportPassphrase);
      setShowPrivateKey(true);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t('keys.errors.invalidPassphrase'));
    } finally {
      setVerifyingPassphrase(false);
    }
  };

  const passphraseStrength = genPassphrase ? checkPassphraseStrength(genPassphrase) : null;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-2xl">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-md mb-xl">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold leading-tight">{t('keys.title')}</h1>
          <p className="text-text-secondary mt-tiny text-sm md:text-base">{t('keys.subtitle')}</p>
        </div>
        <div className="flex flex-col w-full md:w-auto md:flex-row gap-md md:gap-sm">
          <Button variant="secondary" onClick={() => setShowImportModal(true)} className="w-full md:w-auto">
            {t('keys.importKey')}
          </Button>
          <Button onClick={() => setShowGenerateModal(true)} className="w-full md:w-auto">
            {t('keys.generateKey')}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="mb-lg">
          {error}
        </Alert>
      )}

      {revocationCert && (
        <Alert variant="warning" title={t('keys.revocationTitle')} className="mb-lg">
          <p className="mb-sm">{t('keys.revocationDescription')}</p>
          <pre className="bg-white border border-border p-sm text-xs overflow-x-auto whitespace-pre-wrap break-all">
            {revocationCert}
          </pre>
          <Button
            variant="secondary"
            size="sm"
            className="mt-sm"
            onClick={() => {
              navigator.clipboard.writeText(revocationCert);
              setRevocationCert(null);
            }}
          >
            {t('keys.copyAndDismiss')}
          </Button>
        </Alert>
      )}

      {/* Keys List */}
      {keys.length === 0 ? (
        <div className="flex flex-col gap-lg max-w-2xl">
          <Card>
            <h2 className="text-lg font-semibold mb-md">{t('keys.emptyTitle')}</h2>
            <p className="text-text-secondary mb-lg text-sm md:text-base">
              {t('keys.emptyDescription')}
            </p>
            <div className="flex flex-col md:flex-row gap-md md:gap-sm">
              <Button onClick={() => setShowGenerateModal(true)} className="w-full md:w-auto">
                {t('keys.generateKey')}
              </Button>
              <Button variant="secondary" onClick={() => setShowImportModal(true)} className="w-full md:w-auto">
                {t('keys.importKey')}
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold mb-md">{t('keys.whatCanDo')}</h2>
            <ul className="flex flex-col gap-sm text-text-secondary text-sm md:text-base">
              <li>
                <strong className="text-text-primary">{t('common.encrypt')}</strong> — {t('keys.whatCanDoEncrypt')}
              </li>
              <li>
                <strong className="text-text-primary">{t('common.sign')}</strong> — {t('keys.whatCanDoSign')}
              </li>
              <li>
                <strong className="text-text-primary">{t('common.verify')}</strong> — {t('keys.whatCanDoVerify')}
              </li>
              <li>
                <strong className="text-text-primary">{t('keys.whatCanDoSecureEmail').split(' ')[0]}</strong> — {t('keys.whatCanDoSecureEmail')}
              </li>
            </ul>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold mb-md">{t('keys.howKeysWork')}</h2>
            <p className="text-text-secondary text-sm md:text-base" dangerouslySetInnerHTML={{ __html: t('keys.howKeysWorkDescription') }} />
          </Card>
        </div>
      ) : (
        <>
          {/* Desktop Table Layout */}
          <div className="hidden md:block border border-border">
            <table className="w-full border-collapse">
              <thead className="bg-bg-secondary border-b border-border">
                <tr>
                  <th className="text-left p-md text-xs font-medium text-text-secondary uppercase tracking-wide">
                    {t('keys.tableUser')}
                  </th>
                  <th className="text-left p-md text-xs font-medium text-text-secondary uppercase tracking-wide">
                    {t('keys.tableKeyId')}
                  </th>
                  <th className="text-left p-md text-xs font-medium text-text-secondary uppercase tracking-wide hidden lg:table-cell">
                    {t('keys.tableAlgorithm')}
                  </th>
                  <th className="text-left p-md text-xs font-medium text-text-secondary uppercase tracking-wide">
                    {t('keys.tableStatus')}
                  </th>
                  <th className="text-right p-md text-xs font-medium text-text-secondary uppercase tracking-wide">
                    {t('keys.tableActions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {keys.map((entry) => {
                  const primaryUser = entry.keyInfo.userIds[0];
                  const isExpired = entry.keyInfo.expirationTime &&
                    new Date(entry.keyInfo.expirationTime) < new Date();
                  const days = entry.keyInfo.expirationTime ?
                    daysUntilExpiration(new Date(entry.keyInfo.expirationTime)) : null;

                  return (
                    <tr
                      key={entry.fingerprint}
                      className="border-b border-border last:border-b-0 hover:bg-bg-secondary transition-all duration-150"
                    >
                      <td className="p-lg">
                        <div className="font-semibold">{primaryUser?.name || t('keys.unknown')}</div>
                        <div className="text-xs text-text-secondary">{primaryUser?.email}</div>
                      </td>
                      <td className="p-lg">
                        <code className="text-xs">{entry.keyId}</code>
                      </td>
                      <td className="p-lg text-sm hidden lg:table-cell">
                        {entry.keyInfo.algorithm}
                      </td>
                      <td className="p-lg">
                        <div className="flex flex-wrap gap-tiny">
                          {entry.keyInfo.isPrivate && (
                            <Badge variant="success">{t('keys.statusPrivate')}</Badge>
                          )}
                          {!entry.keyInfo.isPrivate && (
                            <Badge variant="neutral">{t('keys.statusPublic')}</Badge>
                          )}
                          {entry.keyInfo.revoked && (
                            <Badge variant="danger">{t('keys.statusRevoked')}</Badge>
                          )}
                          {isExpired && (
                            <Badge variant="danger">{t('keys.statusExpired')}</Badge>
                          )}
                          {!isExpired && days !== null && days < 30 && (
                            <Badge variant="warning">{t('keys.statusExpiresDays', { days })}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-lg text-right">
                        <div className="flex justify-end gap-sm">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedKey(entry.fingerprint);
                              setShowExportModal(true);
                            }}
                          >
                            {t('common.export')}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDelete(entry.fingerprint)}
                          >
                            {t('common.delete')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden flex flex-col gap-md">
            {keys.map((entry) => {
              const primaryUser = entry.keyInfo.userIds[0];
              const isExpired = entry.keyInfo.expirationTime &&
                new Date(entry.keyInfo.expirationTime) < new Date();
              const days = entry.keyInfo.expirationTime ?
                daysUntilExpiration(new Date(entry.keyInfo.expirationTime)) : null;

              return (
                <div
                  key={entry.fingerprint}
                  className="border border-border p-lg bg-white"
                >
                  <div className="flex justify-between items-start gap-sm mb-md">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base truncate">{primaryUser?.name || t('keys.unknown')}</div>
                      <div className="text-sm text-text-secondary break-all">{primaryUser?.email}</div>
                    </div>
                    <div className="flex flex-wrap gap-tiny justify-end shrink-0">
                      {entry.keyInfo.isPrivate && (
                        <Badge variant="success">{t('keys.statusPrivate')}</Badge>
                      )}
                      {!entry.keyInfo.isPrivate && (
                        <Badge variant="neutral">{t('keys.statusPublic')}</Badge>
                      )}
                      {entry.keyInfo.revoked && (
                        <Badge variant="danger">{t('keys.statusRevoked')}</Badge>
                      )}
                      {isExpired && (
                        <Badge variant="danger">{t('keys.statusExpired')}</Badge>
                      )}
                      {!isExpired && days !== null && days < 30 && (
                        <Badge variant="warning">{t('keys.statusExpiresDays', { days })}</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-xs text-sm text-text-secondary mb-lg">
                    <div className="flex gap-sm">
                      <span className="text-text-tertiary uppercase text-xs w-20 shrink-0">{t('keys.tableKeyId')}</span>
                      <code className="text-xs break-all">{entry.keyId}</code>
                    </div>
                    <div className="flex gap-sm">
                      <span className="text-text-tertiary uppercase text-xs w-20 shrink-0">{t('keys.tableAlgorithm')}</span>
                      <span className="text-sm">{entry.keyInfo.algorithm}</span>
                    </div>
                  </div>

                  <div className="flex gap-md">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedKey(entry.fingerprint);
                        setShowExportModal(true);
                      }}
                    >
                      {t('common.export')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleDelete(entry.fingerprint)}
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Generate Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => {
          setShowGenerateModal(false);
          resetGenerateForm();
        }}
        title={t('keys.generateModalTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowGenerateModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleGenerate} loading={generating}>
              {t('common.generate')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-md">
          {genError && <Alert variant="danger">{genError}</Alert>}

          <Input
            label={t('keys.name')}
            value={genName}
            onChange={(e) => setGenName(e.target.value)}
            placeholder={t('keys.namePlaceholder')}
          />

          <Input
            label={t('keys.email')}
            type="email"
            value={genEmail}
            onChange={(e) => setGenEmail(e.target.value)}
            placeholder={t('keys.emailPlaceholder')}
          />

          <Input
            label={t('keys.comment')}
            value={genComment}
            onChange={(e) => setGenComment(e.target.value)}
            placeholder={t('keys.commentPlaceholder')}
          />

          <Select
            label={t('keys.algorithm')}
            value={genAlgorithm}
            onChange={(e) => setGenAlgorithm(e.target.value as KeyAlgorithm)}
            options={[
              { value: 'curve25519', label: t('keys.algorithmCurve') },
              { value: 'rsa4096', label: t('keys.algorithmRsa4096') },
              { value: 'rsa2048', label: t('keys.algorithmRsa2048') },
            ]}
          />

          <Input
            label={t('keys.expiration')}
            type="number"
            value={genExpiration}
            onChange={(e) => setGenExpiration(e.target.value)}
            min="0"
          />

          <Input
            label={t('common.passphrase')}
            type="password"
            value={genPassphrase}
            onChange={(e) => setGenPassphrase(e.target.value)}
            placeholder={t('keys.passphrasePlaceholder')}
            hint={passphraseStrength ? `${t('keys.passphraseStrength')} ${'●'.repeat(passphraseStrength.score)}${'○'.repeat(4 - passphraseStrength.score)}` : undefined}
          />

          <Input
            label={t('keys.confirmPassphrase')}
            type="password"
            value={genConfirmPassphrase}
            onChange={(e) => setGenConfirmPassphrase(e.target.value)}
            placeholder={t('keys.confirmPassphrasePlaceholder')}
          />

          {!genPassphrase && (
            <Alert variant="warning">
              {t('keys.noPassphraseWarning')}
            </Alert>
          )}
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportText('');
          setImportError(null);
        }}
        title={t('keys.importModalTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => {
              setShowImportModal(false);
              setImportText('');
              setImportError(null);
            }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleImport} loading={importing}>
              {t('common.import')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-md">
          {importError && <Alert variant="danger">{importError}</Alert>}

          <div
            className={`flex flex-col gap-tiny relative ${isDragging ? 'ring-2 ring-black ring-offset-2' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <label className="text-sm text-text-secondary uppercase tracking-wide">
              {t('keys.pasteKey')}
            </label>
            <textarea
              className={`bg-white border px-lg py-sm font-mono text-sm min-h-[200px] transition-all duration-150 focus:border-black focus:outline-none ${
                isDragging ? 'border-black bg-bg-secondary' : 'border-border hover:border-border-hover'
              }`}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={t('keys.pasteKeyPlaceholder')}
            />
            {isDragging && (
              <div className="absolute inset-0 flex items-center justify-center bg-bg-secondary/80 pointer-events-none mt-6">
                <span className="text-lg font-medium">{t('keys.dropFileHere')}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-md">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".asc,.gpg,.pgp,.key"
                className="hidden"
                onChange={handleFileSelect}
              />
              <span className="inline-flex items-center px-md py-sm border border-border bg-white hover:border-border-hover transition-all duration-150 text-sm">
                {t('keys.selectFile')}
              </span>
            </label>
            <span className="text-sm text-text-secondary">
              {t('keys.dragDropHint')}
            </span>
          </div>
        </div>
      </Modal>

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => {
          setShowExportModal(false);
          setSelectedKey(null);
          resetExportState();
        }}
        title={t('keys.exportModalTitle')}
        footer={
          <Button variant="secondary" onClick={() => {
            setShowExportModal(false);
            resetExportState();
          }}>
            {t('common.close')}
          </Button>
        }
      >
        {selectedKey && (() => {
          const entry = keys.find((k) => k.fingerprint === selectedKey);
          if (!entry) return null;

          const handleDownloadPublicKey = async (format: 'asc' | 'gpg') => {
            const filename = `${entry.keyId}_public.${format}`;
            if (format === 'gpg') {
              try {
                const key = await readKey(entry.publicKey);
                const binary = await exportKeyBinary(key, { includePrivate: false });
                downloadFile(binary, filename, 'application/pgp-keys');
              } catch (err) {
                setExportError(err instanceof Error ? err.message : 'Export failed');
              }
            } else {
              downloadFile(entry.publicKey, filename, 'application/pgp-keys');
            }
          };

          const handleDownloadPrivateKey = async (format: 'asc' | 'gpg') => {
            if (!entry.privateKey) return;
            const filename = `${entry.keyId}_secret.${format}`;
            if (format === 'gpg') {
              try {
                const key = await readKey(entry.privateKey);
                const binary = await exportKeyBinary(key, { includePrivate: true });
                downloadFile(binary, filename, 'application/pgp-keys');
              } catch (err) {
                setExportError(err instanceof Error ? err.message : 'Export failed');
              }
            } else {
              downloadFile(entry.privateKey, filename, 'application/pgp-keys');
            }
          };

          return (
            <div className="flex flex-col gap-md">
              <div>
                <div className="text-sm text-text-secondary uppercase tracking-wide mb-tiny">
                  {t('keys.publicKey')}
                </div>
                <pre className="bg-bg-secondary border border-border p-sm text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-[200px]">
                  {entry.publicKey}
                </pre>
                <div className="flex flex-wrap gap-sm mt-sm">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(entry.publicKey)}
                  >
                    {t('keys.copyPublicKey')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDownloadPublicKey('asc')}
                  >
                    {t('keys.downloadAsc')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDownloadPublicKey('gpg')}
                  >
                    {t('keys.downloadGpg')}
                  </Button>
                </div>
              </div>

              {entry.privateKey && (
                <div>
                  {!showPrivateKey ? (
                    <>
                      <Alert variant="warning" className="mb-sm">
                        {t('keys.privateKeyExportHint')}
                      </Alert>
                      {exportError && (
                        <Alert variant="danger" className="mb-sm">
                          {exportError}
                        </Alert>
                      )}
                      <div className="flex gap-sm items-end">
                        <Input
                          label={t('common.passphrase')}
                          type="password"
                          value={exportPassphrase}
                          onChange={(e) => setExportPassphrase(e.target.value)}
                          placeholder={t('keys.passphrasePlaceholder')}
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleVerifyPassphrase(entry.privateKey!);
                            }
                          }}
                        />
                        <Button
                          variant="secondary"
                          onClick={() => handleVerifyPassphrase(entry.privateKey!)}
                          loading={verifyingPassphrase}
                        >
                          {t('keys.revealPrivateKey')}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Alert variant="danger" className="mb-sm">
                        {t('keys.privateKeyWarning')}
                      </Alert>
                      <div className="text-sm text-text-secondary uppercase tracking-wide mb-tiny">
                        {t('keys.privateKey')}
                      </div>
                      <pre className="bg-bg-secondary border border-border p-sm text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-[200px]">
                        {entry.privateKey}
                      </pre>
                      <div className="flex flex-wrap gap-sm mt-sm">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(entry.privateKey!)}
                        >
                          {t('keys.copyPrivateKey')}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDownloadPrivateKey('asc')}
                        >
                          {t('keys.downloadAsc')}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDownloadPrivateKey('gpg')}
                        >
                          {t('keys.downloadGpg')}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
