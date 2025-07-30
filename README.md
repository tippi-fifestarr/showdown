# Showdown - High Noon Mobile Dueling Game

A web-based recreation of the legendary High Noon mobile dueling game. Uses your phone's accelerometer for authentic "draw" mechanics.

## How to Play

1. **Join**: Enter your name and click "Join Duel"
2. **Holster**: Hold your phone upright like a holstered gun
3. **Wait**: Count down with your opponent 
4. **Draw**: When you see "HIGH NOON!" - quickly tilt your phone up and tap to fire
5. **Win**: Fastest draw wins!

## Running Locally

```bash
npm install
npm start
```

Game runs on http://localhost:3000

## Deploying

For quick deployment, you can use:
- Railway: `railway login && railway deploy`
- Render: Connect GitHub repo
- Heroku: `git push heroku main`

## Features

- Real-time multiplayer dueling
- Accelerometer-based "phone as gun" mechanics  
- Western-themed UI with countdown and flash effects
- Vibration feedback (mobile devices)
- Cross-platform compatibility (iOS/Android/Desktop)
- Automatic matchmaking

## Controls

- **Primary**: Tilt phone up 30+ degrees to draw
- **Backup**: Tap screen to fire (for testing/desktop)
- **Mobile**: Requires device orientation permissions

Ready for showdown! 🤠