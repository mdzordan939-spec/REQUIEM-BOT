from fastapi import FastAPI

app = FastAPI(title="REQUIEM API")


@app.get("/")
async def home():
    return {"status": "REQUIEM API ONLINE"}


@app.get("/api/players")
async def players():
    return {"players": []}