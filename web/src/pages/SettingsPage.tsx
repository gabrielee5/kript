import { useTranslation } from 'react-i18next';
import { Button, Card, Select, Input, Alert } from '../components/ui';
import { useSettings } from '../hooks/useSettings';
import { useKeyring } from '../hooks/useKeyring';
import { KeyAlgorithm } from '@kript/core';

export default function SettingsPage() {
  const { t } = useTranslation();
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
    a.download = `kript-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAllData = () => {
    if (confirm(t('settings.deleteConfirm1'))) {
      if (confirm(t('settings.deleteConfirm2'))) {
        localStorage.clear();
        indexedDB.deleteDatabase('kript');
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
        <h1 className="text-3xl md:text-4xl font-semibold leading-tight">{t('settings.title')}</h1>
        <p className="text-text-secondary mt-tiny text-sm md:text-base">{t('settings.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-lg max-w-2xl">
        {/* Default Settings */}
        <Card>
          <h2 className="text-lg font-semibold mb-md">{t('settings.defaultSettings')}</h2>

          <div className="flex flex-col gap-md">
            <Select
              label={t('settings.defaultAlgorithm')}
              value={settings.defaultAlgorithm}
              onChange={(e) => setSettings({ defaultAlgorithm: e.target.value as KeyAlgorithm })}
              options={[
                { value: 'curve25519', label: t('keys.algorithmCurve') },
                { value: 'rsa4096', label: t('keys.algorithmRsa4096') },
                { value: 'rsa2048', label: t('keys.algorithmRsa2048') },
              ]}
            />

            <Input
              label={t('settings.defaultExpiration')}
              type="number"
              value={settings.defaultExpirationDays.toString()}
              onChange={(e) => setSettings({ defaultExpirationDays: parseInt(e.target.value) || 0 })}
              hint={t('settings.expirationHint')}
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
                {t('settings.armorOutput')}
              </label>
            </div>

            <Button variant="secondary" onClick={resetSettings} className="w-full md:w-auto">
              {t('settings.resetDefaults')}
            </Button>
          </div>
        </Card>

        {/* Data Management */}
        <Card>
          <h2 className="text-lg font-semibold mb-md">{t('settings.dataManagement')}</h2>

          <div className="flex flex-col gap-md">
            <Alert variant="info">
              {t('settings.dataStorageInfo')}
            </Alert>

            <div className="text-sm text-text-secondary">
              <strong>{t('settings.keysInKeyring')}</strong> {keys.length}
            </div>

            <div className="flex">
              <Button variant="secondary" onClick={handleExportAll} className="w-full md:w-auto">
                {t('settings.exportAllKeys')}
              </Button>
            </div>

            <div className="border-t border-border pt-md mt-md">
              <h3 className="text-base font-semibold text-danger-text mb-sm">{t('settings.dangerZone')}</h3>
              <Button variant="danger" onClick={handleClearAllData} className="w-full md:w-auto">
                {t('settings.deleteAllData')}
              </Button>
            </div>
          </div>
        </Card>

        {/* About */}
        <Card>
          <h2 className="text-lg font-semibold mb-md">{t('settings.about')}</h2>

          <div className="flex flex-col gap-sm text-sm">
            <div>
              <strong>{t('settings.versionLabel')}</strong> 3.0.0
            </div>
            <div>
              <strong>{t('settings.poweredBy')}</strong> OpenPGP.js
            </div>
            <div className="text-text-secondary">
              {t('settings.aboutDescription')}
            </div>
            <div className="mt-md">
              <a
                href="https://github.com/gabrielee5/kript"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-primary underline hover:no-underline"
              >
                {t('settings.viewOnGitHub')}
              </a>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
