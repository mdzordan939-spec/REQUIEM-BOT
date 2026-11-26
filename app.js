
document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // REQUIEM CONFIG
    // ==========================================

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

    if (usernameElement) {
        usernameElement.textContent = username;
    }

    const initData = () => tg?.initData || '';

    // ==========================================
    // TOAST
    // ==========================================

    const toast = document.getElementById('toast');
    let toastTimer;

    function showToast(message) {
        if (!toast) {
            console.log(message);
            return;
        }

        toast.textContent = message;
        toast.classList.add('show');

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2400);
    }

    // ==========================================
    // CHESS ENGINE
    // ==========================================

    let chessEnginePromise = null;

    function loadChessEngine() {
        if (window.Chess) {
            return Promise.resolve(true);
        }

        if (chessEnginePromise) {
            return chessEnginePromise;
        }

        chessEnginePromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');

            script.src =
                'https://cdn.jsdelivr.net/npm/chess.js@0.10.3/chess.min.js';

            script.onload = () => {
                if (typeof window.Chess === 'function') {
                    resolve(true);
                } else {
                    reject(new Error('Chess.js не загрузилась'));
                }
            };

            script.onerror = () => {
                reject(new Error('Ошибка загрузки Chess.js'));
            };

            document.head.appendChild(script);
        });

        return chessEnginePromise;
    }

    loadChessEngine().catch(error => {
        console.error(error);
        showToast('Не загрузились подсказки ходов');
    });

    // ==========================================
    // NAVIGATION
    // ==========================================

    const gamesHub = document.getElementById('gamesHub');
    const chessScreen = document.getElementById('chessScreen');
    const ratingSection = document.getElementById('ratingSection');

    const homeElements = [
        ...document.querySelectorAll('.hero'),
        ...document.querySelectorAll('.profile'),
        ...document.querySelectorAll('.stats'),
        ...document.querySelectorAll('.menu'),
        ...Array.from(
            document.querySelectorAll('.section-heading')
        ).slice(0, 2)
    ];

    function hideSections() {
        homeElements.forEach(el => {
            el.style.display = 'none';
        });

        if (gamesHub) gamesHub.style.display = 'none';
        if (chessScreen) chessScreen.style.display = 'none';
        if (ratingSection) ratingSection.style.display = 'none';
    }

    function showPage(page) {
        if (!['home', 'games', 'rating'].includes(page)) {
            showToast('Этот раздел скоро появится');
            return;
        }

        hideSections();

        document.querySelectorAll('.nav-item').forEach(button => {
            button.classList.toggle(
                'active',
                button.dataset.page === page
            );
        });

        if (page === 'home') {
            homeElements.forEach(el => {
                el.style.display = '';
            });
        }

        if (page === 'games' && gamesHub) {
            gamesHub.style.display = 'block';
        }

        if (page === 'rating' && ratingSection) {
            ratingSection.style.display = 'block';
        }
    }

    document.querySelectorAll('[data-page]').forEach(button => {
        button.addEventListener('click', () => {
            showPage(button.dataset.page);
        });
    });

    // ==========================================
    // CHESS DESIGN
    // ==========================================

    const style = document.createElement('style');

    style.textContent = `
        #chessPanel {
            display:none;
            width:100%;
            margin:14px 0 24px;
            padding:14px;
            color:#fff;
            background:
                radial-gradient(
                    ellipse at 50% 0%,
                    rgba(180,0,35,.18),
                    transparent 60%
                ),
                #080808;
            border:1px solid #40121d;
            border-radius:18px;
            box-sizing:border-box;
            overflow:hidden;
        }

        #chessPanel * {
            box-sizing:border-box;
        }

        .chess-heading {
            display:flex;
            align-items:center;
            justify-content:space-between;
            margin-bottom:18px;
        }

        .chess-brand {
            display:flex;
            align-items:center;
            gap:10px;
            font-size:18px;
            font-weight:900;
            letter-spacing:1px;
        }

        .chess-brand-mark {
            width:40px;
            height:40px;
            display:grid;
            place-items:center;
            border:1px solid #ed1735;
            border-radius:50%;
            color:#ed1735;
            font-size:25px;
            box-shadow:0 0 15px rgba(237,23,53,.2);
        }

        .chess-brand span {
            color:#ed1735;
        }

        .chess-online {
            display:flex;
            align-items:center;
            gap:7px;
            color:#aaa;
            font-size:10px;
            letter-spacing:1px;
        }

        .chess-online-dot {
            width:7px;
            height:7px;
            border-radius:50%;
            background:#e51a36;
            box-shadow:0 0 9px #e51a36;
            animation:onlinePulse 1.8s infinite;
        }

        @keyframes onlinePulse {
            50% {
                opacity:.35;
                box-shadow:0 0 2px #e51a36;
            }
        }

        .chess-layout {
            display:grid;
            grid-template-columns:minmax(0,1fr) 180px;
            gap:14px;
            align-items:start;
        }

        .chess-main {
            min-width:0;
        }

        .chess-player {
            display:flex;
            align-items:center;
            gap:10px;
            padding:10px;
            margin-bottom:10px;
            background:#151012;
            border:1px solid #39151e;
            border-radius:11px;
        }

        .chess-player-avatar {
            width:40px;
            height:40px;
            flex:0 0 40px;
            display:grid;
            place-items:center;
            border:1px solid #8e1025;
            border-radius:50%;
            color:#ed1735;
            font-size:22px;
        }

        .chess-player-info {
            min-width:0;
            flex:1;
        }

        .chess-player-name {
            overflow:hidden;
            font-size:13px;
            font-weight:800;
            text-overflow:ellipsis;
            white-space:nowrap;
        }

        .chess-player-rank {
            margin-top:4px;
            color:#888;
            font-size:10px;
        }

        .chess-player-side {
            color:#ed1735;
            font-size:10px;
            font-weight:900;
        }

        .chess-board-frame {
            width:100%;
            padding:5px;
            border:2px solid #e71937;
            border-radius:9px;
            background:#080808;
            box-shadow:0 0 15px rgba(235,15,45,.22);
        }

        #chessBoard {
            display:grid;
            grid-template-columns:repeat(8,minmax(0,1fr));
            width:100%;
            aspect-ratio:1;
            overflow:hidden;
        }

        .chess-square {
            position:relative;
            display:flex;
            align-items:center;
            justify-content:center;
            min-width:0;
            aspect-ratio:1;
            cursor:pointer;
            user-select:none;
            -webkit-tap-highlight-color:transparent;
        }

        .chess-light {
            background:#741329;
        }

        .chess-dark {
            background:#100d0e;
        }

        .chess-square.chess-selected {
            outline:3px solid #ff3153;
            outline-offset:-3px;
            background:#b20e30;
            z-index:2;
        }

        .chess-square.chess-legal::after {
            content:"";
            position:absolute;
            width:25%;
            height:25%;
            border-radius:50%;
            background:#ff1744;
            box-shadow:
                0 0 5px #ff1744,
                0 0 12px rgba(255,23,68,.85);
            pointer-events:none;
            z-index:4;
            animation:legalAppear .18s ease-out both;
        }

        .chess-square.chess-capture::after {
            content:"";
            position:absolute;
            inset:5%;
            border:3px solid #ff1744;
            border-radius:50%;
            background:rgba(255,0,40,.12);
            box-shadow:
                0 0 7px rgba(255,0,50,.8),
                inset 0 0 8px rgba(255,0,50,.25);
            pointer-events:none;
            z-index:4;
            animation:legalAppear .18s ease-out both;
        }

        @keyframes legalAppear {
            from {
                opacity:0;
                transform:scale(.35);
            }
            to {
                opacity:1;
                transform:scale(1);
            }
        }

        .chess-piece-img {
            display:block;
            width:92%;
            height:92%;
            object-fit:contain;
            pointer-events:none;
            user-select:none;
            -webkit-user-drag:none;
            filter:drop-shadow(0 3px 3px rgba(0,0,0,.7));
            z-index:1;
            transform:translate(0,0);
            transition:
                transform .32s cubic-bezier(.22,.75,.25,1),
                filter .2s ease;
            will-change:transform;
        }

        .chess-square.chess-selected .chess-piece-img {
            filter:
                drop-shadow(0 0 7px rgba(255,20,60,.9))
                drop-shadow(0 3px 3px rgba(0,0,0,.7));
        }

        .chess-coord {
            position:absolute;
            z-index:5;
            color:rgba(255,255,255,.65);
            font-size:8px;
            font-weight:800;
            pointer-events:none;
        }

        .chess-coord-rank {
            top:3px;
            left:4px;
        }

        .chess-coord-file {
            right:4px;
            bottom:3px;
        }

        .chess-status {
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:8px;
            padding:12px;
            margin-top:11px;
            background:#111;
            border:1px solid #302027;
            border-radius:9px;
        }

        .chess-status-label {
            color:#888;
            font-size:10px;
            text-transform:uppercase;
        }

        #chessStatus {
            color:#f0203e;
            font-size:12px;
            font-weight:900;
            text-align:right;
        }

        .chess-sidebar {
            display:flex;
            flex-direction:column;
            gap:10px;
        }

        .chess-card {
            padding:12px;
            background:#151012;
            border:1px solid #39151e;
            border-radius:11px;
        }

        .chess-card-title {
            margin-bottom:10px;
            color:#e51a37;
            font-size:10px;
            font-weight:900;
            letter-spacing:1px;
            text-transform:uppercase;
        }

        .chess-room-code {
            color:#fff;
            font-size:19px;
            font-weight:900;
            letter-spacing:3px;
            text-align:center;
        }

        .chess-room-hint {
            margin-top:7px;
            color:#888;
            font-size:10px;
            line-height:1.5;
            text-align:center;
        }

        .chess-button {
            width:100%;
            min-height:42px;
            padding:11px;
            margin-top:8px;
            border:1px solid #ed1735;
            border-radius:8px;
            background:#d71130;
            color:#fff;
            font-size:10px;
            font-weight:900;
            cursor:pointer;
            transition:
                background .2s ease,
                transform .2s ease,
                box-shadow .2s ease;
        }

        .chess-button:active {
            transform:scale(.97);
        }

        .chess-button:hover {
            box-shadow:0 0 14px rgba(237,23,53,.25);
        }

        .chess-button:disabled {
            opacity:.55;
            cursor:wait;
        }

        .chess-button-secondary {
            background:#171214;
            border-color:#49202a;
            color:#ddd;
        }

        #chessCode {
            width:100%;
            min-height:42px;
            padding:10px;
            margin-top:9px;
            border:1px solid #45202a;
            border-radius:8px;
            outline:none;
            background:#080808;
            color:#fff;
            font-size:16px;
            font-weight:900;
            letter-spacing:3px;
            text-align:center;
        }

        .chess-moves {
            min-height:50px;
            max-height:150px;
            overflow-y:auto;
            color:#aaa;
            font-size:11px;
            line-height:1.8;
        }

        .chess-move-empty {
            color:#666;
        }

        #chessLobby {
            max-width:440px;
            margin:auto;
            padding:12px 0;
        }

        .chess-lobby-title {
            margin:0 0 8px;
            font-size:22px;
            font-weight:900;
            text-align:center;
        }

        .chess-lobby-subtitle {
            margin-bottom:20px;
            color:#888;
            font-size:12px;
            text-align:center;
        }

        .chess-divider {
            display:flex;
            align-items:center;
            gap:12px;
            margin:14px 0;
            color:#777;
            font-size:10px;
            letter-spacing:2px;
        }

        .chess-divider:before,
        .chess-divider:after {
            content:"";
            flex:1;
            height:1px;
            background:#382027;
        }

        .leaderboard-item {
            display:flex;
            align-items:center;
            gap:12px;
            padding:13px;
            margin-top:9px;
            background:#121010;
            border:1px solid #302027;
            border-radius:10px;
            color:#eee;
            font-size:13px;
        }

        .leaderboard-item span:first-child {
            color:#ed1735;
            font-weight:900;
        }

        .leaderboard-item span:nth-child(2) {
            flex:1;
        }

        .leaderboard-item span:last-child {
            color:#aaa;
            font-weight:800;
        }

        /* =====================================
           VICTORY / DEFEAT OVERLAY
        ===================================== */

        #chessResult {
            position:fixed;
            inset:0;
            z-index:99999;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:20px;
            background:rgba(0,0,0,.94);
            opacity:0;
            visibility:hidden;
            pointer-events:none;
            transition:
                opacity .45s ease,
                visibility .45s ease;
            overflow:hidden;
        }

        #chessResult.active {
            opacity:1;
            visibility:visible;
            pointer-events:auto;
        }

        .result-backdrop {
            position:absolute;
            inset:0;
            background:
                radial-gradient(
                    circle at 50% 45%,
                    rgba(220,0,40,.2),
                    transparent 55%
                );
            animation:resultBackdrop 3s ease-in-out infinite;
        }

        @keyframes resultBackdrop {
            50% {
                opacity:.35;
                transform:scale(1.15);
            }
        }

        .result-content {
            position:relative;
            z-index:3;
            width:min(100%,420px);
            padding:35px 22px;
            text-align:center;
            transform:translateY(35px) scale(.88);
            opacity:0;
            transition:
                transform .65s cubic-bezier(.16,1,.3,1),
                opacity .5s ease;
        }

        #chessResult.active .result-content {
            transform:translateY(0) scale(1);
            opacity:1;
        }

        .result-symbol {
            width:100px;
            height:100px;
            display:grid;
            place-items:center;
            margin:0 auto 25px;
            border:2px solid #ed1735;
            border-radius:50%;
            color:#ff3153;
            font-size:52px;
            box-shadow:
                0 0 20px rgba(237,23,53,.4),
                inset 0 0 20px rgba(237,23,53,.12);
            animation:resultSymbol 2s ease-in-out infinite;
        }

        @keyframes resultSymbol {
            50% {
                transform:scale(1.08);
                box-shadow:
                    0 0 45px rgba(237,23,53,.65),
                    inset 0 0 25px rgba(237,23,53,.2);
            }
        }

        .result-eyebrow {
            margin-bottom:12px;
            color:#aaa;
            font-size:11px;
            font-weight:900;
            letter-spacing:6px;
        }

        .result-title {
            margin:0;
            color:#fff;
            font-size:clamp(42px,11vw,70px);
            font-weight:1000;
            line-height:1;
            letter-spacing:2px;
            text-shadow:
                0 0 10px rgba(255,0,45,.6),
                0 0 35px rgba(255,0,45,.35);
        }

        .result-title.defeat {
            color:#aeb0b6;
            text-shadow:
                0 0 10px rgba(150,150,150,.25),
                0 0 30px rgba(255,0,45,.15);
            animation:defeatGlitch 2.5s infinite;
        }

        @keyframes defeatGlitch {
            0%,90%,100% {
                transform:translateX(0);
                opacity:1;
            }
            92% {
                transform:translateX(-4px);
                opacity:.7;
            }
            94% {
                transform:translateX(4px);
            }
            96% {
                transform:translateX(-2px);
            }
        }

        .result-description {
            margin:18px 0 28px;
            color:#999;
            font-size:13px;
            line-height:1.6;
        }

        .result-button {
            width:100%;
            min-height:50px;
            margin-top:9px;
            border:1px solid #ed1735;
            border-radius:9px;
            background:#d71130;
            color:white;
            font-size:12px;
            font-weight:900;
            letter-spacing:2px;
            cursor:pointer;
            transition:transform .2s,box-shadow .2s;
        }

        .result-button:active {
            transform:scale(.97);
        }

        .result-button.secondary {
            background:transparent;
            border-color:#4a2630;
            color:#aaa;
        }

        .result-particles {
            position:absolute;
            inset:0;
            overflow:hidden;
            pointer-events:none;
        }

        .result-particle {
            position:absolute;
            bottom:-20px;
            width:4px;
            height:4px;
            border-radius:50%;
            background:#ff1744;
            box-shadow:0 0 12px #ff1744;
            animation:particleRise var(--duration) linear infinite;
            animation-delay:var(--delay);
            opacity:0;
        }

        @keyframes particleRise {
            0% {
                transform:translate3d(0,0,0) scale(.5);
                opacity:0;
            }
            15% {
                opacity:.9;
            }
            85% {
                opacity:.5;
            }
            100% {
                transform:translate3d(var(--drift),-110vh,0) scale(1.5);
                opacity:0;
            }
        }

        .result-flash {
            position:absolute;
            inset:0;
            z-index:2;
            pointer-events:none;
            background:#ff1744;
            opacity:0;
        }

        #chessResult.victory-flash .result-flash {
            animation:victoryFlash .65s ease-out;
        }

        @keyframes victoryFlash {
            0% { opacity:.65; }
            100% { opacity:0; }
        }

        #chessResult.defeat-mode .result-backdrop {
            background:
                radial-gradient(
                    circle at 50% 45%,
                    rgba(100,0,15,.16),
                    transparent 55%
                );
        }

        #chessResult.draw-mode .result-symbol {
            border-color:#777;
            color:#ddd;
            box-shadow:0 0 25px rgba(255,255,255,.15);
        }

        @media(max-width:620px) {
            .chess-layout {
                grid-template-columns:1fr;
            }

            .chess-sidebar {
                display:grid;
                grid-template-columns:1fr 1fr;
            }

            .chess-sidebar .chess-card:last-child {
                grid-column:1/-1;
            }
        }

        @media(max-width:360px) {
            .chess-sidebar {
                grid-template-columns:1fr;
            }

            .chess-sidebar .chess-card:last-child {
                grid-column:auto;
            }
        }

        @media(prefers-reduced-motion:reduce) {
            #chessPanel *,
            #chessResult *,
            #chessResult {
                animation-duration:.01ms !important;
                transition-duration:.01ms !important;
            }
        }
    `;

    document.head.appendChild(style);

    // ==========================================
    // SVG CHESS PIECES
    // ==========================================

    function makePieceSVG(type, color) {
        const red = color === 'red';

        const main = red ? '#d90032' : '#17191d';
        const light = red ? '#ff526e' : '#858b96';
        const dark = red ? '#650016' : '#030405';
        const outline = red ? '#ff9aaa' : '#d1d5dc';

        const shapes = {
            P: `
                <path d="M50 12 C38 12 32 22 35 33 C37 41 43 44 43 47
                L31 72 Q25 79 25 86 L75 86 Q75 79 69 72 L57 47
                C57 44 63 41 65 33 C68 22 62 12 50 12Z"/>
                <path d="M24 87 Q50 80 76 87 L82 94 Q50 101 18 94Z"/>
            `,
            R: `
                <path d="M20 12 H35 V22 H43 V12 H57 V22 H65 V12 H80
                V36 H73 L68 73 H32 L27 36 H20Z"/>
                <path d="M28 42 H72 L76 77 H24Z"/>
                <path d="M20 78 H80 V88 H20Z"/>
                <path d="M14 89 H86 V96 H14Z"/>
            `,
            N: `
                <path d="M22 78 Q34 69 33 57 Q24 44 29 30
                Q33 16 47 12 Q43 27 53 30
                Q68 31 73 47 Q81 66 70 78Z"/>
                <path d="M32 79 H70 L80 91 H20Z"/>
                <circle cx="56" cy="29" r="3" fill="${outline}" stroke="none"/>
                <path d="M30 45 Q45 43 53 51" fill="none"
                stroke="${outline}" stroke-width="3"/>
            `,
            B: `
                <path d="M50 10 C37 10 32 22 38 34
                C41 42 46 48 46 57 L30 78 H70 L54 57
                C54 48 59 42 62 34 C68 22 63 10 50 10Z"/>
                <path d="M30 79 H70 L78 88 H22Z"/>
                <path d="M16 90 H84 V97 H16Z"/>
                <path d="M42 20 L58 37" stroke="${outline}"
                stroke-width="4" fill="none"/>
            `,
            Q: `
                <path d="M20 29 L31 60 L69 60 L80 29
                L69 39 L60 20 L50 39 L40 20 L31 39Z"/>
                <circle cx="20" cy="25" r="6"/>
                <circle cx="40" cy="17" r="6"/>
                <circle cx="60" cy="17" r="6"/>
                <circle cx="80" cy="25" r="6"/>
                <path d="M29 63 H71 L76 80 H24Z"/>
                <path d="M18 82 H82 V91 H18Z"/>
                <path d="M13 92 H87 V98 H13Z"/>
            `,
            K: `
                <path d="M45 8 H55 V23 H68 V33 H55 V45
                Q57 56 70 70 H30 Q43 56 45 45 V33 H32 V23 H45Z"/>
                <path d="M29 72 H71 L78 84 H22Z"/>
                <path d="M15 87 H85 V96 H15Z"/>
                <path d="M50 2 V15 M43 8 H57"
                stroke="${outline}" stroke-width="4" fill="none"/>
            `
        };

        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg"
                 viewBox="0 0 100 104">
                <defs>
                    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stop-color="${light}"/>
                        <stop offset=".35" stop-color="${main}"/>
                        <stop offset="1" stop-color="${dark}"/>
                    </linearGradient>

                    <filter id="shadow" x="-30%" y="-30%"
                            width="160%" height="170%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="2.5"/>
                        <feOffset dy="3"/>
                        <feComponentTransfer>
                            <feFuncA type="linear" slope=".55"/>
                        </feComponentTransfer>
                        <feMerge>
                            <feMergeNode/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>

                <g filter="url(#shadow)"
                   fill="url(#body)"
                   stroke="${outline}"
                   stroke-width="2.2"
                   stroke-linejoin="round">
                    ${shapes[type]}
                </g>
            </svg>
        `;

        return 'data:image/svg+xml;charset=UTF-8,' +
            encodeURIComponent(svg);
    }

    const pieceImages = {};

    ['K', 'Q', 'R', 'B', 'N', 'P'].forEach(type => {
        pieceImages[type] = makePieceSVG(type, 'red');
        pieceImages[type.toLowerCase()] = makePieceSVG(type, 'black');
    });

    // ==========================================
    // CHESS HTML
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

            <input id="chessCode" maxlength="6"
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
                            <div class="chess-player-rank">ELO 1000</div>
                        </div>

                        <div class="chess-player-side" id="opponentSide">
                            ЧЁРНЫЕ
                        </div>
                    </div>

                    <div class="chess-board-frame">
                        <div id="chessBoard"></div>
                    </div>

                    <div class="chess-player" style="margin-top:10px">
                        <div class="chess-player-avatar">R</div>

                        <div class="chess-player-info">
                            <div class="chess-player-name" id="myChessName"></div>
                            <div class="chess-player-rank">ELO 1000</div>
                        </div>

                        <div class="chess-player-side" id="mySide">
                            КРАСНЫЕ
                        </div>
                    </div>

                    <div class="chess-status">
                        <span class="chess-status-label">
                            Состояние партии
                        </span>
                        <span id="chessStatus">Подключение...</span>
                    </div>
                </div>

                <div class="chess-sidebar">
                    <div class="chess-card">
                        <div class="chess-card-title">Комната</div>
                        <div class="chess-room-code" id="chessRoomCode"></div>
                        <div class="chess-room-hint">Отправь код другу</div>

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

    const chessMount = document.getElementById('chessMount');

    if (chessMount) {
        chessMount.appendChild(chessPanel);
    } else {
        console.error('Не найден #chessMount');
    }

    // ==========================================
    // RESULT OVERLAY
    // ==========================================

    const resultOverlay = document.createElement('div');

    resultOverlay.id = 'chessResult';

    resultOverlay.innerHTML = `
        <div class="result-backdrop"></div>
        <div class="result-flash"></div>
        <div class="result-particles" id="resultParticles"></div>

        <div class="result-content">
            <div class="result-symbol" id="resultSymbol">♛</div>

            <div class="result-eyebrow" id="resultEyebrow">
                REQUIEM CHESS
            </div>

            <h1 class="result-title" id="resultTitle">
                VICTORY
            </h1>

            <div class="result-description" id="resultDescription">
                Партия завершена
            </div>

            <button class="result-button" id="resultLobby">
                ВЕРНУТЬСЯ В ЛОББИ
            </button>

            <button class="result-button secondary" id="resultClose">
                ПОСМОТРЕТЬ ДОСКУ
            </button>
        </div>
    `;

    document.body.appendChild(resultOverlay);

    const resultTitle = document.getElementById('resultTitle');
    const resultSymbol = document.getElementById('resultSymbol');
    const resultEyebrow = document.getElementById('resultEyebrow');
    const resultDescription = document.getElementById('resultDescription');
    const resultParticles = document.getElementById('resultParticles');

    let resultShown = false;

    function createResultParticles() {
        resultParticles.innerHTML = '';

        for (let i = 0; i < 55; i++) {
            const particle = document.createElement('span');

            particle.className = 'result-particle';

            particle.style.left = `${Math.random() * 100}%`;
            particle.style.setProperty(
                '--duration',
                `${3 + Math.random() * 5}s`
            );
            particle.style.setProperty(
                '--delay',
                `${Math.random() * 4}s`
            );
            particle.style.setProperty(
                '--drift',
                `${Math.random() * 180 - 90}px`
            );

            resultParticles.appendChild(particle);
        }
    }

    function showGameResult(type, result) {
        if (resultShown) return;

        resultShown = true;

        resultOverlay.classList.remove(
            'victory-flash',
            'defeat-mode',
            'draw-mode'
        );

        if (type === 'victory') {
            resultTitle.textContent = 'VICTORY';
            resultTitle.className = 'result-title';

            resultSymbol.textContent = '♛';
            resultEyebrow.textContent = 'THE CROWN IS YOURS';

            resultDescription.textContent =
                'Ты одержал победу. Эта партия войдёт в историю REQUIEM.';

            resultOverlay.classList.add('victory-flash');
        } else if (type === 'defeat') {
            resultTitle.textContent = 'DEFEAT';
            resultTitle.className = 'result-title defeat';

            resultSymbol.textContent = '♟';
            resultEyebrow.textContent = 'THE BATTLE IS OVER';

            resultDescription.textContent =
                'Сегодня соперник оказался сильнее. Следующая партия — новый шанс.';

            resultOverlay.classList.add('defeat-mode');
        } else {
            resultTitle.textContent = 'DRAW';
            resultTitle.className = 'result-title';

            resultSymbol.textContent = '♙';
            resultEyebrow.textContent = 'EQUAL WARRIORS';

            resultDescription.textContent =
                'Ничья. Ни один из игроков не уступил.';

            resultOverlay.classList.add('draw-mode');
        }

        createResultParticles();

        resultOverlay.classList.add('active');

        if (tg?.HapticFeedback) {
            if (type === 'victory') {
                tg.HapticFeedback.notificationOccurred('success');
            } else if (type === 'defeat') {
                tg.HapticFeedback.notificationOccurred('error');
            } else {
                tg.HapticFeedback.notificationOccurred('warning');
            }
        }
    }

    function hideGameResult() {
        resultOverlay.classList.remove('active');
    }

    // ==========================================
    // GAMES SCREEN
    // ==========================================

    document.getElementById('openChess')?.addEventListener('click', () => {
        if (gamesHub) gamesHub.style.display = 'none';
        if (chessScreen) chessScreen.style.display = 'block';

        chessPanel.style.display = 'block';
    });

    document.getElementById('backToGames')?.addEventListener('click', () => {
        if (chessScreen) chessScreen.style.display = 'none';
        if (gamesHub) gamesHub.style.display = 'block';
    });

    // ==========================================
    // CHESS STATE
    // ==========================================

    const boardElement = document.getElementById('chessBoard');
    const lobbyElement = document.getElementById('chessLobby');
    const gameElement = document.getElementById('chessGame');

    const chessStatus = document.getElementById('chessStatus');
    const chessRoomCode = document.getElementById('chessRoomCode');
    const chessMoves = document.getElementById('chessMoves');

    const myChessName = document.getElementById('myChessName');
    const opponentName = document.getElementById('opponentName');
    const mySide = document.getElementById('mySide');
    const opponentSide = document.getElementById('opponentSide');

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    const INITIAL_FEN =
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    let socket = null;
    let currentRoom = null;
    let playerColor = null;
    let currentFen = INITIAL_FEN;
    let previousRenderedFen = null;

    let selectedSquare = null;
    let legalMoves = [];

    let gameFinished = false;
    let isMyTurn = false;
    let boardFlipped = false;

    let moveHistory = [];
    let animationFrame = null;
    let pendingMove = false;

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

    function normalizeColor(color) {
        const value = String(color || '').toLowerCase();

        if (value === 'white' || value === 'w') return 'white';
        if (value === 'black' || value === 'b') return 'black';

        return null;
    }

    function parseFen(fen) {
        return String(fen || INITIAL_FEN)
            .split(' ')[0]
            .split('/')
            .map(row => {
                const result = [];

                for (const char of row) {
                    if (/[1-8]/.test(char)) {
                        for (let i = 0; i < Number(char); i++) {
                            result.push('');
                        }
                    } else {
                        result.push(char);
                    }
                }

                return result;
            });
    }

    function isOwnPiece(piece) {
        if (!piece || !playerColor) return false;

        return playerColor === 'white'
            ? piece === piece.toUpperCase()
            : piece === piece.toLowerCase();
    }

    // ==========================================
    // MOVE ANIMATION HELPERS
    // ==========================================

    function getPieceMovements(oldFen, newFen) {
        if (!oldFen || !newFen || oldFen === newFen) {
            return [];
        }

        const oldBoard = parseFen(oldFen);
        const newBoard = parseFen(newFen);

        const removed = [];
        const added = [];

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const before = oldBoard[row]?.[col] || '';
                const after = newBoard[row]?.[col] || '';

                if (before === after) continue;

                if (before) {
                    removed.push({
                        piece: before,
                        row,
                        col
                    });
                }

                if (after) {
                    added.push({
                        piece: after,
                        row,
                        col
                    });
                }
            }
        }

        const movements = [];

        // Сначала сопоставляем одинаковые фигуры.
        removed.forEach(source => {
            let bestIndex = -1;
            let bestDistance = Infinity;

            added.forEach((target, index) => {
                if (source.piece !== target.piece) return;

                const distance =
                    Math.abs(source.row - target.row) +
                    Math.abs(source.col - target.col);

                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestIndex = index;
                }
            });

            if (bestIndex === -1) return;

            const target = added.splice(bestIndex, 1)[0];

            movements.push({
                from: files[source.col] + (8 - source.row),
                to: files[target.col] + (8 - target.row)
            });
        });

        // Отдельно обрабатываем превращение пешки.
        removed.forEach(source => {
            if (!/[pP]/.test(source.piece)) return;

            const alreadyMoved = movements.some(move =>
                move.from === files[source.col] + (8 - source.row)
            );

            if (alreadyMoved) return;

            const promotionRow =
                source.piece === 'P' ? 0 : 7;

            if (source.row !== promotionRow) return;

            const targetIndex = added.findIndex(target =>
                target.row === promotionRow
            );

            if (targetIndex === -1) return;

            const target = added.splice(targetIndex, 1)[0];

            movements.push({
                from: files[source.col] + (8 - source.row),
                to: files[target.col] + (8 - target.row)
            });
        });

        return movements;
    }

    function getVisualPosition(square) {
        const col = files.indexOf(square[0]);
        const row = 8 - Number(square[1]);

        return {
            col: boardFlipped ? 7 - col : col,
            row: boardFlipped ? 7 - row : row
        };
    }

    // ==========================================
    // LEGAL MOVES
    // ==========================================

    async function getLegalMoves(square) {
        try {
            await loadChessEngine();

            const chess = new window.Chess(currentFen);

            return chess.moves({
                square,
                verbose: true
            });
        } catch (error) {
            console.error('Ошибка расчёта ходов:', error);
            showToast('Не удалось рассчитать ходы');
            return [];
        }
    }

    // ==========================================
    // BOARD RENDERING
    // ==========================================

    function renderBoard() {
        if (!boardElement) return;

        const oldFen = previousRenderedFen;

        const movements = getPieceMovements(
            oldFen,
            currentFen
        );

        const board = parseFen(currentFen);

        boardElement.innerHTML = '';

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

        const animatedPieces = [];

        coordinates.forEach(({ row, col }) => {
            const piece = board[row]?.[col] || '';

            const square = document.createElement('div');

            square.className = 'chess-square';

            square.classList.add(
                (row + col) % 2 === 0
                    ? 'chess-light'
                    : 'chess-dark'
            );

            const name = files[col] + (8 - row);

            if (selectedSquare === name) {
                square.classList.add('chess-selected');
            }

            square.dataset.square = name;

            const availableMove = legalMoves.find(
                move => move.to === name
            );

            if (availableMove) {
                if (
                    availableMove.captured ||
                    availableMove.flags.includes('e')
                ) {
                    square.classList.add('chess-capture');
                } else {
                    square.classList.add('chess-legal');
                }
            }

            if (piece) {
                const image = document.createElement('img');

                image.className = 'chess-piece-img';
                image.alt = piece;
                image.draggable = false;
                image.src = pieceImages[piece];

                const movement = movements.find(
                    item => item.to === name
                );

                if (movement) {
                    const from = getVisualPosition(movement.from);
                    const to = getVisualPosition(movement.to);

                    const cellWidth = boardElement.clientWidth / 8;
                    const cellHeight = boardElement.clientHeight / 8;

                    const dx = (from.col - to.col) * cellWidth;
                    const dy = (from.row - to.row) * cellHeight;

                    image.style.transition = 'none';

                    image.style.transform =
                        `translate(${dx}px, ${dy}px)`;

                    animatedPieces.push(image);
                }

                square.appendChild(image);
            }

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

        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }

        if (animatedPieces.length) {
            // Применяем начальное положение до запуска перехода.
            boardElement.offsetHeight;

            animationFrame = requestAnimationFrame(() => {
                animatedPieces.forEach(image => {
                    image.style.transition =
                        'transform .32s cubic-bezier(.22,.75,.25,1)';

                    image.style.transform = 'translate(0,0)';
                });
            });
        }

        previousRenderedFen = currentFen;
    }

    // ==========================================
    // MOVE LOGIC
    // ==========================================

    async function handleSquareClick(square) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            showToast('Нет подключения к игре');
            return;
        }

        if (gameFinished || pendingMove) {
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
            legalMoves = await getLegalMoves(square);

            if (selectedSquare !== square) return;

            renderBoard();
            return;
        }

        if (selectedSquare === square) {
            selectedSquare = null;
            legalMoves = [];

            renderBoard();
            return;
        }

        if (clickedPiece && isOwnPiece(clickedPiece)) {
            selectedSquare = square;
            legalMoves = await getLegalMoves(square);

            if (selectedSquare !== square) return;

            renderBoard();
            return;
        }

        const availableMove = legalMoves.find(
            move => move.to === square
        );

        if (!availableMove) {
            showToast('Сюда нельзя сходить');
            return;
        }

        let moveString = selectedSquare + square;

        if (availableMove.flags.includes('p')) {
            moveString += 'q';
        }

        selectedSquare = null;
        legalMoves = [];
        pendingMove = true;

        renderBoard();

        try {
            socket.send(JSON.stringify({
                type: 'move',
                move: moveString
            }));
        } catch (error) {
            console.error(error);
            pendingMove = false;
            showToast('Не удалось отправить ход');
        }
    }

    // ==========================================
    // MOVE HISTORY
    // ==========================================

    function resetMoveHistory() {
        moveHistory = [];

        if (chessMoves) {
            chessMoves.innerHTML =
                '<span class="chess-move-empty">Ходы появятся здесь</span>';
        }
    }

    function addMoveToHistory(move) {
        if (!move || !chessMoves) return;

        moveHistory.push(String(move));
        chessMoves.innerHTML = '';

        moveHistory.forEach((item, index) => {
            const line = document.createElement('div');

            line.textContent = `${index + 1}. ${item}`;

            chessMoves.appendChild(line);
        });

        chessMoves.scrollTop = chessMoves.scrollHeight;
    }

    // ==========================================
    // WEBSOCKET
    // ==========================================

    function connectToRoom(room) {
        hideGameResult();
        resultShown = false;

        if (socket) {
            socket.onclose = null;
            socket.close();
            socket = null;
        }

        currentRoom = room;
        playerColor = null;
        selectedSquare = null;
        legalMoves = [];
        gameFinished = false;
        isMyTurn = false;
        boardFlipped = false;
        currentFen = INITIAL_FEN;
        previousRenderedFen = null;
        pendingMove = false;

        if (chessRoomCode) {
            chessRoomCode.textContent = room;
        }

        resetMoveHistory();
        showChessGame();
        setChessStatus('Подключение...');
        renderBoard();

        const url =
            `wss://requiem-bot-7eyu.onrender.com/ws/chess/` +
            `${encodeURIComponent(room)}?initData=${encodeURIComponent(initData())}`;

        try {
            socket = new WebSocket(url);
        } catch (error) {
            console.error(error);
            setChessStatus('Ошибка подключения');
            showToast('Не удалось подключиться');
            return;
        }

        socket.addEventListener('open', () => {
            setChessStatus('Ожидание соперника');
        });

        socket.addEventListener('message', event => {
            let data;

            try {
                data = JSON.parse(event.data);
            } catch (error) {
                console.error('Ошибка сообщения:', error);
                return;
            }

            handleChessMessage(data);
        });

        socket.addEventListener('close', () => {
            if (!gameFinished && currentRoom) {
                setChessStatus('Соединение закрыто');
            }
        });

        socket.addEventListener('error', error => {
            console.error('WebSocket error:', error);
            setChessStatus('Ошибка соединения');
        });
    }

    function handleChessMessage(data) {
        if (!data || typeof data !== 'object') return;

        if (data.color) {
            playerColor = normalizeColor(data.color);
            boardFlipped = playerColor === 'black';

            myChessName.textContent = username;

            mySide.textContent =
                playerColor === 'white'
                    ? 'КРАСНЫЕ'
                    : 'ЧЁРНЫЕ';

            opponentSide.textContent =
                playerColor === 'white'
                    ? 'ЧЁРНЫЕ'
                    : 'КРАСНЫЕ';
        }

        if (data.fen) {
            currentFen = data.fen;
        }

        if (typeof data.turn === 'string') {
            const turn = data.turn.toLowerCase();

            isMyTurn =
                (playerColor === 'white' &&
                    ['w', 'white'].includes(turn)) ||
                (playerColor === 'black' &&
                    ['b', 'black'].includes(turn));

            pendingMove = false;
        }

        if (data.move) {
            addMoveToHistory(data.move);
        }

        if (data.opponent_name) {
            opponentName.textContent = data.opponent_name;
        }

        if (data.game_over) {
            gameFinished = true;
            isMyTurn = false;
            pendingMove = false;

            const redWon = data.result === '1-0';
            const blackWon = data.result === '0-1';

            if (redWon) {
                setChessStatus('Победа красных');
            } else if (blackWon) {
                setChessStatus('Победа чёрных');
            } else {
                setChessStatus('Ничья');
            }

            let resultType = 'draw';

            if (redWon || blackWon) {
                const iWon =
                    (redWon && playerColor === 'white') ||
                    (blackWon && playerColor === 'black');

                resultType = iWon ? 'victory' : 'defeat';
            }

            selectedSquare = null;
            legalMoves = [];

            renderBoard();

            showGameResult(resultType, data.result);

            return;
        }

        if (isMyTurn) {
            setChessStatus('Ваш ход');
        } else {
            setChessStatus('Ход соперника');
        }

        selectedSquare = null;
        legalMoves = [];

        renderBoard();
    }

    // ==========================================
    // CREATE ROOM
    // ==========================================

    async function createChessRoom() {
        const button = document.getElementById('createChess');

        button.disabled = true;
        button.textContent = 'СОЗДАНИЕ...';

        try {
            const response = await fetch(`${API_URL}/api/chess/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': initData()
                },
                body: JSON.stringify({
                    initData: initData()
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.detail ||
                    data.error ||
                    'Ошибка создания'
                );
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
            console.error(error);

            showToast(
                error.message || 'Ошибка создания комнаты'
            );
        } finally {
            button.disabled = false;
            button.textContent = 'СОЗДАТЬ КОМНАТУ';
        }
    }

    // ==========================================
    // JOIN ROOM
    // ==========================================

    function joinChessRoom() {
        const input = document.getElementById('chessCode');
        const room = input.value.trim().toUpperCase();

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
    // COPY ROOM
    // ==========================================

    async function copyChessRoomCode() {
        if (!currentRoom) {
            showToast('Комната не найдена');
            return;
        }

        try {
            await navigator.clipboard.writeText(currentRoom);
            showToast('Код скопирован');
        } catch {
            const input = document.createElement('textarea');

            input.value = currentRoom;
            document.body.appendChild(input);
            input.select();

            try {
                document.execCommand('copy');
                showToast('Код скопирован');
            } catch {
                showToast('Не удалось скопировать код');
            }

            input.remove();
        }
    }

    // ==========================================
    // LEAVE GAME
    // ==========================================

    function leaveChessGame() {
        hideGameResult();

        if (socket) {
            socket.onclose = null;
            socket.close();
            socket = null;
        }

        currentRoom = null;
        playerColor = null;
        selectedSquare = null;
        legalMoves = [];
        gameFinished = false;
        isMyTurn = false;
        boardFlipped = false;
        currentFen = INITIAL_FEN;
        previousRenderedFen = null;
        pendingMove = false;
        resultShown = false;

        resetMoveHistory();
        showChessLobby();
        setChessStatus('Ожидание подключения');

        renderBoard();

        showToast('Ты вышел из партии');
    }

    // ==========================================
    // RESULT BUTTONS
    // ==========================================

    document.getElementById('resultLobby')
        .addEventListener('click', () => {
            leaveChessGame();
        });

    document.getElementById('resultClose')
        .addEventListener('click', () => {
            hideGameResult();
        });

    // ==========================================
    // BUTTONS
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
        ?.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                joinChessRoom();
            }
        });

    // ==========================================
    // REGISTER PLAYER
    // ==========================================

    async function registerPlayer() {
        try {
            const response = await fetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': initData()
                },
                body: JSON.stringify({
                    initData: initData()
                })
            });

            if (!response.ok) {
                console.warn(
                    'Registration failed:',
                    response.status
                );
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
                throw new Error('Ошибка загрузки рейтинга');
            }

            const data = await response.json();

            const players =
                Array.isArray(data) ? data :
                Array.isArray(data.players) ? data.players :
                Array.isArray(data.leaderboard) ? data.leaderboard :
                [];

            const container =
                document.getElementById('leaderboard') ||
                document.getElementById('ratingList');

            if (!container) return;

            container.innerHTML = '';

            if (!players.length) {
                container.textContent =
                    'Пока нет игроков в рейтинге';
                return;
            }

            players.forEach((player, index) => {
                const item = document.createElement('div');

                item.className = 'leaderboard-item';

                const position = document.createElement('span');
                position.textContent = `#${index + 1}`;

                const name = document.createElement('span');

                name.textContent =
                    player.name ||
                    player.username ||
                    player.first_name ||
                    'Игрок';

                const rating = document.createElement('span');

                rating.textContent =
                    `${player.elo ?? player.rating ?? 1000} ELO`;

                item.append(position, name, rating);

                container.appendChild(item);
            });
        } catch (error) {
            console.error('Leaderboard error:', error);
        }
    }

    // ==========================================
    // START
    // ==========================================

    showChessLobby();
    showPage('home');

    registerPlayer();
    loadLeaderboard();

    console.log('REQUIEM initialized');
    console.log('REQUIEM Chess initialized');
});
