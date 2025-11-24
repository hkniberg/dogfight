# Game Design Document: Neon Dogfight - Infinite Loop

## 1. Executive Summary

Neon Dogfight is a fast-paced, local multiplayer aerial combat game played on a single keyboard. Two players pilot neon-styled jet fighters in a top-down, infinite-wrapping arena. The game combines retro arcade mechanics with tactical depth through a variety of power-ups, environmental hazards, and distinct movement physics.

## 2. Visual & Audio Style

**Aesthetic:** "Neon Arcade." Dark slate background with a faint grid. All entities (planes, bullets, particles) are rendered in bright, glowing neon colors (Cyan vs. Pink defaults).

**Visual Effects:**
- Screen wrapping (seamless transition from one edge to the opposite).
- Particle explosions and debris.
- Shockwaves for heavy explosives.
- Pulsating effects for bombs and invisible players.
- Dynamic shield rings that thicken as shield count increases.

**Audio:** Retro synthesized sound effects for shooting, explosions, power-up pickups, and laser hums.

## 3. Core Gameplay Mechanics

### 3.1. The Arena

**Infinite Loop:** The map has no borders. Flying off the right edge wraps the player to the left edge; flying off the top wraps to the bottom. This applies to planes, projectiles, and asteroids.

**Perspective:** 2D Top-Down.

### 3.2. Player Movement

Unlike traditional analog steering, movement uses **Discrete State Control:**

- **Constant Motion:** Planes are always moving forward; they cannot stop completely.
- **Speed Control:** Players toggle between 5 distinct speed levels.
- **Turning:** There are three turn states:
  - Turning Left
  - Going Straight
  - Turning Right

*Example:* If turning Left, pressing Right once straightens the plane. Pressing Right again begins a Right turn.

### 3.3. Controls (Shared Keyboard)

| Action      | Player 1 | Player 2   |
|-------------|----------|------------|
| Speed Up    | W        | Arrow Up   |
| Speed Down  | S        | Arrow Down |
| Turn Left   | A        | Arrow Left |
| Turn Right  | D        | Arrow Right|
| Fire        | E        | Minus (-)  |

**Additional Controls:**
- **Escape Key:** Return to main menu during gameplay

## 4. Combat & Weapons

### 4.1. Standard Fire

- **Bullets:** Small, fast projectiles.
- **Capacity:** Maximum of 5 active bullets on screen per player at once.
- **Fire Rate:** Unlimited - fire as fast as you press the button (limited only by 5 bullet capacity).
- **Behavior:** Wraps around screen edges. Disappears after traveling a fixed maximum distance.

### 4.2. Collision Rules

- **One-Hit Kill:** Unshielded planes are destroyed immediately upon contact with a bullet, asteroid, bomb explosion, shrapnel, or laser.
- **Head-on Collision:** If two players crash into each other:
  - Both unshielded: Both are destroyed (Draw).
  - Both shielded: Both lose shields and bounce apart (direction reversed).
  - One shielded: Unshielded player dies, shielded player loses shield and bounces away.
- **Asteroid Collision:** Shielded players bounce off asteroids (shield consumed, direction changed away from asteroid).
- **Shrapnel Collision:** Shields block shrapnel damage and player bounces away.

### 4.3. Winning the Round

- **Scoring:** +1 Point for destroying the enemy.
- **Win Condition:** First player to reach 3 Points wins the match.
- **Respawn:** After death, the destroyed player respawns at a random location after a short delay (2 seconds) with 2 seconds of invulnerability.
- **Match End:** When a player wins, losing player does NOT respawn. Winner can continue flying around.
- **Starting Position:** Players start back-to-back at the center of the map, facing away from each other, at the slowest speed level.

## 5. Power-Up System

Power-ups spawn randomly at 1-3 second intervals (up to 5 simultaneous power-ups on map). Picking one up grants an immediate effect or modifies the next attack.

| Icon        | Name            | Type    | Description |
|-------------|-----------------|---------|-------------|
| S (Blue)    | Shield          | Passive | Adds a protective ring. Stacks up to 3 layers. Blocks one instance of damage per layer. When shield breaks from collision, player bounces away. |
| M (Amber)   | Multi-Shot      | Timer   | For 8 seconds, fires 3 projectiles in spread pattern. **Works with ALL weapons** (bullets, missiles, lasers, bombs). |
| H (Red)     | Homing          | Ammo    | Next shot fires homing missile(s) that steer toward enemy. Does 3 damage to asteroids. Cannot track invisible players. **Can hit any player including shooter!** Does not consider edge wrapping when aiming. |
| INV (Grey)  | Invisibility    | Timer   | For 10 seconds, becomes nearly invisible (pulses 0-15% opacity) and untargetable by homing weapons. |
| L (Violet)  | Laser           | Ammo    | Next shot fires 180-pixel beam(s) from ship nose for 5 seconds. Beam follows ship rotation. Wraps around map edges (continues from opposite edge). Blocked and destroyed by asteroids and shields. |
| BOMB (Orange)| Proximity Bomb | Ammo    | Next shot launches pulsating bomb(s). Can be combined with Homing for tracking bombs! |
| REV (Yellow)| Reverse         | Ammo    | Press fire to reverse opponent's controls (8 sec) AND retarget their missiles to chase them! |
| AST (Magenta)| Asteroid Chase | Ammo    | Press fire to make asteroid chase opponent with predictive targeting for 10 seconds! |

