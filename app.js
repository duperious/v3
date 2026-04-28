// ===================== CONSTANTS =====================
const BOARD_SIZE = 5;
const game = new GameLogic(BOARD_SIZE);

// ===================== DOM REFS =====================
const menuScreen   = document.getElementById('menu-screen');
const gameScreen   = document.getElementById('game-screen');
const playBtn      = document.getElementById('play-btn');
const menuBtn      = document.getElementById('menu-btn');

const gridContainer  = document.getElementById('grid');
const scoreEl        = document.getElementById('score');
const highScoreEl    = document.getElementById('high-score');
const muteBtn        = document.getElementById('mute-btn');
const shuffleBtn     = document.getElementById('shuffle-btn');
const undoBtn        = document.getElementById('undo-btn');
const restartBtn     = document.getElementById('restart-btn');

const shuffleCountLabel = document.getElementById('shuffle-count-label');
const undoCountLabel    = document.getElementById('undo-count-label');

const heartBtn       = document.getElementById('heart-btn');
const heartCountLabel = document.getElementById('heart-count-label');
const heartTimerEl    = document.getElementById('heart-timer');
const heartUsageInfo  = document.getElementById('heart-usage-info');
const useHeartBtn    = document.getElementById('use-heart-btn');
const motivationEl   = document.getElementById('motivation-text');

const loseModal         = document.getElementById('lose-modal');
const retryBtn          = document.getElementById('retry-btn');
const goldCountEl       = document.getElementById('gold-count');
const useGoldBtn        = document.getElementById('use-gold-btn');
const useShuffleBtn     = document.getElementById('use-shuffle-btn');
const convertBtn        = document.getElementById('convert-btn');
const guideTextEl       = document.getElementById('guide-text');
const nameInputEl       = document.getElementById('player-name-input');
const top5ContentEl     = document.getElementById('top-5-content');
const leaderboardBtn    = document.getElementById('leaderboard-btn');
const leaderboardModal  = document.getElementById('leaderboard-modal');
const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');

// ===================== FIREBASE CONFIG =====================
const firebaseConfig = {
  apiKey: "AIzaSyD-RLbaQtNqroAdDQ-7oFHWB-jx3_q-2OE",
  authDomain: "tatliibirlestir.firebaseapp.com",
  projectId: "tatliibirlestir",
  storageBucket: "tatliibirlestir.firebasestorage.app",
  messagingSenderId: "1090213571228",
  appId: "1:1090213571228:web:e36b8855c9a135e6a5db59"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ===================== STATE =====================
let isMuted       = false;
let selectedCell  = null;
let touchStartX, touchStartY;
let isProcessing  = false;
let lastMoveTime  = Date.now();
let playerName    = localStorage.getItem('sweetMerge_playerName') || "";

// ===================== AUDIO =====================
const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function ensureAudio() {
    if (!audioCtx) audioCtx = new AudioCtxClass();
}

function playSound(type, combo = 0) {
    if (isMuted) return;
    ensureAudio();

    const gain = audioCtx.createGain();
    gain.connect(audioCtx.destination);
    const pitch = 1 + Math.min(combo, 10) * 0.1;

    if (type === 'swap_success') {
        const o = audioCtx.createOscillator();
        o.connect(gain); o.type = 'sine';
        o.frequency.setValueAtTime(420, audioCtx.currentTime);
        o.frequency.exponentialRampToValueAtTime(680, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
        o.start(); o.stop(audioCtx.currentTime + 0.15);

    } else if (type === 'merge') {
        // Musical ting — pitch rises with combo
        const notes = [600, 750, 900].map(n => n * pitch);
        notes.forEach((freq, i) => {
            const o = audioCtx.createOscillator();
            o.connect(gain); o.type = 'triangle';
            o.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.06);
            gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
            o.start(audioCtx.currentTime + i * 0.06);
            o.stop(audioCtx.currentTime + 0.4);
        });

    } else if (type === 'rocket') {
        // Whoosh + boom layered
        [80, 160, 300].forEach((freq, i) => {
            const o = audioCtx.createOscillator();
            o.connect(gain);
            o.type = i === 0 ? 'sawtooth' : 'square';
            o.frequency.setValueAtTime(freq, audioCtx.currentTime);
            o.frequency.exponentialRampToValueAtTime(freq * 0.25, audioCtx.currentTime + 0.55);
            gain.gain.setValueAtTime(0.28, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
            o.start(audioCtx.currentTime + i * 0.02);
            o.stop(audioCtx.currentTime + 0.65);
        });

    } else if (type === 'tnt') {
        // Deep massive explosion
        [50, 80, 130, 220].forEach((freq, i) => {
            const o = audioCtx.createOscillator();
            o.connect(gain);
            o.type = i % 2 === 0 ? 'sawtooth' : 'square';
            o.frequency.setValueAtTime(freq, audioCtx.currentTime);
            o.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.8);
            gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.9);
            o.start(audioCtx.currentTime + i * 0.015);
            o.stop(audioCtx.currentTime + 1.0);
        });
    } else if (type === 'bigmerge') {
        // Triumphant rising arpeggio fanfare
        const notes = [523, 659, 784, 1047, 1319]; // C5 E5 G5 C6 E6
        notes.forEach((freq, i) => {
            const o = audioCtx.createOscillator();
            o.connect(gain);
            o.type = 'triangle';
            o.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.1);
            gain.gain.setValueAtTime(0.22, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8 + i * 0.1);
            o.start(audioCtx.currentTime + i * 0.1);
            o.stop(audioCtx.currentTime + 0.85 + i * 0.1);
        });
        // Bass boom underneath
        const bass = audioCtx.createOscillator();
        bass.connect(gain);
        bass.type = 'sawtooth';
        bass.frequency.setValueAtTime(80, audioCtx.currentTime);
        bass.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        bass.start();
        bass.stop(audioCtx.currentTime + 0.5);
    }
}

