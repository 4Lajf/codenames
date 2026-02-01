import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export interface SoundSettings {
  enabled: boolean;
  soundFile: string;
  gain: number; // 0.0 to 2.0 (0% to 200%)
}

const DEFAULT_SETTINGS: SoundSettings = {
  enabled: true,
  soundFile: 'rura.ogg',
  gain: 0.01 // 1%
};

const STORAGE_KEYS = {
  enabled: 'codenames_sound_enabled',
  soundFile: 'codenames_sound_file',
  gain: 'codenames_sound_gain'
};

function loadSettings(): SoundSettings {
  if (!browser) return DEFAULT_SETTINGS;

  const enabled = localStorage.getItem(STORAGE_KEYS.enabled);
  const soundFile = localStorage.getItem(STORAGE_KEYS.soundFile);
  const gain = localStorage.getItem(STORAGE_KEYS.gain);

  return {
    enabled: enabled !== null ? enabled === 'true' : DEFAULT_SETTINGS.enabled,
    soundFile: soundFile || DEFAULT_SETTINGS.soundFile,
    gain: gain !== null ? parseFloat(gain) : DEFAULT_SETTINGS.gain
  };
}

function createSoundStore() {
  const { subscribe, set, update } = writable<SoundSettings>(loadSettings());

  return {
    subscribe,

    /**
     * Update enabled state
     */
    setEnabled(enabled: boolean) {
      if (browser) {
        localStorage.setItem(STORAGE_KEYS.enabled, enabled.toString());
      }
      update(s => ({ ...s, enabled }));
    },

    /**
     * Update sound file
     */
    setSoundFile(soundFile: string) {
      if (browser) {
        localStorage.setItem(STORAGE_KEYS.soundFile, soundFile);
      }
      update(s => ({ ...s, soundFile }));
    },

    /**
     * Update gain (0.0 to 2.0)
     */
    setGain(gain: number) {
      const clampedGain = Math.max(0, Math.min(2.0, gain));
      if (browser) {
        localStorage.setItem(STORAGE_KEYS.gain, clampedGain.toString());
      }
      update(s => ({ ...s, gain: clampedGain }));
    },

    /**
     * Reset to defaults
     */
    reset() {
      if (browser) {
        localStorage.removeItem(STORAGE_KEYS.enabled);
        localStorage.removeItem(STORAGE_KEYS.soundFile);
        localStorage.removeItem(STORAGE_KEYS.gain);
      }
      set(DEFAULT_SETTINGS);
    }
  };
}

export const soundSettings = createSoundStore();
