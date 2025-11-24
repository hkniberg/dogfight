// Audio management using Web Audio API

class AudioManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.enabled = true;
        this.masterVolume = GAME_SETTINGS.audio.masterVolume;
        
        // Initialize on first user interaction
        this.initialized = false;
    }
    
    init() {
        if (this.initialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.enabled = false;
        }
    }
    
    // Create simple synthesized sounds
    playShoot() {
        if (!this.enabled || !this.initialized) return;
        
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = 400;
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
        
        gain.gain.value = this.masterVolume * 0.3;
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
    }
    
    playExplosion() {
        if (!this.enabled || !this.initialized) return;
        
        const ctx = this.audioContext;
        
        // Create noise for explosion
        const bufferSize = ctx.sampleRate * 0.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);
        
        const gain = ctx.createGain();
        gain.gain.value = this.masterVolume * 0.4;
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        noise.start(ctx.currentTime);
        noise.stop(ctx.currentTime + 0.5);
    }
    
    playPowerUp() {
        if (!this.enabled || !this.initialized) return;
        
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = 400;
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
        
        gain.gain.value = this.masterVolume * 0.2;
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
    }
    
    playLaserHum() {
        if (!this.enabled || !this.initialized) return;
        
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.value = 150;
        
        gain.gain.value = this.masterVolume * 0.15;
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    }
    
    playShieldHit() {
        if (!this.enabled || !this.initialized) return;
        
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = 800;
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
        
        gain.gain.value = this.masterVolume * 0.2;
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
    }
    
    playBombWarning() {
        if (!this.enabled || !this.initialized) return;
        
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = 600;
        
        gain.gain.value = this.masterVolume * 0.15;
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
    }
}
