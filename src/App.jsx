import { useState, useEffect, useRef, useCallback } from "react";

/* ══════════════════════════════════════════════════════
   STORAGE — Gun.js (decentralized, no server, no signup)
   Docs: https://gun.eco
══════════════════════════════════════════════════════ */
const POLL_MS = 900;
const TTL_MS  = 15 * 60 * 1000;
const normalize = s => s.replace(/^@/, "").toLowerCase().trim();

// Gun.js loaded via CDN in index.html
// Namespace all keys under "duo_app" to avoid collisions
const getGun  = () => window._duoGun  || (window._duoGun  = window.Gun(['https://gun-manhattan.herokuapp.com/gun']));
const getNode = (k) => getGun().get('duo_app').get(k);

async function s_set(k, v) {
  return new Promise(res => getNode(k).put(JSON.stringify(v), () => res()));
}
async function s_get(k) {
  return new Promise(res => {
    getNode(k).once(data => {
      try { res(data ? JSON.parse(data) : null); } catch { res(null); }
    });
    // timeout fallback
    setTimeout(() => res(null), 3000);
  });
}
async function s_del(k) {
  return new Promise(res => getNode(k).put(null, () => res()));
}

async function savePresence(me, to)  { await s_set(`duo:${normalize(me)}`, { wants: normalize(to), ts: Date.now() }); }
async function loadPresence(n)       { const d = await s_get(`duo:${normalize(n)}`); return d && Date.now()-d.ts < TTL_MS ? d : null; }
async function clearPresence(n)      { for (const k of ["duo","duo_state","duo_playlist"]) await s_del(`${k}:${normalize(n)}`); }
async function saveState(me, data)   { await s_set(`duo_state:${normalize(me)}`, { ...data, ts: Date.now() }); }
async function loadState(n)          { const d = await s_get(`duo_state:${normalize(n)}`); return d && Date.now()-d.ts < TTL_MS ? d : null; }
async function savePlaylist(me, arr) { await s_set(`duo_playlist:${normalize(me)}`, arr); }
async function loadPlaylist(n)       { return (await s_get(`duo_playlist:${normalize(n)}`)) || []; }

/* ══════════════════════════════════════════════════════
   DATA
══════════════════════════════════════════════════════ */
const SECTIONS = [
  { id:"hero",    label:"Начало"  },
  { id:"chip",    label:"A19 Pro" },
  { id:"camera",  label:"Камера"  },
  { id:"battery", label:"Батарея" },
  { id:"display", label:"Дисплей" },
  { id:"colors",  label:"Цвета"   },
  { id:"buy",     label:"Купить"  },
];
const COLORS = [
  { id:"black",       name:"Black Titanium",  hi:"#2d2d31", lo:"#111114" },
  { id:"white",       name:"White Titanium",  hi:"#d6d6de", lo:"#b0b0ba" },
  { id:"desert",      name:"Desert Titanium", hi:"#c2aa8a", lo:"#8a7056" },
  { id:"sage",        name:"Sage Titanium",   hi:"#7a9c84", lo:"#4a6a54" },
  { id:"ultramarine", name:"Ultramarine",     hi:"#304c7e", lo:"#12203e" },
];
const PRICES = { "256":[1199,33.25],"512":[1399,38.86],"1tb":[1599,44.42],"2tb":[1799,49.97] };
const REACTS  = ["❤️","💕","🌹","😍","✨","🫶","💋","🥰","💖","🔥"];
const DRAW_COLORS = ["#e8527a","#f0c040","#64d2ff","#30d158","#bf5af2","#ffffff","#ff9f0a"];
const VIBE_PATTERNS = [
  { id:"tap",       emoji:"👆", label:"Лёгкое касание",  pattern:[60],                   color:"rgba(212,168,83,.9)"  },
  { id:"heart",     emoji:"💓", label:"Сердцебиение",    pattern:[120,80,120],           color:"rgba(232,82,122,.9)"  },
  { id:"passion",   emoji:"🔥", label:"Страсть",         pattern:[200,80,200,80,400],    color:"rgba(255,120,50,.9)"  },
  { id:"sos",       emoji:"💌", label:"Думаю о тебе",    pattern:[80,50,80,50,300,50,80],color:"rgba(100,210,255,.9)" },
];

/* ══════════════════════════════════════════════════════
   AMBIENT AUDIO
══════════════════════════════════════════════════════ */
class AmbientPlayer {
  constructor(){ this.ctx=null; this.master=null; this.playing=false; }
  start(){
    if(this.playing) return;
    this.ctx = new (window.AudioContext||window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.setValueAtTime(0, 0);
    this.master.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime+3);
    this.master.connect(this.ctx.destination);
    [[220,.55],[277.2,.38],[329.6,.28],[440,.15]].forEach(([freq,vol])=>{
      const osc=this.ctx.createOscillator(), g=this.ctx.createGain();
      const lfo=this.ctx.createOscillator(), lg=this.ctx.createGain();
      osc.type="sine"; osc.frequency.value=freq;
      lfo.type="sine"; lfo.frequency.value=0.06+Math.random()*.05;
      lg.gain.value=1.5; lfo.connect(lg); lg.connect(osc.frequency);
      g.gain.value=vol; osc.connect(g); g.connect(this.master);
      osc.start(); lfo.start();
    });
    this.playing=true;
  }
  stop(){
    if(!this.playing) return;
    if(this.ctx){ this.ctx.close(); this.ctx=null; }
    this.master=null; this.playing=false;
  }
}
const ambient = new AmbientPlayer();

/* ══════════════════════════════════════════════════════
   CSS
══════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Outfit:wght@200;300;400;500;600;700&family=Cormorant+Garamond:ital,wght@0,300;0,700;1,300;1,400&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --font-r:'Playfair Display',Georgia,serif;
  --font-d:'Cormorant Garamond',Georgia,serif;
  --font-b:'Outfit',sans-serif;
  --rose:#e8527a;--rose-lo:#c23d5f;--rose-hi:#f07090;
  --gold:#d4a853;
  --fg:#f5f0eb;--fg2:rgba(245,240,235,.62);--fg3:rgba(245,240,235,.36);
  --bg:#0d0810;--card-bg:rgba(20,12,18,.93);
  --ease:cubic-bezier(.22,1,.36,1);--spring:cubic-bezier(.34,1.56,.64,1);
  --blue:#0071e3;--teal:#64d2ff;--purple:#bf5af2;--green:#30d158;
}
html,body,#root{height:100%;background:var(--bg);color:var(--fg);font-family:var(--font-b);}

/* ── CONNECT ── */
.co-wrap{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:var(--bg);overflow:hidden;}
.co-bg{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 60% 55% at 15% 15%,rgba(232,82,122,.16) 0%,transparent 58%),radial-gradient(ellipse 50% 45% at 85% 80%,rgba(212,168,83,.12) 0%,transparent 56%);}
.petal{position:absolute;pointer-events:none;border-radius:50% 0 50% 0;opacity:0;animation:pf linear infinite;}
@keyframes pf{0%{transform:translateY(-30px) rotate(0deg);opacity:0}10%{opacity:.35}90%{opacity:.2}100%{transform:translateY(110vh) rotate(540deg);opacity:0}}
.co-card{position:relative;z-index:2;width:min(410px,93vw);background:var(--card-bg);border:1px solid rgba(232,82,122,.20);border-radius:32px;padding:40px 34px 36px;backdrop-filter:blur(32px);box-shadow:0 0 0 1px rgba(232,82,122,.08) inset,0 60px 140px rgba(0,0,0,.85);text-align:center;animation:ci .75s var(--ease) both;max-height:92vh;overflow-y:auto;}
@keyframes ci{from{opacity:0;transform:translateY(28px) scale(.96)}to{opacity:1;transform:none}}
.co-heart{font-size:34px;display:block;margin-bottom:18px;animation:hb 2.4s ease-in-out infinite;filter:drop-shadow(0 0 12px rgba(232,82,122,.6));}
@keyframes hb{0%,100%{transform:scale(1)}14%{transform:scale(1.18)}28%{transform:scale(1)}42%{transform:scale(1.1)}}
.co-title{font-family:var(--font-r);font-size:clamp(24px,5.5vw,32px);font-weight:700;letter-spacing:-.02em;line-height:1.15;margin-bottom:6px;}
.co-title em{font-style:italic;color:var(--rose-hi);}
.co-sub{font-size:13px;color:var(--fg3);line-height:1.65;max-width:300px;margin:0 auto 26px;}
.co-divider{display:flex;align-items:center;gap:10px;margin-bottom:22px;}
.co-divider-line{flex:1;height:1px;background:rgba(232,82,122,.15);}
.co-field{margin-bottom:13px;text-align:left;}
.co-label{font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:rgba(232,82,122,.7);display:block;margin-bottom:5px;}
.co-input-wrap{position:relative;display:flex;align-items:center;}
.co-at{position:absolute;left:13px;font-size:15px;font-weight:600;color:rgba(232,82,122,.6);pointer-events:none;}
.co-input{width:100%;padding:12px 13px 12px 29px;background:rgba(255,255,255,.04);border:1px solid rgba(232,82,122,.18);border-radius:13px;color:var(--fg);font-family:var(--font-b);font-size:14px;outline:none;transition:border-color .22s,box-shadow .22s;}
.co-input:focus{border-color:rgba(232,82,122,.55);box-shadow:0 0 0 3px rgba(232,82,122,.09);}
.co-input::placeholder{color:var(--fg3);}
.co-hint{font-size:11px;color:var(--fg3);margin-top:4px;padding-left:2px;line-height:1.5;}
.co-error{font-size:12px;color:#ff6b6b;text-align:left;margin-bottom:10px;}
.co-btn{width:100%;margin-top:6px;padding:14px;border-radius:15px;background:linear-gradient(135deg,var(--rose),var(--rose-lo));color:#fff;font-family:var(--font-b);font-size:14px;font-weight:600;border:none;cursor:pointer;box-shadow:0 8px 26px rgba(232,82,122,.35);transition:opacity .18s,transform .18s var(--spring);}
.co-btn:hover:not(:disabled){opacity:.91;transform:scale(1.01);}
.co-btn:disabled{opacity:.3;cursor:not-allowed;}
.co-waiting{display:flex;flex-direction:column;align-items:center;gap:16px;padding:4px 0;animation:ci .5s var(--ease) both;}
.co-orb{width:76px;height:76px;border-radius:50%;background:radial-gradient(circle at 38% 34%,rgba(232,82,122,.45),rgba(232,82,122,.08));border:1px solid rgba(232,82,122,.3);display:flex;align-items:center;justify-content:center;font-size:30px;position:relative;}
.co-orb::before,.co-orb::after{content:'';position:absolute;border-radius:50%;border:1px solid rgba(232,82,122,.15);animation:rr 2.4s ease-out infinite;}
.co-orb::before{inset:-10px;}
.co-orb::after{inset:-22px;animation-delay:.8s;border-color:rgba(232,82,122,.08);}
@keyframes rr{0%{transform:scale(.8);opacity:1}100%{transform:scale(1.3);opacity:0}}
.co-wait-name{font-family:var(--font-r);font-size:21px;font-weight:700;}
.co-wait-name span{color:var(--rose-hi);}
.co-wait-sub{font-size:13px;color:var(--fg3);line-height:1.65;text-align:center;max-width:280px;}
.co-wait-sub strong{color:var(--fg2);}
.co-wait-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--rose);margin-right:6px;vertical-align:middle;animation:bd 1.5s ease-in-out infinite;}
@keyframes bd{0%,100%{opacity:1}50%{opacity:.15}}
.co-cancel{font-size:12px;color:var(--fg3);cursor:pointer;text-decoration:underline;text-underline-offset:3px;}
.tg-notice{margin-top:16px;padding:10px 13px;border-radius:11px;background:rgba(37,211,102,.07);border:1px solid rgba(37,211,102,.18);font-size:11px;color:rgba(245,240,235,.5);line-height:1.6;text-align:left;display:flex;gap:8px;}

