// Power-up system

const PowerUpType = {
    SHIELD: 'SHIELD',
    MULTISHOT: 'MULTISHOT',
    HOMING: 'HOMING',
    INVISIBILITY: 'INVISIBILITY',
    LASER: 'LASER',
    BOMB: 'BOMB',
    REVERSE: 'REVERSE',
    ASTEROID_CHASE: 'ASTEROID_CHASE'
};

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = GAME_SETTINGS.powerups.radius;
        this.alive = true;
        this.pulsePhase = 0;
        
        // Set properties based on type
        switch(type) {
            case PowerUpType.SHIELD:
                this.color = '#0066ff';
                this.label = 'S';
                break;
            case PowerUpType.MULTISHOT:
                this.color = '#ffaa00';
                this.label = 'M';
                break;
            case PowerUpType.HOMING:
                this.color = '#ff0000';
                this.label = 'H';
                break;
            case PowerUpType.INVISIBILITY:
                this.color = '#888888';
                this.label = 'INV';
                break;
            case PowerUpType.LASER:
                this.color = '#9900ff';
                this.label = 'L';
                break;
            case PowerUpType.BOMB:
                this.color = '#ff6600';
                this.label = 'BOMB';
                break;
            case PowerUpType.REVERSE:
                this.color = '#ffff00';
                this.label = 'REV';
                break;
            case PowerUpType.ASTEROID_CHASE:
                this.color = '#ff00ff';
                this.label = 'AST';
                break;
        }
    }
    
    update(dt) {
        this.pulsePhase += dt * 3;
        return this.alive;
    }
    
    draw(ctx) {
        if (!this.alive) return;
        
        const pulse = 1 + Math.sin(this.pulsePhase) * 0.2;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Draw glow
        ctx.shadowBlur = 20 * pulse;
        ctx.shadowColor = this.color;
        
        // Draw outer circle
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * pulse, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw inner circle
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.3;
        ctx.fill();
        
        // Draw label
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ffffff';
        ctx.font = this.label.length > 2 ? 'bold 8px monospace' : 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.label, 0, 0);
        
        ctx.restore();
    }
    
    pickup() {
        this.alive = false;
    }
}

class PowerUpManager {
    constructor() {
        this.powerUps = [];
        this.spawnTimer = 0;
        this.nextSpawnInterval = random(
            GAME_SETTINGS.powerups.spawnIntervalMin,
            GAME_SETTINGS.powerups.spawnIntervalMax
        );
    }
    
    update(dt, players, canvasWidth, canvasHeight) {
        // Update existing power-ups
        for (let powerUp of this.powerUps) {
            powerUp.update(dt);
            
            // Check if any player picked it up
            for (let player of players) {
                if (player.alive) {
                    const dist = getDistance(
                        player.x, player.y,
                        powerUp.x, powerUp.y,
                        canvasWidth, canvasHeight
                    );
                    
                    if (dist < player.radius + powerUp.radius) {
                        this.applyPowerUp(player, powerUp.type);
                        powerUp.pickup();
                    }
                }
            }
        }
        
        // Remove picked up power-ups
        this.powerUps = this.powerUps.filter(p => p.alive);
        
        // Spawn new power-up if under max
        if (this.powerUps.length < GAME_SETTINGS.powerups.maxOnMap) {
            this.spawnTimer += dt;
            if (this.spawnTimer >= this.nextSpawnInterval) {
                this.spawnPowerUp(players, canvasWidth, canvasHeight);
                this.spawnTimer = 0;
                // Set next random interval
                this.nextSpawnInterval = random(
                    GAME_SETTINGS.powerups.spawnIntervalMin,
                    GAME_SETTINGS.powerups.spawnIntervalMax
                );
            }
        }
    }
    
    spawnPowerUp(players, canvasWidth, canvasHeight) {
        const types = Object.values(PowerUpType);
        const type = types[randomInt(0, types.length - 1)];
        
        const pos = getRandomSpawnPosition(players, 150, canvasWidth, canvasHeight);
        this.powerUps.push(new PowerUp(pos.x, pos.y, type));
    }
    
    applyPowerUp(player, type) {
        switch(type) {
            case PowerUpType.SHIELD:
                player.addShield();
                break;
            case PowerUpType.MULTISHOT:
                player.activateMultiShot();
                break;
            case PowerUpType.HOMING:
                player.loadHoming();
                break;
            case PowerUpType.INVISIBILITY:
                player.activateInvisibility();
                break;
            case PowerUpType.LASER:
                player.loadLaser();
                break;
            case PowerUpType.BOMB:
                player.loadBomb();
                break;
            case PowerUpType.REVERSE:
                player.loadReverse();
                break;
            case PowerUpType.ASTEROID_CHASE:
                player.loadAsteroidChase();
                break;
        }
    }
    
    draw(ctx) {
        for (let powerUp of this.powerUps) {
            powerUp.draw(ctx);
        }
    }
    
    clear() {
        this.powerUps = [];
        this.spawnTimer = 0;
        this.nextSpawnInterval = random(
            GAME_SETTINGS.powerups.spawnIntervalMin,
            GAME_SETTINGS.powerups.spawnIntervalMax
        );
    }
}
