const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static('public'));

// Game state
const games = new Map();
const waitingPlayers = [];

class DuelGame {
  constructor(player1, player2) {
    this.id = uuidv4();
    this.players = [player1, player2];
    this.state = 'waiting'; // waiting, countdown, dueling, finished
    this.countdown = 0;
    this.results = {};
    this.startTime = null;
    
    // Add players to game
    player1.gameId = this.id;
    player2.gameId = this.id;
    
    games.set(this.id, this);
    
    // Start countdown
    this.startCountdown();
  }
  
  startCountdown() {
    this.state = 'countdown';
    this.countdown = 3;
    
    this.broadcast('gameStart', {
      gameId: this.id,
      opponent: this.getOpponentData()
    });
    
    const countdownInterval = setInterval(() => {
      this.broadcast('countdown', { count: this.countdown });
      this.countdown--;
      
      if (this.countdown < 0) {
        clearInterval(countdownInterval);
        this.startDuel();
      }
    }, 1000);
  }
  
  startDuel() {
    this.state = 'dueling';
    this.startTime = Date.now();
    
    // Random delay before "high noon" signal (1-5 seconds)
    const delay = Math.random() * 4000 + 1000;
    
    setTimeout(() => {
      if (this.state === 'dueling') {
        this.broadcast('highNoon', { timestamp: Date.now() });
      }
    }, delay);
  }
  
  playerDraw(playerId, drawTime) {
    if (this.state !== 'dueling') return;
    
    const player = this.players.find(p => p.id === playerId);
    if (!player || this.results[playerId]) return;
    
    this.results[playerId] = {
      drawTime,
      timestamp: Date.now()
    };
    
    // Check if both players have drawn
    if (Object.keys(this.results).length === 2) {
      this.finishDuel();
    }
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
    
    this.broadcast('gameEnd', {
      winner,
      results: this.results,
      players: this.players.map(p => ({ id: p.id, name: p.name }))
    });
    
    // Clean up after 10 seconds
    setTimeout(() => {
      this.cleanup();
    }, 10000);
  }
  
  broadcast(event, data) {
    this.players.forEach(player => {
      if (player.socket) {
        player.socket.emit(event, data);
      }
    });
  }
  
  getOpponentData() {
    return this.players.map(p => ({ id: p.id, name: p.name }));
  }
  
  cleanup() {
    games.delete(this.id);
    this.players.forEach(player => {
      player.gameId = null;
    });
  }
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  socket.on('joinGame', (playerData) => {
    const player = {
      id: socket.id,
      name: playerData.name || `Cowboy ${socket.id.slice(0, 4)}`,
      socket: socket,
      gameId: null
    };
    
    // Try to match with waiting player
    if (waitingPlayers.length > 0) {
      const opponent = waitingPlayers.shift();
      new DuelGame(opponent, player);
    } else {
      waitingPlayers.push(player);
      socket.emit('waiting', { message: 'Waiting for opponent...' });
    }
  });
  
  socket.on('playerDraw', (data) => {
    const game = games.get(data.gameId);
    if (game) {
      game.playerDraw(socket.id, data.drawTime);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    // Remove from waiting players
    const waitingIndex = waitingPlayers.findIndex(p => p.id === socket.id);
    if (waitingIndex !== -1) {
      waitingPlayers.splice(waitingIndex, 1);
    }
    
    // Handle game cleanup
    for (const [gameId, game] of games) {
      const playerInGame = game.players.find(p => p.id === socket.id);
      if (playerInGame) {
        game.broadcast('playerDisconnected', { playerId: socket.id });
        game.cleanup();
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});