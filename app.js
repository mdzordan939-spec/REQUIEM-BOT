
document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // ==========================================
    // REQUIEM CONFIG
    // ==========================================

    const tg = window.Telegram?.WebApp;
    const API_URL = 'https://requiem-bot-7eyu.onrender.com';

    const user = tg?.initDataUnsafe?.user || {};

    const USER_ID = user.id ? String(user.id) : null;

    const USERNAME = [
        user.first_name,
        user.last_name
    ].filter(Boolean).join(' ') || 'Игрок';

    const INIT_DATA = tg?.initData || '';

    if (tg) {
        tg.ready();
        tg.expand();
        tg.setHeaderColor?.('#080808');
        tg.setBackgroundColor?.('#080808');
    }

    const $ = selector => document.querySelector(selector);
    const $$ = selector => [...document.querySelectorAll(selector)];

    const usernameElement = $('#username');

    if (usernameElement) {
        usernameElement.textContent = USERNAME;
    }

    // ==========================================
    // API
    // ==========================================

    async function apiRequest(path, options = {}) {
        const response = await fetch(`${API_URL}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });

        let data = {};

        try {
            data = await response.json();
        } catch {
            // Пустой или некорректный JSON.
        }

        if (!response.ok) {
            throw new Error(
                data.detail ||
                data.error ||
                `Ошибка сервера: ${response.status}`
            );
        }

        return data;
    }

    // ==========================================
    // TOAST
    // ==========================================

    const toast = $('#toast');
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
        }, 2600);
    }

    // ==========================================
    // RANK SYSTEM
    // ==========================================

    const RANKS = [
        { key: 'INITIATE', name: 'INITIATE', min: 0, max: 499, number: 1 },
        { key: 'RECRUIT', name: 'RECRUIT', min: 500, max: 799, number: 2 },
        { key: 'HUNTER', name: 'HUNTER', min: 800, max: 1099, number: 3 },
        { key: 'EXECUTIONER', name: 'EXECUTIONER', min: 1100, max: 1399, number: 4 },
        { key: 'REAPER', name: 'REAPER', min: 1400, max: 1699, number: 5 },
        { key: 'PHANTOM', name: 'PHANTOM', min: 1700, max: 1999, number: 6 },
        { key: 'REQUIEM', name: 'REQUIEM', min: 2000, max: Infinity, number: 7 }
    ];

    function getRankFallback(elo) {
        elo = Math.max(0, Number(elo) || 0);

        let rank = RANKS[0];

        for (const item of RANKS) {
            if (elo >= item.min) rank = item;
        }

        if (rank.key === 'REQUIEM') {
            return {
                rank: rank.key,
                rank_name: rank.name,
                rank_number: rank.number,
                division: 'ELITE',
                rank_label: 'REQUIEM ELITE',
                next_elo: null,
                elo_remaining: 0,
                progress: 100
            };
        }

        const width = rank.max - rank.min + 1;
        const divisionSize = width / 3;
        const position = elo - rank.min;

        let division;
        let divisionMin;
        let divisionMax;

        if (position < divisionSize) {
            division = 'III';
            divisionMin = rank.min;
            divisionMax = rank.min + Math.round(divisionSize) - 1;
        } else if (position < divisionSize * 2) {
            division = 'II';
            divisionMin = rank.min + Math.round(divisionSize);
            divisionMax = rank.min + Math.round(divisionSize * 2) - 1;
        } else {
            division = 'I';
            divisionMin = rank.min + Math.round(divisionSize * 2);
            divisionMax = rank.max;
        }

        return {
            rank: rank.key,
            rank_name: rank.name,
            rank_number: rank.number,
            division,
            rank_label: `${rank.name} ${division}`,
            next_elo: divisionMax + 1,
            elo_remaining: Math.max(0, divisionMax + 1 - elo),
            progress: Math.min(
                100,
                Math.round(
                    ((elo - divisionMin) /
                    Math.max(1, divisionMax - divisionMin + 1)) * 100
                )
            )
        };
    }

    function rankInfo(player) {
        const elo = Number(player?.elo ?? player?.rating ?? 1000);

        const fallback = getRankFallback(elo);

        return {
            ...fallback,
            ...(player || {}),
            elo
        };
    }

    function rankClass(rank) {
        const key = String(rank || 'INITIATE').toLowerCase();

        return `rank-${key}`;
    }

    function createRankEmblem(rank, division) {
        const info = typeof rank === 'object'
            ? rankInfo(rank)
            : {
                rank: rank || 'INITIATE',
                division: division || 'III'
            };

        const emblem = document.createElement('div');

        emblem.className = `rank-emblem ${rankClass(info.rank)}`;

        const symbol = document.createElement('span');
        symbol.className = 'rank-emblem-symbol';
        symbol.textContent = String(info.rank_number || 1).padStart(2, '0');

        const stars = document.createElement('span');
        stars.className = 'rank-emblem-stars';
        stars.textContent = info.rank === 'REQUIEM'
            ? '✦ ✦ ✦'
            : '◆ ◆ ◆';

        emblem.append(symbol, stars);

        return emblem;
    }

    function createRankBadge(player) {
        const info = rankInfo(player);

        const badge = document.createElement('div');
        badge.className = `rank-badge ${rankClass(info.rank)}`;

        const emblem = createRankEmblem(info);

        const text = document.createElement('div');
        text.className = 'rank-badge-text';

        const name = document.createElement('strong');
        name.textContent = info.rank_label || `${info.rank_name} ${info.division}`;

        const elo = document.createElement('span');
        elo.textContent = `${info.elo} ELO`;

        text.append(name, elo);
        badge.append(emblem, text);

        return badge;
    }

    // ==========================================
    // MAIN DESIGN
    // ==========================================

    const style = document.createElement('style');

    style.textContent = `
        :root {
            --rq-red:#e20b32;
            --rq-red-light:#ff3157;
            --rq-bg:#080808;
            --rq-card:#141112;
            --rq-border:#39202a;
            --rq-muted:#929096;
        }

        /* =====================================
           RANK COLORS
        ===================================== */

        .rank-emblem {
            position:relative;
            width:52px;
            height:58px;
            flex:0 0 52px;
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            gap:2px;
            clip-path:polygon(50% 0%,91% 17%,100% 63%,50% 100%,0% 63%,9% 17%);
            background:linear-gradient(145deg,#777,#242424);
            color:#fff;
            filter:drop-shadow(0 0 8px rgba(0,0,0,.5));
        }

        .rank-emblem:before {
            content:"";
            position:absolute;
            inset:4px;
            clip-path:polygon(50% 0%,91% 17%,100% 63%,50% 100%,0% 63%,9% 17%);
            border:1px solid rgba(255,255,255,.3);
            background:linear-gradient(145deg,rgba(255,255,255,.14),transparent);
        }

        .rank-emblem-symbol {
            position:relative;
            font-size:19px;
            font-weight:1000;
            line-height:1;
            text-shadow:0 2px 4px #000;
        }

        .rank-emblem-stars {
            position:relative;
            font-size:7px;
            letter-spacing:1px;
            opacity:.85;
        }

        .rank-initiate {
            background:linear-gradient(145deg,#9b9b9b,#3e4146 60%,#17191c);
        }

        .rank-recruit {
            background:linear-gradient(145deg,#c58a56,#80502e 60%,#392216);
        }

        .rank-hunter {
            background:linear-gradient(145deg,#e1e5eb,#858e9c 55%,#3e4651);
        }

        .rank-executioner {
            background:linear-gradient(145deg,#ffcf67,#bd761d 55%,#5b310a);
        }

        .rank-reaper {
            background:linear-gradient(145deg,#ff5368,#9c1733 55%,#420819);
        }

        .rank-phantom {
            background:linear-gradient(145deg,#d9b7ff,#7446a9 55%,#26123d);
        }

        .rank-requiem {
            background:linear-gradient(145deg,#ff526e,#e20b32 35%,#510015 75%,#130006);
            box-shadow:0 0 18px rgba(226,11,50,.55);
            animation:requiemGlow 2.5s ease-in-out infinite;
        }

        @keyframes requiemGlow {
            50% {
                filter:drop-shadow(0 0 13px rgba(255,20,65,.8));
            }
        }

        .rank-badge {
            display:flex;
            align-items:center;
            gap:10px;
            min-width:0;
        }

        .rank-badge-text {
            min-width:0;
            display:flex;
            flex-direction:column;
            gap:4px;
        }

        .rank-badge-text strong {
            color:#fff;
            font-size:12px;
            font-weight:950;
            letter-spacing:1px;
        }

        .rank-badge-text span {
            color:#aaa;
            font-size:10px;
        }

        /* =====================================
           PROFILE RANK CARD
        ===================================== */

        #requiemRankDashboard {
            position:relative;
            margin:14px 0;
            padding:16px;
            overflow:hidden;
            border:1px solid #48202c;
            border-radius:15px;
            background:
                radial-gradient(ellipse at 100% 0%,rgba(226,11,50,.17),transparent 55%),
                linear-gradient(145deg,#171113,#0b090a);
            color:#fff;
        }

        #requiemRankDashboard:after {
            content:"";
            position:absolute;
            top:-70px;
            right:-60px;
            width:170px;
            height:170px;
            border:1px solid rgba(226,11,50,.15);
            border-radius:50%;
            box-shadow:0 0 0 18px rgba(226,11,50,.025),0 0 0 38px rgba(226,11,50,.02);
            pointer-events:none;
        }

        .rq-rank-top {
            position:relative;
            z-index:1;
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
        }

        .rq-rank-label {
            color:#9b9295;
            font-size:9px;
            font-weight:900;
            letter-spacing:2px;
        }

        .rq-rank-title {
            margin-top:5px;
            color:#fff;
            font-size:19px;
            font-weight:1000;
            letter-spacing:1px;
        }

        .rq-rank-elo {
            margin-top:4px;
            color:#e7dce0;
            font-size:12px;
            font-weight:800;
        }

        .rq-progress-area {
            position:relative;
            z-index:1;
            margin-top:18px;
        }

        .rq-progress-track {
            height:8px;
            overflow:hidden;
            border:1px solid #43202a;
            border-radius:20px;
            background:#090708;
        }

        .rq-progress-fill {
            height:100%;
            border-radius:20px;
            background:linear-gradient(90deg,#9c0828,#ff3157);
            box-shadow:0 0 12px rgba(255,30,75,.5);
            transition:width .8s cubic-bezier(.2,.8,.2,1);
        }

        .rq-progress-meta {
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:8px;
            margin-top:8px;
            color:#a59ba0;
            font-size:10px;
        }

        .rq-rank-next {
            color:#f0d7de;
            font-weight:800;
            text-align:right;
        }

        .rq-rank-stats {
            position:relative;
            z-index:1;
            display:grid;
            grid-template-columns:repeat(3,1fr);
            gap:8px;
            margin-top:16px;
        }

        .rq-rank-stat {
            padding:10px 6px;
            border:1px solid #302027;
            border-radius:9px;
            background:rgba(0,0,0,.22);
            text-align:center;
        }

        .rq-rank-stat strong {
            display:block;
            color:#fff;
            font-size:17px;
            font-weight:950;
        }

        .rq-rank-stat span {
            display:block;
            margin-top:4px;
            color:#898187;
            font-size:9px;
            text-transform:uppercase;
        }

        /* =====================================
           RANK LEADERBOARD
        ===================================== */

        .rq-leaderboard-item {
            display:flex;
            align-items:center;
            gap:10px;
            min-width:0;
            margin-top:9px;
            padding:10px;
            border:1px solid #302027;
            border-radius:11px;
            background:#121010;
            color:#fff;
        }

        .rq-leader-position {
            width:25px;
            flex:0 0 25px;
            color:#e51a37;
            font-size:13px;
            font-weight:950;
            text-align:center;
        }

        .rq-leader-avatar {
            width:37px;
            height:37px;
            flex:0 0 37px;
            overflow:hidden;
            display:grid;
            place-items:center;
            border:1px solid #54202e;
            border-radius:50%;
            background:#211217;
            color:#ed1735;
            font-weight:900;
        }

        .rq-leader-avatar img {
            width:100%;
            height:100%;
            object-fit:cover;
        }

        .rq-leader-info {
            flex:1;
            min-width:0;
        }

        .rq-leader-name {
            overflow:hidden;
            color:#eee;
            font-size:12px;
            font-weight:850;
            text-overflow:ellipsis;
            white-space:nowrap;
        }

        .rq-leader-rank {
            margin-top:4px;
            color:#aaa;
            font-size:9px;
            letter-spacing:.5px;
        }

        .rq-leader-elo {
            color:#fff;
            font-size:12px;
            font-weight:950;
            white-space:nowrap;
        }

        /* =====================================
           CHESS PANEL
        ===================================== */

        #chessPanel {
            display:none;
            width:100%;
            margin:14px 0 24px;
            padding:14px;
            color:#fff;
            background:
                radial-gradient(ellipse at 50% 0%,rgba(180,0,35,.18),transparent 60%),
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
            min-width:0;
            padding:10px;
            margin-bottom:10px;
            background:#151012;
            border:1px solid #39151e;
            border-radius:11px;
        }

        .chess-player-avatar {
            width:42px;
            height:42px;
            flex:0 0 42px;
            overflow:hidden;
            display:grid;
            place-items:center;
            border:1px solid #8e1025;
            border-radius:50%;
            background:#211217;
            color:#ed1735;
            font-size:21px;
            font-weight:900;
        }

        .chess-player-avatar img {
            width:100%;
            height:100%;
            object-fit:cover;
        }

        .chess-player-info {
            flex:1;
            min-width:0;
        }

        .chess-player-name {
            overflow:hidden;
            color:#fff;
            font-size:12px;
            font-weight:850;
            text-overflow:ellipsis;
            white-space:nowrap;
        }

        .chess-player-rank {
            display:flex;
            align-items:center;
            gap:5px;
            margin-top:5px;
            color:#aaa;
            font-size:9px;
        }

        .chess-player-rank strong {
            color:#f2dce2;
        }

        .chess-player-side {
            color:#ed1735;
            font-size:9px;
            font-weight:900;
            white-space:nowrap;
        }

        .chess-player-emblem {
            width:31px;
            height:35px;
            flex:0 0 31px;
        }

        .chess-player-emblem .rank-emblem {
            width:31px;
            height:35px;
            flex-basis:31px;
        }

        .chess-player-emblem .rank-emblem-symbol {
            font-size:12px;
        }

        .chess-player-emblem .rank-emblem-stars {
            font-size:5px;
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

        .chess-square.chess-legal:after {
            content:"";
            position:absolute;
            width:25%;
            height:25%;
            border-radius:50%;
            background:#ff1744;
            box-shadow:0 0 5px #ff1744,0 0 12px rgba(255,23,68,.85);
            pointer-events:none;
            z-index:4;
            animation:legalAppear .18s ease-out both;
        }

        .chess-square.chess-capture:after {
            content:"";
            position:absolute;
            inset:5%;
            border:3px solid #ff1744;
            border-radius:50%;
            background:rgba(255,0,40,.12);
            box-shadow:0 0 7px rgba(255,0,50,.8),inset 0 0 8px rgba(255,0,50,.25);
            pointer-events:none;
            z-index:4;
            animation:legalAppear .18s ease-out both;
        }

        @keyframes legalAppear {
            from { opacity:0; transform:scale(.35); }
            to { opacity:1; transform:scale(1); }
        }

        .chess-piece-img {
            display:block;
            width:94%;
            height:94%;
            object-fit:contain;
            pointer-events:none;
            user-select:none;
            -webkit-user-drag:none;
            filter:drop-shadow(0 3px 3px rgba(0,0,0,.7));
            z-index:1;
            transform:translate(0,0);
            transition:transform .32s cubic-bezier(.22,.75,.25,1),filter .2s ease;
            will-change:transform;
        }

        .chess-square.chess-selected .chess-piece-img {
            filter:drop-shadow(0 0 7px rgba(255,20,60,.9)) drop-shadow(0 3px 3px rgba(0,0,0,.7));
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
            transition:background .2s,transform .2s,box-shadow .2s;
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

        /* =====================================
           RESULT OVERLAY
        ===================================== */

        #chessResult {
            position:fixed;
            inset:0;
            z-index:99999;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:20px;
            background:rgba(0,0,0,.95);
            opacity:0;
            visibility:hidden;
            pointer-events:none;
            transition:opacity .45s ease,visibility .45s ease;
            overflow:auto;
        }

        #chessResult.active {
            opacity:1;
            visibility:visible;
            pointer-events:auto;
        }

        .result-backdrop {
            position:fixed;
            inset:0;
            background:radial-gradient(circle at 50% 45%,rgba(220,0,40,.2),transparent 55%);
            animation:resultBackdrop 3s ease-in-out infinite;
        }

        @keyframes resultBackdrop {
            50% { opacity:.35; transform:scale(1.15); }
        }

        .result-content {
            position:relative;
            z-index:3;
            width:min(100%,420px);
            padding:35px 22px;
            text-align:center;
            transform:translateY(35px) scale(.88);
            opacity:0;
            transition:transform .65s cubic-bezier(.16,1,.3,1),opacity .5s ease;
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
            box-shadow:0 0 20px rgba(237,23,53,.4),inset 0 0 20px rgba(237,23,53,.12);
            animation:resultSymbol 2s ease-in-out infinite;
        }

        @keyframes resultSymbol {
            50% {
                transform:scale(1.08);
                box-shadow:0 0 45px rgba(237,23,53,.65),inset 0 0 25px rgba(237,23,53,.2);
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
            text-shadow:0 0 10px rgba(255,0,45,.6),0 0 35px rgba(255,0,45,.35);
        }

        .result-title.defeat {
            color:#aeb0b6;
            text-shadow:0 0 10px rgba(150,150,150,.25);
            animation:defeatGlitch 2.5s infinite;
        }

        @keyframes defeatGlitch {
            0%,90%,100% { transform:translateX(0); opacity:1; }
            92% { transform:translateX(-4px); opacity:.7; }
            94% { transform:translateX(4px); }
            96% { transform:translateX(-2px); }
        }

        .result-description {
            margin:18px 0 20px;
            color:#999;
            font-size:13px;
            line-height:1.6;
        }

        .result-rank-change {
            display:none;
            margin:15px 0;
            padding:13px;
            border:1px solid #5b2634;
            border-radius:11px;
            background:rgba(226,11,50,.08);
            text-align:left;
        }

        .result-rank-change.active {
            display:block;
            animation:rankChangeIn .6s cubic-bezier(.2,.8,.2,1) both;
        }

        @keyframes rankChangeIn {
            from { opacity:0; transform:translateY(15px) scale(.95); }
            to { opacity:1; transform:translateY(0) scale(1); }
        }

        .result-rank-caption {
            margin-bottom:9px;
            color:#e8aab7;
            font-size:9px;
            font-weight:900;
            letter-spacing:2px;
        }

        .result-rank-content {
            display:flex;
            align-items:center;
            gap:12px;
        }

        .result-rank-content strong {
            display:block;
            color:#fff;
            font-size:13px;
        }

        .result-rank-content span {
            display:block;
            margin-top:4px;
            color:#aaa;
            font-size:10px;
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
        }

        .result-button.secondary {
            background:transparent;
            border-color:#4a2630;
            color:#aaa;
        }

        .result-particles {
            position:fixed;
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
            0% { transform:translate3d(0,0,0) scale(.5); opacity:0; }
            15% { opacity:.9; }
            85% { opacity:.5; }
            100% { transform:translate3d(var(--drift),-110vh,0) scale(1.5); opacity:0; }
        }

        .result-flash {
            position:fixed;
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
            background:radial-gradient(circle at 50% 45%,rgba(100,0,15,.16),transparent 55%);
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
            #chessResult,
            #requiemRankDashboard * {
                animation-duration:.01ms !important;
                transition-duration:.01ms !important;
            }
        }
    `;

    document.head.appendChild(style);

    // ==========================================
    // PROFILE / RANK DASHBOARD
    // ==========================================

    let myProfile = null;
    let profileBeforeMatch = null;

    function createRankDashboard() {
        const ratingSection = $('#ratingSection');

        if (!ratingSection || $('#requiemRankDashboard')) return;

        const dashboard = document.createElement('div');
        dashboard.id = 'requiemRankDashboard';

        dashboard.innerHTML = `
            <div class="rq-rank-top">
                <div>
                    <div class="rq-rank-label">REQUIEM COMPETITIVE RANK</div>
                    <div class="rq-rank-title" id="rqRankTitle">ЗАГРУЗКА...</div>
                    <div class="rq-rank-elo" id="rqRankElo">— ELO</div>
                </div>
                <div id="rqRankEmblem"></div>
            </div>

            <div class="rq-progress-area">
                <div class="rq-progress-track">
                    <div class="rq-progress-fill" id="rqRankProgress" style="width:0%"></div>
                </div>
                <div class="rq-progress-meta">
                    <span id="rqRankProgressText">Загрузка рейтинга</span>
                    <span class="rq-rank-next" id="rqRankNext"></span>
                </div>
            </div>

            <div class="rq-rank-stats">
                <div class="rq-rank-stat">
                    <strong id="rqWins">0</strong>
                    <span>Победы</span>
                </div>
                <div class="rq-rank-stat">
                    <strong id="rqLosses">0</strong>
                    <span>Поражения</span>
                </div>
                <div class="rq-rank-stat">
                    <strong id="rqDraws">0</strong>
                    <span>Ничьи</span>
                </div>
            </div>
        `;

        ratingSection.prepend(dashboard);
    }

    function updateRankDashboard(player) {
        if (!player) return;

        createRankDashboard();

        const info = rankInfo(player);

        const title = $('#rqRankTitle');
        const elo = $('#rqRankElo');
        const emblemContainer = $('#rqRankEmblem');
        const progress = $('#rqRankProgress');
        const progressText = $('#rqRankProgressText');
        const next = $('#rqRankNext');

        if (title) title.textContent = info.rank_label;
        if (elo) elo.textContent = `${info.elo} ELO`;

        if (emblemContainer) {
            emblemContainer.innerHTML = '';
            emblemContainer.appendChild(createRankEmblem(info));
        }

        if (progress) {
            progress.style.width = `${info.progress ?? 0}%`;
        }

        if (info.rank === 'REQUIEM') {
            if (progressText) progressText.textContent = 'МАКСИМАЛЬНЫЙ РАНГ';
            if (next) next.textContent = 'ELITE';
        } else {
            if (progressText) {
                progressText.textContent = `${info.progress ?? 0}% до следующего дивизиона`;
            }

            if (next) {
                next.textContent = `Ещё ${info.elo_remaining ?? 0} ELO`;
            }
        }

        const wins = $('#rqWins');
        const losses = $('#rqLosses');
        const draws = $('#rqDraws');

        if (wins) wins.textContent = player.wins ?? 0;
        if (losses) losses.textContent = player.losses ?? 0;
        if (draws) draws.textContent = player.draws ?? 0;
    }

    async function loadMyProfile() {
        if (!USER_ID) return null;

        try {
            const data = await apiRequest(
                `/api/player/${encodeURIComponent(USER_ID)}`
            );

            myProfile = data.player || null;

            if (myProfile) {
                updateRankDashboard(myProfile);
            }

            return myProfile;
        } catch (error) {
            console.warn('Profile loading:', error.message);
            return null;
        }
    }

    // ==========================================
    // PLAYER REGISTRATION
    // ==========================================

    async function registerPlayer() {
        if (!INIT_DATA) {
            console.warn('Telegram initData is unavailable');
            return null;
        }

        try {
            await apiRequest('/api/register', {
                method: 'POST',
                body: JSON.stringify({
                    initData: INIT_DATA
                })
            });

            return await loadMyProfile();
        } catch (error) {
            console.error('Registration error:', error);
            showToast('Не удалось зарегистрировать игрока');
            return null;
        }
    }

    // ==========================================
    // PLAYER CARD HELPERS
    // ==========================================

    function safePhotoUrl(value) {
        if (!value) return '';

        try {
            const url = new URL(value);

            if (url.protocol !== 'https:' && url.protocol !== 'http:') {
                return '';
            }

            return url.href;
        } catch {
            return '';
        }
    }

    function createAvatar(photoUrl, fallback = 'R') {
        const avatar = document.createElement('div');
        avatar.className = 'chess-player-avatar';

        const url = safePhotoUrl(photoUrl);

        if (url) {
            const image = document.createElement('img');
            image.src = url;
            image.alt = 'Аватар';
            image.referrerPolicy = 'no-referrer';

            image.onerror = () => {
                avatar.textContent = fallback;
            };

            avatar.appendChild(image);
        } else {
            avatar.textContent = fallback;
        }

        return avatar;
    }

    function displayPlayerCard(element, player, fallbackName, side) {
        if (!element) return;

        element.innerHTML = '';

        const info = rankInfo(player || {});
        const nameValue = player
            ? [
                player.first_name,
                player.last_name
            ].filter(Boolean).join(' ') || (
                player.username ? `@${player.username}` : fallbackName
            )
            : fallbackName;

        const avatar = createAvatar(
            player?.photo_url,
            nameValue.charAt(0).toUpperCase() || 'R'
        );

        const details = document.createElement('div');
        details.className = 'chess-player-info';

        const name = document.createElement('div');
        name.className = 'chess-player-name';
        name.textContent = nameValue;

        const rank = document.createElement('div');
        rank.className = 'chess-player-rank';

        const rankName = document.createElement('strong');
        rankName.textContent = player
            ? info.rank_label
            : 'Ожидание соперника';

        const rankElo = document.createElement('span');
        rankElo.textContent = player
            ? `· ${info.elo} ELO`
            : '';

        rank.append(rankName, rankElo);
        details.append(name, rank);

        const emblemContainer = document.createElement('div');
        emblemContainer.className = 'chess-player-emblem';

        if (player) {
            emblemContainer.appendChild(createRankEmblem(info));
        }

        const sideElement = document.createElement('div');
        sideElement.className = 'chess-player-side';
        sideElement.textContent = side;

        element.append(
            avatar,
            details,
            emblemContainer,
            sideElement
        );
    }

    // ==========================================
    // NAVIGATION
    // ==========================================

    const gamesHub = $('#gamesHub');
    const chessScreen = $('#chessScreen');
    const ratingSection = $('#ratingSection');

    const homeElements = [
        ...$$('.hero'),
        ...$$('.profile'),
        ...$$('.stats'),
        ...$$('.menu'),
        ...Array.from($$('.section-heading')).slice(0, 2)
    ];

    function hideSections() {
        homeElements.forEach(element => {
            element.style.display = 'none';
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

        $$('.nav-item').forEach(button => {
            button.classList.toggle(
                'active',
                button.dataset.page === page
            );
        });

        if (page === 'home') {
            homeElements.forEach(element => {
                element.style.display = '';
            });
        }

        if (page === 'games' && gamesHub) {
            gamesHub.style.display = 'block';
        }

        if (page === 'rating' && ratingSection) {
            ratingSection.style.display = 'block';
            loadLeaderboard();
            loadMyProfile();
        }
    }

    $$('[data-page]').forEach(button => {
        button.addEventListener('click', () => {
            showPage(button.dataset.page);
        });
    });

    // ==========================================
    // CHESS SVG PIECES
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 104">
                <defs>
                    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stop-color="${light}"/>
                        <stop offset=".35" stop-color="${main}"/>
                        <stop offset="1" stop-color="${dark}"/>
                    </linearGradient>

                    <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%">
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

                <g filter="url(#shadow)" fill="url(#body)"
                   stroke="${outline}" stroke-width="2.2" stroke-linejoin="round">
                    ${shapes[type]}
                </g>
            </svg>
        `;

        return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
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

            <button class="chess-button chess-button-secondary" id="joinChess">
                ПРИСОЕДИНИТЬСЯ
            </button>
        </div>

        <div id="chessGame" style="display:none">
            <div class="chess-layout">
                <div class="chess-main">

                    <div class="chess-player" id="opponentCard"></div>

                    <div class="chess-board-frame">
                        <div id="chessBoard"></div>
                    </div>

                    <div class="chess-player" id="myPlayerCard" style="margin-top:10px"></div>

                    <div class="chess-status">
                        <span class="chess-status-label">Состояние партии</span>
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
                            <span class="chess-move-empty">Ходы появятся здесь</span>
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

    const chessMount = $('#chessMount');

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
            <div class="result-eyebrow" id="resultEyebrow">REQUIEM CHESS</div>
            <h1 class="result-title" id="resultTitle">VICTORY</h1>

            <div class="result-description" id="resultDescription">
                Партия завершена
            </div>

            <div class="result-rank-change" id="resultRankChange">
                <div class="result-rank-caption" id="resultRankCaption">
                    RANK UPDATE
                </div>
                <div class="result-rank-content" id="resultRankContent"></div>
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

    const resultTitle = $('#resultTitle');
    const resultSymbol = $('#resultSymbol');
    const resultEyebrow = $('#resultEyebrow');
    const resultDescription = $('#resultDescription');
    const resultParticles = $('#resultParticles');
    const resultRankChange = $('#resultRankChange');
    const resultRankCaption = $('#resultRankCaption');
    const resultRankContent = $('#resultRankContent');

    let resultShown = false;

    function createResultParticles() {
        resultParticles.innerHTML = '';

        for (let i = 0; i < 55; i++) {
            const particle = document.createElement('span');

            particle.className = 'result-particle';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.setProperty('--duration', `${3 + Math.random() * 5}s`);
            particle.style.setProperty('--delay', `${Math.random() * 4}s`);
            particle.style.setProperty('--drift', `${Math.random() * 180 - 90}px`);

            resultParticles.appendChild(particle);
        }
    }

    function compareRankChange(before, after) {
        if (!before || !after) return null;

        const oldRank = rankInfo(before);
        const newRank = rankInfo(after);

        const oldValue = oldRank.rank_number * 10 +
            ({ III: 1, II: 2, I: 3, ELITE: 4 }[oldRank.division] || 0);

        const newValue = newRank.rank_number * 10 +
            ({ III: 1, II: 2, I: 3, ELITE: 4 }[newRank.division] || 0);

        if (newValue > oldValue) {
            return {
                type: 'up',
                oldRank,
                newRank
            };
        }

        if (newValue < oldValue) {
            return {
                type: 'down',
                oldRank,
                newRank
            };
        }

        return null;
    }

    function displayRankChange(before, after) {
        resultRankChange.classList.remove('active');
        resultRankContent.innerHTML = '';

        if (!before || !after) return;

        const oldInfo = rankInfo(before);
        const newInfo = rankInfo(after);

        const change = compareRankChange(before, after);

        const eloDelta = newInfo.elo - oldInfo.elo;

        if (!change && eloDelta === 0) return;

        if (change?.type === 'up') {
            resultRankCaption.textContent = 'RANK UP';
        } else if (change?.type === 'down') {
            resultRankCaption.textContent = 'RANK DOWN';
        } else {
            resultRankCaption.textContent = 'ELO UPDATE';
        }

        const emblem = createRankEmblem(newInfo);

        const info = document.createElement('div');

        const name = document.createElement('strong');
        name.textContent = newInfo.rank_label;

        const delta = document.createElement('span');

        delta.textContent =
            `${eloDelta > 0 ? '+' : ''}${eloDelta} ELO · Теперь ${newInfo.elo} ELO`;

        info.append(name, delta);
        resultRankContent.append(emblem, info);

        resultRankChange.classList.add('active');
    }

    function showGameResult(type, result, oldProfile, newProfile) {
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
                'Партия завершена. Проанализируй игру и возвращайся сильнее.';

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

        displayRankChange(oldProfile, newProfile);
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

    $('#openChess')?.addEventListener('click', () => {
        if (gamesHub) gamesHub.style.display = 'none';
        if (chessScreen) chessScreen.style.display = 'block';

        chessPanel.style.display = 'block';
    });

    $('#backToGames')?.addEventListener('click', () => {
        if (chessScreen) chessScreen.style.display = 'none';
        if (gamesHub) gamesHub.style.display = 'block';
    });

    // ==========================================
    // CHESS ENGINE
    // ==========================================

    let chessEnginePromise = null;

    function loadChessEngine() {
        if (window.Chess) return Promise.resolve(true);
        if (chessEnginePromise) return chessEnginePromise;

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
    // CHESS STATE
    // ==========================================

    const boardElement = $('#chessBoard');
    const lobbyElement = $('#chessLobby');
    const gameElement = $('#chessGame');

    const chessStatus = $('#chessStatus');
    const chessRoomCode = $('#chessRoomCode');
    const chessMoves = $('#chessMoves');

    const INITIAL_FEN =
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

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
    let pendingMove = false;

    let moveHistory = [];
    let animationFrame = null;

    let opponentProfile = null;
    let lastMatchResult = null;

    function setChessStatus(message) {
        if (chessStatus) chessStatus.textContent = message;
    }

    function showChessGame() {
        if (lobbyElement) lobbyElement.style.display = 'none';
        if (gameElement) gameElement.style.display = 'block';
    }

    function showChessLobby() {
        if (lobbyElement) lobbyElement.style.display = 'block';
        if (gameElement) gameElement.style.display = 'none';
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
    // INFER MOVE FROM FEN
    // ==========================================

    async function inferMove(oldFen, newFen) {
        if (!oldFen || !newFen || oldFen === newFen) return null;

        try {
            await loadChessEngine();

            const game = new window.Chess(oldFen);
            const possible = game.moves({ verbose: true });

            for (const candidate of possible) {
                const test = new window.Chess(oldFen);

                test.move({
                    from: candidate.from,
                    to: candidate.to,
                    promotion: candidate.promotion
                });

                if (test.fen() === newFen) {
                    return candidate;
                }
            }
        } catch (error) {
            console.warn('Не удалось определить ход:', error);
        }

        return null;
    }

    // ==========================================
    // BOARD MOVEMENT ANIMATION
    // ==========================================

    function getPieceMovements(oldFen, newFen) {
        if (!oldFen || !newFen || oldFen === newFen) return [];

        const oldBoard = parseFen(oldFen);
        const newBoard = parseFen(newFen);

        const removed = [];
        const added = [];

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const before = oldBoard[row]?.[col] || '';
                const after = newBoard[row]?.[col] || '';

                if (before === after) continue;

                if (before) removed.push({ piece: before, row, col });
                if (after) added.push({ piece: after, row, col });
            }
        }

        const movements = [];

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
            console.error(error);
            showToast('Не удалось рассчитать ходы');
            return [];
        }
    }

    // ==========================================
    // BOARD RENDER
    // ==========================================

    function renderBoard() {
        if (!boardElement) return;

        const movements = getPieceMovements(
            previousRenderedFen,
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

            const availableMove = legalMoves.find(move => move.to === name);

            if (availableMove) {
                if (availableMove.captured || availableMove.flags.includes('e')) {
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

                const movement = movements.find(item => item.to === name);

                if (movement) {
                    const from = getVisualPosition(movement.from);
                    const to = getVisualPosition(movement.to);

                    const cellWidth = boardElement.clientWidth / 8;
                    const cellHeight = boardElement.clientHeight / 8;

                    const dx = (from.col - to.col) * cellWidth;
                    const dy = (from.row - to.row) * cellHeight;

                    image.style.transition = 'none';
                    image.style.transform = `translate(${dx}px, ${dy}px)`;

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

        if (gameFinished || pendingMove) return;

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

        const availableMove = legalMoves.find(move => move.to === square);

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
    // UPDATE PLAYER PROFILES IN CHESS
    // ==========================================

    function updateChessProfiles(profiles) {
        if (!profiles || !playerColor) return;

        const opponentColor = playerColor === 'white'
            ? 'black'
            : 'white';

        const own = profiles[playerColor] || null;
        const opponent = profiles[opponentColor] || null;

        if (own) {
            myProfile = own;
            updateRankDashboard(own);
        }

        if (opponent) {
            opponentProfile = opponent;
        }

        displayPlayerCard(
            $('#myPlayerCard'),
            own || myProfile,
            USERNAME,
            playerColor === 'white' ? 'КРАСНЫЕ' : 'ЧЁРНЫЕ'
        );

        displayPlayerCard(
            $('#opponentCard'),
            opponent,
            'Ожидание соперника',
            playerColor === 'white' ? 'ЧЁРНЫЕ' : 'КРАСНЫЕ'
        );
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

        profileBeforeMatch = myProfile
            ? { ...myProfile }
            : null;

        currentRoom = room;
        playerColor = null;
        opponentProfile = null;

        selectedSquare = null;
        legalMoves = [];

        gameFinished = false;
        isMyTurn = false;
        boardFlipped = false;
        pendingMove = false;

        currentFen = INITIAL_FEN;
        previousRenderedFen = null;

        if (chessRoomCode) {
            chessRoomCode.textContent = room;
        }

        resetMoveHistory();
        showChessGame();
        setChessStatus('Подключение...');

        displayPlayerCard(
            $('#myPlayerCard'),
            myProfile,
            USERNAME,
            'ОЖИДАНИЕ'
        );

        displayPlayerCard(
            $('#opponentCard'),
            null,
            'Ожидание соперника',
            'СОПЕРНИК'
        );

        renderBoard();

        const url =
            `wss://requiem-bot-7eyu.onrender.com/ws/chess/` +
            `${encodeURIComponent(room)}?initData=${encodeURIComponent(INIT_DATA)}`;

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

    async function handleChessMessage(data) {
        if (!data || typeof data !== 'object') return;

        const oldFen = currentFen;

        if (data.color) {
            playerColor = normalizeColor(data.color);
            boardFlipped = playerColor === 'black';
        }

        if (data.fen) {
            currentFen = data.fen;
        }

        if (data.profiles) {
            updateChessProfiles(data.profiles);
        }

        if (typeof data.turn === 'string') {
            const turn = data.turn.toLowerCase();

            isMyTurn =
                (playerColor === 'white' && ['w', 'white'].includes(turn)) ||
                (playerColor === 'black' && ['b', 'black'].includes(turn));

            pendingMove = false;
        }

        if (data.move) {
            addMoveToHistory(data.move);
        } else if (oldFen && data.fen && oldFen !== data.fen) {
            const inferred = await inferMove(oldFen, data.fen);

            if (inferred?.san) {
                addMoveToHistory(inferred.san);
            }
        }

        if (data.opponent_name && !opponentProfile) {
            const card = $('#opponentCard');
            const nameElement = card?.querySelector('.chess-player-name');

            if (nameElement) {
                nameElement.textContent = data.opponent_name;
            }
        }

        if (data.game_over) {
            if (gameFinished) return;

            gameFinished = true;
            isMyTurn = false;
            pendingMove = false;

            lastMatchResult = data.result;

            const whiteWon = data.result === '1-0';
            const blackWon = data.result === '0-1';

            if (whiteWon) {
                setChessStatus('Победа красных');
            } else if (blackWon) {
                setChessStatus('Победа чёрных');
            } else {
                setChessStatus('Ничья');
            }

            const iWon =
                (whiteWon && playerColor === 'white') ||
                (blackWon && playerColor === 'black');

            const resultType = data.result === '1/2-1/2'
                ? 'draw'
                : (iWon ? 'victory' : 'defeat');

            selectedSquare = null;
            legalMoves = [];

            renderBoard();

            // Сервер уже обновил ELO до отправки финального состояния.
            const profiles = data.profiles || {};

            const updatedProfile = profiles[playerColor] || null;

            if (updatedProfile) {
                myProfile = updatedProfile;
                updateRankDashboard(updatedProfile);
            } else {
                await loadMyProfile();
            }

            const opponentColor = playerColor === 'white'
                ? 'black'
                : 'white';

            opponentProfile = profiles[opponentColor] || opponentProfile;

            showGameResult(
                resultType,
                data.result,
                profileBeforeMatch,
                myProfile
            );

            loadLeaderboard();

            return;
        }

        if (isMyTurn) {
            setChessStatus('Ваш ход');
        } else if (playerColor) {
            setChessStatus('Ход соперника');
        } else {
            setChessStatus('Подключение...');
        }

        selectedSquare = null;
        legalMoves = [];

        renderBoard();
    }

    // ==========================================
    // CREATE ROOM
    // ==========================================

    async function createChessRoom() {
        const button = $('#createChess');

        if (!button) return;

        if (!INIT_DATA) {
            showToast('Открой REQUIEM через Telegram');
            return;
        }

        button.disabled = true;
        button.textContent = 'СОЗДАНИЕ...';

        try {
            if (!myProfile) {
                await registerPlayer();
            }

            const data = await apiRequest('/api/chess/create', {
                method: 'POST',
                body: JSON.stringify({
                    initData: INIT_DATA
                })
            });

            const room =
                data.room ||
                data.code ||
                data.room_code ||
                data.room_id;

            if (!room) {
                throw new Error('Сервер не вернул код комнаты');
            }

            if (data.player) {
                myProfile = data.player;
                updateRankDashboard(myProfile);
            }

            connectToRoom(String(room).toUpperCase());

            showToast('Комната создана');

        } catch (error) {
            console.error(error);
            showToast(error.message || 'Ошибка создания комнаты');
        } finally {
            button.disabled = false;
            button.textContent = 'СОЗДАТЬ КОМНАТУ';
        }
    }

    // ==========================================
    // JOIN ROOM
    // ==========================================

    function joinChessRoom() {
        const input = $('#chessCode');
        const room = input?.value.trim().toUpperCase() || '';

        if (!room) {
            showToast('Введи код комнаты');
            return;
        }

        if (!/^[A-F0-9]{6}$/.test(room)) {
            showToast('Код должен состоять из 6 символов');
            return;
        }

        if (!INIT_DATA) {
            showToast('Открой REQUIEM через Telegram');
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
        opponentProfile = null;

        selectedSquare = null;
        legalMoves = [];

        gameFinished = false;
        isMyTurn = false;
        boardFlipped = false;
        pendingMove = false;

        currentFen = INITIAL_FEN;
        previousRenderedFen = null;

        resultShown = false;
        profileBeforeMatch = null;

        resetMoveHistory();
        showChessLobby();
        setChessStatus('Ожидание подключения');

        renderBoard();

        loadMyProfile();
        loadLeaderboard();

        showToast('Ты вышел из партии');
    }

    // ==========================================
    // RESULT BUTTONS
    // ==========================================

    $('#resultLobby')?.addEventListener('click', () => {
        leaveChessGame();
    });

    $('#resultClose')?.addEventListener('click', () => {
        hideGameResult();
    });

    // ==========================================
    // BUTTON EVENTS
    // ==========================================

    $('#createChess')?.addEventListener('click', createChessRoom);
    $('#joinChess')?.addEventListener('click', joinChessRoom);
    $('#copyChessCode')?.addEventListener('click', copyChessRoomCode);
    $('#leaveChess')?.addEventListener('click', leaveChessGame);

    $('#chessCode')?.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            joinChessRoom();
        }
    });

    // ==========================================
    // LEADERBOARD
    // ==========================================

    async function loadLeaderboard() {
        try {
            const data = await apiRequest('/api/leaderboard');

            const players =
                Array.isArray(data.leaderboard) ? data.leaderboard :
                Array.isArray(data.players) ? data.players :
                [];

            const container =
                $('#leaderboard') ||
                $('#ratingList');

            if (!container) return;

            container.innerHTML = '';

            if (!players.length) {
                container.textContent = 'Пока нет игроков в рейтинге';
                return;
            }

            players.forEach((player, index) => {
                const item = document.createElement('div');
                item.className = 'rq-leaderboard-item';

                const position = document.createElement('div');
                position.className = 'rq-leader-position';
                position.textContent = `#${index + 1}`;

                const avatar = document.createElement('div');
                avatar.className = 'rq-leader-avatar';

                const photo = safePhotoUrl(player.photo_url);

                if (photo) {
                    const image = document.createElement('img');
                    image.src = photo;
                    image.alt = '';
                    image.referrerPolicy = 'no-referrer';

                    image.onerror = () => {
                        avatar.textContent =
                            (player.first_name || 'R').charAt(0).toUpperCase();
                    };

                    avatar.appendChild(image);
                } else {
                    avatar.textContent =
                        (player.first_name || 'R').charAt(0).toUpperCase();
                }

                const info = document.createElement('div');
                info.className = 'rq-leader-info';

                const name = document.createElement('div');
                name.className = 'rq-leader-name';

                name.textContent =
                    [
                        player.first_name,
                        player.last_name
                    ].filter(Boolean).join(' ') ||
                    (player.username ? `@${player.username}` : 'Игрок');

                const rank = rankInfo(player);

                const rankLabel = document.createElement('div');
                rankLabel.className = 'rq-leader-rank';
                rankLabel.textContent = rank.rank_label;

                info.append(name, rankLabel);

                const elo = document.createElement('div');
                elo.className = 'rq-leader-elo';
                elo.textContent = `${rank.elo} ELO`;

                item.append(position, avatar, info, elo);
                container.appendChild(item);
            });

        } catch (error) {
            console.error('Leaderboard error:', error);
        }
    }

    // ==========================================
    // START
    // ==========================================

    createRankDashboard();

    showChessLobby();
    showPage('home');

    registerPlayer().then(() => {
        loadLeaderboard();
    });

    console.log('REQUIEM initialized');
    console.log('REQUIEM Rank System initialized');
    console.log('REQUIEM Chess initialized');
});
