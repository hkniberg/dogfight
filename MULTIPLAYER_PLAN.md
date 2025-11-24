# Neon Dogfight - Multiplayer Implementation Plan

## Executive Summary

This document outlines the plan for adding online multiplayer to Neon Dogfight while maintaining the existing local multiplayer mode. The approach prioritizes low latency and smooth gameplay over perfect consistency, using a "believable sync" model suitable for fast-paced arcade combat.

## Design Goals

### Priorities (in order)
1. **Low latency** - Actions feel instant, no input lag
2. **Smooth experience** - No stuttering or jittery movement
3. **Simple to implement** - Minimal code changes, easy to maintain
4. **Believable consistency** - Feels synchronized even if not perfect

### Acceptable Trade-offs
- Minor position deviations (±30 pixels) between clients
- Occasional ambiguous hits (~5% edge cases)
- Client trust model (anti-cheat not required)

## Game Modes

### Local Multiplayer (Current)
- 2 players, 1 keyboard
- Existing implementation unchanged

### Online Multiplayer - Free-For-All
- Public battle arena
- Auto-matchmaking (join "GLOBAL" battle)
- Up to 10 players max per arena
- Multiple arenas spawn if needed

### Online Multiplayer - Private Battle
- Enter or generate 6-character battle code
- Only players with code can join
- Support 2-10 players per battle
- No password required (obscurity-based access)

## Technical Architecture

### Technology Stack
- **Server:** Node.js + Express + Socket.io
- **Hosting:** Existing EC2 instance
- **Protocol:** WebSocket (Socket.io handles fallbacks)
- **State Management:** In-memory (no database)

### Network Model: "Trust but Verify"

**Core Principle:** Each client is authoritative for their own state. Server acts as relay with minimal validation.

```
┌─────────────┐
│  Client A   │ ──┐
└─────────────┘   │
┌─────────────┐   │    ┌──────────────┐
│  Client B   │ ──┼───→│ Socket.io    │
└─────────────┘   │    │ Server       │
┌─────────────┐   │    │ (EC2)        │
│  Client C   │ ──┘    └──────┬───────┘
└─────────────┘                │
       ↑                       │
       └───────────────────────┘
         Broadcasts to room
```

### Server Responsibilities

**Simple relay + shared spawning:**

1. **Connection Management**
   - Player joins battle (create/join room)
   - Track players in each battle
   - Handle disconnects (broadcast player-left)

2. **Message Relay**
   - Player positions (throttled to ~20/sec per player)
   - Weapon fire events
   - Death notifications
   - Score updates

3. **Authoritative Spawning**
   - Power-ups (server decides when/where/what)
   - Asteroids (server decides when/where/size)
   - Ensures all clients have same spawns

4. **Basic Validation**
   - Check player exists before relaying
   - Prevent spam (rate limiting)
   - Clean up empty battles

**Server does NOT run game physics or collision detection!**

### Client Responsibilities

1. **Own Player Simulation**
   - Run full game loop for own player
   - Instant response to inputs (zero lag)
   - Broadcast position updates

2. **Remote Player Rendering**
   - Receive position updates
   - Interpolate between updates (smoothing)
   - Extrapolate if updates delayed (dead reckoning)

3. **Weapon Simulation**
   - Create bullets/missiles from broadcast events
   - Run identical physics locally
   - Use timestamp compensation for accuracy

4. **Hit Detection (Self-Authoritative)**
   - Check if remote bullets hit ME
   - Broadcast my death if hit
   - Trust others' death broadcasts

5. **Shared Entity Sync**
   - Accept power-up spawns from server
   - Accept asteroid spawns from server
   - Remove when someone picks up (broadcast)

## Implementation Details

### Battle Code System

**Generation:**
```
6 uppercase alphanumeric characters
Example: "K3X9A2", "PLAYER", "BOOM42"
Format: [A-Z0-9]{6}
```

**Special codes:**
- `GLOBAL` - Free-for-all public arena
- Custom codes - Private battles

