# Neon Dogfight - Multiplayer Implementation Plan

## Overview

Add online multiplayer to Neon Dogfight using a unified architecture where local mode is simply "the server runs in the client." This approach maximizes code reuse and maintains clean separation between game logic and networking.

## Design Philosophy

**Core Principle:** "Believable Sync over Perfect Sync"

- Prioritize low latency and smooth gameplay
- Accept minor position deviations (±30 pixels)
- Trust clients for their own hit detection (friends-only game)
- Server acts as relay + spawning authority
- Works great for fast-paced arcade combat
- **Fixed map size:** All players use same canvas dimensions (laptop-friendly)
- **Win condition:** First to 5 kills (of any player) wins the match

## Game Modes

### 1. Local Multiplayer
- 2 players on one keyboard (current implementation)
- NetworkManager runs in-process (no websockets)
- Zero network overhead

### 2. Online Free-For-All
- Public battle arena (`GLOBAL` room)
- Auto-join, up to 10 players per arena
- Multiple arenas spawn if needed

### 3. Online Private Battle
- 6-character battle code (e.g., `K3X9A2`)
- Share code to invite players
- 2-10 players per battle

## Multiplayer Game Rules

**Scoring & Victory:**
- First to 5 kills (of any player) wins the match
- In free-for-all, killing anyone counts toward your score

**Respawn Mechanics:**
- Spawn at random location (no safe-spawn validation)
- 3 seconds of invulnerability (blinking effect)
- While invulnerable: cannot shoot or interact with objects
- Prevents spawn camping and immediate re-death

**Reverse Power-Up (Multiplayer):**
- Affects all opponents (not just one target)
- All opponent homing missiles retarget to chase themselves
- 8-second duration

**Disconnect Handling:**
- Player projectiles/effects removed on disconnect
- Active effects on/by disconnected player are cancelled
- Simple cleanup, no persistence

## Technical Architecture

### Unified Network Abstraction

**Key Insight:** Game code always uses NetworkManager interface. Implementation differs by mode.

```
Game.js (mode-agnostic)
    ↓
NetworkManager (interface)
    ↓
    ├─→ LocalNetworkManager (direct calls, local spawning)
    └─→ SocketNetworkManager (websockets to server)
```

**Benefits:**
- Game.js has zero mode-specific branching
- Test game logic in local mode (instant)
- Add online later without changing game logic
- Single codebase for all features

### NetworkManager Interface

**Core methods:**
```javascript
// Connection
connect(battleCode, playerName, playerColor) → playerId
disconnect()

// Send events
sendPlayerUpdate(playerId, {x, y, angle, ...})
sendWeaponFire(playerId, {type, x, y, angle})
sendDeath(playerId, killerId)
sendPowerUpPickup(playerId, powerupId)

// Receive events (callbacks)
onPlayerJoined(callback)
onPlayerUpdate(callback)
onWeaponFired(callback)
onPlayerDied(callback)
onPowerUpSpawned(callback)  // Server authoritative
onAsteroidSpawned(callback)  // Server authoritative

// Update loop (spawning for local mode)
update(dt)
```

### Local Mode: "In-Process Server"

**LocalNetworkManager:**
- Implements NetworkManager interface
- Direct function calls (no websockets)
- Runs spawning logic locally
- Broadcasts to local players via callbacks
- Uses `setImmediate()` to maintain async patterns

**Example flow:**
```
Player1.fire() → network.sendWeaponFire()
                 ↓ (immediate callback)
                 → network.onWeaponFired()
                 ↓
                 Player2 creates bullet
```

### Online Mode: Real Server

**SocketNetworkManager:**
- Implements NetworkManager interface
- WebSocket communication via Socket.io
- Server handles spawning
- Broadcasts via server relay

**Example flow:**
```
Player1.fire() → socket.emit('fire-weapon')
                 ↓ (network delay)
                 Server → socket.broadcast()
                 ↓
                 All clients receive → create bullet
```

## Network Model: "Self-Authoritative Hit Detection"

