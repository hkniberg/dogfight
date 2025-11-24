// Utility functions for the game

// Wrap coordinates around screen edges
function wrapPosition(x, y, canvasWidth, canvasHeight) {
    let wrappedX = x;
    let wrappedY = y;
    
    if (x < 0) wrappedX = canvasWidth;
    if (x > canvasWidth) wrappedX = 0;
    if (y < 0) wrappedY = canvasHeight;
    if (y > canvasHeight) wrappedY = 0;
    
    return { x: wrappedX, y: wrappedY };
}

// Calculate distance between two points (considering wrapping)
function getDistance(x1, y1, x2, y2, canvasWidth, canvasHeight) {
    // Calculate direct distance
    let dx = x2 - x1;
    let dy = y2 - y1;
    
    // Consider wrapped distances
    if (Math.abs(dx) > canvasWidth / 2) {
        dx = dx > 0 ? dx - canvasWidth : dx + canvasWidth;
    }
    if (Math.abs(dy) > canvasHeight / 2) {
        dy = dy > 0 ? dy - canvasHeight : dy + canvasHeight;
    }
    
    return Math.sqrt(dx * dx + dy * dy);
}

// Calculate angle between two points (considering wrapping)
function getAngleTo(x1, y1, x2, y2, canvasWidth, canvasHeight) {
    let dx = x2 - x1;
    let dy = y2 - y1;
    
    // Consider wrapped distances
    if (Math.abs(dx) > canvasWidth / 2) {
        dx = dx > 0 ? dx - canvasWidth : dx + canvasWidth;
    }
    if (Math.abs(dy) > canvasHeight / 2) {
        dy = dy > 0 ? dy - canvasHeight : dy + canvasHeight;
    }
    
    return Math.atan2(dy, dx);
}

// Check circle collision
function checkCircleCollision(x1, y1, r1, x2, y2, r2, canvasWidth, canvasHeight) {
    const distance = getDistance(x1, y1, x2, y2, canvasWidth, canvasHeight);
    return distance < r1 + r2;
}

// Normalize angle to 0-2π range
function normalizeAngle(angle) {
    while (angle < 0) angle += Math.PI * 2;
    while (angle >= Math.PI * 2) angle -= Math.PI * 2;
    return angle;
}

// Get shortest angle difference
function getAngleDifference(angle1, angle2) {
    let diff = angle2 - angle1;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
}

// Random number between min and max
function random(min, max) {
    return Math.random() * (max - min) + min;
}

// Random integer between min and max (inclusive)
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Check if a point is valid for spawning (not too close to players)
function isValidSpawnPosition(x, y, players, minDistance, canvasWidth, canvasHeight) {
    for (let player of players) {
        if (player.alive) {
            const dist = getDistance(x, y, player.x, player.y, canvasWidth, canvasHeight);
            if (dist < minDistance) {
                return false;
            }
        }
    }
    return true;
}

// Get a random spawn position away from players
function getRandomSpawnPosition(players, minDistance, canvasWidth, canvasHeight) {
    let attempts = 0;
    let maxAttempts = 50;
    
    while (attempts < maxAttempts) {
        const x = random(50, canvasWidth - 50);
        const y = random(50, canvasHeight - 50);
        
        if (isValidSpawnPosition(x, y, players, minDistance, canvasWidth, canvasHeight)) {
            return { x, y };
        }
        attempts++;
    }
    
    // If we can't find a valid position, return a random one anyway
    return {
        x: random(50, canvasWidth - 50),
        y: random(50, canvasHeight - 50)
    };
}
