
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
