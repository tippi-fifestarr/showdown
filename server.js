const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Game state (in memory - will reset on deployment)
const games = new Map();
const waitingPlayers = [];
const players = new Map();

class DuelGame {
  constructor(player1, player2) {
    this.id = uuidv4();
    this.players = [player1, player2];
    this.state = 'countdown'; // countdown, dueling, finished
    this.countdown = 3;
    this.results = {};
    this.startTime = Date.now();
    this.highNoonTime = null;
    
    // Add players to game
    player1.gameId = this.id;
    player2.gameId = this.id;
    
    games.set(this.id, this);
    
    // Start countdown
    this.startCountdown();
  }
  
  startCountdown() {
    const countdownInterval = setInterval(() => {
      this.countdown--;
      
      if (this.countdown < 0) {
        clearInterval(countdownInterval);
        this.startDuel();
      }
    }, 1000);
  }
  
  startDuel() {
    this.state = 'dueling';
    
    // Random delay before "high noon" signal (1-5 seconds)
    const delay = Math.random() * 4000 + 1000;
    
    setTimeout(() => {
      if (this.state === 'dueling') {
        this.highNoonTime = Date.now();
        
        // End game after 10 seconds if not both players have drawn
        setTimeout(() => {
          if (this.state === 'dueling') {
            console.log('Game timeout - ending duel');
            this.finishDuel();
          }
        }, 10000);
      }
    }, delay);
  }
  
  playerDraw(playerId, drawTime) {
    if (this.state !== 'dueling' || !this.highNoonTime) return false;
    
    const player = this.players.find(p => p.id === playerId);
    if (!player || this.results[playerId]) return false;
    
    this.results[playerId] = {
      drawTime,
      timestamp: Date.now()
    };
    
    // Check if both players have drawn
    if (Object.keys(this.results).length === 2) {
      this.finishDuel();
    }
    
    return true;
  }
  
  finishDuel() {
    this.state = 'finished';
    
    const [p1Id, p2Id] = this.players.map(p => p.id);
    const p1Result = this.results[p1Id];
    const p2Result = this.results[p2Id];
    
    let winner = null;
    if (p1Result && p2Result) {
      winner = p1Result.drawTime < p2Result.drawTime ? p1Id : p2Id;
    } else if (p1Result) {
      winner = p1Id;
    } else if (p2Result) {
      winner = p2Id;
    }
    
    this.winner = winner;
    
    // Clean up after 30 seconds
    setTimeout(() => {
      this.cleanup();
    }, 30000);
  }
  
  cleanup() {
    games.delete(this.id);
    this.players.forEach(player => {
      players.delete(player.id);
    });
  }
  
  getGameState(playerId) {
    const opponent = this.players.find(p => p.id !== playerId);
    return {
      gameId: this.id,
      state: this.state,
      countdown: this.countdown,
      highNoonTime: this.highNoonTime,
      opponent: opponent ? { id: opponent.id, name: opponent.name } : null,
      results: this.results,
      winner: this.winner || null
    };
  }
}

// API Routes
app.post('/api/join', (req, res) => {
  const playerId = uuidv4();
  const playerName = req.body.name || `Cowboy ${playerId.slice(0, 4)}`;
  
  const player = {
    id: playerId,
    name: playerName,
    gameId: null,
    lastSeen: Date.now()
  };
  
  players.set(playerId, player);
  
  // Try to match with waiting player
  if (waitingPlayers.length > 0) {
    const opponent = waitingPlayers.shift();
    const game = new DuelGame(opponent, player);
    res.json({ 
      playerId,
      status: 'matched',
      gameId: game.id
    });
  } else {
    waitingPlayers.push(player);
    res.json({ 
      playerId,
      status: 'waiting'
    });
  }
});

app.get('/api/game/:playerId', (req, res) => {
  const player = players.get(req.params.playerId);
  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }
  
  player.lastSeen = Date.now();
  
  if (!player.gameId) {
    return res.json({ status: 'waiting' });
  }
  
  const game = games.get(player.gameId);
  if (!game) {
    return res.json({ status: 'waiting' });
  }
  
  res.json({
    status: 'game',
    ...game.getGameState(player.id)
  });
});

app.post('/api/draw', (req, res) => {
  const { playerId, drawTime } = req.body;
  const player = players.get(playerId);
  
  if (!player || !player.gameId) {
    return res.status(400).json({ error: 'Invalid player or no active game' });
  }
  
  const game = games.get(player.gameId);
  if (!game) {
    return res.status(400).json({ error: 'Game not found' });
  }
  
  const success = game.playerDraw(playerId, drawTime);
  res.json({ success });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;