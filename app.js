
document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // =============================================
    // REQUIEM CHESS — STABLE CLIENT
    // =============================================

    const tg = window.Telegram?.WebApp;
    const API = 'https://requiem-bot-7eyu.onrender.com';

    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];

    const user = tg?.initDataUnsafe?.user || null;
    const uid = user?.id ? String(user.id) : null;

    const MODES = {
        bullet: { name: 'ПУЛЯ', seconds: 120, label: '2 минуты' },
        blitz:  { name: 'БЛИЦ', seconds: 300, label: '5 минут' },
        rapid:  { name: 'РАПИД', seconds: 600, label: '10 минут' }
    };

    let mode = 'blitz';
    let chess = null;
    let chessReady = false;
    let socket = null;
    let room = null;
    let color = null;
    let selected = null;
    let moves = [];
    let lastMove = [];
    let profiles = {};
    let clocks = { white: 300, black: 300 };
    let clockTimer = null;
    let clockTimestamp = 0;
    let myProfile = null;
    let gameResultShown = false;

    const game = {
        connected: false,
        started: false,
        over: false,
        locked: true
    };

    // =============================================
    // TELEGRAM
    // =============================================

    if (tg) {
        tg.ready();
        tg.expand();
        tg.setHeaderColor?.('#080808');
        tg.setBackgroundColor?.('#080808');
    }

    // =============================================
    // HELPERS
    // =============================================

    function esc(value = '') {
        return String(value).replace(/[&<>"']/g, c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[c]);
    }

    function displayName(p) {
        if (!p) return 'Ожидание игрока';
        return `${p.first_name || ''} ${p.last_name || ''}`.trim()
            || p.username
            || `Игрок ${p.id || ''}`;
    }

    function username(p) {
        return p?.username ? '@' + p.username.replace(/^@/, '') : 'Telegram';
    }

    function initials(p) {
        return displayName(p).charAt(0).toUpperCase() || 'R';
    }

    function elo(p) {
        return Number(p?.elo ?? p?.rating ?? 1000);
    }

    function rank(p) {
        return p?.rank_label || p?.rank_name || p?.rank || 'HUNTER';
    }

    function photo(p) {
        return p?.photo_url || p?.avatar_url || '';
    }

    function avatar(p, cls = '') {
        const image = photo(p);
        const initial = initials(p);

        return `
            <div class="rq-avatar ${cls}">
                ${image ? `
                    <img src="${esc(image)}"
                         onerror="this.remove()"
                         alt="">
                ` : ''}
                <span>${esc(initial)}</span>
            </div>
        `;
    }

    function fmtTime(value) {
        const seconds = Math.max(0, Math.floor(Number(value) || 0));
        return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }

    function toast(message) {
        let el = $('#toast');

        if (!el) {
            el = document.createElement('div');
            el.id = 'toast';
            document.body.appendChild(el);
        }

        el.textContent = message;
        el.classList.add('show');

        clearTimeout(el._timer);
        el._timer = setTimeout(() => el.classList.remove('show'), 2600);
    }

    async function request(path, options = {}) {
        const response = await fetch(API + path, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.detail || data.error || `HTTP ${response.status}`);
        }

        return data;
    }

    function normalizeColor(c) {
        if (c === 'white' || c === 'w') return 'white';
        if (c === 'black' || c === 'b') return 'black';
        return null;
    }

    function normalizeTurn(t) {
        if (t === 'white') return 'w';
        if (t === 'black') return 'b';
        return t;
    }

    function modeName() {
        return MODES[mode]?.name || 'БЛИЦ';
    }

    // =============================================
    // STYLES
    // =============================================

    const style = document.createElement('style');

    style.textContent = `
        #chessMount { color:#eee; }

        .rq-avatar {
            width:46px;height:46px;flex-shrink:0;
            border-radius:50%;overflow:hidden;position:relative;
            display:flex;align-items:center;justify-content:center;
            background:linear-gradient(145deg,#3b111b,#100c0d);
            border:2px solid #9d1828;color:white;
            font-weight:900;font-size:18px;
        }
        .rq-avatar img {
            position:absolute;inset:0;width:100%;height:100%;
            object-fit:cover;z-index:2;
        }
        .rq-avatar.large {width:48px;height:48px;font-size:21px}
        .rq-avatar.small {width:36px;height:36px;font-size:14px}

        .rq-player-card {
            display:flex;align-items:center;gap:8px;
            padding:9px;background:#111;
            border:1px solid #292020;border-radius:12px;
            min-width:0;overflow:hidden;
        }
        .rq-player-card.turn-active {
            border-color:#c52640;
            box-shadow:0 0 12px #a3153020;
        }
        .rq-player-info {flex:1;min-width:0}
        .rq-player-name {
            font-size:12px;font-weight:900;color:#fff;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        }
        .rq-player-username {
            font-size:10px;color:#888;margin-top:3px;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        }
        .rq-player-rank {
            color:#e43b4d;font-size:10px;font-weight:800;margin-top:4px;
        }
        .rq-player-stats {
            display:flex;gap:6px;flex-wrap:wrap;
            color:#888;font-size:9px;margin-top:4px;
        }

        .rq-clock {
            background:#080808;border:1px solid #332126;
            border-radius:8px;padding:7px 5px;
            min-width:56px;text-align:center;
            color:white;font-size:16px;font-weight:900;
            font-variant-numeric:tabular-nums;
        }
        .rq-clock.active {
            border-color:#d52b45;background:#320d16;color:#ff5269;
        }
        .rq-clock.danger {color:#ff334e}

        .rq-chess-players {
            display:grid;grid-template-columns:1fr 1fr;
            gap:7px;margin:12px 0;
        }

        .rq-mode-selector {
            display:grid;grid-template-columns:repeat(3,1fr);
            gap:7px;margin:12px 0;
        }
        .rq-mode-btn {
            border:1px solid #2b2022;border-radius:10px;
            background:#111;color:#888;padding:10px 3px;
            font-size:10px;font-weight:900;
        }
        .rq-mode-btn span {
            display:block;color:#fff;font-size:13px;margin-top:4px;
        }
        .rq-mode-btn.selected {
            color:#ff4058;border-color:#e12642;
            background:linear-gradient(145deg,#3b0d16,#160a0d);
        }

        .rq-chess-board {
            width:100%;aspect-ratio:1;
            display:grid;grid-template-columns:repeat(8,1fr);
            overflow:hidden;border-radius:5px;
            border:2px solid #46111c;
            background:#100d0e;touch-action:manipulation;
            box-shadow:0 10px 30px #0008;
        }
        .rq-square {
            position:relative;display:flex;
            align-items:center;justify-content:center;
            min-width:0;aspect-ratio:1;overflow:hidden;
            cursor:pointer;
        }
        .rq-square.light {background:#741329}
        .rq-square.dark {background:#100d0e}
        .rq-square.selected {
            background:#ad1834!important;
            box-shadow:inset 0 0 0 3px #ff3856;
        }
        .rq-square.last-move {
            box-shadow:inset 0 0 0 3px #e6d16c75;
        }
        .rq-square.legal::after {
            content:'';position:absolute;width:24%;height:24%;
            background:#ddd9d2a0;border-radius:50%;z-index:1;
        }
        .rq-square.capture::after {
            content:'';position:absolute;inset:5%;
            border:3px solid #ddd9d280;border-radius:50%;z-index:1;
        }
        .rq-piece {
            width:97%;height:97%;object-fit:contain;
            position:relative;z-index:2;pointer-events:none;
        }

        .rq-chess-status {
            text-align:center;color:#ddd;font-size:12px;
            padding:11px;background:#111;
            border:1px solid #281a1d;border-radius:9px;margin:10px 0;
        }
        .rq-chess-actions {display:flex;gap:8px;margin-top:10px}
        .rq-chess-actions button {
            flex:1;border:1px solid #392027;border-radius:10px;
            background:#171010;color:white;padding:12px 6px;
            font-size:12px;font-weight:900;cursor:pointer;
        }
        .rq-chess-actions button.primary {
            background:#a7192b;border-color:#d32b40;
        }

        .rq-rank-progress {
            margin-top:12px;padding:13px;background:#111;
            border:1px solid #292020;border-radius:12px;
        }
        .rq-progress-track {
            height:7px;background:#292020;
            border-radius:10px;overflow:hidden;margin-top:9px;
        }
        .rq-progress-fill {
            height:100%;background:linear-gradient(90deg,#8b1526,#ff4257);
        }

        .rq-leader-row {
            display:flex;align-items:center;gap:10px;
            padding:11px;border-bottom:1px solid #252020;
        }
        .rq-leader-row.me {background:#281014}

        .rq-result {
            text-align:center;padding:22px 10px;
            background:#170c0e;border:1px solid #70202b;
            border-radius:15px;margin-top:12px;
        }
        .rq-result h2 {color:#ff4057;margin:0 0 8px;font-size:24px}
        .rq-result button {
            margin-top:14px;background:#a7192b;color:white;
            border:0;border-radius:9px;padding:12px 20px;font-weight:900;
        }

        @media(max-width:350px) {
            .rq-chess-players {grid-template-columns:1fr}
        }
    `;

    document.head.appendChild(style);

    // =============================================
    // NAVIGATION
    // =============================================

    function hideSections() {
        $$('.hero,.profile,.stats,.menu,.section-heading').forEach(el => {
            el.style.display = 'none';
        });

        ['gamesHub', 'chessScreen', 'ratingSection'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    function navActive(page) {
        $$('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === page);
        });
    }

    function showHome() {
        hideSections();
        $$('.hero,.profile,.stats,.menu,.section-heading').forEach(el => {
            el.style.display = '';
        });
        navActive('home');
    }

    function showGames() {
        hideSections();
        if ($('#gamesHub')) $('#gamesHub').style.display = 'block';
        navActive('games');
    }

    function showChess() {
        hideSections();
        if ($('#chessScreen')) $('#chessScreen').style.display = 'block';
        navActive('games');
        initChess();
    }

    function showRating() {
        hideSections();
        if ($('#ratingSection')) $('#ratingSection').style.display = 'block';
        navActive('rating');
        loadLeaderboard();
    }

    $$('.nav-item').forEach(el => {
        el.addEventListener('click', () => {
            switch (el.dataset.page) {
                case 'home': showHome(); break;
                case 'games': showGames(); break;
                case 'rating': showRating(); break;
            }
        });
    });

    $('#openChess')?.addEventListener('click', showChess);
    $('#backToGames')?.addEventListener('click', showGames);

    // =============================================
    // PLAYER REGISTER / PROFILE
    // =============================================

    async function register() {
        if (!user || !tg?.initData) return null;

        try {
            const data = await request('/api/register', {
                method: 'POST',
                body: JSON.stringify({ initData: tg.initData })
            });
            return data.player || data;
        } catch (e) {
            console.error('Register:', e);
            return null;
        }
    }

    async function loadProfile() {
        if (!uid) return null;

        try {
            const data = await request('/api/player/' + encodeURIComponent(uid));
            myProfile = data.player || data;
            renderProfile(myProfile);
            return myProfile;
        } catch (e) {
            console.error('Profile:', e);
            return null;
        }
    }

    function renderProfile(p) {
        if (!p) return;

        if ($('#username')) $('#username').textContent = displayName(p);

        const avatarNode = $('[data-user-avatar]');
        if (avatarNode) avatarNode.innerHTML = avatar(p);

        renderRank(p);
    }

    function renderRank(p) {
        const mount = $('#chessMount');
        if (!mount || !p) return;

        let node = $('#rqRankProgress', mount);

        if (!node) {
            node = document.createElement('div');
            node.id = 'rqRankProgress';
            node.className = 'rq-rank-progress';
            mount.appendChild(node);
        }

        const progress = Math.max(0, Math.min(100, Number(p.progress || 0)));
        const remaining = Number(p.elo_remaining || 0);

        node.innerHTML = `
            <div style="display:flex;justify-content:space-between">
                <b>${esc(rank(p))}</b>
                <span>${elo(p)} ELO</span>
            </div>
            <div class="rq-progress-track">
                <div class="rq-progress-fill" style="width:${progress}%"></div>
            </div>
            <div style="font-size:11px;color:#888;margin-top:7px">
                ${remaining > 0 ? `До следующего ранга: ${remaining} ELO` : 'Рейтинг'}
            </div>
        `;
    }

    // =============================================
    // LEADERBOARD
    // =============================================

    async function loadLeaderboard() {
        const list = $('#ratingList');
        if (!list) return;

        list.innerHTML = '<div style="padding:18px;color:#888">Загрузка рейтинга...</div>';

        try {
            const data = await request('/api/leaderboard?mode=' + encodeURIComponent(mode));
            const players = data.leaderboard || data.players || (Array.isArray(data) ? data : []);

            if (!players.length) {
                list.innerHTML = '<div style="padding:18px;color:#888">Пока нет игроков</div>';
                return;
            }

            list.innerHTML = players.map((p, i) => `
                <div class="rq-leader-row ${String(p.id) === uid ? 'me' : ''}">
                    <b style="width:22px;color:#999">${i + 1}</b>
                    ${avatar(p, 'small')}
                    <div class="rq-player-info">
                        <div class="rq-player-name">${esc(displayName(p))}</div>
                        <div class="rq-player-username">${esc(username(p))}</div>
                        <div class="rq-player-rank">${esc(rank(p))}</div>
                    </div>
                    <div style="text-align:right">
                        <b>${elo(p)}</b>
                        <div style="font-size:9px;color:#888">ELO</div>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            console.error('Leaderboard:', e);
            list.innerHTML = '<div style="padding:18px;color:#888">Ошибка загрузки рейтинга</div>';
        }
    }

    // =============================================
    // CHESS UI
    // =============================================

    function initChess() {
        const mount = $('#chessMount');
        if (!mount || mount.dataset.ready === '1') return;
        mount.dataset.ready = '1';

        mount.innerHTML = `
            <div style="padding:5px 0">
                <div style="font-size:23px;font-weight:950;color:#fff">REQUIEM CHESS</div>
                <div style="font-size:10px;color:#888;letter-spacing:2px;margin-top:3px">ONLINE RANKED</div>

                <div class="rq-mode-selector">
                    ${Object.entries(MODES).map(([key, m]) => `
                        <button class="rq-mode-btn ${key === mode ? 'selected' : ''}" data-mode="${key}">
                            ${m.name}<span>${m.label}</span>
                        </button>
                    `).join('')}
            </div>

            <div class="rq-chess-players">
                <div id="rqWhitePlayer" class="rq-player-card">
                    ${avatar(null, 'large')}
                    <div class="rq-player-info">
                        <div class="rq-player-name">Ожидание игрока</div>
                        <div class="rq-player-username">Белые</div>
                        <div class="rq-player-rank">—</div>
                    </div>
                    <div id="rqWhiteClock" class="rq-clock">${fmtTime(MODES[mode].seconds)}</div>
                </div>
                <div id="rqBlackPlayer" class="rq-player-card">
                    ${avatar(null, 'large')}
                    <div class="rq-player-info">
                        <div class="rq-player-name">Ожидание игрока</div>
                        <div class="rq-player-username">Чёрные</div>
                        <div class="rq-player-rank">—</div>
                    </div>
                    <div id="rqBlackClock" class="rq-clock">${fmtTime(MODES[mode].seconds)}</div>
                </div>
            </div>

            <div id="rqChessStatus" class="rq-chess-status">Выбери режим и создай комнату</div>
            <div id="rqChessBoard" class="rq-chess-board"></div>

            <div class="rq-chess-actions">
                <button id="rqCreateRoom" class="primary">Создать игру</button>
                <button id="rqJoinRoom">Войти в игру</button>
            </div>

            <div id="rqRoomControls" style="display:none;margin-top:12px">
                <div style="display:flex;gap:7px">
                    <input id="rqRoomCode" placeholder="Код комнаты"
                        style="flex:1;min-width:0;background:#111;border:1px solid #392027;color:white;padding:12px;border-radius:9px">
                    <button id="rqCopyCode"
                        style="background:#211215;color:white;border:1px solid #70202b;border-radius:9px;padding:10px">Копировать</button>
                </div>
                <button id="rqLeaveRoom"
                    style="width:100%;margin-top:8px;background:#211215;color:#fff;border:1px solid #392027;padding:12px;border-radius:9px">
                    Покинуть игру
                </button>
            </div>

            <div id="rqResult"></div>
        </div>
        `;

        $$('.rq-mode-btn', mount).forEach(button => {
            button.addEventListener('click', () => {
                if (room) return toast('Сначала покинь комнату');

                mode = button.dataset.mode;
                $$('.rq-mode-btn', mount).forEach(b => b.classList.toggle('selected', b.dataset.mode === mode));

                clocks.white = MODES[mode].seconds;
                clocks.black = MODES[mode].seconds;
                renderClocks();
            });
        });

        $('#rqCreateRoom').addEventListener('click', createRoom);
        $('#rqJoinRoom').addEventListener('click', joinRoom);
        $('#rqCopyCode').addEventListener('click', copyCode);
        $('#rqLeaveRoom').addEventListener('click', leaveRoom);

        renderBoard();
        loadChess();
    }

    // =============================================
    // LOAD CHESS ENGINE
    // =============================================

    function loadChess() {
        if (window.Chess) {
            chess = new window.Chess();
            chessReady = true;
            renderBoard();
            return;
        }

        if ($('script[data-requiem-chess]')) return;

        const script = document.createElement('script');
        script.dataset.requiemChess = '1';
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js';

        script.onload = () => {
            if (!window.Chess) return toast('Chess.js загрузился некорректно');
            chess = new window.Chess();
            chessReady = true;
            renderBoard();
        };

        script.onerror = () => toast('Не загрузился шахматный движок');

        document.head.appendChild(script);
    }

    // =============================================
    // INLINE SVG PIECES
    // =========================================================

    function pieceSVG(type, side) {
        const white = side === 'white';
        const c = white
            ? { a: '#ff3154', b: '#ff8b9e', d: '#710c23', outline: '#ffd0d8' }
            : { a: '#292b32', b: '#7c8492', d: '#08090b', outline: '#d8dce4' };

        const p = type.toLowerCase();

        const parts = {
            p: `
                <circle cx="50" cy="28" r="13"/>
                <path d="M37 43 L63 43 L60 55 L69 68 L31 68 L40 55Z"/>
                <path d="M29 70 L71 70 L76 83 L24 83Z"/>
                <path d="M20 85 L80 85 L84 93 L16 93Z"/>
            `,
            r: `
                <path d="M23 18 H36 V29 H44 V18 H56 V29 H64 V18 H77 V40
                L69 46 L66 70 H34 L31 46 L23 40Z"/>
                <path d="M31 46 H69 L66 70 H34Z" fill="${c.b}"/>
                <path d="M26 72 H74 L79 85 H21Z"/>
                <path d="M18 86 H82 L85 93 H15Z"/>
            `,
            n: `
                <path d="M28 82 L29 67 L39 54 L35 42 L42 28 L54 17
                L70 25 L78 41 L70 50 L59 48 L53 57 L66 67 L73 82Z"/>
                <path d="M42 31 L54 24 L64 30 L71 40 L60 42 L52 50
                L42 47 L39 40Z" fill="${c.b}"/>
                <circle cx="62" cy="34" r="3" fill="${c.outline}"/>
                <path d="M28 69 H67 L73 82 H26Z"/>
                <path d="M19 85 H81 L84 93 H16Z"/>
            `,
            b: `
                <path d="M50 14 L58 28 L54 34 C67 39 69 51 62 61
                L57 67 L68 75 L74 84 H26 L32 75 L43 67 L38 61
                C31 51 33 39 46 34 L42 28Z"/>
                <path d="M46 35 H54 C62 41 63 50 58 57 L50 63 L42 57
                C37 50 39 41 46 35Z" fill="${c.b}"/>
                <path d="M25 85 H75 L81 93 H19Z"/>
            `,
            q: `
                <path d="M22 28 L35 40 L40 25 L50 39 L60 25 L65 40
                L78 28 L72 55 L67 69 H33 L28 55Z"/>
                <circle cx="22" cy="23" r="6"/>
                <circle cx="40" cy="20" r="6"/>
                <circle cx="50" cy="13" r="6"/>
                <circle cx="60" cy="20" r="6"/>
                <circle cx="78" cy="23" r="6"/>
                <path d="M31 69 H69 L75 82 H25Z"/>
                <path d="M19 85 H81 L85 93 H15Z"/>
            `,
            k: `
                <path d="M44 12 H56 V27 H69 V39 H59 L64 53 L69 69
                H31 L36 53 L41 39 H31 V27 H44Z"/>
                <path d="M42 39 H58 L62 53 H38Z" fill="${c.b}"/>
                <path d="M27 72 H73 L78 85 H22Z"/>
                <path d="M17 86 H83 L86 93 H14Z"/>
            `
        };

        const shape = parts[p] || parts.p;

        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                <defs>
                    <linearGradient id="rqMetal" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="${c.b}"/>
                        <stop offset="48%" stop-color="${c.a}"/>
                        <stop offset="100%" stop-color="${c.d}"/>
                    </linearGradient>
                </defs>
                <g fill="url(#rqMetal)" stroke="${c.outline}" stroke-width="2"
                   stroke-linejoin="round" stroke-linecap="round">
                    ${shape}
                </g>
            </svg>
        `;

        return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    }

    // =============================================
    // PLAYER CARDS
    // =============================================

    function playerCard(profile, side) {
        const el = $(`#rq${side === 'white' ? 'White' : 'Black'}Player`);
        if (!el) return;

        const clockId = side === 'white' ? 'rqWhiteClock' : 'rqBlackClock';

        if (!profile) {
            el.innerHTML = `
                ${avatar(null, 'large')}
                <div class="rq-player-info">
                    <div class="rq-player-name">Ожидание игрока</div>
                    <div class="rq-player-username">${side === 'white' ? 'Белые' : 'Чёрные'}</div>
                    <div class="rq-player-rank">—</div>
                </div>
                <div class="rq-clock" id="${clockId}">${fmtTime(clocks[side])}</div>
            `;
            return;
        }

        el.innerHTML = `
            ${avatar(profile, 'large')}
            <div class="rq-player-info">
                <div class="rq-player-name">${esc(displayName(profile))}</div>
                <div class="rq-player-username">${esc(username(profile))}</div>
                <div class="rq-player-rank">${esc(rank(profile))} · ${elo(profile)} ELO</div>
                <div class="rq-player-stats">
                    <span>П ${profile.wins || 0}</span>
                    <span>Пор ${profile.losses || 0}</span>
                    <span>Н ${profile.draws || 0}</span>
                </div>
            </div>
            <div class="rq-clock" id="${clockId}">${fmtTime(clocks[side])}</div>
        `;

        el.classList.toggle('turn-active', game.started && chess?.turn() === (side === 'white' ? 'w' : 'b'));
    }

    function updateProfiles(data = {}) {
        profiles = data || {};
        playerCard(profiles.white, 'white');
        playerCard(profiles.black, 'black');

        if (color) myProfile = profiles[color] || null;
        if (myProfile) renderProfile(myProfile);
    }

    // =============================================
    // CREATE ROOM
    // =============================================

    async function createRoom() {
        if (!uid || !tg?.initData) {
            toast('Открой Mini App через Telegram');
            return;
        }

        if (room) return toast('Ты уже находишься в комнате');

        const button = $('#rqCreateRoom');
        if (button) button.disabled = true;

        try {
            await register();

            const data = await request('/api/chess/create', {
                method: 'POST',
                body: JSON.stringify({
                    initData: tg.initData,
                    mode
                })
            });

            if (!data.success) throw new Error(data.error || 'Создание комнаты не удалось');

            room = data.room_id || data.room || data.code;
            color = normalizeColor(data.color) || 'white';

            if (!room) throw new Error('Сервер не вернул ID комнаты');

            clocks.white = Number(data.initial_time || MODES[mode].seconds);
            clocks.black = Number(data.initial_time || MODES[mode].seconds);

            game.started = false;
            game.over = false;
            game.locked = true;

            const input = $('#rqRoomCode');
            if (input) input.value = room;

            const controls = $('#rqRoomControls');
            if (controls) controls.style.display = 'block';

            connect(room);
            status(`${modeName()} · Комната создана. Ожидаем соперника...`);
            renderClocks();
        } catch (e) {
            console.error('Create room failed:', e);
            toast(e.message || 'Ошибка создания комнаты');
        } finally {
            if (button) button.disabled = false;
        }
    }

    // =============================================
    // JOIN ROOM
    // =============================================

    async function joinRoom() {
        if (!uid || !tg?.initData) {
            toast('Открой Mini App через Telegram');
            return;
        }

        if (room) return toast('Сначала покинь текущую комнату');

        const code = prompt('Введите код комнаты');
        if (!code?.trim()) return;

        const button = $('#rqJoinRoom');
        if (button) button.disabled = true;

        try {
            await register();

            room = code.trim();

            const input = $('#rqRoomCode');
            if (input) input.value = room;

            const controls = $('#rqRoomControls');
            if (controls) controls.style.display = 'block';

            connect(room);
            status('Подключение к комнате...');
        } catch (e) {
            console.error('Join room:', e);
            toast(e.message || 'Не удалось войти');
            room = null;
        } finally {
            if (button) button.disabled = false;
        }
    }

    // =============================================
    // WEBSOCKET
    // =============================================

    function connect(roomId) {
        disconnectSocket();

        const initData = encodeURIComponent(tg?.initData || '');
        const url = `wss://requiem-bot-7eyu.onrender.com/ws/chess/${encodeURIComponent(roomId)}?initData=${initData}`;

        socket = new WebSocket(url);

        status('Подключение к серверу...');

        socket.onopen = () => {
            game.connected = true;
            toast('Соединение установлено');
        };

        socket.onmessage = event => {
            let data;

            try {
                data = JSON.parse(event.data);
            } catch (e) {
                console.error('WS parse error:', e);
                return;
            }

            receive(data);
        };

        socket.onerror = error => {
            console.error('WS error:', error);
            status('Ошибка WebSocket');
        };

        socket.onclose = () => {
            game.connected = false;
            if (!game.over) status('Соединение закрыто');
        };
    }

    function disconnectSocket() {
        if (!socket) return;
        socket.onclose = null;
        try { socket.close(); } catch {}
        socket = null;
    }

    // =============================================
    // RECEIVE SERVER STATE
    // =============================================

    function receive(data) {
        if (data.error) {
            toast(data.error);
            return;
        }

        if (data.room_id) room = data.room_id;
        if (data.color) color = normalizeColor(data.color) || color;

        if (data.mode && MODES[data.mode]) {
            mode = data.mode;
            updateModeUI();
        }

        if (data.initial_time) {
            clocks.white = Number(data.initial_time);
            clocks.black = Number(data.initial_time);
        }

        if (data.profiles) updateProfiles(data.profiles);

        if (data.started !== undefined) game.started = !!data.started;
        else if (data.players) game.started = data.players.length >= 2;

        if (data.clocks) {
            if (data.clocks.white != null) clocks.white = Number(data.clocks.white);
            if (data.clocks.black != null) clocks.black = Number(data.clocks.black);
        }

        if (data.fen && chessReady && chess) {
            try {
                chess.load(data.fen);
                selected = null;
                moves = [];
                renderBoard();
            } catch (e) {
                console.error('FEN load error:', e);
            }
        }

        if (data.turn !== undefined) {
            const turn = normalizeTurn(data.turn);
            const myTurn = turn === (color === 'white' ? 'w' : 'b');

            game.locked = !game.started || !myTurn || game.over;

            if (!game.over) {
                if (!game.started) status('Ожидаем второго игрока...');
                else status(myTurn ? 'Ваш ход' : 'Ход соперника');
            }
        }

        renderClocks();

        if (data.game_over && !game.over) {
            game.over = true;
            game.locked = true;
            stopClock();
            result(data.result);
        }
    }

    function updateModeUI() {
        $$('.rq-mode-btn').forEach(b => b.classList.toggle('selected', b.dataset.mode === mode));
    }

    // =============================================
    // STATUS
    // =============================================

    function status(message) {
        const el = $('#rqChessStatus');
        if (el) el.textContent = message;
    }

    // =============================================
    // CLOCKS
    // =============================================

    function renderClocks() {
        const white = $('#rqWhiteClock');
        const black = $('#rqBlackClock');

        if (white) {
            white.textContent = fmtTime(clocks.white);
            white.classList.toggle('active', game.started && chess?.turn() === 'w');
            white.classList.toggle('danger', clocks.white <= 20);
        }

        if (black) {
            black.textContent = fmtTime(clocks.black);
            black.classList.toggle('active', game.started && chess?.turn() === 'b');
            black.classList.toggle('danger', clocks.black <= 20);
        }
    }

    function stopClock() {
        clearInterval(clockTimer);
        clockTimer = null;
    }

    // Display estimation only; the server controls actual game time.
    function startDisplayClock() {
        stopClock();
        clockTimestamp = Date.now();

        clockTimer = setInterval(() => {
            if (!game.started || game.over || !chess) return;

            const elapsed = (Date.now() - clockTimestamp) / 1000;
            clockTimestamp = Date.now();

            if (chess.turn() === 'w') clocks.white = Math.max(0, clocks.white - elapsed);
            else clocks.black = Math.max(0, clocks.black - elapsed);

            renderClocks();
        }, 500);
    }

    // =============================================
    // BOARD
    // =============================================

    function renderBoard() {
        const board = $('#rqChessBoard');
        if (!board) return;

        if (!chessReady || !chess) {
            board.innerHTML = '<div style="grid-column:1/9;display:flex;align-items:center;justify-content:center;color:#888">Загрузка шахмат...</div>';
            return;
        }

        const rows = chess.board();
        const files = ['a','b','c','d','e','f','g','h'];
        let html = '';

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = rows[r][c];
                const square = files[c] + (8 - r);
                const light = (r + c) % 2 === 0;
                const isSelected = selected === square;
                const legal = moves.some(m => m.to === square);
                const capture = legal && !!chess.get(square);

                let classes = `rq-square ${light ? 'light' : 'dark'}`;
                if (isSelected) classes += ' selected';
                if (lastMove.includes(square)) classes += ' last-move';
                if (legal) classes += capture ? ' capture' : ' legal';

                let pieceHTML = '';

                if (piece) {
                    const side = piece.color === 'w' ? 'white' : 'black';
                    pieceHTML = `<img class="rq-piece" draggable="false" alt="${side} ${piece.type}" src="${pieceSVG(piece.type, side)}">`;
                }

                html += `<div class="${classes}" data-square="${square}">${pieceHTML}</div>`;
            }
        }

        board.innerHTML = html;

        $$('.rq-square', board).forEach(el => {
            el.addEventListener('click', () => clickSquare(el.dataset.square));
        });
    }

    // =============================================
    // MOVE SELECTION
    // =============================================

    function clickSquare(square) {
        if (!chessReady || !chess || !game.connected) return;
        if (game.locked || game.over || !game.started) return;

        const piece = chess.get(square);
        const myTurnColor = color === 'white' ? 'w' : 'b';

        if (selected) {
            const target = moves.find(m => m.to === square);

            if (target) {
                sendMove(selected, square, target);
                return;
            }
        }

        if (piece && piece.color === myTurnColor && chess.turn() === myTurnColor) {
            selected = square;
            moves = chess.moves({ square, verbose: true });
            renderBoard();
            return;
        }

        selected = null;
        moves = [];
        renderBoard();
    }

    function sendMove(from, to, move) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            toast('Нет соединения с сервером');
            return;
        }

        const promotion = move.flags?.includes('p') ? 'q' : '';

        socket.send(JSON.stringify({
            type: 'move',
            from,
            to,
            promotion
        }));

        lastMove = [from, to];
        selected = null;
        moves = [];
        renderBoard();
    }

    // =============================================
    // GAME RESULT
    // =============================================

    function result(value) {
        if (gameResultShown) return;
        gameResultShown = true;

        const el = $('#rqResult');
        if (!el) return;

        let title = 'НИЧЬЯ';
        let description = 'Партия завершилась вничью';

        if (value === 'white' || value === '1-0') {
            title = color === 'white' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
            description = 'Победили белые';
        }

        if (value === 'black' || value === '0-1') {
            title = color === 'black' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
            description = 'Победили чёрные';
        }

        el.innerHTML = `
            <div class="rq-result">
                <h2>${title}</h2>
                <div style="color:#aaa">${description}</div>
                <div style="color:#777;font-size:11px;margin-top:8px">${modeName()} · ${MODES[mode].label}</div>
                <button id="rqNewGame">Новая игра</button>
            </div>
        `;

        $('#rqNewGame')?.addEventListener('click', () => {
            leaveRoom();
        });

        loadProfile();
        loadLeaderboard();
    }

    // =============================================
    // ROOM CONTROLS
    // =============================================

    async function copyCode() {
        const code = $('#rqRoomCode')?.value || room;
        if (!code) return;

        try {
            await navigator.clipboard.writeText(code);
            toast('Код комнаты скопирован');
        } catch {
            toast('Не удалось скопировать код');
        }
    }

    function leaveRoom() {
        stopClock();
        disconnectSocket();

        room = null;
        color = null;
        selected = null;
        moves = [];
        lastMove = [];
        profiles = {};
        gameResultShown = false;

        game.connected = false;
        game.started = false;
        game.over = false;
        game.locked = true;

        clocks.white = MODES[mode].seconds;
        clocks.black = MODES[mode].seconds;

        if (chessReady) chess = new window.Chess();

        renderBoard();
        playerCard(null, 'white');
        playerCard(null, 'black');

        const controls = $('#rqRoomControls');
        if (controls) controls.style.display = 'none';

        const resultBox = $('#rqResult');
        if (resultBox) resultBox.innerHTML = '';

        status('Выбери режим и создай комнату');
        renderClocks();
    }

    // =============================================
    // START
    // =============================================

    async function start() {
        if (user && $('#username')) $('#username').textContent = displayName(user);

        await register();
        await loadProfile();
        loadLeaderboard();
    }

    showHome();

    start().catch(e => console.error('REQUIEM startup:', e));
});