### Message Protocol

**Key Socket.io Events:**

```javascript
// === Connection ===
emit('join-battle', { battleCode, playerName, playerColor })
on('game-state', { players, powerups, asteroids })
on('player-joined', { id, name, color })
on('player-left', { id })

// === Player State ===
emit('player-update', { x, y, angle, speedLevel, turnState, alive, shields, ... })
on('player-update', { id, x, y, angle, ... })

// === Combat ===
emit('fire-weapon', { type, x, y, angle, timestamp })
on('weapon-fired', { ownerId, type, x, y, angle, timestamp })

emit('i-died', { killerId })
on('player-died', { victimId, killerId })

// === Shared Spawns (Server → Clients) ===
on('powerup-spawned', { x, y, type, id })
on('powerup-collected', { id, playerId })
on('asteroid-spawned', { x, y, vx, vy, size, points, id })
on('asteroid-destroyed', { id })
```

### Synchronization Strategy

**Player Positions:**
```
Update Rate: 20 per second (every 50ms)
Interpolation: Linear interpolation over 100ms
Extrapolation: Continue last velocity if update delayed
```

**Weapons:**
```
Fire Event: Immediate broadcast
Spawn: All clients create identical object
Physics: Each client simulates independently
Collision: Self-authoritative (check hits on own player)
```

**Shared Spawns:**
```
Power-ups: Server decides spawn time/location/type
Asteroids: Server decides spawn time/location/size/velocity
Broadcast: All clients create identical objects
Collection: First client to touch broadcasts pickup
```

### Hit Detection: "I Got Hit" Model

**Pseudocode:**

```javascript
// On my client, each frame:
for (remoteBullet of remoteBullets) {
  if (checkCollision(myPlayer, remoteBullet)) {
    myPlayer.die();
    socket.emit('i-died', { 
      killerId: remoteBullet.ownerId,
      weaponType: 'bullet'
    });
    break;
  }
}

// Server relays with validation:
socket.on('i-died', (data) => {
  const battle = battles[socket.battleCode];
  
  // Basic validation
  if (!battle.players[data.killerId]) return; // Killer must exist
  if (!battle.players[socket.id].alive) return; // Can't die twice
  
  // Update state
  battle.players[socket.id].alive = false;
  battle.players[data.killerId].score++;
  
  // Broadcast to all
  io.to(socket.battleCode).emit('player-died', {
    victimId: socket.id,
    killerId: data.killerId
  });
});

// All clients apply:
socket.on('player-died', ({ victimId, killerId }) => {
  players[victimId].die();
  players[killerId].score++;
  updateScoreboard();
});
```

**Why this works:**
- You detect hits on your own screen (fair - you hit me where I actually was)
- Server validates (killer exists, victim was alive)
- Everyone applies the result (consistency)

### Timestamp Compensation

To handle latency for bullets:

```javascript
// When firing:
socket.emit('fire-bullet', {
  x, y, angle,
  timestamp: myGameTime, // Local simulation time
  bulletSpeed: 400
});

// When receiving:
socket.on('fire-bullet', (data) => {
  const latency = (myGameTime - data.timestamp);
  const travelDistance = data.bulletSpeed * latency;
  
  // Spawn bullet slightly ahead to compensate
  const adjustedX = data.x + Math.cos(data.angle) * travelDistance;
  const adjustedY = data.y + Math.sin(data.angle) * travelDistance;
  
  createBullet(adjustedX, adjustedY, data.angle);
});
```

This makes bullets appear in the "right" place despite network delay!

### Power-Up Spawning

**Server-authoritative:**

