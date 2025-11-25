# Neon Dogfight - Multiplayer Implementation Plan

## Overview

Add online multiplayer to Neon Dogfight using a unified architecture where local mode is simply "the server runs in the client." In online mode, we use **peer-to-peer WebRTC** with star topology—one player acts as "host" and handles spawning/relay. This approach maximizes code reuse, maintains clean separation between game logic and networking, and eliminates hosting costs.

## Design Philosophy

**Core Principle:** "Believable Sync over Perfect Sync"

- Prioritize low latency and smooth gameplay
- Accept minor position deviations (±30 pixels)
- Trust clients for their own hit detection (friends-only game)
- **Host player acts as relay + spawning authority** (star topology)
- Works great for fast-paced arcade combat
- **Fixed map size:** All players use same canvas dimensions (laptop-friendly)
- **Win condition:** First to 5 kills (of any player) wins the match

## Game Modes

### 1. Local Multiplayer
- 2 players on one keyboard (current implementation)
- NetworkManager runs in-process (no websockets)
- Zero network overhead

### 2. Online Free-For-All
- *[Future Enhancement]*
- Public lobby where players can find each other
- Could use known peer ID or lobby service
- 2-10 players per arena

### 3. Online Private Battle
- Host creates room, gets battle code (their peer ID)
- Share code with friends to invite
- Friends enter code to connect directly via P2P
- 2-10 players per battle
- First player = host (runs spawning authority)

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
- **Host disconnect ends game** (all return to menu)
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
    └─→ PeerNetworkManager (WebRTC P2P, star topology)
```

**Benefits:**
- Game.js has zero mode-specific branching
- Test game logic in local mode (instant)
- Add online later without changing game logic
- Single codebase for all features
- Zero bandwidth costs (P2P direct connections)

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

### Online Mode: Peer-to-Peer (Star Topology)

**PeerNetworkManager:**
- Implements NetworkManager interface
- WebRTC data channels via PeerJS
- **Host client handles spawning** (first player in room)
- Host relays messages between peers

**Star Topology:**
```
        Host (Player 1)
       /    |    \
      /     |     \
   P2      P3      P4
```

**Example flow (host fires):**
```
Host.fire() → host.broadcast()
              ↓ (direct P2P)
              All peers receive → create bullet
```

**Example flow (client fires):**
```
Client2.fire() → send to host
                 ↓ (direct P2P)
                 Host receives → relay to others
                 ↓
                 Client1, Client3, Client4 → create bullet
```

## Network Model: "Self-Authoritative Hit Detection"

### Core Mechanism

**Each player is authoritative for hits on themselves:**

1. Remote player fires bullet → broadcasts event
2. All clients create bullet and simulate locally
3. Each client checks: "Did this bullet hit ME?"
4. If hit, victim broadcasts: "I died by Player X"
5. Host validates and relays death (basic checks only)
6. All clients update scores and respawn

**Why this works:**
- Fair: You hit me on my screen (where I actually was)
- Responsive: No waiting for validation
- Simple: No complex lag compensation needed
- Believable: Deaths feel right to both players
- Low latency: P2P direct connections minimize delay

### Message Flow

```
Client A (Host)             Client B              Client C
  │                           │                      │
  ├─ Fire bullet ────────────→│                      │
  │  {x,y,angle,ts}            ├─ Create bullet      │
  ├───────────────────────────┼─────────────────────→│
  │                            │                      ├─ Create bullet
  │                            ├─ Simulate            ├─ Simulate
  │                            ├─ Check collision     ├─ Check collision
  │                            ├─ Hit detected!       │
  │←─ I died (A killed) ──────┤                      │
  ├─ Update score              │                      │
  ├───────────────────────────┼─────────────────────→│
  │                            ├─ Die & respawn       ├─ Update score
  ├─ Respawn B                 │                      │
