// CollisionSystem - Centralized collision detection for all game entities
// Eliminates duplicate collision code for local vs remote players

class CollisionSystem {
    constructor(game) {
        this.game = game;
        this.canvasWidth = game.canvas.width;
        this.canvasHeight = game.canvas.height;
    }
    
    // Main entry point - check all collisions
    checkAll() {
        try {
            this.checkPlayerVsBullets();
            this.checkPlayerVsHomingMissiles();
            this.checkPlayerVsLasers();
            this.checkPlayerVsShrapnel();
            this.checkPlayerVsAsteroid();
            this.checkPlayerVsPlayer();
            this.checkWeaponsVsAsteroid();
            this.checkBombsVsBullets();
            this.checkBombsVsAsteroid();
            this.checkLasersVsAsteroid();
        } catch (error) {
            console.error('Error in collision detection:', error);
            // Re-throw to be caught by game loop
            throw error;
        }
    }
    
    // Helper: Check if a player can be hit
    canBeHit(playerCtrl) {
        return playerCtrl.alive && !playerCtrl.invulnerable;
    }
    
    // Helper: Check collision between two objects
    checkCollision(obj1, obj2) {
        const dist = getDistance(
            obj1.x, obj1.y,
            obj2.x, obj2.y,
            this.canvasWidth, this.canvasHeight
        );
        return dist < obj1.radius + obj2.radius;
    }
    
    // Player vs Bullets (all bullets from all sources)
    checkPlayerVsBullets() {
        const allPlayers = this.game.playerManager.getAllPlayers();
        
        for (let playerCtrl of allPlayers) {
            if (!this.canBeHit(playerCtrl)) continue;
            
            // Check against local player bullets
            for (let localPlayerCtrl of this.game.playerManager.getLocalPlayers()) {
                if (!localPlayerCtrl.player.bullets) continue;
                
                for (let bullet of localPlayerCtrl.player.bullets) {
                    if (!bullet.alive) continue;
                    if (bullet.ownerId === playerCtrl.id) continue; // Can't hit self
                    
                    const dist = getDistance(
                        playerCtrl.x, playerCtrl.y,
                        bullet.x, bullet.y,
                        this.canvasWidth, this.canvasHeight
                    );
                    
                    if (dist < playerCtrl.radius + bullet.radius) {
                        bullet.alive = false;
                        const attacker = this.game.playerManager.getPlayer(bullet.ownerId);
                        this.game.handlePlayerHit(playerCtrl.player, attacker ? attacker.player : null);
                    }
                }
            }
            
            // Check against remote bullets (from weaponManager or game)
            if (this.game.remoteBullets) {
                for (let bullet of this.game.remoteBullets) {
                    if (!bullet.alive) continue;
                    if (bullet.ownerId === playerCtrl.id) continue;
                    
                    const dist = getDistance(
                        playerCtrl.x, playerCtrl.y,
                        bullet.x, bullet.y,
                        this.canvasWidth, this.canvasHeight
                    );
                    
                    if (dist < playerCtrl.radius + bullet.radius) {
                        bullet.alive = false;
                        const attacker = this.game.playerManager.getPlayer(bullet.ownerId);
                        this.game.handlePlayerHit(playerCtrl.player, attacker ? attacker.player : null);
                    }
                }
            }
        }
    }
    
    // Player vs Homing Missiles
    checkPlayerVsHomingMissiles() {
        const allPlayers = this.game.playerManager.getAllPlayers();
        
        for (let playerCtrl of allPlayers) {
            if (!this.canBeHit(playerCtrl)) continue;
            
            for (let missile of this.game.homingMissiles) {
                const dist = getDistance(
                    playerCtrl.x, playerCtrl.y,
                    missile.x, missile.y,
                    this.canvasWidth, this.canvasHeight
                );
                
                if (dist < playerCtrl.radius + missile.radius) {
                    missile.alive = false;
                    const attacker = this.game.playerManager.getPlayer(missile.ownerId);
                    this.game.handlePlayerHit(playerCtrl.player, attacker ? attacker.player : null);
                }
            }
        }
    }
    
