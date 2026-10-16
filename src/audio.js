export function createAudio() {
  let context = null;
  let muted = false;
  try {
    muted = localStorage.getItem('dataHeistMuted') === '1';
  } catch {
    muted = false;
  }

  function ensureContext() {
    if (!context) context = new AudioContext();
    if (context.state === 'suspended') context.resume();
    return context;
  }

  function tone(frequency, duration, type = 'square', volume = 0.035, endFrequency = frequency) {
    if (muted) return;
    const audioContext = ensureContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFrequency),
      audioContext.currentTime + duration
    );
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  }

  return {
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      try {
        localStorage.setItem('dataHeistMuted', muted ? '1' : '0');
      } catch {
        /* optional */
      }
      return muted;
    },
    click: () => tone(260, 0.06),
    place: () => tone(320, 0.08, 'triangle', 0.03, 450),
    lockIn: () => tone(180, 0.14, 'square', 0.04, 90),
    tick: () => tone(520, 0.045, 'square', 0.025, 520),
    fire: () => tone(110, 0.18, 'sawtooth', 0.045, 48),
    hit: () => tone(90, 0.12, 'square', 0.045, 38),
    win: () => {
      tone(440, 0.12, 'triangle');
      window.setTimeout(() => tone(660, 0.18, 'triangle'), 90);
    },
    lose: () => tone(150, 0.3, 'sawtooth', 0.035, 60),
  };
}
