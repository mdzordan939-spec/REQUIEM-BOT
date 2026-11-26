
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

from fastapi import (
    FastAPI,
    HTTPException,
    Request,
    WebSocket,
    WebSocketDisconnect
)

from fastapi.middleware.cors import CORSMiddleware


# ==========================================
# REQUIEM CONFIG
# ==========================================

app = FastAPI(title="REQUIEM API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://mdzordan939-spec.github.io"
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

DB_PATH = "players.db"

INITIAL_ELO = 1000
MIN_ELO = 100
K_FACTOR = 32


# ==========================================
# REQUIEM RANK SYSTEM
# ==========================================

RANKS = [
    {
        "key": "INITIATE",
        "name": "INITIATE",
        "min": 0,
        "max": 499,
        "number": 1
    },
    {
        "key": "RECRUIT",
        "name": "RECRUIT",
        "min": 500,
        "max": 799,
        "number": 2
    },
    {
        "key": "HUNTER",
        "name": "HUNTER",
        "min": 800,
        "max": 1099,
        "number": 3
    },
    {
        "key": "EXECUTIONER",
        "name": "EXECUTIONER",
        "min": 1100,
        "max": 1399,
        "number": 4
    },
    {
        "key": "REAPER",
        "name": "REAPER",
        "min": 1400,
        "max": 1699,
        "number": 5
    },
    {
        "key": "PHANTOM",
        "name": "PHANTOM",
        "min": 1700,
        "max": 1999,
        "number": 6
    },
    {
        "key": "REQUIEM",
        "name": "REQUIEM",
        "min": 2000,
        "max": None,
        "number": 7
    }
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
            "progress": 100
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
        "progress": round(min(100, progress), 1)
    }


# ==========================================
# DATABASE
# ==========================================

def init_db():
    with sqlite3.connect(DB_PATH) as db:

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
            for row in db.execute(
                "PRAGMA table_info(players)"
            ).fetchall()
        }

        new_columns = {
            "elo": "INTEGER DEFAULT 1000",
            "wins": "INTEGER DEFAULT 0",
            "losses": "INTEGER DEFAULT 0",
            "draws": "INTEGER DEFAULT 0",
            "games_played": "INTEGER DEFAULT 0"
        }

        for name, definition in new_columns.items():
            if name not in columns:
                db.execute(
                    f"ALTER TABLE players ADD COLUMN {name} {definition}"
                )


def get_player(player_id: int):
    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row

        row = db.execute("""
            SELECT
                id,
                first_name,
                last_name,
                username,
                photo_url,
                registered_at,
                elo,
                wins,
                losses,
                draws,
                games_played
            FROM players
            WHERE id = ?
        """, (player_id,)).fetchone()

    if not row:
        return None

    player = dict(row)
    player.update(get_rank(player["elo"]))

    return player


# ==========================================
# TELEGRAM AUTHENTICATION
# ==========================================