### Core Mechanism

**Each player is authoritative for hits on themselves:**

1. Remote player fires bullet → broadcasts event
2. All clients create bullet and simulate locally
3. Each client checks: "Did this bullet hit ME?"
4. If hit, victim broadcasts: "I died by Player X"
5. Server validates and relays death
6. All clients update scores and respawn

**Why this works:**
- Fair: You hit me on my screen (where I actually was)
- Responsive: No waiting for server validation
- Simple: No complex lag compensation needed
- Believable: Deaths feel right to both players

### Message Flow

```
Client A                    Server                  Client B
  │                           │                        │
  ├─ Fire bullet ────────────→│                        │
  │  {x,y,angle,ts}            ├─ Relay ──────────────→│
  │                            │                        ├─ Create bullet
  │                            │                        ├─ Simulate
  │                            │                        ├─ Check collision
  │                            │                        ├─ Hit detected!
  │                            │←─ I died (A killed) ──┤
  ├←─────────────── Relay ────┤                        │
  ├─ Update score              ├─ Broadcast ──────────→│
  ├─ Respawn B                 │                        ├─ Die & respawn
```

## Synchronization Details

### What is Synchronized

**Perfectly consistent (critical):**
- Player scores (server validated)
- Who is alive/dead (broadcast events)
- Power-up spawns (server/local authoritative)
- Asteroid spawns (server/local authoritative)
- Match outcome

**Eventually consistent (~50-100ms):**
- Player positions (interpolated)
- Active projectiles (simulated)

**Local only (may vary):**
- Particle effects
- Visual feedback
- Animation timing

### Position Updates

**Send rate:** 20 per second (every 50ms)

**Client-side smoothing:**
```
Receive position update → set as target
Each frame: interpolate current toward target
Result: Smooth movement despite discrete updates
```

**Interpolation prevents jitter, extrapolation handles packet loss.**

### Weapon Synchronization

**Timestamp compensation:**
```
Fire event includes game timestamp
Receiving client compensates for latency:
  - Calculate time since fire event
  - Spawn bullet ahead by (speed × time)
  - Appears in "correct" position despite delay
```

**Result:** Bullets feel accurate even with 100ms network delay.

### Shared Entity Spawning

**Power-ups and asteroids MUST be identical across clients:**

**Server/LocalNetworkManager decides:**
- When to spawn (random timer)
- Where to spawn (random position)
- What to spawn (random type/size)

**All clients obey:**
- Create identical entity at broadcast position
- Run identical physics simulation
- Results stay in sync

**Pickup handling:**
- Power-ups have sequence numbers to prevent race conditions
- First client to touch emits pickup event with sequence number
- Server validates (sequence matches?) and broadcasts removal
- All clients remove entity

## Code Structure

### New Files

**spawner.js** (~100 lines)
- PowerUpSpawner class (shared between client and server)
- AsteroidSpawner class
- Used by LocalNetworkManager AND server.js

**network.js** (~300 lines)
- NetworkManager base class (interface)
- LocalNetworkManager (in-process, no websockets)
- SocketNetworkManager (real networking)
- RemotePlayer class (interpolation logic)

**server.js** (~200 lines)
- Express + Socket.io setup
- Battle room management
- Event relay
- Uses spawner.js for authoritative spawning

### Modified Files

**game.js** (~150 lines changes)
- Replace player1/player2 with myPlayers[] and remotePlayers{}
- Use NetworkManager for all actions
- Remove PowerUpManager (replaced by spawner + network events)
- Add mode parameter to constructor
- Fixed canvas size (all players use same dimensions)

**ui.js** (~100 lines changes)
- Add mode selection UI
- Battle code input/display
- Player name always visible (not just in config)
- Connection status & ping indicator display

**index.html** (~50 lines changes)
- Add Socket.io client script tag
- Add mode selection radio buttons
- Battle code input field
- Simplified player config

**settings.js** (minor changes)
- Define fixed CANVAS_WIDTH and CANVAS_HEIGHT constants
- Shared between client and server

