// Weapon classes: Bullet, Homing Missile, Laser, Bomb

class Bullet {
    constructor(x, y, angle, color, ownerId) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = GAME_SETTINGS.weapons.bullet.speed;
        this.color = color;
        this.ownerId = ownerId;
        this.radius = GAME_SETTINGS.weapons.bullet.radius;
        this.maxDistance = GAME_SETTINGS.weapons.bullet.maxDistance;
        this.distanceTraveled = 0;
        this.alive = true;
    }
    
    update(dt, canvasWidth, canvasHeight) {
        if (!this.alive) return false;
        
        const distance = this.speed * dt;
        this.x += Math.cos(this.angle) * distance;
        this.y += Math.sin(this.angle) * distance;
        this.distanceTraveled += distance;
        
        // Wrap around screen
        const wrapped = wrapPosition(this.x, this.y, canvasWidth, canvasHeight);
        this.x = wrapped.x;
        this.y = wrapped.y;
        
        // Check if traveled too far
        if (this.distanceTraveled > this.maxDistance) {
            this.alive = false;
            return false;
        }
        
        return true;
    }
    
    draw(ctx) {
        if (!this.alive) return;
        
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class HomingMissile {
    constructor(x, y, angle, color, ownerId, targetPlayer) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = GAME_SETTINGS.weapons.homingMissile.speed;
        this.color = color;
        this.ownerId = ownerId;
        this.targetPlayer = targetPlayer;
        this.radius = GAME_SETTINGS.weapons.homingMissile.radius;
        this.turnSpeed = GAME_SETTINGS.weapons.homingMissile.turnSpeed;
        this.alive = true;
        this.lifetime = GAME_SETTINGS.weapons.homingMissile.lifetime;
        this.age = 0;
    }
    
    update(dt, canvasWidth, canvasHeight) {
        if (!this.alive) return false;
        
        this.age += dt;
        if (this.age > this.lifetime) {
            this.alive = false;
            return false;
        }
        
        // Home in on target if they're not invisible
        // NOTE: Does NOT consider edge wrapping - aims at visible position
        if (this.targetPlayer && this.targetPlayer.alive && !this.targetPlayer.invisible) {
            // Calculate direct angle without wrapping consideration
            const dx = this.targetPlayer.x - this.x;
            const dy = this.targetPlayer.y - this.y;
            const targetAngle = Math.atan2(dy, dx);
            const angleDiff = getAngleDifference(this.angle, targetAngle);
            
            // Turn towards target
            const maxTurn = this.turnSpeed * dt;
            if (Math.abs(angleDiff) < maxTurn) {
                this.angle = targetAngle;
            } else {
                this.angle += Math.sign(angleDiff) * maxTurn;
            }
        }
        
        this.angle = normalizeAngle(this.angle);
        
        const distance = this.speed * dt;
        this.x += Math.cos(this.angle) * distance;
        this.y += Math.sin(this.angle) * distance;
        
        // Wrap around screen
        const wrapped = wrapPosition(this.x, this.y, canvasWidth, canvasHeight);
        this.x = wrapped.x;
        this.y = wrapped.y;
        
        return true;
    }
    
    draw(ctx) {
        if (!this.alive) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Draw missile body
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-6, -4);
        ctx.lineTo(-6, 4);
        ctx.closePath();
        ctx.fill();
        
        // Draw fins
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(-6, -4);
        ctx.lineTo(-8, -6);
        ctx.moveTo(-6, 4);
        ctx.lineTo(-8, 6);
        ctx.stroke();
        
        ctx.restore();
    }
}

class Laser {
    constructor(player, color, ownerId, angleOffset = 0) {
        this.player = player; // Reference to the player ship
        this.color = color;
        this.ownerId = ownerId;
        this.angleOffset = angleOffset; // Angle offset for multishot
        this.length = GAME_SETTINGS.weapons.laser.length;
        this.width = GAME_SETTINGS.weapons.laser.width;
        this.duration = GAME_SETTINGS.weapons.laser.duration;
        this.age = 0;
        this.alive = true;
    }
    