    // Player vs Lasers
    checkPlayerVsLasers() {
        const allPlayers = this.game.playerManager.getAllPlayers();
        
        for (let playerCtrl of allPlayers) {
            if (!this.canBeHit(playerCtrl)) continue;
            
            for (let laser of this.game.lasers) {
                if (laser.ownerId === playerCtrl.id) continue;
                
                if (laser.checkHit(playerCtrl.x, playerCtrl.y, playerCtrl.radius, this.canvasWidth, this.canvasHeight)) {
                    if (playerCtrl.shields > 0) {
                        playerCtrl.removeShield();
                        laser.alive = false;
                        this.game.audio.playShieldHit();
                    } else {
                        const attacker = this.game.playerManager.getPlayer(laser.ownerId);
                        this.game.handlePlayerHit(playerCtrl.player, attacker ? attacker.player : null);
                    }
                }
            }
        }
    }
    
    // Player vs Shrapnel
    checkPlayerVsShrapnel() {
        const allPlayers = this.game.playerManager.getAllPlayers();
        
        for (let playerCtrl of allPlayers) {
            if (!this.canBeHit(playerCtrl)) continue;
            
            for (let shard of this.game.shrapnel) {
                const dist = getDistance(
                    playerCtrl.x, playerCtrl.y,
                    shard.x, shard.y,
                    this.canvasWidth, this.canvasHeight
                );
                
                if (dist < playerCtrl.radius + shard.radius) {
                    shard.alive = false;
                    
                    if (playerCtrl.shields > 0) {
                        playerCtrl.removeShield();
                        this.game.audio.playShieldHit();
                        this.game.particles.createExplosion(playerCtrl.x, playerCtrl.y, '#0066ff', 10, 100);
                        
                        // Change direction to move away from shrapnel
                        if (playerCtrl.isLocal()) {
                            const awayAngle = Math.atan2(
                                playerCtrl.y - shard.y,
                                playerCtrl.x - shard.x
                            );
                            playerCtrl.player.angle = awayAngle;
                        }
                    } else {
                        this.game.handlePlayerHit(playerCtrl.player, null);
                    }
                }
            }
        }
    }
    
    // Player vs Asteroid
    checkPlayerVsAsteroid() {
        if (!this.game.asteroid || !this.game.asteroid.alive) return;
        
        const allPlayers = this.game.playerManager.getAllPlayers();
        
        for (let playerCtrl of allPlayers) {
            if (!this.canBeHit(playerCtrl)) continue;
            
            const dist = getDistance(
                playerCtrl.x, playerCtrl.y,
                this.game.asteroid.x, this.game.asteroid.y,
                this.canvasWidth, this.canvasHeight
            );
            
            if (dist < playerCtrl.radius + this.game.asteroid.size) {
                if (playerCtrl.shields > 0) {
                    playerCtrl.removeShield();
                    this.game.audio.playShieldHit();
                    this.game.particles.createExplosion(playerCtrl.x, playerCtrl.y, '#0066ff', 10, 100);
                    
                    // Only bounce local players
                    if (playerCtrl.isLocal()) {
                        const awayAngle = Math.atan2(
                            playerCtrl.y - this.game.asteroid.y,
                            playerCtrl.x - this.game.asteroid.x
                        );
                        
                        playerCtrl.player.angle = awayAngle;
                        
                        const pushDistance = (playerCtrl.radius + this.game.asteroid.size) - dist + GAME_SETTINGS.collision.asteroidPushDistance;
                        playerCtrl.player.x += Math.cos(awayAngle) * pushDistance;
                        playerCtrl.player.y += Math.sin(awayAngle) * pushDistance;
                    }
                } else {
                    this.game.handlePlayerHit(playerCtrl.player, null);
                }
            }
        }
    }
    
    // Player vs Player (only for local players)
    checkPlayerVsPlayer() {
        const localPlayers = this.game.playerManager.getLocalPlayers();
        
        if (localPlayers.length < 2) return;
        
        for (let i = 0; i < localPlayers.length; i++) {
            for (let j = i + 1; j < localPlayers.length; j++) {
                const p1 = localPlayers[i];
                const p2 = localPlayers[j];
                
                if (!p1.alive || !p2.alive || p1.invulnerable || p2.invulnerable) continue;
                
                const dist = getDistance(
                    p1.x, p1.y,
                    p2.x, p2.y,
                    this.canvasWidth, this.canvasHeight
                );
                
                if (dist < p1.radius + p2.radius) {
                    this.handlePlayerPlayerCollision(p1, p2, dist);
                }
            }
        }
    }
    
