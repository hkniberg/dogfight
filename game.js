// Main game engine and loop

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Game state
        this.state = 'MENU'; // MENU, PLAYING, GAME_OVER
        this.paused = false;
        this.matchWon = false; // Track if match has been won
        
        // Managers
        this.ui = new UIManager();
        this.audio = new AudioManager();
        this.particles = new ParticleSystem();
        this.powerUpManager = new PowerUpManager();
        
        // Players
        this.player1 = null;
        this.player2 = null;
        
        // Game objects
        this.bullets = [];
        this.homingMissiles = [];
        this.lasers = [];
        this.bombs = [];
        this.asteroid = null;
        this.shrapnel = [];
        
        // Score
        this.p1Score = 0;
        this.p2Score = 0;
        this.winScore = GAME_SETTINGS.winScore;
        
        // Timing
        this.lastTime = 0;
        this.gameSpeed = 1;
        this.asteroidSpawnTimer = 0;
        this.nextAsteroidSpawnInterval = random(
            GAME_SETTINGS.asteroid.spawnIntervalMin,
            GAME_SETTINGS.asteroid.spawnIntervalMax
        );
        
        // Input
        this.keys = {};
        this.setupInput();
        
        // UI callbacks
        this.ui.onStartGame(() => this.startGame());
        this.ui.onPlayAgain(() => this.startGame());
        this.ui.onMainMenu(() => this.returnToMenu());
        this.ui.onResetStats(() => this.ui.resetStats());
        
        // Start game loop
        this.lastTime = performance.now();
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    resize() {
        // Make canvas fill the window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            
            // Escape key returns to menu
            if (e.key === 'Escape' && this.state === 'PLAYING') {
                this.returnToMenu();
                return;
            }
            
            if (this.state === 'PLAYING' && this.player1 && this.player2) {
                this.handleInput(e.key, true);
            }
            
            // Prevent arrow keys from scrolling
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }
    
    handleInput(key, pressed) {
        if (!pressed) return;
        
        // Player 1 controls (WASD + E)
        if (key === 'w') this.player1.speedUp();
        if (key === 's') this.player1.speedDown();
        if (key === 'a') this.player1.turnLeft();
        if (key === 'd') this.player1.turnRight();
        if (key === 'e') this.handleFire(this.player1, this.player2);
        
        // Player 2 controls (Arrows + -)
        if (key === 'ArrowUp') this.player2.speedUp();
        if (key === 'ArrowDown') this.player2.speedDown();
        if (key === 'ArrowLeft') this.player2.turnLeft();
        if (key === 'ArrowRight') this.player2.turnRight();
        if (key === '-') this.handleFire(this.player2, this.player1);
    }
    
    handleFire(player, targetPlayer) {
        const result = player.fire(targetPlayer);
        if (!result) return;
        
        // Handle special effect power-ups (affect opponent)
        if (result.type === 'reverse') {
            targetPlayer.activateReverse();
            this.audio.playPowerUp();
            this.particles.createExplosion(targetPlayer.x, targetPlayer.y, '#ffff00', 15, 150);
            
            // Reverse all existing homing missiles from the target player
            for (let missile of this.homingMissiles) {
                if (missile.ownerId === targetPlayer.id) {
                    missile.targetPlayer = targetPlayer; // Now targets the shooter!
                }
            }
            return;
        }
        
        if (result.type === 'asteroidChase') {
            if (this.asteroid && this.asteroid.alive) {
                this.asteroid.startChasing(targetPlayer);
                this.audio.playPowerUp();
                this.particles.createExplosion(this.asteroid.x, this.asteroid.y, '#ff00ff', 20, 200);
            }
            return;
        }
        
        // Handle weapon arrays (for multishot support)
        const weapons = Array.isArray(result.weapon) ? result.weapon : [result.weapon];
        
        if (result.type === 'bullets') {
            this.audio.playShoot();
        } else if (result.type === 'homing') {
            this.homingMissiles.push(...weapons);
            this.audio.playShoot();
        } else if (result.type === 'laser') {
            this.lasers.push(...weapons);
            this.audio.playLaserHum();
        } else if (result.type === 'bomb') {
            this.bombs.push(...weapons);
        }
    }
    
    startGame() {
        // Initialize audio on first interaction
        this.audio.init();
        
        // Get player configuration
        const config = this.ui.getPlayerConfig();
        
        // Create players back-to-back at center, facing away from each other
        const centerX = this.canvas.width * 0.5;
        const centerY = this.canvas.height * 0.5;
        const spacing = GAME_SETTINGS.player.startSpacing;
        
        const p1StartX = centerX - spacing;
        const p1StartY = centerY;
        const p2StartX = centerX + spacing;
        const p2StartY = centerY;
        
        this.player1 = new Player(
            1,
            p1StartX, p1StartY,
            Math.PI, // Facing left
            config.player1.color,
            config.player1.name,
            { up: 'w', down: 's', left: 'a', right: 'd', fire: 'e' }
        );
        
        this.player2 = new Player(
            2,
            p2StartX, p2StartY,
            0, // Facing right
            config.player2.color,
            config.player2.name,
            { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', fire: '-' }
        );
        
        // Set both players to starting speed
        this.player1.speedLevel = GAME_SETTINGS.player.defaultSpeedLevel;
        this.player2.speedLevel = GAME_SETTINGS.player.defaultSpeedLevel;
        
        // Reset score and match state
        this.p1Score = 0;
        this.p2Score = 0;
        this.matchWon = false;
        
        // Clear game objects
        this.bullets = [];
        this.homingMissiles = [];
        this.lasers = [];
        this.bombs = [];
        this.asteroid = null;
        this.shrapnel = [];
        this.particles.clear();
        this.powerUpManager.clear();
        
        // Reset timers
        this.asteroidSpawnTimer = 0;
        this.nextAsteroidSpawnInterval = random(
            GAME_SETTINGS.asteroid.spawnIntervalMin,
            GAME_SETTINGS.asteroid.spawnIntervalMax
        );
        
        // Update UI
        this.ui.updateScore(this.p1Score, this.p2Score, config.player1.color, config.player2.color);
        this.ui.showScreen('game');
        
        this.state = 'PLAYING';
    }
    
    returnToMenu() {
        this.state = 'MENU';
        this.matchWon = false;
        this.ui.showScreen('menu');
    }
    
    gameLoop(currentTime) {
        requestAnimationFrame((time) => this.gameLoop(time));
        
        // Calculate delta time
        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1) * this.gameSpeed;
        this.lastTime = currentTime;
        
        // Clear canvas
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.drawGrid();
        
        if (this.state === 'PLAYING') {
            this.update(dt);
            this.draw();
        }
    }
    
    drawGrid() {
        const gridSize = GAME_SETTINGS.grid.size;
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${GAME_SETTINGS.grid.opacity})`;
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    update(dt) {
        if (!this.player1 || !this.player2) return;
        
        // Update players
        if (this.player1.alive) {
            this.player1.update(dt, this.canvas.width, this.canvas.height);
            this.player1.updateBullets(dt, this.canvas.width, this.canvas.height);
        }
        
        if (this.player2.alive) {
            this.player2.update(dt, this.canvas.width, this.canvas.height);
            this.player2.updateBullets(dt, this.canvas.width, this.canvas.height);
        }
        
        // Update weapons
        this.homingMissiles = this.homingMissiles.filter(m => m.update(dt, this.canvas.width, this.canvas.height));
        this.lasers = this.lasers.filter(l => l.update(dt));
        this.bombs = this.bombs.filter(b => {
            const stillAlive = b.update(dt, this.canvas.width, this.canvas.height, [this.player1, this.player2]);
            if (b.detonated) {
                this.handleBombExplosion(b);
            }
            return stillAlive;
        });
        
        // Update asteroid
        if (this.asteroid) {
            if (!this.asteroid.update(dt)) {
                this.asteroid = null;
            }
        } else {
            // Spawn new asteroid
            this.asteroidSpawnTimer += dt;
            if (this.asteroidSpawnTimer > this.nextAsteroidSpawnInterval) {
                this.spawnAsteroid();
                this.asteroidSpawnTimer = 0;
                // Set next random interval
                this.nextAsteroidSpawnInterval = random(
                    GAME_SETTINGS.asteroid.spawnIntervalMin,
                    GAME_SETTINGS.asteroid.spawnIntervalMax
                );
            }
        }
        
        // Update shrapnel
        this.shrapnel = this.shrapnel.filter(s => s.update(dt, this.canvas.width, this.canvas.height));
        
        // Update power-ups
        this.powerUpManager.update(dt, [this.player1, this.player2], this.canvas.width, this.canvas.height);
        
        // Update particles
        this.particles.update(dt, this.canvas.width, this.canvas.height);
        
        // Collision detection
        this.checkCollisions();
    }
    
    checkCollisions() {
        const players = [this.player1, this.player2];
        
        // Player vs bullets
        for (let player of players) {
            if (!player.alive || player.invulnerable) continue;
            
            for (let otherPlayer of players) {
                if (player === otherPlayer) continue;
                
                for (let bullet of otherPlayer.bullets) {
                    if (!bullet.alive) continue;
                    
                    const dist = getDistance(
                        player.x, player.y,
                        bullet.x, bullet.y,
                        this.canvas.width, this.canvas.height
                    );
                    
                    if (dist < player.radius + bullet.radius) {
                        bullet.alive = false;
                        this.handlePlayerHit(player, otherPlayer);
                    }
                }
            }
        }
        
        // Player vs homing missiles (can hit any player including owner)
        for (let player of players) {
            if (!player.alive || player.invulnerable) continue;
            
            for (let missile of this.homingMissiles) {
                const dist = getDistance(
                    player.x, player.y,
                    missile.x, missile.y,
                    this.canvas.width, this.canvas.height
                );
                
                if (dist < player.radius + missile.radius) {
                    missile.alive = false;
                    const attacker = players.find(p => p.id === missile.ownerId);
                    this.handlePlayerHit(player, attacker);
                }
            }
        }
        
        // Player vs lasers
        for (let player of players) {
            if (!player.alive || player.invulnerable) continue;
            
            for (let laser of this.lasers) {
                if (laser.ownerId === player.id) continue;
                
                if (laser.checkHit(player.x, player.y, player.radius, this.canvas.width, this.canvas.height)) {
                    // Check if player has shield
                    if (player.shields > 0) {
                        player.removeShield();
                        laser.alive = false; // Laser is destroyed by shield
                        this.audio.playShieldHit();
                    } else {
                        this.handlePlayerHit(player, players.find(p => p.id === laser.ownerId));
                    }
                }
            }
        }
        
        // Player vs shrapnel
        for (let player of players) {
            if (!player.alive || player.invulnerable) continue;
            
            for (let shard of this.shrapnel) {
                const dist = getDistance(
                    player.x, player.y,
                    shard.x, shard.y,
                    this.canvas.width, this.canvas.height
                );
                
                if (dist < player.radius + shard.radius) {
                    shard.alive = false;
                    
                    // Check for shields
                    if (player.shields > 0) {
                        player.removeShield();
                        this.audio.playShieldHit();
                        this.particles.createExplosion(player.x, player.y, '#0066ff', 10, 100);
                        
                        // Change direction to move away from shrapnel
                        const awayAngle = Math.atan2(
                            player.y - shard.y,
                            player.x - shard.x
                        );
                        player.angle = awayAngle;
                    } else {
                        this.handlePlayerHit(player, null);
                    }
                }
            }
        }
        
        // Player vs asteroid
        if (this.asteroid && this.asteroid.alive) {
            for (let player of players) {
                if (!player.alive || player.invulnerable) continue;
                
                const dist = getDistance(
                    player.x, player.y,
                    this.asteroid.x, this.asteroid.y,
                    this.canvas.width, this.canvas.height
                );
                
                if (dist < player.radius + this.asteroid.size) {
                    if (player.shields > 0) {
                        // Bounce off - change direction to move away
                        player.removeShield();
                        this.audio.playShieldHit();
                        this.particles.createExplosion(player.x, player.y, '#0066ff', 10, 100);
                        
                        // Calculate angle away from asteroid
                        const awayAngle = Math.atan2(
                            player.y - this.asteroid.y,
                            player.x - this.asteroid.x
                        );
                        
                        // Set player direction to move away
                        player.angle = awayAngle;
                        
                        // Push player away from asteroid
                        const pushDistance = (player.radius + this.asteroid.size) - dist + GAME_SETTINGS.collision.asteroidPushDistance;
                        player.x += Math.cos(awayAngle) * pushDistance;
                        player.y += Math.sin(awayAngle) * pushDistance;
                    } else {
                        this.handlePlayerHit(player, null);
                    }
                }
            }
        }
        
        // Bullets vs asteroid
        if (this.asteroid && this.asteroid.alive) {
            for (let player of players) {
                for (let bullet of player.bullets) {
                    if (!bullet.alive) continue;
                    
                    const dist = getDistance(
                        bullet.x, bullet.y,
                        this.asteroid.x, this.asteroid.y,
                        this.canvas.width, this.canvas.height
                    );
                    
                    if (dist < bullet.radius + this.asteroid.size) {
                        bullet.alive = false;
                        // Pass bullet position to show damage hole
                        this.asteroid.takeDamage(bullet.x, bullet.y, 1);
                        this.particles.createDebris(bullet.x, bullet.y, '#888888', 3);
                        if (!this.asteroid.alive) {
                            this.particles.createExplosion(this.asteroid.x, this.asteroid.y, '#888888', 20);
                        }
                    }
                }
            }
        }
        
        // Homing missiles vs asteroid
        if (this.asteroid && this.asteroid.alive) {
            for (let missile of this.homingMissiles) {
                const dist = getDistance(
                    missile.x, missile.y,
                    this.asteroid.x, this.asteroid.y,
                    this.canvas.width, this.canvas.height
                );
                
                if (dist < missile.radius + this.asteroid.size) {
                    missile.alive = false;
                    // Missiles do extra damage (heavier hit)
                    this.asteroid.takeDamage(missile.x, missile.y, GAME_SETTINGS.weapons.homingMissile.asteroidDamage);
                    this.audio.playExplosion();
                    this.particles.createExplosion(missile.x, missile.y, '#ff0000', 20, 200);
                    
                    if (!this.asteroid.alive) {
                        // Destroyed by missile - create shrapnel
                        this.shrapnel.push(...this.asteroid.createShrapnel());
                        this.particles.createExplosion(this.asteroid.x, this.asteroid.y, '#888888', 30);
                    }
                }
            }
        }
        
        // Bombs vs bullets (remote detonation)
        for (let bomb of this.bombs) {
            if (!bomb.alive) continue;
            
            for (let player of players) {
                for (let bullet of player.bullets) {
                    if (!bullet.alive) continue;
                    
                    const dist = getDistance(
                        bullet.x, bullet.y,
                        bomb.x, bomb.y,
                        this.canvas.width, this.canvas.height
                    );
                    
                    if (dist < bullet.radius + bomb.radius) {
                        bullet.alive = false;
                        bomb.detonate();
                    }
                }
            }
        }
        
        // Bombs vs asteroid
        if (this.asteroid && this.asteroid.alive) {
            for (let bomb of this.bombs) {
                if (!bomb.alive) continue;
                
                const dist = getDistance(
                    bomb.x, bomb.y,
                    this.asteroid.x, this.asteroid.y,
                    this.canvas.width, this.canvas.height
                );
                
                if (dist < bomb.radius + this.asteroid.size) {
                    bomb.detonate();
                }
            }
        }
        
        // Lasers vs asteroid (blocked but don't damage)
        if (this.asteroid && this.asteroid.alive) {
            for (let laser of this.lasers) {
                if (!laser.alive) continue;
                
                // Check if laser beam hits the asteroid
                if (laser.checkHit(this.asteroid.x, this.asteroid.y, this.asteroid.size, this.canvas.width, this.canvas.height)) {
                    // Laser is blocked and destroyed
                    laser.alive = false;
                    // Create small impact particles where laser hits
                    this.particles.createDebris(this.asteroid.x, this.asteroid.y, laser.color, 5);
                }
            }
        }
        
        // Player vs player collision
        if (this.player1.alive && this.player2.alive && !this.player1.invulnerable && !this.player2.invulnerable) {
            const dist = getDistance(
                this.player1.x, this.player1.y,
                this.player2.x, this.player2.y,
                this.canvas.width, this.canvas.height
            );
            
            if (dist < this.player1.radius + this.player2.radius) {
                // Head-on collision
                const p1HasShield = this.player1.shields > 0;
                const p2HasShield = this.player2.shields > 0;
                
                if (p1HasShield && p2HasShield) {
                    // Both have shields - both lose shield and bounce apart
                    this.player1.removeShield();
                    this.player2.removeShield();
                    this.audio.playShieldHit();
                    this.particles.createExplosion(this.player1.x, this.player1.y, '#0066ff', 10, 100);
                    this.particles.createExplosion(this.player2.x, this.player2.y, '#0066ff', 10, 100);
                    
                    // Calculate collision angle
                    const collisionAngle = Math.atan2(
                        this.player2.y - this.player1.y,
                        this.player2.x - this.player1.x
                    );
                    
                    // Set players to move away from each other
                    this.player1.angle = collisionAngle + Math.PI;
                    this.player2.angle = collisionAngle;
                    
                    // Push players apart
                    const overlap = (this.player1.radius + this.player2.radius) - dist;
                    const pushDistance = (overlap / 2) + GAME_SETTINGS.collision.playerPushDistance;
                    
                    this.player1.x -= Math.cos(collisionAngle) * pushDistance;
                    this.player1.y -= Math.sin(collisionAngle) * pushDistance;
                    this.player2.x += Math.cos(collisionAngle) * pushDistance;
                    this.player2.y += Math.sin(collisionAngle) * pushDistance;
                } else if (p1HasShield && !p2HasShield) {
                    // P1 has shield, P2 doesn't - P2 dies, P1 loses shield and bounces
                    this.handlePlayerHit(this.player2, this.player1);
                    this.player1.removeShield();
                    this.audio.playShieldHit();
                    this.particles.createExplosion(this.player1.x, this.player1.y, '#0066ff', 10, 100);
                    
                    // P1 bounces away
                    const awayAngle = Math.atan2(
                        this.player1.y - this.player2.y,
                        this.player1.x - this.player2.x
                    );
                    this.player1.angle = awayAngle;
                    this.player1.x += Math.cos(awayAngle) * GAME_SETTINGS.collision.playerPushDistance;
                    this.player1.y += Math.sin(awayAngle) * GAME_SETTINGS.collision.playerPushDistance;
                } else if (!p1HasShield && p2HasShield) {
                    // P2 has shield, P1 doesn't - P1 dies, P2 loses shield and bounces
                    this.handlePlayerHit(this.player1, this.player2);
                    this.player2.removeShield();
                    this.audio.playShieldHit();
                    this.particles.createExplosion(this.player2.x, this.player2.y, '#0066ff', 10, 100);
                    
                    // P2 bounces away
                    const awayAngle = Math.atan2(
                        this.player2.y - this.player1.y,
                        this.player2.x - this.player1.x
                    );
                    this.player2.angle = awayAngle;
                    this.player2.x += Math.cos(awayAngle) * GAME_SETTINGS.collision.playerPushDistance;
                    this.player2.y += Math.sin(awayAngle) * GAME_SETTINGS.collision.playerPushDistance;
                } else {
                    // Neither has shield - both destroyed
                    this.handlePlayerHit(this.player1, null);
                    this.handlePlayerHit(this.player2, null);
                }
            }
        }
    }
    
    handlePlayerHit(victim, attacker) {
        // Check for shields
        if (victim.shields > 0) {
            victim.removeShield();
            this.audio.playShieldHit();
            this.particles.createExplosion(victim.x, victim.y, '#0066ff', 10, 100);
            return;
        }
        
        // Player dies
        victim.die();
        this.audio.playExplosion();
        this.particles.createExplosion(victim.x, victim.y, victim.color, 30);
        
        // Update score
        if (attacker) {
            if (attacker.id === 1) {
                this.p1Score++;
            } else {
                this.p2Score++;
            }
            
            this.ui.updateScore(this.p1Score, this.p2Score, this.player1.color, this.player2.color);
            
            // Check for win
            if (this.p1Score >= this.winScore && !this.matchWon) {
                this.endGame(this.player1);
                return;
            } else if (this.p2Score >= this.winScore && !this.matchWon) {
                this.endGame(this.player2);
                return;
            }
        }
        
        // Respawn player (but not if match has been won)
        if (!this.matchWon) {
            setTimeout(() => {
                if (this.state === 'PLAYING' && !this.matchWon) {
                    const pos = getRandomSpawnPosition(
                        [this.player1, this.player2],
                        200,
                        this.canvas.width,
                        this.canvas.height
                    );
                    victim.respawn(pos.x, pos.y, random(0, Math.PI * 2));
                }
            }, victim.respawnDelay * 1000);
        }
    }
    
    handleBombExplosion(bomb) {
        this.audio.playExplosion();
        this.particles.createShockwave(bomb.x, bomb.y, bomb.explosionRadius, bomb.color, 0.6);
        this.particles.createExplosion(bomb.x, bomb.y, bomb.color, 40, 300);
        
        // Damage players in radius
        const players = [this.player1, this.player2];
        for (let player of players) {
            if (!player.alive || player.invulnerable) continue;
            
            const dist = getDistance(
                player.x, player.y,
                bomb.x, bomb.y,
                this.canvas.width, this.canvas.height
            );
            
            if (dist < bomb.explosionRadius) {
                const attacker = players.find(p => p.id === bomb.ownerId);
                this.handlePlayerHit(player, attacker);
            }
        }
        
        // Destroy asteroid
        if (this.asteroid && this.asteroid.alive) {
            const dist = getDistance(
                this.asteroid.x, this.asteroid.y,
                bomb.x, bomb.y,
                this.canvas.width, this.canvas.height
            );
            
            if (dist < bomb.explosionRadius) {
                this.asteroid.instantDestroy();
                this.shrapnel.push(...this.asteroid.createShrapnel());
                this.particles.createExplosion(this.asteroid.x, this.asteroid.y, '#888888', 30);
            }
        }
    }
    
    spawnAsteroid() {
        const pos = getRandomSpawnPosition(
            [this.player1, this.player2],
            200,
            this.canvas.width,
            this.canvas.height
        );
        this.asteroid = new Asteroid(pos.x, pos.y, this.canvas.width, this.canvas.height);
    }
    
    endGame(winner) {
        this.matchWon = true; // Mark that match is won but keep playing
        this.ui.recordWin(winner.id);
        this.ui.showGameOver(winner.name, winner.color);
    }
    
    draw() {
        // Draw particles (background layer)
        this.particles.draw(this.ctx);
        
        // Draw asteroid
        if (this.asteroid) {
            this.asteroid.draw(this.ctx);
        }
        
        // Draw shrapnel
        this.shrapnel.forEach(s => s.draw(this.ctx));
        
        // Draw power-ups
        this.powerUpManager.draw(this.ctx);
        
        // Draw players
        if (this.player1) {
            this.player1.draw(this.ctx);
            this.player1.drawBullets(this.ctx);
        }
        
        if (this.player2) {
            this.player2.draw(this.ctx);
            this.player2.drawBullets(this.ctx);
        }
        
        // Draw weapons
        this.homingMissiles.forEach(m => m.draw(this.ctx));
        this.lasers.forEach(l => l.draw(this.ctx, this.canvas.width, this.canvas.height));
        this.bombs.forEach(b => b.draw(this.ctx));
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    new Game();
});