/* ── BURST ── */
.burst-wrap{position:fixed;inset:0;z-index:1001;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(13,8,16,.97);animation:brf 3.2s var(--ease) forwards;pointer-events:none;}
@keyframes brf{0%,55%{opacity:1}100%{opacity:0}}
.burst-hearts{position:absolute;inset:0;overflow:hidden;}
.burst-heart-p{position:absolute;animation:hfl linear forwards;opacity:0;}
@keyframes hfl{0%{transform:translateY(0) rotate(var(--r,0deg)) scale(.5);opacity:0}15%{opacity:.9}100%{transform:translateY(-80vh) rotate(calc(var(--r)+180deg)) scale(.6);opacity:0}}
.burst-ring{width:110px;height:110px;border-radius:50%;border:2px solid var(--rose);display:flex;align-items:center;justify-content:center;animation:rp .65s var(--spring) .1s both;box-shadow:0 0 48px rgba(232,82,122,.5);}
@keyframes rp{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}
.burst-icon{font-size:44px;animation:rp .7s var(--spring) .25s both;}
.burst-text{font-family:var(--font-r);font-size:clamp(32px,6vw,46px);font-weight:700;margin-top:28px;animation:su .8s var(--ease) .4s both;}
.burst-sub{font-size:15px;color:var(--fg2);margin-top:8px;animation:su .8s var(--ease) .58s both;}
.burst-sub span{color:var(--rose-hi);}
@keyframes su{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}

/* ── RIBBON ── */
.ribbon{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:900;background:rgba(20,12,18,.95);border:1px solid rgba(232,82,122,.24);border-radius:999px;backdrop-filter:blur(22px);padding:8px 14px 8px 11px;display:flex;align-items:center;gap:7px;box-shadow:0 0 0 1px rgba(232,82,122,.07) inset,0 12px 40px rgba(0,0,0,.65),0 0 28px rgba(232,82,122,.08);animation:ci .5s var(--ease) both;white-space:nowrap;max-width:98vw;}
.ribbon-heart{font-size:15px;animation:hb 2.4s ease-in-out infinite;filter:drop-shadow(0 0 5px rgba(232,82,122,.5));}
.ribbon-ava{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,var(--rose),#8b1a3a);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;text-transform:uppercase;}
.ribbon-text{font-size:12px;color:var(--fg2);}
.ribbon-text strong{color:var(--fg);font-weight:600;}
.ribbon-at{color:var(--rose-hi);}
.ribbon-sec{font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--gold);border-left:1px solid rgba(232,82,122,.18);padding-left:7px;}
.ribbon-actions{display:flex;align-items:center;gap:4px;border-left:1px solid rgba(232,82,122,.14);padding-left:7px;}
.rbtn{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;transition:background .18s,transform .18s var(--spring);position:relative;flex-shrink:0;}
.rbtn:hover{background:rgba(255,255,255,.12);transform:scale(1.1);}
.rbtn.active{background:rgba(232,82,122,.22);border-color:rgba(232,82,122,.4);}
.rbtn.kiss-active{background:rgba(232,82,122,.35);border-color:rgba(232,82,122,.7);box-shadow:0 0 12px rgba(232,82,122,.5);animation:kiss-pulse 1s ease-in-out infinite;}
@keyframes kiss-pulse{0%,100%{box-shadow:0 0 10px rgba(232,82,122,.4)}50%{box-shadow:0 0 22px rgba(232,82,122,.8)}}
.rbtn-badge{position:absolute;top:-4px;right:-4px;width:14px;height:14px;border-radius:50%;background:var(--rose);font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;}
.ribbon-disc{font-size:10px;color:var(--fg3);cursor:pointer;border-left:1px solid rgba(232,82,122,.12);padding-left:7px;transition:color .18s;flex-shrink:0;}
.ribbon-disc:hover{color:#ff6b6b;}
.music-bars{display:flex;align-items:center;gap:2px;height:13px;}
.music-bar{width:2px;border-radius:1px;background:var(--rose-hi);animation:mb var(--d,.6s) ease-in-out infinite alternate;}
@keyframes mb{0%{height:2px;opacity:.4}100%{height:var(--h,11px);opacity:.9}}

/* ── KISS OVERLAY ── */
.kiss-overlay{position:fixed;inset:0;z-index:950;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;}
.kiss-counter{background:rgba(20,12,18,.92);border:1px solid rgba(232,82,122,.35);border-radius:24px;padding:18px 32px;text-align:center;backdrop-filter:blur(20px);animation:ci .4s var(--ease) both;box-shadow:0 0 60px rgba(232,82,122,.25);}
.kiss-emoji{font-size:44px;display:block;margin-bottom:8px;animation:hb 1s ease-in-out infinite;}
.kiss-time{font-family:var(--font-d);font-size:52px;font-weight:700;letter-spacing:-.04em;line-height:1;background:linear-gradient(135deg,var(--rose-hi),var(--rose));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.kiss-label{font-size:12px;color:var(--fg3);margin-top:4px;letter-spacing:.06em;text-transform:uppercase;}
.kiss-waiting{font-size:13px;color:var(--fg3);background:rgba(20,12,18,.88);border:1px solid rgba(232,82,122,.20);border-radius:20px;padding:12px 22px;text-align:center;backdrop-filter:blur(16px);}
.kiss-waiting strong{color:var(--rose-hi);}
.kiss-record{position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:951;background:linear-gradient(135deg,rgba(232,82,122,.25),rgba(232,82,122,.10));border:1.5px solid rgba(232,82,122,.5);border-radius:999px;padding:10px 24px 10px 18px;font-size:13px;color:var(--rose-hi);font-weight:600;display:flex;align-items:center;gap:8px;backdrop-filter:blur(16px);animation:ci .3s var(--ease) both;box-shadow:0 0 32px rgba(232,82,122,.25);}
.kiss-record-dot{width:8px;height:8px;border-radius:50%;background:var(--rose);animation:bd 1s ease-in-out infinite;}

/* ── LAST KISS TOAST ── */
.last-kiss-toast{position:fixed;top:66px;left:50%;transform:translateX(-50%);z-index:910;background:rgba(20,12,18,.94);border:1px solid rgba(232,82,122,.30);border-radius:14px;padding:10px 20px;font-size:13px;color:var(--fg2);animation:su .35s var(--ease) both,ft 2.5s var(--ease) 1.5s forwards;pointer-events:none;white-space:nowrap;display:flex;align-items:center;gap:8px;}
@keyframes ft{from{opacity:1}to{opacity:0}}
.last-kiss-toast strong{color:var(--rose-hi);}

/* ── CHAT ── */
.chat-panel{position:fixed;bottom:70px;right:20px;z-index:902;width:min(290px,86vw);background:rgba(20,12,18,.97);border:1px solid rgba(232,82,122,.22);border-radius:22px;backdrop-filter:blur(24px);box-shadow:0 16px 56px rgba(0,0,0,.6);overflow:hidden;display:flex;flex-direction:column;animation:ci .3s var(--ease) both;}
.chat-hd{padding:11px 13px 10px;border-bottom:1px solid rgba(232,82,122,.12);display:flex;align-items:center;justify-content:space-between;}
.chat-hd-title{font-family:var(--font-r);font-size:14px;font-weight:700;}
.chat-hd-sub{font-size:10px;color:var(--fg3);margin-top:1px;}
.chat-x{width:23px;height:23px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:10px;color:var(--fg3);}
.chat-msgs{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:7px;max-height:190px;min-height:50px;}
.chat-msgs::-webkit-scrollbar{width:2px;}
.chat-msgs::-webkit-scrollbar-thumb{background:rgba(232,82,122,.3);border-radius:2px;}
.chat-msg{max-width:85%;padding:7px 11px;border-radius:14px;font-size:12px;line-height:1.5;animation:su .25s var(--ease) both;}
.chat-msg.mine{align-self:flex-end;background:linear-gradient(135deg,var(--rose),var(--rose-lo));color:#fff;border-bottom-right-radius:3px;}
.chat-msg.theirs{align-self:flex-start;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);border-bottom-left-radius:3px;}
.chat-msg.voice{padding:5px 10px;}
.chat-msg-from{font-size:9px;font-weight:600;opacity:.6;margin-bottom:2px;letter-spacing:.04em;text-transform:uppercase;}
.chat-msg.moment{background:rgba(232,82,122,.12);border:1px solid rgba(232,82,122,.25);border-radius:13px;}
.chat-moment-sec{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--rose-hi);margin-bottom:3px;}
.chat-empty{font-size:12px;color:var(--fg3);text-align:center;padding:14px 0;line-height:1.7;}
.chat-input-row{display:flex;gap:6px;padding:8px 10px;border-top:1px solid rgba(232,82,122,.10);}
.chat-input{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(232,82,122,.18);border-radius:11px;padding:8px 10px;color:var(--fg);font-family:var(--font-b);font-size:12px;outline:none;}
.chat-input:focus{border-color:rgba(232,82,122,.5);}
.chat-input::placeholder{color:var(--fg3);}
.chat-send,.chat-voice-btn{width:30px;height:30px;border-radius:50%;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:transform .18s var(--spring),opacity .18s;}
.chat-send{background:linear-gradient(135deg,var(--rose),var(--rose-lo));}
.chat-voice-btn{background:rgba(255,255,255,.08);border:1px solid rgba(232,82,122,.25);}
.chat-voice-btn:hover,.chat-send:hover:not(:disabled){transform:scale(1.08);}
.chat-send:disabled{opacity:.32;cursor:not-allowed;}
.chat-voice-btn.recording{background:rgba(232,82,122,.25);border-color:rgba(232,82,122,.6);animation:kiss-pulse 1s ease-in-out infinite;}

/* voice player in chat */
.voice-player{display:flex;align-items:center;gap:8px;}
.voice-play-btn{width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.15);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .18s;}
.voice-play-btn:hover{background:rgba(255,255,255,.25);}
.voice-waveform{flex:1;height:24px;display:flex;align-items:center;gap:2px;}
.voice-bar{flex:1;max-width:3px;border-radius:2px;background:rgba(255,255,255,.35);transition:height .1s;}
.voice-duration{font-size:10px;opacity:.7;white-space:nowrap;}