    update(dt) {
        if (!this.alive) return false;
        
        this.age += dt;
        if (this.age > this.duration) {
            this.alive = false;
            return false;
        }
        
        // Check if player is still alive
        if (!this.player.alive) {
            this.alive = false;
            return false;
        }
        
        return true;
    }
    
    // Calculate beam segments considering wrapping
    getBeamSegments(canvasWidth, canvasHeight) {
        const startOffset = GAME_SETTINGS.weapons.laser.startOffset;
        const angle = this.player.angle + this.angleOffset;
        
        const segments = [];
        let currentX = this.player.x + Math.cos(angle) * startOffset;
        let currentY = this.player.y + Math.sin(angle) * startOffset;
        let remainingLength = this.length;
        
        // Wrap starting position
        const wrappedStart = wrapPosition(currentX, currentY, canvasWidth, canvasHeight);
        currentX = wrappedStart.x;
        currentY = wrappedStart.y;
        
        let iterations = 0;
        while (remainingLength > 0 && iterations < 10) {
            iterations++;
            
            const dx = Math.cos(angle) * remainingLength;
            const dy = Math.sin(angle) * remainingLength;
            let endX = currentX + dx;
            let endY = currentY + dy;
            
            // Check if beam crosses screen edge
            let segmentLength = remainingLength;
            let wraps = false;
            let wrapX = false;
            let wrapY = false;
            
            // Check X boundaries
            if (endX < 0) {
                segmentLength = Math.abs(currentX / Math.cos(angle));
                endX = 0;
                wraps = true;
                wrapX = true;
            } else if (endX > canvasWidth) {
                segmentLength = (canvasWidth - currentX) / Math.cos(angle);
                endX = canvasWidth;
                wraps = true;
                wrapX = true;
            }
            
            // Check Y boundaries
            if (endY < 0) {
                const altLength = Math.abs(currentY / Math.sin(angle));
                if (altLength < segmentLength) {
                    segmentLength = altLength;
                    endX = currentX + Math.cos(angle) * segmentLength;
                    endY = 0;
                    wraps = true;
                    wrapX = false;
                    wrapY = true;
                }
            } else if (endY > canvasHeight) {
                const altLength = (canvasHeight - currentY) / Math.sin(angle);
                if (altLength < segmentLength) {
                    segmentLength = altLength;
                    endX = currentX + Math.cos(angle) * segmentLength;
                    endY = canvasHeight;
                    wraps = true;
                    wrapX = false;
                    wrapY = true;
                }
            }
            
            segments.push({
                x1: currentX,
                y1: currentY,
                x2: endX,
                y2: endY
            });
            
            if (!wraps) break;
            
            remainingLength -= segmentLength;
            
            // Wrap to opposite edge
            if (wrapX) {
                if (endX <= 0) currentX = canvasWidth;
                else if (endX >= canvasWidth) currentX = 0;
            } else {
                currentX = endX;
            }
            
            if (wrapY) {
                if (endY <= 0) currentY = canvasHeight;
                else if (endY >= canvasHeight) currentY = 0;
            } else {
                currentY = endY;
            }
        }
        
        return segments;
    }
    
    draw(ctx, canvasWidth, canvasHeight) {
        if (!this.alive) return;
        
        const alpha = 1 - (this.age / this.duration) * 0.5;
        const segments = this.getBeamSegments(canvasWidth, canvasHeight);
        
        ctx.save();
        ctx.lineCap = 'round';
        
        // Draw outer glow for all segments
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.width + 4;
        ctx.shadowBlur = 25;
        ctx.shadowColor = this.color;
        ctx.globalAlpha = alpha * 0.3;
        
        segments.forEach(seg => {
            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.stroke();
        });
        
        // Draw core beam
        ctx.globalAlpha = alpha;
        ctx.lineWidth = this.width;
        ctx.shadowBlur = 15;
        
        segments.forEach(seg => {
            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.stroke();
        });
        
        // Draw bright core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffffff';
        
        segments.forEach(seg => {
            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.stroke();
        });
        
        ctx.restore();
    }
    