```

**Note:** Host broadcasts directly to all peers. Non-host messages go through host relay.

## Synchronization Details

### What is Synchronized

**Perfectly consistent (critical):**
- Player scores (host validated)
- Who is alive/dead (broadcast events)
- Power-up spawns (host/local authoritative)
- Asteroid spawns (host/local authoritative)
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

**Host/LocalNetworkManager decides:**
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
- Host validates (sequence matches?) and broadcasts removal
- All clients remove entity

## Code Structure

### New Files

**spawner.js** 
- PowerUpSpawner class (shared between modes)
- AsteroidSpawner class
- Used by LocalNetworkManager AND host clients

**network.js**
- NetworkManager base class (interface)
- LocalNetworkManager (in-process, no networking)
- PeerNetworkManager (WebRTC P2P with star topology)
- RemotePlayer class (interpolation logic)
- Host/client role management

**signaling-server.js**  *[Optional: self-hosted]*
- Minimal PeerJS signaling server
- Express + peer library
- No game logic, just WebRTC signaling
- Can use free Fly.io/Railway tier

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
- Add PeerJS client script tag
- Add mode selection radio buttons
- Battle code input/display field
- Host/Join UI elements
- Simplified player config

**settings.js** (minor changes)
- Define fixed CANVAS_WIDTH and CANVAS_HEIGHT constants
- Shared between client and server

### Unchanged Files
- player.js, weapons.js, asteroid.js, particles.js, audio.js, utils.js
- All game logic stays the same!

**Total new code:** ~600 lines
**Optional signaling server:** ~50 lines (can use free PeerJS cloud instead)

## Implementation Migration Plan

### Phase 1: Create Abstraction (Local Only)

**Goal:** Refactor to use NetworkManager while maintaining exact current functionality.

**Tasks:**
1. Create NetworkManager interface
2. Implement LocalNetworkManager
3. Extract spawning to spawner.js
4. Modify game.js to use network.sendPlayerUpdate() etc.
5. Replace direct player2 references with remote player concept
6. Test thoroughly - must work identically to current version

**Success criteria:** Local 2-player game works exactly as before.

### Phase 2: Add Online Infrastructure 

**Goal:** Create P2P network manager with star topology.

**Tasks:**
1. Implement PeerNetworkManager (host + client roles)
2. Add PeerJS library integration
3. Implement host selection (first player = host)
4. Host uses spawner.js for authoritative spawning
5. Add mode selector UI (Local / Host Online / Join Online)
6. Add battle code generation/input UI
7. Test with 2 browser tabs (one host, one client)

**Success criteria:** Can connect two clients via P2P (using free PeerJS cloud or self-hosted).

### Phase 2.5: Edge Case Handling 

**Goal:** Handle disconnect and synchronization edge cases.

**Tasks:**
1. Disconnect cleanup (remove projectiles/effects owned by disconnected player)
2. Sequence numbers for power-up pickups (prevent race conditions)
3. Respawn mechanics (anywhere on map, invulnerable + can't shoot/interact while blinking)
4. Relative timestamp synchronization (compensate for join time differences)

**Success criteria:** Robust handling of disconnects and edge cases.

### Phase 3: Combat & Synchronization 

**Goal:** Full gameplay working online.

**Tasks:**
1. Implement weapon fire events
2. Add death detection and broadcasting
3. Implement score synchronization
4. Add position interpolation
5. Add timestamp compensation

**Success criteria:** Can play full match online with hits/deaths working.

### Phase 4: Polish & Deploy 

**Goal:** Production-ready deployment.

**Tasks:**
1. Polish battle code UI (copy button, visual styling)
2. Player list display during game
3. Connection status indicators & ping display
4. *Optional:* Deploy self-hosted signaling server (Fly.io/Railway free tier)
5. Test with real network latency from different locations
6. Deploy static files to GitHub Pages or Vercel

**Success criteria:** Smooth gameplay from different locations, P2P connections work reliably.

**Total estimated time:** 

## P2P Architecture Details

### Signaling Server (Optional Self-Hosted)

**Technology:**
- Node.js + Express (minimal)
- PeerJS Server library
- No game logic, just WebRTC signaling
- Free tier hosting (Fly.io, Railway, Glitch)

**Signaling Server Responsibilities:**
1. Register peer IDs (give each client an ID)
2. Relay WebRTC connection info between peers
3. Keep heartbeat connections alive

**Signaling Server does NOT:**
- Handle game data
- Run game logic
- Relay game messages (P2P is direct!)
- Spawn entities

**Example signaling-server.js:**
```javascript
const express = require('express');
const { ExpressPeerServer } = require('peer');

const app = express();
const server = app.listen(9000);

app.use('/peerjs', ExpressPeerServer(server, {
  path: '/neon-dogfight'
}));

console.log('Signaling server running on port 9000');
```

**Cost:** $0/month on free tiers (Fly.io, Railway, Glitch)

### Host Client Responsibilities

**The first player to create a room becomes the "host":**

1. Run spawn timers (power-ups, asteroids)
2. Broadcast spawns to all connected peers
3. Relay messages between non-host peers
4. Validate deaths (basic checks)
5. Handle peer disconnects

**Host does NOT:**
- Run game physics (each client does their own)
- Detect collisions (self-authoritative)
- Calculate scores (each client maintains)

**Example host state:**
```javascript
class PeerNetworkManager {
  constructor(isHost) {
    this.isHost = isHost;
    this.peers = new Map(); // peerId → connection
    
    if (isHost) {
      this.spawner = new PowerUpSpawner();
      this.asteroidSpawner = new AsteroidSpawner();
    }
  }
  