/* ── PLAYLIST ── */
.playlist-panel{position:fixed;bottom:70px;left:20px;z-index:902;width:min(300px,88vw);background:rgba(20,12,18,.97);border:1px solid rgba(232,82,122,.22);border-radius:22px;backdrop-filter:blur(24px);box-shadow:0 16px 56px rgba(0,0,0,.6);overflow:hidden;display:flex;flex-direction:column;animation:ci .3s var(--ease) both;}
.pl-hd{padding:12px 14px 10px;border-bottom:1px solid rgba(232,82,122,.12);display:flex;align-items:center;justify-content:space-between;}
.pl-hd-title{font-family:var(--font-r);font-size:14px;font-weight:700;}
.pl-hd-sub{font-size:10px;color:var(--fg3);margin-top:1px;}
.pl-x{width:23px;height:23px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:10px;color:var(--fg3);}
.pl-list{overflow-y:auto;max-height:220px;padding:6px 8px;display:flex;flex-direction:column;gap:2px;}
.pl-list::-webkit-scrollbar{width:2px;}
.pl-list::-webkit-scrollbar-thumb{background:rgba(232,82,122,.3);border-radius:2px;}
.pl-empty{font-size:12px;color:var(--fg3);text-align:center;padding:18px 0;line-height:1.7;}
.pl-item{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:12px;transition:background .18s;animation:su .25s var(--ease) both;}
.pl-item:hover{background:rgba(255,255,255,.04);}
.pl-item-icon{width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,rgba(232,82,122,.25),rgba(232,82,122,.08));border:1px solid rgba(232,82,122,.20);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.pl-item-info{flex:1;min-width:0;}
.pl-item-title{font-size:13px;font-weight:600;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pl-item-artist{font-size:11px;color:var(--fg3);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pl-item-by{font-size:9px;color:rgba(232,82,122,.5);font-weight:600;text-transform:uppercase;letter-spacing:.05em;flex-shrink:0;}
.pl-add{display:flex;gap:6px;padding:8px 10px;border-top:1px solid rgba(232,82,122,.10);}
.pl-input{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(232,82,122,.18);border-radius:10px;padding:8px 10px;color:var(--fg);font-family:var(--font-b);font-size:12px;outline:none;}
.pl-input:focus{border-color:rgba(232,82,122,.5);}
.pl-input::placeholder{color:var(--fg3);}
.pl-btn{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--rose),var(--rose-lo));border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:transform .18s var(--spring);}
.pl-btn:hover:not(:disabled){transform:scale(1.08);}
.pl-btn:disabled{opacity:.3;cursor:not-allowed;}

/* ── REACTIONS ── */
.react-panel{position:fixed;bottom:68px;left:50%;transform:translateX(-50%);z-index:901;display:flex;gap:7px;background:rgba(20,12,18,.93);border:1px solid rgba(232,82,122,.22);border-radius:999px;padding:9px 14px;backdrop-filter:blur(18px);animation:ci .3s var(--ease) both;}
.react-em{font-size:22px;cursor:pointer;transition:transform .18s var(--spring);}
.react-em:hover{transform:scale(1.35);}
.float-react{position:fixed;pointer-events:none;z-index:960;font-size:var(--fs,30px);animation:fr var(--dur,2.4s) var(--ease) forwards;}
@keyframes fr{0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.3)}100%{opacity:0;transform:translate(-50%,calc(-50% - 110px)) scale(.7)}}

/* ── PARTNER CURSOR / SCROLLBAR ── */
.partner-cursor{position:fixed;pointer-events:none;z-index:950;transition:left .15s linear,top .15s linear;}
.partner-cursor-dot{width:13px;height:13px;border-radius:50%;background:var(--rose);box-shadow:0 0 14px rgba(232,82,122,.8);border:2px solid rgba(255,255,255,.5);}
.partner-cursor-lbl{margin-top:5px;margin-left:4px;background:rgba(20,12,18,.88);border:1px solid rgba(232,82,122,.25);border-radius:8px;padding:2px 8px;font-size:11px;color:var(--fg2);white-space:nowrap;}
.partner-bar{position:fixed;right:6px;top:0;bottom:0;width:3px;z-index:800;pointer-events:none;}
.partner-bar-track{position:absolute;inset:0;background:rgba(232,82,122,.06);border-radius:3px;}
.partner-bar-thumb{position:absolute;left:0;right:0;height:36px;border-radius:3px;background:linear-gradient(180deg,var(--rose-hi),var(--rose-lo));box-shadow:0 0 10px rgba(232,82,122,.5);transition:top .4s var(--ease);}

/* ── TIMER ── */
.timer-pill{position:fixed;top:58px;left:50%;transform:translateX(-50%);z-index:810;background:rgba(20,12,18,.88);border:1px solid rgba(232,82,122,.18);border-radius:999px;padding:5px 14px;backdrop-filter:blur(16px);display:flex;align-items:center;gap:7px;font-size:11px;color:var(--fg2);animation:ci .5s var(--ease) both;white-space:nowrap;}
.timer-dot{width:5px;height:5px;border-radius:50%;background:var(--rose);animation:bd 1.5s ease-in-out infinite;flex-shrink:0;}
.timer-val{font-family:var(--font-d);font-size:14px;font-weight:700;color:var(--rose-hi);}

/* ── SURPRISE ── */
.surprise-wrap{position:fixed;inset:0;z-index:990;display:flex;align-items:center;justify-content:center;background:rgba(13,8,16,.96);backdrop-filter:blur(8px);animation:ci .6s var(--ease) both;}
.surprise-card{width:min(390px,90vw);background:var(--card-bg);border:1px solid rgba(232,82,122,.25);border-radius:32px;padding:44px 32px 36px;text-align:center;box-shadow:0 40px 100px rgba(0,0,0,.8),0 0 80px rgba(232,82,122,.08);animation:rp .7s var(--spring) .2s both;position:relative;overflow:hidden;}
.surprise-hearts{font-size:32px;display:block;margin-bottom:16px;animation:hb 2s ease-in-out infinite;}
.surprise-title{font-family:var(--font-r);font-size:clamp(19px,4.5vw,27px);font-weight:700;letter-spacing:-.02em;margin-bottom:12px;color:var(--rose-hi);}
.surprise-msg{font-family:var(--font-d);font-size:clamp(14px,2.3vw,20px);font-style:italic;font-weight:300;color:var(--fg2);line-height:1.75;margin-bottom:22px;}
.surprise-from{font-size:11px;color:var(--fg3);letter-spacing:.08em;margin-bottom:20px;}
.surprise-btn{padding:11px 28px;border-radius:999px;background:linear-gradient(135deg,var(--rose),var(--rose-lo));color:#fff;font-family:var(--font-b);font-size:13px;font-weight:600;border:none;cursor:pointer;transition:transform .18s var(--spring);}
.surprise-btn:hover{transform:scale(1.04);}
.capture-flash{position:fixed;inset:0;z-index:980;background:#fff;animation:flash .35s ease-out forwards;pointer-events:none;}
@keyframes flash{0%{opacity:.55}100%{opacity:0}}

/* ── VIBE ── */
.vibe-panel{position:fixed;bottom:68px;left:50%;transform:translateX(-50%);z-index:901;background:rgba(20,12,18,.96);border:1px solid rgba(232,82,122,.22);border-radius:22px;padding:14px 16px 12px;backdrop-filter:blur(20px);box-shadow:0 16px 48px rgba(0,0,0,.6);animation:ci .3s var(--ease) both;min-width:220px;}
.vibe-panel-title{font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--fg3);margin-bottom:10px;text-align:center;}
.vibe-opts{display:flex;flex-direction:column;gap:6px;}
.vibe-opt{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:13px;border:1px solid rgba(255,255,255,.07);cursor:pointer;transition:background .18s,border-color .18s,transform .18s var(--spring);}
.vibe-opt:hover{background:rgba(255,255,255,.06);transform:scale(1.02);}
.vibe-opt:active{transform:scale(.97);}
.vibe-opt-emoji{font-size:18px;flex-shrink:0;}
.vibe-opt-label{font-size:13px;font-weight:500;color:var(--fg2);}
.vibe-opt-hint{font-size:10px;color:var(--fg3);margin-top:1px;}
/* ripple overlay shown on receiver */
.vibe-ripple{position:fixed;inset:0;z-index:970;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;}
.vibe-ripple-ring{position:absolute;border-radius:50%;border:2px solid var(--vibe-color,rgba(232,82,122,.6));animation:vr var(--vd,.9s) ease-out forwards;}
@keyframes vr{0%{width:0;height:0;opacity:.9;transform:translate(-50%,-50%)}100%{width:80vmax;height:80vmax;opacity:0;transform:translate(-50%,-50%)}}
.vibe-ripple-icon{font-size:52px;animation:vri .45s var(--spring) both;filter:drop-shadow(0 0 28px var(--vibe-color,rgba(232,82,122,.8)));}
@keyframes vri{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.25)}100%{transform:scale(1);opacity:1}}
.vibe-ripple-text{font-family:var(--font-r);font-size:clamp(18px,4vw,26px);font-weight:700;color:var(--fg);animation:su .5s var(--ease) .1s both;}
.vibe-ripple-sub{font-size:13px;color:var(--fg3);animation:su .5s var(--ease) .25s both;}
/* sent feedback pulse on button */
.rbtn.vibe-sent{animation:vibe-sent-pulse .5s var(--spring) both;}
@keyframes vibe-sent-pulse{0%{transform:scale(1)}40%{transform:scale(1.35);background:rgba(232,82,122,.4)}100%{transform:scale(1)}}
.color-toast{position:fixed;top:66px;left:50%;transform:translateX(-50%);z-index:910;background:rgba(20,12,18,.94);border-radius:12px;padding:8px 16px;font-size:12px;animation:su .35s var(--ease) both,ft 1.8s var(--ease) 1.4s forwards;pointer-events:none;display:flex;align-items:center;gap:8px;white-space:nowrap;}
.color-swatch-preview{width:15px;height:15px;border-radius:50%;border:1.5px solid rgba(255,255,255,.2);}
.sync-toast{position:fixed;top:66px;left:50%;transform:translateX(-50%);z-index:910;background:rgba(20,12,18,.94);border:1px solid rgba(212,168,83,.35);border-radius:12px;padding:8px 16px;font-size:12px;color:var(--gold);animation:su .35s var(--ease) both,ft 1.8s var(--ease) 1s forwards;pointer-events:none;white-space:nowrap;}

