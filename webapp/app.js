
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor("#080808");
    tg.setBackgroundColor("#080808");
}

// Сохранение данных
const STORAGE_KEY = "requiem_player_v1";

const defaultData = {
    crystals: 250,
    xp: 0,
    lastDaily: null
};

let data = loadData();

function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? { ...defaultData, ...JSON.parse(saved) } : { ...defaultData };
    } catch {
        return { ...defaultData };
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Система уровней
function getLevel() {
    return Math.floor(data.xp / 100) + 1;
}

function getLevelXP() {
    return data.xp % 100;
}

// Обновление интерфейса
function render() {
    const level = getLevel();
    const currentXP = getLevelXP();

    document.getElementById("crystals").textContent = data.crystals;
    document.getElementById("level").textContent = level;
    document.querySelector(".level").textContent = String(level).padStart(2, "0");
    document.querySelector(".rank").textContent = `NOVICE · LVL ${level}`;
    document.getElementById("xp-text").textContent = `${currentXP} / 100 XP`;
    document.getElementById("xp-fill").style.width = `${currentXP}%`;

    const dailyButton = document.getElementById("daily-button");

    if (data.lastDaily === getToday()) {
        dailyButton.textContent = "ПОЛУЧЕНО";
        dailyButton.disabled = true;
    } else {
        dailyButton.textContent = "ЗАБРАТЬ";
        dailyButton.disabled = false;
    }
}

// Дата по местному времени
function getToday() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

// Уведомление
function toast(message) {
    let element = document.getElementById("requiem-toast");

    if (!element) {
        element = document.createElement("div");
        element.id = "requiem-toast";

        Object.assign(element.style, {
            position: "fixed",
            bottom: "95px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#191919",
            border: "1px solid #333",
            color: "#eee",
            padding: "13px 18px",
            borderRadius: "10px",
            fontSize: "12px",
            zIndex: "100",
            textAlign: "center",
            maxWidth: "90%",
            transition: "opacity .2s"
        });

        document.body.appendChild(element);
    }

    element.textContent = message;
    element.style.opacity = "1";

    clearTimeout(element.hideTimer);
    element.hideTimer = setTimeout(() => {
        element.style.opacity = "0";
    }, 2200);
}

// Ежедневная награда
document.getElementById("daily-button").addEventListener("click", () => {
    if (data.lastDaily === getToday()) {
        toast("Ты уже получил награду сегодня");
        return;
    }

    data.crystals += 50;
    data.xp += 25;
    data.lastDaily = getToday();

    saveData();
    render();

    toast(" +50 CRYSTALS  /  +25 XP");
});

// Разделы интерфейса
document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
        const page = button.dataset.page;

        if (page === "home") {
            toast("REQUIEM SYSTEM · HOME");
            return;
        }

        toast(`${page.toUpperCase()} · Скоро доступно`);

        if (tg?.HapticFeedback) {
            tg.HapticFeedback.selectionChanged();
        }
    });
});

// Первоначальный запуск
render();

console.log("REQUIEM SYSTEM INITIALIZED");
