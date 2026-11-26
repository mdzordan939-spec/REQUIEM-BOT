
import os
import json
import hmac
import hashlib
import sqlite3
import time
import asyncio
import uuid

from urllib.parse import parse_qsl

import chess

from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware


# ==========================================
# REQUIEM CONFIG
# ==========================================

app = FastAPI(title="REQUIEM API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://mdzordan939-spec.github.io"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

DB_PATH = "players.db"

INITIAL_ELO = 1000
MIN_ELO = 100
K_FACTOR = 32

MODES = {
    "bullet": {
        "name": "ПУЛЯ",
        "seconds": 120,
    },
    "blitz": {
        "name": "БЛИЦ",
        "seconds": 300,
    },
    "rapid": {
        "name": "РАПИД",
        "seconds": 600,
    },
}

# ==========================================
# RANKS
# ==========================================

RANKS = [
    {"key": "INITIATE", "name": "INITIATE", "min": 0, "max": 499, "number": 1},
    {"key": "RECRUIT", "name": "RECRUIT", "min": 500, "max": 799, "number": 2},
    {"key": "HUNTER", "name": "HUNTER", "min": 800, "max": 1099, "number": 3},
    {"key": "EXECUTIONER", "name": "EXECUTIONER", "min": 1100, "max": 1399, "number": 4},
    {"key": "REAPER", "name": "REAPER", "min": 1400, "max": 1699, "number": 5},
    {"key": "PHANTOM", "name": "PHANTOM", "min": 1700, "max": 1999, "number": 6},
    {"key": "REQUIEM", "name": "REQUIEM", "min": 2000, "max": None, "number": 7},
]


def get_rank(elo: int):
    elo = max(0, int(elo))
    selected = RANKS[0]

    for rank in RANKS:
        if elo >= rank["min"]:
            selected = rank
        else:
            break

    if selected["max"] is None:
        return {
            "rank": selected["key"],
            "rank_name": selected["name"],
            "rank_number": selected["number"],
            "division": "ELITE",
            "rank_label": "REQUIEM ELITE",
            "next_elo": None,
            "elo_remaining": 0,
            "progress": 100,
        }

    rank_min = selected["min"]
    rank_max = selected["max"]
    total = rank_max - rank_min + 1
    division_size = total / 3
    position = elo - rank_min

    if position < division_size:
        division = "III"
        division_min = rank_min
        division_max = rank_min + round(division_size) - 1
    elif position < division_size * 2:
        division = "II"
        division_min = rank_min + round(division_size)
        division_max = rank_min + round(division_size * 2) - 1
    else:
        division = "I"
        division_min = rank_min + round(division_size * 2)
        division_max = rank_max

    progress = (
        (elo - division_min) /
        max(1, division_max - division_min + 1)
    ) * 100

    next_elo = division_max + 1

    return {
        "rank": selected["key"],
        "rank_name": selected["name"],
        "rank_number": selected["number"],
        "division": division,
        "rank_label": f"{selected['name']} {division}",
        "next_elo": next_elo,
        "elo_remaining": max(0, next_elo - elo),
        "progress": round(min(100, progress), 1),
    }


# ==========================================
# DATABASE
# ==========================================

def db_connect():
    return sqlite3.connect(DB_PATH, timeout=15)


def init_db():
    with db_connect() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS players (
                id INTEGER PRIMARY KEY,
                first_name TEXT,
                last_name TEXT,
                username TEXT,
                photo_url TEXT,
                registered_at INTEGER,
                elo INTEGER DEFAULT 1000,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                draws INTEGER DEFAULT 0,
                games_played INTEGER DEFAULT 0
            )
        """)

        columns = {
            row[1]
            for row in db.execute("PRAGMA table_info(players)").fetchall()
        }

        additions = {
            "elo": "INTEGER DEFAULT 1000",
            "wins": "INTEGER DEFAULT 0",
            "losses": "INTEGER DEFAULT 0",
            "draws": "INTEGER DEFAULT 0",
            "games_played": "INTEGER DEFAULT 0",
            "photo_url": "TEXT",
            "username": "TEXT",
            "first_name": "TEXT",
            "last_name": "TEXT",
            "registered_at": "INTEGER",
        }

        for column, definition in additions.items():
            if column not in columns:
                db.execute(f"ALTER TABLE players ADD COLUMN {column} {definition}")

        # Separate ratings and statistics for each time control.
        db.execute("""
            CREATE TABLE IF NOT EXISTS chess_ratings (
                player_id INTEGER NOT NULL,
                mode TEXT NOT NULL,
                elo INTEGER DEFAULT 1000,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                draws INTEGER DEFAULT 0,
                games_played INTEGER DEFAULT 0,
                PRIMARY KEY (player_id, mode)
            )
        """)

        # Existing players receive a separate initial rating for each mode.
        existing_players = db.execute("SELECT id FROM players").fetchall()

        for row in existing_players:
            for mode in MODES:
                db.execute("""
                    INSERT OR IGNORE INTO chess_ratings
                    (player_id, mode, elo, wins, losses, draws, games_played)
                    VALUES (?, ?, ?, 0, 0, 0, 0)
                """, (row[0], mode, INITIAL_ELO))


def get_mode_rating(player_id: int, mode: str):
    with db_connect() as db:
        row = db.execute("""
            SELECT elo, wins, losses, draws, games_played
            FROM chess_ratings
            WHERE player_id = ? AND mode = ?
        """, (player_id, mode)).fetchone()

    if not row:
        return {
            "elo": INITIAL_ELO,
            "wins": 0,
            "losses": 0,
            "draws": 0,
            "games_played": 0,
        }

    return {
        "elo": row[0],
        "wins": row[1],
        "losses": row[2],
        "draws": row[3],
        "games_played": row[4],
    }


def ensure_player_ratings(player_id: int):
    with db_connect() as db:
        for mode in MODES:
            db.execute("""
                INSERT OR IGNORE INTO chess_ratings
                (player_id, mode, elo, wins, losses, draws, games_played)
                VALUES (?, ?, ?, 0, 0, 0, 0)
            """, (player_id, mode, INITIAL_ELO))


def get_player(player_id: int):
    with db_connect() as db:
        db.row_factory = sqlite3.Row
        row = db.execute("""
            SELECT id, first_name, last_name, username, photo_url,
                   registered_at, elo, wins, losses, draws, games_played
            FROM players
            WHERE id = ?
        """, (player_id,)).fetchone()

    if not row:
        return None

    player = dict(row)
    ensure_player_ratings(player_id)

    ratings = {}

    for mode, config in MODES.items():
        stats = get_mode_rating(player_id, mode)
        stats.update(get_rank(stats["elo"]))
        stats["mode_name"] = config["name"]
        ratings[mode] = stats

    player["mode_ratings"] = ratings

    # Legacy fields remain for old front-end compatibility.
    player.update(get_rank(player["elo"]))

    return player


# ==========================================
# TELEGRAM AUTH
# ==========================================

def verify_telegram_data(init_data: str):
    token = os.getenv("BOT_TOKEN")

    if not token:
        raise HTTPException(status_code=500, detail="BOT_TOKEN is not configured")

    try:
        data = dict(parse_qsl(init_data))
        received_hash = data.pop("hash")

        check_string = "\n".join(
            f"{key}={value}"
            for key, value in sorted(data.items())
        )

        secret_key = hmac.new(
            b"WebAppData",
            token.encode(),
            hashlib.sha256,
        ).digest()

        calculated_hash = hmac.new(
            secret_key,
            check_string.encode(),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(calculated_hash, received_hash):
            raise ValueError("Invalid hash")

        auth_date = int(data["auth_date"])

        if time.time() - auth_date > 86400 or auth_date > time.time() + 60:
            raise ValueError("Expired auth")

        return json.loads(data["user"])

    except (ValueError, KeyError, TypeError):
        raise HTTPException(status_code=403, detail="Invalid Telegram data")


@app.on_event("startup")
async def startup():
    init_db()


@app.get("/")
async def home():
    return {
        "status": "REQUIEM API ONLINE",
        "version": "3.0",
        "modes": MODES,
    }


# ==========================================
# REGISTER
# ==========================================

@app.post("/api/register")
async def register(request: Request):
    body = await request.json()
    user = verify_telegram_data(body.get("initData", ""))

    with db_connect() as db:
        db.execute("""
            INSERT INTO players (
                id, first_name, last_name, username, photo_url,
                registered_at, elo, wins, losses, draws, games_played
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0)
            ON CONFLICT(id) DO UPDATE SET
                first_name = excluded.first_name,
                last_name = excluded.last_name,
                username = excluded.username,
                photo_url = excluded.photo_url
        """, (
            user["id"],
            user.get("first_name", ""),
            user.get("last_name", ""),
            user.get("username", ""),
            user.get("photo_url", ""),
            int(time.time()),
            INITIAL_ELO,
        ))

    ensure_player_ratings(user["id"])

    return {
        "success": True,
        "player_id": user["id"],
        "player": get_player(user["id"]),
    }


# ==========================================
# PROFILE
# ==========================================

@app.get("/api/player/{player_id}")
async def player_profile(player_id: int):
    player = get_player(player_id)

    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    return {"success": True, "player": player}


@app.get("/api/player/{player_id}/rating/{mode}")
async def player_mode_rating(player_id: int, mode: str):
    if mode not in MODES:
        raise HTTPException(status_code=400, detail="Unknown mode")

    player = get_player(player_id)

    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    return {
        "success": True,
        "player": player,
        "mode": mode,
        "rating": player["mode_ratings"][mode],
    }


# ==========================================
# PLAYER LIST
# ==========================================

@app.get("/api/players")
async def players():
    with db_connect() as db:
        db.row_factory = sqlite3.Row
        rows = db.execute("""
            SELECT *
            FROM players
            ORDER BY registered_at DESC
        """).fetchall()

    return {"players": [get_player(row["id"]) for row in rows]}


# ==========================================
# LEADERBOARD
# ==========================================

@app.get("/api/leaderboard")
async def leaderboard(mode: str = "blitz"):
    if mode not in MODES:
        raise HTTPException(status_code=400, detail="Unknown mode")

    with db_connect() as db:
        db.row_factory = sqlite3.Row
        rows = db.execute("""
            SELECT
                p.id, p.first_name, p.last_name, p.username, p.photo_url,
                r.elo, r.wins, r.losses, r.draws, r.games_played
            FROM players p
            JOIN chess_ratings r ON r.player_id = p.id
            WHERE r.mode = ?
            ORDER BY r.elo DESC, r.wins DESC
            LIMIT 100
        """, (mode,)).fetchall()

    result = []

    for row in rows:
        player = dict(row)
        player.update(get_rank(player["elo"]))
        player["mode"] = mode
        player["mode_name"] = MODES[mode]["name"]
        result.append(player)

    return {
        "mode": mode,
        "mode_name": MODES[mode]["name"],
        "leaderboard": result,
    }


# ==========================================
# ROOM STATE
# ==========================================

chess_rooms = {}


def get_chess_state(room):
    white_id = room["players"]["white"]
    black_id = room["players"]["black"]

    white_player = get_player(white_id) if white_id else None
    black_player = get_player(black_id) if black_id else None

    now = time.monotonic()

    clocks = dict(room["clocks"])

    if room["started"] and not room["finished"]:
        active = "white" if room["board"].turn else "black"

        if room["last_clock_update"]:
            elapsed = max(0, now - room["last_clock_update"])
            clocks[active] = max(0, clocks[active] - elapsed)

    return {
        "type": "state",
        "room_id": room["room_id"],
        "mode": room["mode"],
        "mode_name": MODES[room["mode"]]["name"],
        "initial_time": room["initial_time"],
        "fen": room["board"].fen(),
        "turn": "white" if room["board"].turn else "black",
        "players": {
            "white": white_id,
            "black": black_id,
        },
        "profiles": {
            "white": white_player,
            "black": black_player,
        },
        "clocks": {
            "white": round(max(0, clocks["white"]), 1),
            "black": round(max(0, clocks["black"]), 1),
        },
        "started": room["started"],
        "game_over": room["finished"] or room["board"].is_game_over(claim_draw=True),
        "result": room["result"] or room["board"].result(claim_draw=True),
    }


async def broadcast_chess(room):
    state = get_chess_state(room)

    for socket in list(room["sockets"].values()):
        if socket:
            try:
                await socket.send_json(state)
            except Exception:
                pass


# ==========================================
# ELO
# ==========================================

def calculate_elo(white_elo, black_elo, result):
    expected_white = 1 / (
        1 + 10 ** ((black_elo - white_elo) / 400)
    )
    expected_black = 1 - expected_white

    if result == "1-0":
        score_white, score_black = 1, 0
    elif result == "0-1":
        score_white, score_black = 0, 1
    else:
        score_white, score_black = 0.5, 0.5

    new_white = max(
        MIN_ELO,
        round(white_elo + K_FACTOR * (score_white - expected_white)),
    )

    new_black = max(
        MIN_ELO,
        round(black_elo + K_FACTOR * (score_black - expected_black)),
    )

    return new_white, new_black


def update_match_rating(room, result):
    white_id = room["players"]["white"]
    black_id = room["players"]["black"]
    mode = room["mode"]

    if not black_id or room["rating_updated"]:
        return

    with db_connect() as db:
        white_row = db.execute("""
            SELECT elo FROM chess_ratings WHERE player_id = ? AND mode = ?
        """, (white_id, mode)).fetchone()

        black_row = db.execute("""
            SELECT elo FROM chess_ratings WHERE player_id = ? AND mode = ?
        """, (black_id, mode)).fetchone()

        if not white_row or not black_row:
            return

        white_elo, black_elo = white_row[0], black_row[0]
        new_white, new_black = calculate_elo(white_elo, black_elo, result)

        ww = int(result == "1-0")
        wl = int(result == "0-1")
        wd = int(result == "1/2-1/2")

        bw = int(result == "0-1")
        bl = int(result == "1-0")
        bd = int(result == "1/2-1/2")

        db.execute("""
            UPDATE chess_ratings
            SET elo = ?, wins = wins + ?, losses = losses + ?,
                draws = draws + ?, games_played = games_played + 1
            WHERE player_id = ? AND mode = ?
        """, (new_white, ww, wl, wd, white_id, mode))

        db.execute("""
            UPDATE chess_ratings
            SET elo = ?, wins = wins + ?, losses = losses + ?,
                draws = draws + ?, games_played = games_played + 1
            WHERE player_id = ? AND mode = ?
        """, (new_black, bw, bl, bd, black_id, mode))

        # Legacy aggregate counters for older front-end parts.
        db.execute("""
            UPDATE players
            SET wins = wins + ?, losses = losses + ?,
                draws = draws + ?, games_played = games_played + 1
            WHERE id = ?
        """, (ww, wl, wd, white_id))

        db.execute("""
            UPDATE players
            SET wins = wins + ?, losses = losses + ?,
                draws = draws + ?, games_played = games_played + 1
            WHERE id = ?
        """, (bw, bl, bd, black_id))

    room["rating_updated"] = True


# ==========================================
# FINISH GAME
# ==========================================

def finish_room(room, result):
    if room["finished"]:
        return

    room["finished"] = True
    room["result"] = result
    room["last_clock_update"] = None

    update_match_rating(room, result)

    if room.get("timer_task"):
        room["timer_task"].cancel()
        room["timer_task"] = None


async def timer_loop(room):
    try:
        while not room["finished"] and room["started"]:
            await asyncio.sleep(1)

            async with room["lock"]:
                if room["finished"] or not room["started"]:
                    break

                now = time.monotonic()
                active = "white" if room["board"].turn else "black"

                if room["last_clock_update"]:
                    elapsed = now - room["last_clock_update"]
                    room["clocks"][active] -= elapsed

                room["last_clock_update"] = now

                if room["clocks"][active] <= 0:
                    room["clocks"][active] = 0

                    winner = "black" if active == "white" else "white"

                    winner_color = chess.BLACK if winner == "black" else chess.WHITE

                    # Timeout is a draw if the opponent cannot possibly mate.
                    if room["board"].is_insufficient_material(winner_color):
                        finish_room(room, "1/2-1/2")
                    else:
                        finish_room(
                            room,
                            "0-1" if active == "white" else "1-0"
                        )

                await broadcast_chess(room)

    except asyncio.CancelledError:
        pass
    except Exception as error:
        print("Timer error:", error)


# ==========================================
# CREATE ROOM
# ==========================================

@app.post("/api/chess/create")
async def create_chess_room(request: Request):
    body = await request.json()
    user = verify_telegram_data(body.get("initData", ""))

    mode = body.get("mode", "blitz")

    if mode not in MODES:
        raise HTTPException(status_code=400, detail="Invalid chess mode")

    player = get_player(user["id"])

    if not player:
        raise HTTPException(status_code=404, detail="Register player first")

    ensure_player_ratings(user["id"])

    room_id = uuid.uuid4().hex[:6].upper()
    initial_time = MODES[mode]["seconds"]

    chess_rooms[room_id] = {
        "room_id": room_id,
        "mode": mode,
        "initial_time": initial_time,
        "board": chess.Board(),
        "players": {
            "white": user["id"],
            "black": None,
        },
        "sockets": {
            "white": None,
            "black": None,
        },
        "clocks": {
            "white": float(initial_time),
            "black": float(initial_time),
        },
        "started": False,
        "finished": False,
        "result": None,
        "rating_updated": False,
        "last_clock_update": None,
        "timer_task": None,
        "lock": asyncio.Lock(),
    }

    return {
        "success": True,
        "room_id": room_id,
        "color": "white",
        "mode": mode,
        "mode_name": MODES[mode]["name"],
        "initial_time": initial_time,
        "player": player,
    }


# ==========================================
# WEBSOCKET GAME
# ==========================================

@app.websocket("/ws/chess/{room_id}")
async def chess_websocket(websocket: WebSocket, room_id: str, initData: str):
    room = chess_rooms.get(room_id)

    if not room:
        await websocket.close(code=1008)
        return

    try:
        user = verify_telegram_data(initData)
    except HTTPException:
        await websocket.close(code=1008)
        return

    player_id = user["id"]

    async with room["lock"]:
        if room["players"]["white"] == player_id:
            color = "white"
        elif room["players"]["black"] == player_id:
            color = "black"
        elif room["players"]["black"] is None:
            room["players"]["black"] = player_id
            color = "black"
        else:
            await websocket.close(code=1008)
            return

        room["sockets"][color] = websocket

        # Start clocks only when both players have connected.
        if (
            room["players"]["white"] is not None
            and room["players"]["black"] is not None
            and not room["started"]
            and not room["finished"]
        ):
            room["started"] = True
            room["last_clock_update"] = time.monotonic()
            room["timer_task"] = asyncio.create_task(timer_loop(room))

    await websocket.accept()

    await websocket.send_json({
        "type": "connected",
        "color": color,
        **get_chess_state(room),
    })

    await broadcast_chess(room)

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") != "move":
                continue

            async with room["lock"]:
                if room["finished"]:
                    continue

                if not room["started"]:
                    await websocket.send_json({
                        "error": "Waiting for second player"
                    })
                    continue

                board = room["board"]

                correct_turn = board.turn == (color == "white")

                if not correct_turn:
                    await websocket.send_json({"error": "Not your turn"})
                    continue

                # Supports both UCI and old front-end from/to format.
                move_text = data.get("move")

                if not move_text and data.get("from") and data.get("to"):
                    move_text = (
                        data["from"]
                        + data["to"]
                        + (data.get("promotion") or "")
                    )

                try:
                    move = chess.Move.from_uci(move_text or "")
                except ValueError:
                    await websocket.send_json({"error": "Invalid move"})
                    continue

                if move not in board.legal_moves:
                    await websocket.send_json({"error": "Illegal move"})
                    continue

                # Deduct time for the player who is moving.
                now = time.monotonic()
                active = color

                if room["last_clock_update"]:
                    elapsed = now - room["last_clock_update"]
                    room["clocks"][active] -= elapsed

                room["last_clock_update"] = now

                if room["clocks"][active] <= 0:
                    room["clocks"][active] = 0

                    winner = "black" if active == "white" else "white"
                    winner_color = chess.BLACK if winner == "black" else chess.WHITE

                    if board.is_insufficient_material(winner_color):
                        finish_room(room, "1/2-1/2")
                    else:
                        finish_room(
                            room,
                            "0-1" if active == "white" else "1-0"
                        )

                    await broadcast_chess(room)
                    continue

                board.push(move)

                if board.is_game_over(claim_draw=True):
                    finish_room(room, board.result(claim_draw=True))
                else:
                    room["last_clock_update"] = time.monotonic()

            await broadcast_chess(room)

    except Exception as error:
        # Disconnects do not automatically end the game.
        print(f"WebSocket {room_id} ({color}) closed:", error)

    finally:
        async with room["lock"]:
            if room["sockets"].get(color) == websocket:
                room["sockets"][color] = None
