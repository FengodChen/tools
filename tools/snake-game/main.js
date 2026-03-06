import init, { SnakeGame } from './pkg/snake_game.js';

let game = null;
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 100;
let animationId = null;
let highScore = localStorage.getItem('snake-high-score') || 0;

// Update high score display
document.getElementById('highScoreDisplay').textContent = highScore;

async function initGame() {
    await init();
    
    const canvas = document.getElementById('gameCanvas');
    game = new SnakeGame(canvas);
    
    // Hide loading screen
    document.getElementById('loading').classList.add('hidden');
    
    // Start game loop
    gameLoop(0);
}

function gameLoop(timestamp) {
    if (timestamp - lastUpdateTime >= UPDATE_INTERVAL) {
        const wasGameOver = game.is_game_over();
        game.update();
        
        // Check if game just ended
        if (!wasGameOver && game.is_game_over()) {
            handleGameOver();
        }
        
        lastUpdateTime = timestamp;
    }
    
    game.render();
    updateUI();
    
    animationId = requestAnimationFrame(gameLoop);
}

function handleGameOver() {
    const score = game.get_score();
    const isNewRecord = score > highScore;
    
    if (isNewRecord) {
        highScore = score;
        localStorage.setItem('snake-high-score', highScore);
        document.getElementById('highScoreDisplay').textContent = highScore;
        showToast(I18N.t('snake.toast.newRecord') || '🎉 恭喜！创造了新纪录！', 'success');
    } else {
        showToast((I18N.t('snake.toast.gameOver') || '游戏结束！得分：{{score}}').replace('{{score}}', score), 'info');
    }
}

function updateUI() {
    const score = game.get_score();
    document.getElementById('scoreDisplay').textContent = score;
    document.getElementById('lengthDisplay').textContent = (score / 10) + 3;
    
    const pauseBtn = document.getElementById('pauseBtn');
    const pauseText = pauseBtn.querySelector('span');
    if (game.is_paused() && !game.is_game_over()) {
        pauseText.textContent = I18N.t('snake.buttons.resume') || '继续';
    } else {
        pauseText.textContent = I18N.t('snake.buttons.pause') || '暂停';
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    icon.textContent = icons[type] || icons.info;
    msg.textContent = message;
    
    toast.classList.remove('hidden');
    toast.classList.remove('translate-x-full');
    
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, 3000);
}

// Keyboard controls - 只保留方向键、WASD和空格
document.addEventListener('keydown', (e) => {
    if (!game) return;
    
    const keyMap = {
        'ArrowUp': 'ArrowUp',
        'ArrowDown': 'ArrowDown',
        'ArrowLeft': 'ArrowLeft',
        'ArrowRight': 'ArrowRight',
        'w': 'w', 'W': 'W',
        's': 's', 'S': 'S',
        'a': 'a', 'A': 'A',
        'd': 'd', 'D': 'D',
        ' ': ' '
    };
    
    if (keyMap[e.key]) {
        e.preventDefault();
        game.handle_key(e.key);
        
        // Show toast for pause/resume
        if (e.key === ' ') {
            if (game.is_paused() && !game.is_game_over()) {
                showToast(I18N.t('snake.toast.paused') || '游戏已暂停', 'info');
            } else {
                showToast(I18N.t('snake.toast.resumed') || '游戏继续', 'success');
            }
        }
    }
});

// Touch controls
document.querySelectorAll('.control-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (!game) return;
        game.handle_key(btn.dataset.key);
    });
});

// Pause button
document.getElementById('pauseBtn').addEventListener('click', () => {
    if (!game) return;
    game.handle_key(' ');
    if (game.is_paused() && !game.is_game_over()) {
        showToast(I18N.t('snake.toast.paused') || '游戏已暂停', 'info');
    } else {
        showToast(I18N.t('snake.toast.resumed') || '游戏继续', 'success');
    }
});

// Restart button
document.getElementById('restartBtn').addEventListener('click', () => {
    if (!game) return;
    game.restart();
});

// Initialize i18n when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    await I18N.init();
    I18N.initLanguageSwitcher('.language-switcher-container');
    
    // Initialize game after i18n is ready
    initGame().catch(console.error);
});