    // Helper: Handle player-player collision
    handlePlayerPlayerCollision(p1, p2, dist) {
        const p1HasShield = p1.shields > 0;
        const p2HasShield = p2.shields > 0;
        
        if (p1HasShield && p2HasShield) {
            // Both have shields - both lose shield and bounce apart
            p1.removeShield();
            p2.removeShield();
            this.game.audio.playShieldHit();
            this.game.particles.createExplosion(p1.x, p1.y, '#0066ff', 10, 100);
            this.game.particles.createExplosion(p2.x, p2.y, '#0066ff', 10, 100);
            
            const collisionAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            
            p1.player.angle = collisionAngle + Math.PI;
            p2.player.angle = collisionAngle;
            
            const overlap = (p1.radius + p2.radius) - dist;
            const pushDistance = (overlap / 2) + GAME_SETTINGS.collision.playerPushDistance;
            
            p1.player.x -= Math.cos(collisionAngle) * pushDistance;
            p1.player.y -= Math.sin(collisionAngle) * pushDistance;
            p2.player.x += Math.cos(collisionAngle) * pushDistance;
            p2.player.y += Math.sin(collisionAngle) * pushDistance;
            
        } else if (p1HasShield && !p2HasShield) {
            // P1 has shield, P2 doesn't
            this.game.handlePlayerHit(p2.player, p1.player);
            p1.removeShield();
            this.game.audio.playShieldHit();
            this.game.particles.createExplosion(p1.x, p1.y, '#0066ff', 10, 100);
            
            const awayAngle = Math.atan2(p1.y - p2.y, p1.x - p2.x);
            p1.player.angle = awayAngle;
            p1.player.x += Math.cos(awayAngle) * GAME_SETTINGS.collision.playerPushDistance;
            p1.player.y += Math.sin(awayAngle) * GAME_SETTINGS.collision.playerPushDistance;
            
        } else if (!p1HasShield && p2HasShield) {
            // P2 has shield, P1 doesn't
            this.game.handlePlayerHit(p1.player, p2.player);
            p2.removeShield();
            this.game.audio.playShieldHit();
            this.game.particles.createExplosion(p2.x, p2.y, '#0066ff', 10, 100);
            
            const awayAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            p2.player.angle = awayAngle;
            p2.player.x += Math.cos(awayAngle) * GAME_SETTINGS.collision.playerPushDistance;
            p2.player.y += Math.sin(awayAngle) * GAME_SETTINGS.collision.playerPushDistance;
            
        } else {
            // Neither has shield - both destroyed
            this.game.handlePlayerHit(p1.player, null);
            this.game.handlePlayerHit(p2.player, null);
        }
    }
    
