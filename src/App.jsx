import { useState, useEffect, useRef, useCallback } from "react";

/* ══════════════════════════════════════════════════════
   STORAGE — Supabase
══════════════════════════════════════════════════════ */
const SUPABASE_URL = 'https://zghswvujqwshonctoulx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uLz5P6pKZ_r7aru5HmvMbw_MWoxAM_t';
const TTL_MS  = 15 * 60 * 1000;
const normalize = s => s.replace(/^@/, "").toLowerCase().trim();

const supaFetch = async (key, value = undefined) => {
  const base = `${SUPABASE_URL}/rest/v1/duo_store`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=minimal',
  };
  if (value === undefined) {
    const r = await fetch(`${base}?key=eq.${encodeURIComponent(key)}&select=value`, { headers });
    const d = await r.json();
    return d?.[0]?.value ?? null;
  }
  if (value === null) {
    await fetch(`${base}?key=eq.${encodeURIComponent(key)}`, { method: 'DELETE', headers });
    return;
  }
  await fetch(base, { method: 'POST', headers, body: JSON.stringify({ key, value: JSON.stringify(value) }) });
};

async function s_set(k, v) { await supaFetch(k, v); }
async function s_get(k) { try { const r = await supaFetch(k); return r ? JSON.parse(r) : null; } catch { return null; } }
async function s_del(k) { await supaFetch(k, null); }

const POLL_MS = 1200;

async function savePresence(me, to)  { await s_set(`duo:${normalize(me)}`, { wants: normalize(to), ts: Date.now() }); }
async function loadPresence(n)       { const d = await s_get(`duo:${normalize(n)}`); return d && Date.now()-d.ts < TTL_MS ? d : null; }
async function clearPresence(n)      { for (const k of ["duo","duo_state","duo_moments","duo_calendar"]) await s_del(`${k}:${normalize(n)}`); }
async function saveState(me, data)   { await s_set(`duo_state:${normalize(me)}`, { ...data, ts: Date.now() }); }
async function loadState(n)          { const d = await s_get(`duo_state:${normalize(n)}`); return d && Date.now()-d.ts < TTL_MS ? d : null; }
async function saveMoments(pair, arr){ await s_set(`duo_moments:${pair}`, arr); }
async function loadMoments(pair)     { return (await s_get(`duo_moments:${pair}`)) || []; }
async function saveCalendar(pair, arr){ await s_set(`duo_calendar:${pair}`, arr); }
async function loadCalendar(pair)    { return (await s_get(`duo_calendar:${pair}`)) || []; }

const pairKey = (a, b) => [normalize(a), normalize(b)].sort().join("_");

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
    this.master.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime+3);
    this.master.connect(this.ctx.destination);
    [[220,.5],[277.2,.35],[329.6,.25],[440,.12]].forEach(([freq,vol])=>{
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
   VIBE PATTERNS
══════════════════════════════════════════════════════ */
const VIBE_PATTERNS = [
  { id:"tap",     emoji:"👆", label:"Лёгкое касание",  pattern:[60],                color:"rgba(212,168,83,.9)"  },
  { id:"heart",   emoji:"💓", label:"Сердцебиение",    pattern:[120,80,120],        color:"rgba(232,82,122,.9)"  },
  { id:"passion", emoji:"🔥", label:"Страсть",         pattern:[200,80,200,80,400], color:"rgba(255,120,50,.9)"  },
  { id:"sos",     emoji:"💌", label:"Думаю о тебе",    pattern:[80,50,80,50,300,50,80],color:"rgba(100,210,255,.9)"},
];

const REACTS = ["❤️","💕","🌹","😍","✨","🫶","💋","🥰","💖","🔥"];

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
  --gold:#d4a853;--teal:#64d2ff;--purple:#bf5af2;--green:#30d158;
  --fg:#f5f0eb;--fg2:rgba(245,240,235,.62);--fg3:rgba(245,240,235,.36);
  --bg:#0d0810;--card:rgba(20,12,18,.95);
  --ease:cubic-bezier(.22,1,.36,1);--spring:cubic-bezier(.34,1.56,.64,1);
}
html,body,#root{height:100%;background:var(--bg);color:var(--fg);font-family:var(--font-b);}

/* ── CONNECT ── */
.co-wrap{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:var(--bg);overflow:hidden;}
.co-bg{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 60% 55% at 15% 15%,rgba(232,82,122,.16) 0%,transparent 58%),radial-gradient(ellipse 50% 45% at 85% 80%,rgba(212,168,83,.12) 0%,transparent 56%);}
.petal{position:absolute;pointer-events:none;border-radius:50% 0 50% 0;opacity:0;animation:pf linear infinite;}
@keyframes pf{0%{transform:translateY(-30px) rotate(0deg);opacity:0}10%{opacity:.35}90%{opacity:.2}100%{transform:translateY(110vh) rotate(540deg);opacity:0}}
.co-card{position:relative;z-index:2;width:min(410px,93vw);background:var(--card);border:1px solid rgba(232,82,122,.20);border-radius:32px;padding:40px 34px 36px;backdrop-filter:blur(32px);box-shadow:0 0 0 1px rgba(232,82,122,.08) inset,0 60px 140px rgba(0,0,0,.85);text-align:center;animation:ci .75s var(--ease) both;max-height:92vh;overflow-y:auto;}
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
.co-input-plain{padding-left:13px;}
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
.rbtn.vibe-sent{animation:vibe-sent-pulse .5s var(--spring) both;}
@keyframes vibe-sent-pulse{0%{transform:scale(1)}40%{transform:scale(1.35);background:rgba(232,82,122,.4)}100%{transform:scale(1)}}

/* ── MAIN LAYOUT ── */
.land-wrap{height:100vh;overflow-y:scroll;overflow-x:hidden;position:relative;scroll-behavior:smooth;}
.land-wrap::-webkit-scrollbar{width:3px;}
.land-wrap::-webkit-scrollbar-thumb{background:rgba(232,82,122,.25);border-radius:3px;}

/* ── NAV ── */
.lnav{position:fixed;top:0;left:0;right:0;z-index:800;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(16px,4vw,48px);height:52px;transition:background .3s;}
.lnav.scrolled{background:rgba(13,8,16,.85);backdrop-filter:blur(20px);border-bottom:1px solid rgba(232,82,122,.10);}
.lnav-logo{font-family:var(--font-r);font-size:17px;font-style:italic;color:var(--rose-hi);}
.lnav-links{display:flex;gap:18px;list-style:none;}
.lnav-link{font-size:12px;color:var(--fg3);cursor:pointer;transition:color .2s;}
.lnav-link:hover,.lnav-link.active{color:var(--fg);}
@media(max-width:600px){.lnav-links{display:none;}}

/* ── TIMER PILL ── */
.timer-pill{position:fixed;top:58px;left:50%;transform:translateX(-50%);z-index:810;background:rgba(20,12,18,.88);border:1px solid rgba(232,82,122,.18);border-radius:999px;padding:5px 14px;backdrop-filter:blur(16px);display:flex;align-items:center;gap:7px;font-size:11px;color:var(--fg2);animation:ci .5s var(--ease) both;white-space:nowrap;}
.timer-dot{width:5px;height:5px;border-radius:50%;background:var(--rose);animation:bd 1.5s ease-in-out infinite;flex-shrink:0;}
.timer-val{font-family:var(--font-d);font-size:14px;font-weight:700;color:var(--rose-hi);}