### 5.1. Bomb Mechanics

The bomb is a strategic weapon with multiple detonation triggers:

- **Timer:** Explodes automatically after 5 seconds.
- **Proximity:** Explodes if any player gets within close range.
- **Contact:** Explodes if it hits a player or asteroid directly.
- **Remote Detonation:** Can be shot by a bullet to trigger early.

**Effect:** Creates a massive shockwave. Destroys anything in the radius (including the shooter!).

**Homing Bombs:** If you have both Homing and Bomb power-ups, bombs will track the target player! Displayed as "HB" indicator.

### 5.2. Multi-Shot Synergy

Multi-Shot works with ALL weapons, creating devastating combinations:
- **Standard Bullets:** 3 bullets in spread
- **Homing Missiles:** 3 tracking missiles
- **Lasers:** 3 beams from your ship
- **Bombs:** 3 bombs launched
- **Homing Bombs:** 3 tracking bombs (requires Homing + Bomb + Multi-Shot!)

### 5.3. Special Effect Power-Ups

Two power-ups are activated by pressing fire (targeting your opponent):

**Reverse (REV):**
- Reverses opponent's speed and turn controls for 10 seconds
- ALL homing missiles from affected player (both in-flight and newly fired) retarget to chase themselves
- Yellow question mark appears above affected player with pulsing glow

**Asteroid Chase (AST):**
- Asteroid chases opponent for 100 seconds (essentially rest of round) with **predictive targeting** (aims where they'll be, not where they are)
- Asteroid moves at half player max speed (100 pixels/second with default settings)
- Asteroid glows magenta with "!" indicator
- Stops chasing if target dies or invisibility activates
- Does not consider edge wrapping when chasing

## 6. Environmental Hazards

### 6.1. Asteroids

- **Behavior:** Large jagged rocks (random size 30-50 radius) that drift slowly across the map (wrapping edges). Spawn at randomized intervals. Max 1 on screen.
- **Visual Damage:** Each bullet hit creates a visible chunk missing from the asteroid polygon.
- **Destruction:**
  - **Bullets:** Each hit creates damage hole and slightly reduces size. Takes 5 hits to destroy.
  - **Homing Missiles:** Deal 3 damage per hit. Create shrapnel when asteroid destroyed.
  - **Bombs:** Instant destruction. Create shrapnel.
  - **Lasers:** Do NOT damage asteroids but are blocked and destroyed by them.
- **Shrapnel:** When an asteroid is destroyed by explosions, it shatters into 6-10 shrapnel pieces that fly outward rapidly. Shrapnel is lethal to unshielded players (shields block them).

## 7. User Interface (UI)

### 7.1. Main Menu

- **Player Configuration:** Input fields for player names and color selection.
- **Statistics:** Persistent tracking of Player 1 Wins, Player 2 Wins, and Total Rounds played.
- **Reset Stats:** Button to wipe statistics.
- **Controls Reference:** Display of keyboard controls for both players.

### 7.2. In-Game HUD

- **Scoreboard:** Displays current score for P1 and P2 at the top corners in their colors.
- **Target Score:** "First to 3" reminder centered.
- **Visual Indicators (On-Plane):**
  - Amber Wings: Multi-shot active.
  - Red Nose: Homing missile loaded.
  - Violet Center: Laser loaded.
  - "B" or "HB" Text: Bomb loaded (HB = Homing Bomb).
  - "REV" Text (below center): Reverse power-up loaded.
  - "AST" Text (above center): Asteroid Chase loaded.
  - Blue Rings: Shield active (thicker lines for more stacks).
  - Yellow "?" (above head): Under reverse effect.

### 7.3. Game Over

- Displays immediately as overlay on top of continuing gameplay.
- Winner can continue controlling their ship.
- Shows winner's name in their chosen color with glow effects.
- Statistics automatically updated.
- Options to "Play Again" (restart match) or return to "Main Menu".

