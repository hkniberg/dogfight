// UI management for menus and HUD

class UIManager {
    constructor() {
        // Screens
        this.menuScreen = document.getElementById('menu-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.gameoverScreen = document.getElementById('gameover-screen');
        
        // Menu elements
        this.player1NameInput = document.getElementById('player1-name');
        this.player2NameInput = document.getElementById('player2-name');
        this.player1ColorInput = document.getElementById('player1-color');
        this.player2ColorInput = document.getElementById('player2-color');
        this.startButton = document.getElementById('start-game');
        this.resetStatsButton = document.getElementById('reset-stats');
        
        // Mode selector elements
        this.modeLocalButton = document.getElementById('mode-local');
        this.modeHostButton = document.getElementById('mode-host');
        this.modeJoinButton = document.getElementById('mode-join');
        this.player2Section = document.getElementById('player2-section');
        this.battleCodeSection = document.getElementById('battle-code-section');
        this.hostCodeDisplay = document.getElementById('host-code-display');
        this.joinCodeInput = document.getElementById('join-code-input');
        this.battleCodeDisplayInput = document.getElementById('battle-code-display');
        this.battleCodeInputField = document.getElementById('battle-code-input');
        this.copyCodeButton = document.getElementById('copy-code');
        
        // Current mode
        this.currentMode = 'local'; // 'local', 'host', 'join'
        
        // Stats elements
        this.p1WinsDisplay = document.getElementById('p1-wins');
        this.p2WinsDisplay = document.getElementById('p2-wins');
        this.totalRoundsDisplay = document.getElementById('total-rounds');
        
        // HUD elements
        this.scoresContainer = document.getElementById('scores-container');
        this.playerScores = {}; // Map of playerId -> score element
        this.battleCodeHud = document.getElementById('battle-code-hud');
        this.battleCodeHudText = document.getElementById('battle-code-hud-text');
        
        // Game over elements
        this.winnerText = document.getElementById('winner-text');
        this.playAgainButton = document.getElementById('play-again');
        this.mainMenuButton = document.getElementById('main-menu');
        
        // Load stats from localStorage
        this.loadStats();
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Mode selection
        this.modeLocalButton.addEventListener('click', () => this.setMode('local'));
        this.modeHostButton.addEventListener('click', () => this.setMode('host'));
        this.modeJoinButton.addEventListener('click', () => this.setMode('join'));
        
        // Copy battle code
        this.copyCodeButton.addEventListener('click', () => {
            this.battleCodeDisplayInput.select();
            document.execCommand('copy');
            this.copyCodeButton.textContent = 'Copied!';
            setTimeout(() => {
                this.copyCodeButton.textContent = 'Copy';
            }, 2000);
        });
    }
    
    generateRandomPilotName() {
        const adjectives = [
            'Swift', 'Bold', 'Stealth', 'Shadow', 'Thunder', 'Lightning', 
            'Frost', 'Blaze', 'Storm', 'Vortex', 'Phantom', 'Cosmic',
            'Neon', 'Cyber', 'Nova', 'Stellar', 'Quantum', 'Hyper'
        ];
        
        const nouns = [
            'Hawk', 'Falcon', 'Eagle', 'Viper', 'Phoenix', 'Dragon',
            'Wolf', 'Tiger', 'Raven', 'Comet', 'Ace', 'Pilot',
            'Racer', 'Hunter', 'Scout', 'Striker', 'Ghost', 'Runner'
        ];
        
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const number = Math.floor(Math.random() * 100);
        
        return `${adjective}${noun}${number}`;
    }
    
    generateRandomBrightColor() {
        // Generate bright, saturated colors that are visible on dark background
        const hue = Math.floor(Math.random() * 360);
        const saturation = 70 + Math.floor(Math.random() * 30); // 70-100%
        const lightness = 50 + Math.floor(Math.random() * 20);  // 50-70%
        
        // Convert HSL to hex
        const h = hue / 360;
        const s = saturation / 100;
        const l = lightness / 100;
        
        const hslToRgb = (h, s, l) => {
            let r, g, b;
            if (s === 0) {
                r = g = b = l;
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                };
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }
            return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
        };
        
        const [r, g, b] = hslToRgb(h, s, l);
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }
    
    setMode(mode) {
        this.currentMode = mode;
        
        // Update button states
        this.modeLocalButton.classList.remove('active');
        this.modeHostButton.classList.remove('active');
        this.modeJoinButton.classList.remove('active');
        
        if (mode === 'local') {
            this.modeLocalButton.classList.add('active');
            this.player2Section.style.display = 'block';
            this.battleCodeSection.style.display = 'none';
            
            // Reset to default names for local play
            if (!this.player1NameInput.value || this.player1NameInput.value.match(/^(Swift|Bold|Stealth|Shadow|Thunder)/)) {
                this.player1NameInput.value = 'Player 1';
                this.player1ColorInput.value = '#00ffff';
            }
            if (!this.player2NameInput.value) {
                this.player2NameInput.value = 'Player 2';
                this.player2ColorInput.value = '#ff1493';
            }
        } else if (mode === 'host') {
            this.modeHostButton.classList.add('active');
            this.player2Section.style.display = 'none';
            this.battleCodeSection.style.display = 'block';
            this.hostCodeDisplay.style.display = 'none'; // Show after connection
            this.joinCodeInput.style.display = 'none';
            
            // Generate random name and color for hosting
            this.player1NameInput.value = this.generateRandomPilotName();
            this.player1ColorInput.value = this.generateRandomBrightColor();
        } else if (mode === 'join') {
            this.modeJoinButton.classList.add('active');
            this.player2Section.style.display = 'none';
            this.battleCodeSection.style.display = 'block';
            this.hostCodeDisplay.style.display = 'none';
            this.joinCodeInput.style.display = 'block';
            
            // Generate random name and color for joining
            this.player1NameInput.value = this.generateRandomPilotName();
            this.player1ColorInput.value = this.generateRandomBrightColor();
        }
    }
    