// ===================== GAME EVENTS =====================
game.onGridChange    = () => renderGrid();
game.onScoreChange   = (s) => { scoreEl.innerText = s; };
game.onHighScoreChange = (hs) => { 
    highScoreEl.innerText = hs; 
    localStorage.setItem('sweetMerge_highScore', hs);
};
game.onHeartsChange = (count, isInf) => updateHeartUI(count, isInf);
game.onGoldChange = (amount) => {
    if (goldCountEl) goldCountEl.innerText = amount;
    localStorage.setItem('sweetMerge_gold', amount);
};
game.onGameOver      = () => {
    const maxContinues = 3 + game.extraContinues;
    const heartsLeft = maxContinues - game.heartUseCount;

    // Submit score to global leaderboard if we have a name
    if (playerName && game.score > 0) {
        submitScore(playerName, game.score);
    }

    const goldCost = 150 + game.goldRespawnCount * 100;
    if (heartUsageInfo) {
        heartUsageInfo.innerHTML = `
            Can: ${heartsLeft}/${maxContinues} | Altın: ${game.gold}/${goldCost} 🪙
        `;
    }

    if (heartsLeft > 0 && (game.hearts > 0 || game.isInfiniteLife())) {
        useHeartBtn.style.display = 'block';
    } else {
        useHeartBtn.style.display = 'none';
    }

    if (game.gold >= goldCost) {
        useGoldBtn.style.display = 'block';
        useGoldBtn.innerText = `🪙 ${goldCost} Altınla Devam Et`;
        useGoldBtn.classList.remove('disabled');
        useGoldBtn.disabled = false;
    } else {
        useGoldBtn.style.display = 'block';
        useGoldBtn.innerText = `🪙 Yetersiz Altın (Eksik: ${goldCost - game.gold})`;
        useGoldBtn.classList.add('disabled');
        useGoldBtn.disabled = true;
    }

    if (game.shuffleCount >= 5) {
        useShuffleBtn.style.display = 'block';
        useShuffleBtn.innerText = `🔀 5 Karıştırmayla Devam Et (${game.shuffleCount} var)`;
    } else {
        useShuffleBtn.style.display = 'none';
    }

    setTimeout(() => loseModal.classList.add('visible'), 500);
};
game.onSoundEvent    = playSound;
game.onPowerupChange = (shuffle, undo) => updatePowerupButtons(shuffle, undo);
game.onBigMerge = (bonusType, r, c, offX = 0, offY = 0) => {
    let emoji = "";
    let targetId = "";

    if (bonusType === 1) { // Undo
        emoji = "↩️";
        targetId = "undo-btn";
    } else if (bonusType === 2) { // Shuffle
        emoji = "🔀";
        targetId = "shuffle-btn";
    } else if (bonusType === 3) { // Heart
        emoji = "💖";
        targetId = "heart-btn";
    }

    if (emoji && targetId) animateCollect(emoji, r, c, targetId, offX, offY);
};