/* ── HERO ── */
.s-hero{min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px clamp(20px,5vw,60px) 100px;background:radial-gradient(ellipse 70% 55% at 50% 30%,rgba(232,82,122,.13) 0%,transparent 60%),radial-gradient(ellipse 50% 40% at 80% 80%,rgba(212,168,83,.08) 0%,transparent 55%);}
.hero-eyebrow{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--rose);margin-bottom:16px;display:block;}
.hero-h1{font-family:var(--font-d);font-size:clamp(48px,9vw,110px);font-weight:700;letter-spacing:-.04em;line-height:.95;background:linear-gradient(160deg,#fff 30%,rgba(255,255,255,.45));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:14px;}
.hero-sub{font-family:var(--font-d);font-size:clamp(16px,2.5vw,24px);font-style:italic;font-weight:300;color:var(--fg2);margin-bottom:36px;max-width:480px;}
.hero-stats{display:flex;gap:clamp(24px,5vw,60px);justify-content:center;flex-wrap:wrap;margin-bottom:48px;}
.hero-stat-n{font-family:var(--font-d);font-size:clamp(34px,6vw,58px);font-weight:700;letter-spacing:-.04em;line-height:1;color:var(--rose-hi);}
.hero-stat-l{font-size:11px;color:var(--fg3);margin-top:4px;letter-spacing:.07em;text-transform:uppercase;}
.hero-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
.btn-p{padding:13px 28px;border-radius:999px;background:linear-gradient(135deg,var(--rose),var(--rose-lo));color:#fff;font-family:var(--font-b);font-size:14px;font-weight:600;border:none;cursor:pointer;box-shadow:0 6px 24px rgba(232,82,122,.3);transition:opacity .18s,transform .18s var(--spring);}
.btn-g{padding:13px 28px;border-radius:999px;background:transparent;color:var(--fg);font-family:var(--font-b);font-size:14px;font-weight:600;border:1.5px solid rgba(255,255,255,.18);cursor:pointer;transition:opacity .18s,transform .18s var(--spring);}
.btn-p:hover,.btn-g:hover{opacity:.84;transform:scale(1.02);}
.scroll-hint{position:absolute;bottom:90px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;animation:su 1s var(--ease) 2s both;}
.scroll-hint-line{width:1px;height:40px;background:linear-gradient(180deg,transparent,var(--rose));animation:sh 1.8s ease-in-out infinite;}
@keyframes sh{0%,100%{opacity:.3;transform:scaleY(.5)}50%{opacity:1;transform:scaleY(1)}}

/* ── LOVE TIMER SECTION ── */
.s-section{padding:clamp(70px,10vw,120px) clamp(20px,5vw,60px);}
.s-center{max-width:900px;margin:0 auto;text-align:center;}
.s-eyebrow{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--rose);display:block;margin-bottom:12px;}
.s-h2{font-family:var(--font-d);font-size:clamp(28px,5vw,56px);font-weight:700;letter-spacing:-.03em;line-height:1.05;margin-bottom:12px;}
.s-h2 em{font-style:italic;color:var(--fg2);}
.s-sub{font-size:clamp(14px,1.8vw,18px);font-weight:300;color:var(--fg2);line-height:1.7;max-width:520px;margin:0 auto 40px;}

/* love timer display */
.love-timer-display{display:flex;gap:clamp(12px,3vw,32px);justify-content:center;flex-wrap:wrap;margin-bottom:32px;}
.ltd-unit{text-align:center;}
.ltd-n{font-family:var(--font-d);font-size:clamp(44px,8vw,80px);font-weight:700;letter-spacing:-.04em;line-height:1;background:linear-gradient(135deg,var(--rose-hi),var(--rose));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.ltd-l{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg3);margin-top:4px;}
.ltd-sep{font-family:var(--font-d);font-size:clamp(40px,7vw,72px);font-weight:300;color:rgba(232,82,122,.3);line-height:1;align-self:flex-start;margin-top:2px;}

/* start date picker */
.start-date-card{background:rgba(255,255,255,.03);border:1px solid rgba(232,82,122,.15);border-radius:20px;padding:20px 24px;display:inline-flex;align-items:center;gap:14px;margin-top:8px;}
.start-date-label{font-size:12px;color:var(--fg3);}
.start-date-input{background:transparent;border:none;color:var(--rose-hi);font-family:var(--font-b);font-size:14px;font-weight:600;outline:none;cursor:pointer;}
.start-date-input::-webkit-calendar-picker-indicator{filter:invert(.5) sepia(1) saturate(3) hue-rotate(290deg);cursor:pointer;}

/* ── CALENDAR ── */
.calendar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:32px;text-align:left;}
.cal-card{background:rgba(255,255,255,.03);border:1px solid rgba(232,82,122,.12);border-radius:18px;padding:16px 18px;transition:border-color .25s,background .25s;animation:su .3s var(--ease) both;}
.cal-card:hover{border-color:rgba(232,82,122,.3);background:rgba(255,255,255,.05);}
.cal-card-top{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
.cal-card-emoji{font-size:22px;}
.cal-card-date{font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--gold);text-transform:uppercase;}
.cal-card-title{font-size:15px;font-weight:600;color:var(--fg);line-height:1.3;}
.cal-card-desc{font-size:12px;color:var(--fg3);margin-top:4px;line-height:1.55;}
.cal-card-countdown{font-size:11px;color:rgba(232,82,122,.7);margin-top:8px;font-weight:600;}
.cal-add{display:flex;flex-direction:column;gap:8px;margin-top:20px;max-width:500px;margin-inline:auto;}
.cal-row{display:flex;gap:8px;}
.cal-input{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(232,82,122,.16);border-radius:12px;padding:10px 13px;color:var(--fg);font-family:var(--font-b);font-size:13px;outline:none;transition:border-color .22s;}
.cal-input:focus{border-color:rgba(232,82,122,.5);}
.cal-input::placeholder{color:var(--fg3);}
.cal-input-date{color:var(--fg2);}
.cal-input-date::-webkit-calendar-picker-indicator{filter:invert(.4);}
.cal-submit{padding:10px 22px;border-radius:12px;background:linear-gradient(135deg,var(--rose),var(--rose-lo));color:#fff;font-family:var(--font-b);font-size:13px;font-weight:600;border:none;cursor:pointer;white-space:nowrap;transition:opacity .18s,transform .18s var(--spring);}
.cal-submit:hover:not(:disabled){opacity:.88;transform:scale(1.02);}
.cal-submit:disabled{opacity:.3;cursor:not-allowed;}

/* ── MOMENTS ── */
.moments-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;margin-top:32px;text-align:left;}
.moment-card{background:rgba(255,255,255,.03);border:1px solid rgba(232,82,122,.12);border-radius:18px;padding:16px 18px;animation:su .3s var(--ease) both;transition:border-color .25s;}
.moment-card:hover{border-color:rgba(232,82,122,.28);}
.moment-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.moment-who{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--rose);opacity:.8;}
.moment-date{font-size:10px;color:var(--fg3);}
.moment-text{font-size:13px;color:var(--fg2);line-height:1.65;}
.moment-emoji{font-size:20px;margin-bottom:6px;display:block;}
.moments-add{display:flex;flex-direction:column;gap:8px;margin-top:20px;max-width:500px;margin-inline:auto;}
.moments-input{background:rgba(255,255,255,.04);border:1px solid rgba(232,82,122,.16);border-radius:12px;padding:11px 13px;color:var(--fg);font-family:var(--font-b);font-size:13px;outline:none;resize:none;transition:border-color .22s;min-height:72px;}
.moments-input:focus{border-color:rgba(232,82,122,.5);}
.moments-input::placeholder{color:var(--fg3);}
.moments-row{display:flex;gap:8px;}
.emoji-picker{display:flex;gap:6px;flex-wrap:wrap;}
.emoji-opt{font-size:18px;cursor:pointer;padding:4px;border-radius:8px;transition:background .18s,transform .18s var(--spring);}
.emoji-opt:hover{background:rgba(255,255,255,.08);transform:scale(1.2);}
.emoji-opt.selected{background:rgba(232,82,122,.2);}