```javascript
// Server decides spawning
function spawnPowerUp(battleCode) {
  const battle = battles[battleCode];
  const type = randomPowerUpType();
  const pos = randomPosition();
  
  const powerup = {
    id: generateId(),
    type: type,
    x: pos.x,
    y: pos.y
  };
  
  battle.powerups.push(powerup);
  io.to(battleCode).emit('powerup-spawned', powerup);
}

// All clients create identical power-up
socket.on('powerup-spawned', (data) => {
  const powerup = new PowerUp(data.x, data.y, data.type);
  powerup.networkId = data.id;
  powerups.push(powerup);
});

// First to touch picks it up
if (myPlayer.collidesWith(powerup)) {
  socket.emit('pickup-powerup', { id: powerup.networkId });
}

// Server validates and broadcasts
socket.on('pickup-powerup', ({ id }) => {
  const idx = battle.powerups.findIndex(p => p.id === id);
  if (idx !== -1) {
    battle.powerups.splice(idx, 1);
    io.to(battleCode).emit('powerup-collected', { 
      id, 
      playerId: socket.id 
    });
  }
});

// All clients remove
socket.on('powerup-collected', ({ id, playerId }) => {
  removePowerUp(id);
  applyPowerUp(playerId);
});
```

## Code Changes Required

### New Files

**1. server.js** (~200 lines)
- Express server setup
- Socket.io configuration
- Battle room management
- Event handlers for all game actions
- Spawn timers for power-ups/asteroids

**2. network.js** (~250 lines)
- NetworkManager class
- Socket.io client integration
- Event emission helpers
- Remote player interpolation
- Message throttling

### Modified Files

**3. game.js** (~150 lines of changes)
- Add network mode parameter
- Integrate NetworkManager
- Broadcast own player state
- Render remote players
- Handle network events
- Conditional logic: if online mode vs local mode

**4. ui.js** (~100 lines of changes)
- Add mode selection UI (radio buttons)
- Battle code input/generation
- Player name input (always visible)
- Loading/connecting states

**5. index.html** (~50 lines of changes)
- Add Socket.io client library (`<script src="/socket.io/socket.io.js">`)
- Add mode selection UI
- Add battle code input field
- Update player config section

**Total new code:** ~600 lines (manageable for a weekend project)

## Lobby UI Design

### Main Menu Structure

```
┌────────────────────────────────────┐
│       NEON DOGFIGHT                │
├────────────────────────────────────┤
│  Your Name: [_________]            │
│  Your Color: [🎨]                  │
├────────────────────────────────────┤
│  Game Mode:                        │
│  ○ Local Multiplayer (2 players)  │
│  ○ Online Free-For-All             │
│  ○ Online Private Battle           │
│                                    │
│  [if private selected:]            │
│  Battle Code: [______]             │
│  [Generate Code] [Join Battle]    │
├────────────────────────────────────┤
│  Statistics: ...                   │
│  [START GAME]                      │
└────────────────────────────────────┘
```

### Battle Code UI
- Generate random 6-char code
- Display prominently during game
- Copy-to-clipboard button
- Share link: `https://yourdomain.com/?battle=K3X9A2`

## Server Deployment

### EC2 Setup

```bash
# Install Node.js (if not already)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repository
cd /var/www
git clone https://github.com/hkniberg/dogfight.git
cd dogfight

# Install dependencies
npm install express socket.io

# Run with PM2 (auto-restart)
sudo npm install -g pm2
pm2 start server.js --name neon-dogfight
pm2 save
pm2 startup

# Configure nginx reverse proxy (optional)
# Point domain to :3000
```

### Environment Configuration

```javascript
// server.js
const PORT = process.env.PORT || 3000;
const MAX_PLAYERS_PER_BATTLE = process.env.MAX_PLAYERS || 10;
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
```

## Performance Considerations

### Server Load Estimates

**Per battle (10 players):**
- Bandwidth: ~20 KB/sec (incoming + outgoing)
- CPU: Negligible (JSON relay only)
- Memory: ~10 KB (player data)

**100 concurrent battles:**
- Bandwidth: 2 MB/sec
- CPU: ~5% single core
- Memory: 1 MB

**Verdict:** t2.small easily handles 100+ battles

### Optimization Strategies