game.onCombo = (count, rewardText) => {
    showComboAnimation(count, rewardText);
};

// ===================== MENU ACTIONS =====================
playBtn.addEventListener('click', () => {
    // Save player name if entered
    if (nameInputEl && nameInputEl.value.trim() !== "") {
        playerName = nameInputEl.value.trim().substring(0, 12);
        localStorage.setItem('sweetMerge_playerName', playerName);
    }

    menuScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    ensureAudio();
    startGame();
});

menuBtn.addEventListener('click', () => {
    gameScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
    startLeaderboardListener(); // Refresh scores when returning to menu
});

// Floating particles on menu
(function spawnParticles() {
    const emojis = ['🍪','🧁','🍩','🍰','🎂','🍭','🍬','🍨'];
    const container = document.getElementById('menu-particles');
    function spawn() {
        const el = document.createElement('div');
        el.className = 'menu-particle';
        el.innerText = emojis[Math.floor(Math.random() * emojis.length)];
        el.style.left = Math.random() * 100 + 'vw';
        el.style.animationDuration = (6 + Math.random() * 8) + 's';
        el.style.animationDelay = (Math.random() * 3) + 's';
        el.style.fontSize = (16 + Math.random() * 20) + 'px';
        container.appendChild(el);
        setTimeout(() => el.remove(), 14000);
    }
    setInterval(spawn, 800);
    for (let i = 0; i < 8; i++) setTimeout(spawn, i * 200);
})();

// ===================== BUTTON WIRING =====================
restartBtn.addEventListener('click', () => startGame());
retryBtn.addEventListener('click', () => {
    loseModal.classList.remove('visible');
    startGame();
});

useHeartBtn.addEventListener('click', async () => {
    loseModal.classList.remove('visible');
    await sleep(400); // Wait for modal to close
    const ok = await game.continueWithHeart();
    if (ok) {
        playSound('swap_success');
        saveGameState();
    }
});

useGoldBtn.addEventListener('click', async () => {
    loseModal.classList.remove('visible');
    await sleep(400); // Wait for modal to close
    const ok = await game.continueWithGold();
    if (ok) {
        playSound('swap_success');
        saveGameState();
    }
});

useShuffleBtn.addEventListener('click', async () => {
    loseModal.classList.remove('visible');
    await sleep(400); // Wait for modal to close
    const ok = await game.continueWithShuffle();
    if (ok) {
        playSound('swap_success');
        saveGameState();
    }
});

convertBtn.addEventListener('click', () => {
    if (game.undoCount < 5) return;
    const ok = game.convertUndoToShuffle();
    if (ok) {
        playSound('bigmerge');
        // Animate particles from undo to shuffle? 
        // For now just pulse
        convertBtn.style.transform = 'scale(1.3)';
        setTimeout(() => convertBtn.style.transform = 'scale(1)', 200);
    }
});

// Heart usage is now only via the Game Over modal.
// The bottom bar heart-btn serves as an indicator.

muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    muteBtn.innerText = isMuted ? '🔇' : '🔊';
    muteBtn.style.opacity = isMuted ? '0.5' : '1';
});

leaderboardBtn.addEventListener('click', () => {
    leaderboardModal.classList.add('visible');
    startLeaderboardListener();
});

closeLeaderboardBtn.addEventListener('click', () => {
    leaderboardModal.classList.remove('visible');
});

