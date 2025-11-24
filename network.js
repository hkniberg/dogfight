// Network abstraction layer for local and online multiplayer

// Base NetworkManager interface
class NetworkManager {
    constructor() {
        // Event callbacks
        this._onPlayerJoinedCallback = null;
        this._onPlayerUpdateCallback = null;
        this._onWeaponFiredCallback = null;
        this._onPlayerDiedCallback = null;
        this._onPowerUpSpawnedCallback = null;
        this._onPowerUpCollectedCallback = null;
        this._onAsteroidSpawnedCallback = null;
        this._onPlayerLeftCallback = null;
    }
    
    // Connection methods
    connect(playerName, playerColor) {
        throw new Error('connect() must be implemented');
    }
    
    disconnect() {
        throw new Error('disconnect() must be implemented');
    }
    
    // Send events
    sendPlayerUpdate(playerId, data) {
        throw new Error('sendPlayerUpdate() must be implemented');
    }
    
    sendWeaponFire(playerId, data) {
        throw new Error('sendWeaponFire() must be implemented');
    }
    
    sendDeath(victimId, killerId) {
        throw new Error('sendDeath() must be implemented');
    }
    
    sendPowerUpPickup(playerId, powerupId, seq) {
        throw new Error('sendPowerUpPickup() must be implemented');
    }
    
    // Receive event callbacks
    onPlayerJoined(callback) {
        this._onPlayerJoinedCallback = callback;
    }
    
    onPlayerUpdate(callback) {
        this._onPlayerUpdateCallback = callback;
    }
    
    onWeaponFired(callback) {
        this._onWeaponFiredCallback = callback;
    }
    
    onPlayerDied(callback) {
        this._onPlayerDiedCallback = callback;
    }
    
    onPowerUpSpawned(callback) {
        this._onPowerUpSpawnedCallback = callback;
    }
    
    onPowerUpCollected(callback) {
        this._onPowerUpCollectedCallback = callback;
    }
    
    onAsteroidSpawned(callback) {
        this._onAsteroidSpawnedCallback = callback;
    }
    
    onPlayerLeft(callback) {
        this._onPlayerLeftCallback = callback;
    }
    
    // Update loop (for spawning in local mode)
    update(dt) {
        throw new Error('update() must be implemented');
    }
}

// LocalNetworkManager - runs "server" in-process for local multiplayer
class LocalNetworkManager extends NetworkManager {
    constructor(canvasWidth, canvasHeight) {
        super();
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        
        // Local "server" state
        this.powerUpSpawner = new PowerUpSpawner(canvasWidth, canvasHeight);
        this.asteroidSpawner = new AsteroidSpawner(canvasWidth, canvasHeight);
        this.activePowerUps = new Map(); // id -> powerup data
        this.activeAsteroid = null;
        this.powerUpCount = 0;
        
        // Local player IDs
        this.nextPlayerId = 1;
        this.connectedPlayers = new Map(); // id -> player info
    }
    
    connect(playerName, playerColor) {
        const playerId = this.nextPlayerId++;
        
        this.connectedPlayers.set(playerId, {
            id: playerId,
            name: playerName,
            color: playerColor
        });
        
        // Notify that player joined (async to match real network behavior)
        if (this._onPlayerJoinedCallback) {
            setTimeout(() => {
                this._onPlayerJoinedCallback({
                    id: playerId,
                    name: playerName,
                    color: playerColor
                });
            }, 0);
        }
        
        return playerId;
    }
    
    disconnect() {
        // Clear local state
        this.connectedPlayers.clear();
        this.activePowerUps.clear();
        this.activeAsteroid = null;
        this.powerUpSpawner.reset();
        this.asteroidSpawner.reset();
    }
    
    sendPlayerUpdate(playerId, data) {
        // In local mode, we don't need to relay player updates
        // Each player is updated directly in the game loop
    }
    
    sendWeaponFire(playerId, data) {
        // In local mode, weapons are created directly
        // No need to broadcast
    }
    
    sendDeath(victimId, killerId) {
        // In local mode, death is handled directly
        // No need to broadcast
    }
    
    sendPowerUpPickup(playerId, powerupId, seq) {
        // Remove from active power-ups
        this.activePowerUps.delete(powerupId);
        
        // Notify collection (async)
        if (this._onPowerUpCollectedCallback) {
            setTimeout(() => {
                this._onPowerUpCollectedCallback({
                    id: powerupId,
                    playerId: playerId
                });
            }, 0);
        }
    }
    
    update(dt) {
        // Run spawning logic (acts as local "server")
        
        // Spawn power-ups
        if (this.activePowerUps.size < GAME_SETTINGS.powerups.maxOnMap) {
            this.powerUpSpawner.update(dt, (powerUpData) => {
                this.activePowerUps.set(powerUpData.id, powerUpData);
                
                // Notify game
                if (this._onPowerUpSpawnedCallback) {
                    this._onPowerUpSpawnedCallback(powerUpData);
                }
            });
        }
        
        // Spawn asteroid (max 1 at a time)
        if (!this.activeAsteroid) {
            this.asteroidSpawner.update(dt, (asteroidData) => {
                this.activeAsteroid = asteroidData;
                
                // Notify game
                if (this._onAsteroidSpawnedCallback) {
                    this._onAsteroidSpawnedCallback(asteroidData);
                }
            });
        }
    }
    
    // Called by game when asteroid is destroyed
    onAsteroidDestroyed() {
        this.activeAsteroid = null;
    }
    
    // Reset spawners (for new game)
    reset() {
        this.powerUpSpawner.reset();
        this.asteroidSpawner.reset();
        this.activePowerUps.clear();
        this.activeAsteroid = null;
    }
}

// RemotePlayer class for online multiplayer (future use)
class RemotePlayer {
    constructor(id, name, color) {
        this.id = id;
        this.name = name;
        this.color = color;
        
        // Current display position (interpolated)
        this.displayPos = { x: 0, y: 0, angle: 0 };
        
        // Target position (from network)
        this.targetPos = { x: 0, y: 0, angle: 0 };
        
        // State
        this.alive = true;
        this.shields = 0;
        this.invulnerable = false;
    }
    
    onNetworkUpdate(data) {
        this.targetPos = {
            x: data.x,
            y: data.y,
            angle: data.angle
        };
        this.alive = data.alive;
        this.shields = data.shields || 0;
        this.invulnerable = data.invulnerable || false;
    }
    
    update(dt) {
        // Smooth interpolation toward target
        const smoothing = 0.3;
        this.displayPos.x += (this.targetPos.x - this.displayPos.x) * smoothing;
        this.displayPos.y += (this.targetPos.y - this.displayPos.y) * smoothing;
        
        // Smooth angle interpolation (handle wrapping)
        let angleDiff = this.targetPos.angle - this.displayPos.angle;
        // Normalize to -PI to PI
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        this.displayPos.angle += angleDiff * smoothing;
    }
}

