# 💕 Duo Viewer — GitHub Pages Deploy

Никакой регистрации для пользователей. Бесплатно навсегда.

---

## 🚀 Деплой за 4 шага

### 1. Создай репозиторий на GitHub
[github.com/new](https://github.com/new) → название: `duo-viewer` → Public → Create

### 2. Загрузи файлы
```bash
git clone https://github.com/ТВОЙник/duo-viewer
# скопируй все файлы этой папки в репозиторий
cd duo-viewer
git add .
git commit -m "init"
git push
```

### 3. Включи GitHub Pages
Репозиторий → **Settings** → **Pages** → Source: `gh-pages` branch → Save

### 4. Подожди 1-2 минуты
Сайт будет доступен по адресу:
```
https://ТВОЙник.github.io/duo-viewer/
```

**Всё.** При каждом `git push` GitHub сам пересобирает и деплоит.

---

## 📱 Подключить к Telegram-боту

```
@BotFather → /setmenubutton
→ URL: https://ТВОЙник.github.io/duo-viewer/
→ Текст: Смотреть вместе 💕
```

Секрет бота добавь в:  
Репозиторий → **Settings** → **Secrets** → `VITE_BOT_USERNAME` = имя бота

---

## ⚡ Как работает storage (без сервера)

Используется **Gun.js** — децентрализованная real-time база данных.
- Работает прямо в браузере
- Данные синхронизируются между пользователями напрямую (P2P + relay)
- Не нужен свой сервер
- Бесплатно

Данные автоматически удаляются через 15 минут (TTL в коде).

---

## 🔧 Локальная разработка

```bash
npm install
npm run dev
# открой http://localhost:5173
```

---

## 🆚 Сравнение вариантов хостинга

| | GitHub Pages | Vercel | Netlify |
|---|---|---|---|
| Цена | Бесплатно | Бесплатно | Бесплатно |
| Регистрация | GitHub (у всех есть) | Vercel | Netlify |
| Деплой | git push | git push / CLI | drag & drop |
| Скорость | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| TMA поддержка | ✅ | ✅ | ✅ |
