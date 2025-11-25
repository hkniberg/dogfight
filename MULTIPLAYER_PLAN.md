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
- **Fixed map size:** All players use same canvas dimensions (required for consistent wrapping behavior)
- **Win condition:** First to 3 points (matches local mode)

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
- First to 3 points wins the match (same as local mode)
- In free-for-all, killing anyone counts toward your score

**Respawn Mechanics:**
- Spawn at random location (no safe-spawn validation initially)
- 3 seconds of invulnerability (blinking effect) - applies to ALL game modes
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

### Position & State Updates

**Hybrid Approach (Optimal for Deterministic Movement):**

**State Change Events (Immediate):**
- Speed changes, turn state changes → broadcast immediately
- Low bandwidth (~1-5 events per player per second)
- Allows clients to extrapolate position deterministically

**Position Corrections (20 Hz):**
- Periodic position updates every 50ms
- Prevents drift from simulation differences
- Gently corrects extrapolated positions

**Result:** Immediate response to state changes + self-correcting position sync

### Weapon Synchronization

**Timestamp System:**
- Game time = milliseconds since match started
- Host sends initial sync timestamp when client joins
- All events include relative game timestamp

**Latency Compensation:**
- Fire events broadcast immediately with timestamp
- Receiving clients calculate: latency = myGameTime - eventTimestamp
- Spawn projectile ahead by (speed × latency) to show correct position
- Lasers/bullets calculated deterministically on each client

**Result:** Weapons feel accurate despite network delay

### Shared Entity Spawning

**Power-ups and asteroids MUST be identical across clients:**

**Host/LocalNetworkManager decides:**
- When to spawn (random timer)
- Where to spawn (random position)
- What to spawn (random type/size)
- Broadcasts spawn event with timestamp

**All clients:**
- Create identical entity from spawn data
- Compensate for latency using spawn timestamp
- Run identical physics simulation
- Results stay in sync

**Pickup handling:**
- Client picks up → sends pickup event
- Host validates (does power-up still exist?) and broadcasts removal
- Race conditions rare (~<1% of pickups), acceptable for now
- Can add sequence numbers later if needed

**Shrapnel:**
- Treated like bullets (deterministic simulation on each client)
- Host broadcasts shrapnel spawn with positions and velocities

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

**game.js**
- Replace player1/player2 with myPlayers[] and remotePlayers{}
- Use NetworkManager for all actions
- Remove PowerUpManager (replaced by spawner + network events)
- Add mode parameter to constructor
- Fixed canvas size (all players use same dimensions)

**ui.js**
- Add mode selection UI
- Battle code input/display
- Player name always visible (not just in config)
- Connection status & ping indicator display

**index.html**
- Add PeerJS client script tag
- Add mode selection radio buttons
- Battle code input/display field
- Host/Join UI elements
- Simplified player config

**settings.js**
- Define fixed CANVAS_WIDTH and CANVAS_HEIGHT constants
- Shared between all clients (ensures consistent wrapping behavior)

### Unchanged Files
- player.js, weapons.js, asteroid.js, particles.js, audio.js, utils.js
- All game logic stays the same!

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

**Goal:** Handle disconnect and basic synchronization edge cases.