**1. Message Throttling:**
```javascript
// Don't send position every frame
const UPDATE_RATE = 20; // per second
let lastUpdate = 0;

if (now - lastUpdate > 1000 / UPDATE_RATE) {
  socket.emit('player-update', ...);
  lastUpdate = now;
}
```

**2. Battle Cleanup:**
```javascript
// Remove empty battles after 5 minutes
setInterval(() => {
  for (let code in battles) {
    if (Object.keys(battles[code].players).length === 0) {
      delete battles[code];
    }
  }
}, 5 * 60 * 1000);
```

**3. Dead Player Optimization:**
```javascript
// Don't send updates for dead players
if (!myPlayer.alive) return; // Skip position broadcast
```

## Consistency Mechanisms

### What is Synchronized

**Perfectly consistent:**
- Player scores (server validated)
- Who is alive/dead (broadcast on death)
- Power-up locations (server spawns)
- Asteroid locations (server spawns)
- Match winner (derived from scores)

**Eventually consistent (~50-100ms):**
- Player positions (interpolated)
- Active weapons (simulated)

**Locally computed (may vary):**
- Particle effects
- Visual indicators
- Animation timing

### Handling Edge Cases

**1. Race Conditions (two players grab same power-up):**
```
Client A: Grabs power-up → emits 'pickup'
Client B: Grabs power-up → emits 'pickup'
Server: First message wins, second is ignored (powerup gone)
Client B: Receives 'pickup' from A, removes local powerup
Result: Slight visual pop, but resolved quickly
```

**2. Simultaneous Deaths:**
```
Both clients emit 'i-died' at same time
Server receives both, validates both were alive
Server broadcasts both deaths
Result: Draw (both die, no score change)
```

**3. Late-Joining Players:**
```
New player joins mid-game
Server sends complete game state (all players, active entities)
Client spawns everything to catch up
Player joins at respawn, slight delay before entering
```

## Client-Side Smoothing

### Position Interpolation

**For remote players:**

```javascript
class RemotePlayer {
  update(dt, receivedUpdate) {
    if (receivedUpdate) {
      this.targetX = receivedUpdate.x;
      this.targetY = receivedUpdate.y;
      this.targetAngle = receivedUpdate.angle;
    }
    
    // Smooth interpolation
    const LERP_SPEED = 0.3;
    this.displayX += (this.targetX - this.displayX) * LERP_SPEED;
    this.displayY += (this.targetY - this.displayY) * LERP_SPEED;
    
    // Smooth angle
    let angleDiff = this.targetAngle - this.displayAngle;
    if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.displayAngle += angleDiff * LERP_SPEED;
  }
  
  draw(ctx) {
    // Draw at smoothed display position, not target
    drawPlane(this.displayX, this.displayY, this.displayAngle);
  }
}
```

### Timestamp Compensation for Weapons

```javascript
// When receiving remote weapon fire:
const latency = myGameTime - data.timestamp;
const compensation = weaponSpeed * latency;

// Spawn weapon ahead of reported position
const adjustedX = data.x + Math.cos(data.angle) * compensation;
const adjustedY = data.y + Math.sin(data.angle) * compensation;
```

This makes weapons appear where they "should" be despite network delay.

## Game State Synchronization

### What Client Tracks

**For local player:**
- Full Player object (existing code)
- Own bullets (existing code)
- All power-up state (existing code)

**For remote players:**
```javascript
remotePlayers = {
  'socket-id-123': {
    id, name, color,
    x, y, angle,
    displayX, displayY, displayAngle, // Smoothed
    speedLevel, turnState,
    alive, shields,
    invisible, reversed,
    lastUpdate: timestamp
  }
}
```

**For shared entities:**
```javascript
networkPowerUps = [{ id, x, y, type }]
networkAsteroid = { id, x, y, vx, vy, size, points, health }
```

### Update Frequencies

| Data Type | Rate | Reason |
|-----------|------|--------|
| Player position | 20/sec | Smooth movement |
| Weapon fire | On event | Instant |
| Death | On event | Critical |
| Power-up spawn | On event | Rare |
| Asteroid state | 5/sec | Slow moving |