  update(dt) {
    if (this.isHost) {
      // Host runs spawning
      this.spawner.update(dt, (powerup) => {
        this.broadcast({ type: 'spawn-powerup', powerup });
      });
    }
  }
  
  broadcast(msg, excludePeer = null) {
    // Send to all connected peers
    this.peers.forEach((conn, peerId) => {
      if (peerId !== excludePeer) {
        conn.send(msg);
      }
    });
  }
}
```

**Per-room spawn loops run at 20 FPS on host client.**

### P2P Topology Choice: Star vs Mesh

**Star Topology (Chosen):**
```
Host ←→ Client1
 ↕
Client2 ←→ Client3 (through host)
```
- Each peer connects only to host
- Host relays messages between clients
- Simple connection management
- Clear authority (host)
- 10 players = 9 connections (all on host)

**Full Mesh (Not Chosen):**
```
P1 ←→ P2 ←→ P3
 ↕  ✖  ↕
P4 ←→ P5 ←→ P6
```
- Each peer connects to ALL others
- No relay needed (direct messages)
- Lower latency between non-host peers
- 10 players = 45 total connections (9 per client)
- Complex connection management

**Why Star for This Project:**
- Simpler code (mirrors original server architecture)
- Fewer total connections for small games
- Clear spawning authority
- Easier disconnect handling
- Works great for 2-10 players

### Host Disconnect Handling

**Simple Approach (Phase 1):**
- Host disconnect = game ends
- All clients return to menu
- Players create new room with different host

**Why This Is Acceptable:**
- Friends coordinate who hosts
- Matches are short (5-10 minutes)
- Host disconnect is rare
- Simpler code = faster implementation

**Optional: Host Migration (Future Enhancement):**
- When host disconnects, elect new host
- Transfer spawning authority
- Migrate peer connections
- Adds complexity, defer to Phase 5+

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
  
  // Update network (spawns in local/host mode, no-op for non-host clients)
  network.update(dt);
  
  // Update remote players (interpolation)
  remotePlayers.forEach(p => p.updateInterpolated(dt));
  
  // Check collisions (same for all)
  checkCollisions();
}
```

**In local mode:** myPlayers = [P1, P2], remotePlayers = []
**In online mode (host):** myPlayers = [P1], remotePlayers = [P2, P3, ...], runs spawning
**In online mode (client):** myPlayers = [P1], remotePlayers = [P2, P3, ...], no spawning

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

### Option 1: Use Free PeerJS Cloud (Quickest)

**No deployment needed!** Just use the free PeerJS cloud:
```javascript
const peer = new Peer(); // Connects to 0.peerjs.com
```

**Pros:** Zero setup, instant start
**Cons:** Unreliable (community service, no guarantees)

### Option 2: Self-Host Signaling Server (Recommended)

**Fly.io Free Tier:**
```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Create signaling-server.js (see code above)
npm init -y
npm install express peer

# Deploy
fly launch
fly deploy
```

**Railway Free Tier:**
```bash
# Push to GitHub
git add signaling-server.js package.json
git commit -m "Add signaling server"

# Deploy via Railway dashboard
# Connect GitHub repo, auto-deploys
```

**Cost:** $0/month within free tiers

### Static File Hosting

**GitHub Pages (Free):**
```bash
# Push game files to gh-pages branch
git checkout -b gh-pages
git push origin gh-pages
```

**Vercel (Free):**
```bash
vercel --prod
```

### Environment
- Signaling server needs no configuration
- Game client points to signaling server URL:
  ```javascript
  const peer = new Peer({
    host: 'your-app.fly.dev',
    port: 443,
    path: '/peerjs'
  });
  ```
- No database required
- State is ephemeral (restart = clean slate)

### PeerJS Configuration

**Client-side initialization:**
```javascript
// Option 1: Free PeerJS cloud (testing/prototype)
const peer = new Peer();

// Option 2: Self-hosted signaling server (production)
const peer = new Peer({
  host: 'your-app.fly.dev',
  port: 443,
  path: '/peerjs',
  secure: true
});

// Optional: Custom peer ID (for battle codes)
const peer = new Peer('battle-code-abc123', {
  host: 'your-app.fly.dev',
  port: 443,
  path: '/peerjs',
  secure: true
});
```

