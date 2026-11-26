document.addEventListener('DOMContentLoaded', () => {

    const tg = window.Telegram?.WebApp;

    if (tg) {
        tg.ready();
        tg.expand();
        tg.setHeaderColor?.('#080808');
        tg.setBackgroundColor?.('#080808');
    }

    const user = tg?.initDataUnsafe?.user;

    if (user?.first_name) {
        const usernameEl = document.getElementById('username');

        if (usernameEl) {
            usernameEl.textContent = [
                user.first_name,
                user.last_name
            ].filter(Boolean).join(' ');
        }
    }

    const toast = document.getElementById('toast');
    let toastTimer;

    function showToast(message) {
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add('show');

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 1800);
    }

    const labels = {
        home: 'Главная',
        collection: 'Коллекция',
        games: 'Игры',
        rating: 'Рейтинг',
        tasks: 'Задания',
        profile: 'Профиль',
        crystals: 'Кристаллы',
        bonus: 'Ежедневный бонус'
    };

    // НАВИГАЦИЯ

    document.querySelectorAll('[data-page]').forEach(el => {
        el.addEventListener('click', () => {
            const page = el.dataset.page;

            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.toggle(
                    'active',
                    item.dataset.page === page
                );
            });

            const ratingSection = document.getElementById('ratingSection');

            if (ratingSection) {
                ratingSection.style.display =
                    page === 'rating' ? 'block' : 'none';
            }

            if (page === 'rating' && ratingSection) {
                ratingSection.scrollIntoView({
                    behavior: 'smooth'
                });
            } else {
                showToast(labels[page] || page);
            }

            tg?.HapticFeedback?.selectionChanged();
        });
    });

    // НАСТРОЙКИ

    const settingsButton = document.getElementById('settings');

    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            showToast('Настройки — добавим следующим этапом');
        });
    }

    // API

    const API_URL = 'https://requiem-bot-7eyu.onrender.com';

    // ЗАГРУЗКА РЕЙТИНГА

    async function loadPlayers() {
        try {
            const response = await fetch(API_URL + '/api/players');

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            const data = await response.json();

            console.log('REQUIEM PLAYERS:', data.players);

            const ratingList = document.getElementById('ratingList');

            if (!ratingList) return;

            ratingList.innerHTML = '';

            const players = Array.isArray(data.players)
                ? data.players
                : [];

            players.forEach((player, index) => {
                const card = document.createElement('div');
                card.className = 'rating-player';

                const name = [
                    player.first_name,
                    player.last_name
                ].filter(Boolean).join(' ')
                    || player.username
                    || 'Игрок';

                const place = document.createElement('div');
                place.className = 'rating-place';
                place.textContent = index + 1;

                const avatar = document.createElement('img');
                avatar.className = 'rating-avatar';

                if (player.photo_url) {
                    avatar.src = player.photo_url;
                } else {
                    avatar.style.display = 'none';
                }

                avatar.onerror = () => {
                    avatar.style.display = 'none';
                };

                const info = document.createElement('div');
                info.className = 'rating-info';

                const playerName = document.createElement('strong');
                playerName.textContent = name;

                const playerUsername = document.createElement('small');
                playerUsername.textContent = player.username
                    ? '@' + player.username
                    : 'Игрок REQUIEM';

                info.appendChild(playerName);
                info.appendChild(playerUsername);

                card.appendChild(place);
                card.appendChild(avatar);
                card.appendChild(info);

                ratingList.appendChild(card);
            });

            if (players.length === 0) {
                ratingList.textContent = 'Пока игроков нет';
            }

        } catch (error) {
            console.error('REQUIEM API ERROR:', error);
        }
    }

    // РЕГИСТРАЦИЯ

    async function registerPlayer() {
        if (!tg?.initData) {
            console.warn('Открой REQUIEM через Telegram');
            await loadPlayers();
            return;
        }

        try {
            const response = await fetch(API_URL + '/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    initData: tg.initData
                })
            });

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            const result = await response.json();

            console.log('REQUIEM REGISTRATION:', result);

            await loadPlayers();

        } catch (error) {
            console.error('REGISTRATION ERROR:', error);
            await loadPlayers();
        }
    }

    registerPlayer();

});
