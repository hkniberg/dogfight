// GameNetworkFacade - Separates network concerns from gameplay logic
// Provides game-specific interface over NetworkManager
// Eliminates all network type checking from game.js

class GameNetworkFacade {
    constructor(network, game) {
        this.network = network;
        this.game = game;
        
        if (this.network) {
            this.setupCallbacks();
        }
    }
    
    // Check if we're in online mode
    isOnlineMode() {
        return this.network && this.network.constructor.name === 'PeerNetworkManager';
    }
    
    // Check if we're the host
    isHost() {
        return this.isOnlineMode() && this.network.isHost;
    }
    
    // Setup all network event callbacks
    setupCallbacks() {
        this.network.onPlayerJoined((data) => this.handlePlayerJoined(data));
        this.network.onPlayerUpdate((data) => this.handlePlayerUpdate(data));
        this.network.onWeaponFired((data) => this.handleWeaponFired(data));
        this.network.onPlayerDied((data) => this.handlePlayerDied(data));
        this.network.onPlayerLeft((data) => this.handlePlayerLeft(data));
        this.network.onPowerUpSpawned((data) => this.handlePowerUpSpawned(data));
        this.network.onPowerUpCollected((data) => this.handlePowerUpCollected(data));
        this.network.onAsteroidSpawned((data) => this.handleAsteroidSpawned(data));
        this.network.onAsteroidDamaged((data) => this.handleAsteroidDamaged(data));
        this.network.onAsteroidDestroyed(() => this.handleAsteroidDestroyed());
        this.network.onReverseEffect((data) => this.handleReverseEffect(data));
        this.network.onAsteroidChase((data) => this.handleAsteroidChase(data));
    }
    
    // === Network Event Handlers (convert network events to game actions) ===
    
    handlePlayerJoined(data) {
        console.log(`[GameNetwork] Player joined: ${data.name} (ID: ${data.id})`);
        
        // Don't create remote player for ourselves
        if (this.game.playerManager.isLocalPlayer(data.id)) return;
        
        // Create remote player
        const remotePlayer = new RemotePlayer(data.id, data.name, data.color);
        remotePlayer.displayPos = {
            x: Math.random() * this.game.canvas.width,
            y: Math.random() * this.game.canvas.height,
            angle: Math.random() * Math.PI * 2
        };
        remotePlayer.targetPos = { ...remotePlayer.displayPos };
        
        this.game.playerManager.addPlayer(remotePlayer, false);
        
        // Update score display
        this.game.ui.initScores(this.game.playerManager.getAllPlayers().map(p => p.player));
    }
    
    handlePlayerUpdate(data) {
        const playerCtrl = this.game.playerManager.getPlayer(data.id);
        if (playerCtrl && playerCtrl.isRemote()) {
            playerCtrl.player.onNetworkUpdate(data);
        }
    }
    
    handleWeaponFired(data) {
        console.log(`[GameNetwork] Weapon fired by player ${data.playerId}: ${data.weaponType}`);
        
        // Skip if it's one of our local players
        if (this.game.playerManager.isLocalPlayer(data.playerId)) {
            return;
        }
        
        // Create weapon from network data
        this.game.weaponManager.createWeaponFromNetwork(data);
    }
    
    handlePlayerDied(data) {
        console.log(`[GameNetwork] Player ${data.victimId} killed by ${data.killerId}`);
        
        // Skip if this is our own local player (we already handled the death locally)
        if (this.game.playerManager.isLocalPlayer(data.victimId)) {
            console.log('[GameNetwork] Ignoring death of our own local player');
            return;
        }
        
        // Get victim and attacker
        const victimCtrl = this.game.playerManager.getPlayer(data.victimId);
        const attackerCtrl = data.killerId ? this.game.playerManager.getPlayer(data.killerId) : null;
        
        if (!victimCtrl) {
            console.warn('[GameNetwork] Victim not found:', data.victimId);
            return;
        }
        
        // Visual/audio effects for the death
        this.game.audio.playExplosion();
        this.game.particles.createExplosion(victimCtrl.x, victimCtrl.y, victimCtrl.color, 30);
        
        // Mark remote player as dead (will be set to alive again via network update when they respawn)
        victimCtrl.player.alive = false;
        
        // Update score
        if (attackerCtrl) {
            const attacker = attackerCtrl.player;
            const currentScore = this.game.playerScores.get(attacker.id) || 0;
            this.game.playerScores.set(attacker.id, currentScore + 1);
            this.game.ui.updatePlayerScore(attacker.id, currentScore + 1);
            
            // Check for win
            if (currentScore + 1 >= this.game.winScore && !this.game.matchWon) {
                this.game.endGame(attacker);
            }
        }
    }
    