    // Weapons vs Asteroid
    checkWeaponsVsAsteroid() {
        if (!this.game.asteroid || !this.game.asteroid.alive) return;
        
        const isHostOrLocal = !this.game.network || 
                              this.game.network.constructor.name === 'LocalNetworkManager' ||
                              (this.game.network.constructor.name === 'PeerNetworkManager' && this.game.network.isHost);
        
        // Bullets vs Asteroid
        for (let playerCtrl of this.game.playerManager.getLocalPlayers()) {
            if (!playerCtrl.player.bullets) continue;
            
            for (let bullet of playerCtrl.player.bullets) {
                if (!bullet.alive) continue;
                
                const dist = getDistance(
                    bullet.x, bullet.y,
                    this.game.asteroid.x, this.game.asteroid.y,
                    this.canvasWidth, this.canvasHeight
                );
                
                if (dist < bullet.radius + this.game.asteroid.size) {
                    bullet.alive = false;
                    
                    if (isHostOrLocal) {
                        this.game.asteroid.takeDamage(bullet.x, bullet.y, 1);
                        this.game.particles.createDebris(bullet.x, bullet.y, '#888888', 3);
                        
                        if (this.game.network && this.game.network.constructor.name === 'PeerNetworkManager') {
                            this.game.network.sendAsteroidDamage(bullet.x, bullet.y, 1);
                        }
                        
                        if (!this.game.asteroid.alive) {
                            this.game.particles.createExplosion(this.game.asteroid.x, this.game.asteroid.y, '#888888', 20);
                            if (this.game.network) {
                                this.game.network.notifyAsteroidDestroyed();
                            }
                        }
                    }
                }
            }
        }
        
        // Remote bullets vs Asteroid (only host checks)
        if (this.game.remoteBullets && isHostOrLocal) {
            const isHost = this.game.network && 
                          this.game.network.constructor.name === 'PeerNetworkManager' && 
                          this.game.network.isHost;
            
            if (isHost) {
                for (let bullet of this.game.remoteBullets) {
                    if (!bullet.alive) continue;
                    
                    const dist = getDistance(
                        bullet.x, bullet.y,
                        this.game.asteroid.x, this.game.asteroid.y,
                        this.canvasWidth, this.canvasHeight
                    );
                    
                    if (dist < bullet.radius + this.game.asteroid.size) {
                        bullet.alive = false;
                        
                        this.game.asteroid.takeDamage(bullet.x, bullet.y, 1);
                        this.game.particles.createDebris(bullet.x, bullet.y, '#888888', 3);
                        this.game.network.sendAsteroidDamage(bullet.x, bullet.y, 1);
                        
                        if (!this.game.asteroid.alive) {
                            this.game.particles.createExplosion(this.game.asteroid.x, this.game.asteroid.y, '#888888', 20);
                            this.game.network.notifyAsteroidDestroyed();
                        }
                    }
                }
            }
        }
        
        // Homing Missiles vs Asteroid
        for (let missile of this.game.homingMissiles) {
            const dist = getDistance(
                missile.x, missile.y,
                this.game.asteroid.x, this.game.asteroid.y,
                this.canvasWidth, this.canvasHeight
            );
            
            if (dist < missile.radius + this.game.asteroid.size) {
                missile.alive = false;
                this.game.audio.playExplosion();
                this.game.particles.createExplosion(missile.x, missile.y, '#ff0000', 20, 200);
                
                if (isHostOrLocal) {
                    const damage = GAME_SETTINGS.weapons.homingMissile.asteroidDamage;
                    this.game.asteroid.takeDamage(missile.x, missile.y, damage);
                    
                    if (this.game.network && this.game.network.constructor.name === 'PeerNetworkManager') {
                        this.game.network.sendAsteroidDamage(missile.x, missile.y, damage);
                    }
                    
                    if (!this.game.asteroid.alive) {
                        this.game.shrapnel.push(...this.game.asteroid.createShrapnel());
                        this.game.particles.createExplosion(this.game.asteroid.x, this.game.asteroid.y, '#888888', 30);
                        if (this.game.network) {
                            this.game.network.notifyAsteroidDestroyed();
                        }
                    }
                }
            }
        }
    }
    
    // Bombs vs Bullets (remote detonation)
    checkBombsVsBullets() {
        for (let bomb of this.game.bombs) {
            if (!bomb.alive) continue;
            
            for (let playerCtrl of this.game.playerManager.getLocalPlayers()) {
                if (!playerCtrl.player.bullets) continue;
                
                for (let bullet of playerCtrl.player.bullets) {
                    if (!bullet.alive) continue;
                    
                    const dist = getDistance(
                        bullet.x, bullet.y,
                        bomb.x, bomb.y,
                        this.canvasWidth, this.canvasHeight
                    );
                    
                    if (dist < bullet.radius + bomb.radius) {
                        bullet.alive = false;
                        bomb.detonate();
                    }
                }
            }
        }
    }
    
    // Bombs vs Asteroid
    checkBombsVsAsteroid() {
        if (!this.game.asteroid || !this.game.asteroid.alive) return;
        
        for (let bomb of this.game.bombs) {
            if (!bomb.alive) continue;
            
            const dist = getDistance(
                bomb.x, bomb.y,
                this.game.asteroid.x, this.game.asteroid.y,
                this.canvasWidth, this.canvasHeight
            );
            
            if (dist < bomb.radius + this.game.asteroid.size) {
                bomb.detonate();
            }
        }
    }
    
    // Lasers vs Asteroid (blocked but don't damage)
    checkLasersVsAsteroid() {
        if (!this.game.asteroid || !this.game.asteroid.alive) return;
        
        for (let laser of this.game.lasers) {
            if (!laser.alive) continue;
            
            if (laser.checkHit(this.game.asteroid.x, this.game.asteroid.y, this.game.asteroid.size, this.canvasWidth, this.canvasHeight)) {
                laser.alive = false;
                this.game.particles.createDebris(this.game.asteroid.x, this.game.asteroid.y, laser.color, 5);
            }
        }
    }
}

