document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // REQUIEM — stable frontend
  const API = 'https://requiem-bot-7eyu.onrender.com';
  const tg = window.Telegram?.WebApp || null;
  const user = tg?.initDataUnsafe?.user || null;
  const uid = user?.id ? String(user.id) : null;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const MODES = {
    bullet: { name: 'ПУЛЯ', label: '2 минуты', seconds: 120 },
    blitz: { name: 'БЛИЦ', label: '5 минут', seconds: 300 },
    rapid: { name: 'РАПИД', label: '10 минут', seconds: 600 }
  };

  let mode = 'blitz';
  let chess = null;
  let chessReady = false;
  let socket = null;
  let roomId = null;
  let playerColor = null;
  let selectedSquare = null;
  let legalMoves = [];
  let lastMove = [];
  let profiles = {};
  let clocks = { white: 300, black: 300 };
  let clockInterval = null;
  let clockTick = Date.now();
  let myProfile = null;
  let resultShown = false;
  let leaderboardMode = 'blitz';
  let chessUIReady = false;

  const game = {
    connected: false,
    started: false,
    over: false,
    locked: true
  };

  // Telegram Mini App
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      tg.setHeaderColor?.('#080808');
      tg.setBackgroundColor?.('#080808');
    } catch (err) {
      console.warn('Telegram UI setup:', err);
    }
  }

  function escapeHTML(value = '') {
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function displayName(p) {
    if (!p) return 'Игрок';
    return `${p.first_name || ''} ${p.last_name || ''}`.trim()
      || p.username
      || `Игрок ${p.id || ''}`;
  }

  function username(p) {
    return p?.username
      ? '@' + String(p.username).replace(/^@/, '')
      : 'Telegram';
  }

  function initials(p) {
    return displayName(p).trim().charAt(0).toUpperCase() || 'R';
  }

  function elo(p) {
    return Number(p?.elo ?? p?.rating ?? 1000);
  }

  function rankName(p) {
    return p?.rank_label || p?.rank_name || p?.rank || 'HUNTER';
  }

  function photo(p) {
    return p?.photo_url || p?.avatar_url || '';
  }

  function formatTime(value) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  }

  function avatarHTML(p, extraClass = '') {
    const src = photo(p);
    return `
      <div class="rq-avatar ${extraClass}">
        <span>${escapeHTML(initials(p))}</span>
        ${src ? `<img src="${escapeHTML(src)}" alt="" onerror="this.remove()">` : ''}
      </div>
    `;
  }

  function toast(message) {
    let node = $('#toast');

    if (!node) {
      node = document.createElement('div');
      node.id = 'toast';
      node.className = 'toast';
      document.body.appendChild(node);
    }

    node.textContent = String(message || '');
    node.classList.add('show');

    clearTimeout(node._hideTimer);
    node._hideTimer = setTimeout(() => node.classList.remove('show'), 2600);
  }

  async function apiRequest(path, options = {}) {
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

  function normalizeColor(value) {
    if (value === 'white' || value === 'w') return 'white';
    if (value === 'black' || value === 'b') return 'black';
    return null;
  }

  function normalizeTurn(value) {
    if (value === 'white') return 'w';
    if (value === 'black') return 'b';
    return value;
  }

  function modeLabel() {
    return MODES[mode]?.name || 'БЛИЦ';
  }

  // Styles
  const css = document.createElement('style');

  css.textContent = `
    .rq-home-play {
      display:flex;
      align-items:center;
      justify-content:center;
      width:100%;
      margin:16px 0 4px;
      padding:15px;
      border:1px solid #d62a43;
      border-radius:12px;
      background:linear-gradient(120deg,#951326,#e0203e);
      color:#fff;
      font-size:14px;
      font-weight:900;
      letter-spacing:1px;
      cursor:pointer;
      position:relative;
      z-index:5;
      pointer-events:auto;
    }

    #chessMount { color:#eee; }

    .rq-avatar {
      width:44px;
      height:44px;
      flex-shrink:0;
      border-radius:50%;
      overflow:hidden;
      position:relative;
      display:flex;
      align-items:center;
      justify-content:center;
      background:linear-gradient(145deg,#3b111b,#100c0d);
      border:2px solid #9d1828;
      color:#fff;
      font-weight:900;
      font-size:17px;
    }

    .rq-avatar img {
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      object-fit:cover;
      z-index:2;
    }

    .rq-avatar.large { width:44px;height:44px;font-size:18px; }
    .rq-avatar.small { width:34px;height:34px;font-size:13px; }

    .rq-player-card {
      display:flex;
      align-items:center;
      gap:8px;
      padding:8px;
      background:#111;
      border:1px solid #292020;
      border-radius:11px;
      min-width:0;
      overflow:hidden;
    }

    .rq-player-card.turn-active {
      border-color:#c52640;
      box-shadow:0 0 12px #a3153020;
    }

    .rq-player-info { flex:1;min-width:0; }

    .rq-player-name {
      font-size:12px;
      font-weight:900;
      color:#fff;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }

    .rq-player-username {
      font-size:10px;
      color:#888;
      margin-top:3px;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }

    .rq-player-rank {
      color:#e43b4d;
      font-size:10px;
      font-weight:800;
      margin-top:4px;
    }

    .rq-player-stats {
      display:flex;
      gap:6px;
      flex-wrap:wrap;
      color:#888;
      font-size:9px;
      margin-top:4px;
    }

    .rq-clock {
      background:#080808;
      border:1px solid #332126;
      border-radius:8px;
      padding:7px 5px;
      min-width:55px;
      text-align:center;
      color:#fff;
      font-size:16px;
      font-weight:900;
      font-variant-numeric:tabular-nums;
    }

    .rq-clock.active {
      border-color:#d52b45;
      background:#320d16;
      color:#ff5269;
    }

    .rq-clock.danger { color:#ff334e; }

    .rq-chess-players {
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:7px;
      margin:12px 0;
    }

    .rq-mode-selector {
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:7px;
      margin:12px 0;
    }

    .rq-mode-btn {
      border:1px solid #2b2022;
      border-radius:10px;
      background:#111;
      color:#888;
      padding:10px 3px;
      font-size:10px;
      font-weight:900;
      cursor:pointer;
    }

    .rq-mode-btn span {
      display:block;
      color:#fff;
      font-size:13px;
      margin-top:4px;
    }

    .rq-mode-btn.selected {
      color:#ff4058;
      border-color:#e12642;
      background:linear-gradient(145deg,#3b0d16,#160a0d);
    }

    .rq-chess-board {
      width:100%;
      aspect-ratio:1;
      display:grid;
      grid-template-columns:repeat(8,1fr);
      overflow:hidden;
      border-radius:5px;
      border:2px solid #46111c;
      background:#100d0e;
      touch-action:manipulation;
      box-shadow:0 10px 30px #0008;
    }

    .rq-square {
      position:relative;
      display:flex;
      align-items:center;
      justify-content:center;
      min-width:0;
      aspect-ratio:1;
      overflow:hidden;
      cursor:pointer;
      touch-action:manipulation;
    }

    .rq-square.light { background:#741329; }
    .rq-square.dark { background:#100d0e; }

    .rq-square.selected {
      background:#ad1834!important;
      box-shadow:inset 0 0 0 3px #ff3856;
    }

    .rq-square.last-move {
      box-shadow:inset 0 0 0 3px #e6d16c75;
    }

    .rq-square.legal::after {
      content:'';
      position:absolute;
      width:24%;
      height:24%;
      background:#ddd9d2a0;
      border-radius:50%;
      z-index:1;
      pointer-events:none;
    }

    .rq-square.capture::after {
      content:'';
      position:absolute;
      inset:5%;
      border:3px solid #ddd9d280;
      border-radius:50%;
      z-index:1;
      pointer-events:none;
    }

    .rq-piece {
      width:97%;
      height:97%;
      object-fit:contain;
      position:relative;
      z-index:2;
      pointer-events:none;
    }

    .rq-chess-status {
      text-align:center;
      color:#ddd;
      font-size:12px;
      padding:11px;
      background:#111;
      border:1px solid #281a1d;
      border-radius:9px;
      margin:10px 0;
    }

    .rq-chess-actions {
      display:flex;
      gap:8px;
      margin-top:10px;
    }

    .rq-chess-actions button {
      flex:1;
      border:1px solid #392027;
      border-radius:10px;
      background:#171010;
      color:white;
      padding:12px 6px;
      font-size:12px;
      font-weight:900;
      cursor:pointer;
      touch-action:manipulation;
    }

    .rq-chess-actions button.primary {
      background:#a7192b;
      border-color:#d32b40;
    }

    .rq-rank-progress {
      margin-top:12px;
      padding:13px;
      background:#111;
      border:1px solid #292020;
      border-radius:12px;
    }

    .rq-progress-track {
      height:7px;
      background:#292020;
      border-radius:10px;
      overflow:hidden;
      margin-top:9px;
    }

    .rq-progress-fill {
      height:100%;
      background:linear-gradient(90deg,#8b1526,#ff4257);
    }

    .rq-leader-row {
      display:flex;
      align-items:center;
      gap:10px;
      padding:11px;
      border-bottom:1px solid #252020;
    }

    .rq-leader-row.me { background:#281014; }

    .rq-result {
      text-align:center;
      padding:22px 10px;
      background:#170c0e;
      border:1px solid #70202b;
      border-radius:15px;
      margin-top:12px;
    }

    .rq-result h2 {
      color:#ff4057;
      margin:0 0 8px;
      font-size:24px;
    }

    .rq-result button {
      margin-top:14px;
      background:#a7192b;
      color:white;
      border:0;
      border-radius:9px;
      padding:12px 20px;
      font-weight:900;
      cursor:pointer;
    }

    .rq-room-code-row {
      display:flex;
      gap:7px;
      margin-top:12px;
    }

    .rq-room-code-row input {
      flex:1;
      min-width:0;
      background:#111;
      border:1px solid #392027;
      color:#fff;
      padding:11px;
      border-radius:9px;
    }

    @media(max-width:350px) {
      .rq-chess-players { grid-template-columns:1fr; }
    }
  `;

  document.head.appendChild(css);

  // Home CTA
  function ensureHomePlayButton() {
    const hero = $('.hero');
    if (!hero || $('#rqHomePlay')) return;

    const button = document.createElement('button');
    button.id = 'rqHomePlay';
    button.className = 'rq-home-play';
    button.type = 'button';
    button.textContent = 'ИГРАТЬ  ↗';
    button.setAttribute('aria-label', 'Перейти в игры');

    hero.appendChild(button);
  }

  // Navigation
  function hideMainSections() {
    $$('.hero,.profile,.stats,.menu,.section-heading').forEach(el => {
      el.style.display = 'none';
    });

    ['gamesHub', 'chessScreen', 'ratingSection'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  function setNavActive(page) {
    $$('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
  }

  function showHome() {
    hideMainSections();
    $$('.hero,.profile,.stats,.menu,.section-heading').forEach(el => {
      el.style.display = '';
    });

    setNavActive('home');
    ensureHomePlayButton();
  }

  function showGames() {
    hideMainSections();
    const screen = $('#gamesHub');
    if (screen) screen.style.display = 'block';
    setNavActive('games');
  }

  function showChess() {
    hideMainSections();
    const screen = $('#chessScreen');
    if (screen) screen.style.display = 'block';
    setNavActive('games');
    initChessUI();
  }

  function showRating() {
    hideMainSections();
    const screen = $('#ratingSection');
    if (screen) screen.style.display = 'block';
    setNavActive('rating');
    loadProfile();
    loadLeaderboard();
  }

  // Register/profile
  async function register() {
    if (!tg?.initData) return null;
    return apiRequest('/api/register', {
      method: 'POST',
      body: JSON.stringify({ initData: tg.initData })
    });
  }

  function modeProfile(p, selectedMode = mode) {
    const mr = p?.mode_ratings?.[selectedMode];
    return mr ? { ...p, ...mr } : p;
  }

  async function loadProfile() {
    if (!uid) return;
    try {
      const data = await apiRequest(`/api/player/${encodeURIComponent(uid)}`);
      myProfile = data.player || data;
      renderProfile();
    } catch (error) {
      console.warn('Profile load:', error);
    }
  }

  function renderProfile() {
    const p = myProfile;
    if (!p) return;

    const nameNode = $('#username');
    if (nameNode) nameNode.textContent = displayName(p);

    const ratingNode = $('#elo');
    if (ratingNode) ratingNode.textContent = elo(modeProfile(p));

    const rankNode = $('#rank');
    if (rankNode) rankNode.textContent = rankName(modeProfile(p));

    const winsNode = $('#wins');
    if (winsNode) winsNode.textContent = p.wins ?? 0;

    const lossesNode = $('#losses');
    if (lossesNode) lossesNode.textContent = p.losses ?? 0;
  }

  async function loadLeaderboard() {
    const container = $('#leaderboard');
    if (!container) return;

    try {
      const data = await apiRequest(`/api/leaderboard?mode=${encodeURIComponent(leaderboardMode)}`);
      const list = data.leaderboard || data.players || [];

      container.innerHTML = list.map((p, index) => `
        <div class="rq-leader-row ${String(p.id) === uid ? 'me' : ''}">
          <strong>${index + 1}</strong>
          ${avatarHTML(p, 'small')}
          <div style="flex:1;min-width:0">
            <div style="font-weight:900;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${escapeHTML(displayName(p))}
            </div>
            <div style="color:#888;font-size:10px">${escapeHTML(rankName(modeProfile(p, leaderboardMode)))}</div>
          </div>
          <strong style="color:#f44">${elo(modeProfile(p, leaderboardMode))}</strong>
        </div>
      `).join('');
    } catch (error) {
      console.warn('Leaderboard:', error);
      container.innerHTML = '<div style="color:#888;padding:12px">Не удалось загрузить рейтинг</div>';
    }
  }

  // Chess UI
  function initChessUI() {
    const mount = $('#chessMount');
    if (!mount || chessUIReady) return;

    chessUIReady = true;

    mount.innerHTML = `
      <div class="rq-mode-selector">
        <button class="rq-mode-btn selected" data-mode="bullet">ПУЛЯ<span>2 мин</span></button>
        <button class="rq-mode-btn" data-mode="blitz">БЛИЦ<span>5 мин</span></button>
        <button class="rq-mode-btn" data-mode="rapid">РАПИД<span>10 мин</span></button>
      </div>

      <div class="rq-chess-players">
        <div id="rqWhitePlayer"></div>
        <div id="rqBlackPlayer"></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:10px 0">
        <div id="rqWhiteClock" class="rq-clock">05:00</div>
        <div id="rqBlackClock" class="rq-clock">05:00</div>
      </div>

      <div id="rqChessStatus" class="rq-chess-status">Выбери режим и создай комнату</div>

      <div id="rqChessBoard" class="rq-chess-board"></div>

      <div class="rq-chess-actions">
        <button id="rqCreateRoom" class="primary" type="button">Создать комнату</button>
        <button id="rqJoinRoom" type="button">Войти в комнату</button>
      </div>

      <div class="rq-room-code-row">
        <input id="rqRoomCode" type="text" placeholder="Код комнаты" autocomplete="off">
        <button id="rqCopyCode" type="button">Копировать</button>
      </div>

      <div id="rqRoomControls" style="display:none">
        <div class="rq-chess-actions">
          <button id="rqLeaveRoom" type="button">Покинуть комнату</button>
        </div>
      </div>

      <div id="rqResult"></div>
    `;

    loadChessLibrary();
    renderBoard();
    renderClocks();
  }

  // Load chess.js
  function loadChessLibrary() {
    if (window.Chess) {
      setupChess();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js';
    script.onload = setupChess;
    script.onerror = () => {
      status('Не удалось загрузить шахматную библиотеку');
      toast('Ошибка загрузки chess.js');
    };
    document.head.appendChild(script);
  }

  function setupChess() {
    try {
      chess = new window.Chess();
      chessReady = true;
      renderBoard();
    } catch (error) {
      console.error('Chess init error:', error);
      status('Ошибка инициализации шахмат');
    }
  }

  // SVG chess pieces
  function pieceSVG(type, side) {
    const white = side === 'white';
    const fill = white ? '#ff5067' : '#151515';
    const stroke = white ? '#ffd0d8' : '#c7c7c7';
    const glow = white ? 'filter="drop-shadow(0 0 3px #f32649)"' : '';

    const paths = {
      p: `<path d="M50 20a13 13 0 1 0 0 26a13 13 0 1 0 0-26ZM34 48h32l-5 10H39zM29 61h42l5 8H24z"/>`,
      r: `<path d="M25 20h15v12h20V20h15v23H25zM34 46h32l-7 12H39zM24 61h52l5 8H19z"/>`,
      n: `<path d="M25 67h52l-5 9H28zM31 63c0-20 8-29 24-37l10 9 10 5-7 17-11 5zM52 31l-9 5 5 6 8-5z"/>`,
      b: `<path d="M50 15c13 10 14 19 6 28L42 34c-6-8-4-14 8-19zM38 43h24l-4 12H42zM29 58h42l6 9H23z"/>`,
      q: `<path d="M23 23a6 6 0 1 0 0-12a6 6 0 1 0 0 12M40 19a6 6 0 1 0 0-12a6 6 0 1 0 0 12M60 19a6 6 0 1 a 0-12a6 6 0 1 0 0 12M77 23a6 6 0 1 a 0-12a6 6 0 1 а 0 12M22 30l15 12 13-15 13 15 15-12-10 30H32zM27 62h46l7 8H20z"/>`,
      k: `<path d="M44 9h12v17h14v12H56v15H44V38H30V26h14zM35 55h30l-5 10H40zM25 67h50l5 8H20z"/>`
    };

    return `
      <svg class="rq-piece" viewBox="0 0 100 85" ${glow}
        xmlns="http://www.w3.org/2000/svg">
        <g fill="${fill}" stroke="${stroke}" stroke-width="3"
          stroke-linejoin="round" stroke-linecap="round">
          ${paths[type] || paths.p}
        </g>
      </svg>
    `;
  }

  // Player cards
  function playerCard(profile, color) {
    const node = color === 'white' ? $('#rqWhitePlayer') : $('#rqBlackPlayer');
    if (!node) return;

    const active = chess && chess.turn() === (color === 'white' ? 'w' : 'b')
      && game.started && !game.over;

    const p = profile || (color === playerColor
      ? myProfile
      : null);

    if (!p) {
      node.innerHTML = `
        <div class="rq-player-card">
          <div class="rq-avatar"><span>${color === 'white' ? 'W' : 'B'}</span></div>
          <div class="rq-player-info">
            <div class="rq-player-name">${color === 'white' ? 'Белые' : 'Чёрные'}</div>
            <div class="rq-player-username">Ожидание игрока</div>
          </div>
        </div>
      `;
      return;
    }

    const mp = modeProfile(p);
    node.innerHTML = `
      <div class="rq-player-card ${active ? 'turn-active' : ''}">
        ${avatarHTML(p)}
        <div class="rq-player-info">
          <div class="rq-player-name">${escapeHTML(displayName(p))}</div>
          <div class="rq-player-username">${escapeHTML(username(p))}</div>
          <div class="rq-player-rank">${escapeHTML(rankName(mp))} · ${elo(mp)} ELO</div>
          <div class="rq-player-stats">
            <span>В ${mp.wins ?? p.wins ?? 0}</span>
            <span>П ${mp.losses ?? p.losses ?? 0}</span>
          </div>
        </div>
      </div>
    `;
  }

  function updateProfiles(data) {
    if (!data) return;
    profiles = data;
    playerCard(profiles.white, 'white');
    playerCard(profiles.black, 'black');
  }

  // Create/join room
  async function createRoom() {
    if (!uid || !tg?.initData) return toast('Открой Mini App через Telegram');
    if (roomId) return toast('Сначала покинь текущую комнату');

    const button = $('#rqCreateRoom');
    if (button) button.disabled = true;

    try {
      await register();
      const data = await apiRequest('/api/chess/create', {
        method: 'POST',
        body: JSON.stringify({
          initData: tg.initData,
          mode
        })
      });

      roomId = data.room_id || data.code || data.id;
      if (!roomId) throw new Error('Сервер не вернул код комнаты');

      game.connected = false;
      game.started = false;
      game.over = false;
      game.locked = true;
      resultShown = false;

      const input = $('#rqRoomCode');
      if (input) input.value = roomId;

      const controls = $('#rqRoomControls');
      if (controls) controls.style.display = 'block';

      const resultNode = $('#rqResult');
      if (resultNode) resultNode.innerHTML = '';

      connectSocket(roomId);
      status(`${modeLabel()} · Комната создана. Ждём соперника...`);
      renderClocks();
    } catch (error) {
      console.error('Create room:', error);
      toast(error.message || 'Ошибка создания комнаты');
      roomId = null;
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function joinRoom() {
    if (!uid || !tg?.initData) return toast('Открой Mini App через Telegram');
    if (roomId) return toast('Сначала покинь текущую комнату');

    const code = ($('#rqRoomCode')?.value || '').trim();
    if (!code) return toast('Введи код комнаты в поле выше');

    const button = $('#rqJoinRoom');
    if (button) button.disabled = true;

    try {
      await register();
      roomId = code;

      const controls = $('#rqRoomControls');
      if (controls) controls.style.display = 'block';

      connectSocket(roomId);
      status('Подключение к комнате...');
    } catch (error) {
      console.error('Join room:', error);
      toast(error.message || 'Не удалось войти');
      roomId = null;
    } finally {
      if (button) button.disabled = false;
    }
  }

  // WebSocket
  function connectSocket(id) {
    closeSocket();

    const url = `wss://requiem-bot-7eyu.onrender.com/ws/chess/${encodeURIComponent(id)}?initData=${encodeURIComponent(tg?.initData || '')}`;

    try {
      socket = new WebSocket(url);
    } catch (error) {
      toast('Не удалось открыть WebSocket');
      return;
    }

    status('Подключение к серверу...');

    socket.onopen = () => {
      game.connected = true;
      status('Соединение установлено. Ожидание состояния игры...');
    };

    socket.onmessage = event => {
      try {
        receiveState(JSON.parse(event.data));
      } catch (error) {
        console.error('WS message parse:', error);
      }
    };

    socket.onerror = () => {
      console.error('Chess WebSocket error');
      status('Ошибка соединения');
    };

    socket.onclose = () => {
      game.connected = false;
      if (!game.over) status('Соединение закрыто');
    };
  }

  function closeSocket() {
    if (!socket) return;
    socket.onclose = null;
    try {
      socket.close();
    } catch (_) {}
    socket = null;
  }

  function receiveState(data) {
    if (!data || typeof data !== 'object') return;
    if (data.error) {
      toast(data.error);
      return;
    }

    if (data.room_id) roomId = data.room_id;
    if (data.color) playerColor = normalizeColor(data.color) || playerColor;
    if (data.mode && MODES[data.mode]) {
      mode = data.mode;
      updateModeButtons();
    }
    if (data.initial_time) clocks.white = clocks.black = Number(data.initial_time);
    if (data.profiles) updateProfiles(data.profiles);

    if (typeof data.started === 'boolean') game.started = data.started;
    else if (Array.isArray(data.players)) game.started = data.players.length >= 2;

    if (data.clocks) {
      if (data.clocks.white != null) clocks.white = Number(data.clocks.white);
      if (data.clocks.black != null) clocks.black = Number(data.clocks.black);
    }

    if (data.fen && chessReady && chess) {
      try {
        chess.load(data.fen);
        selectedSquare = null;
        legalMoves = [];
        renderBoard();
      } catch (error) {
        console.warn('Invalid FEN from server:', error);
      }
    }

    if (data.turn !== undefined) {
      const turn = normalizeTurn(data.turn);
      const myTurn = turn === (playerColor === 'white' ? 'w' : 'b');
      game.locked = !game.started || !myTurn || game.over;

      if (!game.over) {
        status(!game.started
          ? 'Ожидаем второго игрока...'
          : (myTurn ? 'Ваш ход' : 'Ход соперника'));
      }
    }

    renderClocks();

    if (data.game_over && !game.over) {
      game.over = true;
      game.locked = true;
      stopClock();
      showResult(data.result);
    }

    if (game.started && !game.over && !clockInterval) startDisplayClock();
  }

  function updateModeButtons() {
    $$('.rq-mode-btn').forEach(button => {
      button.classList.toggle('selected', button.dataset.mode === mode);
    });
  }

  function status(message) {
    const node = $('#rqChessStatus');
    if (node) node.textContent = message;
  }

  // Clocks
  function renderClocks() {
    const white = $('#rqWhiteClock');
    const black = $('#rqBlackClock');

    if (white) {
      white.textContent = formatTime(clocks.white);
      white.classList.toggle('active', game.started && chess?.turn() === 'w');
      white.classList.toggle('danger', clocks.white <= 20);
    }

    if (black) {
      black.textContent = formatTime(clocks.black);
      black.classList.toggle('active', game.started && chess?.turn() === 'b');
      black.classList.toggle('danger', clocks.black <= 20);
    }

    playerCard(profiles.white, 'white');
    playerCard(profiles.black, 'black');
  }

  function stopClock() {
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = null;
  }

  function startDisplayClock() {
    stopClock();
    clockTick = Date.now();

    clockInterval = setInterval(() => {
      if (!game.started || game.over || !chess) return;

      const elapsed = (Date.now() - clockTick) / 1000;
      clockTick = Date.now();

      if (chess.turn() === 'w') {
        clocks.white = Math.max(0, clocks.white - elapsed);
      } else {
        clocks.black = Math.max(0, clocks.black - elapsed);
      }

      renderClocks();
    }, 500);
  }

  // Board
  function renderBoard() {
    const boardEl = $('#rqChessBoard');
    if (!boardEl) return;

    if (!chessReady || !chess) {
      boardEl.innerHTML = `
        <div style="grid-column:1/9;display:flex;align-items:center;justify-content:center;color:#888">
          Загрузка шахмат...
        </div>
      `;
      return;
    }

    const rows = chess.board();
    const files = ['a','b','c','d','e','f','g','h'];
    let markup = '';

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const square = files[c] + (8 - r);
        const piece = rows[r][c];
        const light = (r + c) % 2 === 0;
        const isSelected = selectedSquare === square;
        const isLegal = legalMoves.some(m => m.to === square);
        const isCapture = isLegal && !!chess.get(square);

        const classNames = [
          'rq-square',
          light ? 'light' : 'dark'
        ];

        if (isSelected) classNames.push('selected');
        if (lastMove.includes(square)) classNames.push('last-move');
        if (isLegal) classNames.push(isCapture ? 'capture' : 'legal');

        let pieceMarkup = '';

        if (piece) {
          const side = piece.color === 'w' ? 'white' : 'black';
          pieceMarkup = `
            <img class="rq-piece"
              draggable="false"
              alt="${side} ${piece.type}"
              src="${pieceSVG(piece.type, side)}">
          `;
        }

        markup += `
          <div class="${classNames.join(' ')}"
            data-square="${square}"
            role="button"
            aria-label="${square}">
            ${pieceMarkup}
          </div>
        `;
      }
    }

    boardEl.innerHTML = markup;
  }

  function onSquareClick(square) {
    if (!chessReady || !chess || !game.connected || game.locked || game.over || !game.started) return;

    const myColor = playerColor === 'white' ? 'w' : 'b';
    const piece = chess.get(square);

    if (selectedSquare) {
      const destination = legalMoves.find(move => move.to === square);
      if (destination) {
        sendMove(selectedSquare, square, destination);
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
      return toast('Нет соединения с сервером');
    }

    const promotion = move?.promotion || (move?.flags?.includes('p') ? 'q' : undefined);

    socket.send(JSON.stringify({
      type: 'move',
      from,
      to,
      promotion
    }));

    lastMove = [from, to];
    selectedSquare = null;
    legalMoves = [];
    renderBoard();
  }

  // Result/copy/leave
  function showResult(value) {
    if (resultShown) return;
    resultShown = true;

    const box = $('#rqResult');
    if (!box) return;

    let title = 'НИЧЬЯ';
    let subtitle = 'Партия завершилась вничью';

    if (value === 'white' || value === '1-0') {
      title = playerColor === 'white' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
      subtitle = 'Победили белые';
    } else if (value === 'black' || value === '0-1') {
      title = playerColor === 'black' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
      subtitle = 'Победили чёрные';
    }

    box.innerHTML = `
      <div class="rq-result">
        <h2>${title}</h2>
        <div style="color:#aaa">${subtitle}</div>
        <div style="color:#777;font-size:11px;margin-top:8px">
          ${modeLabel()} · ${MODES[mode].label}
        </div>
        <button type="button" id="rqNewGame">Новая игра</button>
      </div>
    `;

    loadProfile();
    loadLeaderboard();
  }

  async function copyRoomCode() {
    const code = ($('#rqRoomCode')?.value || roomId || '').trim();

    if (!code) return toast('Код комнаты отсутствует');

    try {
      await navigator.clipboard.writeText(code);
      toast('Код скопирован');
    } catch (_) {
      const input = $('#rqRoomCode');

      if (input) {
        input.focus();
        input.select();

        try {
          document.execCommand('copy');
          toast('Код скопирован');
        } catch (e) {
          toast('Не удалось скопировать');
        }
      } else {
        toast('Не удалось скопировать');
      }
    }
  }

  function leaveRoom() {
    stopClock();
    closeSocket();

    roomId = null;
    playerColor = null;
    selectedSquare = null;
    legalMoves = [];
    lastMove = [];
    profiles = {};
    resultShown = false;

    game.connected = false;
    game.started = false;
    game.over = false;
    game.locked = true;

    clocks.white = clocks.black = MODES[mode].seconds;

    if (chessReady && window.Chess) {
      chess = new window.Chess();
    }

    playerCard(null, 'white');
    playerCard(null, 'black');
    renderBoard();

    const controls = $('#rqRoomControls');
    if (controls) controls.style.display = 'none';

    const resultBox = $('#rqResult');
    if (resultBox) resultBox.innerHTML = '';

    status('Выбери режим и создай комнату');
    renderClocks();
  }

  // Events — delegated, so work after dynamic rendering
  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const homePlay = target.closest('#rqHomePlay');
    if (homePlay) {
      event.preventDefault();
      showGames();
      return;
    }

   const oldPlay = target.closest('#openChess');
if (oldPlay) {
  event.preventDefault();
  event.stopPropagation();
  showChess();
  return;
}

    const nav = target.closest('.nav-item[data-page]');
    if (nav) {
      event.preventDefault();
      const page = nav.dataset.page;
      if (page === 'home') showHome();
      else if (page === 'games') showGames();
      else if (page === 'rating') showRating();
      return;
    }

    const modeBtn = target.closest('.rq-mode-btn');
    if (modeBtn) {
      const next = modeBtn.dataset.mode;
      if (MODES[next] && !roomId) {
        mode = next;
        clocks.white = clocks.black = MODES[mode].seconds;
        updateModeButtons();
        renderClocks();
      } else if (roomId) {
        toast('Сначала покинь комнату');
      }
      return;
    }

    if (target.closest('#rqCreateRoom')) return createRoom();
    if (target.closest('#rqJoinRoom')) return joinRoom();
    if (target.closest('#rqCopyCode')) return copyRoomCode();
    if (target.closest('#rqLeaveRoom')) return leaveRoom();
    if (target.closest('#rqNewGame')) {
      leaveRoom();
      showChess();
      return;
    }

    const square = target.closest('.rq-square[data-square]');
    if (square) {
      onSquareClick(square.dataset.square);
      return;
    }

    const leaderboardModeBtn = target.closest('[data-leaderboard-mode]');
    if (leaderboardModeBtn) {
      leaderboardMode = leaderboardModeBtn.dataset.leaderboardMode;
      loadLeaderboard();
    }
  });

  // Main buttons that may be dynamically replaced
  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const playButton = target.closest('button');
    if (!playButton) return;

    const text = playButton.textContent.trim().replace(/\s+/g, ' ');
    if (text === 'Играть' || text === 'ИГРАТЬ' || text.startsWith('ИГРАТЬ ')) {
      event.preventDefault();
      showGames();
    }
  });

  // Startup
  async function startApp() {
    ensureHomePlayButton();

    if (user && $('#username')) {
      $('#username').textContent = displayName(user);
    }

    await register();
    await loadProfile();
    loadLeaderboard();
  }

  showHome();
  startApp().catch(error => console.error('REQUIEM startup error:', error));
});
