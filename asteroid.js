// Asteroid and Shrapnel classes

class Shrapnel {
    constructor(x, y, vx, vy, color) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.radius = GAME_SETTINGS.shrapnel.radius;
        this.lifetime = GAME_SETTINGS.shrapnel.lifetime;
        this.age = 0;
        this.alive = true;
    }
    
    update(dt, canvasWidth, canvasHeight) {
        if (!this.alive) return false;
        
        this.age += dt;
        if (this.age > this.lifetime) {
            this.alive = false;
            return false;
        }
        
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Wrap around screen
        const wrapped = wrapPosition(this.x, this.y, canvasWidth, canvasHeight);
        this.x = wrapped.x;
        this.y = wrapped.y;
        
        return true;
    }
    
    draw(ctx) {
        if (!this.alive) return;
        
        const alpha = 1 - (this.age / this.lifetime);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Asteroid {
    constructor(x, y, canvasWidth, canvasHeight) {
        this.x = x;
        this.y = y;
        this.size = random(GAME_SETTINGS.asteroid.minSize, GAME_SETTINGS.asteroid.maxSize);
        this.health = GAME_SETTINGS.asteroid.health;
        this.maxHealth = GAME_SETTINGS.asteroid.health;
        this.color = '#888888';
        this.alive = true;
        
        // Random slow velocity
        const angle = random(0, Math.PI * 2);
        const speed = random(GAME_SETTINGS.asteroid.minSpeed, GAME_SETTINGS.asteroid.maxSpeed);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        // Generate jagged shape
        this.points = [];
        const numPoints = randomInt(GAME_SETTINGS.asteroid.minPoints, GAME_SETTINGS.asteroid.maxPoints);
        for (let i = 0; i < numPoints; i++) {
            const angle = (Math.PI * 2 * i) / numPoints;
            const radius = this.size * random(0.7, 1.0);
            this.points.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        }
        
        this.rotation = 0;
        this.rotationSpeed = random(-1, 1);
        
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        
        // Chase mechanics
        this.chaseTarget = null;
        this.chaseActive = false;
        this.chaseTime = 0;
        this.chaseDuration = GAME_SETTINGS.powerups.asteroidChase.duration;
        // Speed is half of player's max speed
        this.chaseSpeed = GAME_SETTINGS.player.speeds[GAME_SETTINGS.player.speeds.length - 1] * GAME_SETTINGS.powerups.asteroidChase.speedMultiplier;
        this.chaseTurnSpeed = GAME_SETTINGS.powerups.asteroidChase.turnSpeed;
        this.chaseAngle = angle; // Store movement angle
        this.predictionTime = GAME_SETTINGS.powerups.asteroidChase.predictionTime;
    }
    
    startChasing(targetPlayer) {
        this.chaseTarget = targetPlayer;
        this.chaseActive = true;
        this.chaseTime = 0;
    }
    
    takeDamage(hitX, hitY, amount = 1) {
        this.health -= amount;
        
        // Create a chunk/hole where the bullet hit
        if (hitX !== undefined && hitY !== undefined) {
            // Convert hit position to local coordinates (accounting for rotation)
            const dx = hitX - this.x;
            const dy = hitY - this.y;
            const hitAngle = Math.atan2(dy, dx) - this.rotation;
            
            // Find the closest points on the polygon
            let closestIdx = 0;
            let minAngleDiff = Math.PI * 2;
            
            for (let i = 0; i < this.points.length; i++) {
                const pointAngle = Math.atan2(this.points[i].y, this.points[i].x);
                let angleDiff = Math.abs(hitAngle - pointAngle);
                if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
                
                if (angleDiff < minAngleDiff) {
                    minAngleDiff = angleDiff;
                    closestIdx = i;
                }
            }
            
            // Create an indentation by pushing the closest point(s) inward
            const indentAmount = GAME_SETTINGS.asteroid.chunkIndent;
            const chunkSize = 0.6; // Affects neighboring points too
            
            for (let i = 0; i < this.points.length; i++) {
                const idxDiff = Math.min(
                    Math.abs(i - closestIdx),
                    Math.abs(i - closestIdx + this.points.length),
                    Math.abs(i - closestIdx - this.points.length)
                );
                
                if (idxDiff <= GAME_SETTINGS.asteroid.chunkNeighbors) { // Affect the hit point and immediate neighbors
                    const influence = idxDiff === 0 ? 1.0 : chunkSize;
                    const currentRadius = Math.sqrt(this.points[i].x * this.points[i].x + this.points[i].y * this.points[i].y);
                    const newRadius = currentRadius * (1 - indentAmount * influence);
                    const angle = Math.atan2(this.points[i].y, this.points[i].x);
                    
                    this.points[i].x = Math.cos(angle) * newRadius;
                    this.points[i].y = Math.sin(angle) * newRadius;
                }
            }
            
            // Slightly reduce overall size
            this.size *= GAME_SETTINGS.asteroid.shrinkPerHit;
        }
        
        if (this.health <= 0) {
            this.alive = false;
        }
    }
    
    instantDestroy() {
        this.alive = false;
    }
    
    update(dt) {
        if (!this.alive) return false;
        
        // Update chase timer
        if (this.chaseActive) {
            this.chaseTime += dt;
            
            // Stop chasing if target died or chase duration expired
            if (!this.chaseTarget || !this.chaseTarget.alive || this.chaseTime >= this.chaseDuration) {
                this.chaseActive = false;
                this.chaseTarget = null;
            }
        }
        
        // Chase behavior with predictive targeting
        if (this.chaseActive && this.chaseTarget && this.chaseTarget.alive && !this.chaseTarget.invisible) {
            // Calculate player's velocity
            // Use speeds array from player or from settings (for remote players)
            const speeds = this.chaseTarget.speeds || GAME_SETTINGS.player.speeds;
            const speedLevel = this.chaseTarget.speedLevel || 0;
            const playerSpeed = speeds[speedLevel];
            const playerVx = Math.cos(this.chaseTarget.angle) * playerSpeed;
            const playerVy = Math.sin(this.chaseTarget.angle) * playerSpeed;
            
            // Predict where player will be
            const predictedX = this.chaseTarget.x + playerVx * this.predictionTime;
            const predictedY = this.chaseTarget.y + playerVy * this.predictionTime;
            
            // Calculate angle to predicted position (no wrapping)
            const dx = predictedX - this.x;
            const dy = predictedY - this.y;
            const targetAngle = Math.atan2(dy, dx);
            const angleDiff = getAngleDifference(this.chaseAngle, targetAngle);
            
            // Turn towards predicted position
            const maxTurn = this.chaseTurnSpeed * dt;
            if (Math.abs(angleDiff) < maxTurn) {
                this.chaseAngle = targetAngle;
            } else {
                this.chaseAngle += Math.sign(angleDiff) * maxTurn;
            }
            
            this.chaseAngle = normalizeAngle(this.chaseAngle);
            
            // Move at chase speed
            this.vx = Math.cos(this.chaseAngle) * this.chaseSpeed;
            this.vy = Math.sin(this.chaseAngle) * this.chaseSpeed;
        }
        
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Wrap around screen
        const wrapped = wrapPosition(this.x, this.y, this.canvasWidth, this.canvasHeight);
        this.x = wrapped.x;
        this.y = wrapped.y;
        
        this.rotation += this.rotationSpeed * dt;
        
        return true;
    }
    
    draw(ctx) {
        if (!this.alive) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Draw filled asteroid
        ctx.fillStyle = 'rgba(136, 136, 136, 0.3)';
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.closePath();
        ctx.fill();
        
        // Draw outline with glow
        const outlineColor = this.chaseActive ? '#ff00ff' : this.color;
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = this.chaseActive ? 3 : 2;
        ctx.shadowBlur = this.chaseActive ? 20 : 15;
        ctx.shadowColor = outlineColor;
        ctx.stroke();
        
        // Draw damage indicators (orange glow on edges when damaged)
        const damageLevel = 1 - (this.health / this.maxHealth);
        if (damageLevel > 0.2 && !this.chaseActive) {
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth = 1;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff6600';
            ctx.globalAlpha = damageLevel * 0.7;
            ctx.stroke();
        }
        
        // Draw chase indicator
        if (this.chaseActive && this.chaseTarget) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#ff00ff';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff00ff';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('!', 0, 0);
        }
        
        ctx.restore();
    }
    
    createShrapnel() {
        const shrapnel = [];
        const numPieces = randomInt(GAME_SETTINGS.shrapnel.minPieces, GAME_SETTINGS.shrapnel.maxPieces);
        
        for (let i = 0; i < numPieces; i++) {
            const angle = (Math.PI * 2 * i) / numPieces + random(-0.3, 0.3);
            const speed = random(GAME_SETTINGS.shrapnel.minSpeed, GAME_SETTINGS.shrapnel.maxSpeed);
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            
            shrapnel.push(new Shrapnel(this.x, this.y, vx, vy, '#ff6600'));
        }
        
        return shrapnel;
    }
}
