// Original synthesized alpine music and game cues; no recordings or remote assets.
export class AlpineAudio {
  constructor() { this.enabled = true; this.context = null; this.master = null; this.nodes = new Set(); this.previewTimer = null; }
  async unlock() {
    if (!this.enabled) return false;
    try {
      if (!this.context) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return false;
        this.context = new Context(); this.master = this.context.createGain();
        this.master.gain.value = .23; this.master.connect(this.context.destination);
      }
      if (this.context.state !== 'running') await this.context.resume();
      return this.context.state === 'running';
    } catch { return false; }
  }
  setEnabled(enabled) { this.enabled = enabled; if (this.master) this.master.gain.setValueAtTime(enabled ? .23 : 0, this.context.currentTime); if (!enabled) this.stop(); }
  get ready() { return this.enabled && this.context?.state === 'running'; }
  track(node, cleanup) { this.nodes.add(node); node.onended = () => { this.nodes.delete(node); node.disconnect(); cleanup?.(); }; }
  stop() {
    clearTimeout(this.previewTimer);
    for (const node of this.nodes) { try { node.stop(); } catch {} }
    this.nodes.clear();
  }
  tone(frequency, duration = .22, volume = .25, delay = 0, shape = 'triangle', endFrequency) {
    if (!this.ready) return;
    const c = this.context, time = c.currentTime + delay, osc = c.createOscillator(), amp = c.createGain();
    osc.type = shape; osc.frequency.setValueAtTime(frequency, time);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    amp.gain.setValueAtTime(0, time); amp.gain.linearRampToValueAtTime(volume, time + .009); amp.gain.exponentialRampToValueAtTime(.0001, time + duration);
    osc.connect(amp); amp.connect(this.master); this.track(osc, () => amp.disconnect());
    osc.start(time); osc.stop(time + duration + .025);
  }
  voice(frequency, vowel, delay, duration) {
    if (!this.ready) return;
    const c = this.context, time = c.currentTime + delay, voice = c.createOscillator(), amp = c.createGain();
    voice.type = 'sawtooth'; voice.frequency.setValueAtTime(frequency * .94, time); voice.frequency.exponentialRampToValueAtTime(frequency, time + .028);
    const vibrato = c.createOscillator(), vibratoDepth = c.createGain(); vibrato.frequency.value = 5.7; vibratoDepth.gain.value = frequency * .008;
    vibrato.connect(vibratoDepth); vibratoDepth.connect(voice.frequency);
    const formants = vowel === 'ee' ? [350, 2200, 2900] : [580, 900, 2400];
    const filters = formants.map((f, i) => { const filter = c.createBiquadFilter(), level = c.createGain(); filter.type = 'bandpass'; filter.frequency.value = f; filter.Q.value = [4, 6, 7][i]; level.gain.value = [1.8, .75, .3][i]; voice.connect(filter); filter.connect(level); level.connect(amp); return [filter, level]; });
    amp.gain.setValueAtTime(0, time); amp.gain.linearRampToValueAtTime(.65, time + .018); amp.gain.setValueAtTime(.51, time + duration * .58); amp.gain.exponentialRampToValueAtTime(.0001, time + duration);
    amp.connect(this.master);
    this.track(voice, () => { amp.disconnect(); filters.flat().forEach(n => n.disconnect()); });
    this.track(vibrato, () => vibratoDepth.disconnect());
    voice.start(time); voice.stop(time + duration + .025); vibrato.start(time); vibrato.stop(time + duration + .025);
  }
  yodelBeat(index) {
    if (!this.ready) return;
    // Alternating chest/falsetto-style notes over an original waltz-like accompaniment.
    const phrases = [[261.63, 523.25], [329.63, 659.25], [392, 783.99], [329.63, 523.25], [293.66, 587.33], [392, 783.99], [329.63, 659.25], [261.63, 523.25]];
    const notes = phrases[index % phrases.length];
    this.voice(notes[0], 'oh', 0, .21); this.voice(notes[1], 'ee', .235, .205);
    this.tone(index % 4 < 2 ? 130.81 : 146.83, .2, .3);
    const chord = index % 4 < 2 ? [261.63, 329.63, 392] : [293.66, 392, 493.88];
    chord.forEach(n => this.tone(n, .13, .1, .24));
  }
  effect(kind) {
    if (kind === 'fall') { this.stop(); this.tone(950, .82, .45, 0, 'sine', 75); this.tone(196, .34, .35, .82, 'triangle', 147); this.tone(130.81, .5, .32, 1.04, 'triangle', 98); return; }
    if (kind === 'win') { this.stop(); [523.25,659.25,783.99,1046.5,1318.5,1568].forEach((n,i)=>this.tone(n,.35,.3,i*.12));[523.25,659.25,783.99].forEach(n=>this.tone(n,.9,.21,.76));return; }
    if (kind === 'exact') { [784,1046.5,1318.5].forEach((n,i)=>this.tone(n,.3,.25,i*.1,'sine'));return; }
    if (kind === 'stop') { this.stop();this.tone(659.25,.25,.3);this.tone(784,.3,.25,.12);return; }
    this.tone(600,.07,.12,0,'sine');
  }
  async preview() {
    this.setEnabled(true); const ready = await this.unlock();
    if (!ready) return false;
    this.stop(); this.yodelBeat(0); this.previewTimer = setTimeout(() => this.yodelBeat(1), 470); return true;
  }
}
