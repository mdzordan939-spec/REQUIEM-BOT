
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="REQUIEM API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://mdzordan939-spec.github.io"
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/")
async def home():
    return {"status": "REQUIEM API ONLINE"}


@app.get("/api/players")
async def players():
    return {"players": []}