/* ── PROMISES ── */
.promises-list{display:flex;flex-direction:column;gap:10px;margin-top:32px;max-width:640px;margin-inline:auto;text-align:left;}
.promise-item{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:rgba(255,255,255,.03);border:1px solid rgba(232,82,122,.10);border-radius:14px;animation:su .3s var(--ease) both;}
.promise-icon{font-size:18px;flex-shrink:0;margin-top:1px;}
.promise-text{font-size:14px;color:var(--fg2);line-height:1.6;flex:1;}
.promise-who{font-size:10px;color:rgba(232,82,122,.6);font-weight:600;margin-top:3px;text-transform:uppercase;letter-spacing:.05em;}
.promise-add{display:flex;gap:8px;margin-top:16px;max-width:640px;margin-inline:auto;}
.promise-input{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(232,82,122,.16);border-radius:12px;padding:11px 14px;color:var(--fg);font-family:var(--font-b);font-size:13px;outline:none;transition:border-color .22s;}
.promise-input:focus{border-color:rgba(232,82,122,.5);}
.promise-input::placeholder{color:var(--fg3);}

/* ── SHARED SECTION DIVIDER ── */
.section-divider{height:1px;background:linear-gradient(90deg,transparent,rgba(232,82,122,.15),transparent);margin:0 clamp(20px,5vw,60px);}

/* ── CHAT PANEL ── */
.chat-panel{position:fixed;bottom:70px;right:20px;z-index:902;width:min(290px,86vw);background:rgba(20,12,18,.97);border:1px solid rgba(232,82,122,.22);border-radius:22px;backdrop-filter:blur(24px);box-shadow:0 16px 56px rgba(0,0,0,.6);overflow:hidden;display:flex;flex-direction:column;animation:ci .3s var(--ease) both;}
.chat-hd{padding:11px 13px 10px;border-bottom:1px solid rgba(232,82,122,.12);display:flex;align-items:center;justify-content:space-between;}
.chat-hd-title{font-family:var(--font-r);font-size:14px;font-weight:700;}
.chat-hd-sub{font-size:10px;color:var(--fg3);margin-top:1px;}
.chat-x{width:23px;height:23px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:10px;color:var(--fg3);}
.chat-msgs{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:7px;max-height:200px;min-height:50px;}
.chat-msgs::-webkit-scrollbar{width:2px;}
.chat-msgs::-webkit-scrollbar-thumb{background:rgba(232,82,122,.3);border-radius:2px;}
.chat-msg{max-width:85%;padding:7px 11px;border-radius:14px;font-size:12px;line-height:1.5;animation:su .25s var(--ease) both;}
.chat-msg.mine{align-self:flex-end;background:linear-gradient(135deg,var(--rose),var(--rose-lo));color:#fff;border-bottom-right-radius:3px;}
.chat-msg.theirs{align-self:flex-start;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);border-bottom-left-radius:3px;}
.chat-msg-from{font-size:9px;font-weight:600;opacity:.6;margin-bottom:2px;letter-spacing:.04em;text-transform:uppercase;}
.chat-empty{font-size:12px;color:var(--fg3);text-align:center;padding:14px 0;line-height:1.7;}
.chat-input-row{display:flex;gap:6px;padding:8px 10px;border-top:1px solid rgba(232,82,122,.10);}
.chat-input{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(232,82,122,.18);border-radius:11px;padding:8px 10px;color:var(--fg);font-family:var(--font-b);font-size:12px;outline:none;}
.chat-input:focus{border-color:rgba(232,82,122,.5);}
.chat-input::placeholder{color:var(--fg3);}
.chat-send{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--rose),var(--rose-lo));border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:transform .18s var(--spring);}
.chat-send:hover:not(:disabled){transform:scale(1.08);}
.chat-send:disabled{opacity:.32;cursor:not-allowed;}
.chat-voice-btn{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid rgba(232,82,122,.25);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:transform .18s var(--spring);}
.chat-voice-btn.recording{background:rgba(232,82,122,.25);border-color:rgba(232,82,122,.6);animation:kiss-pulse 1s ease-in-out infinite;}
.voice-player{display:flex;align-items:center;gap:8px;}
.voice-play-btn{width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.15);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.voice-waveform{flex:1;height:24px;display:flex;align-items:center;gap:2px;}
.voice-bar{flex:1;max-width:3px;border-radius:2px;background:rgba(255,255,255,.35);transition:height .1s;}
.voice-duration{font-size:10px;opacity:.7;white-space:nowrap;}

/* ── VIBE ── */
.vibe-panel{position:fixed;bottom:68px;left:50%;transform:translateX(-50%);z-index:901;background:rgba(20,12,18,.96);border:1px solid rgba(232,82,122,.22);border-radius:22px;padding:14px 16px 12px;backdrop-filter:blur(20px);box-shadow:0 16px 48px rgba(0,0,0,.6);animation:ci .3s var(--ease) both;min-width:220px;}
.vibe-panel-title{font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--fg3);margin-bottom:10px;text-align:center;}
.vibe-opts{display:flex;flex-direction:column;gap:6px;}
.vibe-opt{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:13px;border:1px solid rgba(255,255,255,.07);cursor:pointer;transition:background .18s,transform .18s var(--spring);}
.vibe-opt:hover{background:rgba(255,255,255,.06);transform:scale(1.02);}
.vibe-opt-emoji{font-size:18px;flex-shrink:0;}
.vibe-opt-label{font-size:13px;font-weight:500;color:var(--fg2);}
.vibe-opt-hint{font-size:10px;color:var(--fg3);margin-top:1px;}
.vibe-ripple{position:fixed;inset:0;z-index:970;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;}
.vibe-ripple-ring{position:absolute;border-radius:50%;border:2px solid var(--vibe-color,rgba(232,82,122,.6));animation:vr var(--vd,.9s) ease-out forwards;}
@keyframes vr{0%{width:0;height:0;opacity:.9;transform:translate(-50%,-50%)}100%{width:80vmax;height:80vmax;opacity:0;transform:translate(-50%,-50%)}}
.vibe-ripple-icon{font-size:52px;animation:vri .45s var(--spring) both;filter:drop-shadow(0 0 28px var(--vibe-color,rgba(232,82,122,.8)));}
@keyframes vri{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.25)}100%{transform:scale(1);opacity:1}}
.vibe-ripple-text{font-family:var(--font-r);font-size:clamp(18px,4vw,26px);font-weight:700;color:var(--fg);animation:su .5s var(--ease) .1s both;}
.vibe-ripple-sub{font-size:13px;color:var(--fg3);animation:su .5s var(--ease) .25s both;}

/* ── REACTIONS ── */
.react-panel{position:fixed;bottom:68px;left:50%;transform:translateX(-50%);z-index:901;display:flex;gap:7px;background:rgba(20,12,18,.93);border:1px solid rgba(232,82,122,.22);border-radius:999px;padding:9px 14px;backdrop-filter:blur(18px);animation:ci .3s var(--ease) both;}
.react-em{font-size:22px;cursor:pointer;transition:transform .18s var(--spring);}
.react-em:hover{transform:scale(1.35);}
.float-react{position:fixed;pointer-events:none;z-index:960;font-size:var(--fs,30px);animation:fr var(--dur,2.4s) var(--ease) forwards;}
@keyframes fr{0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.3)}100%{opacity:0;transform:translate(-50%,calc(-50% - 110px)) scale(.7)}}

