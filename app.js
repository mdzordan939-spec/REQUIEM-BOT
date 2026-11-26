document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // REQUIEM — stable frontend
  const API = 'https://requiem-bot-7eyu.onrender.com';
  const tg = window.Telegram?.WebApp || null;
  const user = tg?.initDataUnsafe?.user || null;
  const uid = user?.id ? String(user.id) : '';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const MODES = {
    bullet: { name: 'ПУЛЯ', label: '2 минуты', seconds: 120 },
    blitz: { name: 'БЛИЦ', label: '5 минут', seconds: 300 },
    rapid: { name: 'РАПИД', label: '10 минут', seconds: 600 }
  };

  const PIECES = {
    w: { k:'♔', q:'♕', r:'♖', b:'♗', n:'♘', p:'♙' },
    b: { k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟' }
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
  let clocks = { white:300, black:300 };
  let clockInterval = null;
  let clockTick = Date.now();
  let myProfile = null;
  let resultShown = false;
  let leaderboardMode = 'blitz';
  let chessUIReady = false;

  const game = {
    connected:false,
    started:false,
    over:false,
    locked:true
  };

  if (tg) {
    try {
      tg.ready();
      tg.expand();
      tg.setHeaderColor?.('#080808');
      tg.setBackgroundColor?.('#080808');
    } catch(e) {
      console.warn(e);
    }
  }

  function escapeHTML(v='') {
    return String(v).replace(/[&<>"']/g, c => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c]));
  }

  function displayName(p) {
    if (!p) return 'Игрок';
    const n = `${p.first_name||''} ${p.last_name||''}`.trim();
    return n || p.username || `Игрок ${p.id||''}`;
  }

  function username(p) {
    return p?.username
      ? '@'+String(p.username).replace(/^@/,'')
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

  function formatTime(v) {
    const n = Math.max(0, Math.floor(Number(v)||0));
    return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  }

  function avatarHTML(p, cls='') {
    const src = photo(p);
    return `<div class="rq-avatar ${cls}">
      <span>${escapeHTML(initials(p))}</span>
      ${src ? `<img src="${escapeHTML(src)}" alt="" onerror="this.remove()">` : ''}
    </div>`;
  }

  function toast(msg) {
    let n = $('#toast');
    if (!n) {
      n = document.createElement('div');
      n.id = 'toast';
      n.className = 'toast';
      document.body.appendChild(n);
    }
    n.textContent = String(msg||'');
    n.classList.add('show');
    clearTimeout(n._hideTimer);
    n._hideTimer = setTimeout(() => n.classList.remove('show'), 2600);
  }

  async function apiRequest(path, opts={}) {
    const res = await fetch(API+path, {
      ...opts,
      headers: {
        'Content-Type':'application/json',
        ...(opts.headers||{})
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail||data.error||`HTTP ${res.status}`);
    return data;
  }

  function normalizeColor(v) {
    return v==='white'||v==='w'?'white':
           v==='black'||v==='b'?'black':null;
  }

  function normalizeTurn(v) {
    return v==='white'?'w':v==='black'?'b':v;
  }

  function modeLabel() {
    return MODES[mode]?.name||'БЛИЦ';
  }

  const style = document.createElement('style');

  style.textContent = `
  .rq-home-play {
    display:flex;align-items:center;justify-content:center;width:100%;
    margin:16px 0 4px;padding:15px;border:1px solid #d62a43;
    border-radius:12px;background:linear-gradient(120deg,#951326,#e0203e);
    color:#fff;font-size:14px;font-weight:900;letter-spacing:1px;
    cursor:pointer;position:relative;z-index:5;pointer-events:auto
  }

  #chessMount { color:#eee }

  .rq-avatar {
    width:44px;height:44px;flex-shrink:0;border-radius:50%;
    overflow:hidden;position:relative;display:flex;align-items:center;
    justify-content:center;background:linear-gradient(145deg,#3b111b,#100c0d);
    border:2px solid #9d1828;color:#fff;font-weight:900;font-size:17px
  }

  .rq-avatar img {
    position:absolute;inset:0;width:100%;height:100%;
    object-fit:cover;z-index:2
  }

  .rq-avatar.small {width:34px;height:34px;font-size:13px}

  .rq-player-card {
    display:flex;align-items:center;gap:8px;padding:8px;background:#111;
    border:1px solid #292020;border-radius:11px;min-width:0;overflow:hidden
  }

  .rq-player-card.turn-active {
    border-color:#c52640;box-shadow:0 0 12px #a3153020
  }

  .rq-player-info {flex:1;min-width:0}

  .rq-player-name {
    font-size:12px;font-weight:900;color:#fff;overflow:hidden;
    text-overflow:ellipsis;white-space:nowrap
  }

  .rq-player-username {
    font-size:10px;color:#888;margin-top:3px;overflow:hidden;
    text-overflow:ellipsis;white-space:nowrap
  }

  .rq-player-rank {
    color:#e43b4d;font-size:10px;font-weight:800;margin-top:4px
  }

  .rq-player-stats {
    display:flex;gap:6px;flex-wrap:wrap;color:#888;font-size:9px;margin-top:4px
  }

  .rq-clock {
    background:#080808;border:1px solid #332126;border-radius:8px;
    padding:7px 5px;min-width:55px;text-align:center;color:#fff;
    font-size:16px;font-weight:900;font-variant-numeric:tabularnums
  }

  .rq-clock.active {border-color:#d52b45;background:#320d16;color:#ff5269}
  .rq-clock.danger {color:#ff334e}

  .rq-chess-players {
    display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:12px 0
  }

  .rq-mode-selector {
    display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:12px 0
  }

  .rq-mode-btn {
    border:1px solid #2b2022;border-radius:10px;background:#111;color:#888;
    padding:10px 3px;font-size:10px;font-weight:900;cursor:pointer
  }

  .rq-mode-btn span {
    display:block;color:#fff;font-size:13px;margin-top:4px
  }

  .rq-mode-btn.selected {
    color:#ff4058;border-color:#e12642;
    background:linear-gradient(145deg,#3b0d16,#160a0d)
  }

  .rq-chess-board {
    width:100%;aspect-ratio:1;display:grid;grid-template-columns:repeat(8,1fr);
    overflow:hidden;border-radius:5px;border:2px solid #46111c;background:#100d0e;
    touch-action:manipulation;box-shadow:0 10px 30px #0008
  }

  .rq-square {
    position:relative;display:flex;align-items:center;justify-content:center;
    min-width:0;aspect-ratio:1;overflow:hidden;cursor:pointer;
    touch-action:manipulation
  }

  .rq-square.light {background:#b88762}
  .rq-square.dark {background:#492b27}
  .rq-square.selected {background:#ad1834!important;box-shadow:inset 0 0 0 3px #ff3856}
  .rq-square.last-move {box-shadow:inset 0 0 0 3px #e6d16c75}

  .rq-square.legal::after {
    content:'';position:absolute;width:24%;height:24%;
    background:#ddd9d2a0;border-radius:50%;z-index:1;pointer-events:none
  }

  .rq-square.capture::after {
    content:'';position:absolute;inset:5%;border:3px solid #ddd9d280;
    border-radius:50%;z-index:1;pointer-events:none
  }

  .rq-piece {
    display:flex;align-items:center;justify-content:center;width:100%;height:100%;
    font-family:'Segoe UI Symbol','DejaVu Sans',serif;
    font-size:clamp(24px,8vw,52px);line-height:1;position:relative;z-index:2;
    pointer-events:none;text-shadow:0 1px 2px #0008
  }

  .rq-piece.white {color:#fffdf4;text-shadow:0 1px 2px #111,0 0 2px #111}
  .rq-piece.black {color:#171717;text-shadow:0 1px 1px #e8dfd0}

  .rq-chess-status {
    text-align:center;color:#ddd;font-size:12px;padding:11px;background:#111;
    border:1px solid #281a1d;border-radius:9px;margin:10px 0
  }

  .rq-chess-actions {display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}

  .rq-chess-actions button,.rq-room-code-row button {
    flex:1;border:1px solid #392027;border-radius:10px;background:#171010;
    color:white;padding:12px 6px;font-size:12px;font-weight:900;
    cursor:pointer;touch-action:manipulation
  }

  .rq-chess-actions button.primary {background:#a7192b;border-color:#d32b40}
  .rq-chess-actions button:disabled {opacity:.55;cursor:default}

  .rq-room-code-row {display:flex;gap:7px;margin-top:12px}

  .rq-room-code-row input {
    flex:1;min-width:0;background:#111;border:1px solid #392027;
    color:#fff;padding:11px;border-radius:9px
  }

  .rq-result {
    text-align:center;padding:22px 10px;background:#170c0e;
    border:1px solid #70202b;border-radius:15px;margin-top:12px
  }

  .rq-result h2 {color:#ff4057;margin:0 0 8px;font-size:24px}

  .rq-result button {
    margin-top:14px;background:#a7192b;color:white;border:0;border-radius:9px;
    padding:12px 20px;font-weight:900;cursor:pointer
  }

  .rq-leader-row {
    display:flex;align-items:center;gap:10px;padding:11px;border-bottom:1px solid #252020
  }

  .rq-leader-row.me {background:#281014}

  @media(max-width:350px) {
    .rq-chess-players {grid-template-columns:1fr}
  }
  `;

  document.head.appendChild(style);

  function ensureHomePlayButton() {
    const hero = $('.hero');
    if (!hero || $('#rqHomePlay')) return;

    const b = document.createElement('button');
    b.id = 'rqHomePlay';
    b.className = 'rq-home-play';
    b.type = 'button';
    b.textContent = 'ИГРАТЬ  ↗';
    b.setAttribute('aria-label', 'Перейти в игры');
    hero.appendChild(b);
  }

  function hideMainSections() {
    $$('.hero,.profile,.stats,.menu,.section-heading')
      .forEach(el => el.style.display = 'none');

    ['gamesHub','chessScreen','ratingSection'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  function setNavActive(page) {
    $$('.nav-item').forEach(el =>
      el.classList.toggle('active', el.dataset.page === page)
    );
  }

  function showHome() {
    hideMainSections();
    $$('.hero,.profile,.stats,.menu,.section-heading')
      .forEach(el => el.style.display = '');
    setNavActive('home');
    ensureHomePlayButton();
  }

  function showGames() {
    hideMainSections();
    const s = $('#gamesHub');
    if (s) s.style.display = 'block';
    $$('.section-heading', s || document).forEach(el => el.style.display = '');
    setNavActive('games');
  }

  function showChess() {
    hideMainSections();
    const s = $('#chessScreen');
    if (s) s.style.display = 'block';
    setNavActive('games');
    initChessUI();
  }

  function showRating() {
    hideMainSections();
    const s = $('#ratingSection');
    if (s) s.style.display = 'block';
    setNavActive('rating');
    loadProfile();
    loadLeaderboard();
  }

  async function register() {
    if (!tg?.initData) return null;
    return apiRequest('/api/register', {
      method:'POST',
      body:JSON.stringify({initData:tg.initData})
    });
  }

  function modeProfile(p,m=mode) {
    const mr = p?.mode_ratings?.[m];
    return mr ? {...p,...mr} : p;
  }

  async function loadProfile() {
    if (!uid) return;
    try {
      const d = await apiRequest(`/api/player/${encodeURIComponent(uid)}`);
      myProfile = d.player || d;
      renderProfile();
    } catch(e) {
      console.warn('Profile:', e);
    }
  }

  function renderProfile() {
    const p = myProfile;
    if (!p) return;

    const n = $('#username');
    if (n) n.textContent = displayName(p);

    const rating = $('#elo');
    if (rating) rating.textContent = elo(modeProfile(p));

    const rank = $('#rank');
    if (rank) rank.textContent = rankName(modeProfile(p));

    const wins = $('#wins');
    if (wins) wins.textContent = p.wins ?? 0;

    const losses = $('#losses');
    if (losses) losses.textContent = p.losses ?? 0;
  }

  async function loadLeaderboard() {
    const container = $('#leaderboard') || $('#ratingList');
    if (!container) return;

    try {
      const d = await apiRequest(
        `/api/leaderboard?mode=${encodeURIComponent(leaderboardMode)}`
      );

      const list = d.leaderboard || d.players || [];

      container.innerHTML = list.map((p,i) => `
        <div class="rq-leader-row ${String(p.id)===uid?'me':''}">
          <strong>${i+1}</strong>
          ${avatarHTML(p,'small')}
          <div style="flex:1;min-width:0">
            <div style="font-weight:900;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${escapeHTML(displayName(p))}
            </div>
            <div style="color:#888;font-size:10px">
              ${escapeHTML(rankName(modeProfile(p,leaderboardMode)))}
            </div>
          </div>
          <strong style="color:#f44">${elo(modeProfile(p,leaderboardMode))}</strong>
        </div>
      `).join('') || '<div style="color:#888;padding:12px">Пока нет игроков в рейтинге</div>';

    } catch(e) {
      console.warn('Leaderboard:', e);
      container.innerHTML = '<div style="color:#888;padding:12px">Не удалось загрузить рейтинг</div>';
    }
  }

  function initChessUI() {
    const mount = $('#chessMount');
    if (!mount || chessUIReady) return;
    chessUIReady = true;

    mount.innerHTML = `
      <div class="rq-mode-selector">
        <button type="button" class="rq-mode-btn" data-mode="bullet">ПУЛЯ<span>2 мин</span></button>
        <button type="button" class="rq-mode-btn selected" data-mode="blitz">БЛИЦ<span>5 мин</span></button>
        <button type="button" class="rq-mode-btn" data-mode="rapid">РАПИД<span>10 мин</span></button>
      </div>

      <div class="rq-chess-players">
        <div id="rqWhitePlayer"></div>
        <div id="rqBlackPlayer"></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:10px 0">
        <div id="rqWhiteClock" class="rq-clock">05:00</div>
        <div id="rqBlackClock" class="rq-clock">05:00</div>
      </div>

      <div id="rqChessStatus" class="rq-chess-status">
        Выбери режим и создай комнату
      </div>

      <div id="rqChessBoard" class="rq-chess-board" aria-label="Шахматная доска"></div>

      <div class="rq-chess-actions">
        <button id="rqCreateRoom" class="primary" type="button">Создать комнату</button>
        <button id="rqJoinRoom" type="button">Войти в комнату</button>
      </div>

      <div class="rq-room-code-row">
        <input id="rqRoomCode" type="text" placeholder="Код комнаты" autocomplete="off" aria-label="Код комнаты">
        <button id="rqCopyCode" type="button">Копировать код</button>
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
    updateModeButtons();
  }

  function loadChessLibrary() {
    if (window.Chess) {
      setupChess();
      return;
    }

    if (document.querySelector('script[data-requiem-chess]')) return;

    const s = document.createElement('script');
    s.dataset.requiemChess = '1';
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js';
    s.onload = setupChess;
    s.onerror = () => {
      status('Не удалось загрузить chess.js. Проверь интернет.');
      toast('Ошибка загрузки шахмат');
    };

    document.head.appendChild(s);
  }

  function setupChess() {
    try {
      chess = new window.Chess();
      chessReady = true;
      renderBoard();
    } catch(e) {
      console.error(e);
      status('Не удалось запустить шахматы');
    }
  }

  function playerCard(profile,color) {
    const node = color === 'white' ? $('#rqWhitePlayer') : $('#rqBlackPlayer');
    if (!node) return;

    const active = chess &&
      chess.turn() === (color === 'white' ? 'w' : 'b') &&
      game.started && !game.over;

    const p = profile || (color === playerColor ? myProfile : null);

    if (!p) {
      node.innerHTML = `
        <div class="rq-player-card">
          <div class="rq-avatar">
            <span>${color === 'white' ? '♔' : '♚'}</span>
          </div>
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
      <div class="rq-player-card ${active?'turn-active':''}">
        ${avatarHTML(p)}
        <div class="rq-player-info">
          <div class="rq-player-name">${escapeHTML(displayName(p))}</div>
          <div class="rq-player-username">${escapeHTML(username(p))}</div>
          <div class="rq-player-rank">
            ${escapeHTML(rankName(mp))} · ${elo(mp)} ELO
          </div>
          <div class="rq-player-stats">
            <span>В ${mp.wins??p.wins??0}</span>
            <span>П ${mp.losses??p.losses??0}</span>
          </div>
        </div>
      </div>
    `;
  }

  function updateProfiles(data) {
    if (!data) return;
    profiles = data;
    playerCard(profiles.white,'white');
    playerCard(profiles.black,'black');
  }

  async function createRoom() {
    if (!uid || !tg?.initData)
      return toast('Открой Mini App через Telegram');

    if (roomId) return toast('Сначала покинь текущую комнату');

    const b = $('#rqCreateRoom');
    if (b) b.disabled = true;

    try {
      await register();

      const d = await apiRequest('/api/chess/create', {
        method:'POST',
        body:JSON.stringify({initData:tg.initData,mode})
      });

      roomId = d.room_id || d.code || d.id;
      if (!roomId) throw new Error('Сервер не вернул код комнаты');

      resetRoomState();

      const input = $('#rqRoomCode');
      if (input) input.value = roomId;

      const controls = $('#rqRoomControls');
      if (controls) controls.style.display = 'block';

      const result = $('#rqResult');
      if (result) result.innerHTML = '';

      connectSocket(roomId);
      status(`${modeLabel()} · Комната создана. Ждём соперника...`);
      renderClocks();

    } catch(e) {
      console.error('Create room:', e);
      toast(e.message||'Ошибка создания комнаты');
      roomId = null;
    } finally {
      if (b) b.disabled = false;
    }
  }

  async function joinRoom() {
    if (!uid || !tg?.initData)
      return toast('Открой Mini App через Telegram');

    if (roomId) return toast('Сначала покинь текущую комнату');

    const code = $('#rqRoomCode')?.value.trim();
    if (!code) return toast('Введи код комнаты');

    const b = $('#rqJoinRoom');
    if (b) b.disabled = true;

    try {
      await register();
      roomId = code;

      const controls = $('#rqRoomControls');
      if (controls) controls.style.display = 'block';

      connectSocket(roomId);
      status('Подключение к комнате...');

    } catch(e) {
      console.error('Join room:', e);
      toast(e.message||'Не удалось войти');
      roomId = null;
    } finally {
      if (b) b.disabled = false;
    }
  }

  function resetRoomState() {
    game.connected = false;
    game.started = false;
    game.over = false;
    game.locked = true;
    resultShown = false;
    selectedSquare = null;
    legalMoves = [];
    lastMove = [];
    profiles = {};
    clocks.white = clocks.black = MODES[mode].seconds;
  }

  function connectSocket(id) {
    closeSocket();

    const url = `wss://requiem-bot-7eyu.onrender.com/ws/chess/${encodeURIComponent(id)}?initData=${encodeURIComponent(tg?.initData||'')}`;

    try {
      socket = new WebSocket(url);
    } catch(e) {
      toast('Не удалось открыть WebSocket');
      return;
    }

    status('Подключение к серверу...');

    socket.onopen = () => {
      game.connected = true;
      status('Соединение установлено. Ожидание состояния игры...');
    };

    socket.onmessage = e => {
      try {
        receiveState(JSON.parse(e.data));
      } catch(err) {
        console.error('WS parse:', err);
      }
    };

    socket.onerror = () => status('Ошибка соединения');

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
    } catch(e) {}
    socket = null;
  }

  function receiveState(d) {
    if (!d || typeof d !== 'object') return;
    if (d.error) {
      toast(d.error);
      return;
    }

    if (d.room_id) roomId = d.room_id;
    if (d.color) playerColor = normalizeColor(d.color) || playerColor;

    if (d.mode && MODES[d.mode]) {
      mode = d.mode;
      updateModeButtons();
    }

    if (d.initial_time)
      clocks.white = clocks.black = Number(d.initial_time);

    if (d.profiles) updateProfiles(d.profiles);

    if (typeof d.started === 'boolean')
      game.started = d.started;
    else if (Array.isArray(d.players))
      game.started = d.players.length >= 2;

    if (d.clocks) {
      if (d.clocks.white != null) clocks.white = Number(d.clocks.white);
      if (d.clocks.black != null) clocks.black = Number(d.clocks.black);
    }

    if (d.fen && chessReady && chess) {
      try {
        chess.load(d.fen);
        selectedSquare = null;
        legalMoves = [];
        renderBoard();
      } catch(e) {
        console.warn('Bad server FEN', e);
      }
    }

    if (d.turn !== undefined) {
      const turn = normalizeTurn(d.turn);
      const mine = turn === (playerColor === 'white' ? 'w' : 'b');

      game.locked = !game.started || !mine || game.over;

      if (!game.over) {
        status(
          !game.started
            ? 'Ожидаем второго игрока...'
            : mine
              ? 'Ваш ход'
              : 'Ход соперника'
        );
      }
    }

    renderClocks();

    if (d.game_over && !game.over) {
      game.over = true;
      game.locked = true;
      stopClock();
      showResult(d.result);
    }

    if (game.started && !game.over && !clockInterval)
      startDisplayClock();
  }

  function updateModeButtons() {
    $$('.rq-mode-btn').forEach(b =>
      b.classList.toggle('selected', b.dataset.mode === mode)
    );
  }

  function status(msg) {
    const n = $('#rqChessStatus');
    if (n) n.textContent = msg;
  }

  function renderClocks() {
    const w = $('#rqWhiteClock');
    const b = $('#rqBlackClock');

    if (w) {
      w.textContent = formatTime(clocks.white);
      w.classList.toggle('active', game.started && chess?.turn() === 'w');
      w.classList.toggle('danger', clocks.white <= 20);
    }

    if (b) {
      b.textContent = formatTime(clocks.black);
      b.classList.toggle('active', game.started && chess?.turn() === 'b');
      b.classList.toggle('danger', clocks.black <= 20);
    }

    playerCard(profiles.white,'white');
    playerCard(profiles.black,'black');
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

      const dt = (Date.now() - clockTick) / 1000;
      clockTick = Date.now();

      if (chess.turn() === 'w')
        clocks.white = Math.max(0, clocks.white - dt);
      else
        clocks.black = Math.max(0, clocks.black - dt);

      renderClocks();
    }, 500);
  }

  function renderBoard() {
    const board = $('#rqChessBoard');
    if (!board) return;

    if (!chessReady || !chess) {
      board.innerHTML = `
        <div style="grid-column:1/9;display:flex;align-items:center;justify-content:center;color:#888">
          Загрузка шахмат…
        </div>`;
      return;
    }

    const rows = chess.board();
    const files = 'abcdefgh';
    let html = '';

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = files[c] + (8-r);
        const p = rows[r][c];
        const light = (r+c)%2 === 0;
        const sel = selectedSquare === sq;
        const legal = legalMoves.some(m => m.to === sq);
        const capture = legal && !!chess.get(sq);

        const classes = ['rq-square', light?'light':'dark'];
        if (sel) classes.push('selected');
        if (lastMove.includes(sq)) classes.push('last-move');
        if (legal) classes.push(capture?'capture':'legal');

        let piece = '';

        if (p) {
          const side = p.color === 'w' ? 'white' : 'black';
          piece = `<span class="rq-piece ${side}" aria-label="${side==='white'?'Белая':'Чёрная'} ${p.type}">
            ${PIECES[p.color][p.type]}
          </span>`;
        }

        html += `<div class="${classes.join(' ')}" data-square="${sq}" role="button" aria-label="${sq}">${piece}</div>`;
      }
    }

    board.innerHTML = html;
  }

  function onSquareClick(sq) {
    if (!chessReady || !chess || !game.connected || game.locked || game.over || !game.started)
      return;

    const mine = playerColor === 'white' ? 'w' : 'b';
    const p = chess.get(sq);

    if (selectedSquare) {
      const m = legalMoves.find(x => x.to === sq);
      if (m) {
        sendMove(selectedSquare, sq, m);
        return;
      }
    }

    if (p && p.color === mine && chess.turn() === mine) {
      selectedSquare = sq;
      legalMoves = chess.moves({square:sq, verbose:true});
      renderBoard();
      return;
    }

    selectedSquare = null;
    legalMoves = [];
    renderBoard();
  }

  function sendMove(from,to,m) {
    if (!socket || socket.readyState !== WebSocket.OPEN)
      return toast('Нет соединения с сервером');

    const promotion = m?.promotion || (m?.flags?.includes('p') ? 'q' : undefined);

    socket.send(JSON.stringify({
      type:'move',
      from,
      to,
      promotion
    }));

    lastMove = [from,to];
    selectedSquare = null;
    legalMoves = [];
    renderBoard();
  }

  function showResult(value) {
    if (resultShown) return;
    resultShown = true;

    const box = $('#rqResult');
    if (!box) return;

    let title = 'НИЧЬЯ';
    let sub = 'Партия завершилась вничью';

    if (value === 'white' || value === '1-0') {
      title = playerColor === 'white' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
      sub = 'Победили белые';
    } else if (value === 'black' || value === '0-1') {
      title = playerColor === 'black' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
      sub = 'Победили чёрные';
    }

    box.innerHTML = `
      <div class="rq-result">
        <h2>${title}</h2>
        <div style="color:#aaa">${sub}</div>
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
    } catch(e) {
      const input = $('#rqRoomCode');
      if (input) {
        input.focus();
        input.select();
        try {
          document.execCommand('copy');
          toast('Код скопирован');
        } catch(err) {
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

    if (chessReady && window.Chess)
      chess = new window.Chess();

    playerCard(null,'white');
    playerCard(null,'black');
    renderBoard();

    const controls = $('#rqRoomControls');
    if (controls) controls.style.display = 'none';

    const result = $('#rqResult');
    if (result) result.innerHTML = '';

    const input = $('#rqRoomCode');
    if (input) input.value = '';

    status('Выбери режим и создай комнату');
    renderClocks();
  }

  document.addEventListener('click', event => {
    const t = event.target;
    if (!(t instanceof Element)) return;

    const home = t.closest('#rqHomePlay');
    if (home) {
      event.preventDefault();
      showGames();
      return;
    }

    const chessBtn = t.closest('#openChess');
    if (chessBtn) {
      event.preventDefault();
      showChess();
      return;
    }

    const back = t.closest('#backToGames');
    if (back) {
      event.preventDefault();
      showGames();
      return;
    }

    const nav = t.closest('.nav-item[data-page]');
    if (nav) {
      event.preventDefault();
      const page = nav.dataset.page;

      if (page === 'home') showHome();
      else if (page === 'games') showGames();
      else if (page === 'rating') showRating();
      else if (page === 'profile') showHome();
      else if (page === 'collection' || page === 'tasks' || page === 'bonus' || page === 'crystals')
        toast('Раздел пока в разработке');

      return;
    }

    const mb = t.closest('.rq-mode-btn');
    if (mb) {
      if (MODES[mb.dataset.mode] && !roomId) {
        mode = mb.dataset.mode;
        clocks.white = clocks.black = MODES[mode].seconds;
        updateModeButtons();
        renderClocks();
      } else if (roomId) {
        toast('Сначала покинь комнату');
      }
      return;
    }

    if (t.closest('#rqCreateRoom')) {
      createRoom();
      return;
    }

    if (t.closest('#rqJoinRoom')) {
      joinRoom();
      return;
    }

    if (t.closest('#rqCopyCode')) {
      copyRoomCode();
      return;
    }

    if (t.closest('#rqLeaveRoom')) {
      leaveRoom();
      return;
    }

    if (t.closest('#rqNewGame')) {
      leaveRoom();
      showChess();
      return;
    }

    const sq = t.closest('.rq-square[data-square]');
    if (sq) {
      onSquareClick(sq.dataset.square);
      return;
    }

    const lb = t.closest('[data-leaderboard-mode]');
    if (lb) {
      leaderboardMode = lb.dataset.leaderboardMode;
      loadLeaderboard();
      return;
    }

    const button = t.closest('button');
    if (button) {
      const txt = button.textContent.trim().replace(/\s+/g,' ');
      if (txt === 'Играть' || txt === 'ИГРАТЬ' || txt.startsWith('ИГРАТЬ '))
        showGames();
    }
  });

  async function startApp() {
    ensureHomePlayButton();
    if (user && $('#username'))
      $('#username').textContent = displayName(user);

    await register();
    await loadProfile();
    await loadLeaderboard();
  }

  showHome();
  startApp().catch(e => console.error('REQUIEM startup:', e));
});
