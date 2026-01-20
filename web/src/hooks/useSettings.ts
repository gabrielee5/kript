import { useState, useEffect, useCallback } from 'react';
import { KeyAlgorithm } from '@kript/core';

const SETTINGS_KEY = 'kript_settings';

export interface Settings {
  defaultAlgorithm: KeyAlgorithm;
  defaultExpirationDays: number;
  armorOutput: boolean;
  rememberPassphrase: boolean;
}

const defaultSettings: Settings = {
  defaultAlgorithm: 'curve25519',
  defaultExpirationDays: 365,
  armorOutput: true,
  rememberPassphrase: false,
};

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Settings>;
        setSettingsState({ ...defaultSettings, ...parsed });
      }
    } catch {
      // Use defaults
    }
    setLoading(false);
  }, []);

  const setSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettingsState((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const resetSettings = useCallback(() => {
    localStorage.removeItem(SETTINGS_KEY);
    setSettingsState(defaultSettings);
  }, []);

  return { settings, setSettings, resetSettings, loading };
}
