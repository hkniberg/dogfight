// Player class with discrete state control

const TurnState = {
    LEFT: -1,
    STRAIGHT: 0,
    RIGHT: 1
};

class Player {
    constructor(id, x, y, angle, color, name, controls) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.color = color;
        this.name = name;
        this.controls = controls;
        
        // Movement
        this.speedLevel = GAME_SETTINGS.player.defaultSpeedLevel;
        this.speeds = GAME_SETTINGS.player.speeds;
        this.turnState = TurnState.STRAIGHT;
        this.turnSpeed = GAME_SETTINGS.player.turnSpeed;
        
        // Status
        this.alive = true;
        this.radius = GAME_SETTINGS.player.radius;
        this.invulnerable = false;
        this.invulnerableTime = 0;
        this.respawnDelay = GAME_SETTINGS.respawnDelay;
        
        // Power-ups - Passive
        this.shields = 0;
        this.maxShields = GAME_SETTINGS.powerups.shield.maxStacks;
        
        // Power-ups - Timed
        this.multiShot = false;
        this.multiShotTime = 0;
        this.multiShotDuration = GAME_SETTINGS.powerups.multiShot.duration;
        
        this.invisible = false;
        this.invisibleTime = 0;
        this.invisibleDuration = GAME_SETTINGS.powerups.invisibility.duration;
        
        this.reversed = false;
        this.reversedTime = 0;
        this.reversedDuration = GAME_SETTINGS.powerups.reverse.duration;
        
        // Power-ups - Ammo
        this.hasHoming = false;
        this.hasLaser = false;
        this.hasBomb = false;
        this.hasReverse = false;
        this.hasAsteroidChase = false;
        
