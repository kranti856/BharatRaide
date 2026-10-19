/**
 * Loud Notification Ringtone & Bell Service for BharatRaide
 * Generates an authentic, loud, multi-tone taxi dispatch bell/siren
 * using browser Web Audio API + mobile haptic vibration.
 * Works 100% offline with zero external audio assets.
 */

class SoundService {
  private audioCtx: AudioContext | null = null;
  private ringInterval: number | null = null;
  private isRingingActive: boolean = false;
  private isMuted: boolean = false;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Generates a loud, punchy 2-stage dispatch bell chime:
   * Stage 1: High crisp alert chime (1046Hz C6 + 1318Hz E6)
   * Stage 2: Resonant loud warning ping (880Hz A5 + 1760Hz A6)
   */
  public playSingleChime(volumeMultiplier: number = 1.0) {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Master Compressor for punchy, loud volume without distortion
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-18, now);
      compressor.knee.setValueAtTime(30, now);
      compressor.ratio.setValueAtTime(12, now);
      compressor.attack.setValueAtTime(0.003, now);
      compressor.release.setValueAtTime(0.25, now);
      compressor.connect(ctx.destination);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.9 * volumeMultiplier, now);
      masterGain.connect(compressor);

      // Notes sequence for urgent taxi booking ringtone:
      // Beep 1 (high bell), Beep 2 (higher bell), Beep 3 (resonant ring)
      const tones = [
        { freq: 880, start: 0.00, duration: 0.16, type: 'triangle' as OscillatorType },
        { freq: 1174, start: 0.08, duration: 0.18, type: 'sine' as OscillatorType },
        { freq: 1396, start: 0.20, duration: 0.22, type: 'triangle' as OscillatorType },
        { freq: 1760, start: 0.28, duration: 0.35, type: 'sine' as OscillatorType },
        // Secondary harmonic layer for loud penetration:
        { freq: 1046, start: 0.45, duration: 0.30, type: 'sine' as OscillatorType },
        { freq: 1318, start: 0.55, duration: 0.40, type: 'triangle' as OscillatorType },
      ];

      tones.forEach((t) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc.type = t.type;
        osc.frequency.setValueAtTime(t.freq, now + t.start);

        // Envelope: instant strike + loud decay
        noteGain.gain.setValueAtTime(0.001, now + t.start);
        noteGain.gain.exponentialRampToValueAtTime(0.85, now + t.start + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + t.start + t.duration);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(now + t.start);
        osc.stop(now + t.start + t.duration + 0.05);
      });

      // Mobile haptic vibration if supported
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([250, 100, 250, 100, 350]);
        } catch {}
      }
    } catch (e) {
      console.warn('Web Audio playback error:', e);
    }
  }

  /**
   * Starts repetitive loud notification ring (rings continuously until accepted/declined)
   */
  public startLoudNotificationRing() {
    if (this.isRingingActive) return;
    this.isRingingActive = true;

    // Wake audio context on start
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Play initial chime immediately
    this.playSingleChime(1.0);

    // Repeat loud ring every 1.35 seconds
    if (typeof window !== 'undefined') {
      this.ringInterval = window.setInterval(() => {
        if (!this.isRingingActive) {
          this.stopNotificationRing();
          return;
        }
        this.playSingleChime(1.0);
      }, 1350);
    }
  }

  /**
   * Stops the ongoing ring immediately
   */
  public stopNotificationRing() {
    this.isRingingActive = false;
    if (this.ringInterval !== null) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  }

  public isRinging(): boolean {
    return this.isRingingActive;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopNotificationRing();
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }
}

export const soundService = new SoundService();
