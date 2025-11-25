// PlayerManager - Centralized management of all players (local and remote)
// Eliminates the need for separate myPlayers[] and remotePlayers Map

class PlayerManager {
    constructor(game) {
        this.game = game;
        this.players = new Map(); // id -> PlayerController
        this.myPlayerIds = new Set(); // Track which players are locally controlled
    }
    
    // Add a player (local or remote)
    addPlayer(player, isLocal = false) {
        const ctrl = new PlayerController(player);
        this.players.set(player.id, ctrl);
        
        if (isLocal) {
            this.myPlayerIds.add(player.id);
        }
        
        return ctrl;
    }
    
    // Remove a player
    removePlayer(playerId) {
        this.players.delete(playerId);
        this.myPlayerIds.delete(playerId);
    }
    
    // Get a specific player by ID
    getPlayer(playerId) {
        return this.players.get(playerId);
    }
    
    // Get all players as array of PlayerControllers
    getAllPlayers() {
        return Array.from(this.players.values());
    }
    
    // Get only locally controlled players
    getLocalPlayers() {
        return this.getAllPlayers().filter(p => this.myPlayerIds.has(p.id));
    }
    
    // Get only remote players
    getRemotePlayers() {
        return this.getAllPlayers().filter(p => !this.myPlayerIds.has(p.id));
    }
    
    // Get all players except the specified one (useful for finding opponents)
    getOpponents(playerId) {
        return this.getAllPlayers().filter(p => p.id !== playerId);
    }
    
    // Check if a player is locally controlled
    isLocalPlayer(playerId) {
        return this.myPlayerIds.has(playerId);
    }
    
    // Get player count
    getPlayerCount() {
        return this.players.size;
    }
    
    // Get count of local players
    getLocalPlayerCount() {
        return this.myPlayerIds.size;
    }
    
    // Clear all players
    clear() {
        this.players.clear();
        this.myPlayerIds.clear();
    }
    
    // Update all players
    updateAll(dt, canvasWidth, canvasHeight) {
        for (let playerCtrl of this.getAllPlayers()) {
            if (playerCtrl.alive) {
                playerCtrl.update(dt, canvasWidth, canvasHeight);
            }
        }
    }
    
    // Draw all players
    drawAll(ctx, canvasWidth, canvasHeight) {
        for (let playerCtrl of this.getAllPlayers()) {
            if (playerCtrl.alive) {
                playerCtrl.draw(ctx, canvasWidth, canvasHeight);
            }
        }
    }
    
    // Find a suitable target for weapons (for a given player)
    findTarget(playerId) {
        const opponents = this.getOpponents(playerId);
        
        if (opponents.length === 0) {
            return null;
        }
        
        // Prefer alive, visible opponents
        const visibleOpponents = opponents.filter(p => p.alive && !p.invisible);
        if (visibleOpponents.length > 0) {
            return visibleOpponents[0].player;
        }
        
        // Fall back to any alive opponent
        const aliveOpponents = opponents.filter(p => p.alive);
        if (aliveOpponents.length > 0) {
            return aliveOpponents[0].player;
        }
        
        // Last resort: return first opponent even if dead
        return opponents[0].player;
    }
    
    // Handle input for local players
    handleInput(key, pressed) {
        if (!pressed) return;
        
        for (const playerCtrl of this.getLocalPlayers()) {
            if (!playerCtrl.player) continue;
            
            const player = playerCtrl.player;
            const keys = player.controls;
            if (!keys) continue;
            
            if (key === keys.up) player.speedUp();
            if (key === keys.down) player.speedDown();
            if (key === keys.left) player.turnLeft();
            if (key === keys.right) player.turnRight();
            
            // Fire is handled separately by WeaponManager
        }
    }
    
    // Check if a fire key was pressed for any local player
    getPlayerByFireKey(key) {
        for (const playerCtrl of this.getLocalPlayers()) {
            if (!playerCtrl.player) continue;
            
            const player = playerCtrl.player;
            const keys = player.controls;
            
            if (keys && key === keys.fire) {
                return playerCtrl;
            }
        }
        
        return null;
    }
}

