// Particle system for visual effects

class Particle {
    constructor(x, y, vx, vy, color, size, lifetime) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.lifetime = lifetime;
        this.age = 0;
        this.alpha = 1;
    }
    
    update(dt, canvasWidth, canvasHeight) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Wrap around screen
        const wrapped = wrapPosition(this.x, this.y, canvasWidth, canvasHeight);
        this.x = wrapped.x;
        this.y = wrapped.y;
        
        this.age += dt;
        this.alpha = 1 - (this.age / this.lifetime);
        
        return this.age < this.lifetime;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Shockwave {
    constructor(x, y, maxRadius, color, duration) {
        this.x = x;
        this.y = y;
        this.maxRadius = maxRadius;
        this.color = color;
        this.duration = duration;
        this.age = 0;
        this.radius = 0;
    }
    
    update(dt) {
        this.age += dt;
        this.radius = (this.age / this.duration) * this.maxRadius;
        return this.age < this.duration;
    }
    
    draw(ctx) {
        const alpha = 1 - (this.age / this.duration);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.shockwaves = [];
    }
    
    createExplosion(x, y, color, count = 20, speed = 200) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + random(-0.2, 0.2);
            const velocity = random(speed * 0.5, speed);
            const vx = Math.cos(angle) * velocity;
            const vy = Math.sin(angle) * velocity;
            const size = random(2, 5);
            const lifetime = random(0.3, 0.8);
            
            this.particles.push(new Particle(x, y, vx, vy, color, size, lifetime));
        }
    }
    
    createShockwave(x, y, radius, color, duration = 0.5) {
        this.shockwaves.push(new Shockwave(x, y, radius, color, duration));
    }
    
    createTrail(x, y, color, speed = 0) {
        // Create a small trail particle
        const vx = random(-20, 20);
        const vy = random(-20, 20);
        const size = random(1, 3);
        const lifetime = random(0.1, 0.3);
        
        this.particles.push(new Particle(x, y, vx, vy, color, size, lifetime));
    }
    
    createDebris(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = random(0, Math.PI * 2);
            const velocity = random(50, 150);
            const vx = Math.cos(angle) * velocity;
            const vy = Math.sin(angle) * velocity;
            const size = random(1, 3);
            const lifetime = random(0.5, 1.5);
            
            this.particles.push(new Particle(x, y, vx, vy, color, size, lifetime));
        }
    }
    
    update(dt, canvasWidth, canvasHeight) {
        this.particles = this.particles.filter(p => p.update(dt, canvasWidth, canvasHeight));
        this.shockwaves = this.shockwaves.filter(s => s.update(dt));
    }
    
    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
        this.shockwaves.forEach(s => s.draw(ctx));
    }
    
    clear() {
        this.particles = [];
        this.shockwaves = [];
    }
}