## Local vs Online Mode

### Conditional Execution Pattern

```javascript
class Game {
  constructor(mode, battleCode) {
    this.mode = mode; // 'local' or 'online'
    
    if (mode === 'online') {
      this.network = new NetworkManager(battleCode);
      this.setupNetworkHandlers();
    }
  }
  
  update(dt) {
    // Always update own player
    this.myPlayer.update(dt);
    
    if (this.mode === 'local') {
      // Update other local player
      this.player2.update(dt);
      
      // Check collisions between local players
      this.checkCollisions();
      
      // Spawn power-ups/asteroids locally
      this.spawnManager.update(dt);
    } else {
      // Send my position
      this.network.sendPlayerUpdate(this.myPlayer);
      
      // Update remote players (interpolation)
      this.network.updateRemotePlayers(dt);
      
      // Check collisions with remote entities
      this.checkNetworkCollisions();
      
      // Power-ups/asteroids managed by server
    }
  }
}
```

**Key insight:** Most code stays the same, just add conditional branching.

## Testing Strategy

### Local Testing (Before EC2)

```bash
# Terminal 1: Run server
node server.js

# Browser 1: http://localhost:3000
Enter name: "Player1"
Mode: Online Private
Code: "TEST01"

# Browser 2: http://localhost:3000
Enter name: "Player2"
Mode: Online Private  
Code: "TEST01"

# Both should see each other!
```

### Test Scenarios

1. **Basic movement** - Do players see each other moving?
2. **Shooting** - Do bullets appear on both screens?
3. **Hits** - Do deaths register correctly?
4. **Power-ups** - Do both see same power-ups?
5. **Late join** - Can player 3 join mid-game?
6. **Disconnect** - Does game continue if player leaves?
7. **Lag simulation** - Add artificial delay to test smoothing

### Network Simulation Tools

```javascript
// Add artificial lag for testing
function simulateLag(socket, delayMs) {
  const originalEmit = socket.emit;
  socket.emit = function(...args) {
    setTimeout(() => {
      originalEmit.apply(socket, args);
    }, delayMs);
  };
}

// Test with 100ms, 200ms, 500ms lag
```

## Deployment Workflow

### Development Cycle

```bash
# 1. Develop locally
node server.js

# 2. Test with multiple browser tabs
# 3. Commit changes
git add .
git commit -m "Add multiplayer support"
git push origin main

# 4. Deploy to EC2
ssh ec2-user@your-server
cd /var/www/dogfight
git pull
npm install
pm2 restart neon-dogfight

# 5. Test on EC2
# Open from multiple devices/networks
```

### Zero-Downtime Updates

```bash
# On EC2, run two instances
pm2 start server.js --name dogfight-blue -i 1 -- --port 3000
pm2 start server.js --name dogfight-green -i 1 -- --port 3001

# Nginx load balances
# Update one at a time for zero downtime
```

## Known Limitations & Quirks

### Expected Behaviors

**Position Uncertainty:**
- Remote players may appear ±30 pixels off on different screens
- Masked by movement speed and visual effects
- Not noticeable during fast gameplay

**Occasional "Phantom Hits":**
- Bullet misses on shooter's screen but hits on victim's screen (~5% of cases)
- Acceptable for arcade game
- Victim's view is authoritative (fair)

**Network Hiccups:**
- Players may "teleport" if connection drops briefly
- Interpolation catches up within 200ms
- Rare with stable connections

### Handling Poor Connections

**Disconnection detection:**
```javascript
// Ping timeout
socket.on('disconnect', () => {
  setTimeout(() => {
    // If still disconnected after 5 seconds, remove from battle
    removePlayer(socket.id);
  }, 5000);
});
```

**Degradation:**
- >200ms lag: Position interpolation struggles
- >500ms lag: Consider showing "connection poor" indicator
- >1000ms lag: Essentially unplayable

**Recommendation:** Show latency indicator in online mode

## Future Enhancements

### Easy Additions