shuffleBtn.addEventListener('click', async () => {
    if (game.isProcessing || game.shuffleCount <= 0) return;
    game.shuffleCount--;
    
    // Set movement variables for each tile
    const rect = gridContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    document.querySelectorAll('.tile').forEach(t => {
        const tileRect = t.getBoundingClientRect();
        const tileCenterX = tileRect.left + tileRect.width / 2 - rect.left;
        const tileCenterY = tileRect.top + tileRect.height / 2 - rect.top;
        
        // Vector towards center
        const dx = centerX - tileCenterX;
        const dy = centerY - tileCenterY;
        
        t.style.setProperty('--move-x', `${dx}px`);
        t.style.setProperty('--move-y', `${dy}px`);
        t.classList.add('shuffle-anim');
    });
    
    await game.shuffle();
    if (game.onPowerupChange) game.onPowerupChange(game.shuffleCount, game.undoCount);
    playSound('swap_success');
    
    setTimeout(() => {
        document.querySelectorAll('.tile').forEach(t => {
            t.classList.remove('shuffle-anim');
            t.style.removeProperty('--move-x');
            t.style.removeProperty('--move-y');
        });
    }, 650);
});

undoBtn.addEventListener('click', () => {
    if (game.isProcessing || game.undoCount <= 0) return;
    game.undoCount--;
    const ok = game.undoMove();
    if (ok) {
        playSound('swap_success');
        // Animation handled by renderGrid adding class if flag set? 
        // Or just apply here to all new tiles
        renderGrid(true); // pass flag for undo animation
    }
});

// ===================== GAME INIT =====================
function startGame() {
    loseModal.classList.remove('visible');
    
    game.init();
    updatePowerupButtons(0, 0);
    updateHeartUI(game.hearts, game.isInfiniteLife());
    lastMoveTime = Date.now();
    resetHintTimer();
}

function updateHeartUI(count, isInf) {
    if (heartCountLabel) {
        heartCountLabel.innerText = isInf ? `∞ (${count})` : count;
    }
    if (heartBtn) heartBtn.classList.toggle('infinite', isInf);
    localStorage.setItem('sweetMerge_hearts', count);
}

// ===================== MOTIVATION =====================
const MOTIVATIONS = [
    "Harika gidiyorsun! 🍰",
    "Tatlı birleşmeler seni bekliyor! 🍬",
    "Rekorunu kırmaya çok az kaldı! 🚀",
    "En büyük pastayı yapabilir misin? 🎂",
    "Harika bir strateji! 🧠",
"Lezzetli kombinasyonlar! 🍩",
    "Pes etme, devam et! 💪",
    "Gerçek bir tatlı ustasısın! 👨‍🍳"
];
let currentMotIndex = 0;
let hintTimer      = null;
const HINT_DELAY   = 5000; // 5 seconds

function cycleMotivationText() {
    if (!motivationEl) return;
    motivationEl.classList.add('fade');
    setTimeout(() => {
        currentMotIndex = (currentMotIndex + 1) % MOTIVATIONS.length;
        motivationEl.innerText = MOTIVATIONS[currentMotIndex];
        motivationEl.classList.remove('fade');
    }, 500);
}
setInterval(cycleMotivationText, 45000); // 45 seconds

const GUIDES = [
    "Aynı 3 tatlıyı birleştir!",
    "4'lü veya 5'li eşleşme bonus verir!",
    "2x2 kare eşleşmesi Karıştırma verir!",
    "5 Geri Al -> 1 Karıştırma yap!",
    "Seviye 6+ tatlılar +50 Altın verir!",
    "Zor durumda Altınla devam et!",
    "Karıştırma haklarını akıllıca kullan!"
];
let currentGuideIndex = 0;

function cycleGuideText() {
    if (!guideTextEl) return;
    guideTextEl.style.opacity = '0';
    guideTextEl.classList.remove('animate');
    setTimeout(() => {
        currentGuideIndex = (currentGuideIndex + 1) % GUIDES.length;
        guideTextEl.innerText = GUIDES[currentGuideIndex];
        guideTextEl.style.opacity = '1';
        // If text is long, add animation class
        if (guideTextEl.innerText.length > 30) {
            guideTextEl.classList.add('animate');
        }
    }, 500);
}
setInterval(cycleGuideText, 8000);