**Connection handling:**
```javascript
// Host: Listen for incoming connections
peer.on('connection', (conn) => {
  console.log('New player connected:', conn.peer);
  setupPeerHandlers(conn);
});

// Client: Connect to host
const conn = peer.connect('host-peer-id');
conn.on('open', () => {
  console.log('Connected to host!');
  conn.send({ type: 'player-joined', name: 'Bob', color: 'pink' });
});

conn.on('data', (data) => {
  // Handle incoming game messages
  handleGameMessage(data);
});

conn.on('close', () => {
  console.log('Disconnected from host');
  handleDisconnect();
});
```

## Testing Strategy

### Local Testing
1. Refactor to NetworkManager → test local mode works
2. Test P2P with 2 browser tabs (same machine)
   - One tab as host, one as client
   - Can use free PeerJS cloud for testing
3. Add artificial network lag → test interpolation
4. Test all power-ups, weapons, edge cases
5. Test host disconnect scenario

### Remote Testing
1. Test with 2 devices on same WiFi network
2. Test with devices on different networks (cellular + WiFi)
3. Deploy signaling server if using self-hosted
4. Deploy static files to hosting
5. Verify smooth gameplay at 50-100ms latency
6. Tune interpolation parameters if needed
7. Test NAT traversal (most networks should work, ~90-95% success rate)

## Performance Expectations

### Signaling Server Load (If Self-Hosted)
- Connection setup: ~15 KB per player
- Ongoing heartbeat: ~0.1 KB/sec per player
- 100 concurrent players: ~10 KB/sec total
- Minimal CPU/memory usage
- Free tier hosting more than sufficient

### Host Client Load
- Star topology: Host relays messages between peers
- 10 players: ~2 KB/sec × 9 connections = 18 KB/sec
- Modest CPU for spawning logic
- Any modern device can handle it

### Network Requirements
- <50ms latency = excellent, <150ms = playable
- ~2 KB/sec per player (minimal bandwidth)
- P2P direct connection = lower latency than relay server
- NAT traversal works for ~90-95% of networks

## Known Behaviors

