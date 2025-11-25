// PlayerRenderer - Shared rendering logic for Player and RemotePlayer
// Eliminates duplication between local and remote player drawing

class PlayerRenderer {
    // Apply visual effects (invisibility, invulnerability, reversed)
    static applyVisualEffects(ctx, player) {
        // Invisibility effect
        if (player.invisible) {
            const pulse = (Math.sin(Date.now() * GAME_SETTINGS.powerups.invisibility.pulseSpeed) + 1) / 2;
            const alphaRange = GAME_SETTINGS.powerups.invisibility.maxAlpha - GAME_SETTINGS.powerups.invisibility.minAlpha;
            ctx.globalAlpha = GAME_SETTINGS.powerups.invisibility.minAlpha + (pulse * alphaRange);
        }
        
        // Invulnerability flashing
        if (player.invulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
    }
    
    // Draw reversed controls indicator
    static drawReversedIndicator(ctx) {
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
    
    // Draw shields around player
    static drawShields(ctx, shields, radius) {
        if (shields <= 0) return;
        
        for (let i = 0; i < shields; i++) {
            const shieldRadius = radius + 8 + (i * 6);
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
    
    // Draw ship body (triangle)
    static drawShipBody(ctx, color, size) {
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size, size / 2);
        ctx.lineTo(-size, -size / 2);
        ctx.closePath();
        
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Add glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.stroke();
    }
    
    // Draw multishot wings
    static drawMultiShotWings(ctx, size) {
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffaa00';
        ctx.beginPath();
        ctx.moveTo(-5, -size / 2);
        ctx.lineTo(-5, -size / 2 - 5);
        ctx.moveTo(-5, size / 2);
        ctx.lineTo(-5, size / 2 + 5);
        ctx.stroke();
    }
    
    // Draw weapon indicators (for local players only)
    static drawWeaponIndicators(ctx, player) {
        if (player.hasHoming) {
            // Red nose
            ctx.fillStyle = '#ff0000';
            ctx.shadowColor = '#ff0000';
            ctx.beginPath();
            ctx.arc(12, 0, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        if (player.hasLaser) {
            // Violet center
            ctx.fillStyle = '#9900ff';
            ctx.shadowColor = '#9900ff';
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        if (player.hasBomb) {
            // "B" text (or "HB" if also has homing)
            ctx.fillStyle = '#ff6600';
            ctx.shadowColor = '#ff6600';
            const label = (player.hasBomb && player.hasHoming) ? 'HB' : 'B';
            ctx.font = label === 'HB' ? 'bold 8px monospace' : 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, 0, 0);
        }
        
        if (player.hasReverse) {
            // Yellow "REV" text
            ctx.fillStyle = '#ffff00';
            ctx.shadowColor = '#ffff00';
            ctx.font = 'bold 7px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('REV', 0, 6);
        }
        
        if (player.hasAsteroidChase) {
            // Magenta "AST" text
            ctx.fillStyle = '#ff00ff';
            ctx.shadowColor = '#ff00ff';
            ctx.font = 'bold 7px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('AST', 0, -6);
        }
    }
    
    // Draw player name above ship
    static drawName(ctx, x, y, name, color, invisible, invulnerable) {
        // Don't show name if invisible (unless invulnerable)
        if (invisible && !invulnerable) return;
        
        ctx.save();
        
        if (invisible) {
            const pulse = (Math.sin(Date.now() * GAME_SETTINGS.powerups.invisibility.pulseSpeed) + 1) / 2;
            const alphaRange = GAME_SETTINGS.powerups.invisibility.maxAlpha - GAME_SETTINGS.powerups.invisibility.minAlpha;
            ctx.globalAlpha = GAME_SETTINGS.powerups.invisibility.minAlpha + (pulse * alphaRange);
        } else {
            ctx.globalAlpha = 1;
        }
        
        ctx.fillStyle = color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = color;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(name, x, y - 25);
        
        ctx.restore();
    }
    
    // Complete player rendering (local)
    static drawLocalPlayer(ctx, player) {
        if (!player.alive) return;
        
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle);
        
        // Apply visual effects
        this.applyVisualEffects(ctx, player);
        
        // Draw reversed indicator
        if (player.reversed) {
            this.drawReversedIndicator(ctx);
        }
        
        // Draw shields
        this.drawShields(ctx, player.shields, player.radius);
        
        // Draw plane body
        ctx.fillStyle = player.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = player.color;
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-10, -8);
        ctx.lineTo(-10, 8);
        ctx.closePath();
        ctx.fill();
        
        // Draw multishot wings
        if (player.multiShot) {
            this.drawMultiShotWings(ctx, 8);
        }
        
        // Draw weapon indicators
        this.drawWeaponIndicators(ctx, player);
        
        ctx.restore();
        
        // Draw name above player
        this.drawName(ctx, player.x, player.y, player.name, player.color, player.invisible, player.invulnerable);
    }
    
    // Complete player rendering (remote)
    static drawRemotePlayer(ctx, remotePlayer) {
        if (!remotePlayer.alive) return;
        
        const pos = remotePlayer.displayPos;
        const size = 12;
        
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(pos.angle);
        
        // Apply visual effects
        this.applyVisualEffects(ctx, remotePlayer);
        
        // Draw reversed indicator
        if (remotePlayer.reversed) {
            this.drawReversedIndicator(ctx);
        }
        
        // Draw shields
        this.drawShields(ctx, remotePlayer.shields, size);
        
        // Draw ship body
        this.drawShipBody(ctx, remotePlayer.color, size);
        
        // Draw multishot wings
        if (remotePlayer.multiShot) {
            this.drawMultiShotWings(ctx, size);
        }
        
        ctx.restore();
        
        // Draw name above player
        this.drawName(ctx, pos.x, pos.y, remotePlayer.name, remotePlayer.color, remotePlayer.invisible, remotePlayer.invulnerable);
    }
}