function updatePowerupButtons(shuffle, undo) {
    shuffleBtn.classList.toggle('disabled', shuffle <= 0);
    undoBtn.classList.toggle('disabled', undo <= 0);
    if (convertBtn) convertBtn.classList.toggle('disabled', undo < 5);
    
    if (shuffleCountLabel) shuffleCountLabel.innerText = shuffle;
    if (undoCountLabel) undoCountLabel.innerText = undo;
}

function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ===================== HINTS =====================
function resetHintTimer() {
    clearTimeout(hintTimer);
    hintTimer = setTimeout(showHint, HINT_DELAY);
}

function clearHint() {
    document.querySelectorAll('.tile').forEach(t => t.classList.remove('hint-anim'));
}

function showHint() {
    if (isProcessing || game.isProcessing || loseModal.classList.contains('visible')) return;
    const move = game.getPossibleMove();
    if (move) {
        const t1 = document.querySelector(`.tile[data-r="${move.r1}"][data-c="${move.c1}"]`);
        const t2 = document.querySelector(`.tile[data-r="${move.r2}"][data-c="${move.c2}"]`);
        if (t1) t1.classList.add('hint-anim');
        if (t2) t2.classList.add('hint-anim');
    }
}

function animateCollect(emoji, r, c, targetId, offX = 0, offY = 0) {
    const startTile = document.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
    const targetBtn = document.getElementById(targetId);
    if (!targetBtn) return;

    const particle = document.createElement('div');
    particle.className = 'collect-particle';
    particle.innerText = emoji;
    
    const rect = startTile ? startTile.getBoundingClientRect() : { left: window.innerWidth/2, top: window.innerHeight/2, width: 0, height: 0 };
    const startX = rect.left + rect.width / 2 + offX;
    const startY = rect.top + rect.height / 2 + offY;
    
    particle.style.left = (startX - 30) + 'px';
    particle.style.top = (startY - 30) + 'px';
    particle.style.animation = 'collectJump 0.5s ease-out forwards';
    document.body.appendChild(particle);

    // After jump (500ms), fly to target
    setTimeout(() => {
        const targetRect = targetBtn.getBoundingClientRect();
        const destX = targetRect.left + targetRect.width / 2;
        const destY = targetRect.top + targetRect.height / 2;

        requestAnimationFrame(() => {
            particle.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
            particle.style.transform = `translate(${destX - startX}px, ${destY - startY + 45}px) scale(0.1) rotate(720deg)`;
            particle.style.opacity = '0';
        });

        setTimeout(() => {
            particle.remove();
            // Animate only the badge, not the whole button
            const badge = targetBtn.querySelector('.powerup-badge');
            if (badge) {
                badge.classList.remove('badge-pop');
                void badge.offsetWidth; // Trigger reflow
                badge.classList.add('badge-pop');
            }
        }, 600);
    }, 550);
}

// ===================== INFINITE LIFE TIMER =====================
let playSessionStart = Date.now();
let totalPlayTime = parseInt(localStorage.getItem('sweetMerge_playTime') || '0');
const REQ_PLAY_TIME = 600000; // 10 mins

function updateTimerDisplay() {
    if (!heartTimerEl) return;
    const now = Date.now();
    
    const isInf = game.isInfiniteLife();
    
    if (isInf) {
        const diff = game.infiniteLifeUntil - now;
        heartTimerEl.innerText = formatTime(Math.max(0, diff));
        heartTimerEl.style.color = '#ff6b81';
        if (heartCountLabel) heartCountLabel.innerText = '∞';
    } else {
        const sessionTime = now - playSessionStart;
        const currentTotal = totalPlayTime + sessionTime;
        heartTimerEl.innerText = formatTime(Math.min(REQ_PLAY_TIME, currentTotal));
        heartTimerEl.style.color = 'var(--accent-color)';
        if (heartCountLabel) heartCountLabel.innerText = game.hearts;
    }
}
setInterval(updateTimerDisplay, 1000);