def verify_telegram_data(init_data: str):

    token = os.getenv("BOT_TOKEN")

    if not token:
        raise HTTPException(
            status_code=500,
            detail="BOT_TOKEN is not configured"
        )

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
            hashlib.sha256
        ).digest()

        calculated_hash = hmac.new(
            secret_key,
            check_string.encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(
            calculated_hash,
            received_hash
        ):
            raise ValueError()

        auth_date = int(data["auth_date"])

        if (
            time.time() - auth_date > 86400
            or auth_date > time.time() + 60
        ):
            raise ValueError()

        return json.loads(data["user"])

    except (
        ValueError,
        KeyError,
        TypeError
    ):
        raise HTTPException(
            status_code=403,
            detail="Invalid Telegram data"
        )


# ==========================================
# PLAYER REGISTRATION
# ==========================================

@app.on_event("startup")
async def startup():
    init_db()


@app.get("/")
async def home():
    return {
        "status": "REQUIEM API ONLINE",
        "version": "2.0"
    }


@app.post("/api/register")
async def register(request: Request):

    body = await request.json()

    user = verify_telegram_data(
        body.get("initData", "")
    )

    with sqlite3.connect(DB_PATH) as db:

        db.execute("""
            INSERT INTO players (
                id,
                first_name,
                last_name,
                username,
                photo_url,
                registered_at,
                elo,
                wins,
                losses,
                draws,
                games_played
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
            INITIAL_ELO
        ))

    return {
        "success": True,
        "player_id": user["id"]
    }


# ==========================================
# PLAYER PROFILE
# ==========================================

@app.get("/api/player/{player_id}")
async def player_profile(player_id: int):

    player = get_player(player_id)

    if not player:
        raise HTTPException(
            status_code=404,
            detail="Player not found"
        )

    return {
        "success": True,
        "player": player
    }


# ==========================================
# PLAYERS
# ==========================================

@app.get("/api/players")
async def players():

    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row

        rows = db.execute("""
            SELECT *
            FROM players
            ORDER BY registered_at DESC
        """).fetchall()

    result = []

    for row in rows:
        player = dict(row)
        player.update(get_rank(player["elo"]))
        result.append(player)

    return {
        "players": result
    }


# ==========================================
# LEADERBOARD
# ==========================================

@app.get("/api/leaderboard")
async def leaderboard():

    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row

        rows = db.execute("""
            SELECT
                id,
                first_name,
                last_name,
                username,
                photo_url,
                elo,
                wins,
                losses,
                draws,
                games_played
            FROM players
            ORDER BY elo DESC, wins DESC
            LIMIT 100
        """).fetchall()

    result = []

    for row in rows:
        player = dict(row)
        player.update(get_rank(player["elo"]))
        result.append(player)

    return {
        "leaderboard": result
    }


# ==========================================
# ONLINE CHESS
# ==========================================

chess_rooms = {}


def get_chess_state(room):

    white_id = room["players"]["white"]
    black_id = room["players"]["black"]

    white_player = get_player(white_id)
    black_player = (
        get_player(black_id)
        if black_id else None
    )

    return {
        "fen": room["board"].fen(),

        "turn": (
            "white"
            if room["board"].turn
            else "black"
        ),

        "players": {
            "white": white_id,
            "black": black_id
        },

        "profiles": {
            "white": white_player,
            "black": black_player
        },

        "game_over": room["board"].is_game_over(
            claim_draw=True
        ),

        "result": room["board"].result(
            claim_draw=True
        )
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
# RATING CALCULATION
# ==========================================

def calculate_elo(
    white_elo: int,
    black_elo: int,
    result: str
):

    expected_white = 1 / (
        1 + 10 ** (
            (black_elo - white_elo) / 400
        )
    )

    expected_black = 1 - expected_white

    if result == "1-0":
        score_white = 1
        score_black = 0

    elif result == "0-1":
        score_white = 0
        score_black = 1

    else:
        score_white = 0.5
        score_black = 0.5

    new_white = max(
        MIN_ELO,
        round(
            white_elo + K_FACTOR * (
                score_white - expected_white
            )
        )
    )

    new_black = max(
        MIN_ELO,
        round(
            black_elo + K_FACTOR * (
                score_black - expected_black
            )
        )
    )

    return new_white, new_black


def update_match_rating(room, result):

    white_id = room["players"]["white"]
    black_id = room["players"]["black"]

    if black_id is None:
        return

    with sqlite3.connect(DB_PATH) as db:

        white_row = db.execute(
            "SELECT elo FROM players WHERE id = ?",
            (white_id,)
        ).fetchone()

        black_row = db.execute(
            "SELECT elo FROM players WHERE id = ?",
            (black_id,)
        ).fetchone()

        if not white_row or not black_row:
            return

        white_elo = white_row[0]
        black_elo = black_row[0]

        new_white, new_black = calculate_elo(
            white_elo,
            black_elo,
            result
        )

        white_wins = int(result == "1-0")
        white_losses = int(result == "0-1")
        white_draws = int(result == "1/2-1/2")

        black_wins = int(result == "0-1")
        black_losses = int(result == "1-0")
        black_draws = int(result == "1/2-1/2")

        db.execute("""
            UPDATE players
            SET
                elo = ?,
                wins = wins + ?,
                losses = losses + ?,
                draws = draws + ?,
                games_played = games_played + 1
            WHERE id = ?
        """, (
            new_white,
            white_wins,
            white_losses,
            white_draws,
            white_id
        ))

        db.execute("""
            UPDATE players
            SET
                elo = ?,
                wins = wins + ?,
                losses = losses + ?,
                draws = draws + ?,
                games_played = games_played + 1
            WHERE id = ?
        """, (
            new_black,
            black_wins,
            black_losses,
            black_draws,
            black_id
        ))

    room["rating_updated"] = True


# ==========================================
# CREATE ROOM
# ==========================================

@app.post("/api/chess/create")
async def create_chess_room(request: Request):

    body = await request.json()

    user = verify_telegram_data(
        body.get("initData", "")
    )

    player = get_player(user["id"])

    if not player:
        raise HTTPException(
            status_code=404,
            detail="Register player first"
        )

    room_id = uuid.uuid4().hex[:6].upper()

    chess_rooms[room_id] = {
        "board": chess.Board(),

        "players": {
            "white": user["id"],
            "black": None
        },

        "sockets": {
            "white": None,
            "black": None
        },

        "finished": False,
        "rating_updated": False,
        "lock": asyncio.Lock()
    }

    return {
        "success": True,
        "room_id": room_id,
        "color": "white",
        "player": player
    }


# ==========================================
# JOIN / PLAY CHESS
# ==========================================

@app.websocket("/ws/chess/{room_id}")
async def chess_websocket(
    websocket: WebSocket,
    room_id: str,
    initData: str
):

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

    await websocket.accept()

    await websocket.send_json({
        "type": "connected",
        "color": color,
        **get_chess_state(room)
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

                board = room["board"]

                correct_turn = (
                    board.turn == (color == "white")
                )

                if not correct_turn:

                    await websocket.send_json({
                        "error": "Not your turn"
                    })

                    continue

                try:

                    move = chess.Move.from_uci(
                        data.get("move", "")
                    )

                except ValueError:

                    await websocket.send_json({
                        "error": "Invalid move"
                    })

                    continue

                if move not in board.legal_moves:

                    await websocket.send_json({
                        "error": "Illegal move"
                    })

                    continue

                board.push(move)

                if board.is_game_over(claim_draw=True):

                    room["finished"] = True

                    result = board.result(
                        claim_draw=True
                    )

                    if not room["rating_updated"]:
                        update_match_rating(room, result)

            await broadcast_chess(room)

    except WebSocketDisconnect:

        async with room["lock"]:

            if room["sockets"].get(color) == websocket:
                room["sockets"][color] = None

    except Exception:

        async with room["lock"]:

            if room["sockets"].get(color) == websocket:
                room["sockets"][color] = None