### Expected "Quirks"
- Remote players may be ±30 pixels off between screens (interpolation hides this)
- Occasional controversial hit (~5% of cases) - victim's view is authoritative
- Brief position snap on disconnect/reconnect
- **Host disconnect ends the game** (all players return to menu)
- NAT/firewall issues for ~5-10% of networks (P2P can't connect)

### Why These Are Acceptable
- Fast gameplay masks position uncertainty
- Quick respawns minimize frustration
- Visual effects (glow, particles) hide deviations
- Arcade game feel embraces chaos
- Trust-based system (friends-only, no anti-cheat needed)
- Host disconnect is rare (friends coordinate who hosts)
- Failed P2P connections can retry or use different network

## Key Decisions Summary

### Architecture: Unified with Interface Abstraction
- Single game logic, multiple network backends
- Local mode = no networking, direct calls
- Online mode = WebRTC P2P (PeerJS)
- Star topology = one host client acts as relay/authority
- Spawning logic shared between local and host modes

### Synchronization: Client-Side Simulation
- Each client simulates all weapons
- Self-authoritative hit detection
- Host validates deaths (basic checks only)
- Host spawns shared entities (power-ups, asteroids)

### Why P2P Instead of Server
- ✅ Zero bandwidth costs (data goes directly between players)
- ✅ Lower latency (no server hop)
- ✅ Free/cheap hosting (signaling server is minimal)
- ✅ Works great for 2-10 players
- ✅ Simple star topology mimics server architecture

### Not Chosen
- ❌ Full server authority (too much lag + hosting costs)
- ❌ Lockstep simulation (input delay)
- ❌ Full mesh P2P (too many connections, more complex)
- ❌ Dedicated game server relay (unnecessary costs for hobby project)
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
- [ ] Implement PeerNetworkManager (host + client roles)
- [ ] Add PeerJS library integration
- [ ] Implement host spawning logic
- [ ] Implement message relay for host
- [ ] Add mode selector to UI (Local / Host / Join)
- [ ] Add battle code generation/input UI
- [ ] Test with 2 browser tabs (one host, one client)

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
- [ ] Deploy static files to GitHub Pages/Vercel
- [ ] Optional: Deploy signaling server to Fly.io/Railway
- [ ] Test with real network latency from different locations
- [ ] Verify NAT traversal success rate
- [ ] Tune interpolation parameters
- [ ] Document deployment setup

## P2P Message Protocol

### PeerJS Data Channel Messages

All messages are JSON objects sent via `connection.send(msg)`.

**Client → Host:**
- `{type: 'player-joined', id, name, color}` (on connection)
- `{type: 'player-update', id, x, y, angle, alive, shields, ...}`
- `{type: 'fire-weapon', ownerId, weaponType, x, y, angle, timestamp}`
- `{type: 'i-died', victimId, killerId}`
- `{type: 'pickup-powerup', playerId, powerupId, seq}`

**Host → Client(s):**
- `{type: 'game-state', players, powerups, asteroids}` (on join)
- `{type: 'player-joined', id, name, color}` (relay to others)
- `{type: 'player-update', id, x, y, angle, ...}` (relay)
- `{type: 'weapon-fired', ownerId, weaponType, x, y, angle, timestamp}` (relay)
- `{type: 'player-died', victimId, killerId}` (relay)
- `{type: 'powerup-spawned', id, x, y, type, seq}` (host authority)
- `{type: 'powerup-collected', id, playerId}` (relay)
- `{type: 'asteroid-spawned', id, x, y, vx, vy, size, points}` (host authority)
- `{type: 'player-left', id}` (when peer disconnects)

### Update Rates
- Player positions: 20/sec (50ms interval)
- Weapons/deaths: immediate (event-based)
- Host spawns: immediate broadcast
- All data flows through WebRTC data channels (direct P2P)

## Implementation Notes

### Shared Spawning Logic

**Critical:** LocalNetworkManager and PeerNetworkManager (host mode) use identical spawning code.

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

// LocalNetworkManager (local 2-player)
spawner.update(dt, (powerup) => {
  this._onPowerUpSpawned(powerup);
});

// PeerNetworkManager (host in P2P)
if (this.isHost) {
  spawner.update(dt, (powerup) => {
    // Broadcast to all connected peers
    this.broadcast({ type: 'powerup-spawned', powerup });
    // Also spawn locally for host
    this._onPowerUpSpawned(powerup);
  });
}
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

## P2P vs Traditional Server: Comparison

### What Changes from Original Plan

**Same:**
- ✅ NetworkManager interface (game code unchanged)
- ✅ Self-authoritative hit detection
- ✅ Client-side simulation
- ✅ Position interpolation
- ✅ Timestamp compensation
- ✅ All game logic and mechanics

**Different:**
- 🔄 Server.js → Host client (star topology)
- 🔄 Socket.io → PeerJS (WebRTC)
- 🔄 Dedicated server → P2P connections
- 🔄 Server spawning → Host client spawning

### Benefits of P2P Approach

**Cost:**
- Original: $8-15/month for EC2
- P2P: $0/month (free tier signaling)
- Savings: ~$100-180/year

**Latency:**
- Original: Client → Server → Client (2 hops)
- P2P: Client → Client (1 hop, direct)
- Improvement: ~20-50ms lower latency

**Bandwidth:**
- Original: Server pays for all game traffic
- P2P: Players' own bandwidth (direct connections)
- Server only handles signaling (~1000x less data)

**Scalability:**
- Original: Server bandwidth scales with users
- P2P: Each room is independent, no server load

### Trade-offs

**Original Server Advantages:**
- ✅ Works for 100% of networks (no NAT issues)
- ✅ Host migration easier
- ✅ Can add server-side features (replays, spectating)
- ✅ More "professional" architecture

**P2P Advantages:**
- ✅ Zero hosting costs
- ✅ Lower latency (direct connections)
- ✅ Infinite scalability (no server bottleneck)
- ✅ Simple deployment (static files + tiny signaling server)

**For a hobby game with friends (2-10 players), P2P is clearly superior.**

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

### Hosting
**Option 1: Free PeerJS Cloud**
- Cost: $0/month
- Reliability: Low (community service)

**Option 2: Self-Hosted Signaling (Recommended)**
- Cost: $0/month (free tiers)
- Fly.io, Railway, or Glitch
- Static files: GitHub Pages or Vercel (free)
- Minimal CPU/memory/bandwidth

**No game server bandwidth costs** - data flows P2P!

### Maintenance
- Signaling server needs no updates (just keeps running)
- Static file updates via git push
- No database to maintain
- No game server to monitor
- Minimal operational overhead

---

**This architecture provides clean code separation, maximum reusability, zero hosting costs, and smooth gameplay across both local and online modes.**