**Tasks:**
1. Disconnect cleanup (remove projectiles/effects owned by disconnected player)
2. Respawn mechanics (random spawn, 3s invulnerable + can't shoot/interact)
3. Timestamp synchronization (milliseconds since match start)
4. Test edge cases and add fixes as needed (YAGNI principle)

**Success criteria:** Stable multiplayer with basic edge case handling.

### Phase 3: Polish & Optimization

**Goal:** Smooth, responsive gameplay.

**Tasks:**
1. Add state change events (speed/turn changes broadcast immediately)
2. Implement extrapolation (predict remote player positions based on state)
3. Add position correction blending
4. Tune smoothing parameters based on testing
5. Add connection status & ping indicator UI

**Success criteria:** Smooth, responsive gameplay with minimal perceived lag.

### Phase 4: Deploy 

**Goal:** Production-ready deployment.

**Tasks:**
1. Polish battle code UI (copy button, visual styling)
2. Player list display during game
3. *Optional:* Deploy self-hosted signaling server (Fly.io/Railway free tier)
4. Test with real network latency from different locations
5. Deploy static files to GitHub Pages or Vercel

**Success criteria:** Smooth gameplay from different locations, P2P connections work reliably. 

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

**Implementation:** Express + PeerJS Server library (~50 lines)
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

**Implementation:**
- Host instantiates spawner classes
- Runs spawn timers in update loop
- Broadcasts spawn events to all peers
- Relays messages between non-host peers

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

**Unified Structure:**
- `myPlayers[]` - locally controlled players (both in local, one in online)
- `remotePlayers{}` - network-synchronized remote players (none in local)
- `network.update(dt)` - runs spawning if local/host, no-op if client
- All collision detection runs locally on each client

**Mode Differences:**
- **Local mode:** myPlayers = [P1, P2], remotePlayers = []
- **Online (host):** myPlayers = [P1], remotePlayers = [P2, P3, ...], runs spawning
- **Online (client):** myPlayers = [P1], remotePlayers = [P2, P3, ...], no spawning

### Remote Player Movement Prediction

**Extrapolation (Predict Based on State):**
- State changes (speed/turn) received immediately
- Each client simulates remote player movement deterministically
- Periodic position corrections prevent drift
- Remote players appear ~50ms closer to actual position vs interpolation

**Phase 2:** Basic position updates (20 Hz) with simple smoothing
**Phase 3:** Add state change events + extrapolation for responsive feel

## Deployment

### Option 1: Use Free PeerJS Cloud (Quickest)

**No deployment needed!** Use the free PeerJS cloud service.

**Pros:** Zero setup, instant start
**Cons:** Unreliable (community service, no guarantees)

### Option 2: Self-Host Signaling Server (Recommended)

**Hosting Options:**
- Fly.io free tier
- Railway free tier
- Glitch free tier

**Requirements:**
- Express + PeerJS Server library
- No database or configuration needed
- State is ephemeral (restart = clean slate)

**Cost:** $0/month within free tiers

### Static File Hosting

**Options:**
- GitHub Pages (free, via gh-pages branch)
- Vercel (free, single command deploy)
- Any static file host

Game client configured to point to signaling server URL or free PeerJS cloud.

### PeerJS Configuration

**Setup:**
- Configure PeerJS to use free cloud or self-hosted signaling server
- Generate battle codes from peer IDs
- Host listens for incoming connections
- Clients connect to host using battle code

**Connection Events:**
- `peer.on('connection')` - host receives new player
- `conn.on('open')` - connection established
- `conn.on('data')` - game message received
- `conn.on('close')` - player disconnected

All game data flows through WebRTC data channels (direct P2P).

## Testing Strategy

### Phase 1 Testing
- Refactor to NetworkManager → verify local mode unchanged

### Phase 2 Testing
- Two browser tabs (one host, one client) on same machine
- Use free PeerJS cloud for initial testing
- Verify connection, basic gameplay, disconnect handling

### Phase 3+ Testing
- Two devices on same WiFi network
- Devices on different networks (test NAT traversal)
- Add artificial lag to tune smoothing parameters
- Test all power-ups, weapons, edge cases
- Deploy and test from different locations (50-100ms latency)

## Performance Expectations

### Signaling Server (If Self-Hosted)
- Minimal load: ~0.1 KB/sec per player for heartbeats
- Free tier hosting more than sufficient
- No game data flows through signaling server

### Host Client
- Star topology: relays messages between peers
- Modest bandwidth: ~2 KB/sec per player
- Light CPU load for spawning logic
- Any modern device handles 2-10 players easily

### Network Requirements
- Latency: <50ms excellent, <150ms playable
- Bandwidth: ~2 KB/sec per player (minimal)
- P2P direct connections = lower latency than server relay
- NAT traversal: most networks work, test in Phase 2

## Known Behaviors

### Expected Quirks
- Remote players may be ±30 pixels off between screens (extrapolation hides this)
- Occasional controversial hit - victim's view is authoritative
- Brief position snap on disconnect/reconnect
- **Host disconnect ends the game** (all return to menu)
- Some networks may have NAT/firewall issues (test in Phase 2)

### Why These Are Acceptable
- Fast arcade gameplay masks position uncertainty
- Quick respawns (3s) minimize frustration
- Visual effects hide minor deviations
- Trust-based system (friends-only game)
- Host disconnect rare (friends coordinate)
- YAGNI principle: add fixes only if issues arise during testing

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
- [ ] Respawn mechanics (3s invulnerability, no shoot/interact)
- [ ] Timestamp synchronization (milliseconds since match start)
- [ ] Test edge cases and fix as needed

### Phase 3: Polish & Optimization
- [ ] Add state change events (speed/turn)
- [ ] Implement extrapolation for remote players
- [ ] Add position correction blending
- [ ] Tune smoothing parameters
- [ ] Add connection status & ping indicator UI

### Phase 4: Deploy
- [ ] Polish battle code UI
- [ ] Player list display
- [ ] Optional: Deploy signaling server to Fly.io/Railway
- [ ] Deploy static files to GitHub Pages/Vercel
- [ ] Test from different locations with real network latency

## P2P Message Protocol

### PeerJS Data Channel Messages

All messages are JSON objects sent via `connection.send(msg)`.

**Client → Host:**
- `{type: 'player-joined', id, name, color}` (on connection)
- `{type: 'state-change', id, speed, turnState, x, y, angle, timestamp}` (immediate)
- `{type: 'position-correction', id, x, y, angle, timestamp}` (20 Hz)
- `{type: 'fire-weapon', ownerId, weaponType, x, y, angle, timestamp}` (immediate)
- `{type: 'i-died', victimId, killerId}` (immediate)
- `{type: 'pickup-powerup', playerId, powerupId}` (immediate)

**Host → Client(s):**
- `{type: 'sync-time', gameTime}` (on join)
- `{type: 'game-state', players, powerups, asteroids}` (on join)
- `{type: 'player-joined', id, name, color}` (relay)
- `{type: 'state-change', ...}` (relay)
- `{type: 'position-correction', ...}` (relay)
- `{type: 'weapon-fired', ...}` (relay)
- `{type: 'player-died', victimId, killerId}` (relay)
- `{type: 'powerup-spawned', id, x, y, type, timestamp}` (host authority)
- `{type: 'powerup-removed', id}` (host authority)
- `{type: 'asteroid-spawned', id, x, y, vx, vy, size, points, timestamp}` (host authority)
- `{type: 'player-left', id}` (on disconnect)

### Update Rates
- State changes: immediate (1-5/sec per player)
- Position corrections: 20/sec
- Weapons/deaths: immediate
- Host spawns: immediate
- All data flows through WebRTC data channels (direct P2P)

## Implementation Notes

### Shared Spawning Logic

**Critical:** LocalNetworkManager and PeerNetworkManager (host mode) use identical spawning code.

**spawner.js** contains:
- PowerUpSpawner class with update(dt, onSpawn) callback
- AsteroidSpawner class with same pattern
- Called by LocalNetworkManager OR host client
- Guarantees identical spawn behavior across modes

### Timestamp Compensation

**Game Time Sync:**
- Host tracks: matchStartTime = Date.now()
- Each frame: gameTime = Date.now() - matchStartTime
- Client joins → receives current gameTime → calculates own offset
- All events include gameTime timestamp

**Weapon Placement:**
- Sender includes timestamp with fire event
- Receiver calculates: latency = myGameTime - eventTimestamp
- Spawns projectile ahead by (speed × latency)
- Appears in correct position despite network delay

### Movement Prediction

**Extrapolation Strategy:**
- Remote player state (speed, turnState, angle) received immediately
- Each client simulates remote movement deterministically
- Periodic position corrections prevent drift accumulation
- Smoothing factor blends simulation with corrections

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
