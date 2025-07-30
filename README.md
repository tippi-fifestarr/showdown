# Showdown - High Noon Mobile Dueling Game

A web-based recreation of the legendary High Noon mobile dueling game. Features real-time multiplayer dueling with phone accelerometer controls.

## 🎮 Live Demos

- **WebRTC P2P Version** (Ultra-low latency): https://showdown-q3ug8zr5y-tippififestarrs-projects.vercel.app/webrtc.html
- **Polling Version** (More stable): https://showdown-q3ug8zr5y-tippififestarrs-projects.vercel.app/

## 🤠 How to Play

1. **Calibrate** your phone's tilt sensitivity first
2. **Create/Join** a room with your opponent  
3. **Hold** phone upright like a holstered gun
4. **Wait** for the countdown and "HIGH NOON!" signal
5. **Draw** fast - tilt phone up 30°+ or tap to fire
6. **Fastest** draw wins!

## 🚀 Features

### WebRTC P2P Version
- Direct peer-to-peer connection (no server lag after setup)
- Sub-50ms latency for dueling
- Manual signaling (copy/paste connection data)
- Interactive tilt calibration system

### Polling Version  
- Automatic matchmaking
- Server-based synchronization
- More stable connection
- Works on more networks

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js, Express, Socket.io (polling version)
- **WebRTC**: Direct P2P data channels
- **Device APIs**: DeviceOrientationEvent, Vibration API
- **Deployment**: Vercel

## 🔧 Development

```bash
# Clone and install
git clone https://github.com/tippi-fifestarr/showdown.git
cd showdown
npm install

# Run locally
npm start
# Game runs on http://localhost:3000

# Deploy
vercel --prod
```

## 📱 Device Compatibility

- **iOS Safari**: Requires HTTPS + user gesture for device orientation
- **Android Chrome**: Works with device orientation permissions
- **Desktop**: Tap-to-fire fallback controls
- **All platforms**: Vibration feedback where supported

## 🤝 Contributing

This project is open for collaboration! Areas that need work:

- **WebRTC signaling server** (eliminate manual copy/paste)
- **Mobile network compatibility** (TURN servers for NAT traversal)
- **Device motion improvements** (better tilt detection)
- **UI/UX polish** (animations, sound effects)
- **Game modes** (tournaments, practice mode)

## 🎯 Original High Noon Features

Based on the legendary mobile game that had:
- $1M+ monthly revenue at peak
- 12M+ downloads
- Revolutionary "phone as gun" mechanics
- Real-time global PvP
- Passionate community (still petitioning for return!)

## 📄 License

MIT License - Built for fun and nostalgia! 🤠

---

*"It's high noon somewhere in the world..."*