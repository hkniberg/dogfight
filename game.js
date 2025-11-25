// Main game engine and loop - Refactored to use manager systems

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
        this.matchWon = false;
        
        // Core UI/Audio/Particles
        this.ui = new UIManager();
        this.audio = new AudioManager();
        this.particles = new ParticleSystem();
        
        // Game systems (initialized in startGame)
        this.playerManager = null;
        this.weaponManager = null;
        this.collisionSystem = null;
        this.entityManager = null;
        
        // Network
        this.network = null;
        this.networkFacade = null;
        this.battleCodeForHud = null;
        
        // Legacy arrays for compatibility with collision system
        // These reference the actual arrays in managers
        this.homingMissiles = [];
        this.lasers = [];
        this.bombs = [];
        this.remoteBullets = [];
        this.asteroid = null;
        this.shrapnel = [];
        
        // Score
        this.playerScores = new Map();
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
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const canvasWidth = GAME_SETTINGS.canvas.width;
        const canvasHeight = GAME_SETTINGS.canvas.height;
        
        const availableHeight = windowHeight - 60;
        
        const scaleX = windowWidth / canvasWidth;
        const scaleY = availableHeight / canvasHeight;
        const scale = Math.min(scaleX, scaleY, 1);
        
        this.canvas.style.width = `${canvasWidth * scale}px`;
        this.canvas.style.height = `${canvasHeight * scale}px`;
    }
    
    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            
            if (e.key === 'Escape' && this.state === 'PLAYING') {
                this.returnToMenu();
                return;
            }
            
            if (this.state === 'PLAYING') {
                this.handleInput(e.key, true);
            }
            
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }
    
    handleInput(key, pressed) {
        if (!pressed || !this.playerManager) return;
        
        // Check if this is a fire key
        const playerCtrl = this.playerManager.getPlayerByFireKey(key);
        if (playerCtrl) {
            const target = this.playerManager.findTarget(playerCtrl.id);
            this.weaponManager.handlePlayerFire(playerCtrl, target);
            return;
        }
        
        // Handle other inputs (movement)
        this.playerManager.handleInput(key, pressed);
    }
    
    async startGame() {
        this.audio.init();
        
        const config = this.ui.getPlayerConfig();
        const mode = this.ui.getMode();
        
        try {
            // Initialize game systems
            this.playerManager = new PlayerManager(this);
            this.weaponManager = new WeaponManager(this);
            this.collisionSystem = new CollisionSystem(this);
            this.entityManager = new EntityManager(this);
            
            // Setup references for collision system compatibility
            this.updateManagerReferences();
            
            // Initialize network based on mode
            if (mode === 'local') {
                this.network = new LocalNetworkManager(this.canvas.width, this.canvas.height);
                this.networkFacade = new GameNetworkFacade(this.network, this);
                await this.setupLocalPlayers(config);
                
            } else if (mode === 'host') {
                this.network = new PeerNetworkManager(this.canvas.width, this.canvas.height, true);
                this.networkFacade = new GameNetworkFacade(this.network, this);
                
                const myPlayerId = await this.network.connect(config.player1.name, config.player1.color);
                this.ui.showBattleCode(this.network.myPeerId);
                this.battleCodeForHud = this.network.myPeerId;
                
                await this.setupOnlinePlayer(myPlayerId, config.player1, true);
                
            } else if (mode === 'join') {
                const battleCode = this.ui.getBattleCode();
                if (!battleCode) {
                    alert('Please enter a battle code to join!');
                    return;
                }
                
                this.network = new PeerNetworkManager(this.canvas.width, this.canvas.height, false, battleCode);
                this.networkFacade = new GameNetworkFacade(this.network, this);
                
                const myPlayerId = await this.network.connect(config.player1.name, config.player1.color);
                await this.setupOnlinePlayer(myPlayerId, config.player1, false);
            }
            
        } catch (error) {
            console.error('Failed to start game:', error);
            alert(`Failed to connect: ${error.message}`);
            return;
        }
        
        // Reset score and match state
        this.playerScores.clear();
        for (const playerCtrl of this.playerManager.getLocalPlayers()) {
            this.playerScores.set(playerCtrl.id, 0);
        }
        this.matchWon = false;
        
        // Clear all game entities
        this.weaponManager.clear();
        this.entityManager.clear();
        this.particles.clear();
        
        // Initialize score display
        this.ui.initScores(this.playerManager.getAllPlayers().map(p => p.player));
        
        // Show battle code in HUD if hosting
        if (this.battleCodeForHud) {
            this.ui.showBattleCodeInHud(this.battleCodeForHud);
        }
        
        this.ui.showScreen('game');
        this.state = 'PLAYING';
    }
    
    async setupLocalPlayers(config) {
        const centerX = this.canvas.width * 0.5;
        const centerY = this.canvas.height * 0.5;
        const spacing = GAME_SETTINGS.player.startSpacing;
        
        const p1Id = this.network.connect(config.player1.name, config.player1.color);
        const p2Id = this.network.connect(config.player2.name, config.player2.color);
        
        const player1 = new Player(
            p1Id,
            centerX - spacing, centerY,
            Math.PI,
            config.player1.color,
            config.player1.name,
            { up: 'w', down: 's', left: 'a', right: 'd', fire: 'e' }
        );
        
        const player2 = new Player(
            p2Id,
            centerX + spacing, centerY,
            0,
            config.player2.color,
            config.player2.name,
            { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', fire: '-' }
        );
        
        player1.speedLevel = GAME_SETTINGS.player.defaultSpeedLevel;
        player2.speedLevel = GAME_SETTINGS.player.defaultSpeedLevel;
        
        this.playerManager.addPlayer(player1, true);
        this.playerManager.addPlayer(player2, true);
    }
    
    async setupOnlinePlayer(playerId, playerConfig, isHost) {
        const x = Math.random() * this.canvas.width;
        const y = Math.random() * this.canvas.height;
        const angle = Math.random() * Math.PI * 2;
        
        const player = new Player(
            playerId,
            x, y, angle,
            playerConfig.color,
            playerConfig.name,
            { up: 'w', down: 's', left: 'a', right: 'd', fire: 'e' }
        );
        
        player.speedLevel = GAME_SETTINGS.player.defaultSpeedLevel;
        this.playerManager.addPlayer(player, true);
    }
    
    // Update references for collision system compatibility
    updateManagerReferences() {
        if (this.weaponManager) {
            this.homingMissiles = this.weaponManager.homingMissiles;
            this.lasers = this.weaponManager.lasers;
            this.bombs = this.weaponManager.bombs;
            this.remoteBullets = this.weaponManager.remoteBullets;
        }
        if (this.entityManager) {
            this.asteroid = this.entityManager.asteroid;
            this.shrapnel = this.entityManager.shrapnel;
        }
    }
    
    handlePlayerHit(victim, attacker) {
        // Self-authoritative hit detection: This should only be called for LOCAL players
        // Remote player deaths are handled via network events on their own clients
        
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
            this.ui.updatePlayerScore(attacker.id, currentScore + 1);
            
            // Check for win
            if (currentScore + 1 >= this.winScore && !this.matchWon) {
                this.endGame(attacker);
                return;
            }
        }
        
        // Respawn player
        if (!this.matchWon) {
            setTimeout(() => {
                if (this.state === 'PLAYING' && !this.matchWon) {
                    const allPlayers = this.playerManager.getAllPlayers().map(p => p.player);
                    const pos = getRandomSpawnPosition(
                        allPlayers,
                        200,
                        this.canvas.width,
                        this.canvas.height
                    );
                    victim.respawn(pos.x, pos.y, random(0, Math.PI * 2));
                    
                    // Immediately broadcast respawn state to network
                    if (this.networkFacade && this.networkFacade.isOnlineMode()) {
                        const victimCtrl = this.playerManager.getPlayer(victim.id);
                        if (victimCtrl) {
                            this.networkFacade.broadcastPlayerUpdate(victimCtrl);
                        }
                    }
                }
            }, victim.respawnDelay * 1000);
        }
        
        // Send death notification to network
        if (this.networkFacade && this.networkFacade.isOnlineMode()) {
            this.networkFacade.broadcastDeath(victim.id, attacker ? attacker.id : null);
        }
    }
    
    endGame(winner) {
        this.matchWon = true;
        this.ui.recordWin(winner.id);
        this.ui.showGameOver(winner.name, winner.color);
    }
    
    returnToMenu() {
        this.state = 'MENU';
        this.matchWon = false;
        
        this.ui.hideBattleCodeInHud();
        this.battleCodeForHud = null;
        
        if (this.networkFacade) {
            this.networkFacade.disconnect();
        }
        this.network = null;
        this.networkFacade = null;
        
        if (this.playerManager) {
            this.playerManager.clear();
        }
        
        this.ui.showScreen('menu');
    }
    
    gameLoop(currentTime) {
        requestAnimationFrame((time) => this.gameLoop(time));
        
        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1) * this.gameSpeed;
        this.lastTime = currentTime;
        
        // Clear canvas
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.drawGrid();
        
        if (this.state === 'PLAYING') {
            try {
                this.update(dt);
                this.draw();
            } catch (error) {
                console.error('Game error:', error);
                this.handleGameError(error);
            }
        }
    }
    
    handleGameError(error) {
        // Log detailed error information
        console.error('Game crashed with error:', error);
        console.error('Stack trace:', error.stack);
        
        // Show error to user
        const errorMessage = `Game Error: ${error.message}\n\nThe game has encountered an error and needs to return to the menu.\n\nCheck the browser console (F12) for details.`;
        alert(errorMessage);
        
        // Return to menu to recover
        this.returnToMenu();
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
        if (!this.playerManager) return;
        
        // Update network (spawning for local/host mode)
        if (this.networkFacade) {
            this.networkFacade.update(dt);
        }
        
        // Update all players
        this.playerManager.updateAll(dt, this.canvas.width, this.canvas.height);
        
        // Send network updates for local players (online mode only)
        if (this.networkFacade && this.networkFacade.isOnlineMode()) {
            for (let playerCtrl of this.playerManager.getLocalPlayers()) {
                if (playerCtrl.alive) {
                    this.networkFacade.broadcastPlayerUpdate(playerCtrl);
                }
            }
        }
        
        // Update weapons
        this.weaponManager.update(dt, this.canvas.width, this.canvas.height);
        
        // Update entities (powerups, asteroids, shrapnel)
        this.entityManager.update(dt);
        
        // Update particles
        this.particles.update(dt, this.canvas.width, this.canvas.height);
        
        // Update references for collision system
        this.updateManagerReferences();
        
        // Check collisions (unified for all players)
        this.collisionSystem.checkAll();
    }
    
    draw() {
        // Draw particles (background layer)
        this.particles.draw(this.ctx);
        
        // Draw entities (asteroids, shrapnel, powerups)
        this.entityManager.draw(this.ctx);
        
        // Draw all players (local and remote, unified)
        this.playerManager.drawAll(this.ctx, this.canvas.width, this.canvas.height);
        
        // Draw weapons
        this.weaponManager.draw(this.ctx, this.canvas.width, this.canvas.height);
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    const game = new Game();
    
    // Global error handler to catch unhandled errors
    window.addEventListener('error', (event) => {
        console.error('Unhandled error:', event.error);
        if (game && game.state === 'PLAYING') {
            game.handleGameError(event.error || new Error('Unknown error occurred'));
            event.preventDefault(); // Prevent default browser error handling
        }
    });
    
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        if (game && game.state === 'PLAYING') {
            const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
            game.handleGameError(error);
            event.preventDefault();
        }
    });
});
