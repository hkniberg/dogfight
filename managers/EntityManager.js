// EntityManager - Manages non-player entities (powerups, asteroids, shrapnel)
// Coordinates with network for synchronized spawning

class EntityManager {
    constructor(game) {
        this.game = game;
        this.powerUps = [];
        this.asteroid = null;
        this.shrapnel = [];
        this.canvasWidth = game.canvas.width;
        this.canvasHeight = game.canvas.height;
    }
    
    // Update all entities
    update(dt) {
        this.updatePowerUps(dt);
        this.updateAsteroid(dt);
        this.updateShrapnel(dt);
    }
    
    // Update power-ups and check for pickups
    updatePowerUps(dt) {
        for (let powerUp of this.powerUps) {
            powerUp.update(dt);
            
            // Check if any local player picked it up
            for (let playerCtrl of this.game.playerManager.getLocalPlayers()) {
                if (!playerCtrl.alive) continue;
                
                const dist = getDistance(
                    playerCtrl.x, playerCtrl.y,
                    powerUp.x, powerUp.y,
                    this.canvasWidth, this.canvasHeight
                );
                
                if (dist < playerCtrl.radius + powerUp.radius) {
                    this.applyPowerUp(playerCtrl, powerUp.type);
                    powerUp.pickup();
                    
                    // Notify network of pickup
                    if (this.game.network) {
                        this.game.network.sendPowerUpPickup(playerCtrl.id, powerUp.id, powerUp.type);
                    }
                }
            }
        }
        
        // Remove picked up power-ups
        this.powerUps = this.powerUps.filter(p => p.alive);
    }
    
    // Apply power-up effect to player
    applyPowerUp(playerCtrl, type) {
        const player = playerCtrl.player;
        
        switch(type) {
            case PowerUpType.SHIELD:
                if (player.addShield) player.addShield();
                break;
            case PowerUpType.MULTISHOT:
                if (player.activateMultiShot) player.activateMultiShot();
                break;
            case PowerUpType.HOMING:
                if (player.loadHoming) player.loadHoming();
                break;
            case PowerUpType.INVISIBILITY:
                if (player.activateInvisibility) player.activateInvisibility();
                break;
            case PowerUpType.LASER:
                if (player.loadLaser) player.loadLaser();
                break;
            case PowerUpType.BOMB:
                if (player.loadBomb) player.loadBomb();
                break;
            case PowerUpType.REVERSE:
                if (player.loadReverse) player.loadReverse();
                break;
            case PowerUpType.ASTEROID_CHASE:
                if (player.loadAsteroidChase) player.loadAsteroidChase();
                break;
        }
    }
    
    // Apply power-up to remote player (for network sync)
    applyPowerUpToRemote(remotePlayerCtrl, type) {
        const player = remotePlayerCtrl.player;
        
        switch(type) {
            case PowerUpType.SHIELD:
                player.shields = Math.min((player.shields || 0) + 1, 3);
                break;
            case PowerUpType.INVISIBILITY:
                player.invisible = true;
                player.invisibleTime = 0;
                break;
            case PowerUpType.MULTISHOT:
                player.multiShot = true;
                player.multiShotTime = 0;
                break;
            // Ammo-based powerups don't need visual representation on remote players
        }
    }
    
    // Update asteroid
    updateAsteroid(dt) {
        if (this.asteroid) {
            try {
                if (!this.asteroid.update(dt)) {
                    // Asteroid destroyed
                    if (this.game.network) {
                        this.game.network.notifyAsteroidDestroyed();
                    }
                    this.asteroid = null;
                }
            } catch (error) {
                console.error('Error updating asteroid:', error);
                // Clear asteroid to prevent repeated errors
                this.asteroid = null;
                // Re-throw to be caught by game loop
                throw error;
            }
        }
    }
    
    // Update shrapnel
    updateShrapnel(dt) {
        this.shrapnel = this.shrapnel.filter(s => s.update(dt, this.canvasWidth, this.canvasHeight));
    }
    
    // Draw all entities
    draw(ctx) {
        // Draw asteroid
        if (this.asteroid) {
            this.asteroid.draw(ctx);
        }
        
        // Draw shrapnel
        this.shrapnel.forEach(s => s.draw(ctx));
        
        // Draw power-ups
        this.powerUps.forEach(p => p.draw(ctx));
    }
    
    // Spawn power-up from network event
    spawnPowerUp(data) {
        const powerUp = new PowerUp(data.x, data.y, data.type);
        powerUp.id = data.id;
        powerUp.seq = data.seq;
        this.powerUps.push(powerUp);
    }
    
    // Remove power-up (from network event)
    removePowerUp(powerUpId) {
        this.powerUps = this.powerUps.filter(p => p.id !== powerUpId);
    }
    
    // Spawn asteroid from network event
    spawnAsteroid(data) {
        this.asteroid = this.createAsteroidFromData(data);
    }
    
    // Create asteroid from network data
    createAsteroidFromData(data) {
        const asteroid = new Asteroid(data.x, data.y, this.canvasWidth, this.canvasHeight);
        asteroid.size = data.size;
        asteroid.vx = data.vx;
        asteroid.vy = data.vy;
        asteroid.points = data.points;
        asteroid.rotation = data.rotation || 0;
        asteroid.rotationSpeed = data.rotationSpeed || 0;
        return asteroid;
    }
    
    // Damage asteroid (from network event)
    damageAsteroid(x, y, damage) {
        if (this.asteroid && this.asteroid.alive) {
            this.asteroid.takeDamage(x, y, damage);
            this.game.particles.createDebris(x, y, '#888888', 3);
        }
    }
    
    // Destroy asteroid (from network event)
    destroyAsteroid() {
        if (this.asteroid && this.asteroid.alive) {
            this.shrapnel.push(...this.asteroid.createShrapnel());
            this.game.particles.createExplosion(this.asteroid.x, this.asteroid.y, '#888888', 30);
            this.asteroid = null;
        }
    }
    
    // Clear all entities
    clear() {
        this.powerUps = [];
        this.asteroid = null;
        this.shrapnel = [];
    }
}

