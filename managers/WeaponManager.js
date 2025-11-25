// WeaponManager - Centralized weapon lifecycle management
// Handles weapon firing, updates, drawing, and network broadcasting

class WeaponManager {
    constructor(game) {
        this.game = game;
        this.homingMissiles = [];
        this.lasers = [];
        this.bombs = [];
        this.remoteBullets = []; // Bullets from remote players
    }
    
    // Handle player firing weapon
    handlePlayerFire(playerCtrl, targetPlayer) {
        const result = playerCtrl.fire(targetPlayer);
        if (!result) return;
        
        // Handle special effect weapons
        if (result.type === 'reverse') {
            this.handleReverseEffect(playerCtrl);
            return;
        }
        
        if (result.type === 'asteroidChase') {
            this.handleAsteroidChase(playerCtrl, targetPlayer);
            return;
        }
        
        // Add weapons to appropriate arrays
        this.addWeapons(result, playerCtrl);
        
        // Broadcast to network if online
        this.broadcastWeaponFire(playerCtrl, result);
    }
    
    // Add weapons to appropriate arrays
    addWeapons(result, playerCtrl) {
        const weapons = Array.isArray(result.weapon) ? result.weapon : [result.weapon];
        
        switch(result.type) {
            case 'bullets':
                // Bullets already added to player.bullets in Player.fire()
                this.game.audio.playShoot();
                break;
                
            case 'homing':
                this.homingMissiles.push(...weapons);
                this.game.audio.playShoot();
                break;
                
            case 'laser':
                this.lasers.push(...weapons);
                this.game.audio.playLaserHum();
                break;
                
            case 'bomb':
                this.bombs.push(...weapons);
                break;
        }
    }
    
    // Handle reverse effect power-up
    handleReverseEffect(playerCtrl) {
        const opponents = this.game.playerManager.getOpponents(playerCtrl.id);
        
        for (const opponent of opponents) {
            if (opponent.isLocal()) {
                opponent.player.activateReverse();
            } else {
                // For remote players, just set the flag
                opponent.player.reversed = true;
                opponent.player.reversedTime = 0;
            }
            
            this.game.particles.createExplosion(opponent.x, opponent.y, '#ffff00', 15, 150);
            
            // Reverse all existing homing missiles from this opponent
            for (let missile of this.homingMissiles) {
                if (missile.ownerId === opponent.id) {
                    missile.targetPlayer = opponent.player;
                }
            }
        }
        
        this.game.audio.playPowerUp();
        
        // Send to network
        if (this.game.network && this.game.network.constructor.name === 'PeerNetworkManager') {
            this.game.network.sendReverseEffect(playerCtrl.id, opponents.map(p => p.id));
        }
    }
    
    // Handle asteroid chase power-up
    handleAsteroidChase(playerCtrl, targetPlayer) {
        if (this.game.asteroid && this.game.asteroid.alive) {
            let chaseTarget = targetPlayer;
            
            if (!chaseTarget) {
                const opponents = this.game.playerManager.getOpponents(playerCtrl.id);
                if (opponents.length > 0) {
                    chaseTarget = opponents[0].player;
                }
            }
            
            if (chaseTarget) {
                this.game.asteroid.startChasing(chaseTarget);
                this.game.audio.playPowerUp();
                this.game.particles.createExplosion(this.game.asteroid.x, this.game.asteroid.y, '#ff00ff', 20, 200);
                
                // Send to network
                if (this.game.network && this.game.network.constructor.name === 'PeerNetworkManager') {
                    this.game.network.sendAsteroidChase(chaseTarget.id);
                }
            }
        }
    }
    
    // Broadcast weapon fire to network
    broadcastWeaponFire(playerCtrl, result) {
        if (!this.game.network || this.game.network.constructor.name !== 'PeerNetworkManager') {
            return;
        }
        
        const weaponData = {
            weaponType: result.type,
            x: playerCtrl.x,
            y: playerCtrl.y,
            angle: playerCtrl.angle
        };
        
        // For bombs, include if it's homing
        if (result.type === 'bomb' && result.weapon && result.weapon.length > 0) {
            weaponData.isHomingBomb = result.weapon[0].isHoming;
        }
        
        this.game.network.sendWeaponFire(playerCtrl.id, weaponData);
    }
    