### Unchanged Files
- player.js, weapons.js, asteroid.js, particles.js, audio.js, utils.js
- All game logic stays the same!

**Total new code:** ~650 lines

## Implementation Migration Plan

### Phase 1: Create Abstraction (Local Only) - 3-4 hours

**Goal:** Refactor to use NetworkManager while maintaining exact current functionality.

**Tasks:**
1. Create NetworkManager interface
2. Implement LocalNetworkManager
3. Extract spawning to spawner.js
4. Modify game.js to use network.sendPlayerUpdate() etc.
5. Replace direct player2 references with remote player concept
6. Test thoroughly - must work identically to current version

**Success criteria:** Local 2-player game works exactly as before.

### Phase 2: Add Online Infrastructure - 3-4 hours

**Goal:** Create server and online network manager.

**Tasks:**
1. Implement SocketNetworkManager
2. Create server.js with basic relay
3. Server uses spawner.js for authoritative spawning
4. Add mode selector UI
5. Test with localhost server + 2 browser tabs

**Success criteria:** Can connect two clients through local server.

### Phase 2.5: Edge Case Handling - 1-2 hours

**Goal:** Handle disconnect and synchronization edge cases.

**Tasks:**
1. Disconnect cleanup (remove projectiles/effects owned by disconnected player)
2. Sequence numbers for power-up pickups (prevent race conditions)
3. Respawn mechanics (anywhere on map, invulnerable + can't shoot/interact while blinking)
4. Relative timestamp synchronization (compensate for join time differences)

**Success criteria:** Robust handling of disconnects and edge cases.

### Phase 3: Combat & Synchronization - 2-3 hours

**Goal:** Full gameplay working online.

**Tasks:**
1. Implement weapon fire events
2. Add death detection and broadcasting
3. Implement score synchronization
4. Add position interpolation
5. Add timestamp compensation

**Success criteria:** Can play full match online with hits/deaths working.

### Phase 4: Polish & Deploy - 2-3 hours

**Goal:** Production-ready deployment.

**Tasks:**
1. Battle code generation/joining UI
2. Player list display during game
3. Connection status indicators & ping display
4. Deploy to EC2
5. Test with real network latency

**Success criteria:** Smooth gameplay from different locations.

**Total estimated time:** 11-16 hours

## Server Implementation

### Technology
- Node.js + Express (serve static files)
- Socket.io (WebSocket library)
- In-memory state (no database)
- PM2 for process management

### Server Responsibilities

**Minimal relay + authoritative spawning:**

1. Room management (join/leave battles)
2. Relay player positions
3. Relay weapon fire events
4. Validate and relay deaths
5. **Run spawn timers** (power-ups, asteroids)
6. Broadcast spawns to room
7. Handle disconnects (broadcast player-left, clean up projectiles)
8. Clean up empty battles

**Server does NOT:**
- Run game physics
- Detect collisions
- Update bullet positions
- Calculate scores (clients maintain, server relays)

### Server State

```javascript
battles = {
  'GLOBAL': {
    players: { socketId: {name, color, score, alive} },
    spawner: PowerUpSpawner,
    asteroidSpawner: AsteroidSpawner
  },
  'K3X9A2': { ... }
}
```

**Per-battle spawn loops run at 20 FPS.**

## Client Implementation

### Game Loop Changes

**Before (local only):**
```javascript
update(dt) {
  player1.update(dt);
  player2.update(dt);
  powerUpManager.update(dt);  // Spawns locally
  checkCollisions();
}
```

**After (unified):**
```javascript
update(dt) {
  // Update my controlled players
  myPlayers.forEach(p => {
    p.update(dt);
    network.sendPlayerUpdate(p.id, p.serialize());
  });
  
  // Update network (spawns in local mode, no-op in online mode)
  network.update(dt);
  
  // Update remote players (interpolation)
  remotePlayers.forEach(p => p.updateInterpolated(dt));
  
  // Check collisions (same for all)
  checkCollisions();
}
```

**In local mode:** myPlayers = [P1, P2], remotePlayers = []
**In online mode:** myPlayers = [P1], remotePlayers = [P2, P3, ...]

### Remote Player Interpolation

```javascript
class RemotePlayer {
  onNetworkUpdate(data) {
    this.targetPos = {x: data.x, y: data.y, angle: data.angle};
  }
  
  update(dt) {
    // Smooth interpolation toward target
    this.displayPos.x += (this.targetPos.x - this.displayPos.x) * 0.3;
    this.displayPos.y += (this.targetPos.y - this.displayPos.y) * 0.3;
    // Smooth angle interpolation (handle wrapping)
  }
  
  draw(ctx) {
    // Draw at smoothed position
  }
}
```

## Deployment

### EC2 Setup

```bash
# Install Node.js & dependencies
npm install express socket.io

# Run with PM2
pm2 start server.js --name neon-dogfight
pm2 save

# Open firewall for port 3000
# Configure nginx reverse proxy (optional)
```

### Environment
- No environment variables required
- Configuration in settings.js (shared with client)
- State is ephemeral (restart = clean slate, acceptable for hobby project)

## Testing Strategy

### Local Testing
1. Refactor to NetworkManager → test local mode works
2. Run server.js on localhost → test with 2 browser tabs
3. Add artificial lag → test interpolation
4. Test all power-ups, weapons, edge cases

### Remote Testing
1. Deploy to EC2
2. Test from multiple locations/networks
3. Verify smooth gameplay at 50-100ms latency
4. Tune interpolation parameters if needed

## Performance Expectations

### Server Load
- 10 players per battle: ~20 KB/sec bandwidth, <1% CPU
- Expected usage: 5-10 concurrent battles (hobby project scale)
- t2.micro more than sufficient

### Network Requirements
- <50ms latency = excellent, <150ms = playable
- ~2 KB/sec per player (minimal bandwidth)

## Known Behaviors

### Expected "Quirks"
- Remote players may be ±30 pixels off between screens (interpolation hides this)
- Occasional controversial hit (~5% of cases) - victim's view is authoritative
- Brief position snap on disconnect/reconnect

### Why These Are Acceptable
- Fast gameplay masks position uncertainty
- Quick respawns minimize frustration
- Visual effects (glow, particles) hide deviations
- Arcade game feel embraces chaos
- Trust-based system (friends-only, no anti-cheat needed)

## Key Decisions Summary

### Architecture: Unified with Interface Abstraction
- Single game logic, multiple network backends
- Local mode = no websockets, direct calls
- Online mode = Socket.io websockets
- Spawning logic shared between client and server

### Synchronization: Client-Side Simulation
- Each client simulates all weapons
- Self-authoritative hit detection
- Server validates deaths (basic checks only)
- Server spawns shared entities (power-ups, asteroids)

### Not Chosen
- ❌ Full server authority (too much lag)
- ❌ Lockstep simulation (input delay)
- ❌ Peer-to-peer WebRTC (complexity)
- ❌ Mode-specific branching in game code

## Migration Checklist

### Phase 1: Abstraction Layer ✅
- [x] Create NetworkManager interface
- [x] Extract spawning logic to spawner.js
- [x] Implement LocalNetworkManager
- [x] Refactor game.js to use NetworkManager
- [x] Replace player1/player2 with myPlayers[]/remotePlayers{}
- [x] Test local mode (must work identically)

### Phase 2: Online Implementation
- [ ] Implement SocketNetworkManager
- [ ] Create server.js (relay + spawner integration)
- [ ] Add mode selector to UI
- [ ] Add battle code UI
- [ ] Test with localhost server

### Phase 2.5: Edge Cases
- [ ] Disconnect cleanup (remove player projectiles/effects)
- [ ] Power-up sequence numbers (prevent pickup race conditions)
- [ ] Respawn mechanics (invulnerability, no shoot/interact)
- [ ] Relative timestamp synchronization

### Phase 3: Refinement
- [ ] Add position interpolation
- [ ] Add timestamp compensation for weapons
- [ ] Add connection status & ping indicator UI

### Phase 4: Deployment
- [ ] Deploy server.js to EC2
- [ ] Test with real network latency
- [ ] Tune interpolation parameters
- [ ] Document server setup

## Server Message Protocol

### Socket.io Events

**Client → Server:**
- `join-battle` {battleCode, name, color}
- `player-update` {x, y, angle, alive, shields, ...}
- `fire-weapon` {type, x, y, angle, timestamp}
- `i-died` {killerId}
- `pickup-powerup` {powerupId, seq}

**Server → Client:**
- `game-state` {players, powerups, asteroid, serverTime} (on join)
- `player-joined` {id, name, color}
- `player-update` {id, x, y, angle, ...}
- `weapon-fired` {ownerId, type, x, y, angle, timestamp}
- `player-died` {victimId, killerId}
- `powerup-spawned` {id, x, y, type, seq}
- `powerup-collected` {id, playerId}
- `asteroid-spawned` {id, x, y, vx, vy, size, points}
- `player-left` {id}

### Update Rates
- Player positions: 20/sec (50ms interval)
- Weapons/deaths: immediate (event-based)
- Server spawns: immediate broadcast

## Implementation Notes

### Shared Spawning Logic

**Critical:** Server and LocalNetworkManager use identical spawning code.

```javascript
// spawner.js - used by both!
class PowerUpSpawner {
  update(dt, onSpawn) {
    if (shouldSpawn()) {
      onSpawn({
        id: generateId(),
        seq: 0,  // Sequence number for pickup validation
        type: randomType(),
        x: randomX(),
        y: randomY()
      });
    }
  }
}

// LocalNetworkManager
spawner.update(dt, (powerup) => {
  this._onPowerUpSpawned(powerup);
});

// server.js
spawner.update(dt, (powerup) => {
  io.to(battleCode).emit('powerup-spawned', powerup);
});
```

**Guarantees:** Same spawn behavior in local and online modes.

### Timestamp Compensation

**For accurate weapon placement despite lag:**

```javascript
// Use relative timestamps (compensate for different join times)
// Server provides joinTimestamp on connection
// Client: serverGameTime = localGameTime + joinTimestamp

// Sender includes relative timestamp
emit('fire-weapon', {x, y, angle, timestamp: serverGameTime});

// Receiver compensates
latency = myServerGameTime - data.timestamp;
adjustedX = data.x + cos(angle) * speed * latency;
createBullet(adjustedX, adjustedY, angle);
```

Makes bullets appear where they "should be" given the delay.

### Position Interpolation

**For smooth remote player movement:**

```javascript
onNetworkUpdate(data) {
  remotePlayer.target = data; // Where they are
}

update(dt) {
  // Smoothly move toward target
  remotePlayer.display.x += (target.x - display.x) * 0.3;
  remotePlayer.display.y += (target.y - display.y) * 0.3;
}

draw() {
  drawAt(remotePlayer.display); // Use smoothed position
}
```

Hides network jitter, creates smooth motion.

## Success Criteria

### Feels Good If:
- ✅ Own ship responds instantly (zero perceived lag)
- ✅ Remote players move smoothly (no teleporting)
- ✅ Hits feel fair (>90% agreement between players)
- ✅ Scores always match
- ✅ Can play enjoyable 1v1 match

### Acceptable Quirks:
- ⚠️ Occasional position uncertainty (±30px)
- ⚠️ Rare "phantom hit" edge cases (<5%)
- ⚠️ Brief desync on power-up pickup (resolves quickly)

## Resources Required

### Development
- 10-14 hours implementation time
- 2-3 hours testing and tuning

### Hosting
- EC2 instance (existing)
- ~2 MB/sec bandwidth per 100 battles
- Minimal CPU/memory
- Node.js + PM2

### Maintenance
- Server restart on updates (acceptable, no persistence)
- No database to maintain
- Minimal monitoring needed

---

**This architecture provides clean code separation, maximum reusability, and smooth gameplay across both local and online modes.**
