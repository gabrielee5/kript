import { useState } from 'react';
import { Button, Card, Badge, Modal, Input, Select, Alert, Spinner } from '../components/ui';
import { useKeyring } from '../hooks/useKeyring';
import { useSettings } from '../hooks/useSettings';
import { formatFingerprint, formatDate, daysUntilExpiration, KeyAlgorithm, checkPassphraseStrength } from '@kript/core';

export default function KeysPage() {
  const { keys, loading, error, deleteKey, generateKey, addKey, refresh } = useKeyring();
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

  const handleGenerate = async () => {
    setGenError(null);

    if (!genName.trim()) {
      setGenError('Name is required');
      return;
    }
    if (!genEmail.trim()) {
      setGenError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(genEmail)) {
      setGenError('Invalid email format');
      return;
    }
    if (genPassphrase && genPassphrase !== genConfirmPassphrase) {
      setGenError('Passphrases do not match');
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
      setGenError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleImport = async () => {
    setImportError(null);

    if (!importText.trim()) {
      setImportError('Please paste a PGP key');
      return;
    }

    try {
      setImporting(true);
      const isPrivate = importText.includes('-----BEGIN PGP PRIVATE KEY BLOCK-----');
      await addKey(importText, isPrivate ? importText : undefined);
      setShowImportModal(false);
      setImportText('');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (keyId: string) => {
    if (confirm('Are you sure you want to delete this key?')) {
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
          <h1 className="text-4xl font-semibold leading-tight">Keys</h1>
          <p className="text-text-secondary mt-tiny">Manage your PGP key pairs</p>
        </div>
        <div className="flex gap-sm">
          <Button variant="secondary" onClick={() => setShowImportModal(true)}>
            Import Key
          </Button>
          <Button onClick={() => setShowGenerateModal(true)}>
            Generate Key
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="mb-lg">
          {error}
        </Alert>
      )}

      {revocationCert && (
        <Alert variant="warning" title="Save Your Revocation Certificate" className="mb-lg">
          <p className="mb-sm">Store this certificate safely. You'll need it to revoke your key if compromised.</p>
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
            Copy & Dismiss
          </Button>
        </Alert>
      )}

      {/* Keys List */}
      {keys.length === 0 ? (
        <Card className="text-center py-2xl">
          <p className="text-text-secondary mb-md">No keys in your keyring</p>
          <div className="flex justify-center gap-sm">
            <Button variant="secondary" onClick={() => setShowImportModal(true)}>
              Import Key
            </Button>
            <Button onClick={() => setShowGenerateModal(true)}>
              Generate Key
            </Button>
          </div>
        </Card>
      ) : (
        <div className="border border-border">
          <table className="w-full border-collapse">
            <thead className="bg-bg-secondary border-b border-border">
              <tr>
                <th className="text-left p-md text-xs font-medium text-text-secondary uppercase tracking-wide">
                  User
                </th>
                <th className="text-left p-md text-xs font-medium text-text-secondary uppercase tracking-wide hidden md:table-cell">
                  Key ID
                </th>
                <th className="text-left p-md text-xs font-medium text-text-secondary uppercase tracking-wide hidden lg:table-cell">
                  Algorithm
                </th>
                <th className="text-left p-md text-xs font-medium text-text-secondary uppercase tracking-wide">
                  Status
                </th>
                <th className="text-right p-md text-xs font-medium text-text-secondary uppercase tracking-wide">
                  Actions
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
                      <div className="font-semibold">{primaryUser?.name || 'Unknown'}</div>
                      <div className="text-xs text-text-secondary">{primaryUser?.email}</div>
                    </td>
                    <td className="p-lg hidden md:table-cell">
                      <code className="text-xs">{entry.keyId}</code>
                    </td>
                    <td className="p-lg text-sm hidden lg:table-cell">
                      {entry.keyInfo.algorithm}
                    </td>
                    <td className="p-lg">
                      <div className="flex flex-wrap gap-tiny">
                        {entry.keyInfo.isPrivate && (
                          <Badge variant="success">Private</Badge>
                        )}
                        {!entry.keyInfo.isPrivate && (
                          <Badge variant="neutral">Public</Badge>
                        )}
                        {entry.keyInfo.revoked && (
                          <Badge variant="danger">Revoked</Badge>
                        )}
                        {isExpired && (
                          <Badge variant="danger">Expired</Badge>
                        )}
                        {!isExpired && days !== null && days < 30 && (
                          <Badge variant="warning">Expires in {days}d</Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-lg text-right">
                      <div className="flex justify-end gap-tiny">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedKey(entry.fingerprint);
                            setShowExportModal(true);
                          }}
                        >
                          Export
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDelete(entry.fingerprint)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => {
          setShowGenerateModal(false);
          resetGenerateForm();
        }}
        title="Generate New Key Pair"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowGenerateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} loading={generating}>
              Generate
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-md">
          {genError && <Alert variant="danger">{genError}</Alert>}

          <Input
            label="Name"
            value={genName}
            onChange={(e) => setGenName(e.target.value)}
            placeholder="Your Name"
          />

          <Input
            label="Email"
            type="email"
            value={genEmail}
            onChange={(e) => setGenEmail(e.target.value)}
            placeholder="your@email.com"
          />

          <Input
            label="Comment (optional)"
            value={genComment}
            onChange={(e) => setGenComment(e.target.value)}
            placeholder="Optional comment"
          />

          <Select
            label="Algorithm"
            value={genAlgorithm}
            onChange={(e) => setGenAlgorithm(e.target.value as KeyAlgorithm)}
            options={[
              { value: 'curve25519', label: 'Curve25519 (Recommended)' },
              { value: 'rsa4096', label: 'RSA 4096' },
              { value: 'rsa2048', label: 'RSA 2048' },
            ]}
          />

          <Input
            label="Expiration (days, 0 = never)"
            type="number"
            value={genExpiration}
            onChange={(e) => setGenExpiration(e.target.value)}
            min="0"
          />

          <Input
            label="Passphrase"
            type="password"
            value={genPassphrase}
            onChange={(e) => setGenPassphrase(e.target.value)}
            placeholder="Enter passphrase"
            hint={passphraseStrength ? `Strength: ${'●'.repeat(passphraseStrength.score)}${'○'.repeat(4 - passphraseStrength.score)}` : undefined}
          />

          <Input
            label="Confirm Passphrase"
            type="password"
            value={genConfirmPassphrase}
            onChange={(e) => setGenConfirmPassphrase(e.target.value)}
            placeholder="Confirm passphrase"
          />

          {!genPassphrase && (
            <Alert variant="warning">
              No passphrase set. Your private key will be unprotected.
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
        title="Import Key"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowImportModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} loading={importing}>
              Import
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-md">
          {importError && <Alert variant="danger">{importError}</Alert>}

          <div className="flex flex-col gap-tiny">
            <label className="text-xs text-text-secondary uppercase tracking-wide">
              Paste PGP Key
            </label>
            <textarea
              className="bg-white border border-border px-lg py-sm font-mono text-sm min-h-[200px] transition-all duration-150 hover:border-border-hover focus:border-black focus:outline-none"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----&#10;...&#10;-----END PGP PUBLIC KEY BLOCK-----"
            />
          </div>

          <div className="text-xs text-text-secondary">
            Or drag and drop a .asc or .gpg file here
          </div>
        </div>
      </Modal>

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => {
          setShowExportModal(false);
          setSelectedKey(null);
        }}
        title="Export Key"
        footer={
          <Button variant="secondary" onClick={() => setShowExportModal(false)}>
            Close
          </Button>
        }
      >
        {selectedKey && (() => {
          const entry = keys.find((k) => k.fingerprint === selectedKey);
          if (!entry) return null;

          return (
            <div className="flex flex-col gap-md">
              <div>
                <div className="text-xs text-text-secondary uppercase tracking-wide mb-tiny">
                  Public Key
                </div>
                <pre className="bg-bg-secondary border border-border p-sm text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-[200px]">
                  {entry.publicKey}
                </pre>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-sm"
                  onClick={() => navigator.clipboard.writeText(entry.publicKey)}
                >
                  Copy Public Key
                </Button>
              </div>

              {entry.privateKey && (
                <Alert variant="warning">
                  Private key export is available. Handle with care!
                </Alert>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
