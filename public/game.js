class ShowdownGame {
    constructor() {
        this.playerId = null;
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
        this.restingBeta = null;
        this.initialBeta = null;
        this.drawThreshold = 30; // degrees to tilt up for draw
        this.pollInterval = null;
        this.isCalibrating = false;
        this.isCalibrated = false;
        
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
            
            if (this.isCalibrating) {
                this.updateCalibrationDisplay();
            } else {
                this.handleDeviceMotion();
            }
        });
    }
    
    handleDeviceMotion() {
        if (this.gameState !== 'dueling' || !this.highNoonTime || this.drawTime) return;
        
        // Set initial position when high noon starts
        if (this.initialBeta === null) {
            this.initialBeta = this.restingBeta || this.deviceMotion.beta;
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
    
    async joinGame() {
        const nameInput = document.getElementById('playerName');
        const name = nameInput.value.trim() || 'Anonymous Cowboy';
        
        try {
            const response = await fetch('/api/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name })
            });
            
            const data = await response.json();
            this.playerId = data.playerId;
            
            if (data.status === 'waiting') {
                this.gameState = 'waiting';
                this.showScreen('waiting');
                this.startPolling();
            } else if (data.status === 'matched') {
                this.gameId = data.gameId;
                this.gameState = 'game';
                this.showScreen('game');
                this.startPolling();
            }
            
        } catch (error) {
            console.error('Error joining game:', error);
            alert('Error joining game. Please try again.');
        }
    }
    
    startPolling() {
        if (this.pollInterval) clearInterval(this.pollInterval);
        
        this.pollInterval = setInterval(async () => {
            if (!this.playerId) return;
            
            try {
                const response = await fetch(`/api/game/${this.playerId}`);
                const data = await response.json();
                
                this.handleGameUpdate(data);
                
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 200); // Poll every 200ms for faster response
    }
    
    handleGameUpdate(data) {
        if (data.status === 'waiting') {
            if (this.gameState !== 'waiting') {
                this.gameState = 'waiting';
                this.showScreen('waiting');
            }
            return;
        }
        
        if (data.status === 'game') {
            this.gameId = data.gameId;
            
            // Show opponent name
            if (data.opponent) {
                const opponentName = data.opponent.name;
                document.getElementById('gameStatus').textContent = `Dueling ${opponentName}...`;
            }
            
            if (data.state === 'countdown') {
                if (this.gameState !== 'countdown') {
                    this.gameState = 'countdown';
                    this.showScreen('game');
                    if (data.opponent) {
                        document.getElementById('gameStatus').textContent = `Dueling ${data.opponent.name}...`;
                    }
                }
                
                const countdownEl = document.getElementById('countdown');
                if (data.countdown > 0) {
                    countdownEl.textContent = data.countdown;
                    this.vibrate(200);
                } else {
                    countdownEl.textContent = '';
                }
                
            } else if (data.state === 'dueling') {
                if (this.gameState !== 'dueling') {
                    this.gameState = 'dueling';
                    
                    if (data.highNoonTime) {
                        this.startHighNoon(data.highNoonTime);
                    } else {
                        document.getElementById('gameStatus').textContent = 'Get ready to draw...';
                        document.getElementById('phoneInstruction').textContent = 'Hold phone upside down, wait for signal';
                        // Show moving dot while waiting for high noon
                        document.getElementById('movingDotContainer').style.display = 'block';
                    }
                }
                
                // Check if high noon just started
                if (data.highNoonTime && !this.highNoonTime) {
                    this.startHighNoon(data.highNoonTime);
                }
                
            } else if (data.state === 'finished') {
                console.log('Game finished, showing results:', data);
                if (this.gameState !== 'finished') {
                    this.showResults(data);
                }
            }
        }
    }
    
    startHighNoon(timestamp) {
        this.highNoonTime = timestamp;
        this.initialBeta = null;
        
        document.getElementById('gameStatus').textContent = 'HIGH NOON!';
        document.getElementById('phoneInstruction').textContent = 'DRAW! Tilt phone up fast!';
        // Hide moving dot and show draw indicator
        document.getElementById('movingDotContainer').style.display = 'none';
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
    
    async draw() {
        if (this.drawTime || !this.highNoonTime) return;
        
        this.drawTime = Date.now() - this.highNoonTime;
        this.isDrawing = true;
        
        document.getElementById('phoneInstruction').textContent = 'BANG! Draw complete!';
        document.getElementById('drawIndicator').style.background = '#32CD32';
        
        try {
            console.log('Submitting draw:', this.playerId, this.drawTime);
            const response = await fetch('/api/draw', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    playerId: this.playerId,
                    drawTime: this.drawTime
                })
            });
            const result = await response.json();
            console.log('Draw response:', result);
        } catch (error) {
            console.error('Error submitting draw:', error);
        }
        
        this.vibrate(300);
    }
    
    vibrate(pattern) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }
    
    showScreen(screen) {
        const screens = ['menu', 'calibration', 'waiting', 'game', 'results'];
        screens.forEach(s => {
            document.getElementById(s).classList.add('hidden');
        });
        document.getElementById(screen).classList.remove('hidden');
    }
    
    showResults(data) {
        console.log('ShowResults called with:', data);
        this.gameState = 'finished';
        this.showScreen('results');
        
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        
        const isWinner = data.winner === this.playerId;
        const myResult = data.results[this.playerId];
        const opponentResult = data.results[Object.keys(data.results).find(id => id !== this.playerId)];
        
        let resultText = '';
        
        if (isWinner) {
            resultText = `🎉 Victory! 🎉<br>`;
        } else {
            resultText = `💀 Defeated! 💀<br>`;
        }
        
        // Get opponent name from data
        const opponentName = data.opponent?.name || 'Opponent';
        
        if (myResult && opponentResult) {
            resultText += `Your draw: ${myResult.drawTime}ms<br>`;
            resultText += `${opponentName}: ${opponentResult.drawTime}ms<br>`;
            resultText += `Difference: ${Math.abs(myResult.drawTime - opponentResult.drawTime)}ms`;
        } else if (myResult) {
            resultText += `You drew in ${myResult.drawTime}ms<br>${opponentName} didn't draw!`;
        } else {
            resultText += `You didn't draw in time!<br>${opponentName} wins!`;
        }
        
        document.getElementById('resultText').innerHTML = resultText;
    }
    
    restartGame() {
        this.gameState = 'menu';
        this.playerId = null;
        this.gameId = null;
        this.isDrawing = false;
        this.highNoonTime = null;
        this.drawTime = null;
        this.initialBeta = null;
        
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        
        document.getElementById('drawIndicator').style.display = 'none';
        document.getElementById('drawIndicator').style.background = '#FF4500';
        document.getElementById('movingDotContainer').style.display = 'none';
        document.getElementById('countdown').textContent = '';
        
        this.showScreen('menu');
    }
    
    // Calibration methods
    startCalibration() {
        this.isCalibrating = true;
        this.showScreen('calibration');
        document.getElementById('calibrationData').style.display = 'block';
    }
    
    updateCalibrationDisplay() {
        const currentTilt = Math.round(this.deviceMotion.beta * 10) / 10;
        document.getElementById('currentTilt').textContent = currentTilt + '°';
        
        if (this.restingBeta !== null) {
            const tiltFromResting = Math.round((this.restingBeta - this.deviceMotion.beta) * 10) / 10;
            const status = tiltFromResting > this.drawThreshold ? '🔥 DRAW!' : 
                          tiltFromResting > 10 ? '⚡ Getting there...' : '📱 Hold steady';
            document.getElementById('tiltDebug').textContent = status;
        }
    }
    
    calibrateResting() {
        this.restingBeta = this.deviceMotion.beta;
        document.getElementById('restingAngle').textContent = Math.round(this.restingBeta * 10) / 10 + '°';
        document.getElementById('calibrationStep').innerHTML = `
            Step 2: Practice drawing (tilt phone up fast)<br>
            Current sensitivity: ${this.drawThreshold}°<br>
            <button onclick="window.game.adjustSensitivity(-10)">More Sensitive</button>
            <button onclick="window.game.adjustSensitivity(10)">Less Sensitive</button>
        `;
        document.getElementById('finishCalibration').style.display = 'block';
    }
    
    adjustSensitivity(change) {
        this.drawThreshold = Math.max(10, Math.min(60, this.drawThreshold + change));
        document.getElementById('drawThreshold').textContent = this.drawThreshold + '°';
        document.getElementById('calibrationStep').innerHTML = `
            Step 2: Practice drawing (tilt phone up fast)<br>
            Current sensitivity: ${this.drawThreshold}°<br>
            <button onclick="window.game.adjustSensitivity(-10)">More Sensitive</button>
            <button onclick="window.game.adjustSensitivity(10)">Less Sensitive</button>
        `;
    }
    
    finishCalibration() {
        this.isCalibrating = false;
        this.isCalibrated = true;
        this.showScreen('menu');
        
        // Update instructions with calibrated sensitivity
        const instructions = document.querySelector('.instructions');
        if (instructions) {
            instructions.innerHTML = `
                <strong>Calibrated & Ready!</strong><br>
                Draw sensitivity: ${this.drawThreshold}°<br>
                Hold phone upside down, tilt up fast to draw!
            `;
        }
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

function startCalibration() {
    window.game.startCalibration();
}

function restartGame() {
    window.game.restartGame();
}