/* ── KISS ── */
.kiss-overlay{position:fixed;inset:0;z-index:950;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;}
.kiss-counter{background:rgba(20,12,18,.92);border:1px solid rgba(232,82,122,.35);border-radius:24px;padding:18px 32px;text-align:center;backdrop-filter:blur(20px);animation:ci .4s var(--ease) both;box-shadow:0 0 60px rgba(232,82,122,.25);}
.kiss-emoji{font-size:44px;display:block;margin-bottom:8px;animation:hb 1s ease-in-out infinite;}
.kiss-time{font-family:var(--font-d);font-size:52px;font-weight:700;letter-spacing:-.04em;line-height:1;background:linear-gradient(135deg,var(--rose-hi),var(--rose));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.kiss-label{font-size:12px;color:var(--fg3);margin-top:4px;letter-spacing:.06em;text-transform:uppercase;}
.kiss-waiting{font-size:13px;color:var(--fg3);background:rgba(20,12,18,.88);border:1px solid rgba(232,82,122,.20);border-radius:20px;padding:12px 22px;text-align:center;backdrop-filter:blur(16px);}
.kiss-waiting strong{color:var(--rose-hi);}
.last-kiss-toast{position:fixed;top:66px;left:50%;transform:translateX(-50%);z-index:910;background:rgba(20,12,18,.94);border:1px solid rgba(232,82,122,.30);border-radius:14px;padding:10px 20px;font-size:13px;color:var(--fg2);animation:su .35s var(--ease) both,ft 2.5s var(--ease) 1.5s forwards;pointer-events:none;white-space:nowrap;display:flex;align-items:center;gap:8px;}
@keyframes ft{from{opacity:1}to{opacity:0}}
.last-kiss-toast strong{color:var(--rose-hi);}

/* ── SURPRISE ── */
.surprise-wrap{position:fixed;inset:0;z-index:990;display:flex;align-items:center;justify-content:center;background:rgba(13,8,16,.96);backdrop-filter:blur(8px);animation:ci .6s var(--ease) both;}
.surprise-card{width:min(390px,90vw);background:var(--card);border:1px solid rgba(232,82,122,.25);border-radius:32px;padding:44px 32px 36px;text-align:center;box-shadow:0 40px 100px rgba(0,0,0,.8);animation:rp .7s var(--spring) .2s both;position:relative;overflow:hidden;}
.surprise-hearts{font-size:32px;display:block;margin-bottom:16px;animation:hb 2s ease-in-out infinite;}
.surprise-title{font-family:var(--font-r);font-size:clamp(19px,4.5vw,27px);font-weight:700;letter-spacing:-.02em;margin-bottom:12px;color:var(--rose-hi);}
.surprise-msg{font-family:var(--font-d);font-size:clamp(14px,2.3vw,20px);font-style:italic;font-weight:300;color:var(--fg2);line-height:1.75;margin-bottom:22px;}
.surprise-from{font-size:11px;color:var(--fg3);letter-spacing:.08em;margin-bottom:20px;}
.surprise-btn{padding:11px 28px;border-radius:999px;background:linear-gradient(135deg,var(--rose),var(--rose-lo));color:#fff;font-family:var(--font-b);font-size:13px;font-weight:600;border:none;cursor:pointer;transition:transform .18s var(--spring);}
.surprise-btn:hover{transform:scale(1.04);}

/* ── PARTNER BAR ── */
.partner-bar{position:fixed;right:6px;top:0;bottom:0;width:3px;z-index:800;pointer-events:none;}
.partner-bar-track{position:absolute;inset:0;background:rgba(232,82,122,.06);border-radius:3px;}
.partner-bar-thumb{position:absolute;left:0;right:0;height:36px;border-radius:3px;background:linear-gradient(180deg,var(--rose-hi),var(--rose-lo));box-shadow:0 0 10px rgba(232,82,122,.5);transition:top .4s var(--ease);}
.partner-cursor{position:fixed;pointer-events:none;z-index:950;transition:left .15s linear,top .15s linear;}
.partner-cursor-dot{width:13px;height:13px;border-radius:50%;background:var(--rose);box-shadow:0 0 14px rgba(232,82,122,.8);border:2px solid rgba(255,255,255,.5);}
.partner-cursor-lbl{margin-top:5px;margin-left:4px;background:rgba(20,12,18,.88);border:1px solid rgba(232,82,122,.25);border-radius:8px;padding:2px 8px;font-size:11px;color:var(--fg2);white-space:nowrap;}

/* ── FOOTER ── */
.lfoot{border-top:1px solid rgba(255,255,255,.06);padding:30px clamp(20px,5vw,60px);text-align:center;}
.foot-copy{font-size:11px;color:rgba(255,255,255,.15);line-height:1.7;}
`;

/* ══════════════════════════════════════════════════════
   ATOMS
══════════════════════════════════════════════════════ */
function Petals() {
  return <>{Array.from({length:10},(_,i)=>(
    <div key={i} className="petal" style={{left:`${5+Math.random()*90}%`,width:`${6+Math.random()*12}px`,height:`${4+Math.random()*9}px`,top:"-30px",background:["rgba(232,82,122,.18)","rgba(212,168,83,.14)","rgba(232,82,122,.10)"][i%3],animationDuration:`${10+Math.random()*18}s`,animationDelay:`${Math.random()*14}s`}}/>
  ))}</>;
}
function BurstHearts(){
  return <div className="burst-hearts">{Array.from({length:24},(_,i)=>(
    <div key={i} className="burst-heart-p" style={{left:`${5+Math.random()*90}%`,top:`${55+Math.random()*35}%`,fontSize:`${14+Math.random()*22}px`,"--r":`${Math.random()*60-30}deg`,animationDuration:`${2+Math.random()*2.5}s`,animationDelay:`${Math.random()*.9}s`}}>{"❤️💕🌹✨💖🫶💋🥰"[i%8]}</div>
  ))}</div>;
}
function FloatReact({emoji,x,y,onDone}){
  const dur=2.2+Math.random()*.8,fs=26+Math.random()*20;
  useEffect(()=>{const t=setTimeout(onDone,(dur+.1)*1000);return()=>clearTimeout(t);},[]);
  return <div className="float-react" style={{left:x,top:y,"--fs":`${fs}px`,"--dur":`${dur}s`}}>{emoji}</div>;
}
function MusicBars(){
  return <div className="music-bars">{[11,6,10,4,9,7,12].map((h,i)=><div key={i} className="music-bar" style={{"--h":`${h}px`,"--d":`${.28+i*.1}s`}}/>)}</div>;
}

function TogetherTimer({connectedAt}){
  const [e,setE]=useState(0);
  useEffect(()=>{const iv=setInterval(()=>setE(Math.floor((Date.now()-connectedAt)/1000)),1000);return()=>clearInterval(iv);},[connectedAt]);
  const m=Math.floor(e/60),s=e%60;
  return <div className="timer-pill"><div className="timer-dot"/><span style={{color:"var(--fg3)"}}>Вместе</span><span className="timer-val">{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</span></div>;
}

/* ── Love timer (days/hours/minutes/seconds since start date) ── */
function LoveTimer({ startDate }) {
  const [diff, setDiff] = useState({});
  useEffect(() => {
    const calc = () => {
      const ms = Date.now() - new Date(startDate).getTime();
      if (ms < 0) { setDiff({}); return; }
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setDiff({ d, h, m, s });
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [startDate]);
  if (!diff.d && diff.d !== 0) return null;
  return (
    <div className="love-timer-display">
      {[["d","дней"],["h","часов"],["m","минут"],["s","секунд"]].map(([k,l],i,arr)=>(
        <div key={k} style={{display:"flex",alignItems:"center",gap:i<arr.length-1?"clamp(12px,3vw,32px)":0}}>
          <div className="ltd-unit">
            <div className="ltd-n">{String(diff[k]).padStart(2,"0")}</div>
            <div className="ltd-l">{l}</div>
          </div>
          {i<arr.length-1 && <div className="ltd-sep">:</div>}
        </div>
      ))}
    </div>
  );
}

/* ── Voice player ── */
function base64ToBlob(b64,type){const bin=atob(b64);const arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return new Blob([arr],{type});}
function VoicePlayer({audioData,duration}){
  const [playing,setPlaying]=useState(false);const audioRef=useRef(null);
  useEffect(()=>{if(!audioData)return;const blob=base64ToBlob(audioData,"audio/webm");const url=URL.createObjectURL(blob);const audio=new Audio(url);audio.onended=()=>setPlaying(false);audioRef.current=audio;return()=>{audio.pause();URL.revokeObjectURL(url);};},[audioData]);
  const toggle=()=>{const a=audioRef.current;if(!a)return;if(playing){a.pause();a.currentTime=0;setPlaying(false);}else{a.play();setPlaying(true);}};
  const bars=Array.from({length:16},(_,i)=>Math.max(4,Math.sin(i*1.3+1)*10+Math.random()*6+4));
  const fmt=s=>`0:${String(Math.round(s||0)).padStart(2,"0")}`;
  return <div className="voice-player">
    <button className="voice-play-btn" onClick={toggle}>{playing?<svg width="10" height="10"><rect x="1" y="1" width="3" height="8" rx="1" fill="white"/><rect x="6" y="1" width="3" height="8" rx="1" fill="white"/></svg>:<svg width="10" height="10"><path d="M2 1l7 4-7 4V1z" fill="white"/></svg>}</button>
    <div className="voice-waveform">{bars.map((h,i)=><div key={i} className="voice-bar" style={{height:playing?`${h}px`:"4px",background:playing?"rgba(255,255,255,.7)":"rgba(255,255,255,.3)"}}/>)}</div>
    <span className="voice-duration">{fmt(duration)}</span>
  </div>;
}

/* ── Surprise overlay ── */
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

/* ── Vibe components ── */
function VibePanel({onSend}){
  return <div className="vibe-panel"><div className="vibe-panel-title">Отправить вибрацию</div><div className="vibe-opts">{VIBE_PATTERNS.map(p=><div key={p.id} className="vibe-opt" onClick={()=>onSend(p)}><span className="vibe-opt-emoji">{p.emoji}</span><div><div className="vibe-opt-label">{p.label}</div><div className="vibe-opt-hint">{p.pattern.join("·")} мс</div></div></div>)}</div></div>;
}
function VibeRipple({vibe,partner,onDone}){
  const p=VIBE_PATTERNS.find(x=>x.id===vibe.id)||VIBE_PATTERNS[0];
  useEffect(()=>{const t=setTimeout(onDone,2400);return()=>clearTimeout(t);},[]);
  return <div className="vibe-ripple" style={{"--vibe-color":p.color}}>{[0,350,700].map((delay,i)=><div key={i} className="vibe-ripple-ring" style={{position:"absolute",left:"50%",top:"50%","--vd":"1.6s",animationDelay:`${delay}ms`}}/>)}<div className="vibe-ripple-icon">{p.emoji}</div><div className="vibe-ripple-text">@{normalize(partner)}</div><div className="vibe-ripple-sub">{p.label}</div></div>;
}

/* ── Kiss overlay ── */
function KissOverlay({myKissing,partnerKissing,kissStart,partner}){
  const [elapsed,setElapsed]=useState(0);const both=myKissing&&partnerKissing;
  useEffect(()=>{if(!both||!kissStart)return;const iv=setInterval(()=>setElapsed(Math.floor((Date.now()-kissStart)/1000)),100);return()=>clearInterval(iv);},[both,kissStart]);
  if(!myKissing&&!partnerKissing)return null;
  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  return <div className="kiss-overlay">{both?<div className="kiss-counter"><span className="kiss-emoji">💋</span><div className="kiss-time">{fmt(elapsed)}</div><div className="kiss-label">Держите…</div></div>:<div className="kiss-waiting">{myKissing?<>Ждём <strong>@{normalize(partner)}</strong>… зажми 💋</>:<><strong>@{normalize(partner)}</strong> ждёт тебя! Зажми 💋</>}</div>}</div>;
}

/* ══════════════════════════════════════════════════════
   CALENDAR SECTION
══════════════════════════════════════════════════════ */
const CAL_EMOJIS = ["💍","🌹","🎂","✈️","🏠","💑","🎁","⭐","🥂","🌙"];

function daysUntil(dateStr) {
  const now = new Date(); now.setHours(0,0,0,0);
  const d = new Date(dateStr);
  const next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (next < now) next.setFullYear(now.getFullYear()+1);
  return Math.round((next-now)/86400000);
}

function CalendarSection({ pair, me }) {
  const [events, setEvents] = useState([]);
  const [title, setTitle]   = useState("");
  const [date, setDate]     = useState("");
  const [desc, setDesc]     = useState("");
  const [emoji, setEmoji]   = useState("💍");

  useEffect(() => { loadCalendar(pair).then(setEvents); }, [pair]);
  const pollRef = useRef(null);
  useEffect(() => {
    pollRef.current = setInterval(() => loadCalendar(pair).then(setEvents), 5000);
    return () => clearInterval(pollRef.current);
  }, [pair]);

  const add = async () => {
    if (!title.trim() || !date) return;
    const ev = { id: Date.now(), title: title.trim(), date, desc: desc.trim(), emoji, addedBy: me };
    const updated = [...events, ev].sort((a,b) => daysUntil(a.date) - daysUntil(b.date));
    setEvents(updated);
    await saveCalendar(pair, updated);
    setTitle(""); setDate(""); setDesc("");
  };

  return (
    <div className="s-section" id="calendar">
      <div className="s-center">
        <span className="s-eyebrow">Важные даты</span>
        <h2 className="s-h2">Наш <em>календарь</em></h2>
        <p className="s-sub">Годовщины, путешествия, особые моменты — всё в одном месте для вас двоих.</p>

        <div className="calendar-grid">
          {events.length === 0 && (
            <div style={{gridColumn:"1/-1",textAlign:"center",padding:"32px",color:"var(--fg3)",fontSize:13}}>
              Добавьте первую важную дату 💍
            </div>
          )}
          {events.map(ev => (
            <div key={ev.id} className="cal-card">
              <div className="cal-card-top">
                <span className="cal-card-emoji">{ev.emoji}</span>
                <span className="cal-card-date">{new Date(ev.date).toLocaleDateString("ru-RU",{day:"numeric",month:"long"})}</span>
              </div>
              <div className="cal-card-title">{ev.title}</div>
              {ev.desc && <div className="cal-card-desc">{ev.desc}</div>}
              <div className="cal-card-countdown">
                {daysUntil(ev.date) === 0 ? "🎉 Сегодня!" : `через ${daysUntil(ev.date)} дн.`}
              </div>
            </div>
          ))}
        </div>

        <div className="cal-add">
          <div className="emoji-picker" style={{justifyContent:"center"}}>
            {CAL_EMOJIS.map(e => <span key={e} className={`emoji-opt ${emoji===e?"selected":""}`} onClick={()=>setEmoji(e)}>{e}</span>)}
          </div>
          <div className="cal-row">
            <input className="cal-input" placeholder="Название события" value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/>
            <input className="cal-input cal-input-date" type="date" value={date} onChange={e=>setDate(e.target.value)} style={{width:150,flexShrink:0}}/>
          </div>
          <div className="cal-row">
            <input className="cal-input" placeholder="Описание (необязательно)" value={desc} onChange={e=>setDesc(e.target.value)}/>
            <button className="cal-submit" disabled={!title.trim()||!date} onClick={add}>Добавить</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MOMENTS SECTION
══════════════════════════════════════════════════════ */
const MOMENT_EMOJIS = ["🌹","💕","✨","😍","🥰","💋","🫶","🌙","☕","🎵","🌊","🏔️","🎭","💌","🎉"];

function MomentsSection({ pair, me, partner }) {
  const [moments, setMoments]   = useState([]);
  const [text, setText]         = useState("");
  const [emoji, setEmoji]       = useState("🌹");

  useEffect(() => { loadMoments(pair).then(setMoments); }, [pair]);
  useEffect(() => {
    const iv = setInterval(() => loadMoments(pair).then(setMoments), 4000);
    return () => clearInterval(iv);
  }, [pair]);

  const add = async () => {
    if (!text.trim()) return;
    const m = { id: Date.now(), text: text.trim(), emoji, addedBy: me, ts: Date.now() };
    const updated = [m, ...moments];
    setMoments(updated);
    await saveMoments(pair, updated);
    setText("");
  };

  const fmt = ts => new Date(ts).toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"});

  return (
    <div className="s-section" id="moments" style={{background:"rgba(255,255,255,.012)"}}>
      <div className="s-center">
        <span className="s-eyebrow">Наши воспоминания</span>
        <h2 className="s-h2">Моменты, <em>которые остаются</em></h2>
        <p className="s-sub">Записывайте всё — первое свидание, смешные случаи, нежные слова. Ваш личный архив.</p>

        <div className="moments-add">
          <div className="emoji-picker" style={{justifyContent:"center"}}>
            {MOMENT_EMOJIS.map(e => <span key={e} className={`emoji-opt ${emoji===e?"selected":""}`} onClick={()=>setEmoji(e)}>{e}</span>)}
          </div>
          <textarea className="moments-input" placeholder="Запиши момент, который хочешь сохранить…" value={text} onChange={e=>setText(e.target.value)}/>
          <div className="moments-row" style={{justifyContent:"flex-end"}}>
            <button className="cal-submit" disabled={!text.trim()} onClick={add}>Сохранить момент</button>
          </div>
        </div>

        <div className="moments-grid">
          {moments.length === 0 && (
            <div style={{gridColumn:"1/-1",textAlign:"center",padding:"32px",color:"var(--fg3)",fontSize:13}}>
              Сохраните первый совместный момент 🌹
            </div>
          )}
          {moments.map(m => (
            <div key={m.id} className="moment-card">
              <span className="moment-emoji">{m.emoji}</span>
              <div className="moment-card-top">
                <span className="moment-who">@{normalize(m.addedBy)}</span>
                <span className="moment-date">{fmt(m.ts)}</span>
              </div>
              <div className="moment-text">{m.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   PROMISES SECTION
══════════════════════════════════════════════════════ */
const DEFAULT_PROMISES = [
  { id:1, emoji:"🌅", text:"Встречать каждый день вместе, даже на расстоянии" },
  { id:2, emoji:"💬", text:"Говорить честно, даже когда это трудно" },
  { id:3, emoji:"🌱", text:"Расти вместе и поддерживать мечты друг друга" },
  { id:4, emoji:"💋", text:"Никогда не забывать, почему мы начали" },
];

function PromisesSection({ me }) {
  const [promises] = useState(DEFAULT_PROMISES);
  const [input, setInput] = useState("");
  const [myPromises, setMyPromises] = useState([]);

  const add = () => {
    if (!input.trim()) return;
    setMyPromises(p => [...p, { id: Date.now(), emoji:"💌", text: input.trim(), addedBy: me }]);
    setInput("");
  };

  return (
    <div className="s-section" id="promises">
      <div className="s-center">
        <span className="s-eyebrow">Наши обещания</span>
        <h2 className="s-h2">Слова, <em>которые важны</em></h2>
        <p className="s-sub">То, что вы обещаете друг другу — здесь, навсегда.</p>

        <div className="promises-list">
          {[...promises, ...myPromises].map(pr => (
            <div key={pr.id} className="promise-item">
              <div className="promise-icon">{pr.emoji}</div>
              <div>
                <div className="promise-text">{pr.text}</div>
                {pr.addedBy && <div className="promise-who">@{normalize(pr.addedBy)}</div>}
              </div>
            </div>
          ))}
        </div>

        <div className="promise-add">
          <input className="promise-input" placeholder="Добавить своё обещание…" value={input}
            onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/>
          <button className="cal-submit" disabled={!input.trim()} onClick={add}>Добавить</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   LANDING
══════════════════════════════════════════════════════ */
const SECTIONS = [
  {id:"hero",     label:"Главная"},
  {id:"timer",    label:"Счётчик"},
  {id:"calendar", label:"Календарь"},
  {id:"moments",  label:"Моменты"},
  {id:"promises", label:"Обещания"},
];
const DEFAULT_MSG = "Ты — лучшее, что есть в моей жизни 🌹";

function Landing({ me, partner, surpriseMsg, connectedAt, onDisconnect }) {
  const [navScrolled, setNavScrolled]     = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [startDate, setStartDate]         = useState(() => localStorage.getItem("duo_start_date") || "");

  // partner live state
  const [partnerScroll, setPartnerScroll]   = useState(null);
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

  // voice
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const recordStartRef   = useRef(null);

  // kiss
  const [myKissing, setMyKissing]           = useState(false);
  const [partnerKissing, setPartnerKissing] = useState(false);
  const [kissStart, setKissStart]           = useState(null);
  const kissToastKey = useRef(0);
  const [kissToast, setKissToast]           = useState(null);

  // vibe
  const [showVibe, setShowVibe]           = useState(false);
  const [vibeRipple, setVibeRipple]       = useState(null);
  const [vibeSentFlash, setVibeSentFlash] = useState(false);
  const lastVibeTs = useRef(0);

  // music
  const [musicOn, setMusicOn] = useState(false);

  // surprise
  const [surprise, setSurprise]     = useState(false);
  const surpriseFired = useRef(false);

  const scrollRef   = useRef(null);
  const sectionRefs = useRef({});
  const stateRef    = useRef({ scroll: 0, cursor: null });
  const saveThrottle = useRef(0);

  const pair = pairKey(me, partner);

  const flush = useCallback(async (extra = {}) => {
    const now = Date.now();
    if (now - saveThrottle.current < 400) return;
    saveThrottle.current = now;
    await saveState(me, { scroll: stateRef.current.scroll, cursor: stateRef.current.cursor, ...extra });
  }, [me]);

  // scroll tracking
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
      if (!surpriseFired.current && stateRef.current.scroll > 0.94) {
        surpriseFired.current = true; setSurprise(true);
      }
      flush();
    };
    el.addEventListener("scroll", fn, { passive: true });
    return () => el.removeEventListener("scroll", fn);
  }, [flush]);

  // cursor tracking
  useEffect(() => {
    const fn = e => { stateRef.current.cursor = { x: e.clientX/window.innerWidth, y: e.clientY/window.innerHeight }; flush(); };
    window.addEventListener("mousemove", fn);
    return () => window.removeEventListener("mousemove", fn);
  }, [flush]);

  // poll partner
  useEffect(() => {
    const iv = setInterval(async () => {
      const d = await loadState(partner); if (!d) return;
      if (d.scroll != null) setPartnerScroll(d.scroll);
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
      const pk = d.kissing || false;
      setPartnerKissing(pk);
      if (pk && myKissing && !kissStart) setKissStart(d.kissTs || Date.now());
      if (d.vibe && d.vibe.ts > lastVibeTs.current) {
        lastVibeTs.current = d.vibe.ts;
        const pat = VIBE_PATTERNS.find(p => p.id === d.vibe.id);
        if (pat && navigator.vibrate) navigator.vibrate(pat.pattern);
        setVibeRipple({ id: d.vibe.id, ts: d.vibe.ts });
      }
    }, POLL_MS);
    return () => clearInterval(iv);
  }, [partner, showChat, myKissing, kissStart]);

  useEffect(() => { msgsEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, showChat]);
  useEffect(() => { if (showChat) setUnread(0); }, [showChat]);

  const scrollTo = id => sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth" });

  const sendReaction = async emoji => {
    setShowReacts(false);
    const x = 35 + Math.random()*30, y = 25 + Math.random()*45;
    const id = ++reactId.current;
    setFloatReacts(p => [...p, { id, emoji, x:`${x}%`, y:`${y}%` }]);
    const st = await loadState(me) || {};
    await saveState(me, { ...st, reaction: { emoji, x, y, ts: Date.now() } });
  };

  const sendMsg = async (text, voiceData = null, voiceDur = null) => {
    const ts = Date.now();
    setMsgs(p => [...p, { text, from: me, ts, voiceData, voiceDur }]);
    const st = await loadState(me) || {};
    await saveState(me, { ...st, msg: { text, ts, voiceData, voiceDur } });
  };

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
          reader.onloadend = async () => { await sendMsg("🎤 Голосовое", reader.result.split(",")[1], dur); };
          reader.readAsDataURL(blob);
        }
        setIsRecording(false);
      };
      mr.start(); mediaRecorderRef.current = mr; recordStartRef.current = Date.now();
      setIsRecording(true);
      setTimeout(() => { if (mr.state === "recording") mr.stop(); }, 30000);
    } catch(e) { console.warn(e); }
  };
  const stopRecording = () => { if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop(); };

  const startKiss = async () => {
    setMyKissing(true);
    const ts = Date.now();
    await flush({ kissing: true, kissTs: ts });
    if (partnerKissing) setKissStart(ts);
  };
  const endKiss = async () => {
    if (!myKissing) return;
    const dur = kissStart ? Math.floor((Date.now()-kissStart)/1000) : null;
    setMyKissing(false); setKissStart(null);
    await flush({ kissing: false });
    if (partnerKissing && dur && dur > 0) {
      const key = ++kissToastKey.current;
      setKissToast({ key, dur });
      setTimeout(() => setKissToast(t => t?.key===key ? null : t), 5000);
    }
  };

  const sendVibe = async pattern => {
    setShowVibe(false);
    if (navigator.vibrate) navigator.vibrate([40]);
    setVibeSentFlash(true); setTimeout(() => setVibeSentFlash(false), 600);
    const st = await loadState(me) || {};
    await saveState(me, { ...st, vibe: { id: pattern.id, ts: Date.now() } });
  };

  const toggleMusic = () => { if (musicOn) { ambient.stop(); setMusicOn(false); } else { ambient.start(); setMusicOn(true); } };

  const handleStartDate = e => {
    setStartDate(e.target.value);
    localStorage.setItem("duo_start_date", e.target.value);
  };

  const ghostTop = partnerScroll !== null ? `calc(${partnerScroll*100}% - 18px)` : null;

  // hero stats
  const msSince = startDate ? Date.now() - new Date(startDate).getTime() : 0;
  const daysTogether = startDate && msSince > 0 ? Math.floor(msSince/86400000) : null;

  return (
    <div ref={scrollRef} className="land-wrap">
      <TogetherTimer connectedAt={connectedAt}/>

      {/* NAV */}
      <nav className={`lnav ${navScrolled?"scrolled":""}`}>
        <span className="lnav-logo">💕 {normalize(me)} & {normalize(partner)}</span>
        <ul className="lnav-links">
          {SECTIONS.map(s => <li key={s.id}><span className={`lnav-link ${activeSection===s.id?"active":""}`} onClick={()=>scrollTo(s.id)}>{s.label}</span></li>)}
        </ul>
      </nav>

      {/* ── HERO ── */}
      <section id="hero" ref={el=>sectionRefs.current.hero=el} className="s-hero">
        <span className="hero-eyebrow">Только вы двое</span>
        <h1 className="hero-h1">Наши<br/>отношения</h1>
        <p className="hero-sub">Календарь, воспоминания и обещания — всё в одном месте для вас двоих.</p>

        {daysTogether !== null && (
          <div className="hero-stats">
            <div><div className="hero-stat-n">{daysTogether}</div><div className="hero-stat-l">дней вместе</div></div>
            <div><div className="hero-stat-n">{Math.floor(daysTogether/7)}</div><div className="hero-stat-l">недель</div></div>
            <div><div className="hero-stat-n">{Math.floor(daysTogether/30)}</div><div className="hero-stat-l">месяцев</div></div>
          </div>
        )}

        <div className="hero-btns">
          <button className="btn-p" onClick={()=>scrollTo("moments")}>Наши моменты 🌹</button>
          <button className="btn-g" onClick={()=>scrollTo("calendar")}>Календарь 📅</button>
        </div>

        <div className="scroll-hint"><div className="scroll-hint-line"/></div>
      </section>

      <div className="section-divider"/>

      {/* ── LOVE TIMER ── */}
      <section id="timer" ref={el=>sectionRefs.current.timer=el} className="s-section">
        <div className="s-center">
          <span className="s-eyebrow">Счётчик любви</span>
          <h2 className="s-h2">Сколько мы <em>вместе</em></h2>
          <p className="s-sub">Каждая секунда считается.</p>

          {startDate
            ? <LoveTimer startDate={startDate}/>
            : <p style={{color:"var(--fg3)",fontSize:13,marginBottom:24}}>Укажи дату начала отношений</p>
          }

          <div className="start-date-card">
            <span className="start-date-label">Вместе с</span>
            <input className="start-date-input" type="date" value={startDate} onChange={handleStartDate}/>
          </div>
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── CALENDAR ── */}
      <section ref={el=>sectionRefs.current.calendar=el}>
        <CalendarSection pair={pair} me={me}/>
      </section>

      <div className="section-divider"/>

      {/* ── MOMENTS ── */}
      <section ref={el=>sectionRefs.current.moments=el}>
        <MomentsSection pair={pair} me={me} partner={partner}/>
      </section>

      <div className="section-divider"/>

      {/* ── PROMISES ── */}
      <section ref={el=>sectionRefs.current.promises=el}>
        <PromisesSection me={me}/>
      </section>

      <footer className="lfoot">
        <p className="foot-copy">@{normalize(me)} & @{normalize(partner)} · только вы двое 💕</p>
      </footer>

      {/* ═══ OVERLAYS ═══ */}
      {ghostTop && <div className="partner-bar"><div className="partner-bar-track"/><div className="partner-bar-thumb" style={{top:ghostTop}}/></div>}
      {partnerCursor && <div className="partner-cursor" style={{left:`${partnerCursor.x*100}%`,top:`${partnerCursor.y*100}%`}}><div className="partner-cursor-dot"/><div className="partner-cursor-lbl">@{normalize(partner)}</div></div>}
      {floatReacts.map(r=><FloatReact key={r.id} {...r} onDone={()=>setFloatReacts(p=>p.filter(x=>x.id!==r.id))}/>)}
      {showReacts && <div className="react-panel">{REACTS.map(e=><span key={e} className="react-em" onClick={()=>sendReaction(e)}>{e}</span>)}</div>}
      <KissOverlay myKissing={myKissing} partnerKissing={partnerKissing} kissStart={kissStart} partner={partner}/>
      {kissToast && <div key={kissToast.key} className="last-kiss-toast">💋 <strong>{kissToast.dur}с</strong> — ваш поцелуй</div>}
      {showVibe && <VibePanel onSend={sendVibe}/>}
      {vibeRipple && <VibeRipple key={vibeRipple.ts} vibe={vibeRipple} partner={partner} onDone={()=>setVibeRipple(null)}/>}
      {surprise && surpriseMsg && <SurpriseOverlay from={partner} message={surpriseMsg||DEFAULT_MSG} onClose={()=>setSurprise(false)}/>}

      {/* CHAT */}
      {showChat && <div className="chat-panel">
        <div className="chat-hd"><div><div className="chat-hd-title">💬 @{normalize(partner)}</div><div className="chat-hd-sub">Только вы двое</div></div><div className="chat-x" onClick={()=>setShowChat(false)}>✕</div></div>
        <div className="chat-msgs">
          {msgs.length===0 && <div className="chat-empty">Напиши первым 🌹</div>}
          {msgs.map((m,i)=>(
            <div key={i} className={`chat-msg ${m.from===me?"mine":"theirs"} ${m.voiceData?"voice":""}`}>
              {m.from!==me && <div className="chat-msg-from">@{normalize(m.from)}</div>}
              {m.voiceData ? <VoicePlayer audioData={m.voiceData} duration={m.voiceDur}/> : <div>{m.text}</div>}
            </div>
          ))}
          <div ref={msgsEnd}/>
        </div>
        <div className="chat-input-row">
          <button className={`chat-voice-btn ${isRecording?"recording":""}`} onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}>🎤</button>
          <input className="chat-input" placeholder="Напиши…" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&chatInput.trim()){sendMsg(chatInput.trim());setChatInput("");}}}/>
          <button className="chat-send" disabled={!chatInput.trim()} onClick={()=>{if(chatInput.trim()){sendMsg(chatInput.trim());setChatInput("");}}}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M13 1L1 5.5l5 2 2 5L13 1z" fill="white"/></svg>
          </button>
        </div>
      </div>}

      {/* RIBBON */}
      <div className="ribbon">
        <span className="ribbon-heart">💕</span>
        <div className="ribbon-ava">{normalize(partner)[0]}</div>
        <div className="ribbon-text">Вместе с <strong><span className="ribbon-at">@</span>{normalize(partner)}</strong></div>
        <div className="ribbon-actions">
          <div className={`rbtn ${musicOn?"active":""}`} onClick={toggleMusic}>{musicOn?<MusicBars/>:"🎵"}</div>
          <div className={`rbtn ${showVibe?"active":""} ${vibeSentFlash?"vibe-sent":""}`} onClick={()=>{setShowVibe(p=>!p);setShowReacts(false);setShowChat(false);}}>📳</div>
          <div className={`rbtn ${showReacts?"active":""}`} onClick={()=>{setShowReacts(p=>!p);setShowVibe(false);setShowChat(false);}}>🎯</div>
          <div className={`rbtn ${myKissing?"kiss-active":""}`} onMouseDown={startKiss} onMouseUp={endKiss} onTouchStart={startKiss} onTouchEnd={endKiss}>💋</div>
          <div style={{position:"relative"}}>
            <div className={`rbtn ${showChat?"active":""}`} onClick={()=>{setShowChat(p=>!p);setShowReacts(false);setShowVibe(false);}}>💬</div>
            {unread>0 && !showChat && <div className="rbtn-badge">{unread}</div>}
          </div>
        </div>
        <div className="ribbon-disc" onClick={onDisconnect}>Выйти</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TELEGRAM HOOK
══════════════════════════════════════════════════════ */
function useTelegram() {
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
  const isTMA = !!(tg && tg.initData);
  useEffect(() => { if (!tg || !isTMA) return; tg.ready(); tg.expand(); tg.setHeaderColor('#0d0810'); tg.setBackgroundColor('#0d0810'); }, []);
  const user = tg?.initDataUnsafe?.user;
  const username = user?.username || '';
  const startParam = tg?.initDataUnsafe?.start_param || '';
  const shareInvite = (myUsername) => {
    const botName = import.meta.env.VITE_BOT_USERNAME || 'duo_viewer_bot';
    const url = `https://t.me/${botName}?startapp=${encodeURIComponent(myUsername)}`;
    const text = `Открой наше приложение 💕`;
    if (tg && isTMA) tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    else navigator.clipboard?.writeText(url);
  };
  return { isTMA, username, startParam, shareInvite };
}

