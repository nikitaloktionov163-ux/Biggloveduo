# Duo Viewer — Sprint 2 ТЗ для Cursor
> 5 новых фич · Все задания независимые · Только `src/App.jsx` если не указано иное

---

## Контекст

**Репо:** https://github.com/nikitaloktionov163-ux/Biggloveduo.git  
**Live:** https://nikitaloktionov163-ux.github.io/Biggloveduo/  
**Файл:** `src/App.jsx`  
**Supabase:** duo_store, SB_URL, SB_KEY  
**Хелперы:** coll(ns, id), pair(a,b), norm(s)

**Текущий SWIPE_ORDER:**
```js
["hero","profile","timer","calendar","moments","dreams","wishes","travel","promises"]
```

**Как добавлять новую секцию:** CSS → компонент XxxSec → SECS → SWIPE_ORDER → swipe-dots → section в Landing → hr

---

## Задания Sprint 2

| # | Задание | Сложность |
|---|---------|-----------|
| 1 | 💌 Капсула времени | Новая секция, coll('capsule', pid) |
| 2 | 😊 Настроение дня | Новая секция + индикатор в ribbon |
| 3 | 🎨 Тема оформления | Добавить в ProfileSec |
| 4 | 🗺️ Карта мест | Leaflet CDN + новая секция |
| 5 | ❓ Вопросы дня | Новая секция, банк вопросов |

**Рекомендуемый порядок:** 3 (тема) → 2 (настроение) → 5 (вопросы) → 1 (капсула) → 4 (карта)

---

## Итоговый SWIPE_ORDER после всех заданий

```js
["hero","profile","mood","qa","timer","calendar","moments","dreams","wishes","travel","map","promises","capsule"]
```

---

## Статус Sprint 1

✅ Promises sync · ✅ Swipe · ✅ Профиль · ⬜ Onboarding · ⬜ Фото в моментах

---

*Duo Viewer Sprint 2 TZ · 2026 · @duo_viewer_bot*
