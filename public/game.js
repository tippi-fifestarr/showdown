class ShowdownGame {
    constructor() {
        this.socket = io();
        this.gameState = 'menu';
        this.gameId = null;
        this.isDrawing = false;
        this.highNoonTime = null;
        this.drawTime = null;
        this.deviceMotion = {
            alpha: 0,
            beta: 0,
            gamma: 0
        };
        this.initialBeta = null;
        this.drawThreshold = 30; // degrees to tilt up for draw
        
        this.initializeEventListeners();
        this.requestDevicePermissions();
    }
    
    async requestDevicePermissions() {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    this.startDeviceMotionListening();
                }
            } catch (error) {
                console.log('Device orientation not supported or permission denied');
            }
        } else {
            this.startDeviceMotionListening();
        }
    }
    
    startDeviceMotionListening() {
        window.addEventListener('deviceorientation', (event) => {
            this.deviceMotion.alpha = event.alpha || 0;
            this.deviceMotion.beta = event.beta || 0;
            this.deviceMotion.gamma = event.gamma || 0;
            
            this.handleDeviceMotion();
        });
    }
    
    handleDeviceMotion() {
        if (this.gameState !== 'dueling' || !this.highNoonTime || this.drawTime) return;
        
        // Set initial position when high noon starts
        if (this.initialBeta === null) {
            this.initialBeta = this.deviceMotion.beta;
            return;
        }
        
        // Calculate tilt from initial position
        const tiltChange = this.initialBeta - this.deviceMotion.beta;
        
        // Check if phone is tilted up enough (drawing motion)
        if (tiltChange > this.drawThreshold && !this.isDrawing) {
            this.draw();
        }
    }
    
    initializeEventListeners() {
        this.socket.on('waiting', (data) => {
            this.showScreen('waiting');
            document.getElementById('gameStatus').textContent = data.message;
        });
        
        this.socket.on('gameStart', (data) => {
            this.gameId = data.gameId;
            this.showScreen('game');
            document.getElementById('gameStatus').textContent = 'Duel starting...';
        });
        
        this.socket.on('countdown', (data) => {
            const countdownEl = document.getElementById('countdown');
            if (data.count > 0) {
                countdownEl.textContent = data.count;
                this.vibrate(200);
            } else {
                countdownEl.textContent = '';
            }
        });
        
        this.socket.on('highNoon', (data) => {
            this.startHighNoon(data.timestamp);
        });
        
        this.socket.on('gameEnd', (data) => {
            this.showResults(data);
        });
        
        this.socket.on('playerDisconnected', () => {
            alert('Opponent disconnected!');
            this.restartGame();
        });
        
        // Add tap-to-fire for backup/testing
        document.addEventListener('click', (e) => {
            if (this.gameState === 'dueling' && this.highNoonTime && !this.drawTime) {
                this.draw();
            }
        });
        
        // Enter key to join
        document.getElementById('playerName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinGame();
            }
        });
    }
    
    startHighNoon(timestamp) {
        this.gameState = 'dueling';
        this.highNoonTime = timestamp;
        this.initialBeta = null;
        
        document.getElementById('gameStatus').textContent = 'HIGH NOON!';
        document.getElementById('phoneInstruction').textContent = 'DRAW! Tilt phone up fast!';
        document.getElementById('drawIndicator').style.display = 'block';
        
        // Flash effect
        const flash = document.getElementById('flash');
        flash.style.opacity = '0.8';
        setTimeout(() => {
            flash.style.opacity = '0';
        }, 200);
        
        // Vibrate
        this.vibrate([100, 50, 100, 50, 200]);
        
        // Add shake effect
        document.body.classList.add('vibrate-ready');
        setTimeout(() => {
            document.body.classList.remove('vibrate-ready');
        }, 1000);
    }
    
    draw() {
        if (this.drawTime || !this.highNoonTime) return;
        
        this.drawTime = Date.now() - this.highNoonTime;
        this.isDrawing = true;
        
        document.getElementById('phoneInstruction').textContent = 'BANG! Draw complete!';
        document.getElementById('drawIndicator').style.background = '#32CD32';
        
        this.socket.emit('playerDraw', {
            gameId: this.gameId,
            drawTime: this.drawTime
        });
        
        this.vibrate(300);
    }
    
    vibrate(pattern) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }
    
    showScreen(screen) {
        const screens = ['menu', 'waiting', 'game', 'results'];
        screens.forEach(s => {
            document.getElementById(s).classList.add('hidden');
        });
        document.getElementById(screen).classList.remove('hidden');
    }
    
    showResults(data) {
        this.gameState = 'finished';
        this.showScreen('results');
        
        const myId = this.socket.id;
        const isWinner = data.winner === myId;
        const myResult = data.results[myId];
        const opponentResult = data.results[Object.keys(data.results).find(id => id !== myId)];
        
        let resultText = '';
        
        if (isWinner) {
            resultText = `🎉 Victory! 🎉<br>`;
        } else {
            resultText = `💀 Defeated! 💀<br>`;
        }
        
        if (myResult && opponentResult) {
            resultText += `Your draw: ${myResult.drawTime}ms<br>`;
            resultText += `Opponent: ${opponentResult.drawTime}ms<br>`;
            resultText += `Difference: ${Math.abs(myResult.drawTime - opponentResult.drawTime)}ms`;
        } else if (myResult) {
            resultText += `You drew in ${myResult.drawTime}ms<br>Opponent didn't draw!`;
        } else {
            resultText += `You didn't draw in time!`;
        }
        
        document.getElementById('resultText').innerHTML = resultText;
    }
    
    joinGame() {
        const nameInput = document.getElementById('playerName');
        const name = nameInput.value.trim() || 'Anonymous Cowboy';
        
        this.socket.emit('joinGame', { name });
        this.gameState = 'waiting';
    }
    
    restartGame() {
        this.gameState = 'menu';
        this.gameId = null;
        this.isDrawing = false;
        this.highNoonTime = null;
        this.drawTime = null;
        this.initialBeta = null;
        
        document.getElementById('drawIndicator').style.display = 'none';
        document.getElementById('drawIndicator').style.background = '#FF4500';
        document.getElementById('countdown').textContent = '';
        
        this.showScreen('menu');
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    window.game = new ShowdownGame();
});

// Global functions for HTML onclick handlers
function joinGame() {
    window.game.joinGame();
}

function restartGame() {
    window.game.restartGame();
}