/* ══════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════ */
export default function App() {
  const [phase, setPhase]         = useState("connect");
  const [me, setMe]               = useState("");
  const [partner, setPartner]     = useState("");
  const [meInput, setMeInput]     = useState("");
  const [partnerInput, setPartnerInput] = useState("");
  const [surpriseInput, setSurpriseInput] = useState("");
  const [error, setError]         = useState("");
  const [connectedAt, setConnectedAt] = useState(null);
  const [copied, setCopied]       = useState(false);
  const pollRef  = useRef(null);
  const burstRef = useRef(null);

  const { isTMA, username, startParam, shareInvite } = useTelegram();

  useEffect(() => {
    const tag = document.createElement("style"); tag.textContent = CSS;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

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
        burstRef.current = setTimeout(() => { setConnectedAt(Date.now()); setPhase("landing"); }, 3200);
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
    setMeInput(username||""); setPartnerInput(""); setSurpriseInput("");
  };

  if (phase === "landing") return <Landing me={me} partner={partner} surpriseMsg={surpriseInput} connectedAt={connectedAt} onDisconnect={handleDisconnect}/>;

  if (phase === "burst") return (
    <div className="burst-wrap">
      <BurstHearts/>
      <div className="burst-ring"><div className="burst-icon">💖</div></div>
      <div className="burst-text">Вы вместе</div>
      <div className="burst-sub"><span>@{normalize(me)}</span> & <span>@{normalize(partner)}</span></div>
    </div>
  );

  return (
    <div className="co-wrap"><div className="co-bg"/><Petals/>
      <div className="co-card">
        <span className="co-heart">🌹</span>
        {phase === "waiting" ? (
          <div className="co-waiting">
            <div className="co-orb">💌</div>
            <div className="co-wait-name">Жду <span>@{normalize(partnerInput)}</span>…</div>
            <div className="co-wait-sub"><span className="co-wait-dot"/>Попроси <strong>@{normalize(partnerInput)}</strong> открыть приложение и ввести <strong>@{normalize(meInput)}</strong></div>
            <button className="co-btn" style={{marginTop:8,opacity:.85}} onClick={()=>{shareInvite(meInput.trim());setCopied(true);setTimeout(()=>setCopied(false),2000);}}>
              {copied?"✓ Ссылка скопирована!":(isTMA?"Отправить ссылку в Telegram ✈️":"Скопировать ссылку 🔗")}
            </button>
            <span className="co-cancel" onClick={async()=>{clearInterval(pollRef.current);await clearPresence(meInput.trim());setPhase("connect");}}>Отменить</span>
          </div>
        ) : (
          <>
            <h1 className="co-title">Наше приложение,<br/><em>только для двоих</em></h1>
            <p className="co-sub">Введи ники и оставь сюрприз — оно появится в самом конце.</p>
            <div className="co-divider"><div className="co-divider-line"/><span style={{opacity:.4,fontSize:13}}>✦</span><div className="co-divider-line"/></div>
            <div className="co-field">
              <label className="co-label">Твой ник</label>
              <div className="co-input-wrap"><span className="co-at">@</span>
                <input className="co-input" placeholder="username" value={meInput} onChange={e=>{setMeInput(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleConnect()} readOnly={isTMA&&!!username}/>
              </div>
              {isTMA&&username&&<p className="co-hint">✓ Получено из Telegram</p>}
            </div>
            <div className="co-field">
              <label className="co-label">Ник партнёра</label>
              <div className="co-input-wrap"><span className="co-at">@</span>
                <input className="co-input" placeholder="её / его username" value={partnerInput} onChange={e=>{setPartnerInput(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleConnect()}/>
              </div>
            </div>
            <div className="co-field">
              <label className="co-label">💌 Сюрприз-послание</label>
              <textarea className="co-input co-input-plain" placeholder="Появится в конце…" value={surpriseInput} onChange={e=>setSurpriseInput(e.target.value)} style={{resize:"none",height:64,paddingTop:10,lineHeight:1.5}}/>
              <p className="co-hint">Она увидит это когда долистает до конца 🌹</p>
            </div>
            {error && <p className="co-error">{error}</p>}
            <button className="co-btn" disabled={!meInput.trim()||!partnerInput.trim()} onClick={handleConnect}>Войти вместе 💕</button>
          </>
        )}
      </div>
    </div>
  );
}
