
import os
import json
import hmac
import hashlib
import sqlite3
import time

from urllib.parse import parse_qsl
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import uuid

from fastapi import WebSocket, WebSocketDisconnect
import chess
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
                    "ALTER TABLE players ADD COLUMN "
                    + name + " " + definition
                )


def verify_telegram_data(init_data):
    token = os.getenv("BOT_TOKEN")

    if not token:
        raise HTTPException(
            500,
            "BOT_TOKEN is not configured"
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

    except (ValueError, KeyError, TypeError):
        raise HTTPException(
            403,
            "Invalid Telegram data"
        )


@app.on_event("startup")
async def startup():
    init_db()


@app.get("/")
async def home():
    return {"status": "REQUIEM API ONLINE"}


@app.get("/api/players")
async def players():
    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row

        rows = db.execute("""
            SELECT *
            FROM players
            ORDER BY registered_at DESC
        """).fetchall()

    return {
        "players": [dict(row) for row in rows]
    }


@app.get("/api/leaderboard")
async def leaderboard():
    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row

        rows = db.execute("""
            SELECT
                id,
                first_name,
                username,
                elo,
                wins,
                losses,
                draws,
                games_played
            FROM players
            ORDER BY elo DESC, wins DESC
            LIMIT 100
        """).fetchall()

    return {
        "leaderboard": [dict(row) for row in rows]
    }


@app.post("/api/register")
async def register(request: Request):
    body = await request.json()
    init_data = body.get("initData", "")

    user = verify_telegram_data(init_data)

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
            VALUES (?, ?, ?, ?, ?, ?, 1000, 0, 0, 0, 0)

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
            int(time.time())
        ))

    return {
        "success": True,
        "player_id": user["id"]
    }

# ONLINE CHESS

chess_rooms = {}


def get_chess_state(room):
    return {
        "fen": room["board"].fen(),
        "turn": "white" if room["board"].turn else "black",
        "players": {
            "white": room["players"]["white"],
            "black": room["players"]["black"]
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


@app.post("/api/chess/create")
async def create_chess_room(request: Request):
    body = await request.json()
    user = verify_telegram_data(body.get("initData", ""))

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
        "lock": asyncio.Lock()
    }

    return {
        "success": True,
        "room_id": room_id,
        "color": "white"
    }


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

                    result = board.result(claim_draw=True)

                    white_id = room["players"]["white"]
                    black_id = room["players"]["black"]

                    if black_id is not None:
                        with sqlite3.connect(DB_PATH) as db:
                            white_row = db.execute(
                                "SELECT elo FROM players WHERE id = ?",
                                (white_id,)
                            ).fetchone()

                            black_row = db.execute(
                                "SELECT elo FROM players WHERE id = ?",
                                (black_id,)
                            ).fetchone()

                            if white_row and black_row:
                                white_elo = white_row[0]
                                black_elo = black_row[0]

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
                                    100,
                                    round(
                                        white_elo + 32 * (
                                            score_white - expected_white
                                        )
                                    )
                                )

                                new_black = max(
                                    100,
                                    round(
                                        black_elo + 32 * (
                                            score_black - expected_black
                                        )
                                    )
                                )

                                white_stats = (
                                    1 if result == "1-0" else 0,
                                    1 if result == "0-1" else 0,
                                    1 if result == "1/2-1/2" else 0
                                )

                                black_stats = (
                                    1 if result == "0-1" else 0,
                                    1 if result == "1-0" else 0,
                                    1 if result == "1/2-1/2" else 0
                                )

                                db.execute("""
                                    UPDATE players
                                    SET elo = ?,
                                        wins = wins + ?,
                                        losses = losses + ?,
                                        draws = draws + ?,
                                        games_played = games_played + 1
                                    WHERE id = ?
                                """, (
                                    new_white,
                                    *white_stats,
                                    white_id
                                ))

                                db.execute("""
                                    UPDATE players
                                    SET elo = ?,
                                        wins = wins + ?,
                                        losses = losses + ?,
                                        draws = draws + ?,
                                        games_played = games_played + 1
                                    WHERE id = ?
                                """, (
                                    new_black,
                                    *black_stats,
                                    black_id
                                ))

            await broadcast_chess(room)

    except WebSocketDisconnect:
        async with room["lock"]:
            if room["sockets"].get(color) == websocket:
                room["sockets"][color] = None

    except Exception:
        async with room["lock"]:
            if room["sockets"].get(color) == websocket:
                room["sockets"][color] = None