    // Create weapon from network event (for remote players)
    createWeaponFromNetwork(data) {
        // Skip if it's one of our local players
        if (this.game.playerManager.isLocalPlayer(data.playerId)) {
            return;
        }
        
        // Find the player who fired
        const firingPlayerCtrl = this.game.playerManager.getPlayer(data.playerId);
        if (!firingPlayerCtrl) {
            console.warn('[WeaponManager] Unknown player fired weapon:', data.playerId);
            return;
        }
        
        const color = firingPlayerCtrl.color;
        
        // Create weapons based on type
        switch(data.weaponType) {
            case 'bullets':
                const bullet = new Bullet(data.x, data.y, data.angle, color, data.playerId);
                this.remoteBullets.push(bullet);
                this.game.audio.playShoot();
                break;
                
            case 'homing':
                const targetPlayer = this.game.playerManager.findTarget(data.playerId);
                const missile = new HomingMissile(data.x, data.y, data.angle, color, data.playerId, targetPlayer);
                this.homingMissiles.push(missile);
                this.game.audio.playShoot();
                break;
                
            case 'laser':
                const laser = new Laser(firingPlayerCtrl.player, color, data.playerId, 0);
                this.lasers.push(laser);
                this.game.audio.playLaserHum();
                break;
                
            case 'bomb':
                let targetPlayerForBomb = null;
                if (data.isHomingBomb) {
                    targetPlayerForBomb = this.game.playerManager.findTarget(data.playerId);
                }
                const bomb = new Bomb(data.x, data.y, data.angle, color, data.playerId, targetPlayerForBomb);
                this.bombs.push(bomb);
                break;
        }
    }
    
    // Update all weapons
    update(dt, canvasWidth, canvasHeight) {
        // Update homing missiles
        this.homingMissiles = this.homingMissiles.filter(m => 
            m.update(dt, canvasWidth, canvasHeight)
        );
        
        // Update lasers
        this.lasers = this.lasers.filter(l => l.update(dt));
        
        // Update bombs
        const allPlayers = this.game.playerManager.getAllPlayers().map(p => p.player);
        this.bombs = this.bombs.filter(b => {
            const stillAlive = b.update(dt, canvasWidth, canvasHeight, allPlayers);
            if (b.detonated) {
                this.handleBombExplosion(b);
            }
            return stillAlive;
        });
        
        // Update remote bullets
        this.remoteBullets = this.remoteBullets.filter(b => 
            b.update(dt, canvasWidth, canvasHeight)
        );
    }
    
    // Handle bomb explosion
    handleBombExplosion(bomb) {
        this.game.audio.playExplosion();
        this.game.particles.createShockwave(bomb.x, bomb.y, bomb.explosionRadius, bomb.color, 0.6);
        this.game.particles.createExplosion(bomb.x, bomb.y, bomb.color, 40, 300);
        
        // Damage players in radius (only local players - they report their own hits)
        for (let playerCtrl of this.game.playerManager.getLocalPlayers()) {
            if (!playerCtrl.alive || playerCtrl.invulnerable) continue;
            
            const dist = getDistance(
                playerCtrl.x, playerCtrl.y,
                bomb.x, bomb.y,
                this.game.canvas.width, this.game.canvas.height
            );
            
            if (dist < bomb.explosionRadius) {
                const attacker = this.game.playerManager.getPlayer(bomb.ownerId);
                this.game.handlePlayerHit(playerCtrl.player, attacker ? attacker.player : null);
            }
        }
        
        // Destroy asteroid if in range
        if (this.game.asteroid && this.game.asteroid.alive) {
            const dist = getDistance(
                this.game.asteroid.x, this.game.asteroid.y,
                bomb.x, bomb.y,
                this.game.canvas.width, this.game.canvas.height
            );
            
            if (dist < bomb.explosionRadius) {
                const isHostOrLocal = !this.game.network || 
                                      this.game.network.constructor.name === 'LocalNetworkManager' ||
                                      (this.game.network.constructor.name === 'PeerNetworkManager' && this.game.network.isHost);
                
                if (isHostOrLocal) {
                    this.game.asteroid.instantDestroy();
                    this.game.shrapnel.push(...this.game.asteroid.createShrapnel());
                    this.game.particles.createExplosion(this.game.asteroid.x, this.game.asteroid.y, '#888888', 30);
                    
                    if (this.game.network) {
                        this.game.network.notifyAsteroidDestroyed();
                    }
                }
            }
        }
    }
    
    // Draw all weapons
    draw(ctx, canvasWidth, canvasHeight) {
        // Draw homing missiles
        this.homingMissiles.forEach(m => m.draw(ctx));
        
        // Draw lasers
        this.lasers.forEach(l => l.draw(ctx, canvasWidth, canvasHeight));
        
        // Draw bombs
        this.bombs.forEach(b => b.draw(ctx));
        
        // Draw remote bullets
        this.remoteBullets.forEach(b => b.draw(ctx));
    }
    
    // Clear all weapons
    clear() {
        this.homingMissiles = [];
        this.lasers = [];
        this.bombs = [];
        this.remoteBullets = [];
    }
}