    // Check if point is hit by laser (check all wrapped segments)
    checkHit(x, y, radius, canvasWidth, canvasHeight) {
        const segments = this.getBeamSegments(canvasWidth, canvasHeight);
        
        for (let seg of segments) {
            const dist = this.distanceToSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2);
            if (dist < radius + this.width / 2) {
                return true;
            }
        }
        
        return false;
    }
    
    distanceToSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;
        
        if (lengthSquared === 0) {
            return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        }
        
        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));
        
        const closestX = x1 + t * dx;
        const closestY = y1 + t * dy;
        
        return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
    }
}

class Bomb {
    constructor(x, y, angle, color, ownerId, targetPlayer = null) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = GAME_SETTINGS.weapons.bomb.speed;
        this.color = color;
        this.ownerId = ownerId;
        this.radius = GAME_SETTINGS.weapons.bomb.radius;
        this.explosionRadius = GAME_SETTINGS.weapons.bomb.explosionRadius;
        this.proximityRadius = GAME_SETTINGS.weapons.bomb.proximityRadius;
        this.detonationTime = GAME_SETTINGS.weapons.bomb.detonationTime;
        this.age = 0;
        this.alive = true;
        this.detonated = false;
        
        // Homing capability
        this.targetPlayer = targetPlayer;
        this.isHoming = targetPlayer !== null;
        this.turnSpeed = GAME_SETTINGS.weapons.bomb.homingTurnSpeed;
    }
    
    update(dt, canvasWidth, canvasHeight, players) {
        if (!this.alive || this.detonated) return false;
        
        this.age += dt;
        
        // Auto-detonate after timer
        if (this.age >= this.detonationTime) {
            this.detonate();
            return true;
        }
        
        // Homing behavior (if this is a homing bomb)
        if (this.isHoming && this.targetPlayer && this.targetPlayer.alive && !this.targetPlayer.invisible) {
            // Calculate direct angle without wrapping consideration
            const dx = this.targetPlayer.x - this.x;
            const dy = this.targetPlayer.y - this.y;
            const targetAngle = Math.atan2(dy, dx);
            const angleDiff = getAngleDifference(this.angle, targetAngle);
            
            // Turn towards target
            const maxTurn = this.turnSpeed * dt;
            if (Math.abs(angleDiff) < maxTurn) {
                this.angle = targetAngle;
            } else {
                this.angle += Math.sign(angleDiff) * maxTurn;
            }
        }
        
        this.angle = normalizeAngle(this.angle);
        
        // Move bomb
        const distance = this.speed * dt;
        this.x += Math.cos(this.angle) * distance;
        this.y += Math.sin(this.angle) * distance;
        
        // Wrap around screen
        const wrapped = wrapPosition(this.x, this.y, canvasWidth, canvasHeight);
        this.x = wrapped.x;
        this.y = wrapped.y;
        
        // Check proximity to players
        for (let player of players) {
            if (player.alive && player.id !== this.ownerId) {
                const dist = getDistance(this.x, this.y, player.x, player.y, canvasWidth, canvasHeight);
                if (dist < this.proximityRadius) {
                    this.detonate();
                    return true;
                }
            }
        }
        
        return true;
    }
    
    detonate() {
        this.detonated = true;
        this.alive = false;
    }
    
    draw(ctx) {
        if (!this.alive) return;
        
        // Pulsating effect
        const pulseScale = 1 + Math.sin(this.age * 10) * 0.2;
        const warningAlpha = this.age / this.detonationTime;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Draw warning radius (gets more visible as timer runs out)
        if (warningAlpha > 0.5) {
            ctx.globalAlpha = (warningAlpha - 0.5) * 0.3;
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, this.explosionRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Draw bomb body
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15 * pulseScale;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * pulseScale, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw indicator ("HB" for homing bomb, "B" for regular)
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ffffff';
        ctx.font = this.isHoming ? 'bold 8px monospace' : 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.isHoming ? 'HB' : 'B', 0, 0);
        
        ctx.restore();
    }
}