function checkPlayTime() {
    const now = Date.now();
    
    if (game.isInfiniteLife()) {
        // We are in infinite period. Just wait for it to end.
        return;
    }

    const sessionTime = now - playSessionStart;
    const currentTotal = totalPlayTime + sessionTime;
    
    if (currentTotal >= REQ_PLAY_TIME) {
        // Earn 10 mins infinite
        game.infiniteLifeUntil = now + 600000; 
        localStorage.setItem('sweetMerge_infLifeUntil', game.infiniteLifeUntil);
        
        // Reset timers for the NEXT cycle
        totalPlayTime = 0;
        playSessionStart = now; 
        // Wait, if we want it to start counting again ONLY after infinite ends, 
        // we should adjust playSessionStart when infinite ends.
        // But the user said: "10m play -> 10m infinite -> 10m play -> 10m infinite"
        // So we reset progress here.
        localStorage.setItem('sweetMerge_playTime', 0);
        
        updateHeartUI(game.hearts, true);
        
        if (typeof showBigMergeCelebration === 'function') {
            showBigMergeCelebration("10 DK SONSUZ CAN KAZANDIN! 🎉");
        }
    } else {
        localStorage.setItem('sweetMerge_playTime', currentTotal);
    }
}
setInterval(checkPlayTime, 30000); 

function saveGameState() {
    localStorage.setItem('sweetMerge_hearts', game.hearts);
    localStorage.setItem('sweetMerge_infLifeUntil', game.infiniteLifeUntil);
    localStorage.setItem('sweetMerge_gold', game.gold);
}

function updatePowerupButtons(shuffle, undo) {
    shuffleBtn.classList.toggle('disabled', shuffle <= 0);
    undoBtn.classList.toggle('disabled', undo <= 0);
    if (shuffleCountLabel) shuffleCountLabel.innerText = shuffle;
    if (undoCountLabel) undoCountLabel.innerText = undo;
}

// ===================== TILE RENDERING =====================
function getSweetInfo(val) {
    if (val === 0)   return { emoji: '',   cls: '' };
    const s = SWEETS.find(s => s.level === val);
    return s ? { emoji: s.emoji, cls: `level-${val}` } : { emoji: '', cls: '' };
}

function renderGrid(isUndo = false) {
    gridContainer.innerHTML = '';

    const rect = gridContainer.getBoundingClientRect();
    const containerW = rect.width || 340;
    const PADDING = containerW * (5 / 340); // Proportional padding
    const GAP     = containerW * (5 / 340); // Proportional gap
    const TILE    = (containerW - (PADDING * 2) - (GAP * (BOARD_SIZE - 1))) / BOARD_SIZE;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            // Background cell
            const bg = document.createElement('div');
            bg.className       = 'cell-bg';
            bg.style.gridRow   = r + 1;
            bg.style.gridColumn = c + 1;
            gridContainer.appendChild(bg);

            const val = game.grid[r][c];
            if (val <= 0) continue;

            const info = getSweetInfo(val);
            const tile = document.createElement('div');
            tile.className = `tile ${info.cls}`;
            if (isUndo) tile.classList.add('undo-anim');
            
            let html = info.emoji;
            if (val > 0 && val < 100) html += `<div class="level-badge">${val}</div>`;
            tile.innerHTML = html;

            tile.style.width  = `${TILE}px`;
            tile.style.height = `${TILE}px`;
            tile.style.top    = `${PADDING + r * (TILE + GAP)}px`;
            tile.style.left   = `${PADDING + c * (TILE + GAP)}px`;
            
            tile.dataset.r  = r;
            tile.dataset.c  = c;

            tile.addEventListener('mousedown', handlePointerDown);
            tile.addEventListener('touchstart', handlePointerDown, { passive: false });

            gridContainer.appendChild(tile);
        }
    }
}

// Evolution bar removed as per request

