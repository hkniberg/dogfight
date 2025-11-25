// Neon Dogfight - Game Settings
// All gameplay constants in one place for easy tweaking

const GAME_SETTINGS = {
    // === CANVAS SETTINGS (FIXED FOR MULTIPLAYER) ===
    // All clients must use same dimensions for consistent wrapping behavior
    canvas: {
        width: 1600,                // Fixed canvas width (supports 1080p+ screens)
        height: 900,                // Fixed canvas height (16:9 aspect ratio)
    },
    
    // === MATCH SETTINGS ===
    winScore: 3,                    // First to this many kills wins
    respawnDelay: 2,                // Seconds before respawn
    invulnerabilityDuration: 2,     // Seconds of invulnerability after respawn
    
    // === PLAYER SETTINGS ===
    player: {
        radius: 12,                 // Collision radius
        speeds: [80, 110, 140, 170, 200],  // 5 speed levels (pixels/second)
        defaultSpeedLevel: 0,       // Starting speed level (0 = slowest)
        turnSpeed: 1.5,             // Radians per second
        maxBullets: 5,              // Max bullets in flight per player
        startSpacing: 30,           // Distance between players at start
    },
    
    // === WEAPON SETTINGS ===
    weapons: {
        bullet: {
            speed: 400,             // Pixels per second
            radius: 3,              // Collision radius
            maxDistance: 600,       // Max travel distance
        },
        homingMissile: {
            speed: 200,             // Pixels per second
            radius: 5,              // Collision radius
            turnSpeed: 1.7,           // Radians per second
            lifetime: 10,           // Seconds before expiring
            asteroidDamage: 3,      // Damage to asteroids
        },
        laser: {
            length: 180,            // Length of beam
            width: 6,               // Width of beam
            duration: 5,            // Seconds beam lasts
            startOffset: 18,        // Distance from ship nose
        },
        bomb: {
            speed: 150,             // Pixels per second
            radius: 8,              // Visual radius
            explosionRadius: 150,   // Damage radius
            proximityRadius: 80,    // Detonation trigger radius
            detonationTime: 5,      // Auto-detonate timer (seconds)
            homingTurnSpeed: 1.5,   // Turn speed when homing (radians/second)
        },
    },
    
    // === POWER-UP SETTINGS ===
    powerups: {
        maxOnMap: 5,                // Maximum simultaneous powerups
        spawnIntervalMin: 1,        // Minimum seconds between spawns
        spawnIntervalMax: 3,       // Maximum seconds between spawns
        radius: 15,                 // Collision radius
        shield: {
            maxStacks: 3,           // Maximum shield layers
        },
        multiShot: {
            duration: 8,            // Seconds
            bulletCount: 3,         // Bullets per shot
            spreadAngle: 0.2,       // Radians between bullets
        },
        invisibility: {
            duration: 10,           // Seconds
            minAlpha: 0.00,          // Completely invisible
            maxAlpha: 0.15,         // Very dark
            pulseSpeed: 0.002,      // Throb speed (radians/ms)
        },
        reverse: {
            duration: 10,            // Seconds of reversed controls
        },
        asteroidChase: {
            duration: 100,          // Seconds asteroid chases target
            speedMultiplier: 0.5,   // Multiplier of player's max speed (0.5 = half)
            turnSpeed: 1.2,         // Turn speed (radians/second)
            predictionTime: 0.8,    // Seconds ahead to aim (predictive targeting)
        },
    },
    
    // === ASTEROID SETTINGS ===
    asteroid: {
        minSize: 30,                // Minimum radius
        maxSize: 50,                // Maximum radius
        health: 5,                  // Bullet hits to destroy
        minSpeed: 20,               // Minimum drift speed
        maxSpeed: 40,               // Maximum drift speed
        minPoints: 8,               // Minimum polygon points
        maxPoints: 12,              // Maximum polygon points
        spawnIntervalMin: 12,       // Minimum seconds between spawns
        spawnIntervalMax: 18,       // Maximum seconds between spawns
        chunkIndent: 0.4,           // How much to indent when hit (0-1)
        chunkNeighbors: 1,          // Number of neighboring points affected
        shrinkPerHit: 0.95,         // Size multiplier per hit
    },
    
    // === SHRAPNEL SETTINGS ===
    shrapnel: {
        radius: 3,                  // Collision radius
        lifetime: 2,                // Seconds before disappearing
        minPieces: 6,               // Minimum pieces
        maxPieces: 10,              // Maximum pieces
        minSpeed: 150,              // Minimum velocity
        maxSpeed: 250,              // Maximum velocity
    },
    
    // === COLLISION & BOUNCE SETTINGS ===
    collision: {
        asteroidPushDistance: 5,    // Extra push from asteroid
        playerPushDistance: 10,     // Extra push between players
    },
    
    // === VISUAL EFFECTS SETTINGS ===
    particles: {
        explosion: {
            defaultCount: 20,       // Default particle count
            defaultSpeed: 200,      // Default particle speed
        },
        debris: {
            defaultCount: 10,
            minSpeed: 50,
            maxSpeed: 150,
        },
        shockwave: {
            duration: 0.5,          // Seconds
        },
    },
    
    // === AUDIO SETTINGS ===
    audio: {
        masterVolume: 0.3,          // 0-1 global volume
    },
    
    // === GRID SETTINGS ===
    grid: {
        size: 50,                   // Grid cell size in pixels
        opacity: 0.05,              // Grid line opacity
    },
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GAME_SETTINGS;
}

