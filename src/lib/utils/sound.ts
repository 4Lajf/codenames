import { browser } from '$app/environment';

let audioContext: AudioContext | null = null;
let gainNode: GainNode | null = null;
let audioElement: HTMLAudioElement | null = null;
let mediaSource: MediaElementAudioSourceNode | null = null;

/**
 * Initialize Web Audio API context and gain node
 * Must be called after user interaction due to autoplay policies
 */
export async function initAudioContext(): Promise<boolean> {
  if (!browser) return false;

  try {
    // Create AudioContext if it doesn't exist
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Resume context if suspended (required for autoplay policies)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Create audio element if it doesn't exist
    if (!audioElement) {
      audioElement = new Audio();
      audioElement.preload = 'auto';
    }

    // Create gain node if it doesn't exist
    if (!gainNode) {
      gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);
    }

    // Create media source if it doesn't exist
    if (!mediaSource && audioElement && gainNode) {
      mediaSource = audioContext.createMediaElementSource(audioElement);
      mediaSource.connect(gainNode);
    }

    return true;
  } catch (error) {
    console.error('[Sound] Failed to initialize audio context:', error);
    return false;
  }
}

/**
 * Play a round start sound
 * @param file - Sound file name (e.g., 'rura.ogg')
 * @param gain - Gain value from 0.0 to 2.0 (0% to 200%)
 */
export async function playRoundStartSound(file: string, gain: number): Promise<void> {
  if (!browser) return;

  try {
    // Initialize audio context if needed
    await initAudioContext();

    if (!audioElement || !gainNode || !audioContext) {
      console.warn('[Sound] Audio not initialized');
      return;
    }

    // Set gain (0.0 to 2.0)
    const clampedGain = Math.max(0, Math.min(2.0, gain));
    gainNode.gain.value = clampedGain;

    // Set source file
    audioElement.src = `/${file}`;

    // Try to play
    try {
      await audioElement.play();
    } catch (playError: any) {
      // Autoplay blocked - this is expected before user interaction
      // The sound will work after user clicks something (like the Test button)
      if (playError.name !== 'NotAllowedError') {
        console.warn('[Sound] Failed to play sound:', playError);
      }
    }
  } catch (error) {
    console.error('[Sound] Error playing sound:', error);
  }
}

/**
 * Prime audio context for autoplay (call on user interaction)
 */
export async function primeAudio(): Promise<void> {
  await initAudioContext();
}
