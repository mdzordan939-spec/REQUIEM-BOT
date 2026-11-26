
document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // ==========================================
    // REQUIEM — TELEGRAM CHESS CLIENT
    // ==========================================

    const tg = window.Telegram?.WebApp;
    const API_URL = 'https://requiem-bot-7eyu.onrender.com';

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

    const currentUser = tg?.initDataUnsafe?.user || null;
    const playerId = currentUser?.id ? String(currentUser.id) : null;

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
    let reconnecting = false;

    const state = {
        connected: false,
        gameStarted: false,
        gameOver: false,
        boardLocked: false,
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

        const first = profile.first_name || '';
        const last = profile.last_name || '';
        const full = `${first} ${last}`.trim();

        return full || profile.username || `Игрок ${profile.id || ''}`;
    }

    function getUsername(profile) {
        if (!profile?.username) return 'Telegram';
        return '@' + String(profile.username).replace(/^@/, '');
    }

    function getElo(profile) {
        return Number(profile?.elo ?? 1000);
    }

    function getRank(profile) {
        return profile?.rank_label ||
            profile?.rank_name ||
            'HUNTER';
    }

    function getPhoto(profile) {
        return profile?.photo_url || profile?.avatar_url || null;
    }

    function avatarHTML(profile, extraClass = '') {
        const photo = getPhoto(profile);
        const name = getDisplayName(profile);
        const initial = getInitials(name);

        if (photo) {
            return `
                <div class="rq-avatar ${extraClass}">
                    <img
                        src="${escapeHTML(photo)}"
                        alt="${escapeHTML(name)}"
                        referrerpolicy="no-referrer"
                        onerror="this.parentElement.innerHTML='<span>${escapeHTML(initial)}</span>'"
                    >
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
        toast._timer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2600);
    }

    async function api(path, options = {}) {
        const response = await fetch(API_URL + path, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return response.json();
    }

    // ==========================================
    // STYLES
    // ==========================================

    const styles = document.createElement('style');

    styles.textContent = `
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
            font-weight: 800;
        }

        .rq-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .rq-avatar.large {
            width: 58px;
            height: 58px;
            font-size: 23px;
        }

        .rq-avatar.small {
            width: 38px;
            height: 38px;
            font-size: 15px;
        }

        .rq-player-card {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 13px;
            background: #111;
            border: 1px solid #292020;
            border-radius: 14px;
            min-width: 0;
        }

        .rq-player-info {
            flex: 1;
            min-width: 0;
        }

        .rq-player-name {
            color: #fff;
            font-size: 14px;
            font-weight: 800;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .rq-player-username {
            color: #888;
            font-size: 12px;
            margin-top: 3px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .rq-player-rank {
            color: #e33b4d;
            font-size: 11px;
            font-weight: 800;
            margin-top: 5px;
        }

        .rq-player-elo {
            color: #fff;
            font-size: 13px;
            font-weight: 800;
            white-space: nowrap;
        }

        .rq-player-stats {
            display: flex;
            gap: 10px;
            margin-top: 5px;
            color: #888;
            font-size: 10px;
            flex-wrap: wrap;
        }

        .rq-chess-players {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 9px;
            margin: 15px 0;
        }

        .rq-chess-board {
            width: 100%;
            aspect-ratio: 1;
            display: grid;
            grid-template-columns: repeat(8,1fr);
            overflow: hidden;
            border-radius: 5px;
            border: 2px solid #292020;
            box-shadow: 0 10px 35px #0009;
            touch-action: manipulation;
        }

        .rq-square {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 0;
            aspect-ratio: 1;
            cursor: pointer;
        }

        .rq-square.light { background: #e7d8bd; }
        .rq-square.dark { background: #875b4e; }

        .rq-square.selected {
            background: #c59b42 !important;
        }

        .rq-square.last-move {
            box-shadow: inset 0 0 0 4px #e6d16c99;
        }

        .rq-square.legal::after {
            content: '';
            position: absolute;
            width: 24%;
            height: 24%;
            border-radius: 50%;
            background: #15151566;
            z-index: 1;
        }

        .rq-square.capture::after {
            content: '';
            position: absolute;
            inset: 4%;
            border: 4px solid #17171788;
            border-radius: 50%;
            z-index: 1;
        }

        .rq-piece {
            width: 91%;
            height: 91%;
            object-fit: contain;
            position: relative;
            z-index: 2;
            pointer-events: none;
            filter: drop-shadow(0 3px 2px #0007);
        }

        .rq-chess-status {
            text-align: center;
            color: #ddd;
            font-size: 13px;
            padding: 12px;
            background: #111;
            border-radius: 10px;
            margin: 12px 0;
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
            font-weight: 700;
        }

        .rq-chess-actions button.primary {
            background: #a7192b;
            border-color: #d32b40;
        }

        .rq-leader-row {
            display: flex;
            align-items: center;
            gap: 11px;
            padding: 12px;
            border-bottom: 1px solid #252020;
        }

        .rq-leader-position {
            width: 25px;
            color: #999;
            font-size: 13px;
            font-weight: 900;
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

        @keyframes rqResult {
            from { opacity: 0; transform: scale(.92); }
            to { opacity: 1; transform: scale(1); }
        }

        @media(max-width:360px) {
            .rq-chess-players { grid-template-columns: 1fr; }
            .rq-player-card { padding: 9px; }
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
        });
    }

    function showHome() {
        hideSections();

        $$('.hero,.profile,.stats,.menu,.section-heading').forEach(el => {
            el.style.display = '';
        });

        $$('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === 'home');
        });
    }

    function showGames() {
        hideSections();

        const hub = $('#gamesHub');
        if (hub) hub.style.display = 'block';

        $$('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === 'games');
        });
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
    // REGISTER TELEGRAM PLAYER
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
    // PROFILE DISPLAY
    // ==========================================

    function renderMyProfile(profile) {
        if (!profile) return;

        const name = getDisplayName(profile);
        const username = getUsername(profile);

        const nameElement = $('#username');
        if (nameElement) nameElement.textContent = name;

        const avatarElement = $('[data-user-avatar]');
        if (avatarElement) {
            avatarElement.innerHTML = avatarHTML(profile);
        }

        renderRankProgress(profile);
    }

    function renderRankProgress(profile) {
        if (!profile) return;

        const mount = $('#chessMount');
        if (!mount) return;

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
                ${remaining > 0 ? `До следующего ранга: ${remaining} ELO` : 'Максимальный ранг'}
            </div>
        `;
    }

    // ==========================================
    // LEADERBOARD
    // ==========================================

    async function loadLeaderboard() {
        const list = $('#ratingList');
        if (!list) return;

        list.innerHTML = '<div style="padding:20px;color:#888">Загрузка рейтинга...</div>';

        try {
            const result = await api('/api/leaderboard');
            const players = Array.isArray(result) ? result : result.players || result.leaderboard || [];

            if (!players.length) {
                list.innerHTML = '<div style="padding:20px;color:#888">Пока нет игроков</div>';
                return;
            }

            list.innerHTML = players.map((player, index) => {
                const isMe = String(player.id) === playerId;

                return `
                    <div class="rq-leader-row ${isMe ? 'me' : ''}">
                        <div class="rq-leader-position">${index + 1}</div>
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
            <div style="padding:5px 0">
                <div style="font-size:22px;font-weight:900;color:#fff">REQUIEM CHESS</div>
                <div style="font-size:11px;color:#888;margin-top:4px">ONLINE RANKED MATCH</div>

                <div class="rq-chess-players">
                    <div id="rqWhitePlayer" class="rq-player-card">
                        <div class="rq-avatar large"><span>W</span></div>
                        <div class="rq-player-info">
                            <div class="rq-player-name">Ожидание игрока</div>
                            <div class="rq-player-username">Белые</div>
                            <div class="rq-player-rank">—</div>
                        </div>
                    </div>

                    <div id="rqBlackPlayer" class="rq-player-card">
                        <div class="rq-avatar large"><span>B</span></div>
                        <div class="rq-player-info">
                            <div class="rq-player-name">Ожидание игрока</div>
                            <div class="rq-player-username">Чёрные</div>
                            <div class="rq-player-rank">—</div>
                        </div>
                    </div>
                </div>

                <div id="rqChessStatus" class="rq-chess-status">
                    Создай комнату или подключись к игре
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
            </div>
        `;

        $('#rqCreateRoom', mount)?.addEventListener('click', createRoom);
        $('#rqJoinRoom', mount)?.addEventListener('click', joinRoom);
        $('#rqCopyCode', mount)?.addEventListener('click', copyRoomCode);
        $('#rqLeaveRoom', mount)?.addEventListener('click', leaveRoom);

        renderBoard();
        loadChessLibrary();
    }

    // ==========================================
    // CHESS LIBRARY
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

        script.onerror = () => {
            showToast('Не удалось загрузить шахматный движок');
        };

        document.head.appendChild(script);
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
        `;
    }

    function updatePlayers(profiles = {}) {
        currentProfiles = profiles || {};

        const white = currentProfiles.white || null;
        const black = currentProfiles.black || null;

        renderPlayerCard(white, 'white');
        renderPlayerCard(black, 'black');

        currentPlayer = playerColor ? currentProfiles[playerColor] : currentPlayer;
        opponentPlayer = playerColor
            ? currentProfiles[playerColor === 'white' ? 'black' : 'white']
            : null;

        if (currentPlayer) renderMyProfile(currentPlayer);
    }

    // ==========================================
    // CREATE ROOM
    // ==========================================

    async function createRoom() {
        if (!playerId) {
            showToast('Открой игру через Telegram');
            return;
        }

        try {
            await registerPlayer();

            const result = await api('/api/chess/create', {
                method: 'POST',
                body: JSON.stringify({
                    initData: tg?.initData || '',
                    player_id: playerId
                })
            });

            if (!result.success) {
                throw new Error(result.error || 'Не удалось создать комнату');
            }

            roomId = result.room_id || result.room || result.code;
            playerColor = result.color || 'white';

            if (!roomId) throw new Error('Сервер не вернул код комнаты');

            connectSocket(roomId);

            $('#rqRoomCode').value = roomId;
            $('#rqRoomControls').style.display = 'block';

            setStatus('Комната создана. Ожидаем второго игрока...');

        } catch (error) {
            console.error(error);
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

        await registerPlayer();

        roomId = code.trim();
        connectSocket(roomId);

        $('#rqRoomCode').value = roomId;
        $('#rqRoomControls').style.display = 'block';
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

        setStatus('Подключение к серверу...');

        socket.onopen = () => {
            state.connected = true;
            reconnecting = false;
            showToast('Подключено к игре');
        };

        socket.onmessage = event => {
            let data;

            try {
                data = JSON.parse(event.data);
            } catch {
                console.error('Invalid WebSocket message:', event.data);
                return;
            }

            handleChessMessage(data);
        };

        socket.onerror = error => {
            console.error('WebSocket error:', error);
            setStatus('Ошибка соединения');
        };

        socket.onclose = () => {
            state.connected = false;

            if (!state.gameOver) {
                setStatus('Соединение закрыто');
            }
        };
    }

    // ==========================================
    // HANDLE SERVER DATA
    // ==========================================

    function handleChessMessage(data) {
        if (data.error) {
            showToast(data.error);
            return;
        }

        if (data.color) {
            playerColor = data.color;
        }

        if (data.room_id) {
            roomId = data.room_id;
        }

        if (data.profiles) {
            updatePlayers(data.profiles);
        }

        if (data.players && !data.profiles) {
            state.gameStarted = data.players.length >= 2;
        }

        if (data.fen) {
            state.lastFen = data.fen;

            if (chessLoaded && chess) {
                chess.load(data.fen);
            }

            renderBoard();
        }

        if (data.turn) {
            const turn = data.turn === 'w' ? 'Белые' : 'Чёрные';
            const myTurn = data.turn === (playerColor === 'white' ? 'w' : 'b');

            state.boardLocked = !myTurn || state.gameOver;

            if (!state.gameOver) {
                setStatus(myTurn ? 'Ваш ход' : `Ход соперника (${turn})`);
            }
        }

        if (data.game_over) {
            state.gameOver = true;
            state.boardLocked = true;
            showGameResult(data.result);
        }

        if (data.opponent_name && !data.profiles) {
            const opponent = playerColor === 'white' ? 'black' : 'white';
            const profile = currentProfiles[opponent] || {};

            profile.first_name = data.opponent_name;
            renderPlayerCard(profile, opponent);
        }

        if (data.success && data.room_id) {
            $('#rqRoomCode').value = data.room_id;
        }
    }

    // ==========================================
    // STATUS
    // ==========================================

    function setStatus(message) {
        const element = $('#rqChessStatus');
        if (element) element.textContent = message;
    }

    // ==========================================
    // BOARD
    // ==========================================

    function renderBoard() {
        const board = $('#rqChessBoard');
        if (!board) return;

        if (!chessLoaded || !chess) {
            board.innerHTML = '';
            return;
        }

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
                const capture = legalMoves.some(move => move.to === square && move.flags.includes('c'));

                let classes = `rq-square ${light ? 'light' : 'dark'}`;

                if (selected) classes += ' selected';
                if (legal) classes += capture ? ' capture' : ' legal';

                let pieceHTML = '';

                if (piece) {
                    const color = piece.color === 'w' ? 'white' : 'black';
                    const symbol = piece.type;

                    pieceHTML = `
                        <img
                            class="rq-piece"
                            draggable="false"
                            alt="${color} ${symbol}"
                            src="${getPieceImage(symbol, color)}"
                        >
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
            square.addEventListener('click', () => {
                handleSquareClick(square.dataset.square);
            });
        });
    }

    // ==========================================
    // PIECE IMAGES
    // ==========================================

    function getPieceImage(type, color) {
        const names = {
            k: 'king',
            q: 'queen',
            r: 'rook',
            b: 'bishop',
            n: 'knight',
            p: 'pawn'
        };

        const prefix = color === 'white' ? 'w' : 'b';
        const name = names[type];

        // Используем SVG-фигуры с чётким контуром.
        return `https://images.chesscomfiles.com/chess-themes/pieces/neo/150/${prefix}${name}.png`;
    }

    // ==========================================
    // MOVES
    // ==========================================

    function handleSquareClick(square) {
        if (!chessLoaded || !chess || !state.connected) return;
        if (state.boardLocked || state.gameOver) return;

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
            legalMoves = chess.moves({
                square,
                verbose: true
            });

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

        const promotion = move.flags.includes('p') ? 'q' : '';

        socket.send(JSON.stringify({
            type: 'move',
            from,
            to,
            promotion
        }));

        selectedSquare = null;
        legalMoves = [];
    }

    // ==========================================
    // RESULT
    // ==========================================

    function showGameResult(result) {
        const element = $('#rqResult');
        if (!element) return;

        let title = 'НИЧЬЯ';
        let description = 'Партия завершилась вничью';

        if (result === 'white' || result === '1-0') {
            title = playerColor === 'white' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
            description = playerColor === 'white'
                ? 'Вы выиграли партию'
                : 'Победили белые';
        }

        if (result === 'black' || result === '0-1') {
            title = playerColor === 'black' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
            description = playerColor === 'black'
                ? 'Вы выиграли партию'
                : 'Победили чёрные';
        }

        element.innerHTML = `
            <div class="rq-game-result">
                <h2>${title}</h2>
                <div style="color:#aaa">${description}</div>
                <button id="rqNewGame"
                    style="margin-top:16px;background:#a7192b;color:white;border:0;border-radius:9px;padding:12px 22px;font-weight:800">
                    Новая игра
                </button>
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
            await navigator.clipboard.writeText(code);
            showToast('Код комнаты скопирован');
        } catch {
            showToast('Не удалось скопировать код');
        }
    }

    function leaveRoom() {
        if (socket) {
            socket.onclose = null;
            socket.close();
            socket = null;
        }

        roomId = null;
        playerColor = null;
        selectedSquare = null;
        legalMoves = [];

        state.connected = false;
        state.gameStarted = false;
        state.gameOver = false;
        state.boardLocked = false;

        currentProfiles = {};
        opponentPlayer = null;

        if (chessLoaded) {
            chess = new window.Chess();
            renderBoard();
        }

        renderPlayerCard(null, 'white');
        renderPlayerCard(null, 'black');

        $('#rqRoomControls').style.display = 'none';
        $('#rqResult').innerHTML = '';

        setStatus('Создай комнату или подключись к игре');
    }

    // ==========================================
    // START
    // ==========================================

    async function start() {
        if (currentUser) {
            const name = getDisplayName(currentUser);

            const nameElement = $('#username');
            if (nameElement) nameElement.textContent = name;
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
