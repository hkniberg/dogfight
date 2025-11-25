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
            // Use PlayerRenderer for remote players
            this.player.draw(ctx);
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

