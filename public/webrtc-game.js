class WebRTCShowdown {
    constructor() {
        this.playerId = Math.random().toString(36).substr(2, 9);
        this.gameState = 'menu';
        this.isHost = false;
        this.roomCode = null;
        this.peerConnection = null;
        this.dataChannel = null;
        this.gameData = {
            countdown: 3,
            highNoonTime: null,
            results: {},
            winner: null
        };
        
        // Device motion
        this.deviceMotion = { alpha: 0, beta: 0, gamma: 0 };
        this.restingBeta = null;
        this.initialBeta = null; 
        this.drawThreshold = 30;
        this.drawTime = null;
        this.isCalibrating = false;
        this.isCalibrated = false;
        
        this.initializeEventListeners();
        this.requestDevicePermissions();
    }
    
    async requestDevicePermissions() {
        // Add a button to request permissions on iOS
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS - needs user gesture to request permission
            this.addPermissionButton();
        } else {
            // Android/other
            this.startDeviceMotionListening();
        }
    }
    
    addPermissionButton() {
        const button = document.createElement('button');
        button.textContent = 'Enable Phone Tilting';
        button.style.cssText = `
            padding: 10px 20px;
            background: #FF4500;
            color: white;
            border: none;
            border-radius: 5px;
            margin: 10px;
            font-size: 1rem;
        `;
        button.onclick = async () => {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    this.startDeviceMotionListening();
                    button.remove();
                    document.getElementById('tiltStatus').textContent = 'Tilt detection enabled! ✅';
                }
            } catch (error) {
                document.getElementById('tiltStatus').textContent = 'Tilt not supported, use tap to fire';
            }
        };
        
        const statusDiv = document.createElement('div');
        statusDiv.id = 'tiltStatus';
        statusDiv.textContent = 'Click to enable phone tilting';
        statusDiv.style.cssText = 'margin: 10px; font-size: 0.9rem;';
        
        document.getElementById('menu').appendChild(statusDiv);
        document.getElementById('menu').appendChild(button);
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
        
        console.log('Device orientation listening started');
        if (document.getElementById('tiltStatus')) {
            document.getElementById('tiltStatus').textContent = 'Device orientation enabled! 📱';
        }
    }
    
    handleDeviceMotion() {
        if (this.gameState !== 'dueling' || !this.gameData.highNoonTime || this.drawTime) return;
        
        if (this.initialBeta === null) {
            this.initialBeta = this.restingBeta || this.deviceMotion.beta;
            return;
        }
        
        const tiltChange = this.initialBeta - this.deviceMotion.beta;
        if (tiltChange > this.drawThreshold) {
            this.draw();
        }
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
        
        // Add calibrated indicator
        const statusDiv = document.getElementById('tiltStatus') || document.createElement('div');
        statusDiv.textContent = `✅ Calibrated! (${this.drawThreshold}° sensitivity)`;
        statusDiv.style.cssText = 'margin: 10px; font-size: 0.9rem; color: #32CD32;';
        if (!document.getElementById('tiltStatus')) {
            statusDiv.id = 'tiltStatus';
            document.getElementById('menu').appendChild(statusDiv);
        }
    }
    
    initializeEventListeners() {
        document.addEventListener('click', (e) => {
            if (this.gameState === 'dueling' && this.gameData.highNoonTime && !this.drawTime) {
                this.draw();
            }
        });
        
        document.getElementById('playerName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createRoom();
            }
        });
        
        document.getElementById('roomCodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinRoom();
            }
        });
    }
    
    // Create a new room (host)
    async createRoom() {
        this.isHost = true;
        this.roomCode = Math.random().toString(36).substr(2, 6).toUpperCase();
        
        await this.setupPeerConnection();
        this.showRoomScreen();
        
        document.getElementById('roomCode').textContent = this.roomCode;
        document.getElementById('roomStatus').textContent = 'Waiting for opponent...';
        
        // Create offer
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        
        // Store offer in "signaling server" (just show to user)
        this.showOffer(JSON.stringify({
            type: 'offer',
            roomCode: this.roomCode,
            offer: offer
        }));
    }
    
    // Join existing room
    async joinRoom() {
        this.isHost = false;
        this.roomCode = document.getElementById('roomCodeInput').value.toUpperCase();
        
        if (!this.roomCode) {
            alert('Please enter a room code');
            return;
        }
        
        await this.setupPeerConnection();
        this.showRoomScreen();
        
        document.getElementById('roomCode').textContent = this.roomCode;
        document.getElementById('roomStatus').textContent = 'Connecting...';
        
        // In a real app, you'd get the offer from a signaling server
        // For now, we'll show instructions
        this.showAnswerInstructions();
    }
    
    async setupPeerConnection() {
        this.peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });
        
        // Set up data channel
        if (this.isHost) {
            this.dataChannel = this.peerConnection.createDataChannel('game', {
                ordered: true
            });
            this.setupDataChannel();
        } else {
            this.peerConnection.ondatachannel = (event) => {
                this.dataChannel = event.channel;
                this.setupDataChannel();
            };
        }
        
        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('ICE Candidate:', event.candidate);
                // In a real app, send this to the other peer via signaling server
            }
        };
        
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'connected') {
                document.getElementById('roomStatus').textContent = 'Connected! Starting duel...';
                setTimeout(() => this.startDuel(), 1000);
            }
        };
    }
    
    setupDataChannel() {
        this.dataChannel.onopen = () => {
            console.log('Data channel opened');
            document.getElementById('roomStatus').textContent = 'Connected!';
        };
        
        this.dataChannel.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handlePeerMessage(message);
        };
    }
    
    sendToPeer(message) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(message));
        }
    }
    
    handlePeerMessage(message) {
        switch (message.type) {
            case 'gameStart':
                this.startDuel();
                break;
            case 'countdown':
                this.updateCountdown(message.count);
                break;
            case 'highNoon':
                this.handleHighNoon(message.timestamp);
                break;
            case 'draw':
                this.handleOpponentDraw(message.drawTime);
                break;
            case 'gameEnd':
                this.showResults(message);
                break;
        }
    }
    
    startDuel() {
        this.gameState = 'countdown';
        this.gameData.countdown = 3;
        this.showScreen('game');
        
        document.getElementById('gameStatus').textContent = 'Duel starting...';
        
        if (this.isHost) {
            // Host controls the countdown
            const countdownInterval = setInterval(() => {
                this.updateCountdown(this.gameData.countdown);
                this.sendToPeer({ type: 'countdown', count: this.gameData.countdown });
                
                this.gameData.countdown--;
                
                if (this.gameData.countdown < 0) {
                    clearInterval(countdownInterval);
                    this.startHighNoonSequence();
                }
            }, 1000);
        }
    }
    
    updateCountdown(count) {
        const countdownEl = document.getElementById('countdown');
        if (count > 0) {
            countdownEl.textContent = count;
            this.vibrate(200);
        } else {
            countdownEl.textContent = '';
        }
    }
    
    startHighNoonSequence() {
        this.gameState = 'dueling';
        
        // Random delay before "high noon" signal (1-5 seconds)
        const delay = Math.random() * 4000 + 1000;
        
        setTimeout(() => {
            const timestamp = Date.now();
            this.gameData.highNoonTime = timestamp;
            this.handleHighNoon(timestamp);
            this.sendToPeer({ type: 'highNoon', timestamp });
        }, delay);
    }
    
    handleHighNoon(timestamp) {
        this.gameData.highNoonTime = timestamp;
        this.initialBeta = null;
        
        document.getElementById('gameStatus').textContent = 'HIGH NOON!';
        document.getElementById('phoneInstruction').textContent = 'DRAW! Tilt phone up fast!';
        document.getElementById('drawIndicator').style.display = 'block';
        
        // Flash effect
        const flash = document.getElementById('flash');
        flash.style.opacity = '0.8';
        setTimeout(() => flash.style.opacity = '0', 200);
        
        this.vibrate([100, 50, 100, 50, 200]);
        
        document.body.classList.add('vibrate-ready');
        setTimeout(() => document.body.classList.remove('vibrate-ready'), 1000);
    }
    
    draw() {
        if (this.drawTime || !this.gameData.highNoonTime) return;
        
        this.drawTime = Date.now() - this.gameData.highNoonTime;
        
        document.getElementById('phoneInstruction').textContent = 'BANG! Draw complete!';
        document.getElementById('drawIndicator').style.background = '#32CD32';
        
        this.gameData.results[this.playerId] = { drawTime: this.drawTime };
        
        // Send draw to opponent
        this.sendToPeer({ 
            type: 'draw', 
            drawTime: this.drawTime,
            playerId: this.playerId
        });
        
        this.vibrate(300);
        this.checkGameEnd();
    }
    
    handleOpponentDraw(drawTime) {
        // Store opponent's draw time
        const opponentId = this.isHost ? 'guest' : 'host';
        this.gameData.results[opponentId] = { drawTime };
        this.checkGameEnd();
    }
    
    checkGameEnd() {
        const resultKeys = Object.keys(this.gameData.results);
        if (resultKeys.length === 2) {
            // Both players have drawn
            const myResult = this.gameData.results[this.playerId];
            const opponentResult = this.gameData.results[Object.keys(this.gameData.results).find(id => id !== this.playerId)];
            
            const winner = myResult.drawTime < opponentResult.drawTime ? this.playerId : 'opponent';
            this.gameData.winner = winner;
            
            const gameEndData = {
                type: 'gameEnd',
                winner,
                results: this.gameData.results
            };
            
            // Only host sends game end to avoid duplicate
            if (this.isHost) {
                this.sendToPeer(gameEndData);
            }
            
            this.showResults(gameEndData);
        }
    }
    
    showResults(data) {
        this.gameState = 'finished';
        this.showScreen('results');
        
        const isWinner = data.winner === this.playerId;
        const myResult = this.gameData.results[this.playerId];
        const opponentResult = this.gameData.results[Object.keys(this.gameData.results).find(id => id !== this.playerId)];
        
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
        }
        
        document.getElementById('resultText').innerHTML = resultText;
    }
    
    vibrate(pattern) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }
    
    showScreen(screen) {
        const screens = ['menu', 'calibration', 'room', 'game', 'results'];
        screens.forEach(s => {
            const element = document.getElementById(s);
            if (element) element.classList.add('hidden');
        });
        const element = document.getElementById(screen);
        if (element) element.classList.remove('hidden');
    }
    
    showRoomScreen() {
        this.showScreen('room');
    }
    
    showOffer(offerData) {
        document.getElementById('offerData').textContent = offerData;
        document.getElementById('offerSection').style.display = 'block';
    }
    
    showAnswerInstructions() {
        document.getElementById('answerSection').style.display = 'block';
    }
    
    // Manual signaling helpers (in real app, this would be automated via server)
    async handleOfferInput() {
        const offerText = document.getElementById('offerInput').value;
        try {
            const data = JSON.parse(offerText);
            await this.peerConnection.setRemoteDescription(data.offer);
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            document.getElementById('answerData').textContent = JSON.stringify({
                type: 'answer',
                answer: answer
            });
            document.getElementById('answerOutput').style.display = 'block';
        } catch (error) {
            alert('Invalid offer data');
        }
    }
    
    async handleAnswerInput() {
        const answerText = document.getElementById('answerInput').value;
        try {
            const data = JSON.parse(answerText);
            await this.peerConnection.setRemoteDescription(data.answer);
        } catch (error) {
            alert('Invalid answer data');
        }
    }
    
    restartGame() {
        this.gameState = 'menu';
        this.drawTime = null;
        this.gameData = {
            countdown: 3,
            highNoonTime: null,
            results: {},
            winner: null
        };
        this.initialBeta = null;
        
        if (this.dataChannel) {
            this.dataChannel.close();
        }
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        
        document.getElementById('drawIndicator').style.display = 'none';
        document.getElementById('drawIndicator').style.background = '#FF4500';
        document.getElementById('countdown').textContent = '';
        
        this.showScreen('menu');
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    window.game = new WebRTCShowdown();
});

// Global functions
function createRoom() {
    window.game.createRoom();
}

function joinRoom() {
    window.game.joinRoom();
}

function startCalibration() {
    window.game.startCalibration();
}

function handleOffer() {
    window.game.handleOfferInput();
}

function handleAnswer() {
    window.game.handleAnswerInput();
}

function restartGame() {
    window.game.restartGame();
}