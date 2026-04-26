const SWEETS = [
    { level: 1, emoji: '🍬', name: 'Candy Şeker' },
    { level: 2, emoji: '🥐', name: 'Kruvazan' },
    { level: 3, emoji: '🟫', name: 'Kare Çikolata' },
    { level: 4, emoji: '🍫', name: 'Tadelle' },
    { level: 5, emoji: '🥧', name: 'Cheesecake' },
    { level: 6, emoji: '🍰', name: '1 Dilim Meyveli Pasta' },
    { level: 7, emoji: '🍮', name: '3 Dilim Çikolatalı Pasta' },
    { level: 8, emoji: '🎂', name: '1 Kat Meyveli Pasta' },
    { level: 9, emoji: '🍩', name: '2 Kat Çikolatalı Pasta' },
    { level: 10, emoji: '🧁', name: '3 Kat Meyveli Pasta' }
];

// Cell Types:
// 0: Empty
// 1-11: Sweets
// 100: Obstacle (Box)
// 200: Rocket Bomb  — clears row + column
// 300: TNT Bomb     — clears 3x3 area

class GameLogic {
    constructor(size = 5) {
        this.size = size;
        this.grid = [];
        this.score = 0;
        this.highScore = 0;
        this.comboCount = 0;
        this.shuffleCount = 0;
        this.undoCount = 0;
        this.hearts = 0;
        this.heartUseCount = 0;
        this.infiniteLifeUntil = 0; // timestamp
        this.history = [];
        this.maxUnlockedLevel = 1;

        this.onGridChange    = null;
        this.onScoreChange   = null;
        this.onHighScoreChange = null;
        this.onHeartsChange = null;
        this.onTargetReached = null;
        this.onGameOver      = null;
        this.onSoundEvent    = null;
        this.onPowerupChange = null;
        this.onRocketExplode = null;
        this.onBombExplode   = null;
        this.onBigMerge      = null; // fires with (newLevel, r, c) on 4-tile match
        this.onGoldChange    = null;
        this.gold            = 0;
        this.goldRespawnCount = 0;
        this.shuffleRespawnCount = 0;
        this.extraContinues      = 0; // Each level 8 sweet gives +1 continue right
        this.isProcessing    = false;
        this.onCombo         = null;
    }

    _swap(r1, c1, r2, c2) {
        const temp = this.grid[r1][c1];
        this.grid[r1][c1] = this.grid[r2][c2];
        this.grid[r2][c2] = temp;
    }

