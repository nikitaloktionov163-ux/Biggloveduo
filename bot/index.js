const BOT_TOKEN = process.env.TG_BOT_TOKEN;
const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_KEY;

const tg = (method, body) => fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const userChatIds = {};

setInterval(async () => {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/duo_store?key=like.notify:%25&select=key,value`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    const rows = await r.json();
    for (const row of rows || []) {
      try {
        const data = JSON.parse(row.value);
        const parts = (row.key || "").split(":");
        const username = parts[1];
        const chatId = userChatIds[username];
        if (chatId && data && data.text) {
          await tg("sendMessage", { chat_id: chatId, text: data.text });
          await fetch(`${SB_URL}/rest/v1/duo_store?key=eq.${encodeURIComponent(row.key)}`, {
            method: "DELETE",
            headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
          });
        }
      } catch (e) {}
    }
  } catch (e) {}
}, 3000);

let offset = 0;
setInterval(async () => {
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=5`);
    const data = await r.json();
    for (const upd of data.result || []) {
      offset = upd.update_id + 1;
      const msg = upd.message;
      if (msg?.from?.username) {
        userChatIds[msg.from.username.toLowerCase()] = msg.chat.id;
      }
    }
  } catch (e) {}
}, 2000);

console.log("Bot started");