/* ── NAV ── */
.lnav{position:fixed;top:0;left:0;right:0;z-index:800;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,5vw,60px);height:52px;transition:background .3s;}
.lnav.scrolled{background:rgba(13,8,16,.78);backdrop-filter:blur(20px);border-bottom:1px solid rgba(232,82,122,.10);}
.lnav-logo{font-size:21px;opacity:.7;}
.lnav-links{display:flex;gap:22px;list-style:none;}
.lnav-link{font-size:13px;color:var(--fg3);cursor:pointer;transition:color .2s;}
.lnav-link:hover,.lnav-link.active{color:var(--fg);}
.lnav-cta{background:linear-gradient(135deg,var(--rose),var(--rose-lo));color:#fff;border:none;border-radius:999px;padding:6px 16px;font-family:var(--font-b);font-size:13px;font-weight:600;cursor:pointer;}
@media(max-width:640px){.lnav-links{display:none;}}

/* ── SECTIONS ── */
section{padding:clamp(80px,12vw,140px) clamp(20px,5vw,64px);}
.s-hero{min-height:100svh;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;max-width:1200px;margin:0 auto;padding-top:80px;background:radial-gradient(ellipse 60% 50% at 10% 22%,rgba(0,113,227,.12) 0%,transparent 55%),radial-gradient(ellipse 55% 50% at 88% 74%,rgba(191,90,242,.09) 0%,transparent 55%);}
@media(max-width:760px){.s-hero{grid-template-columns:1fr;text-align:center;}}
.eyebrow{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--teal);display:block;margin-bottom:13px;}
.hero-h1{font-family:var(--font-d);font-size:clamp(50px,8vw,94px);font-weight:700;letter-spacing:-.04em;line-height:1;background:linear-gradient(165deg,#fff 30%,rgba(255,255,255,.44));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:9px;}
.hero-tag{font-family:var(--font-d);font-size:clamp(19px,2.3vw,29px);font-style:italic;font-weight:300;color:var(--fg2);margin-bottom:34px;}
.hero-btns{display:flex;gap:11px;flex-wrap:wrap;}
@media(max-width:760px){.hero-btns{justify-content:center;}}
.btn-p,.btn-g{padding:12px 25px;border-radius:999px;font-family:var(--font-b);font-size:14px;font-weight:600;cursor:pointer;transition:opacity .18s,transform .18s var(--spring);border:none;}
.btn-p{background:linear-gradient(135deg,var(--rose),var(--rose-lo));color:#fff;box-shadow:0 6px 20px rgba(232,82,122,.28);}
.btn-g{background:transparent;color:var(--fg);border:1.5px solid rgba(255,255,255,.18);}
.btn-p:hover,.btn-g:hover{opacity:.82;transform:scale(1.02);}
.phone-wrap{display:flex;justify-content:center;}
.phone{position:relative;width:clamp(185px,25vw,260px);aspect-ratio:284/578;border-radius:clamp(33px,4.7vw,45px);background:linear-gradient(155deg,var(--frame-hi,#2d2d31),var(--frame-lo,#111114));border:1px solid rgba(255,255,255,.18);box-shadow:0 80px 160px rgba(0,0,0,.9);animation:pfloat 5s ease-in-out infinite;}
@keyframes pfloat{0%,100%{transform:perspective(1200px) rotateX(6deg) rotateY(-4deg) translateY(0)}50%{transform:perspective(1200px) rotateX(6deg) rotateY(-4deg) translateY(-10px)}}
.phone::before{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(130deg,rgba(255,255,255,.10) 0%,transparent 40%);}
.phone-screen{position:absolute;inset:8px;border-radius:inherit;background:radial-gradient(ellipse 100% 55% at 30% 8%,rgba(100,210,255,.18) 0%,transparent 52%),linear-gradient(180deg,#060616,#090b1e);overflow:hidden;display:flex;flex-direction:column;align-items:center;}
.phone-island{width:38%;height:8%;margin-top:3%;border-radius:999px;background:#000;flex-shrink:0;}
.phone-time{font-size:clamp(26px,8vw,50px);font-weight:200;color:#fff;margin-top:8%;}
.phone-date{font-size:clamp(7px,1.8vw,11px);letter-spacing:.10em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-top:2%;}
.phone-btn{position:absolute;border-radius:3px;}
.phone-btn-power{right:-3.5px;top:23%;width:3.5px;height:12%;}
.phone-btn-vol1{left:-3.5px;top:24%;width:3.5px;height:7%;border-radius:3px 0 0 3px;}
.phone-btn-vol2{left:-3.5px;top:33%;width:3.5px;height:7%;border-radius:3px 0 0 3px;}
.phone-btn-action{left:-3.5px;top:16%;width:3.5px;height:5%;border-radius:3px 0 0 3px;}
.phone-port{position:absolute;bottom:2%;left:50%;transform:translateX(-50%);width:16%;height:2.5%;background:rgba(0,0,0,.55);border-radius:4px;}
.section-h2{font-family:var(--font-d);font-size:clamp(30px,4.8vw,58px);font-weight:700;letter-spacing:-.03em;line-height:1.05;margin-bottom:13px;}
.section-h2 em{font-style:italic;color:var(--fg2);}
.section-sub{font-size:clamp(15px,1.9vw,19px);font-weight:300;color:var(--fg2);line-height:1.7;max-width:510px;margin:0 auto 44px;}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(255,255,255,.07);border-radius:20px;overflow:hidden;}
.stat{background:rgba(10,10,14,1);padding:26px 16px;}
.stat-n{font-family:var(--font-d);font-size:clamp(36px,5.5vw,54px);font-weight:700;line-height:1;background:linear-gradient(138deg,#ccd,#8899bb);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.stat-u{font-size:19px;font-weight:300;font-family:var(--font-b);}
.stat-l{font-size:10px;color:var(--fg3);margin-top:5px;}
@media(max-width:480px){.stats{grid-template-columns:1fr;}}
.feat-block{border-top:1px solid rgba(255,255,255,.05);}
.feat-block:nth-child(even){background:rgba(255,255,255,.012);}
.feat-grid{display:grid;grid-template-columns:1fr 1fr;gap:54px;align-items:center;max-width:1080px;margin:0 auto;}
.feat-grid.flip{direction:rtl;}.feat-grid.flip>*{direction:ltr;}
@media(max-width:760px){.feat-grid,.feat-grid.flip{grid-template-columns:1fr;direction:ltr;}}
.feat-h2{font-family:var(--font-d);font-size:clamp(25px,4vw,48px);font-weight:700;letter-spacing:-.03em;line-height:1.05;margin-bottom:13px;}
.feat-p{font-size:clamp(14px,1.6vw,17px);font-weight:300;color:var(--fg2);line-height:1.7;margin-bottom:17px;}
.tags{display:flex;gap:6px;flex-wrap:wrap;}
.tag{padding:4px 11px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.10);font-size:11px;font-weight:600;color:var(--fg2);}
.kpis{display:flex;gap:28px;margin-top:22px;}
.kpi-v{font-family:var(--font-d);font-size:38px;font-weight:700;letter-spacing:-.03em;line-height:1;}
.kpi-l{font-size:10px;color:var(--fg3);margin-top:3px;}
.visual-box{border-radius:21px;overflow:hidden;aspect-ratio:4/3;background:rgba(14,14,18,1);border:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;}
.cam-module{width:clamp(108px,17vw,165px);aspect-ratio:1;background:linear-gradient(145deg,#1c1c26,#0c0c14);border-radius:36px;border:1px solid rgba(255,255,255,.06);padding:13px;display:grid;grid-template-columns:1fr 1fr;gap:10px;box-shadow:0 40px 80px rgba(0,0,0,.72);}
.cam-lens{border-radius:50%;background:radial-gradient(circle at 34% 26%,#303040,#0a0a12);border:1.5px solid rgba(255,255,255,.05);position:relative;}
.cam-lens::after{content:'';position:absolute;width:26%;height:26%;top:18%;left:20%;border-radius:50%;background:radial-gradient(circle,rgba(200,228,255,.5),transparent);}
.cam-flash{border-radius:10px;background:linear-gradient(135deg,#ffd700,#ff9000);opacity:.7;}
.bat-scene{flex-direction:column;gap:13px;background:#050e08;width:100%;height:100%;display:flex;align-items:center;justify-content:center;}
.bat-ring{position:relative;width:92px;height:92px;}
.bat-ring svg{transform:rotate(-90deg);}
.bat-ring-label{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:23px;font-weight:700;color:var(--green);}
.bat-stats{display:flex;gap:16px;}
.bat-n{font-size:22px;font-weight:700;color:var(--green);line-height:1;}
.bat-l{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--fg3);margin-top:1px;}
.disp-panel{width:clamp(125px,19vw,185px);aspect-ratio:16/10;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:linear-gradient(148deg,#100828,#040210);position:relative;overflow:hidden;}
.disp-aurora{position:absolute;inset:0;background:conic-gradient(from 185deg at 50% 64%,rgba(0,212,255,.15),rgba(200,0,255,.22),rgba(255,0,100,.15),rgba(0,212,255,.15));animation:aur 11s linear infinite;}
@keyframes aur{to{transform:rotate(360deg)}}
.disp-body{position:relative;z-index:1;width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding:7px 8px;}
.disp-name{font-size:10px;font-weight:700;color:#fff;}
.disp-sub{font-size:7px;color:rgba(255,255,255,.45);margin-top:1px;}
.s-colors{background:#f5f5f7;color:#1d1d1f;}
.s-colors .eyebrow{color:var(--blue);}
.color-stage{display:flex;gap:40px;justify-content:center;align-items:flex-end;flex-wrap:wrap;margin-top:32px;}
.swatches{display:flex;flex-direction:column;gap:5px;}
.swatch{display:flex;align-items:center;gap:10px;padding:7px 12px;border-radius:12px;border:1.5px solid transparent;cursor:pointer;transition:background .25s;}
.swatch:hover{background:rgba(0,0,0,.06);}
.swatch.active{background:rgba(0,0,0,.08);border-color:rgba(0,0,0,.16);}
.swatch-dot{width:30px;height:30px;border-radius:50%;box-shadow:0 3px 12px rgba(0,0,0,.22);flex-shrink:0;transition:transform .25s var(--spring);}
.swatch.active .swatch-dot{transform:scale(1.2);}
.swatch-name{font-size:12px;font-weight:600;color:rgba(29,29,31,.88);}
.swatch-sub{font-size:10px;color:rgba(29,29,31,.46);margin-top:1px;}
.s-buy{text-align:center;max-width:680px;margin:0 auto;}
.storage-picker{display:inline-flex;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:3px;gap:2px;}
.storage-opt{padding:7px 18px;border-radius:12px;font-size:12px;font-weight:600;color:var(--fg3);cursor:pointer;transition:all .25s;}
.storage-opt.active{background:var(--fg);color:#1d1d1f;}
.price-main{font-family:var(--font-d);font-size:clamp(50px,9vw,88px);font-weight:700;letter-spacing:-.04em;line-height:1;margin:20px 0 4px;transition:opacity .14s;}
.price-mo{font-size:12px;color:var(--fg3);margin-bottom:30px;}
.buy-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
.buy-note{font-size:10px;color:var(--fg3);margin-top:20px;max-width:440px;margin-inline:auto;line-height:1.7;}
.lfoot{border-top:1px solid rgba(255,255,255,.08);padding:34px clamp(20px,5vw,64px);background:rgba(10,10,14,1);text-align:center;}
.foot-links{display:flex;gap:20px;flex-wrap:wrap;justify-content:center;margin-bottom:12px;}
.foot-link{font-size:11px;color:var(--fg3);cursor:pointer;}
.foot-copy{font-size:10px;color:rgba(255,255,255,.17);line-height:1.7;}
`;

/* ══════════════════════════════════════════════════════
   ATOMS
══════════════════════════════════════════════════════ */
function Petals() {
  return <>{Array.from({length:12},(_,i)=>(
    <div key={i} className="petal" style={{left:`${5+Math.random()*90}%`,width:`${6+Math.random()*12}px`,height:`${4+Math.random()*9}px`,top:"-30px",background:["rgba(232,82,122,.18)","rgba(212,168,83,.14)","rgba(232,82,122,.10)"][i%3],animationDuration:`${10+Math.random()*18}s`,animationDelay:`${Math.random()*14}s`}}/>
  ))}</>;
}
function BurstHearts(){
  return <div className="burst-hearts">{Array.from({length:24},(_,i)=>(
    <div key={i} className="burst-heart-p" style={{left:`${5+Math.random()*90}%`,top:`${55+Math.random()*35}%`,fontSize:`${14+Math.random()*22}px`,"--r":`${Math.random()*60-30}deg`,animationDuration:`${2+Math.random()*2.5}s`,animationDelay:`${Math.random()*.9}s`}}>{"❤️💕🌹✨💖🫶💋🥰"[i%8]}</div>
  ))}</div>;
}
function Phone({ frameHi, frameLo }) {
  const g=`linear-gradient(180deg,${frameHi},${frameLo})`;
  return (
    <div className="phone" style={{"--frame-hi":frameHi,"--frame-lo":frameLo}}>
      <div className="phone-screen">
        <div className="phone-island"/><div className="phone-time">9:41</div>
        <div className="phone-date">Tuesday, March 10</div>
      </div>
      {["action","vol1","vol2","power"].map(k=>(
        <div key={k} className={`phone-btn phone-btn-${k}`} style={{background:g}}/>
      ))}
      <div className="phone-port"/>
    </div>
  );
}
function BatRing(){
  const r=40,c=2*Math.PI*r,ref=useRef(null);
  useEffect(()=>{const el=ref.current;if(!el)return;el.style.strokeDashoffset=String(c);requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.transition="stroke-dashoffset 1.6s cubic-bezier(.22,1,.36,1)";el.style.strokeDashoffset=String(c*.25);}));},[]);
  return <div className="bat-ring">
    <svg width="92" height="92" viewBox="0 0 92 92" style={{transform:"rotate(-90deg)"}}>
      <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="5"/>
      <circle ref={ref} cx="46" cy="46" r={r} fill="none" stroke="#30d158" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} style={{filter:"drop-shadow(0 0 8px rgba(48,209,88,.6))"}}/>
    </svg>
    <div className="bat-ring-label">75%</div>
  </div>;
}
function FloatReact({emoji,x,y,onDone}){
  const dur=2.2+Math.random()*.8,fs=26+Math.random()*20;
  useEffect(()=>{const t=setTimeout(onDone,(dur+.1)*1000);return()=>clearTimeout(t);},[]);
  return <div className="float-react" style={{left:x,top:y,"--fs":`${fs}px`,"--dur":`${dur}s`}}>{emoji}</div>;
}
function MusicBars(){
  return <div className="music-bars">{[11,6,10,4,9,7,12].map((h,i)=><div key={i} className="music-bar" style={{"--h":`${h}px`,"--d":`${.28+i*.1}s`}}/>)}</div>;
}
/* ══════════════════════════════════════════════════════
   📳 VIBE PANEL & RIPPLE
══════════════════════════════════════════════════════ */
function VibePanel({ onSend }) {
  return (
    <div className="vibe-panel">
      <div className="vibe-panel-title">Отправить вибрацию</div>
      <div className="vibe-opts">
        {VIBE_PATTERNS.map(p => (
          <div key={p.id} className="vibe-opt"
            style={{"--vibe-color": p.color}}
            onClick={() => onSend(p)}>
            <span className="vibe-opt-emoji">{p.emoji}</span>
            <div>
              <div className="vibe-opt-label">{p.label}</div>
              <div className="vibe-opt-hint">{p.pattern.join("·")} мс</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VibeRipple({ vibe, partner, onDone }) {
  const p = VIBE_PATTERNS.find(x => x.id === vibe.id) || VIBE_PATTERNS[0];
  // 3 staggered rings
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="vibe-ripple" style={{"--vibe-color": p.color}}>
      {[0, 350, 700].map((delay, i) => (
        <div key={i} className="vibe-ripple-ring"
          style={{position:"absolute",left:"50%",top:"50%","--vd":"1.6s",animationDelay:`${delay}ms`}}/>
      ))}
      <div className="vibe-ripple-icon">{p.emoji}</div>
      <div className="vibe-ripple-text">@{normalize(partner)}</div>
      <div className="vibe-ripple-sub">{p.label}</div>
    </div>
  );
}

function SurpriseOverlay({from,message,onClose}){
  return <div className="surprise-wrap" onClick={onClose}>
    <div className="surprise-card" onClick={e=>e.stopPropagation()}>
      <div style={{position:"absolute",inset:0,overflow:"hidden",borderRadius:32,pointerEvents:"none"}}><Petals/></div>
      <span className="surprise-hearts">🌹</span>
      <div className="surprise-title">Для тебя</div>
      <div className="surprise-msg">"{message}"</div>
      <div className="surprise-from">— с любовью, @{normalize(from)} 💕</div>
      <button className="surprise-btn" onClick={onClose}>Обнять в ответ 🤗</button>
    </div>
  </div>;
}
function TogetherTimer({connectedAt}){
  const [e,setE]=useState(0);
  useEffect(()=>{const iv=setInterval(()=>setE(Math.floor((Date.now()-connectedAt)/1000)),1000);return()=>clearInterval(iv);},[connectedAt]);
  const m=Math.floor(e/60),s=e%60;
  return <div className="timer-pill"><div className="timer-dot"/><span style={{color:"var(--fg3)"}}>Вместе</span><span className="timer-val">{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</span></div>;
}

/* ══════════════════════════════════════════════════════
   🎤 VOICE NOTE — recorder + player
══════════════════════════════════════════════════════ */
function VoicePlayer({ audioData, duration }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioData) return;
    const blob = base64ToBlob(audioData, "audio/webm");
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => setPlaying(false);
    audioRef.current = audio;
    return () => { audio.pause(); URL.revokeObjectURL(url); };
  }, [audioData]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); a.currentTime = 0; setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  const bars = Array.from({ length: 16 }, (_, i) => Math.max(4, Math.sin(i * 1.3 + 1) * 10 + Math.random() * 6 + 4));
  const fmt = s => `0:${String(Math.round(s || 0)).padStart(2, "0")}`;

  return (
    <div className="voice-player">
      <button className="voice-play-btn" onClick={toggle}>
        {playing
          ? <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="3" height="8" rx="1" fill="white"/><rect x="6" y="1" width="3" height="8" rx="1" fill="white"/></svg>
          : <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 1l7 4-7 4V1z" fill="white"/></svg>}
      </button>
      <div className="voice-waveform">
        {bars.map((h, i) => (
          <div key={i} className="voice-bar" style={{ height: playing ? `${h}px` : "4px", background: playing ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.3)" }}/>
        ))}
      </div>
      <span className="voice-duration">{fmt(duration)}</span>
    </div>
  );
}

function base64ToBlob(b64, type) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

/* ══════════════════════════════════════════════════════
   💋 KISS TIMER
══════════════════════════════════════════════════════ */
function KissOverlay({ myKissing, partnerKissing, kissStart, partner }) {
  const [elapsed, setElapsed] = useState(0);
  const bothKissing = myKissing && partnerKissing;

  useEffect(() => {
    if (!bothKissing || !kissStart) return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - kissStart) / 1000)), 100);
    return () => clearInterval(iv);
  }, [bothKissing, kissStart]);

  if (!myKissing && !partnerKissing) return null;

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="kiss-overlay">
      {bothKissing ? (
        <div className="kiss-counter">
          <span className="kiss-emoji">💋</span>
          <div className="kiss-time">{fmt(elapsed)}</div>
          <div className="kiss-label">Держите…</div>
        </div>
      ) : (
        <div className="kiss-waiting">
          {myKissing ? (
            <>Ждём <strong>@{normalize(partner)}</strong>… зажми 💋</>
          ) : (
            <><strong>@{normalize(partner)}</strong> ждёт тебя! Зажми 💋</>
          )}
        </div>
      )}
      {myKissing && (
        <div className="kiss-record">
          <div className="kiss-record-dot"/>
          Держи кнопку 💋 в риббоне
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   🎵 PLAYLIST PANEL
══════════════════════════════════════════════════════ */
function PlaylistPanel({ me, partner, onClose }) {
  const [myTracks, setMyTracks]         = useState([]);
  const [partnerTracks, setPartnerTracks] = useState([]);
  const [input, setInput]               = useState("");
  const [artistInput, setArtistInput]   = useState("");
  const [tab, setTab]                   = useState(0); // 0=all 1=mine 2=theirs

  useEffect(() => {
    loadPlaylist(me).then(setMyTracks);
    loadPlaylist(partner).then(setPartnerTracks);
    const iv = setInterval(() => loadPlaylist(partner).then(setPartnerTracks), 2000);
    return () => clearInterval(iv);
  }, [me, partner]);

  const addTrack = async () => {
    const title = input.trim(); if (!title) return;
    const track = { title, artist: artistInput.trim() || "Unknown", addedBy: me, ts: Date.now() };
    const updated = [...myTracks, track];
    setMyTracks(updated);
    await savePlaylist(me, updated);
    setInput(""); setArtistInput("");
  };

  const allTracks = [...myTracks, ...partnerTracks].sort((a, b) => a.ts - b.ts);
  const displayed = tab === 0 ? allTracks : tab === 1 ? myTracks : partnerTracks;

  const EMOJIS = ["🎵","🎶","🎸","🎹","🥁","🎻","🎷","🎺"];

  return (
    <div className="playlist-panel">
      <div className="pl-hd">
        <div>
          <div className="pl-hd-title">🎵 Наш плейлист</div>
          <div className="pl-hd-sub">{allTracks.length} треков вместе</div>
        </div>
        <div className="pl-x" onClick={onClose}>✕</div>
      </div>

      {/* tabs */}
      <div style={{display:"flex",gap:4,padding:"6px 8px 0",borderBottom:"1px solid rgba(232,82,122,.10)"}}>
        {["Все","Мои","Её"].map((t,i)=>(
          <div key={i} onClick={()=>setTab(i)} style={{fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:8,cursor:"pointer",background:tab===i?"rgba(232,82,122,.18)":"transparent",color:tab===i?"var(--rose-hi)":"var(--fg3)",transition:"all .18s"}}>
            {t}
          </div>
        ))}
      </div>

      <div className="pl-list">
        {displayed.length === 0 && (
          <div className="pl-empty">Добавь первый трек 🎵<br/>Ваш плейлист на двоих</div>
        )}
        {displayed.map((t, i) => (
          <div key={t.ts + i} className="pl-item">
            <div className="pl-item-icon">{EMOJIS[i % EMOJIS.length]}</div>
            <div className="pl-item-info">
              <div className="pl-item-title">{t.title}</div>
              <div className="pl-item-artist">{t.artist}</div>
            </div>
            <div className="pl-item-by">@{normalize(t.addedBy)}</div>
          </div>
        ))}
      </div>

      <div className="pl-add" style={{flexDirection:"column",gap:5,padding:"8px 10px"}}>
        <input className="pl-input" placeholder="Название песни…" value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&addTrack()}/>
        <div style={{display:"flex",gap:6}}>
          <input className="pl-input" placeholder="Артист…" value={artistInput}
            onChange={e=>setArtistInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addTrack()}/>
          <button className="pl-btn" disabled={!input.trim()} onClick={addTrack}>
            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1v10M1 6h10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   LANDING
══════════════════════════════════════════════════════ */
const DEFAULT_MSG = "Ты — лучшее, что есть в моей жизни. Спасибо, что смотришь это со мной 🌹";

function Landing({ me, partner, surpriseMsg, connectedAt, onDisconnect }) {
  const [navScrolled, setNavScrolled]     = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [color, setColor]     = useState("black");
  const [storage, setStorage] = useState("256");
  const [price, setPrice]     = useState(1199);
  const [monthly, setMonthly] = useState(33.25);
  const [priceVis, setPriceVis] = useState(true);

  // partner live
  const [partnerScroll, setPartnerScroll]   = useState(null);
  const [partnerSection, setPartnerSection] = useState(null);
  const [partnerCursor, setPartnerCursor]   = useState(null);

  // reactions
  const [showReacts, setShowReacts] = useState(false);
  const [floatReacts, setFloatReacts] = useState([]);
  const reactId = useRef(0);

  // chat
  const [showChat, setShowChat]   = useState(false);
  const [msgs, setMsgs]           = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [unread, setUnread]       = useState(0);
  const lastMsgTs = useRef(0);
  const msgsEnd   = useRef(null);

  // 🎤 voice
  const [isRecording, setIsRecording]   = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const recordStartRef   = useRef(null);

  // 💋 kiss
  const [myKissing, setMyKissing]         = useState(false);
  const [partnerKissing, setPartnerKissing] = useState(false);
  const [kissStart, setKissStart]         = useState(null);
  const [lastKissDur, setLastKissDur]     = useState(null);
  const kissToastKey = useRef(0);
  const [kissToast, setKissToast]         = useState(null);

  // 🎵 playlist
  const [showPlaylist, setShowPlaylist] = useState(false);

  // 📳 vibration
  const [showVibe, setShowVibe]         = useState(false);
  const [vibeRipple, setVibeRipple]     = useState(null); // { id, ts } of incoming vibe
  const [vibeSentFlash, setVibeSentFlash] = useState(false);
  const lastVibeTs = useRef(0);

  // misc
  const [showCanvas, setShowCanvas]     = useState(false);
  const [colorToast, setColorToast]     = useState(null);
  const [syncToast, setSyncToast]       = useState(false);
  const [musicOn, setMusicOn]           = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);
  const [surprise, setSurprise]         = useState(false);
  const surpriseFired = useRef(false);

  const scrollRef    = useRef(null);
  const sectionRefs  = useRef({});
  const stateRef     = useRef({ scroll: 0, cursor: null });
  const saveThrottle = useRef(0);
  const cfg = COLORS.find(c => c.id === color) || COLORS[0];

  const flush = useCallback(async (extra = {}) => {
    const now = Date.now();
    if (now - saveThrottle.current < 350) return;
    saveThrottle.current = now;
    await saveState(me, { scroll: stateRef.current.scroll, cursor: stateRef.current.cursor, ...extra });
  }, [me]);

  /* scroll */
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const fn = () => {
      const pct = el.scrollTop / (el.scrollHeight - el.clientHeight);
      stateRef.current.scroll = isNaN(pct) ? 0 : pct;
      setNavScrolled(el.scrollTop > 20);
      for (const [id, ref] of Object.entries(sectionRefs.current)) {
        if (!ref) continue;
        const r = ref.getBoundingClientRect();
        if (r.top <= el.clientHeight * .4 && r.bottom > 0) { setActiveSection(id); break; }
      }
      if (!surpriseFired.current && stateRef.current.scroll > 0.96) {
        surpriseFired.current = true; setSurprise(true);
      }
      flush();
    };
    el.addEventListener("scroll", fn, { passive: true });
    return () => el.removeEventListener("scroll", fn);
  }, [flush]);

  /* cursor */
  useEffect(() => {
    const fn = e => { stateRef.current.cursor = { x: e.clientX/window.innerWidth, y: e.clientY/window.innerHeight }; flush(); };
    window.addEventListener("mousemove", fn);
    return () => window.removeEventListener("mousemove", fn);
  }, [flush]);

  /* poll partner */
  useEffect(() => {
    const iv = setInterval(async () => {
      const d = await loadState(partner); if (!d) return;
      if (d.scroll != null) {
        setPartnerScroll(d.scroll);
        const idx = Math.min(Math.floor(d.scroll * SECTIONS.length), SECTIONS.length - 1);
        setPartnerSection(SECTIONS[idx]?.label ?? null);
      }
      if (d.cursor) setPartnerCursor(d.cursor);
      if (d.reaction && d.reaction.ts > (reactId._last || 0)) {
        reactId._last = d.reaction.ts;
        const id = ++reactId.current;
        setFloatReacts(p => [...p, { id, emoji: d.reaction.emoji, x: `${d.reaction.x}%`, y: `${d.reaction.y}%` }]);
      }
      if (d.msg && d.msg.ts > lastMsgTs.current) {
        lastMsgTs.current = d.msg.ts;
        setMsgs(p => [...p, { ...d.msg, from: partner }]);
        if (!showChat) setUnread(n => n + 1);
      }
      if (d.colorId && d.colorId !== color) {
        const nc = COLORS.find(c => c.id === d.colorId);
        if (nc) { setColor(d.colorId); setColorToast(nc); setTimeout(() => setColorToast(null), 2800); }
      }
      // 💋 kiss sync
      const pk = d.kissing || false;
      setPartnerKissing(pk);
      if (pk && myKissing && !kissStart) setKissStart(d.kissTs || Date.now());

      // 📳 vibe receive
      if (d.vibe && d.vibe.ts > lastVibeTs.current) {
        lastVibeTs.current = d.vibe.ts;
        const pat = VIBE_PATTERNS.find(p => p.id === d.vibe.id);
        if (pat && navigator.vibrate) {
          navigator.vibrate(pat.pattern);
        }
        setVibeRipple({ id: d.vibe.id, ts: d.vibe.ts });
      }
    }, POLL_MS);
    return () => clearInterval(iv);
  }, [partner, showChat, color, myKissing, kissStart]);

  useEffect(() => { msgsEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, showChat]);
  useEffect(() => { if (showChat) setUnread(0); }, [showChat]);

  const scrollTo = id => sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth" });
  const changeStorage = key => {
    const [p, m] = PRICES[key]; setStorage(key); setPriceVis(false);
    setTimeout(() => { setPrice(p); setMonthly(m); setPriceVis(true); }, 140);
  };
  const changeColor = async id => { setColor(id); await flush({ colorId: id }); };

  const sendReaction = async emoji => {
    setShowReacts(false);
    const x = 35 + Math.random() * 30, y = 25 + Math.random() * 45;
    const id = ++reactId.current;
    setFloatReacts(p => [...p, { id, emoji, x: `${x}%`, y: `${y}%` }]);
    const st = await loadState(me) || {};
    await saveState(me, { ...st, reaction: { emoji, x, y, ts: Date.now() } });
  };

  const sendMsg = async (text, moment = false, section = null, voiceData = null, voiceDur = null) => {
    const ts = Date.now();
    setMsgs(p => [...p, { text, from: me, ts, moment, section, voiceData, voiceDur }]);
    const st = await loadState(me) || {};
    await saveState(me, { ...st, msg: { text, ts, moment, section, voiceData, voiceDur } });
  };

  const captureMoment = () => {
    setCaptureFlash(true); setTimeout(() => setCaptureFlash(false), 400);
    setShowChat(true);
    const label = SECTIONS.find(s => s.id === activeSection)?.label || activeSection;
    sendMsg(`📸 Снимок раздела "${label}"`, true, label);
  };

  const syncScroll = () => {
    if (partnerScroll === null) return;
    const el = scrollRef.current; if (!el) return;
    el.scrollTo({ top: partnerScroll * (el.scrollHeight - el.clientHeight), behavior: "smooth" });
    setSyncToast(true); setTimeout(() => setSyncToast(false), 2800);
  };

  const toggleMusic = () => {
    if (musicOn) { ambient.stop(); setMusicOn(false); }
    else { ambient.start(); setMusicOn(true); }
  };

  /* 🎤 VOICE RECORDING */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mr.ondataavailable = e => audioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size > 10) {
          const dur = (Date.now() - recordStartRef.current) / 1000;
          const reader = new FileReader();
          reader.onloadend = async () => {
            const b64 = reader.result.split(",")[1];
            setShowChat(true);
            await sendMsg("🎤 Голосовое сообщение", false, null, b64, dur);
          };
          reader.readAsDataURL(blob);
        }
        setIsRecording(false);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      recordStartRef.current = Date.now();
      setIsRecording(true);
      // auto-stop after 30s
      setTimeout(() => { if (mr.state === "recording") mr.stop(); }, 30000);
    } catch (e) {
      console.warn("Mic access denied", e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  /* 💋 KISS */
  const startKiss = async () => {
    setMyKissing(true);
    const ts = Date.now();
    await flush({ kissing: true, kissTs: ts });
    if (partnerKissing) setKissStart(ts);
  };

  const endKiss = async () => {
    if (!myKissing) return;
    const dur = kissStart ? Math.floor((Date.now() - kissStart) / 1000) : null;
    setMyKissing(false); setKissStart(null);
    await flush({ kissing: false });
    if (partnerKissing && dur && dur > 0) {
      const key = ++kissToastKey.current;
      setKissToast({ key, dur });
      setTimeout(() => setKissToast(t => t?.key === key ? null : t), 5000);
    }
  };

  /* 📳 SEND VIBE */
  const sendVibe = async (pattern) => {
    setShowVibe(false);
    // local haptic feedback for sender too
    if (navigator.vibrate) navigator.vibrate([40]);
    setVibeSentFlash(true);
    setTimeout(() => setVibeSentFlash(false), 600);
    const st = await loadState(me) || {};
    await saveState(me, { ...st, vibe: { id: pattern.id, ts: Date.now() } });
  };

  const ghostTop = partnerScroll !== null ? `calc(${partnerScroll * 100}% - 18px)` : null;

  return (
    <div ref={scrollRef} className="land-wrap"
      style={{ height: "100vh", overflowY: "scroll", overflowX: "hidden", position: "relative" }}>

      <TogetherTimer connectedAt={connectedAt} />

      {/* NAV */}
      <nav className={`lnav ${navScrolled ? "scrolled" : ""}`}>
        <span className="lnav-logo">&#63743;</span>
        <ul className="lnav-links">
          {SECTIONS.map(s => (
            <li key={s.id}><span className={`lnav-link ${activeSection === s.id ? "active" : ""}`} onClick={() => scrollTo(s.id)}>{s.label}</span></li>
          ))}
        </ul>
        <button className="lnav-cta" onClick={() => scrollTo("buy")}>Купить</button>
      </nav>

      {/* ── SECTIONS ── */}
      <section id="hero" ref={el => sectionRefs.current.hero = el} style={{ padding: "0 clamp(20px,5vw,64px)" }}>
        <div className="s-hero">
          <div>
            <span className="eyebrow">New — Spring 2025</span>
            <h1 className="hero-h1">iPhone&nbsp;17<br/>Pro</h1>
            <p className="hero-tag">Intelligence, reimagined.</p>
            <div className="hero-btns">
              <button className="btn-p" onClick={() => scrollTo("buy")}>Купить iPhone 17 Pro</button>
              <button className="btn-g" onClick={() => scrollTo("camera")}>Подробнее ›</button>
            </div>
          </div>
          <div className="phone-wrap"><Phone frameHi={cfg.hi} frameLo={cfg.lo} /></div>
        </div>
      </section>

      <section id="chip" ref={el => sectionRefs.current.chip = el} style={{ background: "rgba(10,10,14,1)", padding: "clamp(80px,12vw,140px) clamp(20px,5vw,64px)", textAlign: "center" }}>
        <div style={{ maxWidth: 840, margin: "0 auto" }}>
          <span className="eyebrow">Производительность</span>
          <h2 className="section-h2">A19&nbsp;Pro Bionic.<br /><em>Нейронная мощь.</em></h2>
          <p className="section-sub">Архитектура 3 нм. 40 миллиардов транзисторов.</p>
          <div className="stats">
            <div className="stat"><p className="stat-n">40<span className="stat-u">B</span></p><p className="stat-l">транзисторов</p></div>
            <div className="stat"><p className="stat-n">4<span className="stat-u">×</span></p><p className="stat-l">Neural Engine</p></div>
            <div className="stat"><p className="stat-n">3<span className="stat-u">nm</span></p><p className="stat-l">техпроцесс</p></div>
          </div>
        </div>
      </section>

      <section id="camera" ref={el => sectionRefs.current.camera = el} className="feat-block" style={{ padding: "clamp(80px,12vw,140px) clamp(20px,5vw,64px)" }}>
        <div className="feat-grid">
          <div>
            <span className="eyebrow">Система камер</span>
            <h2 className="feat-h2">Видит то, что другие упускают.</h2>
            <p className="feat-p">200 МП основная, перископный телефото 10×, ProRAW Quantum.</p>
            <div className="tags"><span className="tag">200MP</span><span className="tag">10× Periscope</span><span className="tag">4K 240fps</span></div>
          </div>
          <div className="visual-box">
            <div className="cam-module">
              <div className="cam-lens" /><div className="cam-lens" /><div className="cam-lens" /><div className="cam-flash" />
            </div>
          </div>
        </div>
      </section>

      <section id="battery" ref={el => sectionRefs.current.battery = el} className="feat-block" style={{ padding: "clamp(80px,12vw,140px) clamp(20px,5vw,64px)" }}>
        <div className="feat-grid flip">
          <div>
            <span className="eyebrow">Автономность</span>
            <h2 className="feat-h2">Весь день. И ещё немного.</h2>
            <p className="feat-p">До 32 часов видео. До 80% за 30 мин через MagSafe 65W.</p>
            <div className="kpis">
              <div><div className="kpi-v" style={{ color: "var(--green)" }}>32h</div><div className="kpi-l">видео</div></div>
              <div><div className="kpi-v" style={{ color: "var(--green)" }}>30m</div><div className="kpi-l">до 80%</div></div>
            </div>
          </div>
          <div className="visual-box">
            <div className="bat-scene">
              <BatRing />
              <div className="bat-stats">
                {[["32h","Видео"],["24h","5G"],["100h","Музыка"]].map(([n,l]) => (
                  <div key={l}><div className="bat-n">{n}</div><div className="bat-l">{l}</div></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="display" ref={el => sectionRefs.current.display = el} className="feat-block" style={{ padding: "clamp(80px,12vw,140px) clamp(20px,5vw,64px)" }}>
        <div className="feat-grid">
          <div>
            <span className="eyebrow">Super Retina XDR</span>
            <h2 className="feat-h2">Дисплей — это и есть опыт.</h2>
            <p className="feat-p">6,9" ProMotion OLED · Always-On · 3 000 нит · Pantone</p>
            <div className="tags"><span className="tag">6.9″</span><span className="tag">3 000 нит</span><span className="tag">120Hz</span><span className="tag">Always-On</span></div>
          </div>
          <div className="visual-box">
            <div className="disp-panel">
              <div className="disp-aurora" />
              <div className="disp-body"><div className="disp-name">6.9″ · 460ppi</div><div className="disp-sub">3 000 нит · Dolby Vision</div></div>
            </div>
          </div>
        </div>
      </section>

      <section id="colors" ref={el => sectionRefs.current.colors = el} className="s-colors" style={{ padding: "clamp(80px,12vw,140px) clamp(20px,5vw,64px)", textAlign: "center" }}>
        <span className="eyebrow">Цвет</span>
        <h2 className="section-h2" style={{ color: "#1d1d1f" }}>Выбери цвет вместе.</h2>
        <p className="section-sub" style={{ color: "rgba(29,29,31,.6)" }}>Нажми — у вас обоих изменится одновременно.</p>
        <div className="color-stage">
          <Phone frameHi={cfg.hi} frameLo={cfg.lo} />
          <div className="swatches">
            {COLORS.map(c => (
              <div key={c.id} className={`swatch ${color === c.id ? "active" : ""}`} onClick={() => changeColor(c.id)}>
                <div className="swatch-dot" style={{ background: `linear-gradient(135deg,${c.hi},${c.lo})` }} />
                <div><div className="swatch-name">{c.name}</div><div className="swatch-sub">Titanium Grade 5</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="buy" ref={el => sectionRefs.current.buy = el} style={{ padding: "clamp(80px,12vw,140px) clamp(20px,5vw,64px)", textAlign: "center", background: "radial-gradient(ellipse 52% 60% at 50% 100%,rgba(0,113,227,.16) 0%,transparent 60%)" }}>
        <div className="s-buy">
          <span className="eyebrow">iPhone 17 Pro</span>
          <h2 className="section-h2">Начать здесь.</h2>
          <div className="storage-picker" style={{ marginTop: 24 }}>
            {Object.keys(PRICES).map(k => (
              <div key={k} className={`storage-opt ${storage === k ? "active" : ""}`} onClick={() => changeStorage(k)}>
                {k === "1tb" ? "1TB" : k === "2tb" ? "2TB" : k}
              </div>
            ))}
          </div>
          <div className="price-main" style={{ opacity: priceVis ? 1 : 0 }}>${price.toLocaleString()}</div>
          <div className="price-mo">или ${monthly.toFixed(2)}/мес. на 36 мес.</div>
          <div className="buy-btns">
            <button className="btn-p">Купить iPhone 17 Pro</button>
            <button className="btn-g" style={{ color: "var(--fg)", borderColor: "rgba(255,255,255,.18)" }}>Сравнить</button>
          </div>
          <p className="buy-note">Концептуальная разработка, не реальный продукт Apple.</p>
        </div>
      </section>

      <footer className="lfoot">
        <div className="foot-links">
          {["Конфиденциальность","Условия","Возврат","Правовая информация"].map(l => (
            <span key={l} className="foot-link">{l}</span>
          ))}
        </div>
        <p className="foot-copy">Copyright © 2025 Apple Inc. iPhone 17 Pro — концепт.</p>
      </footer>

      {/* ═══ OVERLAYS ═══ */}
      {ghostTop && <div className="partner-bar">
        <div className="partner-bar-track" />
        <div className="partner-bar-thumb" style={{ top: ghostTop }} />
      </div>}

      {partnerCursor && <div className="partner-cursor" style={{ left: `${partnerCursor.x * 100}%`, top: `${partnerCursor.y * 100}%` }}>
        <div className="partner-cursor-dot" />
        <div className="partner-cursor-lbl">@{normalize(partner)}</div>
      </div>}

      {floatReacts.map(r => <FloatReact key={r.id} {...r} onDone={() => setFloatReacts(p => p.filter(x => x.id !== r.id))} />)}

      {showReacts && <div className="react-panel">
        {REACTS.map(e => <span key={e} className="react-em" onClick={() => sendReaction(e)}>{e}</span>)}
      </div>}

      {/* 💋 KISS OVERLAY */}
      <KissOverlay myKissing={myKissing} partnerKissing={partnerKissing} kissStart={kissStart} partner={partner} />

      {/* 💋 LAST KISS TOAST */}
      {kissToast && <div key={kissToast.key} className="last-kiss-toast">
        💋 <strong>{kissToast.dur}с</strong> — ваш поцелуй
      </div>}

      {/* 💬 CHAT */}
      {showChat && <div className="chat-panel">
        <div className="chat-hd">
          <div><div className="chat-hd-title">💬 @{normalize(partner)}</div><div className="chat-hd-sub">Только вы двое</div></div>
          <div className="chat-x" onClick={() => setShowChat(false)}>✕</div>
        </div>
        <div className="chat-msgs">
          {msgs.length === 0 && <div className="chat-empty">Напиши первым 🌹</div>}
          {msgs.map((m, i) => (
            <div key={i} className={`chat-msg ${m.from === me ? "mine" : "theirs"} ${m.moment ? "moment" : ""} ${m.voiceData ? "voice" : ""}`}>
              {m.from !== me && <div className="chat-msg-from">@{normalize(m.from)}</div>}
              {m.moment && <div className="chat-moment-sec">📸 {m.section}</div>}
              {m.voiceData
                ? <VoicePlayer audioData={m.voiceData} duration={m.voiceDur} />
                : <div style={{ fontStyle: m.moment ? "italic" : "normal" }}>{m.text}</div>}
            </div>
          ))}
          <div ref={msgsEnd} />
        </div>
        <div className="chat-input-row">
          <button
            className={`chat-voice-btn ${isRecording ? "recording" : ""}`}
            onMouseDown={startRecording} onMouseUp={stopRecording}
            onTouchStart={startRecording} onTouchEnd={stopRecording}
            title="Зажми для записи голосового">
            🎤
          </button>
          <input className="chat-input" placeholder="Напиши…" value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && chatInput.trim()) { sendMsg(chatInput.trim()); setChatInput(""); } }} />
          <button className="chat-send" disabled={!chatInput.trim()}
            onClick={() => { if (chatInput.trim()) { sendMsg(chatInput.trim()); setChatInput(""); } }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M13 1L1 5.5l5 2 2 5L13 1z" fill="white" /></svg>
          </button>
        </div>
      </div>}

      {/* 🎵 PLAYLIST */}
      {showPlaylist && <PlaylistPanel me={me} partner={partner} onClose={() => setShowPlaylist(false)} />}

      {colorToast && <div className="color-toast">
        <div className="color-swatch-preview" style={{ background: `linear-gradient(135deg,${colorToast.hi},${colorToast.lo})` }} />
        <span>@{normalize(partner)} выбрал <span style={{ color: "var(--rose-hi)" }}>{colorToast.name}</span></span>
      </div>}
      {syncToast && <div className="sync-toast">✦ Перемотано к @{normalize(partner)}</div>}
      {captureFlash && <div className="capture-flash" />}
      {surprise && <SurpriseOverlay from={partner} message={surpriseMsg || DEFAULT_MSG} onClose={() => setSurprise(false)} />}

      {/* 📳 VIBE PANEL */}
      {showVibe && <VibePanel onSend={sendVibe} />}

      {/* 📳 VIBE RIPPLE (incoming) */}
      {vibeRipple && <VibeRipple key={vibeRipple.ts} vibe={vibeRipple} partner={partner} onDone={() => setVibeRipple(null)} />}

      {/* RIBBON */}
      <div className="ribbon">
        <span className="ribbon-heart">💕</span>
        <div className="ribbon-ava">{normalize(partner)[0]}</div>
        <div className="ribbon-text">Вместе с <strong><span className="ribbon-at">@</span>{normalize(partner)}</strong></div>
        {partnerSection && <div className="ribbon-sec">↑ {partnerSection}</div>}

        <div className="ribbon-actions">
          {/* 🎵 Music */}
          <div className={`rbtn ${musicOn ? "active" : ""}`} onClick={toggleMusic} title="Ambient музыка">
            {musicOn ? <MusicBars /> : "🎵"}
          </div>
          {/* 🎵 Playlist */}
          <div className={`rbtn ${showPlaylist ? "active" : ""}`} onClick={() => { setShowPlaylist(p => !p); setShowChat(false); setShowReacts(false); }} title="Плейлист">🎶</div>
          {/* 📸 Capture */}
          <div className="rbtn" onClick={captureMoment} title="Захватить момент">📸</div>
          {/* 📳 Vibration */}
          <div className={`rbtn ${showVibe ? "active" : ""} ${vibeSentFlash ? "vibe-sent" : ""}`}
            onClick={() => { setShowVibe(p => !p); setShowReacts(false); setShowChat(false); setShowPlaylist(false); }}
            title="Отправить вибрацию">📳</div>
          {/* 🎯 Reactions */}
          <div className={`rbtn ${showReacts ? "active" : ""}`} onClick={() => { setShowReacts(p => !p); setShowChat(false); setShowPlaylist(false); }}>🎯</div>
          {/* 💋 Kiss */}
          <div
            className={`rbtn ${myKissing ? "kiss-active" : ""}`}
            onMouseDown={startKiss} onMouseUp={endKiss}
            onTouchStart={startKiss} onTouchEnd={endKiss}
            title="Зажми для поцелуя 💋">
            💋
          </div>
          {/* 💬 Chat */}
          <div style={{ position: "relative" }}>
            <div className={`rbtn ${showChat ? "active" : ""}`} onClick={() => { setShowChat(p => !p); setShowReacts(false); setShowPlaylist(false); }}>💬</div>
            {unread > 0 && !showChat && <div className="rbtn-badge">{unread}</div>}
          </div>
          {/* 🔄 Sync */}
          <div className="rbtn" onClick={syncScroll} title="Перейти к ней">🔄</div>
        </div>
        <div className="ribbon-disc" onClick={onDisconnect}>Выйти</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TELEGRAM MINI APP HOOK
══════════════════════════════════════════════════════ */
function useTelegram() {
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
  const isTMA = !!(tg && tg.initData);

  useEffect(() => {
    if (!tg || !isTMA) return;
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#0d0810');
    tg.setBackgroundColor('#0d0810');
  }, []);

  const user     = tg?.initDataUnsafe?.user;
  const username = user?.username || '';
  const startParam = tg?.initDataUnsafe?.start_param || '';

  const shareInvite = (myUsername) => {
    const botName = import.meta.env.VITE_BOT_USERNAME || 'duo_viewer_bot';
    const url  = `https://t.me/${botName}?startapp=${encodeURIComponent(myUsername)}`;
    const text = `Смотрим вместе 💕 — нажми и введи @${myUsername}`;
    if (tg && isTMA) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    } else {
      navigator.clipboard?.writeText(url);
    }
  };

  return { isTMA, username, startParam, shareInvite };
}

/* ══════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════ */
export default function App() {
  const [phase, setPhase]     = useState("connect");
  const [me, setMe]           = useState("");
  const [partner, setPartner] = useState("");
  const [meInput, setMeInput] = useState("");
  const [partnerInput, setPartnerInput] = useState("");
  const [surpriseInput, setSurpriseInput] = useState("");
  const [error, setError]     = useState("");
  const [connectedAt, setConnectedAt] = useState(null);
  const [copied, setCopied]   = useState(false);
  const pollRef  = useRef(null);
  const burstRef = useRef(null);

  const { isTMA, username, startParam, shareInvite } = useTelegram();

  useEffect(() => {
    const tag = document.createElement("style"); tag.textContent = CSS;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  // Auto-fill from Telegram
  useEffect(() => {
    if (username)   setMeInput(username);
    if (startParam) setPartnerInput(startParam);
  }, [username, startParam]);

  const startPolling = useCallback((myName, pName) => {
    pollRef.current = setInterval(async () => {
      const d = await loadPresence(pName);
      if (d && d.wants === normalize(myName)) {
        clearInterval(pollRef.current);
        setMe(myName); setPartner(pName);
        setPhase("burst");
        burstRef.current = setTimeout(() => {
          setConnectedAt(Date.now());
          setPhase("landing");
        }, 3200);
      }
    }, POLL_MS);
  }, []);

  useEffect(() => () => {
    clearInterval(pollRef.current); clearTimeout(burstRef.current);
    if (me) clearPresence(me); ambient.stop();
  }, [me]);

  const handleConnect = async () => {
    const myName = meInput.trim(), pName = partnerInput.trim();
    if (!myName || !pName) { setError("Заполни оба поля."); return; }
    if (normalize(myName) === normalize(pName)) { setError("Нельзя подключиться к самому себе 😊"); return; }
    setError("");
    await savePresence(myName, pName);
    setPhase("waiting");
    startPolling(myName, pName);
  };

  const handleDisconnect = async () => {
    clearInterval(pollRef.current);
    if (me) await clearPresence(me);
    ambient.stop();
    setPhase("connect"); setMe(""); setPartner(""); setConnectedAt(null);
    setMeInput(username || ""); setPartnerInput(""); setSurpriseInput("");
  };

  const handleShare = () => {
    shareInvite(meInput.trim());
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  if (phase === "landing") return <Landing me={me} partner={partner} surpriseMsg={surpriseInput} connectedAt={connectedAt} onDisconnect={handleDisconnect} />;

  if (phase === "burst") return (
    <div className="burst-wrap">
      <BurstHearts />
      <div className="burst-ring"><div className="burst-icon">💖</div></div>
      <div className="burst-text">Вы вместе</div>
      <div className="burst-sub"><span>@{normalize(me)}</span> &amp; <span>@{normalize(partner)}</span></div>
    </div>
  );

  return (
    <div className="co-wrap"><div className="co-bg" /><Petals />
      <div className="co-card">
        <span className="co-heart">🌹</span>
        {phase === "waiting" ? (
          <div className="co-waiting">
            <div className="co-orb">💌</div>
            <div className="co-wait-name">Жду <span>@{normalize(partnerInput)}</span>…</div>
            <div className="co-wait-sub">
              <span className="co-wait-dot" />
              Попроси <strong>@{normalize(partnerInput)}</strong> открыть приложение и ввести <strong>@{normalize(meInput)}</strong>
            </div>
            {/* Share button */}
            <button className="co-btn" style={{marginTop:8,opacity:.85}} onClick={handleShare}>
              {copied ? "✓ Ссылка скопирована!" : (isTMA ? "Отправить ссылку в Telegram ✈️" : "Скопировать ссылку 🔗")}
            </button>
            <span className="co-cancel" onClick={async () => { clearInterval(pollRef.current); await clearPresence(meInput.trim()); setPhase("connect"); }}>Отменить</span>
          </div>
        ) : (
          <>
            <h1 className="co-title">Смотрим вместе,<br /><em>как один</em></h1>
            <p className="co-sub">Введи ники и оставь сюрприз-послание — оно появится когда она долистает до конца.</p>
            <div className="co-divider"><div className="co-divider-line" /><span style={{ opacity: .4, fontSize: 13 }}>✦</span><div className="co-divider-line" /></div>

            <div className="co-field">
              <label className="co-label">
                {isTMA ? "Твой ник (из Telegram)" : "Твой Telegram-ник"}
              </label>
              <div className="co-input-wrap"><span className="co-at">@</span>
                <input className="co-input" placeholder="username" value={meInput}
                  onChange={e => { setMeInput(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleConnect()}
                  readOnly={isTMA && !!username} />
              </div>
              {isTMA && username && <p className="co-hint">✓ Получено из Telegram автоматически</p>}
            </div>

            <div className="co-field">
              <label className="co-label">Ник партнёра</label>
              <div className="co-input-wrap"><span className="co-at">@</span>
                <input className="co-input" placeholder="её / его username" value={partnerInput}
                  onChange={e => { setPartnerInput(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleConnect()} />
              </div>
              {isTMA && startParam && <p className="co-hint">✓ Получено из ссылки автоматически</p>}
            </div>

            <div className="co-field">
              <label className="co-label">💌 Сюрприз-послание</label>
              <textarea className="co-input" placeholder="Появится в конце страницы…"
                value={surpriseInput} onChange={e => setSurpriseInput(e.target.value)}
                style={{ resize: "none", height: 64, paddingTop: 10, lineHeight: 1.5, paddingLeft: 13 }} />
              <p className="co-hint">Она увидит это когда долистает до конца 🌹</p>
            </div>

            {error && <p className="co-error">{error}</p>}
            <button className="co-btn" disabled={!meInput.trim() || !partnerInput.trim()} onClick={handleConnect}>
              Соединиться 💕
            </button>

            {!isTMA && (
              <div className="tg-notice">
                <span style={{ fontSize: 15, flexShrink: 0 }}>✈️</span>
                <span>Открой через Telegram-бота — ник заполнится автоматически.</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
  const [phase, setPhase]     = useState("connect");
  const [me, setMe]           = useState("");
  const [partner, setPartner] = useState("");
  const [meInput, setMeInput] = useState("");
  const [partnerInput, setPartnerInput] = useState("");
  const [surpriseInput, setSurpriseInput] = useState("");
  const [error, setError]     = useState("");
  const [connectedAt, setConnectedAt] = useState(null);
  const pollRef  = useRef(null);
  const burstRef = useRef(null);

  useEffect(() => {
    const tag = document.createElement("style"); tag.textContent = CSS;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  const startPolling = useCallback((myName, pName) => {
    pollRef.current = setInterval(async () => {
      const d = await loadPresence(pName);
      if (d && d.wants === normalize(myName)) {
        clearInterval(pollRef.current);
        setMe(myName); setPartner(pName);
        setPhase("burst");
        burstRef.current = setTimeout(() => {
          setConnectedAt(Date.now());
          setPhase("landing");
        }, 3200);
      }
    }, POLL_MS);
  }, []);

  useEffect(() => () => {
    clearInterval(pollRef.current); clearTimeout(burstRef.current);
    if (me) clearPresence(me); ambient.stop();
  }, [me]);

  const handleConnect = async () => {
    const myName = meInput.trim(), pName = partnerInput.trim();
    if (!myName || !pName) { setError("Заполни оба поля."); return; }
    if (normalize(myName) === normalize(pName)) { setError("Нельзя подключиться к самому себе 😊"); return; }
    setError("");
    await savePresence(myName, pName);
    setPhase("waiting");
    startPolling(myName, pName);
  };

  const handleDisconnect = async () => {
    clearInterval(pollRef.current);
    if (me) await clearPresence(me);
    ambient.stop();
    setPhase("connect"); setMe(""); setPartner(""); setConnectedAt(null);
    setMeInput(""); setPartnerInput(""); setSurpriseInput("");
  };

  if (phase === "landing") return <Landing me={me} partner={partner} surpriseMsg={surpriseInput} connectedAt={connectedAt} onDisconnect={handleDisconnect} />;

  if (phase === "burst") return (
    <div className="burst-wrap">
      <BurstHearts />
      <div className="burst-ring"><div className="burst-icon">💖</div></div>
      <div className="burst-text">Вы вместе</div>
      <div className="burst-sub"><span>@{normalize(me)}</span> &amp; <span>@{normalize(partner)}</span></div>
    </div>
  );

  return (
    <div className="co-wrap"><div className="co-bg" /><Petals />
      <div className="co-card">
        <span className="co-heart">🌹</span>
        {phase === "waiting" ? (
          <div className="co-waiting">
            <div className="co-orb">💌</div>
            <div className="co-wait-name">Жду <span>@{normalize(partnerInput)}</span>…</div>
            <div className="co-wait-sub">
              <span className="co-wait-dot" />
              Попроси <strong>@{normalize(partnerInput)}</strong> открыть эту страницу и ввести <strong>@{normalize(meInput)}</strong>
            </div>
            <span className="co-cancel" onClick={async () => { clearInterval(pollRef.current); await clearPresence(meInput.trim()); setPhase("connect"); }}>Отменить</span>
          </div>
        ) : (
          <>
            <h1 className="co-title">Смотрим вместе,<br /><em>как один</em></h1>
            <p className="co-sub">Введи ники и оставь сюрприз-послание — оно появится когда она долистает до конца.</p>
            <div className="co-divider"><div className="co-divider-line" /><span style={{ opacity: .4, fontSize: 13 }}>✦</span><div className="co-divider-line" /></div>
            <div className="co-field">
              <label className="co-label">Твой Telegram-ник</label>
              <div className="co-input-wrap"><span className="co-at">@</span>
                <input className="co-input" placeholder="username" value={meInput}
                  onChange={e => { setMeInput(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleConnect()} />
              </div>
            </div>
            <div className="co-field">
              <label className="co-label">Ник партнёра</label>
              <div className="co-input-wrap"><span className="co-at">@</span>
                <input className="co-input" placeholder="её / его username" value={partnerInput}
                  onChange={e => { setPartnerInput(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleConnect()} />
              </div>
            </div>
            <div className="co-field">
              <label className="co-label">💌 Сюрприз-послание</label>
              <textarea className="co-input" placeholder="Появится в конце страницы…"
                value={surpriseInput} onChange={e => setSurpriseInput(e.target.value)}
                style={{ resize: "none", height: 64, paddingTop: 10, lineHeight: 1.5, paddingLeft: 13 }} />
              <p className="co-hint">Она увидит это когда долистает до конца 🌹</p>
            </div>
            {error && <p className="co-error">{error}</p>}
            <button className="co-btn" disabled={!meInput.trim() || !partnerInput.trim()} onClick={handleConnect}>
              Соединиться 💕
            </button>
            <div className="tg-notice">
              <span style={{ fontSize: 15, flexShrink: 0 }}>✈️</span>
              <span>Готов к интеграции в Telegram Mini App — смотри прилагаемую инструкцию.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
