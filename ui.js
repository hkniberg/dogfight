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
        
        // Stats elements
        this.p1WinsDisplay = document.getElementById('p1-wins');
        this.p2WinsDisplay = document.getElementById('p2-wins');
        this.totalRoundsDisplay = document.getElementById('total-rounds');
        
        // HUD elements
        this.scoresContainer = document.getElementById('scores-container');
        this.playerScores = {}; // Map of playerId -> score element
        
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
        // No additional setup needed for color pickers
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

