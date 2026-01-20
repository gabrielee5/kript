import { Button, Card, Select, Input, Alert } from '../components/ui';
import { useSettings } from '../hooks/useSettings';
import { useKeyring } from '../hooks/useKeyring';
import { KeyAlgorithm } from '@localpgp/core';

export default function SettingsPage() {
  const { settings, setSettings, resetSettings, loading } = useSettings();
  const { keys } = useKeyring();

  const handleExportAll = () => {
    const backup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      keys: keys.map((k) => ({
        publicKey: k.publicKey,
        privateKey: k.privateKey,
      })),
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `localpgp-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAllData = () => {
    if (confirm('This will delete ALL keys and settings. This action cannot be undone. Are you sure?')) {
      if (confirm('Last chance! All your keys will be permanently deleted.')) {
        localStorage.clear();
        indexedDB.deleteDatabase('localpgp');
        window.location.reload();
      }
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div>
      <div className="mb-xl">
        <h1 className="text-4xl font-semibold leading-tight">Settings</h1>
        <p className="text-text-secondary mt-tiny">Configure LocalPGP preferences</p>
      </div>

      <div className="flex flex-col gap-lg max-w-2xl">
        {/* Default Settings */}
        <Card>
          <h2 className="text-lg font-semibold mb-md">Default Settings</h2>

          <div className="flex flex-col gap-md">
            <Select
              label="Default Algorithm"
              value={settings.defaultAlgorithm}
              onChange={(e) => setSettings({ defaultAlgorithm: e.target.value as KeyAlgorithm })}
              options={[
                { value: 'curve25519', label: 'Curve25519 (Recommended)' },
                { value: 'rsa4096', label: 'RSA 4096' },
                { value: 'rsa2048', label: 'RSA 2048' },
              ]}
            />

            <Input
              label="Default Key Expiration (days)"
              type="number"
              value={settings.defaultExpirationDays.toString()}
              onChange={(e) => setSettings({ defaultExpirationDays: parseInt(e.target.value) || 0 })}
              hint="0 = never expires"
              min="0"
            />

            <div className="flex items-center gap-sm">
              <input
                type="checkbox"
                id="armorOutput"
                checked={settings.armorOutput}
                onChange={(e) => setSettings({ armorOutput: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="armorOutput" className="text-sm">
                Output ASCII-armored text by default
              </label>
            </div>

            <Button variant="secondary" onClick={resetSettings}>
              Reset to Defaults
            </Button>
          </div>
        </Card>

        {/* Data Management */}
        <Card>
          <h2 className="text-lg font-semibold mb-md">Data Management</h2>

          <div className="flex flex-col gap-md">
            <Alert variant="info">
              All your keys are stored locally in your browser using IndexedDB.
              No data is ever sent to any server.
            </Alert>

            <div className="text-sm text-text-secondary">
              <strong>Keys in keyring:</strong> {keys.length}
            </div>

            <div className="flex gap-sm">
              <Button variant="secondary" onClick={handleExportAll}>
                Export All Keys
              </Button>
            </div>

            <div className="border-t border-border pt-md mt-md">
              <h3 className="text-base font-semibold text-danger-text mb-sm">Danger Zone</h3>
              <Button variant="danger" onClick={handleClearAllData}>
                Delete All Data
              </Button>
            </div>
          </div>
        </Card>

        {/* About */}
        <Card>
          <h2 className="text-lg font-semibold mb-md">About LocalPGP</h2>

          <div className="flex flex-col gap-sm text-sm">
            <div>
              <strong>Version:</strong> 1.0.0
            </div>
            <div>
              <strong>Powered by:</strong> OpenPGP.js
            </div>
            <div className="text-text-secondary">
              LocalPGP is an open-source PGP encryption tool that runs entirely
              in your browser. All cryptographic operations are performed locally,
              and no data ever leaves your device.
            </div>
            <div className="mt-md">
              <a
                href="https://github.com/yourusername/localpgp"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-primary underline hover:no-underline"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
