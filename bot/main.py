import asyncio
import os

from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from dotenv import load_dotenv

load_dotenv(override=True)

TOKEN = os.getenv("BOT_TOKEN")
print("TOKEN загружен:", bool(TOKEN))
print("Длина токена:", len(TOKEN) if TOKEN else 0)
WEBAPP_URL = os.getenv("WEBAPP_URL")
print("АДРЕС MINI APP:", repr(WEBAPP_URL))
print("WEBAPP_URL:", WEBAPP_URL)
if not TOKEN:
    raise RuntimeError("Set BOT_TOKEN in .env")

if not WEBAPP_URL or not WEBAPP_URL.startswith("https://"):
    raise RuntimeError("Set WEBAPP_URL to public HTTPS Mini App URL in .env")

bot = Bot(TOKEN)
dp = Dispatcher()


@dp.message(CommandStart())
async def start(message: Message):
    kb = ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(
                    text="Open REQUIEM BOT",
                    web_app=WebAppInfo(url=WEBAPP_URL)
                )
            ]
        ],
        resize_keyboard=True
    )

    await message.answer(
        "Welcome to REQUIEM BOT. Tap below to open the Mini App.",
        reply_markup=kb
    )


async def main():
    # Удаляем старый webhook, который конфликтует с polling
    await bot.delete_webhook()

    print("REQUIEM BOT is starting...")

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())