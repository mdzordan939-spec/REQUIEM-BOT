
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

    if (user?.first_name) {
        const el = document.getElementById('username');
        if (el) {
            el.textContent = [
                user.first_name,
                user.last_name
            ].filter(Boolean).join(' ');
        }
    }

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

    // ШАХМАТНЫЙ ИНТЕРФЕЙС

    const chessStyle = document.createElement('style');

    chessStyle.textContent = `
        #chessPanel {
            display:none;
            position:relative;
            z-index:20;
            margin:18px 0;
            padding:16px;
            background:#111;
            border:1px solid #292929;
            border-radius:16px;
            color:#fff;
        }

        #chessPanel h2 {
            margin:0 0 16px;
            color:#ed2638;
        }

        .chess-button {
            width:100%;
            padding:13px;
            margin:6px 0;
            border:1px solid #a91628;
            border-radius:10px;
            background:#c71930;
            color:white;
            font-weight:bold;
            cursor:pointer;
        }

        .chess-secondary {
            background:#191919;
            border-color:#444;
        }

        #chessCode {
            width:100%;
            padding:13px;
            margin:10px 0;
            box-sizing:border-box;
            background:#080808;
            border:1px solid #444;
            border-radius:9px;
            color:white;
            font-size:17px;
            text-align:center;
        }

        #chessBoard {
            display:grid;
            grid-template-columns:repeat(8,1fr);
            width:100%;
            max-width:440px;
            margin:16px auto;
            aspect-ratio:1;
            border:3px solid #333;
            box-sizing:border-box;
        }

        .chess-square {
            display:flex;
            align-items:center;
            justify-content:center;
            min-width:0;
            aspect-ratio:1;
            font-size:clamp(23px,7vw,43px);
            cursor:pointer;
            user-select:none;
        }

        .chess-light { background:#e1d5bd; }
        .chess-dark { background:#704b49; }

        .chess-selected {
            outline:3px solid #ff263f;
            outline-offset:-3px;
        }

        .chess-white-piece {
            color:#fff;
            text-shadow:0 2px 3px #222, 0 0 2px #222;
        }

        .chess-black-piece {
            color:#171717;
            text-shadow:0 1px 1px #999;
        }

        #chessStatus {
            text-align:center;
            color:#ddd;
            margin:12px 0;
        }

        #chessRoomInfo {
            text-align:center;
            color:#aaa;
            font-size:13px;
        }
    `;

    document.head.appendChild(chessStyle);

    const chessPanel = document.createElement('section');
    chessPanel.id = 'chessPanel';

    chessPanel.innerHTML = `
        <h2>♟ REQUIEM CHESS</h2>

        <div id="chessLobby">
            <button class="chess-button" id="createChess">
                СОЗДАТЬ КОМНАТУ
            </button>

            <div style="text-align:center;color:#888;margin:12px">
                ИЛИ
            </div>

            <input
                id="chessCode"
                maxlength="6"
                placeholder="КОД КОМНАТЫ"
                autocomplete="off"
            >

            <button class="chess-button chess-secondary" id="joinChess">
                ПРИСОЕДИНИТЬСЯ
            </button>
        </div>

        <div id="chessGame" style="display:none">
            <div id="chessRoomInfo"></div>
            <div id="chessStatus">Ожидание подключения...</div>
            <div id="chessBoard"></div>

            <button class="chess-button chess-secondary" id="copyChessCode">
                СКОПИРОВАТЬ КОД
            </button>

            <button class="chess-button chess-secondary" id="leaveChess">
                ВЫЙТИ ИЗ ИГРЫ
            </button>
        </div>
    `;

    const menu = document.querySelector('.menu');

    if (menu) {
        menu.insertAdjacentElement('afterend', chessPanel);
    } else {
        document.querySelector('main')?.appendChild(chessPanel);
    }

    let chessSocket = null;
    let currentRoom = '';
    let playerColor = '';
    let currentFen = '';
    let selectedSquare = null;
    let gameFinished = false;

    const pieces = {
        K: '♔', Q: '♕', R: '♖',
        B: '♗', N: '♘', P: '♙',
        k: '♚', q: '♛', r: '♜',
        b: '♝', n: '♞', p: '♟'
    };

    function showChessGame() {
        document.getElementById('chessLobby').style.display = 'none';
        document.getElementById('chessGame').style.display = 'block';
    }

    function showChessLobby() {
        document.getElementById('chessLobby').style.display = 'block';
        document.getElementById('chessGame').style.display = 'none';
    }

    function renderBoard(fen) {
        currentFen = fen;

        const boardElement = document.getElementById('chessBoard');
        if (!boardElement) return;

        boardElement.innerHTML = '';

        const rows = fen.split(' ')[0].split('/');

        let board = [];

        rows.forEach(row => {
            let line = [];

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
                    square.textContent = pieces[piece];

                    square.classList.add(
                        piece === piece.toUpperCase()
                            ? 'chess-white-piece'
                            : 'chess-black-piece'
                    );
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

    function connectToRoom(roomId) {
        if (!tg?.initData) {
            showToast('Открой игру через Telegram');
            return;
        }

        currentRoom = roomId;
        selectedSquare = null;
        gameFinished = false;

        const protocol = location.protocol === 'https:'
            ? 'wss:'
            : 'ws:';

        const url = protocol + '//' +
            new URL(API_URL).host +
            '/ws/chess/' + encodeURIComponent(roomId) +
            '?initData=' + encodeURIComponent(tg.initData);

        chessSocket = new WebSocket(url);

        showChessGame();

        document.getElementById('chessRoomInfo').textContent =
            'КОМНАТА: ' + roomId;

        document.getElementById('chessStatus').textContent =
            'Подключение...';

        chessSocket.onopen = () => {
            showToast('Соединение установлено');
        };

        chessSocket.onmessage = event => {
            const data = JSON.parse(event.data);

            if (data.error) {
                showToast(data.error);
                return;
            }

            if (data.type === 'connected') {
                playerColor = data.color;
            }

            if (data.fen) {
                renderBoard(data.fen);

                document.getElementById('chessStatus').textContent =
                    data.game_over
                        ? 'Партия завершена: ' + data.result
                        : 'Ход: ' + (
                            data.turn === 'white' ? 'белых' : 'чёрных'
                        );
            }

            if (data.game_over) {
                gameFinished = true;

                const status = document.getElementById('chessStatus');

                if (data.result === '1-0') {
                    status.textContent = playerColor === 'white'
                        ? '🏆 ПОБЕДА!'
                        : 'ПОРАЖЕНИЕ';
                } else if (data.result === '0-1') {
                    status.textContent = playerColor === 'black'
                        ? '🏆 ПОБЕДА!'
                        : 'ПОРАЖЕНИЕ';
                } else {
                    status.textContent = 'НИЧЬЯ';
                }
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

    document.getElementById('createChess').addEventListener('click', async () => {
        if (!tg?.initData) {
            showToast('Открой REQUIEM через Telegram');
            return;
        }

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
            console.error(error);
        }
    });

    document.getElementById('joinChess').addEventListener('click', () => {
        const code = document.getElementById('chessCode')
            .value.trim().toUpperCase();

        if (!/^[A-F0-9]{6}$/.test(code)) {
            showToast('Проверь код комнаты');
            return;
        }

        connectToRoom(code);
    });

    document.getElementById('copyChessCode').addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(currentRoom);
            showToast('Код скопирован');
        } catch {
            showToast('Не удалось скопировать код');
        }
    });

    document.getElementById('leaveChess').addEventListener('click', () => {
        if (chessSocket) {
            chessSocket.close();
            chessSocket = null;
        }

        currentRoom = '';
        selectedSquare = null;
        gameFinished = false;

        showChessLobby();
        showToast('Ты вышел из партии');
    });

    // НАВИГАЦИЯ

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

    // НАСТРОЙКИ

    const settingsButton = document.getElementById('settings');

    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            showToast('Настройки — добавим следующим этапом');
        });
    }

    // РЕЙТИНГ ELO

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

    // РЕГИСТРАЦИЯ

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