// ===================== INPUT HANDLING =====================
function handlePointerDown(e) {
    if (isProcessing || game.isProcessing) return;
    clearHint();
    
    if (e.type === 'touchstart') e.preventDefault();

    const r = parseInt(this.dataset.r);
    const c = parseInt(this.dataset.c);

    if (selectedCell) {
        document.querySelectorAll('.tile').forEach(t => t.classList.remove('selected'));
        const { r: sr, c: sc } = selectedCell;
        selectedCell = null;
        if (isAdjacent(sr, sc, r, c)) performSwap(sr, sc, r, c);
    } else {
        selectedCell = { r, c };
        this.classList.add('selected');
        const ev = e.type === 'touchstart' ? e.touches[0] : e;
        touchStartX = ev.clientX;
        touchStartY = ev.clientY;
        document.addEventListener('mouseup', handlePointerUp);
        document.addEventListener('touchend', handlePointerUp);
    }
}

function handlePointerUp(e) {
    document.removeEventListener('mouseup', handlePointerUp);
    document.removeEventListener('touchend', handlePointerUp);

    if (!selectedCell || isProcessing || game.isProcessing) return;

    const ev = e.type === 'touchend' ? e.changedTouches[0] : e;
    const dx = ev.clientX - touchStartX;
    const dy = ev.clientY - touchStartY;

    if (Math.abs(dx) > 25 || Math.abs(dy) > 25) {
        const { r: sr, c: sc } = selectedCell;
        let nr = sr, nc = sc;
        if (Math.abs(dx) > Math.abs(dy)) nc = dx > 0 ? sc + 1 : sc - 1;
        else                             nr = dy > 0 ? sr + 1 : sr - 1;

        document.querySelectorAll('.tile').forEach(t => t.classList.remove('selected'));
        selectedCell = null;

        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
            performSwap(sr, sc, nr, nc);
        }
    }
}

function isAdjacent(r1, c1, r2, c2) {
    return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

async function performSwap(r1, c1, r2, c2) {
    isProcessing = true;
    animateSwap(r1, c1, r2, c2);
    await sleep(220);

    const ok = await game.trySwap(r1, c1, r2, c2);
    if (!ok) {
        renderGrid();
        animateSwap(r1, c1, r2, c2);
        await sleep(200);
        renderGrid();
    } else {
        lastMoveTime = Date.now();
        resetHintTimer();
    }
    isProcessing = false;
}

function animateSwap(r1, c1, r2, c2) {
    let t1, t2;
    document.querySelectorAll('.tile').forEach(t => {
        if (+t.dataset.r === r1 && +t.dataset.c === c1) t1 = t;
        if (+t.dataset.r === r2 && +t.dataset.c === c2) t2 = t;
    });
    if (t1 && t2) {
        const top1 = t1.style.top, left1 = t1.style.left;
        t1.style.top = t2.style.top; t1.style.left = t2.style.left;
        t2.style.top = top1;         t2.style.left = left1;
        t1.style.zIndex = 50; t2.style.zIndex = 50;
    }
}

// ===================== VISUAL EFFECTS =====================
function getTileCenter(r, c) {
    const rect = gridContainer.getBoundingClientRect();
    const cellW = rect.width / BOARD_SIZE;
    const cellH = rect.height / BOARD_SIZE;
    return {
        x: rect.left + (c + 0.5) * cellW,
        y: rect.top  + (r + 0.5) * cellH,
    };
}




function showBigMergeCelebration(jump) {
    const bravo = document.createElement('div');
    bravo.className = 'minimal-bravo';
    bravo.innerHTML = `
        <div class="bravo-main">BRAVO!</div>
        <div class="bravo-sub">+${jump} Seviye</div>
    `;
    document.body.appendChild(bravo);
    
    setTimeout(() => {
        bravo.classList.add('out');
        setTimeout(() => bravo.remove(), 350);
    }, 700);
}

function showComboAnimation(count, rewardText) {
    const container = document.createElement('div');
    container.className = 'combo-graphic';
    
    const comboText = document.createElement('div');
    comboText.className = 'combo-text';
    comboText.innerText = `COMBO x${count}`;
    
    container.appendChild(comboText);
    
    if (rewardText) {
        const reward = document.createElement('div');
        reward.className = 'combo-reward';
        reward.innerText = rewardText;
        container.appendChild(reward);
    }
    
    document.body.appendChild(container);
    
    setTimeout(() => {
        container.classList.add('fade-out');
        setTimeout(() => container.remove(), 400);
    }, 1200);
}

function showGoldPopup(amount, r, c) {
    const { x, y } = getTileCenter(r, c);
    const el = document.createElement('div');
    el.className = 'gold-popup';
    el.innerText = `+${amount} 🪙`;
    el.style.left = x + 'px';
    el.style.top  = (y - 10) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1300);
}

