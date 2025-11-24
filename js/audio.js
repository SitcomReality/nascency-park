// Audio: Generative Soundscape
// Uses WebAudio API to create tones based on grid activity

export class AudioSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.ctx.destination);

        this.enabled = false;
        this.nextNoteTime = 0;

        // Pentatonic Scale (C Minor Pentatonic)
        this.scale = [261.63, 311.13, 349.23, 392.00, 466.16, 523.25]; 

        // Reverb effect
        this.convolver = this.ctx.createConvolver();
        this.createImpulseResponse();
        this.convolver.connect(this.masterGain);
    }

    // Create a synthetic impulse response for reverb
    createImpulseResponse() {
        const duration = 2.0;
        const rate = this.ctx.sampleRate;
        const length = rate * duration;
        const impulse = this.ctx.createBuffer(2, length, rate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const decay = Math.pow(1 - i / length, 2);
            left[i] = (Math.random() * 2 - 1) * decay;
            right[i] = (Math.random() * 2 - 1) * decay;
        }
        this.convolver.buffer = impulse;
    }

    async resume() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        this.enabled = true;
    }

    // Triggered every simulation tick
    processTick(stats) {
        if (!this.enabled) return;

        // Only play sound if there is activity
        if (stats.alive > 0) {
            this.playAmbience(stats);
        }
    }

    playAmbience(stats) {
        const now = this.ctx.currentTime;

        // Limit note density
        if (now < this.nextNoteTime) return;

        const oscillator = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        // Choose note based on activity density or random
        // Use modulo to pick from scale
        const noteIndex = Math.floor(Math.random() * this.scale.length);
        oscillator.frequency.value = this.scale[noteIndex];

        // Sound shaping
        oscillator.type = 'sine';

        // Envelope
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

        oscillator.connect(gainNode);
        gainNode.connect(this.convolver); // Send to reverb
        gainNode.connect(this.masterGain); // And dry signal

        oscillator.start(now);
        oscillator.stop(now + 1.5);

        // Randomize timing for next note slightly
        this.nextNoteTime = now + 0.2 + (Math.random() * 0.5);
    }

    playInteractionTone(type) {
        if (!this.enabled) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.frequency.value = 800 + (type * 100);
        osc.type = 'triangle';

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.3);
    }
}