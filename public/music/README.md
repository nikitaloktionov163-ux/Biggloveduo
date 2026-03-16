# Музыка для приложения

Положи сюда файлы **t1.mp3 … t6.mp3** (см. инструкцию в корне или ниже).

## Быстрый способ — скрипт

1. Создай файл **scripts/urls.txt** (он создастся сам при первом запуске).
2. Скачай 6 треков с [Pixabay Music](https://pixabay.com/music/):
   - Поиск: "dreamy piano slow cinematic" → скачай → открой F12 → Network → повтори Download → скопируй URL запроса к .mp3.
   - Аналогично для: "sad romantic piano melancholy", "soft piano emotional tender", "beautiful piano strings cinematic", "dark romantic piano minor", "calm ambient piano peaceful".
3. Вставь 6 ссылок в **scripts/urls.txt** (по одной на строку).
4. В корне проекта выполни: **node scripts/download-music.js**

Файлы появятся здесь: t1.mp3 … t6.mp3.

## Ручной способ

Скачай с Pixabay по таблице из инструкции, переименуй в t1.mp3 … t6.mp3 и скопируй в эту папку.
