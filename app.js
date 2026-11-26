
document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // ==========================================
    // REQUIEM — CHESS CLIENT
    // ==========================================

    const tg = window.Telegram?.WebApp;
    const API_URL = 'https://requiem-bot-7eyu.onrender.com';

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

    const currentUser = tg?.initDataUnsafe?.user || null;
    const playerId = currentUser?.id ? String(currentUser.id) : null;

    const MODES = {
        bullet: { name: 'ПУЛЯ', time: 120, label: '2 мин' },
        blitz:  { name: 'БЛИЦ', time: 300, label: '5 мин' },
        rapid:  { name: 'РАПИД', time: 600, label: '10 мин' }
    };

    let socket = null;
    let chess = null;
    let playerColor = null;
    let roomId = null;
    let selectedSquare = null;
    let legalMoves = [];
    let currentProfiles = {};
    let currentPlayer = null;
    let opponentPlayer = null;
    let chessLoaded = false;
    let selectedMode = 'blitz';
    let lastMoveSquares = [];
    let clocks = { white: 300, black: 300 };
    let clockInterval = null;
    let lastClockTick = Date.now();

    const state = {
        connected: false,
        gameStarted: false,
        gameOver: false,
        boardLocked: true,
        lastFen: null
    };

    // ==========================================
    // TELEGRAM
    // ==========================================

    if (tg) {
        tg.ready();
        tg.expand();
        tg.setHeaderColor?.('#080808');
        tg.setBackgroundColor?.('#080808');
    }

    // ==========================================
    // HELPERS
    // ==========================================

    function escapeHTML(value = '') {
        return String(value).replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        })[char]);
    }

    function getInitials(name = 'R') {
        return String(name).trim().slice(0, 1).toUpperCase() || 'R';
    }

    function getDisplayName(profile) {
        if (!profile) return 'Ожидание игрока';

        const full = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();

        return full || profile.username || `Игрок ${profile.id || ''}`;
    }

    function getUsername(profile) {
        if (!profile?.username) return 'Telegram';
        return '@' + String(profile.username).replace(/^@/, '');
    }

    function getElo(profile) {
        return Number(profile?.elo ?? profile?.rating ?? 1000);
    }

    function getRank(profile) {
        return profile?.rank_label || profile?.rank_name || profile?.rank || 'HUNTER';
    }

    function getPhoto(profile) {
        return profile?.photo_url || profile?.avatar_url || null;
    }

    function avatarHTML(profile, extraClass = '') {
        const photo = getPhoto(profile);
        const initial = getInitials(getDisplayName(profile));

        if (photo) {
            return `
                <div class="rq-avatar ${extraClass}">
                    <img src="${escapeHTML(photo)}"
                         alt=""
                         referrerpolicy="no-referrer"
                         onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                    <span style="display:none">${escapeHTML(initial)}</span>
                </div>
            `;
        }

        return `
            <div class="rq-avatar ${extraClass}">
                <span>${escapeHTML(initial)}</span>
            </div>
        `;
    }

    function showToast(message) {
        let toast = $('#toast');

        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.add('show');

        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
    }

    async function api(path, options = {}) {
        const response = await fetch(API_URL + path, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.detail || data.error || `Ошибка API ${response.status}`);
        }

        return data;
    }

    function normalizeColor(value) {
        if (value === 'w' || value === 'white') return 'white';
        if (value === 'b' || value === 'black') return 'black';
        return null;
    }

    function normalizeTurn(value) {
        if (value === 'w' || value === 'white') return 'w';
        if (value === 'b' || value === 'black') return 'b';
        return value;
    }

    function formatTime(seconds) {
        const safe = Math.max(0, Math.floor(Number(seconds) || 0));
        const minutes = Math.floor(safe / 60);
        const secs = safe % 60;
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    // ==========================================
    // STYLES
    // ==========================================

    const styles = document.createElement('style');

    styles.textContent = `
        #chessMount {
            color: #eee;
        }

        .rq-avatar {
            width: 48px;
            height: 48px;
            flex-shrink: 0;
            border-radius: 50%;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(145deg,#351016,#111);
            border: 2px solid #9d1828;
            color: #fff;
            font-size: 19px;
            font-weight: 900;
            position: relative;
        }

        .rq-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
            position: absolute;
            inset: 0;
        }

        .rq-avatar.large {
            width: 55px;
            height: 55px;
            font-size: 23px;
        }

        .rq-avatar.small {
            width: 37px;
            height: 37px;
            font-size: 15px;
        }

        .rq-player-card {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 11px;
            background: #111;
            border: 1px solid #292020;
            border-radius: 13px;
            min-width: 0;
            overflow: hidden;
        }

        .rq-player-card.active-turn {
            border-color: #b82038;
            box-shadow: 0 0 14px #b8203820;
        }

        .rq-player-info {
            flex: 1;
            min-width: 0;
        }

        .rq-player-name {
            color: #fff;
            font-size: 13px;
            font-weight: 850;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .rq-player-username {
            color: #888;
            font-size: 11px;
            margin-top: 3px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .rq-player-rank {
            color: #e33b4d;
            font-size: 10px;
            font-weight: 800;
            margin-top: 5px;
        }

        .rq-player-stats {
            display: flex;
            gap: 7px;
            margin-top: 5px;
            color: #888;
            font-size: 10px;
            flex-wrap: wrap;
        }

        .rq-clock {
            min-width: 67px;
            text-align: center;
            padding: 7px 8px;
            border-radius: 8px;
            background: #080808;
            border: 1px solid #302020;
            color: #fff;
            font-size: 18px;
            font-weight: 900;
            font-variant-numeric: tabular-nums;
        }

        .rq-clock.active {
            background: #3a0c15;
            border-color: #b82038;
            color: #ff5269;
            box-shadow: 0 0 12px #b8203825;
        }

        .rq-clock.low {
            color: #ff334e;
            animation: rqClockPulse .8s infinite alternate;
        }

        @keyframes rqClockPulse {
            from { opacity: 1; }
            to { opacity: .55; }
        }

        .rq-chess-players {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin: 14px 0;
        }

        .rq-mode-selector {
            display: grid;
            grid-template-columns: repeat(3,1fr);
            gap: 7px;
            margin: 14px 0;
        }

        .rq-mode-btn {
            background: #111;
            border: 1px solid #2b2022;
            border-radius: 10px;
            padding: 10px 4px;
            color: #999;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
        }

        .rq-mode-btn span {
            display: block;
            margin-top: 4px;
            font-size: 14px;
            color: #fff;
        }

        .rq-mode-btn.selected {
            border-color: #e12642;
            background: linear-gradient(145deg,#3b0d16,#160a0d);
            color: #ff4058;
            box-shadow: 0 0 14px #b8203820;
        }

        .rq-chess-board {
            width: 100%;
            aspect-ratio: 1;
            display: grid;
            grid-template-columns: repeat(8,1fr);
            overflow: hidden;
            border-radius: 7px;
            border: 2px solid #351019;
            box-shadow: 0 10px 35px #0009;
            touch-action: manipulation;
            background: #100d0e;
        }

        .rq-square {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 0;
            aspect-ratio: 1;
            cursor: pointer;
            overflow: hidden;
        }

        .rq-square.light { background: #741329; }
        .rq-square.dark { background: #100d0e; }

        .rq-square.selected {
            background: #b20e30 !important;
            box-shadow: inset 0 0 0 3px #ff3153;
        }

        .rq-square.last-move {
            box-shadow: inset 0 0 0 3px #e6d16c75;
        }

        .rq-square.legal::after {
            content: '';
            position: absolute;
            width: 25%;
            height: 25%;
            border-radius: 50%;
            background: #e4d8c590;
            z-index: 1;
        }

        .rq-square.capture::after {
            content: '';
            position: absolute;
            inset: 4%;
            border: 4px solid #e4d8c5a0;
            border-radius: 50%;
            z-index: 1;
        }

        .rq-piece {
            width: 98%;
            height: 98%;
            object-fit: contain;
            position: relative;
            z-index: 2;
            pointer-events: none;
            filter: drop-shadow(0 3px 3px #0008);
        }

        .rq-chess-status {
            text-align: center;
            color: #ddd;
            font-size: 12px;
            padding: 11px;
            background: #111;
            border: 1px solid #24191b;
            border-radius: 10px;
            margin: 10px 0;
        }

        .rq-chess-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }

        .rq-chess-actions button {
            flex: 1;
            border: 1px solid #392027;
            border-radius: 10px;
            background: #171010;
            color: white;
            padding: 12px 8px;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
        }

        .rq-chess-actions button.primary {
            background: #a7192b;
            border-color: #d32b40;
        }

        .rq-chess-actions button:disabled {
            opacity: .45;
        }

        .rq-leader-row {
            display: flex;
            align-items: center;
            gap: 11px;
            padding: 11px;
            border-bottom: 1px solid #252020;
        }

        .rq-leader-row.me {
            background: #281014;
        }

        .rq-rank-progress {
            margin-top: 12px;
            padding: 13px;
            background: #111;
            border: 1px solid #292020;
            border-radius: 12px;
        }

        .rq-progress-track {
            height: 7px;
            background: #292020;
            border-radius: 10px;
            overflow: hidden;
            margin-top: 9px;
        }

        .rq-progress-fill {
            height: 100%;
            background: linear-gradient(90deg,#8b1526,#ff4257);
            border-radius: 10px;
        }

        .rq-game-result {
            text-align: center;
            padding: 24px 12px;
            background: #170c0e;
            border: 1px solid #70202b;
            border-radius: 15px;
            margin-top: 14px;
            animation: rqResult .45s ease;
        }

        .rq-game-result h2 {
            color: #ff4057;
            font-size: 24px;
            margin: 0 0 8px;
        }

        .rq-game-result button {
            margin-top: 16px;
            background: #a7192b;
            color: white;
            border: 0;
            border-radius: 9px;
            padding: 12px 22px;
            font-weight: 900;
        }

        @keyframes rqResult {
            from { opacity: 0; transform: scale(.92); }
            to { opacity: 1; transform: scale(1); }
        }

        @media(max-width:360px) {
            .rq-chess-players { grid-template-columns: 1fr; }
            .rq-player-card { padding: 8px; }
            .rq-clock { min-width: 58px; font-size: 16px; }
        }
    `;

    document.head.appendChild(styles);

    // ==========================================
    // NAVIGATION
    // ==========================================

    function hideSections() {
        $$('.hero,.profile,.stats,.menu,.section-heading').forEach(el => {
            el.style.display = 'none';
        });

        ['gamesHub', 'chessScreen', 'ratingSection'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        }
    }

    function showHome() {
        hideSections();

        $$('.hero,.profile,.stats,.menu,.section-heading').forEach(el => {
            el.style.display = '';
        });

        $$('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === 'home');
        }
    }

    function showGames() {
        hideSections();

        const hub = $('#gamesHub');
        if (hub) hub.style.display = 'block';

        $$('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === 'games');
        }
    }

    function showChess() {
        hideSections();

        const screen = $('#chessScreen');
        if (screen) screen.style.display = 'block';

        $$('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === 'games');
        });

        initChessScreen();
    }

    function showRating() {
        hideSections();

        const section = $('#ratingSection');
        if (section) section.style.display = 'block';

        $$('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === 'rating');
        });

        loadLeaderboard();
    }

    $$('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            if (page === 'home') showHome();
            if (page === 'games') showGames();
            if (page === 'rating') showRating();
        });
    });

    $('#openChess')?.addEventListener('click', showChess);
    $('#backToGames')?.addEventListener('click', showGames);

    // ==========================================
    // REGISTER
    // ==========================================

    async function registerPlayer() {
        if (!currentUser) return null;

        try {
            const result = await api('/api/register', {
                method: 'POST',
                body: JSON.stringify({
                    initData: tg?.initData || '',
                    user: {
                        id: currentUser.id,
                        first_name: currentUser.first_name || '',
                        last_name: currentUser.last_name || '',
                        username: currentUser.username || '',
                        photo_url: currentUser.photo_url || ''
                    }
                })
            });

            return result.player || result;
        } catch (error) {
            console.error('Registration error:', error);
            return null;
        }
    }

    async function loadMyProfile() {
        if (!playerId) return null;

        try {
            const result = await api('/api/player/' + encodeURIComponent(playerId));
            currentPlayer = result.player || result;
            renderMyProfile(currentPlayer);
            return currentPlayer;
        } catch (error) {
            console.error('Profile error:', error);
            return null;
        }
    }

    // ==========================================
    // PROFILE
    // ==========================================

    function renderMyProfile(profile) {
        if (!profile) return;

        const nameElement = $('#username');
        if (nameElement) nameElement.textContent = getDisplayName(profile);

        const avatarElement = $('[data-user-avatar]');
        if (avatarElement) avatarElement.innerHTML = avatarHTML(profile);

        renderRankProgress(profile);
    }

    function renderRankProgress(profile) {
        const mount = $('#chessMount');
        if (!mount || !profile) return;

        const progress = Math.max(0, Math.min(100, Number(profile.progress || 0)));
        const remaining = Number(profile.elo_remaining || 0);

        let element = $('#rqRankProgress', mount);

        if (!element) {
            element = document.createElement('div');
            element.id = 'rqRankProgress';
            element.className = 'rq-rank-progress';
            mount.appendChild(element);
        }

        element.innerHTML = `
            <div style="display:flex;justify-content:space-between;gap:8px">
                <strong style="color:#fff">${escapeHTML(getRank(profile))}</strong>
                <span style="color:#aaa">${getElo(profile)} ELO</span>
            </div>
            <div class="rq-progress-track">
                <div class="rq-progress-fill" style="width:${progress}%"></div>
            </div>
            <div style="font-size:11px;color:#888;margin-top:7px">
                ${remaining > 0 ? `До следующего ранга: ${remaining} ELO` : 'Прогресс ранга'}
            </div>
        `;
    }

    // ==========================================
    // LEADERBOARD
    // ==========================================

    async function loadLeaderboard(mode = selectedMode) {
        const list = $('#ratingList');
        if (!list) return;

        list.innerHTML = '<div style="padding:20px;color:#888">Загрузка рейтинга...</div>';

        try {
            const result = await api('/api/leaderboard?mode=' + encodeURIComponent(mode));
            const players = Array.isArray(result)
                ? result
                : result.players || result.leaderboard || [];

            if (!players.length) {
                list.innerHTML = '<div style="padding:20px;color:#888">Пока нет игроков</div>';
                return;
            }

            list.innerHTML = players.map((player, index) => {
                const isMe = String(player.id) === playerId;

                return `
                    <div class="rq-leader-row ${isMe ? 'me' : ''}">
                        <div style="width:25px;color:#999;font-size:13px;font-weight:900">${index + 1}</div>
                        ${avatarHTML(player, 'small')}
                        <div class="rq-player-info">
                            <div class="rq-player-name">${escapeHTML(getDisplayName(player))}</div>
                            <div class="rq-player-username">${escapeHTML(getUsername(player))}</div>
                            <div class="rq-player-rank">${escapeHTML(getRank(player))}</div>
                        </div>
                        <div style="text-align:right">
                            <div class="rq-player-elo">${getElo(player)}</div>
                            <div style="font-size:10px;color:#888">ELO</div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Leaderboard error:', error);
            list.innerHTML = '<div style="padding:20px;color:#888">Не удалось загрузить рейтинг</div>';
        }
    }

    // ==========================================
    // CHESS SCREEN
    // ==========================================

    function initChessScreen() {
        const mount = $('#chessMount');
        if (!mount || mount.dataset.initialized === 'true') return;

        mount.dataset.initialized = 'true';

        mount.innerHTML = `
            <div class="rq-chess-title">
                <div style="font-size:23px;font-weight:950;color:#fff;letter-spacing:1px">REQUIEM CHESS</div>
                <div style="font-size:10px;color:#888;margin-top:4px;letter-spacing:2px">ONLINE RANKED MATCH</div>
            </div>

            <div class="rq-mode-selector">
                ${Object.entries(MODES).map(([key, mode]) => `
                    <button class="rq-mode-btn ${key === selectedMode ? 'selected' : ''}"
                            data-mode="${key}">
                        ${mode.name}
                        <span>${mode.label}</span>
                    </button>
                `).join('')}
            </div>

            <div class="rq-chess-players">
                <div id="rqWhitePlayer" class="rq-player-card">
                    <div class="rq-avatar large"><span>W</span></div>
                    <div class="rq-player-info">
                        <div class="rq-player-name">Ожидание игрока</div>
                        <div class="rq-player-username">Белые</div>
                        <div class="rq-player-rank">—</div>
                    </div>
                    <div id="rqWhiteClock" class="rq-clock">${formatTime(MODES[selectedMode].time)}</div>
                </div>

                <div id="rqBlackPlayer" class="rq-player-card">
                    <div class="rq-avatar large"><span>B</span></div>
                    <div class="rq-player-info">
                        <div class="rq-player-name">Ожидание игрока</div>
                        <div class="rq-player-username">Чёрные</div>
                        <div class="rq-player-rank">—</div>
                    </div>
            <div id="rqBlackClock" class="rq-clock">${formatTime(MODES[selectedMode].time)}</div>
                </div>
            </div>

            <div id="rqChessStatus" class="rq-chess-status">
                Выбери режим и создай комнату
            </div>

            <div id="rqChessBoard" class="rq-chess-board"></div>

            <div class="rq-chess-actions">
                <button id="rqCreateRoom" class="primary">Создать игру</button>
                <button id="rqJoinRoom">Войти в игру</button>
            </div>

            <div id="rqRoomControls" style="display:none;margin-top:12px">
                <div style="display:flex;gap:8px">
                    <input id="rqRoomCode" placeholder="Код комнаты"
                        style="flex:1;min-width:0;background:#111;border:1px solid #392027;color:white;padding:12px;border-radius:9px">
                    <button id="rqCopyCode" style="background:#211215;color:white;border:1px solid #70202b;border-radius:9px;padding:10px">Копировать</button>
                </div>
                <button id="rqLeaveRoom"
                    style="width:100%;margin-top:8px;background:#211215;color:#fff;border:1px solid #392027;padding:12px;border-radius:9px">
                    Покинуть игру
                </button>
            </div>

            <div id="rqResult"></div>
        `;

        $$('.rq-mode-btn', mount).forEach(button => {
            button.addEventListener('click', () => {
                if (roomId) {
                    showToast('Сначала покинь текущую комнату');
                    return;
                }

                selectedMode = button.dataset.mode;

                $$('.rq-mode-btn', mount).forEach(btn => {
                    btn.classList.toggle('selected', btn.dataset.mode === selectedMode);
                });

                clocks.white = MODES[selectedMode].time;
                clocks.black = MODES[selectedMode].time;
                updateClocks();

                showToast(`${MODES[selectedMode].name}: ${MODES[selectedMode].label}`);
            });
        });

        $('#rqCreateRoom', mount)?.addEventListener('click', createRoom);
        $('#rqJoinRoom', mount)?.addEventListener('click', joinRoom);
        $('#rqCopyCode', mount)?.addEventListener('click', copyRoomCode);
        $('#rqLeaveRoom', mount)?.addEventListener('click', leaveRoom);

        renderBoard();
        loadChessLibrary();
    }

    // ==========================================
    // CHESS ENGINE
    // ==========================================

    function loadChessLibrary() {
        if (window.Chess) {
            chessLoaded = true;
            chess = new window.Chess();
            renderBoard();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js';

        script.onload = () => {
            chessLoaded = true;
            chess = new window.Chess();
            renderBoard();
        };

        script.onerror = () => showToast('Не удалось загрузить шахматный движок');

        document.head.appendChild(script);
    }

    // ==========================================
    // SVG CHESS PIECES
    // ==========================================

    function getPieceImage(type, color) {
        const white = color === 'white';

        const palette = white
            ? { base: '#ff2448', mid: '#ff7890', dark: '#7c0c25', edge: '#ffd0da' }
            : { base: '#17191d', mid: '#737985', dark: '#030405', edge: '#d3d7df' };

        const p = palette;

        const shapes = {
            p: `
                <path d="M50 18 C37 18 29 28 31 39 C32 45 37 49 42 51
                L38 63 L30 70 L27 82 L73 82 L70 70 L62 63 L58 51
                C64 48 69 44 69 38 C69 27 61 18 50 18Z"/>
                <path d="M38 63 L62 63 L69 70 L31 70Z" fill="${p.mid}"/>
                <path d="M27 82 L73 82 L78 90 L22 90Z"/>
            `,
            r: `
                <path d="M24 18 L36 18 L36 28 L44 28 L44 18 L56 18 L56 28
                L64 28 L64 18 L76 18 L76 38 L69 43 L68 69 L32 69 L31 43
                L24 38Z"/>
                <path d="M31 43 L69 43 L66 69 L34 69Z" fill="${p.mid}"/>
                <path d="M27 69 L73 69 L78 84 L22 84Z"/>
                <path d="M22 84 L78 84 L82 91 L18 91Z"/>
            `,
            n: `
                <path d="M25 81 L26 68 L34 57 L32 43 L40 28 L53 17
                L70 24 L78 40 L71 49 L59 47 L54 55 L66 67 L72 81Z"/>
                <path d="M39 31 L51 24 L63 29 L70 41 L59 41 L53 50
                L43 49 L39 39Z" fill="${p.mid}"/>
                <path d="M27 68 L64 68 L72 81 L25 81Z"/>
                <path d="M22 81 L78 81 L82 91 L18 91Z"/>
                <circle cx="61" cy="33" r="3.5" fill="${p.edge}"/>
            `,
            b: `
                <path d="M50 13 L58 26 L54 32 C65 38 68 48 63 58
                L58 65 L67 73 L74 82 L26 82 L33 73 L42 65 L37 58
                C32 48 35 38 46 32 L42 26Z"/>
                <path d="M46 32 L54 32 C63 39 64 47 59 56 L50 62
                L41 56 C36 47 38 39 46 32Z" fill="${p.mid}"/>
                <path d="M28 82 L72 82 L78 91 L22 91Z"/>
            `,
            q: `
                <path d="M22 25 L34 39 L40 25 L50 39 L60 25 L66 39
                L78 25 L72 54 L67 67 L33 67 L28 54Z"/>
                <circle cx="22" cy="22" r="6"/>
                <circle cx="40" cy="22" r="6"/>
                <circle cx="50" cy="15" r="6"/>
                <circle cx="60" cy="22" r="6"/>
                <circle cx="78" cy="22" r="6"/>
                <path d="M33 67 L67 67 L72 79 L28 79Z" fill="${p.mid}"/>
                <path d="M24 79 L76 79 L80 91 L20 91Z"/>
            `,
            k: `
                <path d="M44 12 L56 12 L56 27 L68 27 L68 38 L58 38
                L63 52 L67 68 L33 68 L37 52 L42 38 L32 38 L32 27
                L44 27Z"/>
                <path d="M42 38 L58 38 L62 52 L38 52Z" fill="${p.mid}"/>
                <path d="M30 68 L70 68 L75 82 L25 82Z"/>
                <path d="M22 82 L78 82 L82 91 L18 91Z"/>
            `
        };

        const typeKey = String(type).toLowerCase();
        const shape = shapes[typeKey] || shapes.p;

        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                <defs>
                    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="${p.mid}"/>
                        <stop offset="45%" stop-color="${p.base}"/>
                        <stop offset="100%" stop-color="${p.dark}"/>
                    </linearGradient>
                    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
                        <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity=".65"/>
                    </filter>
                </defs>
                <g fill="url(#metal)" stroke="${p.edge}" stroke-width="1.8"
                   stroke-linejoin="round" stroke-linecap="round" filter="url(#shadow)">
                    ${shape}
                </g>
            </svg>
        `;

        return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    }

    // ==========================================
    // PLAYER CARDS
    // ==========================================

    function renderPlayerCard(profile, color) {
        const element = $('#rq' + (color === 'white' ? 'White' : 'Black') + 'Player');
        if (!element) return;

        if (!profile) {
            element.innerHTML = `
                <div class="rq-avatar large"><span>${color === 'white' ? 'W' : 'B'}</span></div>
                <div class="rq-player-info">
                    <div class="rq-player-name">Ожидание игрока</div>
                    <div class="rq-player-username">${color === 'white' ? 'Белые' : 'Чёрные'}</div>
                    <div class="rq-player-rank">—</div>
                </div>
                <div class="rq-clock" id="${color === 'white' ? 'rqWhiteClock' : 'rqBlackClock'}">${formatTime(MODES[selectedMode].time)}</div>
            `;
            return;
        }

        const wins = Number(profile.wins || 0);
        const losses = Number(profile.losses || 0);
        const draws = Number(profile.draws || 0);

        element.innerHTML = `
            ${avatarHTML(profile, 'large')}
            <div class="rq-player-info">
                <div class="rq-player-name">${escapeHTML(getDisplayName(profile))}</div>
                <div class="rq-player-username">${escapeHTML(getUsername(profile))}</div>
                <div class="rq-player-rank">${escapeHTML(getRank(profile))} · ${getElo(profile)} ELO</div>
                <div class="rq-player-stats">
                    <span>П ${wins}</span>
                    <span>Пор ${losses}</span>
                    <span>Н ${draws}</span>
                </div>
            </div>
            <div class="rq-clock" id="${color === 'white' ? 'rqWhiteClock' : 'rqBlackClock'}">${formatTime(clocks[color])}</div>
        `;

        element.classList.toggle('active-turn', state.gameStarted && chess?.turn() === (color === 'white' ? 'w' : 'b'));
    }

    function updatePlayers(profiles = {}) {
        currentProfiles = profiles || {};

        renderPlayerCard(currentProfiles.white || null, 'white');
        renderPlayerCard(currentProfiles.black || null, 'black');

        currentPlayer = playerColor ? currentProfiles[playerColor] : null;
        opponentPlayer = playerColor
            ? currentProfiles[playerColor === 'white' ? 'black' : 'white']
            : null;

        if (currentPlayer) renderMyProfile(currentPlayer);
    }

    // ==========================================
    // ROOM CREATION
    // ==========================================

    async function createRoom() {
        if (!playerId) {
            showToast('Открой игру через Telegram');
            return;
        }

        if (roomId) {
            showToast('Сначала покинь текущую комнату');
            return;
        }

        try {
            await registerPlayer();

            const result = await api('/api/chess/create', {
                method: 'POST',
                body: JSON.stringify({
                    initData: tg?.initData || '',
                    player_id: playerId,
                    mode: selectedMode
                })
            });

            if (!result.success) throw new Error(result.error || 'Не удалось создать комнату');

            roomId = result.room_id || result.room || result.code;
            playerColor = normalizeColor(result.color) || 'white';

            if (!roomId) throw new Error('Сервер не вернул код комнаты');

            clocks.white = result.initial_time || MODES[selectedMode].time;
            clocks.black = result.initial_time || MODES[selectedMode].time;

            state.gameOver = false;
            state.gameStarted = false;
            state.boardLocked = true;

            connectSocket(roomId);

            $('#rqRoomCode').value = roomId;
            $('#rqRoomControls').style.display = 'block';

            setStatus(`Комната создана · ${MODES[selectedMode].name}. Ожидаем второго игрока...`);
            updateClocks();

        } catch (error) {
            console.error('Create room error:', error);
            showToast(error.message || 'Ошибка создания комнаты');
        }
    }

    // ==========================================
    // JOIN ROOM
    // ==========================================

    async function joinRoom() {
        const code = prompt('Введите код комнаты');
        if (!code) return;

        if (!playerId) {
            showToast('Открой игру через Telegram');
            return;
        }

        if (roomId) {
            showToast('Сначала покинь текущую комнату');
            return;
        }

        try {
            await registerPlayer();

            roomId = code.trim();
            selectedMode = 'blitz';

            connectSocket(roomId);

            $('#rqRoomCode').value = roomId;
            $('#rqRoomControls').style.display = 'block';
            setStatus('Подключение к комнате...');
        } catch (error) {
            showToast(error.message || 'Ошибка подключения');
        }
    }

    // ==========================================
    // WEBSOCKET
    // ==========================================

    function connectSocket(code) {
        if (socket) {
            socket.onclose = null;
            socket.close();
        }

        const initData = encodeURIComponent(tg?.initData || '');
        const url = `wss://requiem-bot-7eyu.onrender.com/ws/chess/${encodeURIComponent(code)}?initData=${initData}`;

        socket = new WebSocket(url);
        state.connected = false;

        setStatus('Подключение к серверу...');

        socket.onopen = () => {
            state.connected = true;
            showToast('Подключено к комнате');
        };

        socket.onmessage = event => {
            let data;

            try {
                data = JSON.parse(event.data);
            } catch {
                console.error('Invalid WebSocket message', event.data);
                return;
            }

            handleChessMessage(data);
        };

        socket.onerror = error => {
            console.error('WebSocket error', error);
            setStatus('Ошибка соединения');
        };

        socket.onclose = () => {
            state.connected = false;

            if (!state.gameOver) setStatus('Соединение закрыто');
        };
    }

    // ==========================================
    // SERVER MESSAGE HANDLER
    // ==========================================

    function handleChessMessage(data) {
        if (data.error) {
            showToast(data.error);
            return;
        }

        if (data.color) playerColor = normalizeColor(data.color) || playerColor;
        if (data.room_id) roomId = data.room_id;

        if (data.mode && MODES[data.mode]) {
            selectedMode = data.mode;
            updateModeButtons();
        }

        if (data.initial_time) {
            clocks.white = Number(data.initial_time);
            clocks.black = Number(data.initial_time);
        }

        if (data.profiles) updatePlayers(data.profiles);

        if (Array.isArray(data.players)) {
            state.gameStarted = data.players.length >= 2;
        }

        if (data.started !== undefined) state.gameStarted = !!data.started;

        if (data.clocks) {
            if (data.clocks.white !== undefined) clocks.white = Number(data.clocks.white);
            if (data.clocks.black !== undefined) clocks.black = Number(data.clocks.black);
            lastClockTick = Date.now();
            updateClocks();
        }

        if (data.fen) {
            state.lastFen = data.fen;

            if (chessLoaded && chess) {
                try {
                    chess.load(data.fen);
                    selectedSquare = null;
                    legalMoves = [];
                    renderBoard();
                } catch (error) {
                    console.error('FEN error:', error);
                }
            }
        }

        if (data.turn !== undefined) {
            const turn = normalizeTurn(data.turn);
            const myTurn = turn === (playerColor === 'white' ? 'w' : 'b');

            state.boardLocked = !myTurn || !state.gameStarted || state.gameOver;

            if (!state.gameOver) {
                setStatus(!state.gameStarted
                    ? 'Ожидаем второго игрока...'
                    : myTurn
                        ? 'Ваш ход'
                        : `Ход соперника (${turn === 'w' ? 'Белые' : 'Чёрные'})`);
            }

            renderBoard();
            updatePlayers(currentProfiles);
        }

        if (data.game_over) {
            state.gameOver = true;
            state.boardLocked = true;
            stopClock();
            showGameResult(data.result);
        }

        if (data.success && data.room_id) {
            $('#rqRoomCode').value = data.room_id;
        }

        if (data.opponent_name && !data.profiles) {
            const opponentColor = playerColor === 'white' ? 'black' : 'white';
            const profile = currentProfiles[opponentColor] || {};
            profile.first_name = data.opponent_name;
            renderPlayerCard(profile, opponentColor);
        }
    }

    function updateModeButtons() {
        $$('.rq-mode-btn').forEach(button => {
            button.classList.toggle('selected', button.dataset.mode === selectedMode);
        });
    }

    // ==========================================
    // STATUS
    // ==========================================

    function setStatus(message) {
        const element = $('#rqChessStatus');
        if (element) element.textContent = message;
    }

    // ==========================================
    // CLOCKS
    // ==========================================

    function updateClocks() {
        const white = $('#rqWhiteClock');
        const black = $('#rqBlackClock');

        if (white) {
            white.textContent = formatTime(clocks.white);
            white.classList.toggle('active', state.gameStarted && chess?.turn() === 'w');
            white.classList.toggle('low', clocks.white <= 20);
        }

        if (black) {
            black.textContent = formatTime(clocks.black);
            black.classList.toggle('active', state.gameStarted && chess?.turn() === 'b');
            black.classList.toggle('low', clocks.black <= 20);
        }
    }

    function stopClock() {
        if (clockInterval) clearInterval(clockInterval);
        clockInterval = null;
    }

    // This is a visual clock only; the server remains authoritative.
    function startVisualClock() {
        stopClock();
        lastClockTick = Date.now();

        clockInterval = setInterval(() => {
            if (!state.gameStarted || state.gameOver) return;

            const now = Date.now();
            const elapsed = (now - lastClockTick) / 1000;
            lastClockTick = now;

            const turn = chess?.turn();
            if (turn === 'w') clocks.white = Math.max(0, clocks.white - elapsed);
            if (turn === 'b') clocks.black = Math.max(0, clocks.black - elapsed);

            updateClocks();
        }, 250);
    }

    // ==========================================
    // BOARD RENDERING
    // ==========================================

    function renderBoard() {
        const board = $('#rqChessBoard');
        if (!board || !chessLoaded || !chess) return;

        const rows = chess.board();
        const files = ['a','b','c','d','e','f','g','h'];
        let html = '';

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = rows[row][col];
                const square = files[col] + (8 - row);
                const light = (row + col) % 2 === 0;
                const selected = selectedSquare === square;
                const legal = legalMoves.some(move => move.to === square);
                const capture = legal && chess.get(square);

                let classes = `rq-square ${light ? 'light' : 'dark'}`;

                if (selected) classes += ' selected';
                if (lastMoveSquares.includes(square)) classes += ' last-move';
                if (legal) classes += capture ? ' capture' : ' legal';

                let pieceHTML = '';

                if (piece) {
                    const color = piece.color === 'w' ? 'white' : 'black';

                    pieceHTML = `
                        <img class="rq-piece"
                             draggable="false"
                             alt="${color} ${piece.type}"
                             src="${getPieceImage(piece.type, color)}">
                    `;
                }

                html += `
                    <div class="${classes}" data-square="${square}">
                        ${pieceHTML}
                    </div>
                `;
            }
        }

        board.innerHTML = html;

        $$('.rq-square', board).forEach(square => {
            square.addEventListener('click', () => handleSquareClick(square.dataset.square));
        });
    }

    // ==========================================
    // MOVE HANDLING
    // ==========================================

    function handleSquareClick(square) {
        if (!chessLoaded || !chess || !state.connected) return;
        if (state.boardLocked || state.gameOver || !state.gameStarted) return;

        const piece = chess.get(square);
        const myColor = playerColor === 'white' ? 'w' : 'b';

        if (selectedSquare) {
            const move = legalMoves.find(item => item.to === square);

            if (move) {
                sendMove(selectedSquare, square, move);
                return;
            }
        }

        if (piece && piece.color === myColor && chess.turn() === myColor) {
            selectedSquare = square;
            legalMoves = chess.moves({ square, verbose: true });
            renderBoard();
            return;
        }

        selectedSquare = null;
        legalMoves = [];
        renderBoard();
    }

    function sendMove(from, to, move) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            showToast('Нет соединения с сервером');
            return;
        }

        socket.send(JSON.stringify({
            type: 'move',
            from,
            to,
            promotion: move.flags.includes('p') ? 'q' : ''
        }));

        lastMoveSquares = [from, to];
        selectedSquare = null;
        legalMoves = [];
        renderBoard();
    }

    // ==========================================
    // GAME RESULT
    // ==========================================

    function showGameResult(result) {
        const element = $('#rqResult');
        if (!element) return;

        let title = 'НИЧЬЯ';
        let description = 'Партия завершилась вничью';

        if (result === 'white' || result === '1-0') {
            title = playerColor === 'white' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
            description = playerColor === 'white' ? 'Вы выиграли партию' : 'Победили белые';
        }

        if (result === 'black' || result === '0-1') {
            title = playerColor === 'black' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
            description = playerColor === 'black' ? 'Вы выиграли партию' : 'Победили чёрные';
        }

        element.innerHTML = `
            <div class="rq-game-result">
                <h2>${title}</h2>
                <div style="color:#aaa">${description}</div>
                <button id="rqNewGame">Новая игра</button>
            </div>
        `;

        $('#rqNewGame')?.addEventListener('click', () => {
            leaveRoom();
            element.innerHTML = '';
        });

        loadMyProfile();
        loadLeaderboard();
    }

    // ==========================================
    // ROOM CONTROLS
    // ==========================================

    async function copyRoomCode() {
        const code = $('#rqRoomCode')?.value || roomId;
        if (!code) return;

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(code);
                showToast('Код комнаты скопирован');
            } else {
                const input = $('#rqRoomCode');
                input.select();
                document.execCommand('copy');
                showToast('Код комнаты скопирован');
            }
        } catch {
            showToast('Не удалось скопировать код');
        }
    }

    function leaveRoom() {
        stopClock();

        if (socket) {
            socket.onclose = null;
            socket.close();
            socket = null;
        }

        roomId = null;
        playerColor = null;
        selectedSquare = null;
        legalMoves = [];
        lastMoveSquares = [];

        state.connected = false;
        state.gameStarted = false;
        state.gameOver = false;
        state.boardLocked = true;

        currentProfiles = {};
        currentPlayer = null;
        opponentPlayer = null;

        clocks.white = MODES[selectedMode].time;
        clocks.black = MODES[selectedMode].time;

        if (chessLoaded && window.Chess) {
            chess = new window.Chess();
            renderBoard();
        }

        renderPlayerCard(null, 'white');
        renderPlayerCard(null, 'black');

        const controls = $('#rqRoomControls');
        if (controls) controls.style.display = 'none';

        const result = $('#rqResult');
        if (result) result.innerHTML = '';

        setStatus('Выбери режим и создай комнату');
        updateClocks();
    }

    // ==========================================
    // STARTUP
    // ==========================================

    async function start() {
        if (currentUser) {
            const nameElement = $('#username');
            if (nameElement) nameElement.textContent = getDisplayName(currentUser);
        }

        await registerPlayer();
        await loadMyProfile();
        await loadLeaderboard();
    }

    showHome();

    start().catch(error => {
        console.error('REQUIEM initialization error:', error);
    });

});