    handlePlayerLeft(data) {
        console.log(`[GameNetwork] Player left: ${data.id}`);
        
        // Check if host left (game over for clients)
        if (data.isHost) {
            alert('Host disconnected. Returning to menu.');
            this.game.returnToMenu();
            return;
        }
        
        // Remove remote player
        this.game.playerManager.removePlayer(data.id);
        
        // Update score display
        const allPlayers = this.game.playerManager.getAllPlayers().map(p => p.player);
        this.game.ui.initScores(allPlayers);
    }
    
    handlePowerUpSpawned(data) {
        this.game.entityManager.spawnPowerUp(data);
    }
    
    handlePowerUpCollected(data) {
        // Remove powerup from map
        this.game.entityManager.removePowerUp(data.id);
        
        // Apply powerup effect to the player who collected it
        const playerCtrl = this.game.playerManager.getPlayer(data.playerId);
        
        if (!playerCtrl) return;
        
        // Skip if it's our local player (already applied locally)
        if (this.game.playerManager.isLocalPlayer(data.playerId)) {
            return;
        }
        
        // It's a remote player - apply the effect to them
        if (playerCtrl.isRemote() && data.powerupType) {
            this.game.entityManager.applyPowerUpToRemote(playerCtrl, data.powerupType);
        }
    }
    
    handleAsteroidSpawned(data) {
        this.game.entityManager.spawnAsteroid(data);
    }
    
    handleAsteroidDamaged(data) {
        this.game.entityManager.damageAsteroid(data.x, data.y, data.damage);
    }
    
    handleAsteroidDestroyed() {
        this.game.entityManager.destroyAsteroid();
    }
    
    handleReverseEffect(data) {
        // Apply reverse effect to affected players
        for (const targetId of data.affectedPlayerIds) {
            const playerCtrl = this.game.playerManager.getPlayer(targetId);
            if (!playerCtrl) continue;
            
            if (playerCtrl.isLocal()) {
                playerCtrl.player.activateReverse();
                this.game.particles.createExplosion(playerCtrl.x, playerCtrl.y, '#ffff00', 15, 150);
                
                // Retarget all homing missiles from this player
                for (let missile of this.game.weaponManager.homingMissiles) {
                    if (missile.ownerId === playerCtrl.id) {
                        missile.targetPlayer = playerCtrl.player;
                    }
                }
            } else if (playerCtrl.isRemote()) {
                playerCtrl.player.reversed = true;
                playerCtrl.player.reversedTime = 0;
                this.game.particles.createExplosion(playerCtrl.x, playerCtrl.y, '#ffff00', 15, 150);
            }
        }
        
        this.game.audio.playPowerUp();
    }
    
    handleAsteroidChase(data) {
        const asteroid = this.game.entityManager.asteroid;
        if (asteroid && asteroid.alive) {
            // Find the target player
            const chaseTarget = this.game.playerManager.getPlayer(data.targetId);
            
            if (chaseTarget) {
                asteroid.startChasing(chaseTarget.player);
                this.game.audio.playPowerUp();
                this.game.particles.createExplosion(asteroid.x, asteroid.y, '#ff00ff', 20, 200);
            }
        }
    }
    
    // === Outgoing Actions (convert game actions to network events) ===
    
    broadcastPlayerUpdate(playerCtrl) {
        if (!this.isOnlineMode()) return;
        
        this.network.sendPlayerUpdate(playerCtrl.id, {
            x: playerCtrl.x,
            y: playerCtrl.y,
            angle: playerCtrl.angle,
            alive: playerCtrl.alive,
            shields: playerCtrl.shields,
            invulnerable: playerCtrl.invulnerable
        });
    }
    
    broadcastDeath(victimId, killerId) {
        if (!this.isOnlineMode()) return;
        
        this.network.sendDeath(victimId, killerId);
    }
    
    broadcastWeaponFire(playerCtrl, weaponData) {
        if (!this.isOnlineMode()) return;
        
        this.network.sendWeaponFire(weaponData);
    }
    
    broadcastPowerUpPickup(playerCtrl, powerupId, powerupType) {
        if (!this.isOnlineMode()) return;
        
        this.network.sendPowerUpPickup(playerCtrl.id, powerupId, powerupType);
    }
    
    broadcastAsteroidDamage(x, y, damage) {
        if (!this.isOnlineMode()) return;
        
        this.network.sendAsteroidDamage(x, y, damage);
    }
    
    broadcastAsteroidDestroyed() {
        if (!this.isOnlineMode()) return;
        
        this.network.notifyAsteroidDestroyed();
    }
    
    broadcastReverseEffect(playerCtrl, affectedPlayerIds) {
        if (!this.isOnlineMode()) return;
        
        this.network.sendReverseEffect(playerCtrl.id, affectedPlayerIds);
    }
    
    broadcastAsteroidChase(playerCtrl, targetId) {
        if (!this.isOnlineMode()) return;
        
        this.network.sendAsteroidChase(targetId);
    }
    
    // Update wrapper
    update(dt) {
        if (this.network) {
            this.network.update(dt);
        }
    }
    
    // Disconnect wrapper
    disconnect() {
        if (this.network) {
            this.network.disconnect();
        }
    }
}

