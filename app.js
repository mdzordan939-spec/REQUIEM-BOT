const tg=window.Telegram?.WebApp;if(tg){tg.ready();tg.expand();tg.setHeaderColor?.('#080808');tg.setBackgroundColor?.('#080808')}const user=tg?.initDataUnsafe?.user;if(user?.first_name)document.getElementById('username').textContent=[user.first_name,user.last_name].filter(Boolean).join(' ');const toast=document.getElementById('toast');let toastTimer;function showToast(text){toast.textContent=text;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),1800)}const labels={home:'Главная',collection:'Коллекция',games:'Игры',rating:'Рейтинг',tasks:'Задания',profile:'Профиль',crystals:'Кристаллы',bonus:'Ежедневный бонус'};document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>{const page=el.dataset.page;document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page));showToast(labels[page]||page);if(tg?.HapticFeedback)tg.HapticFeedback.selectionChanged()}));document.getElementById('settings').addEventListener('click',()=>showToast('Настройки — добавим следующим этапом'));
const API_URL = "https://requiem-bot-7eyu.onrender.com";
async function loadPlayers() {
    try {
        const response = await fetch(`${API_URL}/api/players`);
        const data = await response.json();

       console.log("REQUIEM PLAYERS:", data.players);

const ratingList = document.getElementById("ratingList");

if (ratingList) {
    ratingList.innerHTML = "";

    data.players.forEach((player, index) => {
        const card = document.createElement("div");
        card.className = "rating-player";

        const name = [player.first_name, player.last_name]
            .filter(Boolean)
            .join(" ") || player.username || "Игрок";

        card.innerHTML = `
            <div class="rating-place">${index + 1}</div>
            <img class="rating-avatar" src="${player.photo_url || ""}" onerror="this.style.display='none'">
            <div class="rating-info">
                <strong>${name}</strong>
                <small>${player.username ? "@" + player.username : "Игрок REQUIEM"}</small>
            </div>
        `;

        ratingList.appendChild(card);
    });
}
const ratingList = document.getElementById("ratingList");

if (ratingList) {
    ratingList.innerHTML = "";

    data.players.forEach((player, index) => {
        const card = document.createElement("div");
        card.className = "rating-player";

        const name = [player.first_name, player.last_name]
            .filter(Boolean)
            .join(" ") || player.username || "Игрок";

        card.innerHTML = `
            <div class="rating-place">${index + 1}</div>
            <img class="rating-avatar" src="${player.photo_url || ""}" onerror="this.style.display='none'">
            <div class="rating-info">
                <strong>${name}</strong>
                <small>${player.username ? "@" + player.username : "Игрок REQUIEM"}</small>
            </div>
        `;

        ratingList.appendChild(card);
    });
    } catch (error) {
        console.error("REQUIEM API ERROR:", error);
    }
}

async function registerPlayer() {
    if (!tg?.initData) {
        console.warn("Открой REQUIEM через Telegram");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                initData: tg.initData
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log("REQUIEM REGISTRATION:", result);

        await loadPlayers();
    } catch (error) {
        console.error("REGISTRATION ERROR:", error);
    }
}

registerPlayer();

loadPlayers();
