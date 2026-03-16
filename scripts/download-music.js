/**
 * Скачивает 6 MP3 по ссылкам из urls.txt в public/music/ как t1.mp3 … t6.mp3
 *
 * Как получить ссылки с Pixabay:
 * 1. Открой трек на pixabay.com/music/ → нажми Download
 * 2. В браузере: F12 → вкладка Network → снова нажми Download
 * 3. Найди запрос с типом mp3 или файл .mp3 → ПКМ → Copy → Copy link address
 * 4. Вставь по одной ссылке на строку в urls.txt (строка 1 → t1.mp3, … строка 6 → t6.mp3)
 *
 * Запуск: node scripts/download-music.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const OUT_DIR = path.join(__dirname, '..', 'public', 'music');
const URLS_FILE = path.join(__dirname, 'urls.txt');

function download(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      const redirect = res.headers.location;
      if (redirect && (res.statusCode === 301 || res.statusCode === 302)) {
        download(redirect).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(URLS_FILE)) {
    fs.writeFileSync(
      URLS_FILE,
      `# Одна ссылка на строку (строка 1 → t1.mp3, … 6 → t6.mp3)
# Получить: Pixabay → трек → Download → F12 → Network → скопировать URL запроса .mp3

`,
      'utf8'
    );
    console.log('Создан файл scripts/urls.txt — вставь туда 6 ссылок на MP3 и снова запусти скрипт.');
    return;
  }

  const raw = fs.readFileSync(URLS_FILE, 'utf8');
  const urls = raw
    .split(/\r?\n/)
    .map((s) => s.replace(/#.*/, '').trim())
    .filter(Boolean);

  if (urls.length < 6) {
    console.log('Нужно 6 ссылок в scripts/urls.txt (сейчас: ' + urls.length + ').');
    return;
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (let i = 0; i < 6; i++) {
    const name = `t${i + 1}.mp3`;
    const outPath = path.join(OUT_DIR, name);
    const url = urls[i];
    process.stdout.write(`Скачиваю ${name}... `);
    try {
      const buf = await download(url);
      fs.writeFileSync(outPath, buf);
      console.log('OK');
    } catch (e) {
      console.log('Ошибка:', e.message);
    }
  }
  console.log('Готово. Файлы в public/music/');
}

main();
