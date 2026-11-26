const tg=window.Telegram?.WebApp;if(tg){tg.ready();tg.expand();tg.setHeaderColor?.('#080808');tg.setBackgroundColor?.('#080808')}const user=tg?.initDataUnsafe?.user;if(user?.first_name)document.getElementById('username').textContent=[user.first_name,user.last_name].filter(Boolean).join(' ');const toast=document.getElementById('toast');let toastTimer;function showToast(text){toast.textContent=text;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),1800)}const labels={home:'Главная',collection:'Коллекция',games:'Игры',rating:'Рейтинг',tasks:'Задания',profile:'Профиль',crystals:'Кристаллы',bonus:'Ежедневный бонус'};document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>{const page=el.dataset.page;document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page));showToast(labels[page]||page);if(tg?.HapticFeedback)tg.HapticFeedback.selectionChanged()}));document.getElementById('settings').addEventListener('click',()=>showToast('Настройки — добавим следующим этапом'));
const API_URL = "https://requiem-bot-7eyu.onrender.com";

async function loadPlayers() {
    try {
        const response = await fetch(`${API_URL}/api/players`);
        const data = await response.json();

        console.log("REQUIEM PLAYERS:", data.players);
    } catch (error) {
        console.error("REQUIEM API ERROR:", error);
    }
}

loadPlayers();