    showBattleCode(code) {
        this.battleCodeDisplayInput.value = code;
        this.hostCodeDisplay.style.display = 'block';
    }
    
    getBattleCode() {
        return this.battleCodeInputField.value.trim();
    }
    
    getMode() {
        return this.currentMode;
    }
    
    showBattleCodeInHud(code) {
        if (this.battleCodeHud && this.battleCodeHudText) {
            this.battleCodeHudText.textContent = code;
            this.battleCodeHud.style.display = 'block';
        }
    }
    
    hideBattleCodeInHud() {
        if (this.battleCodeHud) {
            this.battleCodeHud.style.display = 'none';
        }
    }
    
    getPlayerConfig() {
        return {
            player1: {
                name: this.player1NameInput.value || 'Player 1',
                color: this.player1ColorInput.value // Use color picker value
            },
            player2: {
                name: this.player2NameInput.value || 'Player 2',
                color: this.player2ColorInput.value // Use color picker value
            }
        };
    }
    
    showScreen(screen) {
        this.menuScreen.classList.remove('active');
        this.gameScreen.classList.remove('active');
        this.gameoverScreen.classList.remove('active');
        
        if (screen === 'menu') {
            this.menuScreen.classList.add('active');
        } else if (screen === 'game') {
            this.gameScreen.classList.add('active');
        } else if (screen === 'gameover') {
            // Show gameover as overlay on top of game screen
            this.gameScreen.classList.add('active');
            this.gameoverScreen.classList.add('active');
        }
    }
    
    // Initialize score display for all players
    initScores(players) {
        this.scoresContainer.innerHTML = '';
        this.playerScores = {};
        
        players.forEach((player, index) => {
            const scoreDiv = document.createElement('div');
            scoreDiv.className = 'player-score';
            scoreDiv.style.color = player.color;
            scoreDiv.style.textShadow = `0 0 10px ${player.color}, 0 0 20px ${player.color}`;
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'player-name';
            nameSpan.textContent = player.name;
            
            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'score-value';
            scoreSpan.textContent = '0';
            
            scoreDiv.appendChild(nameSpan);
            scoreDiv.appendChild(scoreSpan);
            this.scoresContainer.appendChild(scoreDiv);
            
            this.playerScores[player.id] = scoreSpan;
        });
    }
    
    // Update individual player score
    updatePlayerScore(playerId, score) {
        if (this.playerScores[playerId]) {
            this.playerScores[playerId].textContent = score;
        }
    }
    
    // Legacy method for backward compatibility with 2-player mode
    updateScore(p1Score, p2Score, p1Color, p2Color) {
        // This is called by game.js in local mode
        // Update scores if elements exist
        const p1Element = this.playerScores[1];
        const p2Element = this.playerScores[2];
        
        if (p1Element) p1Element.textContent = p1Score;
        if (p2Element) p2Element.textContent = p2Score;
    }
    
    showGameOver(winnerName, winnerColor) {
        this.winnerText.textContent = `${winnerName} WINS!`;
        this.winnerText.style.color = winnerColor;
        this.winnerText.style.textShadow = `0 0 10px ${winnerColor}, 0 0 20px ${winnerColor}, 0 0 30px ${winnerColor}`;
        
        const buttons = this.gameoverScreen.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.style.borderColor = winnerColor;
            btn.style.color = winnerColor;
            btn.style.textShadow = `0 0 10px ${winnerColor}`;
            btn.style.boxShadow = `0 0 20px ${winnerColor}`;
        });
        
        this.showScreen('gameover');
    }
    
    // Stats management
    loadStats() {
        const stats = localStorage.getItem('neonDogfightStats');
        if (stats) {
            const parsed = JSON.parse(stats);
            this.stats = parsed;
        } else {
            this.stats = {
                p1Wins: 0,
                p2Wins: 0,
                totalRounds: 0
            };
        }
        this.updateStatsDisplay();
    }
    
    saveStats() {
        localStorage.setItem('neonDogfightStats', JSON.stringify(this.stats));
        this.updateStatsDisplay();
    }
    
    updateStatsDisplay() {
        this.p1WinsDisplay.textContent = this.stats.p1Wins;
        this.p2WinsDisplay.textContent = this.stats.p2Wins;
        this.totalRoundsDisplay.textContent = this.stats.totalRounds;
    }
    
    recordWin(playerNum) {
        if (playerNum === 1) {
            this.stats.p1Wins++;
        } else {
            this.stats.p2Wins++;
        }
        this.stats.totalRounds++;
        this.saveStats();
    }
    
    resetStats() {
        if (confirm('Are you sure you want to reset all statistics?')) {
            this.stats = {
                p1Wins: 0,
                p2Wins: 0,
                totalRounds: 0
            };
            this.saveStats();
        }
    }
    
    onStartGame(callback) {
        this.startButton.addEventListener('click', callback);
    }
    
    onPlayAgain(callback) {
        this.playAgainButton.addEventListener('click', callback);
    }
    
    onMainMenu(callback) {
        this.mainMenuButton.addEventListener('click', callback);
    }
    
    onResetStats(callback) {
        this.resetStatsButton.addEventListener('click', callback);
    }
}

