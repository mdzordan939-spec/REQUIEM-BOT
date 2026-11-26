
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
    // REQUIEM CHESS — STYLES
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

        /* КРУПНЫЕ И КОНТРАСТНЫЕ ФИГУРЫ */

        .chess-piece {
            display: block;
            position: relative;
            z-index: 1;
            font-family: "DejaVu Sans", "Segoe UI Symbol", serif;
            font-size: clamp(32px, 8vw, 58px);
            line-height: 1;
            text-align: center;
            pointer-events: none;
            transform: scale(1.18);
            transform-origin: center;
            filter: drop-shadow(0 2px 3px #000);
        }

        .chess-white-piece {
            color: #ff1744;
            -webkit-text-stroke: 0.6px #ffb0bd;
            text-shadow:
                0 0 4px #ff8a9b,
                0 0 10px rgba(255, 0, 40, .9),
                0 0 17px rgba(255, 0, 40, .55);
        }

        .chess-black-piece {
            color: #171717;
            -webkit-text-stroke: 2px #d0d0d0;
            text-shadow:
                0 0 3px #fff,
                0 0 7px rgba(255,255,255,.7),
                0 3px 4px #000;
        }

        .chess-black-pawn {
            transform: scale(1.42);
            -webkit-text-stroke: 2.2px #e0e0e0;
        }

        .chess-coord {
            position: absolute;
            z-index: 2;
            color: rgba(255,255,255,.58);
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

        .chess-button:disabled {
            opacity: .6;
            cursor: wait;
        }

        .chess-button-secondary {
            background: #151112;
            border-color: #49202a;
            color: #ddd;
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

            .chess-brand {
                font-size: 16px;
            }

            .chess-player {
                padding: 9px;
            }

            .chess-piece {
                font-size: clamp(27px, 9vw, 50px);
            }
        }

        @media (max-width: 360px) {
            .chess-sidebar {
                grid-template-columns: 1fr;
            }

            .chess-sidebar .chess-card:last-child {
                grid-column: auto;
            }

            .chess-piece {
                font-size: clamp(23px, 8.5vw, 38px);
            }
        }
    `;

    document.head.appendChild(chessStyle);

    // ==========================================
    // CHESS INTERFACE
    // ==========================================

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

            <input id="chessCode"
                maxlength="6"
                placeholder="КОД КОМНАТЫ"
                autocomplete="off">

            <button class="chess-button chess-button-secondary"
                id="joinChess">
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
                        <div class="chess-player-side" id="opponentSide">
                            ЧЁРНЫЕ
                        </div>
                    </div>

                    <div class="chess-board-frame">
                        <div id="chessBoard"></div>
                    </div>

                    <div class="chess-player"
                        style="margin-top:10px;margin-bottom:0">
                        <div class="chess-player-avatar">R</div>
                        <div class="chess-player-info">
                            <div class="chess-player-name" id="myChessName"></div>
                            <div class="chess-player-rank">
                                Уровень 1 · ELO 1000
                            </div>
                        </div>
                        <div class="chess-player-side" id="mySide">
                            КРАСНЫЕ
                        </div>
                    </div>

                    <div class="chess-status">
                        <span class="chess-status-label">
                            Состояние партии
                        </span>
                        <span id="chessStatus">
                            Ожидание подключения...
                        </span>
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
                        <button class="chess-button chess-button-secondary"
                            id="leaveChess">
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
    // CHESS LOGIC
    // ==========================================

    const boardElement = document.getElementById('chessBoard');
    const lobbyElement = document.getElementById('chessLobby');
    const gameElement = document.getElementById('chessGame');

    const chessStatus = document.getElementById('chessStatus');
    const chessRoomCode = document.getElementById('chessRoomCode');
    const chessMoves = document.getElementById('chessMoves');

    const myChessName = document.getElementById('myChessName');
    const opponentName = document.getElementById('opponentName');

    const opponentSide = document.getElementById('opponentSide');
    const mySide = document.getElementById('mySide');

    const pieces = {
        K: '♔',
        Q: '♕',
        R: '♖',
        B: '♗',
        N: '♘',
        P: '♙',

        k: '♚',
        q: '♛',
        r: '♜',
        b: '♝',
        n: '♞',
        p: '♟'
    };

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    let socket = null;
    let currentRoom = null;
    let playerColor = null;
    let currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    let selectedSquare = null;
    let gameFinished = false;
    let isMyTurn = false;
    let moveHistory = [];
    let boardFlipped = false;

    // ==========================================
    // HELPERS
    // ==========================================

    function setChessStatus(message) {
        if (chessStatus) {
            chessStatus.textContent = message;
        }
    }

    function showChessGame() {
        lobbyElement.style.display = 'none';
        gameElement.style.display = 'block';
    }

    function showChessLobby() {
        lobbyElement.style.display = 'block';
        gameElement.style.display = 'none';
    }

    function getTelegramInitData() {
        return tg?.initData || '';
    }

    function getWebSocketUrl(room) {
        const initData = encodeURIComponent(getTelegramInitData());

        return `wss://requiem-bot-7eyu.onrender.com/ws/chess/${encodeURIComponent(room)}?initData=${initData}`;
    }

    function parseFen(fen) {
        const position = fen.split(' ')[0];
        const rows = position.split('/');
        const board = [];

        for (const row of rows) {
            const line = [];

            for (const char of row) {
                if (/[1-8]/.test(char)) {
                    const emptyCount = Number(char);

                    for (let i = 0; i < emptyCount; i++) {
                        line.push('');
                    }
                } else {
                    line.push(char);
                }
            }

            board.push(line);
        }

        return board;
    }

    function squareName(row, col) {
        return files[col] + (8 - row);
    }

    function getBoardCoordinates() {
        const coordinates = [];

        if (boardFlipped) {
            for (let row = 7; row >= 0; row--) {
                for (let col = 7; col >= 0; col--) {
                    coordinates.push({ row, col });
                }
            }
        } else {
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    coordinates.push({ row, col });
                }
            }
        }

        return coordinates;
    }

    function isOwnPiece(piece) {
        if (!piece || !playerColor) return false;

        if (playerColor === 'white') {
            return piece === piece.toUpperCase();
        }

        return piece === piece.toLowerCase();
    }

    function updatePlayerLabels() {
        const isWhite = playerColor === 'white';

        if (myChessName) {
            myChessName.textContent = username;
        }

        if (opponentName) {
            opponentName.textContent = 'Соперник';
        }

        if (mySide) {
            mySide.textContent = isWhite ? 'КРАСНЫЕ' : 'ЧЁРНЫЕ';
        }

        if (opponentSide) {
            opponentSide.textContent = isWhite ? 'ЧЁРНЫЕ' : 'КРАСНЫЕ';
        }
    }

    // ==========================================
    // BOARD RENDERING
    // ==========================================

    function renderBoard() {
        if (!boardElement) return;

        const board = parseFen(currentFen);
        boardElement.innerHTML = '';

        const coordinates = getBoardCoordinates();

        coordinates.forEach(({ row, col }) => {
            const piece = board[row]?.[col] || '';
            const square = document.createElement('div');

            square.className = 'chess-square';
            square.classList.add(
                (row + col) % 2 === 0 ? 'chess-light' : 'chess-dark'
            );

            const name = squareName(row, col);
            square.dataset.square = name;

            if (selectedSquare === name) {
                square.classList.add('chess-selected');
            }

            const pieceElement = document.createElement('span');

            pieceElement.className = 'chess-piece';
            pieceElement.textContent = pieces[piece] || '';

            if (piece) {
                if (piece === piece.toUpperCase()) {
                    pieceElement.classList.add('chess-white-piece');
                } else {
                    pieceElement.classList.add('chess-black-piece');
                }

                if (piece === 'p') {
                    pieceElement.classList.add('chess-black-pawn');
                }
            }

            square.appendChild(pieceElement);

            if (col === (boardFlipped ? 7 : 0)) {
                const rank = document.createElement('span');
                rank.className = 'chess-coord chess-coord-rank';
                rank.textContent = String(8 - row);
                square.appendChild(rank);
            }

            if (row === (boardFlipped ? 0 : 7)) {
                const file = document.createElement('span');
                file.className = 'chess-coord chess-coord-file';
                file.textContent = files[col];
                square.appendChild(file);
            }

            square.addEventListener('click', () => {
                handleSquareClick(name);
            });

            boardElement.appendChild(square);
        });
    }

    // ==========================================
    // MOVE SELECTION
    // ==========================================

    function handleSquareClick(square) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            showToast('Нет подключения к игре');
            return;
        }

        if (gameFinished) {
            showToast('Партия уже завершена');
            return;
        }

        if (!isMyTurn) {
            showToast('Сейчас ход соперника');
            return;
        }

        const board = parseFen(currentFen);
        const col = files.indexOf(square[0]);
        const row = 8 - Number(square[1]);

        const clickedPiece = board[row]?.[col] || '';

        if (!selectedSquare) {
            if (!clickedPiece || !isOwnPiece(clickedPiece)) {
                showToast('Выбери свою фигуру');
                return;
            }

            selectedSquare = square;
            renderBoard();
            return;
        }

        if (selectedSquare === square) {
            selectedSquare = null;
            renderBoard();
            return;
        }

        if (clickedPiece && isOwnPiece(clickedPiece)) {
            selectedSquare = square;
            renderBoard();
            return;
        }

        const move = selectedSquare + square;

        selectedSquare = null;
        renderBoard();

        sendChessMove(move);
    }

    function sendChessMove(move) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            showToast('Соединение потеряно');
            return;
        }

        socket.send(JSON.stringify({
            type: 'move',
            move: move
        }));
    }

    // ==========================================
    // MOVE HISTORY
    // ==========================================

    function addMoveToHistory(move) {
        if (!move) return;

        moveHistory.push(move);

        if (!chessMoves) return;

        chessMoves.innerHTML = '';

        moveHistory.forEach((item, index) => {
            const line = document.createElement('div');

            line.textContent = `${index + 1}. ${item}`;
            chessMoves.appendChild(line);
        });

        chessMoves.scrollTop = chessMoves.scrollHeight;
    }

    // ==========================================
    // WEBSOCKET CONNECTION
    // ==========================================

    function connectToRoom(room) {
        if (socket) {
            socket.onclose = null;
            socket.close();
            socket = null;
        }

        currentRoom = room;
        selectedSquare = null;
        gameFinished = false;
        moveHistory = [];
        playerColor = null;
        boardFlipped = false;

        if (chessRoomCode) {
            chessRoomCode.textContent = room;
        }

        if (chessMoves) {
            chessMoves.innerHTML = `
                <span class="chess-move-empty">
                    Ходы появятся здесь
                </span>
            `;
        }

        currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

        showChessGame();
        setChessStatus('Подключение...');
        renderBoard();

        try {
            socket = new WebSocket(getWebSocketUrl(room));
        } catch (error) {
            console.error('Chess WebSocket error:', error);
            setChessStatus('Ошибка подключения');
            showToast('Не удалось подключиться');
            return;
        }

        socket.addEventListener('open', () => {
            setChessStatus('Подключено');
        });

        socket.addEventListener('message', (event) => {
            let data;

            try {
                data = JSON.parse(event.data);
            } catch (error) {
                console.error('Invalid chess message:', error);
                return;
            }

            handleChessMessage(data);
        });

        socket.addEventListener('close', () => {
            if (!gameFinished && currentRoom) {
                setChessStatus('Соединение закрыто');
            }
        });

        socket.addEventListener('error', (error) => {
            console.error('Chess socket error:', error);
            setChessStatus('Ошибка соединения');
        });
    }

    // ==========================================
    // SERVER MESSAGES
    // ==========================================

    function handleChessMessage(data) {
        if (!data || typeof data !== 'object') return;

        if (data.color) {
            playerColor = data.color.toLowerCase();

            if (playerColor === 'black' || playerColor === 'b') {
                playerColor = 'black';
            } else if (playerColor === 'white' || playerColor === 'w') {
                playerColor = 'white';
            }

            boardFlipped = playerColor === 'black';
            updatePlayerLabels();
        }

        if (data.fen) {
            currentFen = data.fen;
        }

        if (typeof data.turn === 'string') {
            const turn = data.turn.toLowerCase();

            isMyTurn =
                (playerColor === 'white' && (turn === 'w' || turn === 'white')) ||
                (playerColor === 'black' && (turn === 'b' || turn === 'black'));
        }

        if (data.move) {
            addMoveToHistory(data.move);
        }

        if (data.opponent_name && opponentName) {
            opponentName.textContent = data.opponent_name;
        }

        if (data.game_over) {
            gameFinished = true;
            isMyTurn = false;

            if (data.result === '1-0') {
                setChessStatus('Победа красных');
            } else if (data.result === '0-1') {
                setChessStatus('Победа чёрных');
            } else {
                setChessStatus('Ничья');
            }
        } else if (isMyTurn) {
            setChessStatus('Ваш ход');
        } else {
            setChessStatus('Ход соперника');
        }

        selectedSquare = null;
        renderBoard();
    }

    // ==========================================
    // CREATE CHESS ROOM
    // ==========================================

    async function createChessRoom() {
        const button = document.getElementById('createChess');

        if (button) {
            button.disabled = true;
            button.textContent = 'СОЗДАНИЕ...';
        }

        try {
            const response = await fetch(`${API_URL}/api/chess/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': getTelegramInitData()
                },
                body: JSON.stringify({
                    initData: getTelegramInitData()
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || data.error || 'Ошибка создания комнаты');
            }

            const room =
                data.room ||
                data.code ||
                data.room_code ||
                data.room_id;

            if (!room) {
                throw new Error('Сервер не вернул код комнаты');
            }

            connectToRoom(String(room).toUpperCase());
            showToast('Комната создана');

        } catch (error) {
            console.error('Create room error:', error);
            showToast(error.message || 'Не удалось создать комнату');
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = 'СОЗДАТЬ КОМНАТУ';
            }
        }
    }

    // ==========================================
    // JOIN CHESS ROOM
    // ==========================================

    function joinChessRoom() {
        const input = document.getElementById('chessCode');

        const room = input?.value
            .trim()
            .toUpperCase();

        if (!room) {
            showToast('Введи код комнаты');
            return;
        }

        if (!/^[A-F0-9]{6}$/.test(room)) {
            showToast('Код должен состоять из 6 символов');
            return;
        }

        connectToRoom(room);
    }

    // ==========================================
    // COPY ROOM CODE
    // ==========================================

    async function copyChessRoomCode() {
        if (!currentRoom) {
            showToast('Комната не найдена');
            return;
        }

        try {
            await navigator.clipboard.writeText(currentRoom);
            showToast('Код скопирован');
        } catch (error) {
            const temporaryInput = document.createElement('textarea');

            temporaryInput.value = currentRoom;
            document.body.appendChild(temporaryInput);
            temporaryInput.select();

            try {
                document.execCommand('copy');
                showToast('Код скопирован');
            } catch (copyError) {
                showToast('Не удалось скопировать код');
            }

            temporaryInput.remove();
        }
    }

    // ==========================================
    // LEAVE CHESS GAME
    // ==========================================

    function leaveChessGame() {
        if (socket) {
            socket.onclose = null;
            socket.close();
            socket = null;
        }

        currentRoom = null;
        playerColor = null;
        selectedSquare = null;
        gameFinished = false;
        isMyTurn = false;
        moveHistory = [];
        boardFlipped = false;

        showChessLobby();
        showToast('Ты вышел из партии');
    }

    // ==========================================
    // BUTTON EVENTS
    // ==========================================

    document.getElementById('createChess')
        ?.addEventListener('click', createChessRoom);

    document.getElementById('joinChess')
        ?.addEventListener('click', joinChessRoom);

    document.getElementById('copyChessCode')
        ?.addEventListener('click', copyChessRoomCode);

    document.getElementById('leaveChess')
        ?.addEventListener('click', leaveChessGame);

    document.getElementById('chessCode')
        ?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                joinChessRoom();
            }
        });

    // ==========================================
    // NAVIGATION
    // ==========================================

    function showPage(page) {
        const allPages = document.querySelectorAll('[data-page]');

        allPages.forEach(element => {
            const isActive = element.dataset.page === page;

            element.style.display = isActive ? '' : 'none';

            element.classList.toggle('active', isActive);
        });

        if (page === 'games') {
            chessPanel.style.display = 'block';
        } else {
            chessPanel.style.display = 'none';
        }
    }

    document.querySelectorAll('[data-page]').forEach(element => {
        element.addEventListener('click', () => {
            const page = element.dataset.page;

            if (!page) return;

            showPage(page);

            if (labels[page]) {
                const pageTitle = document.getElementById('pageTitle');

                if (pageTitle) {
                    pageTitle.textContent = labels[page];
                }
            }
        });
    });

    // ==========================================
    // PLAYER REGISTRATION
    // ==========================================

    async function registerPlayer() {
        try {
            const response = await fetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': getTelegramInitData()
                },
                body: JSON.stringify({
                    initData: getTelegramInitData()
                })
            });

            if (!response.ok) {
                console.warn('Player registration failed:', response.status);
            }
        } catch (error) {
            console.error('Registration error:', error);
        }
    }

    // ==========================================
    // LEADERBOARD
    // ==========================================

    async function loadLeaderboard() {
        try {
            const response = await fetch(`${API_URL}/api/leaderboard`);

            if (!response.ok) {
                throw new Error('Не удалось загрузить рейтинг');
            }

            const data = await response.json();

            const leaderboard =
                Array.isArray(data) ? data :
                Array.isArray(data.players) ? data.players :
                Array.isArray(data.leaderboard) ? data.leaderboard :
                [];

            const container =
                document.getElementById('leaderboard') ||
                document.getElementById('ratingList');

            if (!container) return;

            container.innerHTML = '';

            if (leaderboard.length === 0) {
                container.textContent = 'Пока нет игроков в рейтинге';
                return;
            }

            leaderboard.forEach((player, index) => {
                const item = document.createElement('div');

                item.className = 'leaderboard-item';

                const name = document.createElement('span');
                name.textContent =
                    player.name ||
                    player.username ||
                    player.first_name ||
                    'Игрок';

                const rating = document.createElement('span');
                rating.textContent =
                    `${player.elo ?? player.rating ?? 1000} ELO`;

                const position = document.createElement('span');
                position.textContent = `#${index + 1}`;

                item.appendChild(position);
                item.appendChild(name);
                item.appendChild(rating);

                container.appendChild(item);
            });

        } catch (error) {
            console.error('Leaderboard error:', error);
        }
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    registerPlayer();
    loadLeaderboard();

    showChessLobby();

    console.log('REQUIEM Mini App initialized');
    console.log('REQUIEM Chess initialized');

});