    isMovePossible() {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (!this.isSwappable(this.grid[r][c])) continue;
                
                // try right
                if (c < this.size - 1 && this.isSwappable(this.grid[r][c+1])) {
                    this._swap(r, c, r, c+1);
                    const matches = this.findMatches();
                    this._swap(r, c, r, c+1);
                    if (matches.length > 0) return true;
                }
                
                // try down
                if (r < this.size - 1 && this.isSwappable(this.grid[r+1][c])) {
                    this._swap(r, c, r+1, c);
                    const matches = this.findMatches();
                    this._swap(r, c, r+1, c);
                    if (matches.length > 0) return true;
                }
            }
        }
        return false;
    }

    init() {
        this.score           = 0;
        this.comboCount      = 0;
        this.shuffleCount    = 0;
        this.undoCount       = 0;
        this.heartUseCount   = 0;
        this.extraContinues  = 0;
        this.goldRespawnCount = 0;
        this.shuffleRespawnCount = 0;
        this.gold            = 0; 
        // Hearts are persistent across games, not reset here
        this.history         = [];
        this.grid            = [];

        for (let r = 0; r < this.size; r++) {
            let row = [];
            for (let c = 0; c < this.size; c++) {
                row.push(this.getRandomSweet());
            }
            this.grid.push(row);
        }

        // Prevent initial matches
        let safety = 0;
        while (this.findMatches().length > 0 && safety < 200) {
            for (let r = 0; r < this.size; r++)
                for (let c = 0; c < this.size; c++)
                    if (this.grid[r][c] !== 100)
                        this.grid[r][c] = this.getRandomSweet();
            safety++;
        }

        if (this.onGridChange)  this.onGridChange();
        if (this.onScoreChange) this.onScoreChange(this.score);
        if (this.onPowerupChange) this.onPowerupChange(this.shuffleCount, this.undoCount);
        if (this.onHeartsChange)  this.onHeartsChange(this.hearts, this.isInfiniteLife());
        if (this.onGoldChange)    this.onGoldChange(this.gold);
    }

    isInfiniteLife() {
        return Date.now() < this.infiniteLifeUntil;
    }

    // Level-independent spawn for endless mode
    getRandomSweet() {
        const r = Math.random();
        if (r < 0.40) return 1;
        if (r < 0.70) return 2;
        if (r < 0.90) return 3;
        if (r < 0.98) return 4;
        return 5;
    }

    isSwappable(val) {
        return val > 0 && val !== 100;
    }

    /* ===================== SWAP ===================== */
    async trySwap(r1, c1, r2, c2) {
        if (this.isProcessing) return false;

        const val1 = this.grid[r1][c1];
        const val2 = this.grid[r2][c2];

        if (!this.isSwappable(val1) || !this.isSwappable(val2)) return false;

        this._saveHistory();
        this.isProcessing = true;
        this.comboCount   = 0;
        let ok = false;

        // TNT activation
        if (val1 === 300 || val2 === 300) {
            this.grid[r1][c1] = val2;
            this.grid[r2][c2] = val1;
            const tntR = val1 === 300 ? r2 : r1;
            const tntC = val1 === 300 ? c2 : c1;
            await this.activateTNT(tntR, tntC);
            ok = true;
        }
        // Rocket activation
        else if (val1 === 200 || val2 === 200) {
            this.grid[r1][c1] = val2;
            this.grid[r2][c2] = val1;
            if (val1 === 200) await this.activateRocket(r2, c2);
            else              await this.activateRocket(r1, c1);
            ok = true;
        }
        else {
            // Normal swap
            this.grid[r1][c1] = val2;
            this.grid[r2][c2] = val1;
            const matches = this.findMatches();
            if (matches.length === 0) {
                this.grid[r1][c1] = val1;
                this.grid[r2][c2] = val2;
                ok = false;
            } else {
                if (this.onSoundEvent) this.onSoundEvent('swap_success', 0);
                await this.processMatches(matches, r2, c2);
                ok = true;
            }
        }

        // Check game-over after all cascades
        if (ok) {
            if (!this.isMovePossible()) {
                if (this.onGameOver) this.onGameOver();
            }
        }

        this.isProcessing = false;
        return ok;
    }

    /* ===================== ROCKET ===================== */
    async activateRocket(r, c) {
        if (this.onSoundEvent)    this.onSoundEvent('rocket', this.comboCount);
        if (this.onRocketExplode) this.onRocketExplode(r, c);

        this.grid[r][c] = 0;
        if (this.onPowerupChange) this.onPowerupChange(this.shuffleCount, this.undoCount);
        if (this.onScoreChange) this.onScoreChange(this.score);
        if (this.onGridChange)  this.onGridChange();
        await this.sleep(600);
        await this.applyGravity();
    }

    /* ===================== TNT ===================== */
    async activateTNT(r, c) {
        if (this.onSoundEvent)  this.onSoundEvent('tnt', this.comboCount);
        if (this.onBombExplode) this.onBombExplode(r, c);

        this.grid[r][c] = 0;

        // 3x3 blast
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr, nc = c + dc;
                if (nr < 0 || nr >= this.size || nc < 0 || nc >= this.size) continue;
                if (this.grid[nr][nc] === 100) {
                    // break box
                    this.grid[nr][nc] = 0; this.score += 50;
                } else if (this.grid[nr][nc] > 0) {
                    this.grid[nr][nc] = 0; this.score += 15;
                }
            }
        }
        if (this.onPowerupChange) this.onPowerupChange(this.shuffleCount, this.undoCount);
        if (this.onScoreChange) this.onScoreChange(this.score);
        if (this.onGridChange)  this.onGridChange();
        await this.sleep(600);
        await this.applyGravity();
    }

    /* ===================== MATCH FINDING ===================== */
    findMatches() {
        const matches = [];
        const isMatchable = (v) => v > 0 && v < 100;

        // --- 2x2 SQUARE detection (same sweet, 2×2 block) ---
        const usedInSquare = new Set();
        for (let r = 0; r < this.size - 1; r++) {
            for (let c = 0; c < this.size - 1; c++) {
                const val = this.grid[r][c];
                if (!isMatchable(val)) continue;
                if (this.grid[r][c+1]   === val &&
                    this.grid[r+1][c]   === val &&
                    this.grid[r+1][c+1] === val) {
                    const tiles = [{r, c}, {r, c:c+1}, {r:r+1, c}, {r:r+1, c:c+1}];
                    tiles.forEach(t => usedInSquare.add(`${t.r},${t.c}`));
                    matches.push({ level: val, tiles, isSquare: true });
                }
            }
        }

        // Helper: build run matches, skip tiles already used in a square
        const checkRun = (tiles, val) => {
            if (tiles.length >= 3) matches.push({ level: val, tiles, isSquare: false });
        };

        // --- HORIZONTAL runs ---
        const horizontalMatches = [];
        for (let r = 0; r < this.size; r++) {
            let run = [], runVal = -1;
            for (let c = 0; c <= this.size; c++) {
                const val = c < this.size ? this.grid[r][c] : -1;
                const ok  = isMatchable(val) && val === runVal;
                if (ok) {
                    run.push({r, c});
                } else {
                    if (run.length >= 3) horizontalMatches.push({ level: runVal, tiles: [...run] });
                    run    = isMatchable(val) ? [{r, c}] : [];
                    runVal = isMatchable(val) ? val : -1;
                }
            }
        }

        // --- VERTICAL runs ---
        const verticalMatches = [];
        for (let c = 0; c < this.size; c++) {
            let run = [], runVal = -1;
            for (let r = 0; r <= this.size; r++) {
                const val = r < this.size ? this.grid[r][c] : -1;
                const ok  = isMatchable(val) && val === runVal;
                if (ok) {
                    run.push({r, c});
                } else {
                    if (run.length >= 3) verticalMatches.push({ level: runVal, tiles: [...run] });
                    run    = isMatchable(val) ? [{r, c}] : [];
                    runVal = isMatchable(val) ? val : -1;
                }
            }
        }

        // --- INTERSECTION (L/T Shapes) detection ---
        const usedTiles = new Set();
        horizontalMatches.forEach(h => {
            verticalMatches.forEach(v => {
                if (h.level === v.level) {
                    // Find common tile
                    const common = h.tiles.find(ht => v.tiles.some(vt => vt.r === ht.r && vt.c === ht.c));
                    if (common) {
                        const combinedTiles = [...h.tiles];
                        v.tiles.forEach(vt => {
                            if (!combinedTiles.some(ct => ct.r === vt.r && ct.c === vt.c)) {
                                combinedTiles.push(vt);
                            }
                        });
                        combinedTiles.forEach(t => usedTiles.add(`${t.r},${t.c}`));
                        matches.push({ level: h.level, tiles: combinedTiles, isSquare: false, isL: true });
                    }
                }
            });
        });

        // Add remaining horizontal/vertical matches that were NOT part of an L/T or 2x2
        horizontalMatches.forEach(h => {
            if (!h.tiles.some(t => usedTiles.has(`${t.r},${t.c}`) || usedInSquare.has(`${t.r},${t.c}`))) {
                matches.push({ level: h.level, tiles: h.tiles, isSquare: false, isL: false });
            }
        });
        verticalMatches.forEach(v => {
            if (!v.tiles.some(t => usedTiles.has(`${t.r},${t.c}`) || usedInSquare.has(`${t.r},${t.c}`))) {
                matches.push({ level: v.level, tiles: v.tiles, isSquare: false, isL: false });
            }
        });

        return matches;
    }

    damageAdjacentBoxes(r, c) {
        [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr, dc]) => {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size) {
                if (this.grid[nr][nc] === 100) {
                    this.grid[nr][nc] = 0;
                    this.score += 50;
                }
            }
        });
    }

    /* ===================== PROCESS MATCHES ===================== */
    async processMatches(matches, targetR = -1, targetC = -1) {
        const toEmpty    = new Set();
        const toUpgrade  = new Map();
        const toSpawnBomb = new Map();
        let soundPlayed  = false;

        matches.forEach(m => {
            let upR = m.tiles[0].r, upC = m.tiles[0].c;

            if (targetR !== -1 && targetC !== -1) {
                const hasTarget = m.tiles.some(t => t.r === targetR && t.c === targetC);
                if (hasTarget) { upR = targetR; upC = targetC; }
                else { const mid = Math.floor(m.tiles.length / 2); upR = m.tiles[mid].r; upC = m.tiles[mid].c; }
            }

            const key = `${upR},${upC}`;

            // Level jump: 3-match→+1, 4-match→+2, 5+-match→+3
            let levelsUp = 1;
            if (m.tiles.length === 4) levelsUp = 2;
            else if (m.tiles.length >= 5) levelsUp = 3;

            // NEW Power-up Rules:
            // 4-in-a-row (linear) -> Undo
            // 2x2 Square -> Shuffle
            // 5-in-a-row (linear) OR L-Shape -> Heart (or Shuffle + Undo if hearts full/L-shape)
            if (m.isL) {
                // L-shape ALWAYS gives 1 Shuffle + 1 Undo
                this.shuffleCount++;
                this.undoCount++;
                if (this.onPowerupChange) this.onPowerupChange(this.shuffleCount, this.undoCount);
                if (this.onBigMerge) this.onBigMerge(2, upR, upC, -15, 0); // Shuffle (shifted left)
                setTimeout(() => {
                    if (this.onBigMerge) this.onBigMerge(1, upR, upC, 15, 0); // Undo (shifted right)
                }, 200);
            } else if (m.tiles.length >= 5 && !m.isSquare) {
                if (this.hearts < 5) {
                    this.hearts++;
                    if (this.onHeartsChange) this.onHeartsChange(this.hearts, this.isInfiniteLife());
                    if (this.onBigMerge) this.onBigMerge(3, upR, upC, 0, 0); // +3 jump + Heart
                } else {
                    // Hearts full: Give 1 Shuffle + 1 Undo
                    this.shuffleCount++;
                    this.undoCount++;
                    if (this.onPowerupChange) this.onPowerupChange(this.shuffleCount, this.undoCount);
                    if (this.onBigMerge) this.onBigMerge(2, upR, upC, -15, 0); // Shuffle
                    setTimeout(() => {
                        if (this.onBigMerge) this.onBigMerge(1, upR, upC, 15, 0); // Undo
                    }, 200);
                }
            } else if (m.isSquare) {
                this.shuffleCount++;
                if (this.onBigMerge) this.onBigMerge(2, upR, upC); // Square -> Shuffle
            } else if (m.tiles.length === 4 && !m.isSquare) {
                this.undoCount++;
                if (this.onBigMerge) this.onBigMerge(1, upR, upC); // 4-row -> Undo
            }

            const nextLevel = Math.min(m.level + levelsUp, 10);

            if (nextLevel > this.maxUnlockedLevel) this.maxUnlockedLevel = nextLevel;
            
            // Gold Gain: 50 gold for level 6 or higher
            if (nextLevel >= 6) {
                this.gold += 50;
                if (this.onGoldChange) this.onGoldChange(this.gold);
            }

            this.score += Math.pow(2, nextLevel) * levelsUp;

            // LEVEL 8 REWARD: Each Level 8 sweet gives +1 extra continue right
            if (nextLevel === 8) {
                this.extraContinues++;
                // Notify UI if needed, but the Lose Modal will check this
            }

            toUpgrade.set(key, nextLevel);

            let originalLeft = false;
            m.tiles.forEach(t => {
                const tKey = `${t.r},${t.c}`;
                if (tKey !== key) {
                    // NEW Rule: Level 4+ and 4+ tiles match -> leave 1 original sweet behind
                    if (m.level >= 4 && m.tiles.length >= 4 && !originalLeft) {
                        toUpgrade.set(tKey, m.level); 
                        originalLeft = true;
                    } else {
                        toEmpty.add(tKey);
                    }
                }
                this.damageAdjacentBoxes(t.r, t.c);
            });
        });

        toEmpty.forEach(key => {
            const [r, c] = key.split(',').map(Number);
            this.grid[r][c] = 0;
        });

        toUpgrade.forEach((val, key) => {
            const [r, c] = key.split(',').map(Number);
            this.grid[r][c] = val;
        });

        if (this.onPowerupChange) this.onPowerupChange(this.shuffleCount, this.undoCount);

        // EXTRA REWARD: Multiple 3-matches in one go -> 1 Shuffle
        const simple3Matches = matches.filter(m => m.tiles.length === 3 && !m.isL && !m.isSquare);
        if (simple3Matches.length >= 2) {
            const first = simple3Matches[0];
            this.shuffleCount++;
            if (this.onPowerupChange) this.onPowerupChange(this.shuffleCount, this.undoCount);
            if (this.onBigMerge) {
                // Short delay if other rewards were already triggered
                setTimeout(() => this.onBigMerge(2, first.tiles[0].r, first.tiles[0].c), 150);
            }
        }

        if (this.score > this.highScore) {
            this.highScore = this.score;
            if (this.onHighScoreChange) this.onHighScoreChange(this.highScore);
        }
        if (this.onScoreChange) this.onScoreChange(this.score);
        if (this.onGridChange)  this.onGridChange();

        if (this.onSoundEvent && !soundPlayed) {
            this.comboCount++;
            this.onSoundEvent('merge', this.comboCount);
            soundPlayed = true;

            // COMBO AWARDS:
            // x1: (Manual move) -> No reward, no UI
            // x2: (1st cascade) -> 1 Undo
            // x3: (2nd cascade) -> 1 Shuffle
            // x4+: (3rd cascade+) -> 1 Heart + 1 Shuffle (If hearts 5 -> 2 Shuffles)
            let rewardText = "";
            if (this.comboCount === 2) {
                this.undoCount++;
                rewardText = "+1 ↩️";
            } else if (this.comboCount === 3) {
                this.shuffleCount++;
                rewardText = "+1 🔀";
            } else if (this.comboCount >= 4) {
                if (this.hearts < 5) {
                    this.hearts++;
                    if (this.onHeartsChange) this.onHeartsChange(this.hearts, this.isInfiniteLife());
                    rewardText = "+1 ❤️ & +1 🔀";
                    this.shuffleCount++;
                } else {
                    this.shuffleCount += 2;
                    rewardText = "+2 🔀";
                }
            }
            
            if (this.onPowerupChange) this.onPowerupChange(this.shuffleCount, this.undoCount);
            if (this.onCombo && this.comboCount >= 2) this.onCombo(this.comboCount, rewardText);
        }

        await this.sleep(380);
        await this.applyGravity();
    }




    /* ===================== HEART CONTINUE ===================== */
    async continueWithHeart() {
        const maxContinues = 3 + this.extraContinues;
        if (this.heartUseCount >= maxContinues) return false;
        if (this.hearts <= 0 && !this.isInfiniteLife()) return false;
        
        if (!this.isInfiniteLife()) this.hearts--;
        this.heartUseCount++;
        
        if (this.onHeartsChange) this.onHeartsChange(this.hearts, this.isInfiniteLife());

        // Step 1: Shuffle
        await this.shuffle();
        
        // Step 2: Check if move possible. If not, protect top 10 and redo others.
        if (!this.isMovePossible()) {
            const allTiles = [];
            for (let r = 0; r < this.size; r++) {
                for (let c = 0; c < this.size; c++) {
                    allTiles.push({ r, c, val: this.grid[r][c] });
                }
            }
            // Sort by level descending
            allTiles.sort((a, b) => b.val - a.val);
            
            // Top 10 stay, others become level 1-2
            for (let i = 10; i < allTiles.length; i++) {
                const t = allTiles[i];
                this.grid[t.r][t.c] = Math.floor(Math.random() * 2) + 1;
            }
            
            // Final check/shuffle to ensure at least ONE move is possible
            while (!this.isMovePossible()) {
                await this.shuffle();
            }
        }
        
        if (this.onGridChange) this.onGridChange();
        return true;
    }

    async continueWithGold() {
        const cost = 150 + this.goldRespawnCount * 100;
        if (this.gold < cost) return false;
        
        this.gold -= cost;
        this.goldRespawnCount++;
        if (this.onGoldChange) this.onGoldChange(this.gold);
        
        await this.shuffle();
        if (!this.isMovePossible()) {
            const allTiles = [];
            for (let r = 0; r < this.size; r++) {
                for (let c = 0; c < this.size; c++) {
                    allTiles.push({ r, c, val: this.grid[r][c] });
                }
            }
            allTiles.sort((a, b) => b.val - a.val);
            for (let i = 10; i < allTiles.length; i++) {
                const t = allTiles[i];
                this.grid[t.r][t.c] = Math.floor(Math.random() * 2) + 1;
            }
            while (!this.isMovePossible()) {
                await this.shuffle();
            }
        }
        
        if (this.onGridChange) this.onGridChange();
        return true;
    }

    async continueWithShuffle() {
        if (this.shuffleCount < 5) return false;
        
        this.shuffleCount -= 5;
        this.shuffleRespawnCount++;
        if (this.onPowerupChange) this.onPowerupChange(this.shuffleCount, this.undoCount);
        
        await this.shuffle();
        if (!this.isMovePossible()) {
            const allTiles = [];
            for (let r = 0; r < this.size; r++) {
                for (let c = 0; c < this.size; c++) {
                    allTiles.push({ r, c, val: this.grid[r][c] });
                }
            }
            allTiles.sort((a, b) => b.val - a.val);
            for (let i = 10; i < allTiles.length; i++) {
                const t = allTiles[i];
                this.grid[t.r][t.c] = Math.floor(Math.random() * 2) + 1;
            }
            while (!this.isMovePossible()) {
                await this.shuffle();
            }
        }
        
        if (this.onGridChange) this.onGridChange();
        return true;
    }

    convertUndoToShuffle() {
        if (this.undoCount >= 5) {
            this.undoCount -= 5;
            this.shuffleCount += 1;
            if (this.onPowerupChange) this.onPowerupChange(this.shuffleCount, this.undoCount);
            return true;
        }
        return false;
    }
    async applyGravity() {
        let changed = false;

        for (let c = 0; c < this.size; c++) {
            for (let r = this.size - 1; r >= 0; r--) {
                if (this.grid[r][c] === 0) {
                    let above = r - 1;
                    while (above >= 0 && (this.grid[above][c] === 0 || this.grid[above][c] === 100)) above--;
                    if (above >= 0 && this.grid[above][c] !== 100) {
                        this.grid[r][c] = this.grid[above][c];
                        this.grid[above][c] = 0;
                        changed = true;
                    }
                }
            }
        }

        for (let c = 0; c < this.size; c++) {
            for (let r = 0; r < this.size; r++) {
                if (this.grid[r][c] === 0) {
                    let trapped = false;
                    for (let a = r - 1; a >= 0; a--) {
                        if (this.grid[a][c] === 100) { trapped = true; break; }
                    }
                    if (!trapped) { this.grid[r][c] = this.getRandomSweet(); changed = true; }
                }
            }
        }

        if (changed) {
            if (this.onGridChange) this.onGridChange();
            await this.sleep(280);
            const chain = this.findMatches();
            if (chain.length > 0) {
                await this.processMatches(chain);
            } else if (!this.isMovePossible()) {
                if (this.onGameOver) this.onGameOver();
            }
        }
    }

    /* ===================== POWER-UPS ===================== */
    async shuffle() {
        const vals = [];
        for (let r = 0; r < this.size; r++)
            for (let c = 0; c < this.size; c++)
                if (this.grid[r][c] !== 100) vals.push(this.grid[r][c]);

        for (let i = vals.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [vals[i], vals[j]] = [vals[j], vals[i]];
        }
        let idx = 0;
        for (let r = 0; r < this.size; r++)
            for (let c = 0; c < this.size; c++)
                if (this.grid[r][c] !== 100) this.grid[r][c] = vals[idx++];

        if (this.onGridChange) this.onGridChange();
        
        // Auto-match check after shuffle
        const chain = this.findMatches();
        if (chain.length > 0) {
            await this.sleep(300);
            await this.processMatches(chain);
        }
    }
    isMovePossible() {
        return this.getPossibleMove() !== null;
    }

    getPossibleMove() {
        // Simple check: try every adjacent swap and see if it makes a match
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const val = this.grid[r][c];
                if (val <= 0 || val === 100) continue;

                // Try Right
                if (c + 1 < this.size) {
                    const nextVal = this.grid[r][c+1];
                    if (nextVal > 0 && nextVal !== 100) {
                        // Swap
                        this.grid[r][c] = nextVal;
                        this.grid[r][c+1] = val;
                        const m = this.findMatches();
                        // Swap back
                        this.grid[r][c] = val;
                        this.grid[r][c+1] = nextVal;
                        if (m.length > 0) return { r1: r, c1: c, r2: r, c2: c + 1 };
                    }
                }
                // Try Down
                if (r + 1 < this.size) {
                    const nextVal = this.grid[r+1][c];
                    if (nextVal > 0 && nextVal !== 100) {
                        // Swap
                        this.grid[r][c] = nextVal;
                        this.grid[r+1][c] = val;
                        const m = this.findMatches();
                        // Swap back
                        this.grid[r][c] = val;
                        this.grid[r+1][c] = nextVal;
                        if (m.length > 0) return { r1: r, c1: c, r2: r + 1, c2: c };
                    }
                }
            }
        }
        return null;
    }

    _saveHistory() {
        this.history.push({
            grid:         this.grid.map(row => [...row]),
            score:        this.score,
            shuffleCount: this.shuffleCount,
            undoCount:    this.undoCount,
            hearts:       this.hearts
        });
        if (this.history.length > 5) this.history.shift();
    }

    undoMove() {
        if (this.history.length === 0) return false;
        const snap = this.history.pop();
        this.grid         = snap.grid;
        this.score        = snap.score;
        // Do NOT restore shuffleCount, undoCount, hearts, gold - these are persistent currency/usage
        // this.shuffleCount = snap.shuffleCount;
        // this.undoCount    = snap.undoCount;
        // this.hearts       = snap.hearts;

        if (this.onGridChange)  this.onGridChange();
        if (this.onScoreChange) this.onScoreChange(this.score);
        if (this.onPowerupChange) this.onPowerupChange(this.shuffleCount, this.undoCount);
        if (this.onHeartsChange) this.onHeartsChange(this.hearts, this.isInfiniteLife());
        return true;
    }

    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}
