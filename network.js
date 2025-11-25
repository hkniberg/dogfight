// Network abstraction layer for local and online multiplayer

// Base NetworkManager interface
class NetworkManager {
    constructor() {
        // Event callbacks
        this._onPlayerJoinedCallback = null;
        this._onStateChangeCallback = null;
        this._onPlayerUpdateCallback = null;
        this._onWeaponFiredCallback = null;
        this._onPlayerDiedCallback = null;
        this._onPowerUpSpawnedCallback = null;
        this._onPowerUpCollectedCallback = null;
        this._onAsteroidSpawnedCallback = null;
        this._onAsteroidDamagedCallback = null;
        this._onAsteroidDestroyedCallback = null;
        this._onPlayerLeftCallback = null;
        this._onReverseEffectCallback = null;
        this._onAsteroidChaseCallback = null;
    }
    
    // Connection methods
    connect(playerName, playerColor) {
        throw new Error('connect() must be implemented');
    }
    
    disconnect() {
        throw new Error('disconnect() must be implemented');
    }
    
    // Send events
    sendStateChange(playerId, data) {
        throw new Error('sendStateChange() must be implemented');
    }
    
    sendPlayerUpdate(playerId, data) {
        throw new Error('sendPlayerUpdate() must be implemented');
    }
    
    sendWeaponFire(playerId, data) {
        throw new Error('sendWeaponFire() must be implemented');
    }
    
    sendDeath(victimId, killerId) {
        throw new Error('sendDeath() must be implemented');
    }
    
    sendPowerUpPickup(playerId, powerupId, powerupType) {
        throw new Error('sendPowerUpPickup() must be implemented');
    }
    
    sendAsteroidDamage(x, y, damage) {
        throw new Error('sendAsteroidDamage() must be implemented');
    }
    
    sendAsteroidDestroyed() {
        throw new Error('sendAsteroidDestroyed() must be implemented');
    }
    
    sendReverseEffect(playerId, affectedPlayerIds) {
        throw new Error('sendReverseEffect() must be implemented');
    }
    
    sendAsteroidChase(targetId) {
        throw new Error('sendAsteroidChase() must be implemented');
    }
    
    // Receive event callbacks
    onPlayerJoined(callback) {
        this._onPlayerJoinedCallback = callback;
    }
    
