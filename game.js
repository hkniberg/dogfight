// Main game engine and loop

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set fixed canvas size (required for multiplayer consistency)
        this.canvas.width = GAME_SETTINGS.canvas.width;
        this.canvas.height = GAME_SETTINGS.canvas.height;
        
        // Scale and center canvas on screen
        this.updateCanvasScale();
        window.addEventListener('resize', () => this.updateCanvasScale());
        
        // Game state
        this.state = 'MENU'; // MENU, PLAYING, GAME_OVER
        this.paused = false;
        this.matchWon = false; // Track if match has been won
        
        // Managers
        this.ui = new UIManager();
        this.audio = new AudioManager();
        this.particles = new ParticleSystem();
        
        // Network manager (local mode for now)
        this.network = null;
        this.battleCodeForHud = null; // Battle code to display in HUD (for host)
        
        // Players
        this.myPlayers = []; // Players controlled by this client (1-2 depending on mode)
        this.remotePlayers = new Map(); // id -> RemotePlayer (for online mode)
        
        // Game objects
        this.bullets = [];
        this.remoteBullets = []; // Bullets from remote players
        this.homingMissiles = [];
        this.lasers = [];
        this.bombs = [];
        this.asteroid = null;
        this.shrapnel = [];
        this.powerUps = []; // Power-ups now managed by network spawning
        
        // Score
        this.playerScores = new Map(); // playerId -> score
        this.winScore = GAME_SETTINGS.winScore;
        
        // Timing
        this.lastTime = 0;
        this.gameSpeed = 1;
        
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
    
    updateCanvasScale() {
        // Scale canvas to fit window while maintaining aspect ratio
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const canvasWidth = GAME_SETTINGS.canvas.width;
        const canvasHeight = GAME_SETTINGS.canvas.height;
        
        // Reserve space for HUD (approximately 60px)
        const availableHeight = windowHeight - 60;
        
        // Calculate scale to fit available space
        const scaleX = windowWidth / canvasWidth;
        const scaleY = availableHeight / canvasHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%
        
        // Apply CSS transform to scale (no absolute positioning - let flexbox handle it)
        this.canvas.style.width = `${canvasWidth * scale}px`;
        this.canvas.style.height = `${canvasHeight * scale}px`;
    }
    
    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            
            // Escape key returns to menu
            if (e.key === 'Escape' && this.state === 'PLAYING') {
                this.returnToMenu();
                return;
            }
            
            if (this.state === 'PLAYING') {
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
        
        // Each player responds to their own keys
        for (const player of this.myPlayers) {
            if (!player) continue;
            
            const keys = player.controls;
            if (!keys) continue;
            
            if (key === keys.up) player.speedUp();
            if (key === keys.down) player.speedDown();
            if (key === keys.left) player.turnLeft();
            if (key === keys.right) player.turnRight();
            if (key === keys.fire) this.handleFire(player);
        }
    }
    
    handleFire(player) {
        // Find target player (for special powerups like reverse/asteroidChase)
        // In local mode: other local player
        // In online mode: pick random opponent or null
        let targetPlayer = null;
        if (this.myPlayers.length > 1) {
            // Local mode: find other local player
            targetPlayer = this.myPlayers.find(p => p !== player);
        }
        
        const result = player.fire(targetPlayer);
        if (!result) return;
        
        // Send weapon fire event to network (online mode)
        if (this.network && this.network.constructor.name === 'PeerNetworkManager') {
            this.network.sendWeaponFire(player.id, {
                weaponType: result.type,
                x: player.x,
                y: player.y,
                angle: player.angle
            });
        }
        
        // Handle special effect power-ups (affect opponent)
        if (result.type === 'reverse') {
            if (targetPlayer) {
                targetPlayer.activateReverse();
                this.audio.playPowerUp();
                this.particles.createExplosion(targetPlayer.x, targetPlayer.y, '#ffff00', 15, 150);
                
                // Reverse all existing homing missiles from the target player
                for (let missile of this.homingMissiles) {
                    if (missile.ownerId === targetPlayer.id) {
                        missile.targetPlayer = targetPlayer; // Now targets the shooter!
                    }
                }
            }
            // TODO: In online mode with multiple opponents, affect all opponents
            return;
        }
        
        if (result.type === 'asteroidChase') {
            if (this.asteroid && this.asteroid.alive && targetPlayer) {
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
    
    async startGame() {
        // Initialize audio on first interaction
        this.audio.init();
        
        // Get player configuration and mode
        const config = this.ui.getPlayerConfig();
        const mode = this.ui.getMode();
        
        try {
            // Initialize network manager based on mode
            if (mode === 'local') {
                // Local multiplayer
                this.network = new LocalNetworkManager(this.canvas.width, this.canvas.height);
                this.setupNetworkCallbacks();
                
                // Create both players locally
                await this.setupLocalPlayers(config);
                
            } else if (mode === 'host') {
                // Host online game
                this.network = new PeerNetworkManager(this.canvas.width, this.canvas.height, true);
                this.setupNetworkCallbacks();
                
                // Connect as host
                const myPlayerId = await this.network.connect(config.player1.name, config.player1.color);
                
                // Show battle code in menu and HUD
                this.ui.showBattleCode(this.network.myPeerId);
                this.battleCodeForHud = this.network.myPeerId; // Store for HUD display
                
                // Create local player
                await this.setupOnlinePlayer(myPlayerId, config.player1, true);
                
            } else if (mode === 'join') {
                // Join online game
                const battleCode = this.ui.getBattleCode();
                if (!battleCode) {
                    alert('Please enter a battle code to join!');
                    return;
                }
                
                this.network = new PeerNetworkManager(this.canvas.width, this.canvas.height, false, battleCode);
                this.setupNetworkCallbacks();
                
                // Connect as client
                const myPlayerId = await this.network.connect(config.player1.name, config.player1.color);
                
                // Create local player
                await this.setupOnlinePlayer(myPlayerId, config.player1, false);
            }
            
        } catch (error) {
            console.error('Failed to start game:', error);
            alert(`Failed to connect: ${error.message}`);
            return;
        }
        
        // Reset score and match state
        this.playerScores.clear();
        // Initialize scores for all players
        for (const player of this.myPlayers) {
            this.playerScores.set(player.id, 0);
        }
        this.matchWon = false;
        
        // Clear game objects
        this.bullets = [];
        this.remoteBullets = [];
        this.homingMissiles = [];
        this.lasers = [];
        this.bombs = [];
        this.asteroid = null;
        this.shrapnel = [];
        this.powerUps = [];
        this.particles.clear();
        this.remotePlayers.clear();
        
        // Initialize score display for all players
        this.ui.initScores(this.myPlayers);
        
        // Show battle code in HUD if hosting
        if (this.battleCodeForHud) {
            this.ui.showBattleCodeInHud(this.battleCodeForHud);
        }
        
        this.ui.showScreen('game');
        
        this.state = 'PLAYING';
    }
    
    async setupLocalPlayers(config) {
        // Create players back-to-back at center, facing away from each other
        const centerX = this.canvas.width * 0.5;
        const centerY = this.canvas.height * 0.5;
        const spacing = GAME_SETTINGS.player.startSpacing;
        
        const p1StartX = centerX - spacing;
        const p1StartY = centerY;
        const p2StartX = centerX + spacing;
        const p2StartY = centerY;
        
        // Connect players through network (gets player IDs)
        const p1Id = this.network.connect(config.player1.name, config.player1.color);
        const p2Id = this.network.connect(config.player2.name, config.player2.color);
        
        const player1 = new Player(
            p1Id,
            p1StartX, p1StartY,
            Math.PI, // Facing left
            config.player1.color,
            config.player1.name,
            { up: 'w', down: 's', left: 'a', right: 'd', fire: 'e' }
        );
        
        const player2 = new Player(
            p2Id,
            p2StartX, p2StartY,
            0, // Facing right
            config.player2.color,
            config.player2.name,
            { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', fire: '-' }
        );
        
        // Set both players to starting speed
        player1.speedLevel = GAME_SETTINGS.player.defaultSpeedLevel;
        player2.speedLevel = GAME_SETTINGS.player.defaultSpeedLevel;
        
        // Add to myPlayers array
        this.myPlayers = [player1, player2];
    }
    
    async setupOnlinePlayer(playerId, playerConfig, isHost) {
        // Random spawn position for online mode
        const x = Math.random() * this.canvas.width;
        const y = Math.random() * this.canvas.height;
        const angle = Math.random() * Math.PI * 2;
        
        // Create local player
        const player = new Player(
            playerId,
            x, y, angle,
            playerConfig.color,
            playerConfig.name,
            { up: 'w', down: 's', left: 'a', right: 'd', fire: 'e' }
        );
        
        player.speedLevel = GAME_SETTINGS.player.defaultSpeedLevel;
        
        // In online mode, only control one player
        this.myPlayers = [player];
    }
    
    setupNetworkCallbacks() {
        // Player joined (for online mode)
        this.network.onPlayerJoined((data) => {
            console.log(`[Game] Player joined: ${data.name} (ID: ${data.id})`);
            
            // Don't create remote player for ourselves
            if (this.myPlayers.some(p => p.id === data.id)) return;
            
            // Create remote player
            const remotePlayer = new RemotePlayer(data.id, data.name, data.color);
            // Set initial position (will be updated via network)
            remotePlayer.displayPos = {
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                angle: Math.random() * Math.PI * 2
            };
            remotePlayer.targetPos = { ...remotePlayer.displayPos };
            
            this.remotePlayers.set(data.id, remotePlayer);
            
            // Update score display
            const allPlayers = [...this.myPlayers, ...Array.from(this.remotePlayers.values())];
            this.ui.initScores(allPlayers);
        });
        
        // Player update (position/state from network)
        this.network.onPlayerUpdate((data) => {
            const remotePlayer = this.remotePlayers.get(data.id);
            if (remotePlayer) {
                remotePlayer.onNetworkUpdate(data);
            }
        });
        
        // Weapon fired by remote player
        this.network.onWeaponFired((data) => {
            console.log(`[Game] Weapon fired by player ${data.playerId}: ${data.weaponType}`);
            // Create weapon at specified position
            this.createWeaponFromNetwork(data);
        });
        
        // Player died
        this.network.onPlayerDied((data) => {
            console.log(`[Game] Player ${data.victimId} killed by ${data.killerId}`);
            // Handle death for local or remote player
            this.handlePlayerDeath(data.victimId, data.killerId);
        });
        
        // Player left
        this.network.onPlayerLeft((data) => {
            console.log(`[Game] Player left: ${data.id}`);
            
            // Check if host left (game over for clients)
            if (data.isHost) {
                alert('Host disconnected. Returning to menu.');
                this.returnToMenu();
                return;
            }
            
            // Remove remote player
            this.remotePlayers.delete(data.id);
            
            // Update score display
            const allPlayers = [...this.myPlayers, ...Array.from(this.remotePlayers.values())];
            this.ui.initScores(allPlayers);
        });
        
        // Power-up spawned by network
        this.network.onPowerUpSpawned((data) => {
            this.powerUps.push(new PowerUp(data.x, data.y, data.type));
            this.powerUps[this.powerUps.length - 1].id = data.id;
            this.powerUps[this.powerUps.length - 1].seq = data.seq;
        });
        
        // Power-up collected
        this.network.onPowerUpCollected((data) => {
            // Remove powerup from map
            this.powerUps = this.powerUps.filter(p => p.id !== data.id);
            
            // Apply powerup effect to the player who collected it
            // Check if it's one of our local players
            const localPlayer = this.myPlayers.find(p => p.id === data.playerId);
            if (localPlayer) {
                // It's our local player - already applied locally, skip
                return;
            }
            
            // It's a remote player - apply the effect to them
            const remotePlayer = this.remotePlayers.get(data.playerId);
            if (remotePlayer && data.powerupType) {
                this.applyPowerUpToRemote(remotePlayer, data.powerupType);
            }
        });
        
        // Asteroid spawned by network
        this.network.onAsteroidSpawned((data) => {
            this.asteroid = this.createAsteroidFromData(data);
        });
        
        // Asteroid damaged by network
        this.network.onAsteroidDamaged((data) => {
            if (this.asteroid && this.asteroid.alive) {
                this.asteroid.takeDamage(data.x, data.y, data.damage);
                this.particles.createDebris(data.x, data.y, '#888888', 3);
            }
        });
        
        // Asteroid destroyed by network
        this.network.onAsteroidDestroyed(() => {
            if (this.asteroid && this.asteroid.alive) {
                this.shrapnel.push(...this.asteroid.createShrapnel());
                this.particles.createExplosion(this.asteroid.x, this.asteroid.y, '#888888', 30);
                this.asteroid = null;
            }
        });
    }
    
    createWeaponFromNetwork(data) {
        // Find the player who fired (local or remote)
        let firingPlayer = this.myPlayers.find(p => p.id === data.playerId);
        if (!firingPlayer) {
            // It's a remote player
            firingPlayer = this.remotePlayers.get(data.playerId);
        }
        
        if (!firingPlayer) {
            console.warn('[Game] Unknown player fired weapon:', data.playerId);
            return;
        }
        
        const color = firingPlayer.color;
        
        // Create weapons based on type
        if (data.weaponType === 'bullets') {
            // Create bullet(s) - could be multishot
            const bullet = new Bullet(data.x, data.y, data.angle, color, data.playerId);
            
            // For remote players, add to their bullets array if they have one
            // Otherwise add to a global array (for remote players)
            if (firingPlayer.bullets) {
                firingPlayer.bullets.push(bullet);
            } else {
                // Remote player - we need to track their bullets separately
                // For now, add to a remote bullets array
                if (!this.remoteBullets) {
                    this.remoteBullets = [];
                }
                this.remoteBullets.push(bullet);
            }
            
            this.audio.playShoot();
        } else if (data.weaponType === 'homing') {
            // Find a target (pick a local player or null)
            const targetPlayer = this.myPlayers[0] || null;
            const missile = new HomingMissile(data.x, data.y, data.angle, color, data.playerId, targetPlayer);
            this.homingMissiles.push(missile);
            this.audio.playShoot();
        } else if (data.weaponType === 'laser') {
            const laser = new Laser(data.x, data.y, data.angle, color, data.playerId);
            this.lasers.push(laser);
            this.audio.playLaserHum();
        } else if (data.weaponType === 'bomb') {
            const bomb = new Bomb(data.x, data.y, data.angle, color, data.playerId);
            this.bombs.push(bomb);
        }
    }
    
    handlePlayerDeath(victimId, killerId) {
        // Handle death for local or remote players
        // TODO: Implement death handling
        console.log(`[Game] Handling death: victim=${victimId}, killer=${killerId}`);
    }
    
    createAsteroidFromData(data) {
        // Create asteroid with specific properties from network
        const asteroid = new Asteroid(data.x, data.y, this.canvas.width, this.canvas.height);
        asteroid.size = data.size;
        asteroid.vx = data.vx;
        asteroid.vy = data.vy;
        asteroid.points = data.points;
        asteroid.rotation = data.rotation || 0;
        asteroid.rotationSpeed = data.rotationSpeed || 0;
        return asteroid;
    }
    
    returnToMenu() {
        this.state = 'MENU';
        this.matchWon = false;
        
        // Hide battle code from HUD
        this.ui.hideBattleCodeInHud();
        this.battleCodeForHud = null;
        
        // Disconnect from network
        if (this.network) {
            this.network.disconnect();
            this.network = null;
        }
        
        // Clear players
        this.myPlayers = [];
        this.remotePlayers.clear();
        
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
    
    drawRemotePlayer(remotePlayer) {
        const pos = remotePlayer.displayPos;
        const size = 12;
        
        this.ctx.save();
        this.ctx.translate(pos.x, pos.y);
        this.ctx.rotate(pos.angle);
        
        // Draw ship body (triangle)
        this.ctx.beginPath();
        this.ctx.moveTo(size, 0);
        this.ctx.lineTo(-size, size / 2);
        this.ctx.lineTo(-size, -size / 2);
        this.ctx.closePath();
        
        // Fill and outline
        this.ctx.fillStyle = remotePlayer.color;
        this.ctx.fill();
        this.ctx.strokeStyle = remotePlayer.color;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Add glow effect
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = remotePlayer.color;
        this.ctx.stroke();
        
        // Draw shields
        if (remotePlayer.shields > 0) {
            for (let i = 0; i < remotePlayer.shields; i++) {
                const shieldRadius = size + 8 + (i * 6);
                const shieldWidth = 2 + i;
                this.ctx.strokeStyle = '#0066ff';
                this.ctx.lineWidth = shieldWidth;
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = '#0066ff';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        }
        
        this.ctx.restore();
        
        // Draw name above ship
        this.ctx.save();
        this.ctx.fillStyle = remotePlayer.color;
        this.ctx.font = '12px "Courier New", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(remotePlayer.name, pos.x, pos.y - 20);
        this.ctx.restore();
    }
    
    update(dt) {
        // Don't update if no local players
        if (this.myPlayers.length === 0) return;
        
        // Update network (spawns power-ups and asteroids in local mode)
        if (this.network) {
            this.network.update(dt);
        }
        
        // Update my local players
        for (const player of this.myPlayers) {
            if (player.alive) {
                player.update(dt, this.canvas.width, this.canvas.height);
                player.updateBullets(dt, this.canvas.width, this.canvas.height);
                
                // Send position update to network (online mode)
                if (this.network && this.network.constructor.name === 'PeerNetworkManager') {
                    this.network.sendPlayerUpdate(player.id, {
                        x: player.x,
                        y: player.y,
                        angle: player.angle,
                        alive: player.alive,
                        shields: player.shields,
                        invulnerable: player.invulnerable
                    });
                }
            }
        }
        
        // Update remote players (online mode)
        for (const remotePlayer of this.remotePlayers.values()) {
            remotePlayer.update(dt);
        }
        
        // Update weapons
        this.homingMissiles = this.homingMissiles.filter(m => m.update(dt, this.canvas.width, this.canvas.height));
        this.lasers = this.lasers.filter(l => l.update(dt));
        this.bombs = this.bombs.filter(b => {
            const stillAlive = b.update(dt, this.canvas.width, this.canvas.height, this.myPlayers);
            if (b.detonated) {
                this.handleBombExplosion(b);
            }
            return stillAlive;
        });
        
        // Update remote bullets
        if (!this.remoteBullets) this.remoteBullets = [];
        this.remoteBullets = this.remoteBullets.filter(b => b.update(dt, this.canvas.width, this.canvas.height));
        
        // Update asteroid
        if (this.asteroid) {
            if (!this.asteroid.update(dt)) {
                // Notify network that asteroid was destroyed
                if (this.network) {
                    this.network.notifyAsteroidDestroyed();
                }
                this.asteroid = null;
            }
        }
        
        // Update shrapnel
        this.shrapnel = this.shrapnel.filter(s => s.update(dt, this.canvas.width, this.canvas.height));
        
        // Update power-ups and check for pickups
        this.updatePowerUps(dt);
        
        // Update particles
        this.particles.update(dt, this.canvas.width, this.canvas.height);
        
        // Collision detection
        this.checkCollisions();
    }
    
    updatePowerUps(dt) {
        for (let powerUp of this.powerUps) {
            powerUp.update(dt);
            
            // Check if any player picked it up
            for (let player of this.myPlayers) {
                if (player && player.alive) {
                    const dist = getDistance(
                        player.x, player.y,
                        powerUp.x, powerUp.y,
                        this.canvas.width, this.canvas.height
                    );
                    
                    if (dist < player.radius + powerUp.radius) {
                        this.applyPowerUp(player, powerUp.type);
                        powerUp.pickup();
                        
                        // Notify network of pickup
                        if (this.network) {
                            this.network.sendPowerUpPickup(player.id, powerUp.id, powerUp.type);
                        }
                    }
                }
            }
        }
        
        // Remove picked up power-ups
        this.powerUps = this.powerUps.filter(p => p.alive);
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
    
    applyPowerUpToRemote(remotePlayer, type) {
        // Apply powerup effects to remote player (visual updates only)
        // Remote players don't have full Player class methods, just state
        switch(type) {
            case PowerUpType.SHIELD:
                // Increment shield count (tracked in RemotePlayer)
                remotePlayer.shields = Math.min((remotePlayer.shields || 0) + 1, 3);
                break;
            case PowerUpType.INVISIBILITY:
                // Mark as invisible (tracked in RemotePlayer)
                remotePlayer.invisible = true;
                break;
            // Other powerups don't need visual representation on remote players
            // They're tracked and applied by the player's own client
        }
    }
    
    checkCollisions() {
        // Only check collisions for my local players (self-authoritative)
        // Player vs bullets (from other local players)
        for (let player of this.myPlayers) {
            if (!player || !player.alive || player.invulnerable) continue;
            
            for (let otherPlayer of this.myPlayers) {
                if (player === otherPlayer || !otherPlayer || !otherPlayer.bullets) continue;
                
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
        
        // Player vs remote bullets (from remote players)
        if (this.remoteBullets) {
            for (let player of this.myPlayers) {
                if (!player || !player.alive || player.invulnerable) continue;
                
                for (let bullet of this.remoteBullets) {
                    if (!bullet.alive) continue;
                    
                    const dist = getDistance(
                        player.x, player.y,
                        bullet.x, bullet.y,
                        this.canvas.width, this.canvas.height
                    );
                    
                    if (dist < player.radius + bullet.radius) {
                        bullet.alive = false;
                        // Find attacker from remote players
                        const attacker = this.remotePlayers.get(bullet.ownerId);
                        this.handlePlayerHit(player, attacker);
                    }
                }
            }
        }
        
        // Player vs homing missiles (can hit any player including owner)
        for (let player of this.myPlayers) {
            if (!player || !player.alive || player.invulnerable) continue;
            
            for (let missile of this.homingMissiles) {
                const dist = getDistance(
                    player.x, player.y,
                    missile.x, missile.y,
                    this.canvas.width, this.canvas.height
                );
                
                if (dist < player.radius + missile.radius) {
                    missile.alive = false;
                    const attacker = this.myPlayers.find(p => p.id === missile.ownerId);
                    this.handlePlayerHit(player, attacker);
                }
            }
        }
        
        // Player vs lasers
        for (let player of this.myPlayers) {
            if (!player || !player.alive || player.invulnerable) continue;
            
            for (let laser of this.lasers) {
                if (laser.ownerId === player.id) continue;
                
                if (laser.checkHit(player.x, player.y, player.radius, this.canvas.width, this.canvas.height)) {
                    // Check if player has shield
                    if (player.shields > 0) {
                        player.removeShield();
                        laser.alive = false; // Laser is destroyed by shield
                        this.audio.playShieldHit();
                    } else {
                        this.handlePlayerHit(player, this.myPlayers.find(p => p.id === laser.ownerId));
                    }
                }
            }
        }
        
        // Player vs shrapnel
        for (let player of this.myPlayers) {
            if (!player || !player.alive || player.invulnerable) continue;
            
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
            for (let player of this.myPlayers) {
                if (!player || !player.alive || player.invulnerable) continue;
                
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
            // Check if we're host or in local mode
            const isHostOrLocal = !this.network || 
                                  this.network.constructor.name === 'LocalNetworkManager' ||
                                  (this.network.constructor.name === 'PeerNetworkManager' && this.network.isHost);
            
            for (let player of this.myPlayers) {
                if (!player || !player.bullets) continue;
                for (let bullet of player.bullets) {
                    if (!bullet.alive) continue;
                    
                    const dist = getDistance(
                        bullet.x, bullet.y,
                        this.asteroid.x, this.asteroid.y,
                        this.canvas.width, this.canvas.height
                    );
                    
                    if (dist < bullet.radius + this.asteroid.size) {
                        bullet.alive = false;
                        
                        if (isHostOrLocal) {
                            // Only host/local applies damage
                            this.asteroid.takeDamage(bullet.x, bullet.y, 1);
                            this.particles.createDebris(bullet.x, bullet.y, '#888888', 3);
                            
                            // Broadcast damage to clients
                            if (this.network && this.network.constructor.name === 'PeerNetworkManager') {
                                this.network.sendAsteroidDamage(bullet.x, bullet.y, 1);
                            }
                            
                            if (!this.asteroid.alive) {
                                this.particles.createExplosion(this.asteroid.x, this.asteroid.y, '#888888', 20);
                                // Broadcast destruction to clients
                                if (this.network) {
                                    this.network.notifyAsteroidDestroyed();
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Remote bullets vs asteroid (only host detects)
        if (this.asteroid && this.asteroid.alive && this.remoteBullets) {
            // Check if we're host
            const isHost = this.network && 
                          this.network.constructor.name === 'PeerNetworkManager' && 
                          this.network.isHost;
            
            if (isHost) {
                for (let bullet of this.remoteBullets) {
                    if (!bullet.alive) continue;
                    
                    const dist = getDistance(
                        bullet.x, bullet.y,
                        this.asteroid.x, this.asteroid.y,
                        this.canvas.width, this.canvas.height
                    );
                    
                    if (dist < bullet.radius + this.asteroid.size) {
                        bullet.alive = false;
                        
                        // Host applies damage
                        this.asteroid.takeDamage(bullet.x, bullet.y, 1);
                        this.particles.createDebris(bullet.x, bullet.y, '#888888', 3);
                        
                        // Broadcast damage to all clients
                        this.network.sendAsteroidDamage(bullet.x, bullet.y, 1);
                        
                        if (!this.asteroid.alive) {
                            this.particles.createExplosion(this.asteroid.x, this.asteroid.y, '#888888', 20);
                            // Broadcast destruction to clients
                            this.network.notifyAsteroidDestroyed();
                        }
                    }
                }
            }
        }
        
        // Homing missiles vs asteroid
        if (this.asteroid && this.asteroid.alive) {
            // Check if we're host or in local mode
            const isHostOrLocal = !this.network || 
                                  this.network.constructor.name === 'LocalNetworkManager' ||
                                  (this.network.constructor.name === 'PeerNetworkManager' && this.network.isHost);
            
            for (let missile of this.homingMissiles) {
                const dist = getDistance(
                    missile.x, missile.y,
                    this.asteroid.x, this.asteroid.y,
                    this.canvas.width, this.canvas.height
                );
                
                if (dist < missile.radius + this.asteroid.size) {
                    missile.alive = false;
                    this.audio.playExplosion();
                    this.particles.createExplosion(missile.x, missile.y, '#ff0000', 20, 200);
                    
                    if (isHostOrLocal) {
                        // Only host/local applies damage
                        const damage = GAME_SETTINGS.weapons.homingMissile.asteroidDamage;
                        this.asteroid.takeDamage(missile.x, missile.y, damage);
                        
                        // Broadcast damage to clients
                        if (this.network && this.network.constructor.name === 'PeerNetworkManager') {
                            this.network.sendAsteroidDamage(missile.x, missile.y, damage);
                        }
                        
                        if (!this.asteroid.alive) {
                            // Destroyed by missile - create shrapnel
                            this.shrapnel.push(...this.asteroid.createShrapnel());
                            this.particles.createExplosion(this.asteroid.x, this.asteroid.y, '#888888', 30);
                            // Broadcast destruction to clients
                            if (this.network) {
                                this.network.notifyAsteroidDestroyed();
                            }
                        }
                    }
                }
            }
        }
        
        // Bombs vs bullets (remote detonation)
        for (let bomb of this.bombs) {
            if (!bomb.alive) continue;
            
            for (let player of this.myPlayers) {
                if (!player || !player.bullets) continue;
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
        
        // Player vs player collision (only for local players)
        if (this.myPlayers.length >= 2) {
            for (let i = 0; i < this.myPlayers.length; i++) {
                for (let j = i + 1; j < this.myPlayers.length; j++) {
                    const p1 = this.myPlayers[i];
                    const p2 = this.myPlayers[j];
                    
                    if (!p1 || !p2 || !p1.alive || !p2.alive || p1.invulnerable || p2.invulnerable) continue;
                    
                    const dist = getDistance(
                        p1.x, p1.y,
                        p2.x, p2.y,
                        this.canvas.width, this.canvas.height
                    );
                    
                    if (dist < p1.radius + p2.radius) {
                        // Head-on collision
                        const p1HasShield = p1.shields > 0;
                        const p2HasShield = p2.shields > 0;
                        
                        if (p1HasShield && p2HasShield) {
                            // Both have shields - both lose shield and bounce apart
                            p1.removeShield();
                            p2.removeShield();
                            this.audio.playShieldHit();
                            this.particles.createExplosion(p1.x, p1.y, '#0066ff', 10, 100);
                            this.particles.createExplosion(p2.x, p2.y, '#0066ff', 10, 100);
                            
                            // Calculate collision angle
                            const collisionAngle = Math.atan2(
                                p2.y - p1.y,
                                p2.x - p1.x
                            );
                            
                            // Set players to move away from each other
                            p1.angle = collisionAngle + Math.PI;
                            p2.angle = collisionAngle;
                            
                            // Push players apart
                            const overlap = (p1.radius + p2.radius) - dist;
                            const pushDistance = (overlap / 2) + GAME_SETTINGS.collision.playerPushDistance;
                            
                            p1.x -= Math.cos(collisionAngle) * pushDistance;
                            p1.y -= Math.sin(collisionAngle) * pushDistance;
                            p2.x += Math.cos(collisionAngle) * pushDistance;
                            p2.y += Math.sin(collisionAngle) * pushDistance;
                        } else if (p1HasShield && !p2HasShield) {
                            // P1 has shield, P2 doesn't - P2 dies, P1 loses shield and bounces
                            this.handlePlayerHit(p2, p1);
                            p1.removeShield();
                            this.audio.playShieldHit();
                            this.particles.createExplosion(p1.x, p1.y, '#0066ff', 10, 100);
                            
                            // P1 bounces away
                            const awayAngle = Math.atan2(
                                p1.y - p2.y,
                                p1.x - p2.x
                            );
                            p1.angle = awayAngle;
                            p1.x += Math.cos(awayAngle) * GAME_SETTINGS.collision.playerPushDistance;
                            p1.y += Math.sin(awayAngle) * GAME_SETTINGS.collision.playerPushDistance;
                        } else if (!p1HasShield && p2HasShield) {
                            // P2 has shield, P1 doesn't - P1 dies, P2 loses shield and bounces
                            this.handlePlayerHit(p1, p2);
                            p2.removeShield();
                            this.audio.playShieldHit();
                            this.particles.createExplosion(p2.x, p2.y, '#0066ff', 10, 100);
                            
                            // P2 bounces away
                            const awayAngle = Math.atan2(
                                p2.y - p1.y,
                                p2.x - p1.x
                            );
                            p2.angle = awayAngle;
                            p2.x += Math.cos(awayAngle) * GAME_SETTINGS.collision.playerPushDistance;
                            p2.y += Math.sin(awayAngle) * GAME_SETTINGS.collision.playerPushDistance;
                        } else {
                            // Neither has shield - both destroyed
                            this.handlePlayerHit(p1, null);
                            this.handlePlayerHit(p2, null);
                        }
                    }
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
            const currentScore = this.playerScores.get(attacker.id) || 0;
            this.playerScores.set(attacker.id, currentScore + 1);
            
            // Update UI
            this.ui.updatePlayerScore(attacker.id, currentScore + 1);
            
            // Check for win
            if (currentScore + 1 >= this.winScore && !this.matchWon) {
                this.endGame(attacker);
                return;
            }
        }
        
        // Respawn player (but not if match has been won)
        if (!this.matchWon) {
            setTimeout(() => {
                if (this.state === 'PLAYING' && !this.matchWon) {
                    const pos = getRandomSpawnPosition(
                        this.myPlayers,
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
        for (let player of this.myPlayers) {
            if (!player || !player.alive || player.invulnerable) continue;
            
            const dist = getDistance(
                player.x, player.y,
                bomb.x, bomb.y,
                this.canvas.width, this.canvas.height
            );
            
            if (dist < bomb.explosionRadius) {
                const attacker = this.myPlayers.find(p => p.id === bomb.ownerId);
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
                // Check if we're host or in local mode
                const isHostOrLocal = !this.network || 
                                      this.network.constructor.name === 'LocalNetworkManager' ||
                                      (this.network.constructor.name === 'PeerNetworkManager' && this.network.isHost);
                
                if (isHostOrLocal) {
                    this.asteroid.instantDestroy();
                    this.shrapnel.push(...this.asteroid.createShrapnel());
                    this.particles.createExplosion(this.asteroid.x, this.asteroid.y, '#888888', 30);
                    
                    // Broadcast destruction to clients
                    if (this.network) {
                        this.network.notifyAsteroidDestroyed();
                    }
                }
            }
        }
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
        this.powerUps.forEach(p => p.draw(this.ctx));
        
        // Draw local players
        for (const player of this.myPlayers) {
            if (player) {
                player.draw(this.ctx);
                player.drawBullets(this.ctx);
            }
        }
        
        // Draw remote players (online mode)
        for (const remotePlayer of this.remotePlayers.values()) {
            if (remotePlayer.alive) {
                // Draw remote player using their display position
                this.drawRemotePlayer(remotePlayer);
            }
        }
        
        // Draw weapons
        this.homingMissiles.forEach(m => m.draw(this.ctx));
        this.lasers.forEach(l => l.draw(this.ctx, this.canvas.width, this.canvas.height));
        this.bombs.forEach(b => b.draw(this.ctx));
        
        // Draw remote bullets
        if (this.remoteBullets) {
            this.remoteBullets.forEach(b => b.draw(this.ctx));
        }
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    new Game();
});

