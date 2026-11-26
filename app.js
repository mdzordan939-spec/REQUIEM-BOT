
document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram?.WebApp;
    const API_URL = 'https://requiem-bot-7eyu.onrender.com';

    if (tg) {
        tg.ready();
        tg.expand();
        tg.setHeaderColor?.('#080808');
        tg.setBackgroundColor?.('#080808');
    }

    const user = tg?.initDataUnsafe?.user;
    const username = [
        user?.first_name,
        user?.last_name
    ].filter(Boolean).join(' ') || 'Игрок';

    const usernameElement = document.getElementById('username');
    if (usernameElement) usernameElement.textContent = username;

    const toast = document.getElementById('toast');
    let toastTimer;

    function showToast(message) {
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2200);
    }

    const labels = {
        home: 'Главная',
        collection: 'Коллекция',
        games: 'Игры',
        rating: 'Рейтинг',
        tasks: 'Задания',
        profile: 'Профиль',
        crystals: 'Кристаллы',
        bonus: 'Ежедневный бонус'
    };

    // ==========================================
    // REQUIEM CHESS — DESIGN
    // ==========================================

    const chessStyle = document.createElement('style');

    chessStyle.textContent = `
        #chessPanel {
            display: none;
            position: relative;
            z-index: 20;
            width: 100%;
            margin: 20px 0;
            padding: 18px;
            box-sizing: border-box;
            overflow: hidden;
            color: #f3eeee;
            background:
                radial-gradient(ellipse at 50% 0%, rgba(120,0,20,.17), transparent 55%),
                #080808;
            border: 1px solid #351018;
            border-radius: 18px;
        }

        #chessPanel * {
            box-sizing: border-box;
        }

        .chess-heading {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            margin-bottom: 18px;
        }

        .chess-brand {
            display: flex;
            align-items: center;
            gap: 11px;
            font-size: 19px;
            font-weight: 900;
            letter-spacing: 1.5px;
        }

        .chess-brand-mark {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 39px;
            height: 39px;
            border: 1px solid #ed1735;
            border-radius: 50%;
            color: #ed1735;
            font-size: 25px;
            font-style: italic;
        }

        .chess-brand span:last-child {
            color: #ed1735;
        }

        .chess-online {
            display: flex;
            align-items: center;
            gap: 7px;
            color: #aaa;
            font-size: 11px;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        .chess-online-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #e51a36;
            box-shadow: 0 0 9px #e51a36;
        }

        .chess-layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 190px;
            gap: 16px;
            align-items: start;
        }

        .chess-main {
            min-width: 0;
        }

        .chess-player {
            display: flex;
            align-items: center;
            gap: 11px;
            min-width: 0;
            padding: 12px;
            margin-bottom: 10px;
            background: linear-gradient(110deg, #171012, #0d0d0d);
            border: 1px solid #32151b;
            border-radius: 12px;
        }

        .chess-player-avatar {
            display: flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 43px;
            width: 43px;
            height: 43px;
            border: 1px solid #8e1025;
            border-radius: 50%;
            color: #ed1735;
            font-size: 25px;
            background: #10090b;
        }

        .chess-player-info {
            min-width: 0;
            flex: 1;
        }

        .chess-player-name {
            overflow: hidden;
            color: #eee;
            font-size: 14px;
            font-weight: 700;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .chess-player-rank {
            margin-top: 4px;
            color: #858080;
            font-size: 11px;
        }

        .chess-player-side {
            color: #e21a37;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 1px;
        }

        .chess-board-frame {
            width: 100%;
            padding: 6px;
            border: 2px solid #e71937;
            border-radius: 9px;
            background: #090909;
            box-shadow:
                0 0 8px rgba(235, 15, 45, .55),
                0 0 25px rgba(235, 15, 45, .12);
        }

        #chessBoard {
            display: grid;
            grid-template-columns: repeat(8, minmax(0, 1fr));
            width: 100%;
            aspect-ratio: 1;
            overflow: hidden;
        }

        .chess-square {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 0;
            aspect-ratio: 1;
            cursor: pointer;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        }

        .chess-light {
            background: #650b19;
        }

        .chess-dark {
            background: #090909;
        }

        .chess-square.chess-selected {
            z-index: 1;
            outline: 3px solid #ff2545;
            outline-offset: -3px;
            background: #a50d29;
        }

        .chess-piece {
            font-family: "Segoe UI Symbol", "DejaVu Sans", serif;
            font-size: clamp(20px, 6.2vw, 48px);
            line-height: 1;
            pointer-events: none;
        }

        .chess-white-piece {
            color: #f0193c;
            text-shadow:
                0 0 3px #ff8a9b,
                0 0 9px rgba(255, 0, 40, .5),
                1px 2px 2px #160006;
        }

        .chess-black-piece {
            color: #151515;
            -webkit-text-stroke: 1px #777;
            text-shadow:
                0 2px 3px #000,
                0 0 5px rgba(255,255,255,.2);
        }

        .chess-coord {
            position: absolute;
            z-index: 2;
            color: rgba(255,255,255,.52);
            font-size: 9px;
            line-height: 1;
            pointer-events: none;
        }

        .chess-coord-rank {
            top: 3px;
            left: 4px;
        }

        .chess-coord-file {
            right: 4px;
            bottom: 3px;
        }

        .chess-status {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 12px;
            margin-top: 12px;
            background: #111;
            border: 1px solid #292020;
            border-radius: 10px;
        }

        .chess-status-label {
            color: #888;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        #chessStatus {
            color: #f0203e;
            font-size: 13px;
            font-weight: 800;
            text-align: right;
        }

        .chess-sidebar {
            display: flex;
            flex-direction: column;
            gap: 10px;
            min-width: 0;
        }

        .chess-card {
            padding: 13px;
            background: linear-gradient(145deg, #171112, #0c0c0c);
            border: 1px solid #32151b;
            border-radius: 12px;
        }

        .chess-card-title {
            margin-bottom: 10px;
            color: #e51a37;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        .chess-room-code {
            color: #fff;
            font-size: 19px;
            font-weight: 900;
            letter-spacing: 3px;
            text-align: center;
            overflow-wrap: anywhere;
        }

        .chess-room-hint {
            margin-top: 7px;
            color: #777;
            font-size: 10px;
            line-height: 1.5;
            text-align: center;
        }

        .chess-button {
            width: 100%;
            min-height: 43px;
            padding: 12px;
            margin-top: 8px;
            border: 1px solid #ed1735;
            border-radius: 9px;
            background: #d71130;
            color: #fff;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: .7px;
            cursor: pointer;
            transition: background .15s, transform .15s;
        }

        .chess-button:active {
            transform: scale(.98);
            background: #a90d25;
        }

        .chess-button-secondary {
            background: #151112;
            border-color: #49202a;
            color: #ddd;
        }

        .chess-button-secondary:active {
            background: #281016;
        }

        #chessCode {
            width: 100%;
            min-height: 43px;
            padding: 10px;
            margin-top: 9px;
            border: 1px solid #45202a;
            border-radius: 8px;
            outline: none;
            background: #080808;
            color: #fff;
            font-size: 16px;
            font-weight: 800;
            letter-spacing: 3px;
            text-align: center;
        }

        #chessCode:focus {
            border-color: #ed1735;
        }

        .chess-moves {
            min-height: 55px;
            max-height: 160px;
            overflow-y: auto;
            color: #aaa;
            font-size: 12px;
            line-height: 1.8;
        }

        .chess-move-empty {
            color: #666;
            font-size: 11px;
        }

        .chess-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 10px;
        }

        .chess-actions .chess-button {
            margin-top: 0;
        }

        #chessLobby {
            max-width: 460px;
            margin: 0 auto;
            padding: 12px 0 4px;
        }

        .chess-lobby-title {
            margin: 0 0 8px;
            color: #fff;
            font-size: 22px;
            font-weight: 900;
            text-align: center;
        }

        .chess-lobby-subtitle {
            margin-bottom: 20px;
            color: #888;
            font-size: 12px;
            text-align: center;
        }

        .chess-divider {
            display: flex;
            align-items: center;
            gap: 12px;
            margin: 13px 0;
            color: #777;
            font-size: 10px;
            letter-spacing: 2px;
        }

        .chess-divider::before,
        .chess-divider::after {
            content: "";
            height: 1px;
            flex: 1;
            background: #382027;
        }

        @media (max-width: 620px) {
            #chessPanel {
                padding: 12px;
                margin: 14px 0;
            }

            .chess-layout {
                grid-template-columns: 1fr;
            }

            .chess-sidebar {
                display: grid;
                grid-template-columns: 1fr 1fr;
            }

            .chess-sidebar .chess-card:last-child {
                grid-column: 1 / -1;
            }

            .chess-heading {
                margin-bottom: 12px;
            }

            .chess-brand {
                font-size: 16px;
            }

            .chess-player {
                padding: 9px;
            }

            .chess-piece {
                font-size: clamp(20px, 8vw, 42px);
            }
        }

        @media (max-width: 360px) {
            .chess-sidebar {
                grid-template-columns: 1fr;
            }

            .chess-sidebar .chess-card:last-child {
                grid-column: auto;
            }

            .chess-online {
                font-size: 9px;
            }
        }
    `;

    document.head.appendChild(chessStyle);

    const chessPanel = document.createElement('section');
    chessPanel.id = 'chessPanel';

    chessPanel.innerHTML = `
        <div class="chess-heading">
            <div class="chess-brand">
                <div class="chess-brand-mark">R</div>
                <div>REQUIEM <span>CHESS</span></div>
            </div>

            <div class="chess-online">
                <span class="chess-online-dot"></span>
                ONLINE
            </div>
        </div>

        <div id="chessLobby">
            <h2 class="chess-lobby-title">ШАХМАТНАЯ АРЕНА</h2>
            <div class="chess-lobby-subtitle">
                Создай комнату или присоединись к сопернику
            </div>

            <button class="chess-button" id="createChess">
                СОЗДАТЬ КОМНАТУ
            </button>

            <div class="chess-divider">ИЛИ</div>

            <input
                id="chessCode"
                maxlength="6"
                placeholder="КОД КОМНАТЫ"
                autocomplete="off"
            >

            <button class="chess-button chess-button-secondary" id="joinChess">
                ПРИСОЕДИНИТЬСЯ
            </button>
        </div>

        <div id="chessGame" style="display:none">
            <div class="chess-layout">
                <div class="chess-main">

                    <div class="chess-player">
                        <div class="chess-player-avatar">♞</div>
                        <div class="chess-player-info">
                            <div class="chess-player-name" id="opponentName">
                                Соперник
                            </div>
                            <div class="chess-player-rank">
                                Уровень 1 · ELO 1000
                            </div>
                        </div>
                        <div class="chess-player-side">ЧЁРНЫЕ</div>
                    </div>

                    <div class="chess-board-frame">
                        <div id="chessBoard"></div>
                    </div>

                    <div class="chess-player" style="margin-top:10px;margin-bottom:0">
                        <div class="chess-player-avatar">R</div>
                        <div class="chess-player-info">
                            <div class="chess-player-name" id="myChessName"></div>
                            <div class="chess-player-rank">
                                Уровень 1 · ELO 1000
                            </div>
                        </div>
                        <div class="chess-player-side">КРАСНЫЕ</div>
                    </div>

                    <div class="chess-status">
                        <span class="chess-status-label">Состояние партии</span>
                        <span id="chessStatus">Ожидание подключения...</span>
                    </div>
                </div>

                <div class="chess-sidebar">
                    <div class="chess-card">
                        <div class="chess-card-title">Комната</div>
                        <div class="chess-room-code" id="chessRoomCode"></div>
                        <div class="chess-room-hint">
                            Отправь код другу, чтобы он смог подключиться
                        </div>
                        <button class="chess-button" id="copyChessCode">
                            КОПИРОВАТЬ КОД
                        </button>
                    </div>

                    <div class="chess-card">
                        <div class="chess-card-title">История ходов</div>
                        <div class="chess-moves" id="chessMoves">
                            <span class="chess-move-empty">
                                Ходы появятся здесь
                            </span>
                        </div>
                    </div>

                    <div class="chess-card">
                        <div class="chess-card-title">Управление</div>
                        <button class="chess-button chess-button-secondary" id="leaveChess">
                            ВЫЙТИ ИЗ ИГРЫ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const menu = document.querySelector('.menu');

    if (menu) {
        menu.insertAdjacentElement('afterend', chessPanel);
    } else {
        document.querySelector('main')?.appendChild(chessPanel);
    }

    // ==========================================
    // CHESS LOGIC / CONNECTION
    // ==========================================

    let chessSocket = null;
    let currentRoom = '';
    let playerColor = '';
    let currentFen = '';
    let selectedSquare = null;
    let gameFinished = false;
    let moveNumber = 0;

    const pieces = {
        K: '♔', Q: '♕', R: '♖',
        B: '♗', N: '♘', P: '♙',
        k: '♚', q: '♛', r: '♜',
        b: '♝', n: '♞', p: '♟'
    };

    const myNameElement = document.getElementById('myChessName');
    if (myNameElement) myNameElement.textContent = username;

    function showChessGame() {
        document.getElementById('chessLobby').style.display = 'none';
        document.getElementById('chessGame').style.display = 'block';
    }

    function showChessLobby() {
        document.getElementById('chessLobby').style.display = 'block';
        document.getElementById('chessGame').style.display = 'none';
    }

    function updatePlayerLabels() {
        const opponent = document.getElementById('opponentName');
        const mySide = document.querySelector('.chess-player-side:last-child');

        if (playerColor === 'black') {
            if (opponent) opponent.textContent = 'Красный игрок';
            if (myNameElement) myNameElement.textContent = username;
            if (mySide) mySide.textContent = 'ЧЁРНЫЕ';
        } else {
            if (opponent) opponent.textContent = 'Соперник';
            if (myNameElement) myNameElement.textContent = username;
            if (mySide) mySide.textContent = 'КРАСНЫЕ';
        }
    }

    function renderBoard(fen) {
        currentFen = fen;

        const boardElement = document.getElementById('chessBoard');
        if (!boardElement) return;

        boardElement.innerHTML = '';

        const rows = fen.split(' ')[0].split('/');
        let board = [];

        rows.forEach(row => {
            const line = [];

            for (const char of row) {
                if (/[1-8]/.test(char)) {
                    for (let i = 0; i < Number(char); i++) {
                        line.push('');
                    }
                } else {
                    line.push(char);
                }
            }

            board.push(line);
        });

        if (playerColor === 'black') {
            board.reverse();
            board = board.map(row => row.slice().reverse());
        }

        board.forEach((row, rowIndex) => {
            row.forEach((piece, colIndex) => {
                const square = document.createElement('div');

                const realRow = playerColor === 'black'
                    ? 7 - rowIndex
                    : rowIndex;

                const realCol = playerColor === 'black'
                    ? 7 - colIndex
                    : colIndex;

                const file = 'abcdefgh'[realCol];
                const rank = 8 - realRow;
                const squareName = file + rank;

                square.className = 'chess-square ' +
                    ((rowIndex + colIndex) % 2 === 0
                        ? 'chess-light'
                        : 'chess-dark');

                if (selectedSquare === squareName) {
                    square.classList.add('chess-selected');
                }

                if (piece) {
                    const pieceElement = document.createElement('span');
                    pieceElement.className = 'chess-piece ' +
                        (piece === piece.toUpperCase()
                            ? 'chess-white-piece'
                            : 'chess-black-piece');

                    pieceElement.textContent = pieces[piece] || '';
                    square.appendChild(pieceElement);
                }

                if (colIndex === 0) {
                    const rankLabel = document.createElement('span');
                    rankLabel.className = 'chess-coord chess-coord-rank';
                    rankLabel.textContent = rank;
                    square.appendChild(rankLabel);
                }

                if (rowIndex === 7) {
                    const fileLabel = document.createElement('span');
                    fileLabel.className = 'chess-coord chess-coord-file';
                    fileLabel.textContent = file;
                    square.appendChild(fileLabel);
                }

                square.addEventListener('click', () => {
                    handleSquareClick(squareName, piece);
                });

                boardElement.appendChild(square);
            });
        });
    }

    function handleSquareClick(square, piece) {
        if (!chessSocket || chessSocket.readyState !== WebSocket.OPEN) {
            return;
        }

        if (gameFinished) return;

        const isOwnPiece = piece && (
            playerColor === 'white'
                ? piece === piece.toUpperCase()
                : piece === piece.toLowerCase()
        );

        if (!selectedSquare) {
            if (isOwnPiece) {
                selectedSquare = square;
                renderBoard(currentFen);
            }
            return;
        }

        if (isOwnPiece) {
            selectedSquare = square;
            renderBoard(currentFen);
            return;
        }

        const move = selectedSquare + square;

        chessSocket.send(JSON.stringify({
            type: 'move',
            move: move
        }));

        selectedSquare = null;
        renderBoard(currentFen);
    }

    function addMoveToHistory(move) {
        if (!move) return;

        const movesElement = document.getElementById('chessMoves');
        if (!movesElement) return;

        if (moveNumber === 0) {
            movesElement.innerHTML = '';
        }

        moveNumber++;

        const moveElement = document.createElement('div');
        moveElement.textContent = moveNumber + '. ' + move;
        movesElement.appendChild(moveElement);
        movesElement.scrollTop = movesElement.scrollHeight;
    }

    function connectToRoom(roomId) {
        if (!tg?.initData) {
            showToast('Открой игру через Telegram');
            return;
        }

        if (chessSocket) {
            chessSocket.close();
            chessSocket = null;
        }

        currentRoom = roomId;
        selectedSquare = null;
        gameFinished = false;
        moveNumber = 0;

        document.getElementById('chessMoves').innerHTML =
            '<span class="chess-move-empty">Ходы появятся здесь</span>';

        const protocol = location.protocol === 'https:'
            ? 'wss:'
            : 'ws:';

        const url = protocol + '//' +
            new URL(API_URL).host +
            '/ws/chess/' + encodeURIComponent(roomId) +
            '?initData=' + encodeURIComponent(tg.initData);

        chessSocket = new WebSocket(url);

        showChessGame();

        document.getElementById('chessRoomCode').textContent = roomId;

        document.getElementById('chessStatus').textContent =
            'Подключение...';

        chessSocket.onopen = () => {
            showToast('Соединение установлено');
        };

        chessSocket.onmessage = event => {
            let data;

            try {
                data = JSON.parse(event.data);
            } catch (error) {
                console.error('CHESS MESSAGE ERROR:', error);
                return;
            }

            if (data.error) {
                showToast(data.error);
                return;
            }

            if (data.type === 'connected') {
                playerColor = data.color;
                updatePlayerLabels();
            }

            if (data.move) {
                addMoveToHistory(data.move);
            }

            if (data.fen) {
                renderBoard(data.fen);

                document.getElementById('chessStatus').textContent =
                    data.game_over
                        ? 'Партия завершена'
                        : 'Ход: ' + (
                            data.turn === 'white' ? 'красных' : 'чёрных'
                        );
            }

            if (data.game_over) {
                gameFinished = true;

                const status = document.getElementById('chessStatus');

                if (data.result === '1-0') {
                    status.textContent = playerColor === 'white'
                        ? 'ПОБЕДА!'
                        : 'ПОРАЖЕНИЕ';
                } else if (data.result === '0-1') {
                    status.textContent = playerColor === 'black'
                        ? 'ПОБЕДА!'
                        : 'ПОРАЖЕНИЕ';
                } else {
                    status.textContent = 'НИЧЬЯ';
                }

                tg?.HapticFeedback?.notificationOccurred('success');
            }
        };

        chessSocket.onerror = () => {
            showToast('Ошибка подключения');
        };

        chessSocket.onclose = () => {
            if (!gameFinished) {
                showToast('Соединение закрыто');
            }
        };
    }

    // ==========================================
    // CREATE ROOM
    // ==========================================

    document.getElementById('createChess').addEventListener('click', async () => {
        if (!tg?.initData) {
            showToast('Открой REQUIEM через Telegram');
            return;
        }

        const button = document.getElementById('createChess');
        button.disabled = true;
        button.textContent = 'СОЗДАНИЕ...';

        try {
            const response = await fetch(API_URL + '/api/chess/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    initData: tg.initData
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Ошибка создания комнаты');
            }

            connectToRoom(data.room_id);

        } catch (error) {
            showToast(error.message);
            console.error('CHESS CREATE ERROR:', error);
        } finally {
            button.disabled = false;
            button.textContent = 'СОЗДАТЬ КОМНАТУ';
        }
    });

    // ==========================================
    // JOIN ROOM
    // ==========================================

    document.getElementById('joinChess').addEventListener('click', () => {
        const code = document.getElementById('chessCode')
            .value.trim().toUpperCase();

        if (!/^[A-F0-9]{6}$/.test(code)) {
            showToast('Проверь код комнаты');
            return;
        }

        connectToRoom(code);
    });

    // ==========================================
    // COPY ROOM CODE
    // ==========================================

    document.getElementById('copyChessCode').addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(currentRoom);
            showToast('Код скопирован');
        } catch {
            showToast('Не удалось скопировать код');
        }
    });

    // ==========================================
    // LEAVE GAME
    // ==========================================

    document.getElementById('leaveChess').addEventListener('click', () => {
        if (chessSocket) {
            chessSocket.close();
            chessSocket = null;
        }

        currentRoom = '';
        selectedSquare = null;
        gameFinished = false;
        playerColor = '';
        currentFen = '';
        moveNumber = 0;

        showChessLobby();
        showToast('Ты вышел из партии');
    });

    // ==========================================
    // NAVIGATION
    // ==========================================

    document.querySelectorAll('[data-page]').forEach(el => {
        el.addEventListener('click', () => {
            const page = el.dataset.page;

            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.toggle(
                    'active',
                    item.dataset.page === page
                );
            });

            const ratingSection = document.getElementById('ratingSection');

            if (ratingSection) {
                ratingSection.style.display =
                    page === 'rating' ? 'block' : 'none';
            }

            chessPanel.style.display =
                page === 'games' ? 'block' : 'none';

            if (page === 'rating' && ratingSection) {
                ratingSection.scrollIntoView({
                    behavior: 'smooth'
                });
            } else if (page === 'games') {
                chessPanel.scrollIntoView({
                    behavior: 'smooth'
                });
            } else {
                showToast(labels[page] || page);
            }

            tg?.HapticFeedback?.selectionChanged();
        });
    });

    // ==========================================
    // SETTINGS
    // ==========================================

    const settingsButton = document.getElementById('settings');

    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            showToast('Настройки — добавим следующим этапом');
        });
    }

    // ==========================================
    // ELO LEADERBOARD
    // ==========================================

    async function loadPlayers() {
        try {
            const response = await fetch(API_URL + '/api/leaderboard');

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            const data = await response.json();
            const ratingList = document.getElementById('ratingList');

            if (!ratingList) return;

            ratingList.innerHTML = '';

            const players = Array.isArray(data.leaderboard)
                ? data.leaderboard
                : [];

            players.forEach((player, index) => {
                const card = document.createElement('div');
                card.className = 'rating-player';

                const name = player.first_name ||
                    player.username ||
                    'Игрок';

                const place = document.createElement('div');
                place.className = 'rating-place';
                place.textContent = index + 1;

                const info = document.createElement('div');
                info.className = 'rating-info';

                const playerName = document.createElement('strong');
                playerName.textContent = name;

                const playerUsername = document.createElement('small');
                playerUsername.textContent = player.username
                    ? '@' + player.username
                    : 'Игрок REQUIEM';

                const elo = document.createElement('strong');
                elo.textContent = (player.elo ?? 1000) + ' ELO';
                elo.style.color = '#ed2638';

                info.appendChild(playerName);
                info.appendChild(playerUsername);
                info.appendChild(elo);

                card.appendChild(place);
                card.appendChild(info);

                ratingList.appendChild(card);
            });

            if (players.length === 0) {
                ratingList.textContent = 'Пока игроков нет';
            }

        } catch (error) {
            console.error('REQUIEM RATING ERROR:', error);
        }
    }

    // ==========================================
    // PLAYER REGISTRATION
    // ==========================================

    async function registerPlayer() {
        if (!tg?.initData) {
            console.warn('Открой REQUIEM через Telegram');
            await loadPlayers();
            return;
        }

        try {
            const response = await fetch(API_URL + '/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    initData: tg.initData
                })
            });

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            const result = await response.json();

            console.log('REQUIEM REGISTRATION:', result);

            await loadPlayers();

        } catch (error) {
            console.error('REGISTRATION ERROR:', error);
            await loadPlayers();
        }
    }

    registerPlayer();
});