    onStateChange(callback) {
        this._onStateChangeCallback = callback;
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
    
    onAsteroidDamaged(callback) {
        this._onAsteroidDamagedCallback = callback;
    }
    
    onAsteroidDestroyed(callback) {
        this._onAsteroidDestroyedCallback = callback;
    }
    
    onPlayerLeft(callback) {
        this._onPlayerLeftCallback = callback;
    }
    
    onReverseEffect(callback) {
        this._onReverseEffectCallback = callback;
    }
    
    onAsteroidChase(callback) {
        this._onAsteroidChaseCallback = callback;
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
    
    sendStateChange(playerId, data) {
        // In local mode, state changes are handled directly
        // No need to broadcast
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
    
    sendPowerUpPickup(playerId, powerupId, powerupType) {
        // Remove from active power-ups
        this.activePowerUps.delete(powerupId);
        
        // Notify collection (async)
        if (this._onPowerUpCollectedCallback) {
            setTimeout(() => {
                this._onPowerUpCollectedCallback({
                    id: powerupId,
                    playerId: playerId,
                    powerupType: powerupType
                });
            }, 0);
        }
    }
    
    sendAsteroidDamage(x, y, damage) {
        // In local mode, damage is handled directly
        // No need to broadcast
    }
    
    sendAsteroidDestroyed() {
        // In local mode, destruction is handled directly
        // No need to broadcast
    }
    
    sendReverseEffect(playerId, affectedPlayerIds) {
        // In local mode, reverse effect is applied directly
        // Callback is called synchronously for local handling
        if (this._onReverseEffectCallback) {
            setTimeout(() => {
                this._onReverseEffectCallback({
                    playerId: playerId,
                    affectedPlayerIds: affectedPlayerIds
                });
            }, 0);
        }
    }
    
    sendAsteroidChase(targetId) {
        // In local mode, asteroid chase is applied directly
        // Callback is called synchronously for local handling
        if (this._onAsteroidChaseCallback) {
            setTimeout(() => {
                this._onAsteroidChaseCallback({
                    targetId: targetId
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
    notifyAsteroidDestroyed() {
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

// PeerNetworkManager - P2P multiplayer using WebRTC (star topology)
class PeerNetworkManager extends NetworkManager {
    constructor(canvasWidth, canvasHeight, isHost, battleCode = null) {
        super();
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.isHost = isHost;
        this.battleCode = battleCode; // For joining
        
        // PeerJS setup
        this.peer = null;
        this.myPeerId = null;
        this.connections = new Map(); // peerId -> connection
        this.players = new Map(); // playerId -> player info
        this.nextPlayerId = 1;
        this.myPlayerId = null;
        
        // Host-specific state
        if (this.isHost) {
            this.powerUpSpawner = new PowerUpSpawner(canvasWidth, canvasHeight);
            this.asteroidSpawner = new AsteroidSpawner(canvasWidth, canvasHeight);
            this.activePowerUps = new Map();
            this.activeAsteroid = null;
        }
        
        // Connection state
        this.connected = false;
        this.connectionError = null;
    }
    
    generateBattleCode() {
        // Generate random 4-character code (uppercase letters only for clarity)
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (I, O, 0, 1)
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    
    connect(playerName, playerColor) {
        return new Promise((resolve, reject) => {
            // Generate short 4-character battle code for host
            const battleCode = this.isHost ? this.generateBattleCode() : null;
            
            // Create peer connection (use free PeerJS cloud for now)
            this.peer = battleCode ? new Peer(battleCode) : new Peer();
            
            this.peer.on('open', (id) => {
                this.myPeerId = id;
                console.log(`[PeerNetwork] My peer ID: ${id}`);
                
                if (this.isHost) {
                    // Host: create own player and listen for connections
                    this.myPlayerId = this.nextPlayerId++;
                    this.players.set(this.myPlayerId, {
                        id: this.myPlayerId,
                        name: playerName,
                        color: playerColor,
                        peerId: id,
                        isHost: true
                    });
                    
                    // Listen for incoming connections
                    this.peer.on('connection', (conn) => {
                        this.handleIncomingConnection(conn);
                    });
                    
                    this.connected = true;
                    
                    // Notify game that host player joined
                    setTimeout(() => {
                        if (this._onPlayerJoinedCallback) {
                            this._onPlayerJoinedCallback({
                                id: this.myPlayerId,
                                name: playerName,
                                color: playerColor,
                                isHost: true
                            });
                        }
                    }, 0);
                    
                    resolve(this.myPlayerId);
                } else {
                    // Client: connect to host
                    if (!this.battleCode) {
                        reject(new Error('Battle code required to join'));
                        return;
                    }
                    
                    console.log(`[PeerNetwork] Connecting to host: ${this.battleCode}`);
                    const conn = this.peer.connect(this.battleCode, {
                        reliable: true
                    });
                    
                    conn.on('open', () => {
                        console.log('[PeerNetwork] Connected to host');
                        this.connections.set(this.battleCode, conn);
                        
                        // Send join request
                        conn.send({
                            type: 'join-request',
                            name: playerName,
                            color: playerColor
                        });
                    });
                    
                    conn.on('data', (data) => {
                        this.handleMessage(data, conn);
                        
                        // Resolve on first message (join-accepted)
                        if (data.type === 'join-accepted' && !this.connected) {
                            this.myPlayerId = data.playerId;
                            this.connected = true;
                            resolve(this.myPlayerId);
                        }
                    });
                    
                    conn.on('close', () => {
                        console.log('[PeerNetwork] Connection to host closed');
                        this.handleDisconnect(this.battleCode);
                    });
                    
                    conn.on('error', (err) => {
                        console.error('[PeerNetwork] Connection error:', err);
                        reject(err);
                    });
                }
            });
            
            this.peer.on('error', (err) => {
                console.error('[PeerNetwork] Peer error:', err);
                this.connectionError = err;
                reject(err);
            });
        });
    }
    
    handleIncomingConnection(conn) {
        console.log(`[PeerNetwork] Incoming connection from: ${conn.peer}`);
        
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
        });
        
        conn.on('data', (data) => {
            this.handleMessage(data, conn);
        });
        
        conn.on('close', () => {
            console.log(`[PeerNetwork] Client disconnected: ${conn.peer}`);
            this.handleDisconnect(conn.peer);
        });
        
        conn.on('error', (err) => {
            console.error(`[PeerNetwork] Connection error with ${conn.peer}:`, err);
        });
    }
    
    handleMessage(data, conn) {
        console.log('[PeerNetwork] Received:', data.type);
        
        switch (data.type) {
            case 'join-request':
                // Host only: accept new player
                if (this.isHost) {
                    const playerId = this.nextPlayerId++;
                    this.players.set(playerId, {
                        id: playerId,
                        name: data.name,
                        color: data.color,
                        peerId: conn.peer,
                        isHost: false
                    });
                    
                    // Send acceptance
                    conn.send({
                        type: 'join-accepted',
                        playerId: playerId
                    });
                    
                    // Send current game state (existing players, powerups, etc.)
                    conn.send({
                        type: 'game-state',
                        players: Array.from(this.players.values()),
                        powerUps: Array.from(this.activePowerUps.values()),
                        asteroid: this.activeAsteroid
                    });
                    
                    // Notify all clients about new player
                    this.broadcast({
                        type: 'player-joined',
                        id: playerId,
                        name: data.name,
                        color: data.color
                    });
                    
                    // Notify game
                    if (this._onPlayerJoinedCallback) {
                        this._onPlayerJoinedCallback({
                            id: playerId,
                            name: data.name,
                            color: data.color
                        });
                    }
                }
                break;
                
            case 'join-accepted':
                // Client only: store my player ID
                console.log(`[PeerNetwork] Joined as player ${data.playerId}`);
                break;
                
            case 'game-state':
                // Client only: receive initial game state
                console.log('[PeerNetwork] Received game state');
                // Notify about existing players (except self)
                if (data.players && this._onPlayerJoinedCallback) {
                    data.players.forEach(player => {
                        if (player.id !== this.myPlayerId) {
                            this._onPlayerJoinedCallback(player);
                        }
                    });
                }
                // Spawn existing powerups
                if (data.powerUps && this._onPowerUpSpawnedCallback) {
                    data.powerUps.forEach(powerUp => {
                        this._onPowerUpSpawnedCallback(powerUp);
                    });
                }
                // Spawn asteroid if exists
                if (data.asteroid && this._onAsteroidSpawnedCallback) {
                    this._onAsteroidSpawnedCallback(data.asteroid);
                }
                break;
                
            case 'player-joined':
                if (this._onPlayerJoinedCallback) {
                    this._onPlayerJoinedCallback(data);
                }
                break;
                
            case 'player-update':
                if (this.isHost && data.id !== this.myPlayerId) {
                    // Relay to other clients
                    this.broadcast(data, conn.peer);
                }
                if (this._onPlayerUpdateCallback) {
                    this._onPlayerUpdateCallback(data);
                }
                break;
                
            case 'weapon-fire':
                if (this.isHost && data.playerId !== this.myPlayerId) {
                    // Relay to other clients
                    this.broadcast(data, conn.peer);
                }
                if (this._onWeaponFiredCallback) {
                    this._onWeaponFiredCallback(data);
                }
                break;
                
            case 'player-died':
                if (this.isHost && data.victimId !== this.myPlayerId) {
                    // Relay to other clients
                    this.broadcast(data, conn.peer);
                }
                if (this._onPlayerDiedCallback) {
                    this._onPlayerDiedCallback(data);
                }
                break;
                
            case 'powerup-pickup':
                if (this.isHost) {
                    // Validate and remove powerup
                    if (this.activePowerUps.has(data.powerupId)) {
                        this.activePowerUps.delete(data.powerupId);
                        // Broadcast removal with powerup type
                        this.broadcast({
                            type: 'powerup-collected',
                            id: data.powerupId,
                            playerId: data.playerId,
                            powerupType: data.powerupType
                        });
                        if (this._onPowerUpCollectedCallback) {
                            this._onPowerUpCollectedCallback({
                                id: data.powerupId,
                                playerId: data.playerId,
                                powerupType: data.powerupType
                            });
                        }
                    }
                }
                break;
                
            case 'powerup-spawned':
                if (this._onPowerUpSpawnedCallback) {
                    this._onPowerUpSpawnedCallback(data.powerup);
                }
                break;
                
            case 'powerup-collected':
                if (this._onPowerUpCollectedCallback) {
                    this._onPowerUpCollectedCallback(data);
                }
                break;
                
            case 'asteroid-spawned':
                if (this._onAsteroidSpawnedCallback) {
                    this._onAsteroidSpawnedCallback(data.asteroid);
                }
                break;
                
            case 'asteroid-damaged':
                if (this._onAsteroidDamagedCallback) {
                    this._onAsteroidDamagedCallback({
                        x: data.x,
                        y: data.y,
                        damage: data.damage
                    });
                }
                break;
                
            case 'asteroid-destroyed':
                if (this._onAsteroidDestroyedCallback) {
                    this._onAsteroidDestroyedCallback();
                }
                break;
                
            case 'reverse-effect':
                // Relay if host
                if (this.isHost && data.playerId !== this.myPlayerId) {
                    this.broadcast(data, conn ? conn.peer : null);
                }
                // Handle locally
                if (this._onReverseEffectCallback) {
                    this._onReverseEffectCallback({
                        playerId: data.playerId,
                        affectedPlayerIds: data.affectedPlayerIds
                    });
                }
                break;
                
            case 'asteroid-chase':
                // Relay if host
                if (this.isHost) {
                    this.broadcast(data, conn ? conn.peer : null);
                }
                // Handle locally
                if (this._onAsteroidChaseCallback) {
                    this._onAsteroidChaseCallback({
                        targetId: data.targetId
                    });
                }
                break;
        }
    }
    
    handleDisconnect(peerId) {
        this.connections.delete(peerId);
        
        if (this.isHost) {
            // Find player by peer ID
            let disconnectedPlayerId = null;
            for (const [playerId, player] of this.players.entries()) {
                if (player.peerId === peerId) {
                    disconnectedPlayerId = playerId;
                    this.players.delete(playerId);
                    break;
                }
            }
            
            if (disconnectedPlayerId) {
                // Notify all clients
                this.broadcast({
                    type: 'player-left',
                    id: disconnectedPlayerId
                });
                
                // Notify game
                if (this._onPlayerLeftCallback) {
                    this._onPlayerLeftCallback({ id: disconnectedPlayerId });
                }
            }
        } else {
            // Client disconnected from host - game over
            console.log('[PeerNetwork] Disconnected from host');
            if (this._onPlayerLeftCallback) {
                this._onPlayerLeftCallback({ id: 'host', isHost: true });
            }
        }
    }
    
    broadcast(message, excludePeerId = null) {
        for (const [peerId, conn] of this.connections) {
            if (peerId !== excludePeerId) {
                conn.send(message);
            }
        }
    }
    
    disconnect() {
        if (this.peer) {
            this.peer.destroy();
        }
        this.connections.clear();
        this.players.clear();
        this.connected = false;
    }
    
    sendPlayerUpdate(playerId, data) {
        if (!this.connected) return;
        
        const message = {
            type: 'player-update',
            id: playerId,
            ...data
        };
        
        if (this.isHost) {
            // Broadcast to all clients
            this.broadcast(message);
        } else {
            // Send to host
            const hostConn = this.connections.get(this.battleCode);
            if (hostConn) {
                hostConn.send(message);
            }
        }
    }
    
    sendStateChange(playerId, data) {
        // Phase 3: for immediate state changes
        // For now, just treat as regular update
        this.sendPlayerUpdate(playerId, data);
    }
    
    sendWeaponFire(playerId, data) {
        if (!this.connected) return;
        
        const message = {
            type: 'weapon-fire',
            playerId: playerId,
            ...data
        };
        
        if (this.isHost) {
            this.broadcast(message);
        } else {
            const hostConn = this.connections.get(this.battleCode);
            if (hostConn) {
                hostConn.send(message);
            }
        }
    }
    
    sendDeath(victimId, killerId) {
        if (!this.connected) return;
        
        const message = {
            type: 'player-died',
            victimId: victimId,
            killerId: killerId
        };
        
        if (this.isHost) {
            this.broadcast(message);
        } else {
            const hostConn = this.connections.get(this.battleCode);
            if (hostConn) {
                hostConn.send(message);
            }
        }
    }
    
    sendPowerUpPickup(playerId, powerupId, powerupType) {
        if (!this.connected) return;
        
        const message = {
            type: 'powerup-pickup',
            playerId: playerId,
            powerupId: powerupId,
            powerupType: powerupType
        };
        
        if (this.isHost) {
            // Host validates directly
            this.handleMessage(message, null);
        } else {
            const hostConn = this.connections.get(this.battleCode);
            if (hostConn) {
                hostConn.send(message);
            }
        }
    }
    
    sendAsteroidDamage(x, y, damage) {
        if (!this.connected || !this.isHost) return;
        
        // Only host sends asteroid damage
        this.broadcast({
            type: 'asteroid-damaged',
            x: x,
            y: y,
            damage: damage
        });
    }
    
    sendAsteroidDestroyed() {
        if (!this.connected || !this.isHost) return;
        
        // Only host sends asteroid destruction
        this.broadcast({
            type: 'asteroid-destroyed'
        });
    }
    
    sendReverseEffect(playerId, affectedPlayerIds) {
        if (!this.connected) return;
        
        const message = {
            type: 'reverse-effect',
            playerId: playerId,
            affectedPlayerIds: affectedPlayerIds
        };
        
        // Broadcast to all players (host or client)
        if (this.isHost) {
            this.broadcast(message);
        } else {
            const hostConn = this.connections.get(this.battleCode);
            if (hostConn) {
                hostConn.send(message);
            }
        }
    }
    
    sendAsteroidChase(targetId) {
        if (!this.connected) return;
        
        const message = {
            type: 'asteroid-chase',
            targetId: targetId
        };
        
        // Broadcast to all players (host or client)
        if (this.isHost) {
            this.broadcast(message);
        } else {
            const hostConn = this.connections.get(this.battleCode);
            if (hostConn) {
                hostConn.send(message);
            }
        }
    }
    
    update(dt) {
        // Only host runs spawning logic
        if (!this.isHost) return;
        
        // Spawn power-ups
        if (this.activePowerUps.size < GAME_SETTINGS.powerups.maxOnMap) {
            this.powerUpSpawner.update(dt, (powerUpData) => {
                this.activePowerUps.set(powerUpData.id, powerUpData);
                
                // Broadcast spawn
                this.broadcast({
                    type: 'powerup-spawned',
                    powerup: powerUpData
                });
                
                // Notify local game
                if (this._onPowerUpSpawnedCallback) {
                    this._onPowerUpSpawnedCallback(powerUpData);
                }
            });
        }
        
        // Spawn asteroid (max 1 at a time)
        if (!this.activeAsteroid) {
            this.asteroidSpawner.update(dt, (asteroidData) => {
                this.activeAsteroid = asteroidData;
                
                // Broadcast spawn
                this.broadcast({
                    type: 'asteroid-spawned',
                    asteroid: asteroidData
                });
                
                // Notify local game
                if (this._onAsteroidSpawnedCallback) {
                    this._onAsteroidSpawnedCallback(asteroidData);
                }
            });
        }
    }
    
    notifyAsteroidDestroyed() {
        // Called by game when asteroid is destroyed locally
        if (this.isHost) {
            this.activeAsteroid = null;
            this.sendAsteroidDestroyed();
        }
    }
    
    reset() {
        if (this.isHost) {
            this.powerUpSpawner.reset();
            this.asteroidSpawner.reset();
            this.activePowerUps.clear();
            this.activeAsteroid = null;
        }
    }
}

// RemotePlayer class for online multiplayer
class RemotePlayer {
    constructor(id, name, color) {
        this.id = id;
        this.name = name;
        this.color = color;
        
        // Current display position (interpolated/extrapolated)
        this.displayPos = { x: 0, y: 0, angle: 0 };
        
        // Target position (from network corrections)
        this.targetPos = { x: 0, y: 0, angle: 0 };
        
        // Movement state (for extrapolation - Phase 3)
        this.speedLevel = 0;
        this.turnState = 0; // -1 = left, 0 = straight, 1 = right
        
        // State
        this.alive = true;
        this.shields = 0;
        this.invulnerable = false;
        
        // Power-up states for visual display
        this.invisible = false;
        this.invisibleTime = 0;
        this.invisibleDuration = GAME_SETTINGS.powerups.invisibility.duration;
        
        this.multiShot = false;
        this.multiShotTime = 0;
        this.multiShotDuration = GAME_SETTINGS.powerups.multiShot.duration;
        
        this.reversed = false;
        this.reversedTime = 0;
        this.reversedDuration = GAME_SETTINGS.powerups.reverse.duration;
        
        // Canvas dimensions for wrapping
        this.canvasWidth = 1600;
        this.canvasHeight = 900;
    }
    
    // Getter properties for compatibility with Laser and other weapon classes
    get x() {
        return this.displayPos.x;
    }
    
    get y() {
        return this.displayPos.y;
    }
    
    get angle() {
        return this.displayPos.angle;
    }
    
    onStateChange(data) {
        // Phase 3: Immediate state updates for responsive extrapolation
        this.speedLevel = data.speedLevel;
        this.turnState = data.turnState;
        // Can optionally update position from state change event
        if (data.x !== undefined) {
            this.targetPos.x = data.x;
            this.targetPos.y = data.y;
            this.targetPos.angle = data.angle;
        }
    }
    
    onNetworkUpdate(data) {
        // Position corrections (Phase 2)
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
        // Update timed power-up effects
        if (this.invisible) {
            this.invisibleTime += dt;
            if (this.invisibleTime > this.invisibleDuration) {
                this.invisible = false;
                this.invisibleTime = 0;
            }
        }
        
        if (this.multiShot) {
            this.multiShotTime += dt;
            if (this.multiShotTime > this.multiShotDuration) {
                this.multiShot = false;
                this.multiShotTime = 0;
            }
        }
        
        if (this.reversed) {
            this.reversedTime += dt;
            if (this.reversedTime > this.reversedDuration) {
                this.reversed = false;
                this.reversedTime = 0;
            }
        }
        
        // Phase 2: Simple interpolation toward target
        // Phase 3: Will add extrapolation based on speedLevel/turnState
        const smoothing = 0.3;
        
        // Check for screen wrapping on each axis independently
        const dx = this.targetPos.x - this.displayPos.x;
        const dy = this.targetPos.y - this.displayPos.y;
        
        // If distance on either axis is greater than half the canvas size,
        // it's likely a screen wrap - teleport instead of interpolate
        const xWrapThreshold = this.canvasWidth / 2;
        const yWrapThreshold = this.canvasHeight / 2;
        
        const isXWrapped = Math.abs(dx) > xWrapThreshold;
        const isYWrapped = Math.abs(dy) > yWrapThreshold;
        
        if (isXWrapped || isYWrapped) {
            // Teleport to target position (screen wrap detected)
            this.displayPos.x = this.targetPos.x;
            this.displayPos.y = this.targetPos.y;
        } else {
            // Normal interpolation
            this.displayPos.x += dx * smoothing;
            this.displayPos.y += dy * smoothing;
        }
        
        // Smooth angle interpolation (handle wrapping)
        let angleDiff = this.targetPos.angle - this.displayPos.angle;
        // Normalize to -PI to PI
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        this.displayPos.angle += angleDiff * smoothing;
    }
}



