// Spawner classes for power-ups and asteroids
// Shared between client (LocalNetworkManager) and server

class PowerUpSpawner {
    constructor(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.spawnTimer = 0;
        this.nextSpawnInterval = this._randomSpawnInterval();
        this.nextId = 0;
        this.sequenceNumber = 0;
    }
    
    update(dt, onSpawn) {
        this.spawnTimer += dt;
        
        if (this.spawnTimer >= this.nextSpawnInterval) {
            const types = Object.values(PowerUpType);
            const type = types[randomInt(0, types.length - 1)];
            
            // Generate random position (simplified - no player avoidance in spawner)
            const x = random(50, this.canvasWidth - 50);
            const y = random(50, this.canvasHeight - 50);
            
            const powerUpData = {
                id: `powerup_${this.nextId++}`,
                seq: this.sequenceNumber++,
                type: type,
                x: x,
                y: y
            };
            
            onSpawn(powerUpData);
            
            this.spawnTimer = 0;
            this.nextSpawnInterval = this._randomSpawnInterval();
        }
    }
    
    _randomSpawnInterval() {
        return random(
            GAME_SETTINGS.powerups.spawnIntervalMin,
            GAME_SETTINGS.powerups.spawnIntervalMax
        );
    }
    
    reset() {
        this.spawnTimer = 0;
        this.nextSpawnInterval = this._randomSpawnInterval();
        this.sequenceNumber = 0;
    }
}

class AsteroidSpawner {
    constructor(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.spawnTimer = 0;
        this.nextSpawnInterval = this._randomSpawnInterval();
        this.nextId = 0;
    }
    
    update(dt, onSpawn) {
        this.spawnTimer += dt;
        
        if (this.spawnTimer >= this.nextSpawnInterval) {
            // Generate random asteroid properties
            const x = random(50, this.canvasWidth - 50);
            const y = random(50, this.canvasHeight - 50);
            const size = random(
                GAME_SETTINGS.asteroid.minSize,
                GAME_SETTINGS.asteroid.maxSize
            );
            const speed = random(
                GAME_SETTINGS.asteroid.minSpeed,
                GAME_SETTINGS.asteroid.maxSpeed
            );
            const angle = random(0, Math.PI * 2);
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            
            // Generate random polygon points
            const pointCount = randomInt(
                GAME_SETTINGS.asteroid.minPoints,
                GAME_SETTINGS.asteroid.maxPoints
            );
            const points = [];
            for (let i = 0; i < pointCount; i++) {
                const angleOffset = (i / pointCount) * Math.PI * 2;
                const radiusVariation = random(0.8, 1.2);
                const r = size * radiusVariation;
                points.push({
                    x: Math.cos(angleOffset) * r,
                    y: Math.sin(angleOffset) * r,
                    damaged: false
                });
            }
            
            // Generate rotation properties
            const rotation = 0;
            const rotationSpeed = random(-1, 1);
            
            const asteroidData = {
                id: `asteroid_${this.nextId++}`,
                x: x,
                y: y,
                vx: vx,
                vy: vy,
                size: size,
                points: points,
                rotation: rotation,
                rotationSpeed: rotationSpeed
            };
            
            onSpawn(asteroidData);
            
            this.spawnTimer = 0;
            this.nextSpawnInterval = this._randomSpawnInterval();
        }
    }
    
    _randomSpawnInterval() {
        return random(
            GAME_SETTINGS.asteroid.spawnIntervalMin,
            GAME_SETTINGS.asteroid.spawnIntervalMax
        );
    }
    
    reset() {
        this.spawnTimer = 0;
        this.nextSpawnInterval = this._randomSpawnInterval();
    }
}

// Export for Node.js (server) and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PowerUpSpawner, AsteroidSpawner, PowerUpType };
}