        // Shooting
        this.bullets = [];
        this.maxBullets = GAME_SETTINGS.player.maxBullets;
    }
    
    // Movement controls (reversed if affected by reverse power-up)
    speedUp() {
        if (this.reversed) {
            // Reversed: speed up becomes speed down
            if (this.speedLevel > 0) {
                this.speedLevel--;
            }
        } else {
            if (this.speedLevel < 4) {
                this.speedLevel++;
            }
        }
    }
    
    speedDown() {
        if (this.reversed) {
            // Reversed: speed down becomes speed up
            if (this.speedLevel < 4) {
                this.speedLevel++;
            }
        } else {
            if (this.speedLevel > 0) {
                this.speedLevel--;
            }
        }
    }
    
    turnLeft() {
        if (this.reversed) {
            // Reversed: left becomes right
            if (this.turnState === TurnState.LEFT) {
                this.turnState = TurnState.STRAIGHT;
            } else if (this.turnState === TurnState.STRAIGHT) {
                this.turnState = TurnState.RIGHT;
            }
        } else {
            if (this.turnState === TurnState.RIGHT) {
                this.turnState = TurnState.STRAIGHT;
            } else if (this.turnState === TurnState.STRAIGHT) {
                this.turnState = TurnState.LEFT;
            }
        }
    }
    
    turnRight() {
        if (this.reversed) {
            // Reversed: right becomes left
            if (this.turnState === TurnState.RIGHT) {
                this.turnState = TurnState.STRAIGHT;
            } else if (this.turnState === TurnState.STRAIGHT) {
                this.turnState = TurnState.LEFT;
            }
        } else {
            if (this.turnState === TurnState.LEFT) {
                this.turnState = TurnState.STRAIGHT;
            } else if (this.turnState === TurnState.STRAIGHT) {
                this.turnState = TurnState.RIGHT;
            }
        }
    }
    
    // Power-up methods
    addShield() {
        if (this.shields < this.maxShields) {
            this.shields++;
        }
    }
    
    removeShield() {
        if (this.shields > 0) {
            this.shields--;
            return true;
        }
        return false;
    }
    
    activateMultiShot() {
        this.multiShot = true;
        this.multiShotTime = 0;
    }
    
    activateInvisibility() {
        this.invisible = true;
        this.invisibleTime = 0;
    }
    
    activateReverse() {
        this.reversed = true;
        this.reversedTime = 0;
    }
    
    loadHoming() {
        this.hasHoming = true;
    }
    
    loadLaser() {
        this.hasLaser = true;
    }
    
    loadBomb() {
        this.hasBomb = true;
    }
    
    loadReverse() {
        this.hasReverse = true;
    }
    
    loadAsteroidChase() {
        this.hasAsteroidChase = true;
    }
    
    update(dt, canvasWidth, canvasHeight) {
        if (!this.alive) return;
        
        // Update invulnerability
        if (this.invulnerable) {
            this.invulnerableTime += dt;
            if (this.invulnerableTime > GAME_SETTINGS.invulnerabilityDuration) {
                this.invulnerable = false;
                this.invulnerableTime = 0;
            }
        }
        
        // Update timed power-ups
        if (this.multiShot) {
            this.multiShotTime += dt;
            if (this.multiShotTime > this.multiShotDuration) {
                this.multiShot = false;
                this.multiShotTime = 0;
            }
        }
        
        if (this.invisible) {
            this.invisibleTime += dt;
            if (this.invisibleTime > this.invisibleDuration) {
                this.invisible = false;
                this.invisibleTime = 0;
            }
        }
        
        if (this.reversed) {
            this.reversedTime += dt;
            if (this.reversedTime > this.reversedDuration) {
                this.reversed = false;
                this.reversedTime = 0;
            }
        }
        
        // Apply turning
        if (this.turnState === TurnState.LEFT) {
            this.angle -= this.turnSpeed * dt;
        } else if (this.turnState === TurnState.RIGHT) {
            this.angle += this.turnSpeed * dt;
        }
        
        this.angle = normalizeAngle(this.angle);
        
        // Apply movement (constant forward motion)
        const speed = this.speeds[this.speedLevel];
        this.x += Math.cos(this.angle) * speed * dt;
        this.y += Math.sin(this.angle) * speed * dt;
        
        // Wrap around screen
        const wrapped = wrapPosition(this.x, this.y, canvasWidth, canvasHeight);
        this.x = wrapped.x;
        this.y = wrapped.y;
    }
    
    draw(ctx) {
        if (!this.alive) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Invisibility effect - throb slowly between completely invisible and very dark
        if (this.invisible) {
            const pulse = (Math.sin(Date.now() * GAME_SETTINGS.powerups.invisibility.pulseSpeed) + 1) / 2;
            const alphaRange = GAME_SETTINGS.powerups.invisibility.maxAlpha - GAME_SETTINGS.powerups.invisibility.minAlpha;
            ctx.globalAlpha = GAME_SETTINGS.powerups.invisibility.minAlpha + (pulse * alphaRange);
        }
        
        // Invulnerability flashing
        if (this.invulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        
        // Reversed controls indicator (yellow question mark)
        if (this.reversed) {
            const reversePulse = (Math.sin(Date.now() * 0.005) + 1) / 2;
            ctx.fillStyle = '#ffff00';
            ctx.shadowBlur = 15 + reversePulse * 10;
            ctx.shadowColor = '#ffff00';
            ctx.globalAlpha = 0.7 + reversePulse * 0.3;
            ctx.font = 'bold 20px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', 0, -25);
            ctx.globalAlpha = 1;
        }
        
        // Draw shields
        if (this.shields > 0) {
            for (let i = 0; i < this.shields; i++) {
                const shieldRadius = this.radius + 8 + (i * 6);
                const shieldWidth = 2 + i;
                ctx.strokeStyle = '#0066ff';
                ctx.lineWidth = shieldWidth;
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#0066ff';
                ctx.beginPath();
                ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        
        // Draw plane body
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-10, -8);
        ctx.lineTo(-10, 8);
        ctx.closePath();
        ctx.fill();
        
        // Draw multishot wings (amber)
        if (this.multiShot) {
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ffaa00';
            ctx.beginPath();
            ctx.moveTo(-5, -8);
            ctx.lineTo(-5, -13);
            ctx.moveTo(-5, 8);
            ctx.lineTo(-5, 13);
            ctx.stroke();
        }
        
        // Draw weapon indicators
        if (this.hasHoming) {
            // Red nose
            ctx.fillStyle = '#ff0000';
            ctx.shadowColor = '#ff0000';
            ctx.beginPath();
            ctx.arc(12, 0, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        if (this.hasLaser) {
            // Violet center
            ctx.fillStyle = '#9900ff';
            ctx.shadowColor = '#9900ff';
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        if (this.hasBomb) {
            // "B" text (or "HB" if also has homing)
            ctx.fillStyle = '#ff6600';
            ctx.shadowColor = '#ff6600';
            const label = (this.hasBomb && this.hasHoming) ? 'HB' : 'B';
            ctx.font = label === 'HB' ? 'bold 8px monospace' : 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, 0, 0);
        }
        
        if (this.hasReverse) {
            // Yellow "REV" text
            ctx.fillStyle = '#ffff00';
            ctx.shadowColor = '#ffff00';
            ctx.font = 'bold 7px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('REV', 0, 6);
        }
        
        if (this.hasAsteroidChase) {
            // Magenta "AST" text
            ctx.fillStyle = '#ff00ff';
            ctx.shadowColor = '#ff00ff';
            ctx.font = 'bold 7px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('AST', 0, -6);
        }
        
        ctx.restore();
        
        // Draw name above plane
        if (!this.invisible || this.invulnerable) {
            ctx.save();
            if (this.invisible) {
                // Match the ship's invisibility pulse
                const pulse = (Math.sin(Date.now() * GAME_SETTINGS.powerups.invisibility.pulseSpeed) + 1) / 2;
                const alphaRange = GAME_SETTINGS.powerups.invisibility.maxAlpha - GAME_SETTINGS.powerups.invisibility.minAlpha;
                ctx.globalAlpha = GAME_SETTINGS.powerups.invisibility.minAlpha + (pulse * alphaRange);
            } else {
                ctx.globalAlpha = 1;
            }
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 5;
            ctx.shadowColor = this.color;
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.name, this.x, this.y - 25);
            ctx.restore();
        }
    }
    
    fire(targetPlayer) {
        if (!this.alive) return null;
        
        // Calculate spread angles for multishot
        const getSpreadAngles = () => {
            if (!this.multiShot) return [0];
            
            const spreadAngles = [];
            const bulletCount = GAME_SETTINGS.powerups.multiShot.bulletCount;
            const spreadAngle = GAME_SETTINGS.powerups.multiShot.spreadAngle;
            for (let i = 0; i < bulletCount; i++) {
                spreadAngles.push((i - Math.floor(bulletCount / 2)) * spreadAngle);
            }
            return spreadAngles;
        };
        
        // Check for special effect weapons (affect opponent, don't fire projectiles)
        if (this.hasReverse) {
            this.hasReverse = false;
            return {
                type: 'reverse',
                weapon: null
            };
        }
        
        if (this.hasAsteroidChase) {
            this.hasAsteroidChase = false;
            return {
                type: 'asteroidChase',
                weapon: null
            };
        }
        
        // Check for special weapons (multishot applies to these too!)
        if (this.hasBomb) {
            this.hasBomb = false;
            const bombs = [];
            
            // If player also has homing, bombs will home in on target!
            const bombTarget = this.hasHoming ? targetPlayer : null;
            if (this.hasHoming) {
                this.hasHoming = false; // Consume homing power-up
            }
            
            for (let spread of getSpreadAngles()) {
                const angle = this.angle + spread;
                const offsetX = Math.cos(angle) * 20;
                const offsetY = Math.sin(angle) * 20;
                bombs.push(new Bomb(this.x + offsetX, this.y + offsetY, angle, '#ff6600', this.id, bombTarget));
            }
            return {
                type: 'bomb',
                weapon: bombs
            };
        }
        
        if (this.hasLaser) {
            this.hasLaser = false;
            const lasers = [];
            for (let spread of getSpreadAngles()) {
                lasers.push(new Laser(this, this.color, this.id, spread));
            }
            return {
                type: 'laser',
                weapon: lasers
            };
        }
        
        if (this.hasHoming) {
            this.hasHoming = false;
            const missiles = [];
            
            // If I'm reversed, my missiles target me instead of opponent!
            const missileTarget = this.reversed ? this : targetPlayer;
            
            for (let spread of getSpreadAngles()) {
                const angle = this.angle + spread;
                const offsetX = Math.cos(angle) * 20;
                const offsetY = Math.sin(angle) * 20;
                missiles.push(new HomingMissile(this.x + offsetX, this.y + offsetY, angle, this.color, this.id, missileTarget));
            }
            return {
                type: 'homing',
                weapon: missiles
            };
        }
        
        // Standard fire or multishot bullets
        const bullets = [];
        
        for (let spread of getSpreadAngles()) {
            if (this.bullets.length < this.maxBullets) {
                const angle = this.angle + spread;
                const offsetX = Math.cos(angle) * 20;
                const offsetY = Math.sin(angle) * 20;
                const bullet = new Bullet(this.x + offsetX, this.y + offsetY, angle, this.color, this.id);
                bullets.push(bullet);
                this.bullets.push(bullet);
            }
        }
        
        return bullets.length > 0 ? { type: 'bullets', weapon: bullets } : null;
    }
    
    updateBullets(dt, canvasWidth, canvasHeight) {
        this.bullets = this.bullets.filter(bullet => bullet.update(dt, canvasWidth, canvasHeight));
    }
    
    drawBullets(ctx) {
        this.bullets.forEach(bullet => bullet.draw(ctx));
    }
    
    die() {
        this.alive = false;
        this.shields = 0;
        this.multiShot = false;
        this.invisible = false;
        this.reversed = false;
        this.hasHoming = false;
        this.hasLaser = false;
        this.hasBomb = false;
        this.hasReverse = false;
        this.hasAsteroidChase = false;
        this.bullets = [];
    }
    
    respawn(x, y, angle) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.alive = true;
        this.invulnerable = true;
        this.invulnerableTime = 0;
        this.speedLevel = GAME_SETTINGS.player.defaultSpeedLevel;
        this.turnState = TurnState.STRAIGHT;
    }
}