- **Player list UI** - Show names/scores during game
- **Chat messages** - Simple broadcast
- **Spectator mode** - Join battle but don't spawn player
- **Replay sharing** - Record and upload inputs

### Medium Additions

- **Matchmaking** - Auto-pair players in empty battles
- **Leaderboards** - Persistent stats (add database)
- **Custom game modes** - Server-side rule variations
- **Battle history** - Save recent battles (add database)

### Complex Additions

- **Lag compensation** - Full rewind-and-replay
- **Cheat detection** - Server validates all actions
- **Voice chat** - WebRTC audio channels
- **AI opponents** - Server-run bots

## Decision Summary

### Chosen Approach: Client-Side Simulation + Server Relay

**Rationale:**
1. Matches priorities (latency > perfect consistency)
2. Simple implementation (~600 lines total)
3. Reuses existing game logic
4. Minimal server load (many battles on one EC2)
5. Feels responsive and smooth
6. "Believably consistent" for arcade gameplay

**Not chosen:**
- ❌ Full server authority (too much lag, too complex)
- ❌ Lockstep (input delay hurts arcade feel)
- ❌ Peer-to-peer (NAT issues, complexity)

### Success Criteria

**Game feels good if:**
- ✅ Own actions have zero perceived lag
- ✅ Remote players move smoothly (no jitter)
- ✅ Hits feel fair (>90% agreement)
- ✅ Scores always match across clients
- ✅ Can play 1v1 with <100ms effective latency

**Acceptable if occasionally:**
- ⚠️ Remote player "teleports" slightly (rare)
- ⚠️ Bullet appears to miss but registered hit (5% of cases)
- ⚠️ Brief desync on power-up pickup (resolved within 100ms)

## Implementation Timeline

**Estimated effort:** 8-12 hours

### Phase 1: Server Foundation (2-3 hours)
- Set up Express + Socket.io server
- Implement battle room management
- Basic relay functionality
- Test with simple position broadcasting

### Phase 2: Client Integration (3-4 hours)
- Create NetworkManager class
- Add mode selection to UI
- Integrate with existing game.js
- Remote player rendering with interpolation

### Phase 3: Combat & Weapons (2-3 hours)
- Weapon fire event broadcasting
- Timestamp compensation
- Death detection and broadcasting
- Score synchronization

### Phase 4: Shared Spawning (1-2 hours)
- Server-side power-up spawning
- Server-side asteroid spawning
- Client-side spawn handling
- Pickup/collection events

### Phase 5: Testing & Polish (2-3 hours)
- Multi-tab local testing
- EC2 deployment and testing
- Latency testing with remote players
- Bug fixes and smoothing adjustments

## Risk Assessment

### Low Risk
- ✅ Basic connectivity (Socket.io is mature)
- ✅ Message relay (straightforward)
- ✅ Local testing (easy to verify)

### Medium Risk
- ⚠️ Interpolation tuning (requires playtesting)
- ⚠️ Race conditions (power-up pickups, simultaneous deaths)
- ⚠️ EC2 networking (firewall, websocket support)

### Mitigation
- Start with 2-player private battles (simplest)
- Add free-for-all later (more complexity)
- Extensive local testing before EC2 deployment
- Gradual rollout (share with friends first)

## Conclusion

The proposed architecture strikes the right balance for Neon Dogfight's online multiplayer:

- **Simple enough** to implement in a weekend
- **Responsive enough** to feel like local play
- **Consistent enough** for fair, fun gameplay
- **Scalable enough** to support many concurrent battles on modest hardware

The "believable sync" model with client-side simulation and server relay is well-suited for fast-paced arcade combat where perfect accuracy matters less than smooth, responsive gameplay.

**Next steps when ready to implement:**
1. Create server.js with basic relay
2. Create network.js with Socket.io client wrapper
3. Modify game.js to support online mode
4. Test locally with multiple browser tabs
5. Deploy to EC2 and test with real network latency

---

*Document created: 2024*
*Target implementation: TBD*