// ===================== GLOBAL LEADERBOARD LOGIC (FIREBASE REAL-TIME) =====================
function startLeaderboardListener() {
    if (!top5ContentEl) return;
    
    // Fetch more docs (limit 100) to find unique people even with old duplicates
    db.collection('scores')
        .orderBy('score', 'desc')
        .limit(100)
        .onSnapshot((snapshot) => {
            if (!snapshot.empty) {
                // Deduplication logic: One name, one highest score
                const uniqueScoresMap = new Map();
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const name = (data.name || 'Anonim').trim();
                    if (!uniqueScoresMap.has(name) || data.score > uniqueScoresMap.get(name).score) {
                        uniqueScoresMap.set(name, data);
                    }
                });

                // Sort unique scores and take top 5
                const sortedUnique = Array.from(uniqueScoresMap.values())
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 5);

                top5ContentEl.innerHTML = sortedUnique.map((data, index) => {
                    const rank = index + 1;
                    let badge = rank;
                    if (rank === 1) badge = '🥇';
                    if (rank === 2) badge = '🥈';
                    if (rank === 3) badge = '🥉';

                    return `
                        <div class="top-item rank-${rank}">
                            <span class="rank-num">${badge}</span>
                            <span class="name">${data.name || 'Anonim'}</span>
                            <span class="score">${data.score.toLocaleString()}</span>
                        </div>
                    `;
                }).join('');
            } else {
                top5ContentEl.innerHTML = "<span>Henüz skor yok, ilk sen ol!</span>";
            }
        }, (error) => {
            console.warn("Liderlik tablosu dinlenemedi:", error);
        });
}

async function submitScore(name, score) {
    if (!name || score <= 0) return;
    try {
        const finalName = name.trim().substring(0, 12);
        const docRef = db.collection('scores').doc(finalName);
        
        // Only update if the new score is higher (Personal Best logic)
        const doc = await docRef.get();
        if (!doc.exists || score > doc.data().score) {
            await docRef.set({
                name: finalName,
                score: score,
                date: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("Yeni rekor kaydedildi:", finalName, score);
        } else {
            console.log("Mevcut rekor daha yüksek, kaydedilmedi.");
        }
    } catch (e) {
        console.warn("Skor gönderilemedi:", e);
    }
}

// ===================== UTILS =====================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===================== BOOT =====================
window.onload = () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js?v=2.0').then(reg => {
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New version available! We can optionally show a prompt here.
                        // For now, we'll let the user reload or force it.
                        console.log('Yeni versiyon yüklendi. Lütfen sayfayı yenileyin.');
                    }
                });
            });
        });

        // Reload when the new service worker takes control
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });
    }
    
    // Load high score
    const savedHS = localStorage.getItem('sweetMerge_highScore') || 0;
    game.highScore = parseInt(savedHS);
    if (highScoreEl) highScoreEl.innerText = game.highScore;

    // Load hearts
    game.hearts = parseInt(localStorage.getItem('sweetMerge_hearts') || '0');
    game.infiniteLifeUntil = parseInt(localStorage.getItem('sweetMerge_infLifeUntil') || '0');
    game.gold = parseInt(localStorage.getItem('sweetMerge_gold') || '0');
    if (goldCountEl) goldCountEl.innerText = game.gold;
    updateHeartUI(game.hearts, game.isInfiniteLife());

    if (nameInputEl && playerName) {
        nameInputEl.value = playerName;
    }

    startLeaderboardListener();
    resetHintTimer();
};
