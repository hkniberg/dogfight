// PlayerController - Unified interface for local and remote players
// Eliminates the need for separate handling of Player vs RemotePlayer

class PlayerController {
    constructor(player) {
        this.player = player; // Can be Player or RemotePlayer
    }
    
    // Unified property accessors that work for both types
    get x() {
        if (this.player.x !== undefined) {
            return this.player.x;
        }
        return this.player.displayPos?.x || 0;
    }
    
    get y() {
        if (this.player.y !== undefined) {
            return this.player.y;
        }
        return this.player.displayPos?.y || 0;
    }
    
    get angle() {
        if (this.player.angle !== undefined) {
            return this.player.angle;
        }
        return this.player.displayPos?.angle || 0;
    }
    
    get alive() {
        return this.player.alive !== undefined ? this.player.alive : true;
    }
    
    get shields() {
        return this.player.shields || 0;
    }
    
    get invulnerable() {
        return this.player.invulnerable || false;
    }
    
    get invisible() {
        return this.player.invisible || false;
    }
    
    get color() {
        return this.player.color;
    }
    
    get name() {
        return this.player.name;
    }
    
    get id() {
        return this.player.id;
    }
    
    get radius() {
        return this.player.radius || GAME_SETTINGS.player.radius;
    }
    
    get multiShot() {
        return this.player.multiShot || false;
    }
    
    get reversed() {
        return this.player.reversed || false;
    }
    
    // Type checking methods
    isLocal() {
        return this.player.constructor.name === 'Player';
    }
    
    isRemote() {
        return this.player.constructor.name === 'RemotePlayer';
    }
    
    // Unified update method
    update(dt, canvasWidth, canvasHeight) {
        if (this.isLocal()) {
            this.player.update(dt, canvasWidth, canvasHeight);
            this.player.updateBullets(dt, canvasWidth, canvasHeight);
        } else {
            this.player.update(dt);
        }
    }
    
    // Unified draw method
    draw(ctx, canvasWidth, canvasHeight) {
        if (!this.alive) return;
        
        if (this.isLocal()) {
            this.player.draw(ctx);
            this.player.drawBullets(ctx);
        } else {
            // For remote players, we need to draw them manually
            // This will be refactored later with PlayerRenderer
            this.drawRemote(ctx);
        }
    }
    
    // Temporary method for drawing remote players
    // Will be replaced by PlayerRenderer in Phase 7
    drawRemote(ctx) {
        const pos = this.player.displayPos;
        const size = 12;
        
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(pos.angle);
        
        // Invisibility effect
        if (this.player.invisible) {
            const pulse = (Math.sin(Date.now() * GAME_SETTINGS.powerups.invisibility.pulseSpeed) + 1) / 2;
            const alphaRange = GAME_SETTINGS.powerups.invisibility.maxAlpha - GAME_SETTINGS.powerups.invisibility.minAlpha;
            ctx.globalAlpha = GAME_SETTINGS.powerups.invisibility.minAlpha + (pulse * alphaRange);
        }
        
        // Invulnerability flashing
        if (this.player.invulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        
        // Reversed controls indicator
        if (this.player.reversed) {
            const reversePulse = (Math.sin(Date.now() * 0.005) + 1) / 2;
            ctx.fillStyle = '#ffff00';
            ctx.shadowBlur = 15 + reversePulse * 10;
            ctx.shadowColor = '#ffff00';
            ctx.globalAlpha = 0.7 + reversePulse * 0.3;
            ctx.font = 'bold 20px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', 0, -25);
            ctx.globalAlpha = 1;
        }
        
        // Draw shields
        if (this.player.shields > 0) {
            for (let i = 0; i < this.player.shields; i++) {
                const shieldRadius = size + 8 + (i * 6);
                const shieldWidth = 2 + i;
                ctx.strokeStyle = '#0066ff';
                ctx.lineWidth = shieldWidth;
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#0066ff';
                ctx.beginPath();
                ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        
        // Draw ship body (triangle)
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size, size / 2);
        ctx.lineTo(-size, -size / 2);
        ctx.closePath();
        
        ctx.fillStyle = this.player.color;
        ctx.fill();
        ctx.strokeStyle = this.player.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.player.color;
        ctx.stroke();
        
        // Draw multishot wings
        if (this.player.multiShot) {
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ffaa00';
            ctx.beginPath();
            ctx.moveTo(-5, -size / 2);
            ctx.lineTo(-5, -size / 2 - 5);
            ctx.moveTo(-5, size / 2);
            ctx.lineTo(-5, size / 2 + 5);
            ctx.stroke();
        }
        
        ctx.restore();
        
        // Draw name above ship
        if (!this.player.invisible || this.player.invulnerable) {
            ctx.save();
            if (this.player.invisible) {
                const pulse = (Math.sin(Date.now() * GAME_SETTINGS.powerups.invisibility.pulseSpeed) + 1) / 2;
                const alphaRange = GAME_SETTINGS.powerups.invisibility.maxAlpha - GAME_SETTINGS.powerups.invisibility.minAlpha;
                ctx.globalAlpha = GAME_SETTINGS.powerups.invisibility.minAlpha + (pulse * alphaRange);
            }
            ctx.fillStyle = this.player.color;
            ctx.shadowBlur = 5;
            ctx.shadowColor = this.player.color;
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.player.name, pos.x, pos.y - 25);
            ctx.restore();
        }
    }
    
    // Methods that only work for local players
    fire(targetPlayer) {
        if (this.isLocal()) {
            return this.player.fire(targetPlayer);
        }
        return null;
    }
    
    removeShield() {
        if (this.player.removeShield) {
            return this.player.removeShield();
        }
        if (this.player.shields > 0) {
            this.player.shields--;
            return true;
        }
        return false;
    }
    
    die() {
        if (this.player.die) {
            this.player.die();
        } else {
            this.player.alive = false;
        }
    }
    
    respawn(x, y, angle) {
        if (this.player.respawn) {
            this.player.respawn(x, y, angle);
        }
    }
}

