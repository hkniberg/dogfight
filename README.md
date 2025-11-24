# Neon Dogfight - Infinite Loop

A fast-paced, local multiplayer aerial combat game built with HTML5 Canvas. Two players pilot neon-styled jet fighters in a top-down, infinite-wrapping arena.

## How to Play

1. Open `index.html` in a modern web browser (Chrome, Firefox, Edge, Safari)
2. Configure player names and colors in the main menu
3. Adjust game speed if desired (Normal, Turbo, or Slow Motion)
4. Click "START GAME" to begin
5. First player to 3 kills wins the match!

## Controls

### Player 1 (Left Side - Cyan)
- **W**: Speed Up
- **S**: Speed Down
- **A**: Turn Left
- **D**: Turn Right
- **E**: Fire

### Player 2 (Right Side - Pink)
- **↑**: Speed Up
- **↓**: Speed Down
- **←**: Turn Left
- **→**: Turn Right
- **-**: Fire (Minus key)

## Game Mechanics

### Movement System
- **Constant Motion**: Planes are always moving forward
- **5 Speed Levels**: Toggle between speeds with up/down keys
- **3 Turn States**: Turning Left → Straight → Turning Right
- **Screen Wrapping**: Flying off one edge brings you to the opposite edge

### Combat
- Maximum 5 bullets on screen per player
- One-hit kill for unshielded planes
- Head-on collisions destroy both players (unless shielded)

## Power-Ups

Power-ups spawn randomly every 10 seconds (maximum 1 on map at a time):

| Icon | Name | Type | Description |
|------|------|------|-------------|
| **S** (Blue) | Shield | Passive | Adds protective ring, stacks up to 3 layers |
| **M** (Amber) | Multi-Shot | Timed (8s) | Fires 3 projectiles in spread pattern |
| **H** (Red) | Homing | Ammo | Next shot fires a homing missile |
| **INV** (Grey) | Invisibility | Timed (10s) | Become transparent and untargetable |
| **L** (Violet) | Laser | Ammo | Fires continuous beam for 5 seconds |
| **BOMB** (Orange) | Bomb | Ammo | Launches proximity/timer bomb |

### Visual Indicators
- **Blue Rings**: Shield active (thicker = more shields)
- **Amber Wings**: Multi-shot active
- **Red Nose**: Homing missile loaded
- **Violet Center**: Laser loaded
- **"B" Text**: Bomb loaded

## Environmental Hazards

### Asteroids
- Spawn every 15 seconds
- Can be destroyed by shooting (takes 5 hits) or by heavy weapons
- Lethal on contact
- Create shrapnel debris when destroyed by explosions

### Bombs
- Detonate after 5 seconds OR when enemy gets close OR on direct contact
- Can be shot to detonate early
- Massive explosion radius damages everything (including the shooter!)
- Creates shockwave effect

### Lasers
- Continuous beam that wraps around the screen
- Blocked by asteroids
- Destroyed immediately by shields
- Lasts 5 seconds

## Features

- **Neon Aesthetic**: Glowing graphics with dark slate background
- **Particle Effects**: Explosions, trails, shockwaves
- **Sound Effects**: Retro synthesized audio
- **Persistent Statistics**: Tracks wins and total rounds in localStorage
- **Game Speed Options**: Normal, Turbo, and Slow Motion modes
- **Customizable Colors**: Pick any hex color for each player

## Technical Details

- Pure HTML5/JavaScript - no dependencies required
- Canvas-based rendering with 60 FPS target
- Web Audio API for sound effects
- Responsive design that fills the browser window
- Modular code architecture for maintainability

## File Structure

- `index.html` - Main game page
- `styles.css` - Neon aesthetic styling
- `game.js` - Game engine and main loop
- `player.js` - Player class with discrete state movement
- `weapons.js` - Bullet, Homing Missile, Laser, Bomb
- `powerups.js` - Power-up system
- `asteroid.js` - Asteroid and shrapnel
- `particles.js` - Visual effects
- `ui.js` - Menu and HUD management
- `audio.js` - Sound effects
- `utils.js` - Helper functions

## Tips for Playing

1. **Speed Management**: Higher speeds are harder to control but make you harder to hit
2. **Shield Priority**: Shields are extremely valuable - protect them!
3. **Bomb Safety**: Stay clear of your own bombs - friendly fire is real
4. **Asteroid Cover**: Use asteroids as obstacles to break line of sight
5. **Multi-Shot Power**: Combine multi-shot with other weapons for devastating attacks
6. **Invisibility Timing**: Use invisibility to avoid homing missiles
7. **Laser Counter**: If you have shields, you can destroy enemy lasers by blocking them

## Browser Compatibility

Works best in modern browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires JavaScript and HTML5 Canvas support.

## Credits

Game design and implementation based on the Neon Dogfight game design document.
Built with HTML5 Canvas and Web Audio API.

---

Enjoy the dogfight! 🚀✨



