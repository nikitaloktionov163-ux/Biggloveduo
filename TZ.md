# Duo Viewer 💕 — Техническое задание для Cursor AI
> Romantic Telegram Mini App · v10 · 2026

---

## 1. Обзор проекта

**Duo Viewer** — Telegram Mini App исключительно для двух человек (пары). Приватное синхронизированное пространство: живые реакции, вибрации, поцелуй-таймер, голосовые сообщения, чат.

**Основной контент:** счётчик дней вместе, календарь важных дат, воспоминания, мечты, список желаний, путешествия, обещания.

---

## 2. Технический стек

- React + Vite — весь код в одном файле: `src/App.jsx`
- Деплой: GitHub Pages через GitHub Actions (`.github/workflows/deploy.yml`)
- База данных: Supabase PostgreSQL — одна таблица `duo_store` (`key TEXT primary key`, `value TEXT`)
- Telegram: WebApp SDK (`window.Telegram.WebApp`) — username, expand, setHeaderColor
- CSS: инжектируется в `<head>` через `useEffect`, нет отдельных CSS-файлов
- Аудио: Web Audio API — ambient синтезатор (4 осциллятора + LFO)
- Голосовые: MediaRecorder API → base64 → Supabase

---

## 3. Репозиторий и деплой

| | |
|---|---|
| **GitHub repo** | https://github.com/nikitaloktionov163-ux/Biggloveduo.git |
| **Live URL** | https://nikitaloktionov163-ux.github.io/Biggloveduo/ |
| **Telegram Bot** | @duo_viewer_bot |
| **Mini App** | t.me/duo_viewer_bot/app |
| **GitHub Secret** | `VITE_BOT_USERNAME=duo_viewer_bot` |
| **Vite base path** | `VITE_BASE_PATH=/Biggloveduo/` |

> ⚠️ В `deploy.yml` использовать `npm install` (НЕ `npm ci`). Убрать `cache: npm` из `actions/setup-node`.

---

## 4. Supabase

| | |
|---|---|
| **Project URL** | `https://zghswvujqwshonctoulx.supabase.co` |
| **Anon Key** | `sb_publishable_uLz5P6pKZ_r7aru5HmvMbw_MWoxAM_t` |
| **В коде (v10)** | константы `SB_URL` и `SB_KEY` в начале `src/App.jsx` |

**SQL — таблица уже создана, повторно не выполнять:**
```sql
CREATE TABLE duo_store (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);
ALTER TABLE duo_store ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access" ON duo_store FOR ALL USING (true) WITH CHECK (true);
```

**Ключи в таблице (префиксы):**

| Ключ | Описание |
|---|---|
| `p:{username}` | presence — кто к кому хочет подключиться, TTL 15 мин |
| `st:{username}` | live state — скролл, курсор, вибрация, поцелуй, сообщение, TTL 15 мин |
| `cal:{pair}` | календарь важных дат (shared) |
| `mom:{pair}` | воспоминания/моменты (shared) |
| `wish:{pair}` | список желаний (shared) |
| `trv:{pair}` | путешествия (shared) |
| `drm:{username}` | мечты (per-user, каждый пишет своё) |

```js
pair = [norm(a), norm(b)].sort().join('·')
norm = s => s.replace(/^@/, "").toLowerCase().trim()
```

TTL presence и state: **15 минут**.

---

## 5. Архитектура `src/App.jsx` (v10)

Весь проект — один файл. Порядок блоков сверху вниз:

| Блок | Содержимое |
|---|---|
| `STORAGE` | `db.set/get/del`, `coll(ns, id)`, `saveP/loadP`, `saveSt/loadSt`, `clearU(me)` |
| `AMBIENT` | `class Amb` — Web Audio синтезатор. `amb.start()` / `amb.stop()` |
| `VIBES` | массив `VIBES: [{id, icon, name, pat}]` — паттерны вибраций |
| `CSS` | строка со всеми стилями, инжектируется в `useEffect` |
| `UTILS` | `Petals`, `BurstPetals`, `FloatReact`, `MBars`, `Timer`, `LoveTimer`, `VoicePlayer`, `daysUntil()` |
| `SECTIONS` | `CalSec`, `MomSec`, `DreamsSec`, `WishesSec`, `TravelSec`, `PromisesSec` |
| `KissBox` | таймер поцелуя (тикает пока оба держат кнопку) |
| `VibeRipple` | полноэкранная анимация входящей вибрации |
| `useTG()` | хук Telegram WebApp: `username`, `startParam`, `share(myUsername)` |
| `Landing` | главный компонент: nav, hero, все секции, все оверлеи, ribbon |
| `App` | root: управляет фазами `connect → waiting → burst → landing` |

---

## 6. Фазы приложения

**`connect`** — Экран входа. Поля: `@свой ник` (readonly если TG), `@ник партнёра`, textarea сюрприз-послание. Кнопка «Войти вместе». Фон: Petals + aura-анимация.

**`waiting`** — Polling `loadP(partner)` каждые 1500мс. Если `partner.wants === me` → burst. Кнопка «Поделиться ссылкой» (TG share или clipboard).

**`burst`** — 3с анимации (сердца летят вверх, кольцо + иконка, имена пары). `setTimeout(3000)` → landing.

**`landing`** — Основной экран. Nav + TogetherTimer + 8 секций + ribbon. Polling каждые 1500мс.

---

## 7. Live-синхронизация

Landing каждые **1500мс** → `loadSt(partner)`. Из ответа читает поля:

| Поле | Действие |
|---|---|
| `scroll` (0–1) | двигает `.pbar-thumb` и `.pcursor` по странице |
| `cursor {x, y}` | отображает курсор партнёра поверх экрана |
| `reaction {emoji, x, y, ts}` | FloatReact анимация (летит вверх и исчезает) |
| `msg {text, ts, vd, vdur}` | добавляет в `msgs[]`, `unread++` |
| `kissing: bool + kissTs` | синхронизирует kiss-таймер |
| `vibe {id, ts}` | `navigator.vibrate(pattern)` + VibeRipple анимация |

**`flush()`** — дебаунс 380мс. Вызывается при скролле/mousemove/действиях. Сохраняет `st.current` (scroll + cursor + extra) → `saveSt(me)`.

---

## 8. Ribbon — панель управления

Фиксированная внизу (`fixed bottom: 16px`). Кнопки:

- 🎵 **Музыка** — `amb.start()/stop()`. Иконка = анимированные полоски когда включена
- 📳 **Вибрация** — vpanel с 4 паттернами (Касание / Сердце / Страсть / Скучаю). `sendVibe()` → `saveSt` с полем `vibe`
- 🎯 **Реакции** — rpanel с 10 эмодзи. `sendReact()` → `saveSt` с полем `reaction`
- 💋 **Поцелуй** — `mousedown/touchstart = startKiss()`, `mouseup/touchend = endKiss()`. KissBox показывается пока оба держат
- 💬 **Чат** — chat-панель. Badge = unread. Текст + голосовые (зажать 🎤)
- **Выйти** — `clearU(me)`, `amb.stop()`, все useState сбрасываются → фаза `connect`

---

## 9. Секции контента

| Секция | Детали |
|---|---|
| **Timer** | `LoveTimer` тикает посекундно. localStorage ключ `'duo_sd'`. Milestones: 7/30/100/180/365/730/1000/1825 дней |
| **Calendar** | Emoji picker (12 вар.). Поля: название + дата + описание. Сортировка по `daysUntil()`. Chip: today/soon(≤7)/near(≤30)/far. Polling 7с |
| **Moments** | Emoji picker (16 вар.). Теги: Счастье/Нежность/Смешно/Важно. Новые сверху. Polling 5с |
| **Dreams** | 2 колонки (я + партнёр). Свои — чекбоксы выполнения. Партнёра — readonly. per-user `coll('drm')`. Polling 7с |
| **Wishes** | Вкладки Все/Мои/Партнёра (счётчики). Приоритеты: high🔥/med💫/low🌿. Кнопка «Исполнить» только на чужих. Polling 7с |
| **Travel** | Статусы dream/planning/been — клик по карточке = цикл. Счётчики вверху. 16 флагов. Polling 7с |
| **Promises** | 5 дефолтных + добавление. Чекбоксы. ⚠️ Только localStorage — не синхронизировано с партнёром |

---

## 10. Дизайн-система (v10 Midnight Luxury)

> Концепция: **Apple × Cartier × Moleskine**. Тёмная тема. Минимализм + роскошь.

| | |
|---|---|
| **Шрифты** | `Fraunces` (display serif, заголовки, числа) + `Plus Jakarta Sans` (UI, body) |
| **Акцент** | `#c14268` (роза) — все интерактивные элементы |
| **Фон** | `#07060d`. Карточки: `rgba(255,255,255,.025)`, border: `rgba(255,255,255,.06)` |
| **Кнопки** | hover: `translateY(-1px)` + box-shadow усиливается. Transition 0.18s |
| **Анимации** | keyframes `up`: opacity + `translateY(22px)`. Все входы через этот keyframe |
| **Glassmorphism** | `backdrop-filter: blur(28px) saturate(1.5)` на nav, ribbon, панелях |

**CSS переменные:**
```css
--c0: #07060d        /* фон */
--r:  #c14268        /* роза — основной акцент */
--r2: #9a2f4e        /* роза тёмная */
--g:  #b8924a        /* золото */
--ink:  #f3eff4      /* текст */
--ink2: rgba(243,239,244,.6)
--ink3: rgba(243,239,244,.28)
--e1: cubic-bezier(.22,1,.36,1)    /* ease out */
--e2: cubic-bezier(.34,1.56,.64,1) /* overshoot spring */
```

---

## 11. Известные ограничения

- Бот не шлёт уведомления сам — нет сервера. Ссылку шарит пользователь вручную
- `Promises` не синхронизированы между партнёрами (только localStorage)
- Голосовые: base64 в Supabase — риск превышения 5MB при длинных записях
- TTL presence и state: 15 минут. После истечения нужно переподключиться
- Один файл `src/App.jsx` — при росте кода стоит разбить на компоненты

---

## 12. Задачи — следующий sprint

- [ ] Фото в воспоминаниях — Supabase Storage, хранить URL в `duo_store`
- [ ] Синхронизация Promises через `coll('prom', pid)`
- [ ] Уведомления через Telegram Bot API (нужен serverless: Vercel / Cloudflare Workers)
- [ ] Экран профиля пары: аватарки, дата начала, совместная статистика
- [ ] Push в день годовщины через бота
- [ ] Swipe-навигация между секциями на мобильном
- [ ] Onboarding-тур для первого запуска пары

---

## 13. Локальный запуск

```bash
git clone https://github.com/nikitaloktionov163-ux/Biggloveduo.git
cd Biggloveduo
npm install
npm run dev
# Открыть: http://localhost:5173/Biggloveduo/
```

- Supabase ключи — `SB_URL` и `SB_KEY` в начале `src/App.jsx`
- `VITE_BOT_USERNAME` — в GitHub Secrets или `.env`

---

*Duo Viewer TZ · v10 · 2026 · @duo_viewer_bot*
