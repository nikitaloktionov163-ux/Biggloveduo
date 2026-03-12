import React, { useState, useEffect, useRef, useCallback } from "react";

/* ─── STORAGE ─── */
const SB_URL = 'https://zghswvujqwshonctoulx.supabase.co';
const SB_KEY = 'sb_publishable_uLz5P6pKZ_r7aru5HmvMbw_MWoxAM_t';
const TTL = 15 * 60 * 1000;
const n = s => (s||"").replace(/^@/,"").toLowerCase().trim();
const norm = n;
const pair = (a,b) => [n(a),n(b)].sort().join("·");

const sb = async (key, val) => {
  const base = `${SB_URL}/rest/v1/duo_store`;
  const h = { apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}`, "Content-Type":"application/json", Prefer:"resolution=merge-duplicates,return=minimal" };
  if (val===undefined) { const r=await fetch(`${base}?key=eq.${encodeURIComponent(key)}&select=value`,{headers:h}); return (await r.json())?.[0]?.value??null; }
  if (val===null) { await fetch(`${base}?key=eq.${encodeURIComponent(key)}`,{method:"DELETE",headers:h}); return; }
  await fetch(base,{method:"POST",headers:h,body:JSON.stringify({key,value:JSON.stringify(val)})});
};
const db = {
  set: (k,v)=>sb(k,v).catch(()=>{}),
  get: async k=>{ try{const r=await sb(k);return r?JSON.parse(r):null;}catch{return null;} },
  del: k=>sb(k,null).catch(()=>{}),
};
const TG_BOT_TOKEN=import.meta.env.VITE_TG_BOT_TOKEN||"";
const notifyPartner=async(partnerUsername,text,emoji="💕")=>{
  if(!TG_BOT_TOKEN||!partnerUsername)return;
  try{await db.set(`notify:${n(partnerUsername)}:${Date.now()}`,{text:`${emoji} ${text}`,ts:Date.now()});}catch(e){}
};
const coll = (ns, id) => ({ save: v=>db.set(`${ns}:${id}`,v), load: ()=>db.get(`${ns}:${id}`).then(r=>r||[]) });
const saveSt=(me,d)=>db.set(`st:${n(me)}`,{...d,ts:Date.now()});
const saveP=(me,to)=>db.set(`p:${n(me)}`,{wants:n(to),ts:Date.now()});
const loadP=async(me)=>{try{return await db.get(`p:${n(me)}`);}catch{return null;}};

// Realtime channel (polling fallback)
let realtimeChannel=null;
const subscribeToKey=(key,callback)=>{
  const url=`${SB_URL}/realtime/v1/websocket?apikey=${SB_KEY}&vsn=1.0.0`;
  return null;
};

function useSync(key,initialVal,interval=5000){
  const[data,setData]=useState(initialVal);
  const[loading,setLoading]=useState(true);
  const timer=useRef(null);
  const visible=useRef(true);
  useEffect(()=>{
    const onVis=()=>{visible.current=document.visibilityState==="visible";};
    document.addEventListener("visibilitychange",onVis);
    const poll=async()=>{
      if(!visible.current)return;
      try{const r=await db.get(key);if(r!==null)setData(r);}catch(e){}
      finally{setLoading(false);}
    };
    poll();
    timer.current=setInterval(poll,interval);
    return()=>{clearInterval(timer.current);document.removeEventListener("visibilitychange",onVis);};
  },[key,interval]);
  const refresh=useCallback(async(newVal)=>{setData(newVal);await db.set(key,newVal);},[key]);
  return{data,setData,loading,refresh};
}
function useOnline(){
  const[online,sO]=useState(typeof navigator!=="undefined"?navigator.onLine:true);
  useEffect(()=>{
    const on=()=>sO(true);
    const off=()=>sO(false);
    window.addEventListener("online",on);
    window.addEventListener("offline",off);
    return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off);};
  },[]);
  return online;
}
const loadSt=async u=>{const d=await db.get(`st:${n(u)}`);return d&&Date.now()-d.ts<TTL?d:null;};

/* ─── AMBIENT ─── */
const MUSIC_BASE=`${import.meta.env.BASE_URL}music`;
const TRACKS=[
  {id:"1",name:"Say Yes to Heaven",icon:"🌙",src:`${MUSIC_BASE}/t1.mp3`},
  {id:"2",name:"Summertime Sadness",icon:"🌹",src:`${MUSIC_BASE}/t2.mp3`},
  {id:"3",name:"Video Games",icon:"💕",src:`${MUSIC_BASE}/t3.mp3`},
  {id:"4",name:"Young & Beautiful",icon:"✨",src:`${MUSIC_BASE}/t4.mp3`},
  {id:"5",name:"Born to Die",icon:"🥀",src:`${MUSIC_BASE}/t5.mp3`},
  {id:"6",name:"Paradise",icon:"🌊",src:`${MUSIC_BASE}/t6.mp3`},
];

class Amb{
  constructor(){
    this.audio=null;
    this.trackId="1";
    this._fadeTimer=null;
  }

  start(id){
    this.stop();
    this.trackId=id||this.trackId;
    const track=TRACKS.find(t=>t.id===this.trackId)||TRACKS[0];
    const a=new Audio(track.src);
    a.loop=true;
    a.volume=0;
    a.play().catch(()=>{});
    this.audio=a;
    let v=0;
    this._fadeTimer=setInterval(()=>{
      if(!this.audio)return clearInterval(this._fadeTimer);
      v=Math.min(v+0.015,0.4);
      this.audio.volume=v;
      if(v>=0.4)clearInterval(this._fadeTimer);
    },80);
  }

  switchTo(id){
    const was=this.playing;
    this.stop();
    this.trackId=id;
    if(was)this.start(id);
  }

  stop(){
    clearInterval(this._fadeTimer);
    if(!this.audio)return;
    const a=this.audio;
    this.audio=null;
    let v=a.volume;
    const fade=setInterval(()=>{
      v=Math.max(v-0.03,0);
      a.volume=v;
      if(v<=0){clearInterval(fade);a.pause();a.src="";}
    },60);
  }

  get playing(){return!!(this.audio&&!this.audio.paused);}
}
const amb=new Amb();
function playSound(type){try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator();const g=ctx.createGain();o.connect(g);g.connect(ctx.destination);const sounds={kiss:{freq:880,type:"sine",dur:.18,vol:.3},react:{freq:660,type:"sine",dur:.12,vol:.25},vibe:{freq:220,type:"sawtooth",dur:.1,vol:.2},chat:{freq:540,type:"sine",dur:.15,vol:.2},music:{freq:440,type:"sine",dur:.2,vol:.25}};const s=sounds[type]||sounds.react;o.type=s.type;o.frequency.setValueAtTime(s.freq,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(s.freq*1.5,ctx.currentTime+s.dur);g.gain.setValueAtTime(s.vol,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+s.dur);o.start();o.stop(ctx.currentTime+s.dur);setTimeout(()=>ctx.close(),500);}catch(e){}}

/* ─── VIBES ─── */
const VIBES=[{id:"tap",icon:"👆",name:"Касание",pat:[80],intensity:1},{id:"hb",icon:"💓",name:"Сердце",pat:[150,80,150,80,150],intensity:2},{id:"fire",icon:"🔥",name:"Страсть",pat:[250,80,250,80,500,80,250],intensity:3},{id:"miss",icon:"💌",name:"Скучаю",pat:[100,50,100,50,400,50,100],intensity:2},{id:"thunder",icon:"⚡",name:"Гром",pat:[500,100,500,100,800],intensity:3},{id:"gentle",icon:"🌸",name:"Нежно",pat:[60,60,60],intensity:1}];
const STICKERS=["❤️","🌹","💕","😍","✨","🫶","💋","🥰","💖","🔥","😘","🌸","🦋","💌","🥺","😏","💫","🎀","🍓","🌙","💎","🫦","🤍","🥂"];

/* ─── CSS ─── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,700;1,9..144,200;1,9..144,400;1,9..144,600&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --d:'Fraunces',Georgia,serif;
  --b:'Plus Jakarta Sans',sans-serif;
  --c0:#07060d;--c1:#0e0c18;--c2:#141221;--c3:#1c192b;
  --ink:#f3eff4;--ink2:rgba(243,239,244,.6);--ink3:rgba(243,239,244,.28);--ink4:rgba(243,239,244,.1);
  --r:#c14268;--r2:#9a2f4e;--r3:rgba(193,66,104,.15);--r4:rgba(193,66,104,.06);
  --g:#b8924a;--g2:rgba(184,146,74,.12);
  --teal:#4ab8c1;--mint:#35c97e;
  --glass:rgba(20,18,33,.85);
  --e1:cubic-bezier(.22,1,.36,1);--e2:cubic-bezier(.34,1.56,.64,1);
}
@media(prefers-color-scheme:light){
  :root:not([data-theme="dark"]){
    --c0:#faf8f5;--c1:#f2ede8;--c2:#ede6df;--c3:#e4dbd2;
    --ink:#1a1420;--ink2:rgba(26,20,32,.7);--ink3:rgba(26,20,32,.35);--ink4:rgba(26,20,32,.08);
    --r:#b8365a;--r2:#8a2440;--r3:rgba(184,54,90,.12);--r4:rgba(184,54,90,.04);
    --glass:rgba(250,248,245,.9);
  }
}
[data-theme="light"]{
  --c0:#faf8f5;--c1:#f2ede8;--c2:#ede6df;--c3:#e4dbd2;
  --ink:#1a1420;--ink2:rgba(26,20,32,.7);--ink3:rgba(26,20,32,.35);--ink4:rgba(26,20,32,.08);
  --r:#b8365a;--r2:#8a2440;--r3:rgba(184,54,90,.12);--r4:rgba(184,54,90,.04);
  --glass:rgba(250,248,245,.9);
}
[data-theme="dark"]{
  --c0:#07060d;--c1:#0e0c18;--c2:#141221;--c3:#1c192b;
  --ink:#f3eff4;--ink2:rgba(243,239,244,.6);--ink3:rgba(243,239,244,.28);--ink4:rgba(243,239,244,.1);
}
html,body,#root{height:100%;background:var(--c0);color:var(--ink);font-family:var(--b);-webkit-font-smoothing:antialiased;}
::selection{background:rgba(193,66,104,.35);}
::-webkit-scrollbar{width:2px;}
::-webkit-scrollbar-thumb{background:rgba(193,66,104,.2);border-radius:2px;}

/* ── connect ── */
.co{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--c0);}
.co-aura{position:absolute;inset:0;pointer-events:none;}
.co-aura::before{content:"";position:absolute;width:700px;height:700px;border-radius:50%;top:-200px;left:-200px;background:radial-gradient(circle,rgba(193,66,104,.1) 0%,transparent 65%);animation:aurapulse 8s ease-in-out infinite;}
.co-aura::after{content:"";position:absolute;width:500px;height:500px;border-radius:50%;bottom:-150px;right:-100px;background:radial-gradient(circle,rgba(184,146,74,.07) 0%,transparent 60%);animation:aurapulse 10s ease-in-out 2s infinite;}
@keyframes aurapulse{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.15);opacity:1}}
.petals{position:absolute;inset:0;pointer-events:none;overflow:hidden;}
.petal{position:absolute;border-radius:60% 0 60% 0;opacity:0;animation:pf linear infinite;}
@keyframes pf{0%{opacity:0;transform:translateY(-20px) rotate(0deg)}8%{opacity:.25}92%{opacity:.1}100%{opacity:0;transform:translateY(108vh) rotate(500deg)}}
.co-card{position:relative;z-index:2;width:min(390px,94vw);background:var(--glass);border:1px solid rgba(193,66,104,.18);border-radius:28px;padding:36px 32px 32px;backdrop-filter:blur(48px) saturate(1.4);box-shadow:0 0 0 1px rgba(255,255,255,.04) inset,0 32px 96px rgba(0,0,0,.8),0 0 80px rgba(193,66,104,.08);animation:up .7s var(--e1) both;max-height:92svh;overflow-y:auto;}
@keyframes up{from{opacity:0;transform:translateY(22px) scale(.97)}to{opacity:1;transform:none}}
.co-gem{font-size:26px;display:block;margin-bottom:18px;filter:drop-shadow(0 0 12px rgba(193,66,104,.6));animation:hb 2.4s ease-in-out infinite;}
@keyframes hb{0%,100%{transform:scale(1)}14%{transform:scale(1.16)}28%{transform:scale(1)}}
.co-h{font-family:var(--d);font-size:clamp(23px,5.5vw,30px);font-weight:700;letter-spacing:-.025em;line-height:1.18;margin-bottom:4px;}
.co-h i{font-style:italic;font-weight:400;color:rgba(193,66,104,.85);}
.co-sub{font-size:13px;font-weight:300;color:var(--ink3);line-height:1.7;margin-bottom:24px;}
.field{margin-bottom:11px;}
.label{font-size:10px;font-weight:600;letter-spacing:.11em;text-transform:uppercase;color:rgba(193,66,104,.6);display:block;margin-bottom:5px;}
.hint{font-size:11px;color:var(--ink3);margin-top:3px;}
.iw{position:relative;display:flex;align-items:center;}
.iat{position:absolute;left:12px;font-size:14px;font-weight:500;color:rgba(193,66,104,.45);pointer-events:none;}
.inp{width:100%;padding:11px 12px 11px 27px;background:rgba(255,255,255,.04);border:1px solid rgba(193,66,104,.16);border-radius:12px;color:var(--ink);font-family:var(--b);font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s,background .2s;}
.inp:focus{background:rgba(193,66,104,.04);border-color:rgba(193,66,104,.45);box-shadow:0 0 0 3px rgba(193,66,104,.07);}
.inp::placeholder{color:var(--ink3);}
.inp-raw{padding-left:12px;}
.ta{width:100%;padding:10px 12px;background:rgba(255,255,255,.04);border:1px solid rgba(193,66,104,.16);border-radius:12px;color:var(--ink);font-family:var(--b);font-size:13px;font-weight:300;outline:none;resize:none;min-height:60px;line-height:1.6;transition:border-color .2s;}
.ta:focus{border-color:rgba(193,66,104,.45);}
.ta::placeholder{color:var(--ink3);}
.err{font-size:12px;color:#f06565;margin-bottom:10px;}
.btn-main{width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,var(--r),var(--r2));color:#fff;font-family:var(--b);font-size:14px;font-weight:600;border:none;cursor:pointer;letter-spacing:.01em;box-shadow:0 4px 20px rgba(193,66,104,.28),0 1px 0 rgba(255,255,255,.1) inset;transition:opacity .18s,transform .18s var(--e2),box-shadow .18s;}
.btn-main:hover:not(:disabled){opacity:.88;transform:translateY(-1px);box-shadow:0 8px 28px rgba(193,66,104,.35);}
.btn-main:active:not(:disabled){transform:translateY(0);}
.btn-main:disabled{opacity:.22;cursor:not-allowed;}
.sep{display:flex;align-items:center;gap:10px;margin:18px 0;}
.sep::before,.sep::after{content:"";flex:1;height:1px;background:rgba(193,66,104,.12);}
.sep span{font-size:11px;color:var(--ink3);}

/* waiting */
.wait{display:flex;flex-direction:column;align-items:center;gap:14px;padding:6px 0;animation:up .4s var(--e1) both;}
.orb{width:68px;height:68px;border-radius:50%;background:radial-gradient(circle at 40% 35%,rgba(193,66,104,.38),rgba(193,66,104,.05));border:1px solid rgba(193,66,104,.22);display:flex;align-items:center;justify-content:center;font-size:26px;position:relative;}
.orb::before,.orb::after{content:"";position:absolute;border-radius:50%;border:1px solid rgba(193,66,104,.1);animation:rr 2.2s ease-out infinite;}
.orb::before{inset:-10px;}
.orb::after{inset:-22px;animation-delay:.72s;border-color:rgba(193,66,104,.05);}
@keyframes rr{0%{opacity:.9;transform:scale(.83)}100%{opacity:0;transform:scale(1.28)}}
.wait-name{font-family:var(--d);font-size:20px;font-weight:700;}
.wait-name span{color:rgba(193,66,104,.85);}
.wait-tip{font-size:12px;font-weight:300;color:var(--ink3);text-align:center;max-width:250px;line-height:1.72;}
.wait-dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--r);vertical-align:middle;margin-right:5px;animation:blink 1.5s ease-in-out infinite;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.08}}
.wait-cancel{font-size:12px;color:var(--ink3);cursor:pointer;text-decoration:underline;text-underline-offset:3px;transition:color .2s;}
.wait-cancel:hover{color:var(--ink2);}

/* burst */
.burst{position:fixed;inset:0;z-index:1001;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--c0);animation:brst 3s var(--e1) forwards;pointer-events:none;overflow:hidden;}
@keyframes brst{0%,55%{opacity:1}100%{opacity:0}}
.burst-p{position:absolute;animation:bp linear forwards;opacity:0;}
@keyframes bp{0%{transform:translateY(0) rotate(var(--r)) scale(.5);opacity:0}10%{opacity:.9}100%{transform:translateY(-88vh) rotate(calc(var(--r) + 220deg)) scale(.5);opacity:0}}
.burst-ring{width:100px;height:100px;border-radius:50%;border:1.5px solid var(--r);display:flex;align-items:center;justify-content:center;animation:pop .58s var(--e2) .08s both;box-shadow:0 0 40px rgba(193,66,104,.4),0 0 80px rgba(193,66,104,.15);}
@keyframes pop{from{transform:scale(.12);opacity:0}to{transform:scale(1);opacity:1}}
.burst-icon{font-size:40px;animation:pop .65s var(--e2) .2s both;}
.burst-h{font-family:var(--d);font-size:clamp(28px,5.5vw,42px);font-weight:700;margin-top:24px;animation:su .7s var(--e1) .32s both;}
.burst-s{font-size:13px;color:var(--ink2);margin-top:5px;animation:su .7s var(--e1) .46s both;}
.burst-s span{color:rgba(193,66,104,.85);}
@keyframes su{from{opacity:0;transform:translateY(13px)}to{opacity:1;transform:none}}

/* ── APP SHELL ── */
.app{height:100svh;overflow-y:scroll;overflow-x:hidden;position:relative;scroll-behavior:smooth;}

/* nav */
.nav{position:fixed;top:0;left:0;right:0;z-index:800;height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(14px,4vw,40px);transition:all .3s;}
.nav.stuck{background:rgba(7,6,13,.88);backdrop-filter:blur(28px) saturate(1.5);border-bottom:1px solid rgba(255,255,255,.05);}
.nav-logo{font-family:var(--d);font-size:16px;font-style:italic;font-weight:400;color:rgba(193,66,104,.8);letter-spacing:-.02em;}
.nav-links{display:flex;gap:1px;list-style:none;}
.nl{font-size:11px;font-weight:500;color:var(--ink3);cursor:pointer;padding:4px 9px;border-radius:6px;transition:all .2s;}
.nl:hover,.nl.on{background:rgba(255,255,255,.06);color:var(--ink2);}
@media(max-width:560px){.nav-links{display:none;}}

/* together timer */
.tpill{position:fixed;top:52px;left:50%;transform:translateX(-50%);z-index:810;background:rgba(14,12,24,.9);border:1px solid rgba(193,66,104,.16);border-radius:999px;padding:4px 13px;backdrop-filter:blur(20px);display:flex;align-items:center;gap:7px;font-size:10px;font-weight:500;color:var(--ink3);white-space:nowrap;animation:up .4s var(--e1) both;}
.tpill-dot{width:4px;height:4px;border-radius:50%;background:var(--r);animation:blink 1.5s ease-in-out infinite;flex-shrink:0;}
.tpill-val{font-family:var(--d);font-size:13px;color:rgba(193,66,104,.85);}

/* partner bar */
.pbar{position:fixed;right:4px;top:0;bottom:0;width:2px;z-index:700;pointer-events:none;}
.pbar-track{position:absolute;inset:0;background:rgba(255,255,255,.03);border-radius:2px;}
.pbar-thumb{position:absolute;left:0;right:0;height:28px;border-radius:2px;background:var(--r);opacity:.6;box-shadow:0 0 8px rgba(193,66,104,.5);transition:top .55s var(--e1);}
.pcursor{position:fixed;pointer-events:none;z-index:860;transition:left .15s linear,top .15s linear;}
.pcursor-dot{width:10px;height:10px;border-radius:50%;background:var(--r);border:2px solid rgba(255,255,255,.5);box-shadow:0 0 10px rgba(193,66,104,.7);}
.pcursor-label{margin-top:4px;margin-left:3px;background:rgba(14,12,24,.92);border:1px solid rgba(193,66,104,.2);border-radius:6px;padding:2px 7px;font-size:10px;font-weight:500;color:var(--ink2);white-space:nowrap;}

/* ribbon */
.ribbon{position:fixed;bottom:max(16px,calc(16px + env(safe-area-inset-bottom)));left:50%;transform:translateX(-50%);z-index:900;background:rgba(10,8,20,.97);border:1px solid rgba(193,66,104,.3);border-radius:999px;padding:10px 18px 10px 14px;display:flex;align-items:center;gap:8px;backdrop-filter:blur(40px) saturate(1.8);box-shadow:0 0 0 1px rgba(255,255,255,.06) inset,0 8px 40px rgba(0,0,0,.85),0 0 32px rgba(193,66,104,.12);white-space:nowrap;max-width:96vw;min-width:280px;justify-content:center;}
.rib-ava{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,var(--r),#6a1128);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;text-transform:uppercase;flex-shrink:0;box-shadow:0 0 8px rgba(193,66,104,.3);}
.rsep{width:1px;height:14px;background:rgba(193,66,104,.15);flex-shrink:0;}
.rbtns{display:flex;gap:2px;}
.rb{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;transition:all .18s var(--e2);position:relative;flex-shrink:0;}
.rb:active{transform:scale(.88);}
.rb:hover{background:rgba(255,255,255,.11);transform:scale(1.08);}
.rb.on{background:rgba(193,66,104,.25);border-color:rgba(193,66,104,.5);}
.rb.kiss-on{background:rgba(193,66,104,.3);border-color:rgba(193,66,104,.6);box-shadow:0 0 10px rgba(193,66,104,.45);animation:kissanim 1s ease-in-out infinite;}
@keyframes kissanim{0%,100%{box-shadow:0 0 8px rgba(193,66,104,.35)}50%{box-shadow:0 0 18px rgba(193,66,104,.7)}}
.rb-badge{position:absolute;top:-4px;right:-4px;width:13px;height:13px;border-radius:50%;background:var(--r);font-size:7.5px;font-weight:700;display:flex;align-items:center;justify-content:center;border:1px solid var(--c0);}
.rib-exit{font-size:10px;font-weight:500;color:var(--ink3);cursor:pointer;transition:color .18s;padding-left:2px;}
.rib-exit:hover{color:rgba(240,100,100,.85);}
.mbars{display:flex;align-items:center;gap:1.5px;height:11px;}
.mbar{width:2px;border-radius:1px;background:rgba(193,66,104,.75);animation:mb var(--d,.5s) ease-in-out infinite alternate;}
@keyframes mb{0%{height:2px;opacity:.35}100%{height:var(--h,10px);opacity:.9}}

.track-picker{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:910;background:rgba(10,8,20,.97);border:1px solid rgba(193,66,104,.25);border-radius:20px;padding:14px;backdrop-filter:blur(40px);box-shadow:0 8px 40px rgba(0,0,0,.8);animation:up .25s var(--e1) both;display:flex;flex-direction:column;gap:6px;min-width:220px;}
.track-item{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;cursor:pointer;transition:background .15s;}
.track-item:active,.track-item.on{background:rgba(193,66,104,.15);}
.track-icon{font-size:20px;}
.track-name{font-size:13px;font-weight:500;color:var(--ink2);}
.track-active{margin-left:auto;width:6px;height:6px;border-radius:50%;background:var(--r);}

/* float reactions */
.fr{position:fixed;pointer-events:none;z-index:960;font-size:var(--fs,26px);animation:flt var(--dur,2.2s) var(--e1) forwards;}
@keyframes flt{0%{opacity:0;transform:translate(-50%,-50%) scale(.25)}12%{opacity:1;transform:translate(-50%,-50%) scale(1.18)}100%{opacity:0;transform:translate(-50%,calc(-50% - 96px)) scale(.6)}}

/* react panel */
.rpanel{position:fixed;bottom:64px;left:50%;transform:translateX(-50%);z-index:901;display:flex;gap:4px;background:rgba(14,12,24,.95);border:1px solid rgba(193,66,104,.2);border-radius:999px;padding:8px 14px;backdrop-filter:blur(24px);box-shadow:0 8px 32px rgba(0,0,0,.5);animation:up .22s var(--e1) both;}
.stickers{position:fixed;bottom:80px;right:12px;z-index:910;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:12px;background:rgba(14,12,24,.97);border:1px solid rgba(255,255,255,.08);border-radius:20px;backdrop-filter:blur(32px);box-shadow:0 8px 40px rgba(0,0,0,.8);animation:up .25s var(--e1) both;max-width:220px;}
.sticker{font-size:28px;cursor:pointer;text-align:center;padding:4px;border-radius:10px;transition:transform .15s var(--e2),background .15s;}
.sticker:active{transform:scale(1.3);background:rgba(193,66,104,.15);}
.sticker-fly{position:fixed;z-index:999;font-size:36px;pointer-events:none;animation:stickerFly .9s var(--e1) forwards;}
@keyframes stickerFly{0%{opacity:1;transform:scale(0.5) translateY(0)}60%{opacity:1;transform:scale(1.4) translateY(-60px)}100%{opacity:0;transform:scale(1) translateY(-120px)}}
.rem{font-size:20px;cursor:pointer;transition:transform .18s var(--e2);}
.rem:hover{transform:scale(1.32);}

/* vibe panel */
.vpanel{position:fixed;bottom:64px;left:50%;transform:translateX(-50%);z-index:901;background:rgba(14,12,24,.96);border:1px solid rgba(193,66,104,.2);border-radius:18px;padding:12px 13px 10px;backdrop-filter:blur(24px);min-width:195px;box-shadow:0 8px 32px rgba(0,0,0,.5);animation:up .22s var(--e1) both;}
.vpanel-t{font-size:9.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);text-align:center;margin-bottom:8px;}
.vopt{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:11px;cursor:pointer;transition:background .18s,transform .18s var(--e2);}
.vopt:hover{background:rgba(255,255,255,.05);transform:scale(1.02);}
.vopt-i{font-size:16px;}
.vopt-n{font-size:12px;font-weight:500;color:var(--ink2);}

/* vibe ripple */
.vripple{position:fixed;inset:0;z-index:970;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;}
.vring{position:absolute;border-radius:50%;border:1.5px solid;animation:vr var(--vd,1.5s) ease-out forwards;border-color:var(--vc);}
@keyframes vr{0%{width:0;height:0;opacity:.85;left:50%;top:50%;transform:translate(-50%,-50%)}100%{width:78vmax;height:78vmax;opacity:0;left:50%;top:50%;transform:translate(-50%,-50%)}}
.vripple-i{font-size:48px;animation:pop .38s var(--e2) both;filter:drop-shadow(0 0 22px var(--vc));}
.vripple-n{font-family:var(--d);font-size:clamp(16px,3.5vw,23px);font-weight:700;animation:su .42s var(--e1) .08s both;}
.vripple-s{font-size:12px;font-weight:300;color:var(--ink3);animation:su .42s var(--e1) .2s both;}

/* kiss */
.kiss-wrap{position:fixed;inset:0;z-index:950;display:flex;align-items:center;justify-content:center;pointer-events:none;}
.kiss-box{background:rgba(14,12,24,.94);border:1px solid rgba(193,66,104,.28);border-radius:20px;padding:14px 26px;text-align:center;backdrop-filter:blur(22px);box-shadow:0 0 48px rgba(193,66,104,.2);animation:up .32s var(--e1) both;}
.kiss-em{font-size:36px;display:block;margin-bottom:6px;animation:hb 1s ease-in-out infinite;}
.kiss-t{font-family:var(--d);font-size:46px;font-weight:700;letter-spacing:-.04em;line-height:1;background:linear-gradient(135deg,rgba(193,66,104,.9),var(--r2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.kiss-l{font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);margin-top:2px;}
.kiss-wait{font-size:12px;font-weight:300;color:var(--ink3);background:rgba(14,12,24,.9);border:1px solid rgba(193,66,104,.16);border-radius:16px;padding:10px 18px;backdrop-filter:blur(16px);}
.kiss-wait b{color:rgba(193,66,104,.8);}
.kiss-toast{position:fixed;top:58px;left:50%;transform:translateX(-50%);z-index:915;background:rgba(14,12,24,.96);border:1px solid rgba(193,66,104,.25);border-radius:12px;padding:8px 17px;font-size:12px;font-weight:500;color:var(--ink2);animation:up .28s var(--e1) both,fo 2.5s var(--e1) 1.5s forwards;pointer-events:none;white-space:nowrap;}
@keyframes fo{to{opacity:0}}
.kiss-toast b{color:rgba(193,66,104,.85);}

/* surprise */
.surp-bg{position:fixed;inset:0;z-index:990;display:flex;align-items:center;justify-content:center;background:rgba(7,6,13,.95);backdrop-filter:blur(12px);animation:up .55s var(--e1) both;}
.surp{width:min(360px,90vw);background:var(--glass);border:1px solid rgba(193,66,104,.2);border-radius:26px;padding:38px 28px 30px;text-align:center;box-shadow:0 28px 72px rgba(0,0,0,.72);animation:pop .62s var(--e2) .14s both;position:relative;overflow:hidden;}
.surp-shimmer{position:absolute;inset:0;border-radius:26px;background:radial-gradient(ellipse at 50% -10%,rgba(193,66,104,.12),transparent 60%);pointer-events:none;}
.surp-em{font-size:30px;display:block;margin-bottom:14px;animation:hb 2s ease-in-out infinite;}
.surp-t{font-family:var(--d);font-size:clamp(16px,3.8vw,22px);font-weight:700;color:rgba(193,66,104,.85);margin-bottom:11px;letter-spacing:-.02em;}
.surp-msg{font-family:var(--d);font-size:clamp(14px,2.2vw,18px);font-style:italic;font-weight:400;color:var(--ink2);line-height:1.82;margin-bottom:16px;}
.surp-from{font-size:10px;font-weight:500;letter-spacing:.06em;color:var(--ink3);margin-bottom:20px;text-transform:uppercase;}
.surp-btn{padding:10px 24px;border-radius:999px;background:linear-gradient(135deg,var(--r),var(--r2));color:#fff;font-family:var(--b);font-size:12px;font-weight:600;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(193,66,104,.25);transition:transform .18s var(--e2),box-shadow .18s;}
.surp-btn:hover{transform:scale(1.04);box-shadow:0 6px 22px rgba(193,66,104,.35);}

/* chat */
.chat{position:fixed;bottom:62px;right:16px;z-index:902;width:min(272px,86vw);background:rgba(14,12,24,.97);border:1px solid rgba(193,66,104,.18);border-radius:18px;backdrop-filter:blur(28px);box-shadow:0 12px 44px rgba(0,0,0,.6);display:flex;flex-direction:column;animation:up .22s var(--e1) both;}
.chat-hd{padding:9px 11px 8px;border-bottom:1px solid rgba(255,255,255,.05);display:flex;align-items:center;justify-content:space-between;}
.chat-ht{font-family:var(--d);font-size:12.5px;font-weight:700;letter-spacing:-.01em;}
.chat-hs{font-size:9.5px;color:var(--ink3);margin-top:1px;}
.chat-xb{width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:8.5px;color:var(--ink3);}
.chat-body{flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:5px;max-height:170px;min-height:40px;}
.chat-body::-webkit-scrollbar{width:2px;}
.chat-body::-webkit-scrollbar-thumb{background:rgba(193,66,104,.25);}
.cbbl{max-width:85%;padding:6px 9px;border-radius:12px;font-size:11px;line-height:1.55;animation:up .2s var(--e1) both;}
.cbbl.me{align-self:flex-end;background:linear-gradient(135deg,var(--r),var(--r2));color:#fff;border-bottom-right-radius:3px;}
.cbbl.them{align-self:flex-start;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.07);border-bottom-left-radius:3px;}
.cbbl-who{font-size:8px;font-weight:700;opacity:.5;margin-bottom:2px;letter-spacing:.04em;text-transform:uppercase;}
.chat-empty{font-size:11px;font-weight:300;color:var(--ink3);text-align:center;padding:12px 0;line-height:1.72;}
.chat-row{display:flex;gap:5px;padding:7px 8px;border-top:1px solid rgba(255,255,255,.04);}
.cinp{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(193,66,104,.14);border-radius:9px;padding:6px 8px;color:var(--ink);font-family:var(--b);font-size:11px;outline:none;transition:border-color .2s;}
.cinp:focus{border-color:rgba(193,66,104,.42);}
.cinp::placeholder{color:var(--ink3);}
.csend{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,var(--r),var(--r2));border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:transform .18s var(--e2);}
.csend:hover:not(:disabled){transform:scale(1.08);}
.csend:disabled{opacity:.25;cursor:not-allowed;}
.cmic{width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(193,66,104,.18);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;flex-shrink:0;transition:background .2s;}
.cmic.rec{background:rgba(193,66,104,.22);border-color:rgba(193,66,104,.5);animation:kissanim 1s ease-in-out infinite;}
.vp{display:flex;align-items:center;gap:6px;}
.vp-btn{width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.14);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.vp-bars{flex:1;height:20px;display:flex;align-items:center;gap:1.5px;}
.vp-bar{flex:1;max-width:3px;border-radius:2px;background:rgba(255,255,255,.28);transition:height .1s;}
.vp-dur{font-size:9px;opacity:.55;white-space:nowrap;}

/* ─── SECTIONS ─── */
.app-inner{scroll-snap-type:y proximity;}

/* hero */
.hero{min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px clamp(20px,5vw,60px) 100px;position:relative;overflow:hidden;}
.hero-mesh{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 80% 60% at 50% 25%,rgba(193,66,104,.11) 0%,transparent 55%),radial-gradient(ellipse 50% 40% at 80% 80%,rgba(184,146,74,.07) 0%,transparent 52%),radial-gradient(ellipse 40% 30% at 10% 60%,rgba(74,184,193,.05) 0%,transparent 48%);}
.hero-brow{font-size:9.5px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:var(--r);display:block;margin-bottom:14px;}
.hero-h1{font-family:var(--d);font-size:clamp(56px,11vw,130px);font-weight:700;letter-spacing:-.045em;line-height:.9;margin-bottom:11px;background:linear-gradient(160deg,var(--ink) 38%,rgba(243,239,244,.35));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.hero-sub{font-family:var(--d);font-size:clamp(15px,2.2vw,21px);font-style:italic;font-weight:400;color:var(--ink2);margin-bottom:32px;max-width:420px;}
.hero-stats{display:flex;gap:clamp(18px,5vw,56px);justify-content:center;flex-wrap:wrap;margin-bottom:40px;}
.hs-n{font-family:var(--d);font-size:clamp(34px,6vw,58px);font-weight:700;letter-spacing:-.04em;line-height:1;color:rgba(193,66,104,.88);}
.hs-l{font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);margin-top:3px;}
.hero-cta{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.cta-p{padding:12px 24px;border-radius:999px;background:linear-gradient(135deg,var(--r),var(--r2));color:#fff;font-family:var(--b);font-size:13px;font-weight:600;border:none;cursor:pointer;box-shadow:0 4px 18px rgba(193,66,104,.28),0 1px 0 rgba(255,255,255,.1) inset;transition:all .18s;}
.cta-s{padding:12px 24px;border-radius:999px;background:rgba(255,255,255,.05);color:var(--ink2);font-family:var(--b);font-size:13px;font-weight:500;border:1.5px solid rgba(255,255,255,.12);cursor:pointer;transition:all .18s;}
.cta-p:hover{transform:translateY(-1px);box-shadow:0 7px 24px rgba(193,66,104,.36);}
.cta-s:hover{background:rgba(255,255,255,.09);transform:translateY(-1px);}
.scroll-line{position:absolute;bottom:82px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:4px;animation:su 1s var(--e1) 2.2s both;}
.sline{width:1px;height:36px;background:linear-gradient(180deg,transparent,var(--r));animation:shim 1.8s ease-in-out infinite;}
@keyframes shim{0%,100%{opacity:.2;transform:scaleY(.5)}50%{opacity:.85;transform:scaleY(1)}}
.quote-card{max-width:380px;margin:32px auto 0;padding:20px 24px;background:rgba(255,255,255,.025);border:1px solid rgba(193,66,104,.12);border-radius:18px;text-align:center;position:relative;}
.quote-mark{font-family:var(--d);font-size:48px;line-height:.6;color:rgba(193,66,104,.25);margin-bottom:8px;display:block;}
.quote-text{font-family:var(--d);font-size:clamp(13px,2vw,16px);font-style:italic;font-weight:400;color:var(--ink2);line-height:1.75;margin-bottom:8px;}
.quote-author{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:rgba(193,66,104,.5);}

/* section */
.sec{padding:clamp(64px,9vw,108px) clamp(20px,5vw,56px);transition:opacity .28s var(--e1);}
.swipe-out-left{animation:swipeOutLeft .28s var(--e1) forwards;}
.swipe-out-right{animation:swipeOutRight .28s var(--e1) forwards;}
.swipe-in-left{animation:swipeInLeft .28s var(--e1) both;}
.swipe-in-right{animation:swipeInRight .28s var(--e1) both;}
@keyframes swipeOutLeft{to{opacity:0;transform:translateX(-40px)}}
@keyframes swipeOutRight{to{opacity:0;transform:translateX(40px)}}
@keyframes swipeInLeft{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}
@keyframes swipeInRight{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}
.sec-in{max-width:840px;margin:0 auto;text-align:center;}
.brow{font-size:9.5px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;color:var(--r);display:block;margin-bottom:10px;}
.sh{font-family:var(--d);font-size:clamp(26px,4.6vw,50px);font-weight:700;letter-spacing:-.03em;line-height:1.06;margin-bottom:9px;}
.sh em{font-family:var(--d);font-style:italic;font-weight:400;color:var(--ink2);}
.sp{font-size:clamp(12.5px,1.6vw,15px);font-weight:300;color:var(--ink2);line-height:1.78;max-width:460px;margin:0 auto 34px;}
.hr{height:1px;background:linear-gradient(90deg,transparent,rgba(193,66,104,.12),transparent);margin:0 clamp(18px,5vw,56px);}

/* love timer */
.ltd-row{display:flex;gap:clamp(9px,2.5vw,26px);justify-content:center;flex-wrap:wrap;margin-bottom:26px;}
.ltd-u{text-align:center;}
.ltd-n{font-family:var(--d);font-size:clamp(38px,7.5vw,80px);font-weight:700;letter-spacing:-.045em;line-height:1;background:linear-gradient(135deg,rgba(193,66,104,.9),var(--r2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.ltd-l{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin-top:3px;}
.ltd-col{font-family:var(--d);font-size:clamp(34px,6.5vw,72px);font-weight:300;color:rgba(193,66,104,.18);line-height:1;align-self:flex-start;margin-top:2px;}
.date-box{display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,.03);border:1px solid rgba(193,66,104,.14);border-radius:14px;padding:12px 18px;}
.date-lbl{font-size:10px;font-weight:500;color:var(--ink3);}
.date-inp{background:transparent;border:none;color:rgba(193,66,104,.8);font-family:var(--b);font-size:13px;font-weight:600;outline:none;cursor:pointer;}
.date-inp::-webkit-calendar-picker-indicator{filter:invert(.35) sepia(1) saturate(2) hue-rotate(280deg);cursor:pointer;}
.milestones{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:18px;}
.ms{padding:4px 12px;border-radius:999px;font-size:10.5px;font-weight:500;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);color:var(--ink3);transition:all .25s;}
.ms.hit{background:rgba(193,66,104,.09);border-color:rgba(193,66,104,.22);color:rgba(193,66,104,.78);}

/* cards */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;margin-bottom:18px;text-align:left;}
.card{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:14px 15px;transition:border-color .25s,transform .2s var(--e1),background .2s;animation:up .3s var(--e1) both;}
/* Skeleton */
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
.skel{border-radius:8px;background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 75%);background-size:200% 100%;animation:shimmer 1.6s infinite;}
.skel-text{height:14px;margin-bottom:8px;border-radius:4px;}
.skel-card{height:80px;border-radius:16px;margin-bottom:10px;}
.skel-circle{width:48px;height:48px;border-radius:50%;}
/* Onboarding */
.ob{position:fixed;inset:0;z-index:2000;background:var(--c0);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;}
.ob-steps{display:flex;gap:6px;margin-bottom:40px;}
.ob-step{width:24px;height:3px;border-radius:2px;background:rgba(255,255,255,.12);transition:background .3s;}
.ob-step.on{background:var(--r);width:32px;}
.ob-icon{font-size:64px;margin-bottom:24px;filter:drop-shadow(0 0 24px rgba(193,66,104,.4));animation:hb 2.4s ease-in-out infinite;}
.ob-title{font-family:var(--d);font-size:clamp(24px,6vw,32px);font-weight:700;text-align:center;line-height:1.2;margin-bottom:12px;}
.ob-title em{font-style:italic;font-weight:400;color:rgba(193,66,104,.85);}
.ob-desc{font-size:14px;font-weight:300;color:var(--ink3);text-align:center;line-height:1.7;max-width:280px;margin-bottom:40px;}
.ob-nav{display:flex;gap:12px;width:100%;}
.ob-skip{flex:1;padding:13px;border-radius:12px;background:transparent;border:1px solid rgba(255,255,255,.1);color:var(--ink3);font-family:var(--b);font-size:14px;cursor:pointer;}
.ob-next{flex:2;padding:13px;border-radius:12px;background:linear-gradient(135deg,var(--r),var(--r2));color:#fff;font-family:var(--b);font-size:14px;font-weight:600;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(193,66,104,.28);}
.offline-bar{position:fixed;top:0;left:0;right:0;z-index:9999;background:#2d1a1a;border-bottom:1px solid rgba(240,101,101,.3);padding:8px 16px;text-align:center;font-size:12px;color:#f06565;font-weight:500;}
.card:hover{border-color:rgba(193,66,104,.22);background:rgba(255,255,255,.04);transform:translateY(-2px);}
.card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;}
.card-em{font-size:18px;}
.card-meta{font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;}
.card-t{font-size:13.5px;font-weight:600;color:var(--ink);line-height:1.3;}
.card-d{font-size:11px;font-weight:300;color:var(--ink3);margin-top:3px;line-height:1.55;}
.card-chip{display:inline-block;margin-top:8px;padding:2px 8px;border-radius:6px;font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;}
.chip-soon{background:rgba(193,66,104,.1);color:rgba(193,66,104,.78);}
.chip-near{background:rgba(184,146,74,.1);color:rgba(184,146,74,.78);}
.chip-far{background:rgba(255,255,255,.05);color:var(--ink3);}
.chip-today{background:rgba(53,201,126,.1);color:rgba(53,201,126,.85);}
.chip-done{background:rgba(53,201,126,.1);color:rgba(53,201,126,.85);}
.chip-dream{background:rgba(74,184,193,.09);color:rgba(74,184,193,.8);}
.chip-planning{background:rgba(184,146,74,.1);color:rgba(184,146,74,.8);}
.chip-happy{background:rgba(193,66,104,.1);color:rgba(193,66,104,.75);}
.chip-tender{background:rgba(184,146,74,.1);color:rgba(184,146,74,.75);}
.chip-funny{background:rgba(74,184,193,.09);color:rgba(74,184,193,.75);}
.chip-important{background:rgba(191,90,242,.09);color:rgba(191,90,242,.78);}
.chip-high{background:rgba(193,66,104,.1);color:rgba(193,66,104,.78);}
.chip-med{background:rgba(184,146,74,.1);color:rgba(184,146,74,.78);}
.chip-low{background:rgba(255,255,255,.05);color:var(--ink3);}

/* add form */
.form{display:flex;flex-direction:column;gap:6px;max-width:460px;margin-inline:auto;margin-top:6px;}
.row{display:flex;gap:6px;}
.ep{display:flex;gap:4px;flex-wrap:wrap;justify-content:center;margin-bottom:2px;}
.eo{font-size:16px;cursor:pointer;padding:4px;border-radius:7px;transition:background .18s,transform .18s var(--e2);}
.eo:hover{background:rgba(255,255,255,.08);transform:scale(1.18);}
.eo.s{background:rgba(193,66,104,.16);}
.fi{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(193,66,104,.14);border-radius:11px;padding:9px 11px;color:var(--ink);font-family:var(--b);font-size:13px;font-weight:300;outline:none;transition:border-color .2s,background .2s;}
.fi:focus{background:rgba(193,66,104,.03);border-color:rgba(193,66,104,.42);}
.fi::placeholder{color:var(--ink3);}
.fi-date{color:var(--ink2);}
.fi-date::-webkit-calendar-picker-indicator{filter:invert(.35);}
.ta2{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(193,66,104,.14);border-radius:11px;padding:9px 11px;color:var(--ink);font-family:var(--b);font-size:13px;font-weight:300;outline:none;resize:none;min-height:60px;line-height:1.6;transition:border-color .2s;}
.ta2:focus{border-color:rgba(193,66,104,.42);}
.ta2::placeholder{color:var(--ink3);}
.fa{padding:9px 18px;border-radius:10px;background:linear-gradient(135deg,var(--r),var(--r2));color:#fff;font-family:var(--b);font-size:12px;font-weight:600;border:none;cursor:pointer;white-space:nowrap;transition:all .18s;box-shadow:0 3px 14px rgba(193,66,104,.22);}
.fa:hover:not(:disabled){opacity:.88;transform:translateY(-1px);}
.fa:disabled{opacity:.22;cursor:not-allowed;}

/* chips picker */
.cp{display:flex;gap:4px;flex-wrap:wrap;justify-content:center;}
.copt{padding:5px 11px;border-radius:999px;font-size:10px;font-weight:600;cursor:pointer;border:1px solid transparent;transition:all .2s;}
.copt:hover{transform:scale(1.04);}
.copt.s{transform:scale(1.06);box-shadow:0 0 10px rgba(255,255,255,.07);}

/* dreams two cols */
.dcols{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:26px;text-align:left;}
@media(max-width:540px){.dcols{grid-template-columns:1fr;}}
.dcol{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:18px;padding:17px;}
.dcol-h{font-family:var(--d);font-size:14px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:7px;letter-spacing:-.01em;}
.di{display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);}
.di:last-of-type{border-bottom:none;}
.dchk{width:15px;height:15px;border-radius:4px;border:1.5px solid rgba(193,66,104,.3);background:transparent;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .2s;margin-top:1px;}
.dchk.ok{background:var(--mint);border-color:var(--mint);}
.di-txt{font-size:12.5px;font-weight:300;color:var(--ink2);line-height:1.58;flex:1;}
.di-done{text-decoration:line-through;opacity:.38;}
.dadd{display:flex;gap:5px;margin-top:11px;}

/* wish tabs */
.wtabs{display:inline-flex;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:11px;padding:3px;gap:2px;margin-bottom:22px;}
.wtab{padding:5px 14px;border-radius:9px;font-size:10.5px;font-weight:600;color:var(--ink3);cursor:pointer;transition:all .2s;}
.wtab.on{background:rgba(193,66,104,.16);color:rgba(193,66,104,.9);border:1px solid rgba(193,66,104,.22);}
.wcard-fulfill{margin-top:9px;padding:4px 10px;border-radius:8px;background:linear-gradient(135deg,var(--r),var(--r2));color:#fff;font-size:10px;font-weight:600;border:none;cursor:pointer;transition:opacity .18s;box-shadow:0 2px 10px rgba(193,66,104,.2);}
.wcard-fulfill:hover{opacity:.82;}
.wcard-done{margin-top:7px;font-size:10px;color:var(--mint);font-weight:600;}

/* travel stats */
.tcounts{display:flex;gap:14px;justify-content:center;margin-bottom:22px;flex-wrap:wrap;}
.tcount{text-align:center;padding:10px 16px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.05);border-radius:14px;}
.tc-n{font-family:var(--d);font-size:30px;font-weight:700;letter-spacing:-.03em;line-height:1;}
.tc-n.dream{color:var(--teal);}
.tc-n.planning{color:var(--g);}
.tc-n.been{color:var(--mint);}
.tc-l{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink3);margin-top:2px;}
.travel-hint{font-size:9.5px;font-style:italic;color:var(--ink3);margin-top:6px;}

/* promises */
.plist{display:flex;flex-direction:column;gap:8px;max-width:580px;margin-inline:auto;margin-bottom:18px;text-align:left;}
.pi{display:flex;align-items:flex-start;gap:10px;padding:13px 14px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.05);border-radius:14px;transition:all .2s var(--e1);}
.pi:hover{border-color:rgba(193,66,104,.18);transform:translateX(3px);}
.pi-em{font-size:15px;flex-shrink:0;margin-top:1px;}
.pi-body{flex:1;}
.pi-t{font-size:13px;font-weight:400;color:var(--ink2);line-height:1.62;}
.pi-t.done{text-decoration:line-through;opacity:.38;}
.pi-who{font-size:9px;color:rgba(193,66,104,.5);font-weight:600;margin-top:3px;text-transform:uppercase;letter-spacing:.05em;}
.pi-chk{width:17px;height:17px;border-radius:5px;border:1.5px solid rgba(193,66,104,.25);background:transparent;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .2s;margin-top:1px;}
.pi-chk.ok{background:var(--r);border-color:var(--r);}
.padd{display:flex;gap:6px;max-width:580px;margin-inline:auto;}

/* empty state */
.empty{padding:28px 0;text-align:center;font-size:12px;font-weight:300;color:var(--ink3);grid-column:1/-1;line-height:1.7;}
.surprise-btn{padding:9px 22px;border-radius:999px;background:linear-gradient(135deg,rgba(193,66,104,.15),rgba(184,146,74,.12));border:1px solid rgba(193,66,104,.25);color:var(--ink2);font-family:var(--b);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s var(--e2);}
.surprise-btn:hover{transform:scale(1.04);border-color:rgba(193,66,104,.4);}
.mem-overlay{position:fixed;inset:0;z-index:980;background:rgba(7,6,13,.88);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadein .3s ease both;}
@keyframes fadein{from{opacity:0}to{opacity:1}}
.mem-card{background:rgba(20,18,33,.97);border:1px solid rgba(193,66,104,.2);border-radius:24px;padding:32px 28px;max-width:380px;width:100%;text-align:center;position:relative;animation:up .38s var(--e1) both;}
.mem-em{font-size:52px;display:block;margin-bottom:12px;line-height:1;}
.mem-tag-chip{display:inline-block;padding:3px 12px;border-radius:999px;background:rgba(193,66,104,.1);border:1px solid rgba(193,66,104,.2);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:rgba(193,66,104,.7);margin-bottom:16px;}
.mem-text{font-family:var(--d);font-size:clamp(15px,3vw,20px);font-style:italic;color:var(--ink);line-height:1.7;margin-bottom:16px;}
.mem-by{font-size:10px;color:var(--ink3);margin-bottom:4px;}
.mem-date{font-size:10px;color:var(--ink3);margin-bottom:20px;}
.mem-close{position:absolute;top:14px;right:14px;background:none;border:none;font-size:14px;color:var(--ink3);cursor:pointer;padding:4px 8px;}
.mem-another{padding:9px 22px;border-radius:999px;background:linear-gradient(135deg,var(--r),var(--r2));color:#fff;font-family:var(--b);font-size:12px;font-weight:600;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(193,66,104,.3);transition:transform .18s var(--e2);}
.mem-another:hover{transform:scale(1.04);}

/* footer */
.prof-wrap{max-width:480px;margin-inline:auto;text-align:center;}
.prof-avs{display:flex;align-items:center;justify-content:center;gap:22px;margin-bottom:14px;}
.prof-av{width:68px;height:68px;border-radius:50%;border:2px solid rgba(193,66,104,.3);object-fit:cover;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;text-transform:uppercase;box-shadow:0 0 20px rgba(193,66,104,.12);}
.prof-av-me{background:linear-gradient(135deg,var(--r),#6a1128);}
.prof-av-pt{background:linear-gradient(135deg,#4a6fa5,#1a3a6a);}
.prof-heart{font-size:22px;animation:hb 2.4s ease-in-out infinite;filter:drop-shadow(0 0 8px rgba(193,66,104,.5));}
.prof-names{display:flex;gap:40px;justify-content:center;font-size:11px;font-weight:500;color:var(--ink3);margin-bottom:20px;}
.prof-since{font-size:12px;color:var(--ink3);margin-bottom:20px;}
.prof-since b{color:rgba(193,66,104,.75);}
.prof-stats{display:flex;gap:clamp(12px,4vw,40px);justify-content:center;margin-bottom:22px;flex-wrap:wrap;}
.prof-stat-n{font-family:var(--d);font-size:clamp(28px,5vw,42px);font-weight:700;letter-spacing:-.04em;line-height:1;color:rgba(193,66,104,.85);}
.prof-stat-l{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink3);margin-top:3px;}
.prof-bio{font-family:var(--d);font-size:clamp(13px,2vw,17px);font-style:italic;font-weight:400;color:var(--ink2);line-height:1.78;margin-bottom:20px;max-width:320px;margin-inline:auto;}
.prof-edit-btn{padding:7px 18px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:var(--ink2);font-family:var(--b);font-size:11px;font-weight:500;cursor:pointer;transition:all .2s;}
.prof-edit-btn:hover{background:rgba(255,255,255,.09);border-color:rgba(193,66,104,.28);}
.prof-form{background:rgba(255,255,255,.025);border:1px solid rgba(193,66,104,.15);border-radius:18px;padding:16px;margin-top:14px;display:flex;flex-direction:column;gap:7px;text-align:left;animation:up .28s var(--e1) both;}
.prof-char{font-size:9.5px;color:var(--ink3);text-align:right;margin-top:-4px;}
.mood-today{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;max-width:480px;margin-inline:auto;}
.mood-side{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:18px;padding:16px;text-align:center;transition:border-color .3s;}
.mood-side.has-mood{border-color:rgba(193,66,104,.18);}
.mood-side-who{font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--ink3);margin-bottom:10px;}
.mood-big{font-size:44px;display:block;margin-bottom:5px;line-height:1;}
.mood-label{font-size:12px;font-weight:500;color:var(--ink2);}
.mood-note{font-size:11px;font-weight:300;color:var(--ink3);margin-top:4px;font-style:italic;}
.mood-empty{font-size:28px;opacity:.2;display:block;margin-bottom:5px;}
.mood-empty-hint{font-size:11px;color:var(--ink3);}
.mood-picker{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:14px;max-width:360px;margin-inline:auto;}
.mood-opt{font-size:24px;cursor:pointer;padding:7px;border-radius:12px;border:1.5px solid transparent;transition:all .18s var(--e2);line-height:1;}
.mood-opt:hover{transform:scale(1.18);}
.mood-opt.sel{border-color:rgba(193,66,104,.45);background:rgba(193,66,104,.1);transform:scale(1.12);}
.mood-hist{max-width:480px;margin-inline:auto;margin-top:8px;}
.mood-hist-hd{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--ink3);margin-bottom:10px;text-align:center;}
.mood-hist-row{display:flex;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);}
.mood-hist-date{font-size:11px;color:var(--ink3);flex:1;}
.mood-hist-emojis{display:flex;gap:16px;font-size:22px;}
.rib-mood{font-size:15px;line-height:1;margin-left:2px;}
.qa-today{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:20px;padding:22px;max-width:560px;margin-inline:auto;margin-bottom:20px;}
.qa-q{font-family:var(--d);font-size:clamp(15px,2.5vw,20px);font-style:italic;font-weight:400;color:var(--ink);line-height:1.65;text-align:center;margin-bottom:18px;}
.qa-q-small{font-family:var(--d);font-size:13px;font-style:italic;color:var(--ink2);margin-bottom:10px;text-align:center;}
.qa-answers{display:flex;flex-direction:column;gap:8px;}
.qa-ans-card{padding:12px 14px;border-radius:14px;}
.qa-ans-card.mine{background:rgba(193,66,104,.08);border:1px solid rgba(193,66,104,.2);}
.qa-ans-card.theirs{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);}
.qa-ans-who{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(193,66,104,.6);margin-bottom:5px;}
.qa-ans-text{font-size:13px;font-weight:300;color:var(--ink2);line-height:1.65;}
.qa-waiting{font-size:12px;color:var(--ink3);text-align:center;padding:14px;background:rgba(255,255,255,.02);border-radius:12px;border:1px dashed rgba(255,255,255,.08);}
.qa-archive{max-width:560px;margin-inline:auto;}
.qa-archive summary{font-size:11px;font-weight:600;color:var(--ink3);cursor:pointer;padding:10px 0;text-align:center;list-style:none;}
.qa-archive-item{padding:16px 0;border-top:1px solid rgba(255,255,255,.04);}
.map-container{width:100%;height:300px;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.08);margin-bottom:14px;}
.map-controls{margin-bottom:12px;text-align:center;}
.map-tip{font-size:12px;color:rgba(193,66,104,.8);padding:10px 14px;background:rgba(193,66,104,.07);border-radius:10px;border:1px solid rgba(193,66,104,.18);display:inline-block;}
.map-form{display:flex;flex-direction:column;gap:7px;max-width:380px;margin-inline:auto;margin-top:10px;}
.places-list{display:flex;flex-direction:column;gap:6px;max-width:480px;margin-inline:auto;margin-top:4px;}
.place-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:12px;cursor:pointer;transition:all .2s var(--e1);}
.place-item:hover{border-color:rgba(193,66,104,.22);transform:translateX(3px);}
.place-em{font-size:20px;flex-shrink:0;}
.place-name{font-size:13px;font-weight:600;color:var(--ink);}
.place-note{font-size:11px;color:var(--ink3);margin-top:2px;}
.place-del{font-size:10px;color:var(--ink3);cursor:pointer;margin-left:auto;padding:2px 5px;border-radius:4px;transition:color .18s;}
.place-del:hover{color:rgba(240,100,100,.7);}
.week-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:20px;max-width:700px;margin-inline:auto;}
@media(max-width:560px){.week-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:8px;}.week-grid{grid-template-columns:repeat(7,minmax(88px,1fr));gap:6px;min-width:620px;}}
.week-day{display:flex;flex-direction:column;gap:4px;}
.week-day-hd{text-align:center;padding:6px 2px;border-radius:8px;border:1px solid rgba(255,255,255,.06);}
.week-day-name{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);}
.week-day-num{font-family:var(--d);font-size:16px;font-weight:700;color:var(--ink2);line-height:1.1;}
.week-day-hd.today{background:rgba(193,66,104,.12);border-color:rgba(193,66,104,.35);}
.week-day-hd.today .week-day-num{color:rgba(193,66,104,.9);}
.week-plans{display:flex;flex-direction:column;gap:3px;min-height:40px;}
.week-plan{padding:4px 6px;border-radius:6px;font-size:10px;line-height:1.35;cursor:pointer;transition:opacity .18s;word-break:break-word;}
.week-plan.mine{background:rgba(193,66,104,.15);border:1px solid rgba(193,66,104,.25);color:var(--ink);}
.week-plan.theirs{background:rgba(74,184,193,.1);border:1px solid rgba(74,184,193,.2);color:var(--ink);}
.week-plan:hover{opacity:.7;}
.week-add-row{display:flex;gap:6px;align-items:center;margin-top:3px;}
.week-add-inp{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:7px;padding:5px 7px;font-size:10px;color:var(--ink);font-family:var(--b);outline:none;transition:border-color .18s;}
.week-add-inp:focus{border-color:rgba(193,66,104,.35);}
.week-add-btn{padding:5px 8px;border-radius:7px;background:rgba(193,66,104,.2);border:1px solid rgba(193,66,104,.3);color:rgba(193,66,104,.9);font-size:11px;cursor:pointer;font-weight:700;transition:all .18s;}
.week-add-btn:hover{background:rgba(193,66,104,.3);}
.week-legend{display:flex;gap:14px;justify-content:center;margin-bottom:14px;font-size:10px;color:var(--ink3);}
.week-legend-dot{width:8px;height:8px;border-radius:2px;display:inline-block;margin-right:4px;vertical-align:middle;}
.swipe-dots{position:fixed;bottom:max(62px,calc(62px + env(safe-area-inset-bottom)));left:50%;transform:translateX(-50%);z-index:895;display:none;gap:5px;padding:5px 10px;background:rgba(7,6,13,.72);border-radius:999px;backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.06);}
@media(max-width:560px){.swipe-dots{display:flex;}}
.swipe-dot{width:5px;height:5px;border-radius:50%;background:rgba(243,239,244,.18);transition:all .3s var(--e1);flex-shrink:0;}
.swipe-dot.on{background:var(--r);width:14px;border-radius:3px;box-shadow:0 0 6px rgba(193,66,104,.5);}
.foot{border-top:1px solid rgba(255,255,255,.04);padding:24px clamp(20px,5vw,56px);text-align:center;}
.foot-t{font-size:10px;font-weight:300;color:rgba(255,255,255,.1);line-height:1.7;}
.shop-form{max-width:480px;margin-inline:auto;margin-bottom:14px;display:flex;flex-direction:column;gap:7px;}
.shop-cats{display:flex;gap:5px;justify-content:center;flex-wrap:wrap;max-width:380px;margin-inline:auto;}
.shop-cat{font-size:20px;padding:6px 8px;border-radius:10px;border:1.5px solid transparent;cursor:pointer;transition:all .18s var(--e2);line-height:1;}
.shop-cat:hover{transform:scale(1.12);}
.shop-cat.on{border-color:rgba(193,66,104,.4);background:rgba(193,66,104,.1);}
.shop-filters{display:flex;gap:6px;justify-content:center;margin-bottom:14px;flex-wrap:wrap;}
.shop-filter{padding:5px 14px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:var(--ink3);font-family:var(--b);font-size:11px;font-weight:500;cursor:pointer;transition:all .18s;display:flex;align-items:center;gap:4px;}
.shop-filter.on{background:rgba(193,66,104,.12);border-color:rgba(193,66,104,.3);color:var(--ink);}
.shop-filter-n{background:rgba(255,255,255,.1);border-radius:999px;padding:1px 6px;font-size:10px;}
.shop-clear{padding:5px 12px;border-radius:999px;background:none;border:1px solid rgba(255,255,255,.06);color:var(--ink3);font-size:10px;cursor:pointer;transition:all .18s;}
.shop-clear:hover{border-color:rgba(240,100,100,.3);color:rgba(240,100,100,.6);}
.shop-list{max-width:480px;margin-inline:auto;display:flex;flex-direction:column;gap:6px;}
.shop-item{display:flex;align-items:center;gap:8px;padding:11px 12px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:13px;transition:all .2s var(--e1);}
.shop-item.done{opacity:.5;}
.shop-item-cat{font-size:18px;flex-shrink:0;}
.shop-chk{width:20px;height:20px;border-radius:6px;border:1.5px solid rgba(255,255,255,.18);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0;}
.shop-chk.ok{background:var(--mint);border-color:var(--mint);}
.shop-item-body{flex:1;min-width:0;}
.shop-item-text{font-size:13px;font-weight:500;color:var(--ink);transition:all .2s;}
.shop-item-text.done{text-decoration:line-through;color:var(--ink3);}
.shop-item-meta{font-size:9.5px;color:var(--ink3);margin-top:2px;}
.shop-del{font-size:10px;color:var(--ink3);cursor:pointer;padding:3px 6px;border-radius:5px;transition:color .18s;flex-shrink:0;}
.shop-del:hover{color:rgba(240,100,100,.7);}
.empty-hint{text-align:center;font-size:12px;color:var(--ink3);padding:24px 0;}
`;

/* ─── UTILS ─── */
function Petals() {
  return <>{Array.from({length:14},(_,i)=>(
    <div key={i} className="petal" style={{left:`${5+Math.random()*90}%`,width:`${5+Math.random()*9}px`,height:`${3+Math.random()*8}px`,top:"-18px",background:["rgba(193,66,104,.14)","rgba(184,146,74,.1)","rgba(193,66,104,.07)"][i%3],animationDuration:`${11+Math.random()*17}s`,animationDelay:`${Math.random()*16}s`}}/>
  ))}</>;
}
function BurstPetals(){return <>{Array.from({length:24},(_,i)=><div key={i} className="burst-p" style={{left:`${5+Math.random()*90}%`,top:`${50+Math.random()*40}%`,fontSize:`${13+Math.random()*18}px`,"--r":`${Math.random()*60-30}deg`,animationDuration:`${1.9+Math.random()*2.2}s`,animationDelay:`${Math.random()*.9}s`}}>{"❤️💕🌹✨💖🫶💋🥰"[i%8]}</div>)}</>;
}
function FloatReact({emoji,x,y,onDone}){const dur=2.1+Math.random()*.8,fs=23+Math.random()*16;useEffect(()=>{const t=setTimeout(onDone,(dur+.1)*1000);return()=>clearTimeout(t);},[]);return <div className="fr" style={{left:x,top:y,"--fs":`${fs}px`,"--dur":`${dur}s`}}>{emoji}</div>;}
function MBars(){return <div className="mbars">{[9,5,8,3,8,5,10].map((h,i)=><div key={i} className="mbar" style={{"--h":`${h}px`,"--d":`${.25+i*.09}s`}}/>)}</div>;}
function Timer({t0}){const[e,se]=useState(0);useEffect(()=>{const iv=setInterval(()=>se(Math.floor((Date.now()-t0)/1000)),1000);return()=>clearInterval(iv);},[t0]);const m=Math.floor(e/60),s=e%60;return <div className="tpill"><div className="tpill-dot"/><span>Вместе</span><span className="tpill-val">{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</span></div>;}
function LoveTimer({start}){const[d,sd]=useState({});useEffect(()=>{const calc=()=>{const ms=Date.now()-new Date(start).getTime();if(ms<0){sd({});return;}sd({d:Math.floor(ms/86400000),h:Math.floor(ms%86400000/3600000),m:Math.floor(ms%3600000/60000),s:Math.floor(ms%60000/1000)});};calc();const iv=setInterval(calc,1000);return()=>clearInterval(iv);},[start]);if(!d.d&&d.d!==0)return null;return <div className="ltd-row">{[["d","дней"],["h","часов"],["m","минут"],["s","секунд"]].map(([k,l],i,a)=><div key={k} style={{display:"flex",alignItems:"center",gap:i<a.length-1?"clamp(9px,2vw,26px)":0}}><div className="ltd-u"><div className="ltd-n">{String(d[k]).padStart(2,"0")}</div><div className="ltd-l">{l}</div></div>{i<a.length-1&&<div className="ltd-col">:</div>}</div>)}</div>;}
const b64Blob=(b64,t)=>{const bin=atob(b64);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:t});};
function VoicePlayer({data,dur}){const[p,sp]=useState(false);const ar=useRef(null);useEffect(()=>{if(!data)return;const url=URL.createObjectURL(new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))]));const a=new Audio(url);a.onended=()=>sp(false);ar.current=a;return()=>{a.pause();URL.revokeObjectURL(url);};},[data]);const toggle=()=>{const a=ar.current;if(!a)return;if(p){a.pause();a.currentTime=0;sp(false);}else{a.play();sp(true);}};const bars=Array.from({length:14},()=>Math.max(4,Math.sin(Math.random()*3)*9+Math.random()*5+4));return <div className="vp"><button className="vp-btn" onClick={toggle}>{p?<svg width="8" height="8"><rect x="1" y="1" width="2.5" height="6" rx="1" fill="white"/><rect x="4.5" y="1" width="2.5" height="6" rx="1" fill="white"/></svg>:<svg width="8" height="8"><path d="M1.5 1l5.5 3-5.5 3V1z" fill="white"/></svg>}</button><div className="vp-bars">{bars.map((h,i)=><div key={i} className="vp-bar" style={{height:p?`${h}px`:"3px"}}/>)}</div><span className="vp-dur">0:{String(Math.round(dur||0)).padStart(2,"0")}</span></div>;}
function daysUntil(ds){const now=new Date();now.setHours(0,0,0,0);const d=new Date(ds);const nx=new Date(now.getFullYear(),d.getMonth(),d.getDate());if(nx<now)nx.setFullYear(now.getFullYear()+1);return Math.round((nx-now)/86400000);}
function useSwipe(onLeft,onRight,threshold=72,el=null){
  const st=useRef(null);
  const handlers=useRef({onLeft,onRight});
  handlers.current={onLeft,onRight};

  useEffect(()=>{
    if(!el)return;

    const onStart=e=>{
      const t=e.touches[0];
      st.current={x:t.clientX,y:t.clientY,locked:null};
    };

    const onMove=e=>{
      if(!st.current)return;
      const dx=Math.abs(e.touches[0].clientX-st.current.x);
      const dy=Math.abs(e.touches[0].clientY-st.current.y);
      if(st.current.locked===null&&(dx>8||dy>8)){
        st.current.locked=dx>dy?"h":"v";
      }
      if(st.current.locked==="h"){
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onEnd=e=>{
      if(!st.current)return;
      const dx=e.changedTouches[0].clientX-st.current.x;
      const locked=st.current.locked;
      st.current=null;
      if(locked!=="h"||Math.abs(dx)<threshold)return;
      if(dx<0)handlers.current.onRight();
      else handlers.current.onLeft();
    };

    el.addEventListener("touchstart",onStart,{passive:true});
    el.addEventListener("touchmove",onMove,{passive:false});
    el.addEventListener("touchend",onEnd,{passive:true});

    return()=>{
      el.removeEventListener("touchstart",onStart);
      el.removeEventListener("touchmove",onMove);
      el.removeEventListener("touchend",onEnd);
    };
  },[el]);

  return {};
}

const QUOTES=[{text:"Любовь — это не то, что ты находишь. Это то, что находит тебя.",author:"Лоррейн Хэнсберри"},{text:"В твоих руках я нашёл дом, которого так долго искал.",author:""},{text:"Ты — лучшее, что случилось со мной.",author:""},{text:"Каждый день с тобой — это подарок.",author:""},{text:"Я выбираю тебя. И буду выбирать снова и снова.",author:""},{text:"Любовь измеряется не временем, а глубиной.",author:""},{text:"С тобой даже тишина звучит красиво.",author:""},{text:"Ты делаешь мой мир лучше просто своим существованием.",author:""},{text:"Наша история — моя любимая.",author:""},{text:"В мире миллиарды людей, и я рад(а), что встретил(а) именно тебя.",author:""},{text:"Любить — значит видеть человека таким, каким его задумал Бог.",author:"Достоевский"},{text:"Ты мой тихий рай.",author:""},{text:"Когда я с тобой, мне не нужно больше ничего.",author:""},{text:"Расстояние — это просто расстояние. Ты всегда со мной.",author:""},{text:"Я люблю тебя не только за то, кто ты есть, но и за то, кем я становлюсь рядом с тобой.",author:""},{text:"Настоящая любовь — это когда тебе хорошо молчать вместе.",author:""},{text:"Ты — мой любимый человек в любой версии жизни.",author:""},{text:"Мы начинались как мечта и стали реальностью.",author:""},{text:"Если бы пришлось прожить жизнь заново, я бы нашёл(ла) тебя раньше.",author:""},{text:"Любовь — это когда счастье другого важнее твоего собственного.",author:"Хаксли"},{text:"Ты — моё любимое «доброе утро» и самое грустное «спокойной ночи».",author:""},{text:"Вместе мы сильнее любой бури.",author:""},{text:"Твоя улыбка — лучшее, что я вижу каждый день.",author:""},{text:"Я не ищу идеального человека. Я нашёл(ла) тебя.",author:""},{text:"Любовь — это не глагол. Это существительное, которое ты.",author:""},{text:"С тобой даже обычный день становится особенным.",author:""},{text:"Ты — причина, по которой я верю в хорошее.",author:""},{text:"Наша любовь — не идеальная. Но она настоящая.",author:""},{text:"Я готов(а) идти рядом с тобой в любую сторону.",author:""},{text:"Любить тебя — это самое лёгкое и самое важное, что я делаю.",author:""},{text:"Дом — это не место. Это ты.",author:""},{text:"Ты меняешь мой мир одним своим присутствием.",author:""},{text:"Каждый момент с тобой — это то, о чём я буду вспоминать всю жизнь.",author:""},{text:"Нет ничего важнее того, что между нами.",author:""},{text:"Я выбрал(а) бы тебя снова в любой жизни.",author:""},{text:"С тобой я наконец понял(а), что значит быть дома.",author:""},{text:"Ты — моё самое красивое случайное стечение обстоятельств.",author:""},{text:"Любовь — это смотреть не друг на друга, а в одну сторону.",author:"Сент-Экзюпери"},{text:"Быть рядом с тобой — это уже счастье.",author:""},{text:"Ты — лучшая часть каждого моего дня.",author:""}];
const getTodayQuote=()=>QUOTES[Math.floor(Date.now()/86400000)%QUOTES.length];
function QuoteCard(){const q=getTodayQuote();return(<div className="quote-card"><div className="quote-mark">"</div><div className="quote-text">{q.text}</div>{q.author&&<div className="quote-author">— {q.author}</div>}</div>);}

function HeroSec({me,partner,connectedAt,pid,tgPhotoUrl}){
  const weekKey=()=>{const d=new Date();const dow=d.getDay();const mon=new Date(d);mon.setDate(d.getDate()-(dow===0?6:dow-1));return mon.toISOString().split('T')[0];};
  const[days,sDays]=useState(0);
  const[ptMood,sPtMood]=useState(null);
  const[nextEv,sNextEv]=useState(null);
  const[todayPlan,sTodayPlan]=useState([]);
  const[streak,setStreak]=useState(0);

  useEffect(()=>{
    if(!connectedAt)return;
    const update=()=>{const diff=Date.now()-connectedAt;sDays(Math.floor(diff/(1000*60*60*24)));};
    update();
    const iv=setInterval(update,60000);
    return()=>clearInterval(iv);
  },[connectedAt]);

  useEffect(()=>{
    if(!pid)return;
    const load=async()=>{
      const m=await db.get(`mood:${n(partner)}`);
      if(m)sPtMood(m);
      const evs=await db.get(`cal:${pid}`)||[];
      const today=new Date().toISOString().slice(0,10);
      const upcoming=evs.filter(e=>e.dt>=today).sort((a,b)=>a.dt.localeCompare(b.dt));
      if(upcoming[0])sNextEv(upcoming[0]);
      const dayId=["sun","mon","tue","wed","thu","fri","sat"][new Date().getDay()];
      const wk=weekKey();
      const plan=await db.get(`plan:${pid}:${wk}`)||{};
      sTodayPlan(plan[dayId]||[]);
      const hist=await db.get(`mood_history:${pid}`)||[];
      let s=0;
      const d=new Date();
      for(let i=0;i<30;i++){
        const date=new Date(d);date.setDate(d.getDate()-i);
        const key=date.toISOString().slice(0,10);
        const entry=hist.find(h=>h.date===key);
        if(entry&&(entry[`${n(me)}_emoji`]||entry[`${n(partner)}_emoji`]))s++;
        else if(i>0)break;
      }
      setStreak(s);
    };
    load();
    const iv=setInterval(load,30000);
    return()=>clearInterval(iv);
  },[pid,me,partner]);

  const weeks=Math.floor(days/7);
  const months=Math.floor(days/30);
  const timeStr=months>=3?`${months} мес.`:weeks>=2?`${weeks} нед.`:`${days} дн.`;

  return(
    <div className="sec" id="hero" style={{minHeight:"100svh",justifyContent:"center",display:"flex",flexDirection:"column"}}>
      <div className="sec-in" style={{paddingTop:40,paddingBottom:40}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:0,marginBottom:24,position:"relative"}}>
          <div style={{width:72,height:72,borderRadius:"50%",border:"3px solid var(--r)",overflow:"hidden",background:"var(--c2)",zIndex:2,boxShadow:"0 0 0 4px var(--c0)"}}>
            {tgPhotoUrl?<img src={tgPhotoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,fontFamily:"var(--d)"}}>{n(me)[0]?.toUpperCase()}</div>}
          </div>
          <div style={{width:40,height:40,borderRadius:"50%",background:"rgba(193,66,104,.15)",border:"1px solid rgba(193,66,104,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,zIndex:3,margin:"0 -8px",boxShadow:"0 0 0 3px var(--c0)"}}>💕</div>
          <div style={{width:72,height:72,borderRadius:"50%",border:"3px solid rgba(255,255,255,.15)",overflow:"hidden",background:"var(--c2)",zIndex:2,boxShadow:"0 0 0 4px var(--c0)"}}>
            <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,fontFamily:"var(--d)"}}>{n(partner)[0]?.toUpperCase()}</div>
          </div>
        </div>
        <div style={{textAlign:"center",marginBottom:8}}>
          <span style={{fontFamily:"var(--d)",fontSize:22,fontWeight:700,color:"var(--ink)"}}>@{n(me)}</span>
          <span style={{color:"var(--r)",margin:"0 8px",fontSize:16}}>✦</span>
          <span style={{fontFamily:"var(--d)",fontSize:22,fontWeight:700,color:"var(--ink)"}}>@{n(partner)}</span>
        </div>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(193,66,104,.1)",border:"1px solid rgba(193,66,104,.2)",borderRadius:999,padding:"6px 16px"}}>
            <span style={{fontSize:14}}>🌹</span>
            <span style={{fontFamily:"var(--d)",fontSize:15,fontWeight:600,color:"var(--r)"}}>Вместе {timeStr}</span>
            {streak>=3&&<span style={{fontSize:12,background:"rgba(255,140,0,.15)",color:"#ffa030",padding:"2px 7px",borderRadius:999}}>🔥 {streak}</span>}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>
          {ptMood&&ptMood.emoji&&(
            <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:16,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:28}}>{ptMood.emoji}</span>
              <div><div style={{fontSize:11,color:"var(--ink3)",marginBottom:2}}>@{n(partner)} сейчас</div><div style={{fontSize:14,color:"var(--ink2)",fontWeight:500}}>{ptMood.note||"Без заметки"}</div></div>
            </div>
          )}
          {nextEv&&(
            <div style={{background:"rgba(184,146,74,.06)",border:"1px solid rgba(184,146,74,.15)",borderRadius:16,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:24}}>{nextEv.em}</span>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,color:"var(--g)",marginBottom:2}}>Ближайшая дата</div><div style={{fontSize:14,color:"var(--ink2)",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{nextEv.t}</div></div>
              <div style={{fontSize:12,color:"var(--g)",flexShrink:0}}>{(()=>{const d=Math.round((new Date(nextEv.dt)-new Date(new Date().toDateString()))/(86400000));return d===0?"Сегодня":d===1?"Завтра":`${d} дн.`;})()}</div>
            </div>
          )}
          {todayPlan.length>0&&(
            <div style={{background:"rgba(74,184,193,.05)",border:"1px solid rgba(74,184,193,.12)",borderRadius:16,padding:"14px 16px"}}>
              <div style={{fontSize:11,color:"var(--teal)",marginBottom:8}}>📅 Планы на сегодня</div>
              {todayPlan.slice(0,3).map((p,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:i<todayPlan.length-1?6:0}}><span style={{width:5,height:5,borderRadius:"50%",background:p.by===me?"var(--r)":"var(--teal)",flexShrink:0}}/><span style={{fontSize:13,color:"var(--ink2)"}}>{p.time&&<span style={{color:"var(--g)",marginRight:4}}>{p.time}</span>}{p.text}</span></div>))}
            </div>
          )}
        </div>
        <QuoteCard/>
      </div>
    </div>
  );
}

function TodaySec({pid,me,partner}){
  const weekKey=()=>{const d=new Date();const dow=d.getDay();const mon=new Date(d);mon.setDate(d.getDate()-(dow===0?6:dow-1));return mon.toISOString().split('T')[0];};
  const[data,setData]=useState(null);
  const today=new Date();
  const dayName=["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"][today.getDay()];
  const dateStr=today.toLocaleDateString("ru-RU",{day:"numeric",month:"long"});

  useEffect(()=>{
    if(!pid)return;
    const load=async()=>{
      const dayId=["sun","mon","tue","wed","thu","fri","sat"][today.getDay()];
      const wk=weekKey();
      const[plan,mood,evs,ptMood]=await Promise.all([db.get(`plan:${pid}:${wk}`),db.get(`mood:${n(me)}`),db.get(`cal:${pid}`),db.get(`mood:${n(partner)}`)]);
      const todayItems=(plan||{})[dayId]||[];
      const todayDate=today.toISOString().slice(0,10);
      const todayEvs=(evs||[]).filter(e=>e.dt===todayDate);
      setData({plan:todayItems,mood,ptMood,events:todayEvs});
    };
    load();
    const iv=setInterval(load,30000);
    return()=>clearInterval(iv);
  },[pid,me,partner]);

  const myMoodToday=data?.mood?.date===new Date().toISOString().slice(0,10);

  return(
    <div className="sec" id="today">
      <div className="sec-in">
        <span className="brow">Сегодня</span>
        <h2 className="sh" style={{marginBottom:4}}>{dayName}, <em>{dateStr}</em></h2>
        {data?.events?.length>0&&(
          <div style={{background:"linear-gradient(135deg,rgba(184,146,74,.12),rgba(193,66,104,.06))",border:"1px solid rgba(184,146,74,.2)",borderRadius:16,padding:"14px 16px",marginBottom:10}}>
            {data.events.map(ev=>(<div key={ev.id} style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:24}}>{ev.em}</span><div><div style={{fontSize:14,fontWeight:600,color:"var(--g)"}}>{ev.t}</div>{ev.ds&&<div style={{fontSize:12,color:"var(--ink3)"}}>{ev.ds}</div>}</div></div>))}
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"12px",textAlign:"center"}}>
            <div style={{fontSize:10,color:"var(--ink3)",marginBottom:6}}>Моё настроение</div>
            <div style={{fontSize:28}}>{myMoodToday?data.mood.emoji:"❓"}</div>
            <div style={{fontSize:11,color:"var(--ink3)",marginTop:4}}>{myMoodToday?"Выбрано":"Не выбрано"}</div>
          </div>
          <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"12px",textAlign:"center"}}>
            <div style={{fontSize:10,color:"var(--ink3)",marginBottom:6}}>@{n(partner)}</div>
            <div style={{fontSize:28}}>{data?.ptMood?.emoji||"❓"}</div>
            <div style={{fontSize:11,color:"var(--ink3)",marginTop:4}}>{data?.ptMood?.emoji?"Выбрано":"Не выбрано"}</div>
          </div>
        </div>
        {data?.plan?.length>0&&(
          <div style={{background:"rgba(74,184,193,.04)",border:"1px solid rgba(74,184,193,.1)",borderRadius:14,padding:"14px 16px"}}>
            <div style={{fontSize:10,color:"var(--teal)",fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",marginBottom:10}}>Планы на сегодня</div>
            {data.plan.map((p,i)=>(<div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:i<data.plan.length-1?8:0}}><span style={{width:6,height:6,borderRadius:"50%",background:p.by===me?"var(--r)":"var(--teal)",flexShrink:0,marginTop:5}}/><div>{p.time&&<div style={{fontSize:10,color:"var(--g)",marginBottom:1}}>🕐 {p.time}</div>}<div style={{fontSize:13,color:"var(--ink2)"}}>{p.text}</div><div style={{fontSize:10,color:"var(--ink3)"}}>@{n(p.by)}</div></div></div>))}
          </div>
        )}
        {(!data?.plan?.length&&!data?.events?.length)&&<div style={{textAlign:"center",padding:"20px 0",color:"var(--ink3)",fontSize:13}}>Добавьте планы в планировщик 💕</div>}
      </div>
    </div>
  );
}

/* ─── SECTIONS ─── */
function SkeletonCards({count=3,height=80}){
  return <>{Array.from({length:count},(_,i)=>(<div key={i} className="skel" style={{height,borderRadius:16,marginBottom:10,opacity:1-i*0.2}}/>))}</>;
}
const CAL_EM=["💍","🎂","✈️","🎉","💕","🌹","🏖️","🎓","🏡","💼","🎭","🎪"];

function CalSec({pid,me}){
  const today=new Date();
  const[viewDate,sVD]=useState(new Date(today.getFullYear(),today.getMonth(),1));
  const{data:evs,loading,refresh}=useSync(`cal:${pid}`,[],7000);
  const[t,sT]=useState("");const[dt,sDt]=useState("");const[ds,sDs]=useState("");const[em,sEm]=useState("💍");
  const[showForm,sShowForm]=useState(false);

  const daysInMonth=new Date(viewDate.getFullYear(),viewDate.getMonth()+1,0).getDate();
  const firstDay=(new Date(viewDate.getFullYear(),viewDate.getMonth(),1).getDay()+6)%7;
  const monthName=viewDate.toLocaleDateString("ru-RU",{month:"long",year:"numeric"});

  const evsByDay={};
  (evs||[]).forEach(ev=>{
    const d=new Date(ev.dt);
    if(d.getFullYear()===viewDate.getFullYear()&&d.getMonth()===viewDate.getMonth()){
      const day=d.getDate();
      if(!evsByDay[day])evsByDay[day]=[];
      evsByDay[day].push(ev);
    }
  });

  const prevMonth=()=>sVD(new Date(viewDate.getFullYear(),viewDate.getMonth()-1,1));
  const nextMonth=()=>sVD(new Date(viewDate.getFullYear(),viewDate.getMonth()+1,1));

  const add=async()=>{
    if(!t.trim()||!dt)return;
    const ev={id:Date.now(),t:t.trim(),dt,ds:ds.trim(),em,by:me};
    const u=[...(evs||[]),ev].sort((a,b)=>new Date(a.dt)-new Date(b.dt));
    await refresh(u);
    sT("");sDt("");sDs("");sShowForm(false);
  };

  const del=async(id)=>{
    await refresh((evs||[]).filter(e=>e.id!==id));
  };

  const addToGoogle=(ev)=>{
    const start=ev.dt.replace(/-/g,"");
    const end=ev.dt.replace(/-/g,"");
    const url=`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.t)}&dates=${start}/${end}&details=${encodeURIComponent(ev.ds||"")}`;
    window.open(url,"_blank");
  };

  const exportICS=()=>{
    if(!evs||evs.length===0)return;
    const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//DuoViewer//RU"];
    evs.forEach(ev=>{
      const dt=ev.dt.replace(/-/g,"");
      lines.push("BEGIN:VEVENT");
      lines.push(`DTSTART;VALUE=DATE:${dt}`);
      lines.push(`DTEND;VALUE=DATE:${dt}`);
      lines.push(`SUMMARY:${ev.em} ${ev.t}`);
      if(ev.ds)lines.push(`DESCRIPTION:${ev.ds}`);
      lines.push(`UID:duoviewer-${ev.id}`);
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    const blob=new Blob([lines.join("\r\n")],{type:"text/calendar"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="duo-calendar.ics";a.click();
    URL.revokeObjectURL(url);
  };

  const isToday=(day)=>day===today.getDate()&&viewDate.getMonth()===today.getMonth()&&viewDate.getFullYear()===today.getFullYear();

  const upcomingAll=(evs||[])
    .filter(e=>new Date(e.dt)>=new Date(today.toDateString()))
    .sort((a,b)=>new Date(a.dt)-new Date(b.dt))
    .slice(0,5);

  if(loading)return(
    <div className="sec" id="calendar"><div className="sec-in">
      <span className="brow">Важные даты</span>
      <h2 className="sh">Наш <em>календарь</em></h2>
      <SkeletonCards count={4} height={60}/>
    </div></div>
  );

  return(
    <div className="sec" id="calendar">
      <div className="sec-in">
        <span className="brow">Важные даты</span>
        <h2 className="sh">Наш <em>календарь</em></h2>
        <p className="sp">Годовщины, путешествия, особые события.</p>

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <button onClick={prevMonth} style={{background:"none",border:"none",color:"var(--ink2)",fontSize:20,cursor:"pointer",padding:"4px 10px"}}>‹</button>
          <span style={{fontFamily:"var(--d)",fontSize:16,fontWeight:600,textTransform:"capitalize"}}>{monthName}</span>
          <button onClick={nextMonth} style={{background:"none",border:"none",color:"var(--ink2)",fontSize:20,cursor:"pointer",padding:"4px 10px"}}>›</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
          {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d=>(
            <div key={d} style={{textAlign:"center",fontSize:10,color:"var(--ink3)",fontWeight:600,padding:"4px 0"}}>{d}</div>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:20}}>
          {Array.from({length:firstDay},(_,i)=><div key={`e${i}`}/>)}
          {Array.from({length:daysInMonth},(_,i)=>{
            const day=i+1;
            const hasEv=!!evsByDay[day];
            const todayDay=isToday(day);
            return(
              <div key={day} style={{
                aspectRatio:"1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                borderRadius:10,
                background:todayDay?"rgba(193,66,104,.2)":hasEv?"rgba(193,66,104,.07)":"rgba(255,255,255,.025)",
                border:todayDay?"1px solid rgba(193,66,104,.5)":"1px solid transparent",
                cursor:hasEv?"pointer":"default",
                position:"relative",
              }}>
                <span style={{fontSize:12,fontWeight:todayDay?700:400,color:todayDay?"var(--r)":"var(--ink2)"}}>{day}</span>
                {hasEv&&<span style={{fontSize:8,marginTop:1}}>{evsByDay[day][0].em}</span>}
              </div>
            );
          })}
        </div>

        {upcomingAll.length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{fontSize:10,fontWeight:600,letterSpacing:".1em",color:"rgba(193,66,104,.6)",textTransform:"uppercase",marginBottom:10}}>Ближайшие</div>
            {upcomingAll.map(ev=>{
              const dLeft=Math.round((new Date(ev.dt)-new Date(today.toDateString()))/(1000*60*60*24));
              return(
                <div key={ev.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"rgba(255,255,255,.03)",borderRadius:12,marginBottom:6,border:"1px solid rgba(255,255,255,.05)"}}>
                  <span style={{fontSize:20}}>{ev.em}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.t}</div>
                    <div style={{fontSize:11,color:"var(--ink3)",marginTop:2}}>{new Date(ev.dt).toLocaleDateString("ru-RU",{day:"numeric",month:"long"})}</div>
                  </div>
                  <span style={{fontSize:11,color:dLeft===0?"var(--r)":dLeft<=7?"var(--g)":"var(--ink3)",fontWeight:600,flexShrink:0}}>
                    {dLeft===0?"Сегодня":dLeft===1?"Завтра":`${dLeft} дн.`}
                  </span>
                  <span onClick={()=>addToGoogle(ev)} style={{color:"#4285f4",cursor:"pointer",fontSize:14,padding:"0 4px"}} title="Добавить в Google Calendar">📅</span>
                  <span onClick={()=>del(ev.id)} style={{color:"var(--ink3)",cursor:"pointer",fontSize:14,padding:"0 4px"}}>✕</span>
                </div>
              );
            })}
          </div>
        )}

        {evs&&evs.length>0&&(
          <button onClick={exportICS} style={{
            width:"100%",marginBottom:12,padding:"10px",
            background:"rgba(66,133,244,.1)",border:"1px solid rgba(66,133,244,.25)",
            borderRadius:10,color:"#4285f4",fontSize:13,fontWeight:500,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8
          }}>
            <span>📅</span> Экспорт в Google Calendar (.ics)
          </button>
        )}

        {!showForm?(
          <button className="fa" style={{width:"100%",padding:"12px"}} onClick={()=>sShowForm(true)}>+ Добавить событие</button>
        ):(
          <div style={{background:"rgba(255,255,255,.03)",borderRadius:16,padding:"16px",border:"1px solid rgba(193,66,104,.15)"}}>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
              {CAL_EM.map(e=><span key={e} onClick={()=>sEm(e)} style={{fontSize:20,cursor:"pointer",padding:"4px",borderRadius:8,background:em===e?"rgba(193,66,104,.2)":"transparent"}}>{e}</span>)}
            </div>
            <input className="fi" placeholder="Название" value={t} onChange={e=>sT(e.target.value)} style={{marginBottom:8,width:"100%"}}/>
            <input className="fi fi-date" type="date" value={dt} onChange={e=>sDt(e.target.value)} style={{marginBottom:8,width:"100%"}}/>
            <input className="fi" placeholder="Описание (необязательно)" value={ds} onChange={e=>sDs(e.target.value)} style={{marginBottom:12,width:"100%"}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>sShowForm(false)} style={{flex:1,padding:"10px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,color:"var(--ink3)",cursor:"pointer"}}>Отмена</button>
              <button className="fa" disabled={!t.trim()||!dt} onClick={add} style={{flex:2}}>Сохранить</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const MOM_EM=["🌹","💕","✨","😍","🥰","💋","🫶","🌙","☕","🎵","🌊","🏔️","💌","🎉","🌸","🤍"];
const TAGS=[{id:"happy",l:"Счастье"},{id:"tender",l:"Нежность"},{id:"funny",l:"Смешно"},{id:"important",l:"Важно"}];
function MemoryOverlay({item,onClose,onAnother}){if(!item)return null;const tagLbl=TAGS.find(t=>t.id===item.tag)?.l||"Важно";return(<div className="mem-overlay" onClick={onClose}><div className="mem-card" onClick={e=>e.stopPropagation()}><div className="mem-em">{item.em}</div><div className="mem-tag-chip">{tagLbl}</div><div className="mem-text">{item.txt}</div>{item.by&&<div className="mem-by">@{n(item.by)}</div>}{item.ts&&<div className="mem-date">{new Date(item.ts).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"})}</div>}<button className="mem-close" onClick={onClose}>✕</button><button className="mem-another" onClick={onAnother}>Ещё одно 💫</button></div></div>);}
function MomSec({pid,me,partner}){const{data:items,setData:sI,loading,refresh}=useSync(`mom:${pid}`,[],5000);const[surprise,sSurprise]=useState(null);const[txt,sT]=useState("");const[em,sE]=useState("🌹");const[tag,sTag]=useState("happy");const add=async()=>{if(!txt.trim())return;const m={id:Date.now(),txt:txt.trim(),em,tag,by:me,ts:Date.now()};await refresh([m,...items]);notifyPartner(partner,`@${n(me)} добавил(а) воспоминание: «${txt.slice(0,40)}»`,"🌹");sT("");};const fmt=ts=>new Date(ts).toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"});const showAnother=()=>{if(items.length<2)return;let idx;do{idx=Math.floor(Math.random()*items.length);}while(items[idx].id===surprise?.id);sSurprise(items[idx]);};if(loading)return(<div className="sec" id="moments" style={{background:"rgba(255,255,255,.01)"}}><div className="sec-in"><span className="brow">Воспоминания</span><h2 className="sh">Моменты, <em>которые остаются</em></h2><p className="sp">Ваш личный архив — первое свидание, смешные случаи, нежные слова.</p><div style={{marginTop:24}}><SkeletonCards count={3}/></div></div></div>);return(<div className="sec" id="moments" style={{background:"rgba(255,255,255,.01)"}}><div className="sec-in"><span className="brow">Воспоминания</span><h2 className="sh">Моменты, <em>которые остаются</em></h2><p className="sp">Ваш личный архив — первое свидание, смешные случаи, нежные слова.</p>{items.length>0&&<div style={{textAlign:"center",marginBottom:20}}><button className="surprise-btn" onClick={()=>sSurprise(items[Math.floor(Math.random()*items.length)])}>💫 Удиви меня</button></div>}<div className="form"><div className="ep">{MOM_EM.map(e=><span key={e} className={`eo ${em===e?"s":""}`} onClick={()=>sE(e)}>{e}</span>)}</div><div className="cp">{TAGS.map(t=><div key={t.id} className={`copt chip-${t.id} ${tag===t.id?"s":""}`} onClick={()=>sTag(t.id)}>{t.l}</div>)}</div><textarea className="ta2" placeholder="Запиши момент…" value={txt} onChange={e=>sT(e.target.value)}/><div className="row" style={{justifyContent:"flex-end"}}><button className="fa" disabled={!txt.trim()} onClick={add}>Сохранить</button></div></div><div className="grid">{items.length===0&&<div className="empty">Сохраните первый момент 🌹</div>}{items.map(m=><div key={m.id} className="card"><div style={{fontSize:17,marginBottom:6}}>{m.em}</div><div className="card-top"><span className="card-meta" style={{color:"rgba(193,66,104,.6)"}}>{n(m.by)}</span><span style={{fontSize:9,color:"var(--ink3)"}}>{fmt(m.ts)}</span></div><div className="card-t" style={{fontWeight:400,fontSize:13}}>{m.txt}</div>{m.tag&&<span className={`card-chip chip-${m.tag}`}>{TAGS.find(t=>t.id===m.tag)?.l}</span>}</div>)}</div>{surprise&&<MemoryOverlay item={surprise} onClose={()=>sSurprise(null)} onAnother={showAnother}/>}</div></div>);}

function DreamsSec({me,partner}){const{data:my,setData:sMy,loading:loadMy,refresh:refreshMy}=useSync(`drm:${n(me)}`,[],7000);const{data:pt,setData:sPt,loading:loadPt}=useSync(`drm:${n(partner)}`,[],7000);const[inp,sI]=useState("");const add=async()=>{if(!inp.trim())return;await refreshMy([...my,{id:Date.now(),t:inp.trim(),done:false}]);sI("");};const toggle=async id=>{await refreshMy(my.map(d=>d.id===id?{...d,done:!d.done}:d));};const Col=({title,em,items,isMe})=><div className="dcol"><div className="dcol-h"><span>{em}</span>{title}</div>{items.length===0&&<p className="empty" style={{padding:"8px 0",gridColumn:"auto"}}>{isMe?"Добавь свою первую мечту…":"Мечты пока не добавлены…"}</p>}{items.map(d=><div key={d.id} className="di">{isMe?<div className={`dchk ${d.done?"ok":""}`} onClick={()=>toggle(d.id)}>{d.done&&<svg width="8" height="6"><path d="M1 3L3 5 7 1" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round"/>  </svg>}</div>:<span style={{fontSize:12,flexShrink:0,marginTop:1}}>{d.done?"✅":"✨"}</span>}<span className={`di-txt ${d.done?"di-done":""}`}>{d.t}</span></div>)}{isMe&&<div className="dadd"><input className="fi" placeholder="Добавить мечту…" value={inp} onChange={e=>sI(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/><button className="fa" disabled={!inp.trim()} onClick={add} style={{padding:"9px 13px"}}>+</button></div>}</div>;const loading=loadMy||loadPt;if(loading)return(<div className="sec" id="dreams"><div className="sec-in"><span className="brow">Мечты</span><h2 className="sh">То, о чём <em>мы мечтаем</em></h2><p className="sp">Каждый пишет своё — и оба видят мечты друг друга. Отмечай выполненные.</p><div style={{marginTop:24}}><SkeletonCards count={3}/></div></div></div>);return(<div className="sec" id="dreams"><div className="sec-in"><span className="brow">Мечты</span><h2 className="sh">То, о чём <em>мы мечтаем</em></h2><p className="sp">Каждый пишет своё — и оба видят мечты друг друга. Отмечай выполненные.</p><div className="dcols"><Col title={`@${n(me)}`} em="🌟" items={my} isMe={true}/><Col title={`@${n(partner)}`} em="💫" items={pt} isMe={false}/></div></div></div>);}

const WISH_EM=["🎁","💍","👗","📚","🎵","🍕","💄","📷","🎮","🌸","💅","🎭","🍷","✈️","🛍️","🎀"];
function WishesSec({pid,me,partner}){
  const{data:items,setData:sI,loading,refresh}=useSync(`wish:${pid}`,[],7000);
  const sortedWishes=(items||[]).slice().sort((a,b)=>{const p={high:0,med:1,low:2};return (p[a.pr]??1)-(p[b.pr]??1);});
  const[filter,sFilter]=useState("all");
  const[t,sTi]=useState("");const[d,sD]=useState("");const[em,sE]=useState("🎁");const[pr,sPr]=useState("med");
  const add=async()=>{if(!t.trim())return;const w={id:Date.now(),t:t.trim(),d:d.trim(),em,pr,by:me,done:false,doneBy:null};await refresh([w,...(items||[])]);notifyPartner(partner,`@${n(me)} добавил(а) желание: «${t.slice(0,40)}»`,"🎁");sTi("");sD("");};
  const fulfill=async id=>{await refresh((items||[]).map(w=>w.id===id?{...w,done:true,doneBy:me}:w));};
  const filtered=sortedWishes.filter(w=>{if(filter==="mine")return n(w.by)===n(me);if(filter==="partner")return n(w.by)!==n(me);if(filter==="done")return w.done;return true;});
  const prl={high:"🔥 Топ-желание",med:"💫 Хочу",low:"🌿 Когда-нибудь"};
  if(loading)return(<div className="sec" id="wishes" style={{background:"rgba(255,255,255,.01)"}}><div className="sec-in"><span className="brow">Список желаний</span><h2 className="sh">Что мы <em>хотим</em></h2><p className="sp">Желания каждого. Исполни желание любимого — нажми кнопку.</p><div style={{marginTop:24}}><SkeletonCards count={3}/></div></div></div>);
  return(<div className="sec" id="wishes" style={{background:"rgba(255,255,255,.01)"}}><div className="sec-in"><span className="brow">Список желаний</span><h2 className="sh">Что мы <em>хотим</em></h2><p className="sp">Желания каждого. Исполни желание любимого — нажми кнопку.</p><div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>{[["all","Все"],["mine","Мои"],["partner","Партнёра"],["done","Исполненные"]].map(([k,l])=>(<button key={k} onClick={()=>sFilter(k)} style={{padding:"5px 12px",borderRadius:999,fontSize:12,cursor:"pointer",background:filter===k?"var(--r)":"rgba(255,255,255,.05)",border:filter===k?"none":"1px solid rgba(255,255,255,.08)",color:filter===k?"#fff":"var(--ink3)",fontFamily:"var(--b)"}}>{l}</button>))}</div><div className="grid">{filtered.length===0&&<div className="empty">Добавь первое желание 🎁</div>}{filtered.map(w=><div key={w.id} className={`card ${w.done?"":""}`} style={w.done?{opacity:.45,filter:"grayscale(.5)"}:{}}><div className="card-top"><span style={{fontSize:18}}>{w.em}</span><span className="card-meta" style={{color:"rgba(193,66,104,.55)"}}>{n(w.by)}</span></div><div className="card-t">{w.t}</div>{w.d&&<div className="card-d">{w.d}</div>}<span className={`card-chip chip-${w.pr}`}>{prl[w.pr]}</span>{!w.done&&n(w.by)!==n(me)&&<button className="wcard-fulfill" onClick={()=>fulfill(w.id)}>✨ Исполнить</button>}{w.done&&<div className="wcard-done">✅ @{n(w.doneBy)} исполнил</div>}</div>)}</div><div className="form"><div className="ep">{WISH_EM.map(e=><span key={e} className={`eo ${em===e?"s":""}`} onClick={()=>sE(e)}>{e}</span>)}</div><div className="cp">{[["high","🔥 Очень хочу"],["med","💫 Хочу"],["low","🌿 Когда-нибудь"]].map(([v,l])=><div key={v} className={`copt chip-${v} ${pr===v?"s":""}`} onClick={()=>sPr(v)}>{l}</div>)}</div><div className="row"><input className="fi" placeholder="Моё желание…" value={t} onChange={e=>sTi(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/><button className="fa" disabled={!t.trim()} onClick={add}>Добавить</button></div><input className="fi" placeholder="Описание (необязательно)" value={d} onChange={e=>sD(e.target.value)}/></div></div></div>);
}

const FLAGS=["🇯🇵","🇮🇹","🇫🇷","🇪🇸","🇬🇷","🇹🇭","🇵🇹","🇲🇽","🇮🇸","🇳🇴","🇨🇭","🇦🇹","🇨🇿","🇹🇷","🇧🇦","🌍"];
const SLBL={dream:"Мечта",planning:"Планируем",been:"Были ✓"};
function TravelSec({pid,me}){const{data:items,setData:sI,loading,refresh}=useSync(`trv:${pid}`,[],7000);const[pl,sP]=useState("");const[nt,sN]=useState("");const[fl,sF]=useState("🇯🇵");const[st,sSt]=useState("dream");const add=async()=>{if(!pl.trim())return;const p={id:Date.now(),pl:pl.trim(),nt:nt.trim(),fl,st,by:me};await refresh([...items,p]);sP("");sN("");};const cycle=async id=>{const order=["dream","planning","been"];await refresh(items.map(p=>p.id!==id?p:{...p,st:order[(order.indexOf(p.st)+1)%order.length]}));};const counts={dream:items.filter(x=>x.st==="dream").length,planning:items.filter(x=>x.st==="planning").length,been:items.filter(x=>x.st==="been").length};if(loading)return(<div className="sec" id="travel"><div className="sec-in"><span className="brow">Путешествия</span><h2 className="sh">Куда мы <em>хотим поехать</em></h2><p className="sp">Нажми на карточку — изменить статус. Мечта → Планируем → Были ✓</p><div style={{marginTop:24}}><SkeletonCards count={3}/></div></div></div>);return(<div className="sec" id="travel"><div className="sec-in"><span className="brow">Путешествия</span><h2 className="sh">Куда мы <em>хотим поехать</em></h2><p className="sp">Нажми на карточку — изменить статус. Мечта → Планируем → Были ✓</p>{items.length>0&&<div className="tcounts">{[["dream","Мечты"],["planning","Планируем"],["been","Были"]].map(([k,l])=><div key={k} className="tcount"><div className={`tc-n ${k}`}>{counts[k]}</div><div className="tc-l">{l}</div></div>)}</div>}<div className="grid">{items.length===0&&<div className="empty">Добавьте первое место мечты ✈️</div>}{items.map(p=><div key={p.id} className="card" style={{cursor:"pointer"}} onClick={()=>cycle(p.id)}><span className={`card-chip chip-${p.st}`} style={{display:"inline-block",marginBottom:8}}>{SLBL[p.st]}</span><div style={{fontSize:24,display:"block",marginBottom:5}}>{p.fl}</div><div className="card-t">{p.pl}</div>{p.nt&&<div className="card-d">{p.nt}</div>}<div style={{fontSize:9,color:"rgba(193,66,104,.4)",marginTop:7,fontWeight:600,textTransform:"uppercase",letterSpacing:".05em"}}>{n(p.by)}</div><div className="travel-hint">Нажми — сменить статус</div></div>)}</div><div className="form"><div className="ep">{FLAGS.map(f=><span key={f} className={`eo ${fl===f?"s":""}`} onClick={()=>sF(f)}>{f}</span>)}</div><div className="cp">{Object.entries(SLBL).map(([v,l])=><div key={v} className={`copt chip-${v} ${st===v?"s":""}`} onClick={()=>sSt(v)}>{l}</div>)}</div><div className="row"><input className="fi" placeholder="Название места" value={pl} onChange={e=>sP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/><button className="fa" disabled={!pl.trim()} onClick={add}>Добавить</button></div><input className="fi" placeholder="Заметка" value={nt} onChange={e=>sN(e.target.value)}/></div></div></div>);}

const DEF_P=[{id:1,em:"🌅",t:"Встречать каждый день вместе, даже на расстоянии",done:false,by:null},{id:2,em:"💬",t:"Говорить честно, даже когда это трудно",done:false,by:null},{id:3,em:"🌱",t:"Расти вместе и поддерживать мечты друг друга",done:false,by:null},{id:4,em:"💋",t:"Никогда не забывать, почему мы начали",done:false,by:null},{id:5,em:"🤝",t:"Быть командой — всегда",done:false,by:null}];
const PROM_EM=["💌","🌹","⭐","🕊️","🌙","💫","🔥","🤍","🌸","✨"];
function PromisesSec({pid,me,partner}){
  const{data:items,setData:sI,loading,refresh}=useSync(`prom:${pid}`,DEF_P,5000);
  const displayItems=items&&items.length>0?items:DEF_P;
  const[inp,sIn]=useState("");
  const[selEm,sSelEm]=useState("💌");

  const save=async(updated)=>{await refresh(updated);};

  const toggle=async(id)=>{
    const updated=displayItems.map(x=>x.id===id?{...x,done:!x.done,doneBy:!x.done?me:null}:x);
    await save(updated);
  };

  const add=async()=>{
    if(!inp.trim())return;
    const updated=[...displayItems,{id:Date.now(),em:selEm,t:inp.trim(),by:me,done:false,doneBy:null}];
    await save(updated);
    if(partner)notifyPartner(partner,`@${n(me)} добавил(а) обещание`,"💌");
    sIn("");
  };

  const remove=async(id)=>{
    const updated=displayItems.filter(x=>x.id!==id);
    await save(updated);
  };

  if(loading)return(<div className="sec" id="promises"><div className="sec-in"><span className="brow">Обещания</span><h2 className="sh">Слова, <em>которые важны</em></h2><p className="sp">То, что вы обещаете друг другу.</p><div style={{marginTop:24}}><SkeletonCards count={3}/></div></div></div>);

  const done=displayItems.filter(x=>x.done).length;

  return(
    <div className="sec" id="promises" style={{background:"rgba(255,255,255,.01)"}}>
      <div className="sec-in">
        <span className="brow">Обещания</span>
        <h2 className="sh">Слова, <em>которые важны</em></h2>
        <p className="sp">То, что вы обещаете друг другу. Синхронизировано для вас обоих.</p>
        {displayItems.length>0&&<div style={{display:"flex",gap:18,justifyContent:"center",marginBottom:24,flexWrap:"wrap"}}>
          <div style={{textAlign:"center"}}><div style={{fontFamily:"var(--d)",fontSize:32,fontWeight:700,color:"rgba(193,66,104,.85)"}}>{displayItems.length}</div><div style={{fontSize:9,textTransform:"uppercase",letterSpacing:".08em",color:"var(--ink3)",marginTop:2}}>обещаний</div></div>
          <div style={{textAlign:"center"}}><div style={{fontFamily:"var(--d)",fontSize:32,fontWeight:700,color:"var(--mint)"}}>{done}</div><div style={{fontSize:9,textTransform:"uppercase",letterSpacing:".08em",color:"var(--ink3)",marginTop:2}}>выполнено</div></div>
          <div style={{textAlign:"center"}}><div style={{fontFamily:"var(--d)",fontSize:32,fontWeight:700,color:"rgba(184,146,74,.8)"}}>{displayItems.length-done}</div><div style={{fontSize:9,textTransform:"uppercase",letterSpacing:".08em",color:"var(--ink3)",marginTop:2}}>впереди</div></div>
        </div>}
        <div className="plist">
          {displayItems.map(p=>(
            <div key={p.id} className="pi" style={p.done?{opacity:.55}:{}}>
              <span className="pi-em">{p.em}</span>
              <div className="pi-body">
                <div className={`pi-t ${p.done?"done":""}`}>{p.t}</div>
                <div style={{display:"flex",gap:10,marginTop:3,alignItems:"center"}}>
                  {p.by&&<div className="pi-who">@{n(p.by)}</div>}
                  {p.done&&p.doneBy&&<div style={{fontSize:9,color:"var(--mint)",fontWeight:600}}>✓ @{n(p.doneBy)}</div>}
                </div>
              </div>
              <div style={{display:"flex",gap:5,alignItems:"center"}}>
                <div className={`pi-chk ${p.done?"ok":""}`} onClick={()=>toggle(p.id)}>
                  {p.done&&<svg width="8" height="6"><path d="M1 3L3 5 7 1" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round"/></svg>}
                </div>
                {p.by&&n(p.by)===n(me)&&<div onClick={()=>remove(p.id)} style={{fontSize:10,color:"var(--ink3)",cursor:"pointer",padding:"2px 4px",borderRadius:4,transition:"color .18s"}}
                  onMouseEnter={e=>e.target.style.color="rgba(240,100,100,.7)"}
                  onMouseLeave={e=>e.target.style.color="var(--ink3)"}>✕</div>}
              </div>
            </div>
          ))}
        </div>
        <div className="form" style={{marginTop:12}}>
          <div className="ep">{PROM_EM.map(e=><span key={e} className={`eo ${selEm===e?"s":""}`} onClick={()=>sSelEm(e)}>{e}</span>)}</div>
          <div className="row">
            <input className="fi" placeholder="Добавить обещание…" value={inp} onChange={e=>sIn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/>
            <button className="fa" disabled={!inp.trim()} onClick={add}>Добавить</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ACHIEVEMENTS=[{id:"first_mood",icon:"😊",title:"Первое настроение",desc:"Поделились настроением впервые",check:(data)=>data.moodDays>=1},{id:"week_streak",icon:"🔥",title:"Неделя вместе",desc:"7 дней подряд в приложении",check:(data)=>data.streak>=7},{id:"month",icon:"🌙",title:"Месяц",desc:"30 дней вместе",check:(data)=>data.days>=30},{id:"first_memory",icon:"🌹",title:"Первое воспоминание",desc:"Сохранили первый момент",check:(data)=>data.moments>=1},{id:"wishful",icon:"🎁",title:"Мечтатели",desc:"5 желаний в списке",check:(data)=>data.wishes>=5},{id:"questions",icon:"❓",title:"Узнаём друг друга",desc:"Ответили на 10 вопросов",check:(data)=>data.qaCount>=10},{id:"travelers",icon:"✈️",title:"Путешественники",desc:"3 места на карте",check:(data)=>data.places>=3},{id:"promises",icon:"💌",title:"Слово за слово",desc:"5 обещаний",check:(data)=>data.promises>=5},{id:"hundred",icon:"💯",title:"100 дней",desc:"100 дней вместе",check:(data)=>data.days>=100},{id:"year",icon:"👑",title:"Год любви",desc:"365 дней вместе",check:(data)=>data.days>=365}];

function AchievementsSec({pid,me,partner,connectedAt}){
  const[ach,setAch]=useState({});
  const days=connectedAt?Math.floor((Date.now()-connectedAt)/(86400000)):0;

  useEffect(()=>{
    if(!pid)return;
    const load=async()=>{
      const[hist,moms,wishes,places,prom,qa]=await Promise.all([db.get(`mood_history:${pid}`)||[],db.get(`mom:${pid}`)||[],db.get(`wish:${pid}`)||[],db.get(`places:${pid}`)||[],db.get(`prom:${pid}`)||[],db.get(`qa:${pid}`)||[]]);
      const moodDays=(hist||[]).length;
      let streak=0;const d=new Date();
      for(let i=0;i<30;i++){const date=new Date(d);date.setDate(d.getDate()-i);const key=date.toISOString().slice(0,10);const entry=(hist||[]).find(h=>h.date===key);if(entry&&(entry[`${n(me)}_emoji`]||entry[`${n(partner)}_emoji`]))streak++;else if(i>0)break;}
      const data={days,streak,moodDays,moments:(moms||[]).length,wishes:(wishes||[]).length,places:(places||[]).length,promises:(prom||[]).filter(p=>p&&(p.text||p.t)).length,qaCount:(qa||[]).length};
      const result={};ACHIEVEMENTS.forEach(a=>{result[a.id]=a.check(data);});setAch(result);
    };
    load();
  },[pid,connectedAt,me,partner]);

  const unlocked=ACHIEVEMENTS.filter(a=>ach[a.id]);
  const locked=ACHIEVEMENTS.filter(a=>!ach[a.id]);

  return(
    <div className="sec" id="achievements">
      <div className="sec-in">
        <span className="brow">Достижения</span>
        <h2 className="sh">Ваши <em>награды</em></h2>
        <p className="sp">Открываются по мере того как вы узнаёте друг друга.</p>
        {unlocked.length>0&&(<div style={{marginBottom:20}}><div style={{fontSize:10,fontWeight:600,letterSpacing:".1em",color:"rgba(184,146,74,.7)",textTransform:"uppercase",marginBottom:10}}>Открыто {unlocked.length}/{ACHIEVEMENTS.length}</div><div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>{unlocked.map(a=>(<div key={a.id} style={{background:"linear-gradient(135deg,rgba(184,146,74,.12),rgba(193,66,104,.08))",border:"1px solid rgba(184,146,74,.25)",borderRadius:16,padding:"14px 12px",display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:28,filter:"drop-shadow(0 0 8px rgba(184,146,74,.5))"}}>{a.icon}</span><div><div style={{fontSize:12,fontWeight:600,color:"var(--g)"}}>{a.title}</div><div style={{fontSize:10,color:"var(--ink3)",marginTop:2,lineHeight:1.4}}>{a.desc}</div></div></div>))}</div></div>)}
        {locked.length>0&&(<div><div style={{fontSize:10,fontWeight:600,letterSpacing:".1em",color:"var(--ink3)",textTransform:"uppercase",marginBottom:10}}>Ещё не открыто</div><div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>{locked.map(a=>(<div key={a.id} style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:16,padding:"14px 12px",display:"flex",alignItems:"center",gap:10,opacity:.5}}><span style={{fontSize:28,filter:"grayscale(1)"}}>{a.icon}</span><div><div style={{fontSize:12,fontWeight:600,color:"var(--ink3)"}}>{a.title}</div><div style={{fontSize:10,color:"var(--ink3)",marginTop:2,lineHeight:1.4}}>{a.desc}</div></div></div>))}</div></div>)}
      </div>
    </div>
  );
}

function CapsuleSec({pid,me}){
  const[capsules,sCapsules]=useState([]);
  const[text,sText]=useState("");
  const[openDate,sOpenDate]=useState("");
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    db.get(`capsule:${pid}`).then(d=>{sCapsules(d||[]);setLoading(false);});
    const iv=setInterval(()=>db.get(`capsule:${pid}`).then(d=>sCapsules(d||[])),30000);
    return()=>clearInterval(iv);
  },[pid]);

  const add=async()=>{
    if(!text.trim()||!openDate)return;
    const c={id:Date.now(),text:text.trim(),by:me,openDate,createdAt:Date.now(),opened:false};
    const u=[...capsules,c];
    sCapsules(u);
    await db.set(`capsule:${pid}`,u);
    sText("");sOpenDate("");
  };

  const tryOpen=async(cap)=>{
    if(new Date(cap.openDate)>new Date())return;
    const u=capsules.map(c=>c.id===cap.id?{...c,opened:true}:c);
    sCapsules(u);
    await db.set(`capsule:${pid}`,u);
  };

  const today=new Date().toISOString().slice(0,10);
  const canOpen=(cap)=>!cap.opened&&cap.openDate<=today;
  const daysLeft=(cap)=>Math.ceil((new Date(cap.openDate)-new Date())/(86400000));

  if(loading)return(<div className="sec" id="capsule"><div className="sec-in"><span className="brow">Капсула времени</span><h2 className="sh">Письма <em>в будущее</em></h2><SkeletonCards count={2}/></div></div>);

  return(
    <div className="sec" id="capsule">
      <div className="sec-in">
        <span className="brow">Капсула времени</span>
        <h2 className="sh">Письма <em>в будущее</em></h2>
        <p className="sp">Напишите послание — оно откроется в выбранную дату.</p>
        {capsules.length>0&&<div style={{marginBottom:20}}>
          {capsules.map(cap=>(<div key={cap.id} style={{borderRadius:16,padding:"16px",marginBottom:10,background:cap.opened?"rgba(184,146,74,.08)":"rgba(255,255,255,.03)",border:`1px solid ${cap.opened?"rgba(184,146,74,.25)":canOpen(cap)?"rgba(193,66,104,.4)":"rgba(255,255,255,.06)"}`}}>
            {cap.opened?(<><div style={{fontSize:11,color:"var(--g)",marginBottom:6}}>🔓 Открыто · {new Date(cap.openDate).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"})}</div><div style={{fontSize:14,color:"var(--ink2)",lineHeight:1.6}}>"{cap.text}"</div><div style={{fontSize:11,color:"var(--ink3)",marginTop:6}}>— @{n(cap.by)}</div></>):canOpen(cap)?(<div onClick={()=>tryOpen(cap)} style={{textAlign:"center",cursor:"pointer"}}><div style={{fontSize:32,marginBottom:8}}>🎁</div><div style={{fontSize:14,fontWeight:600,color:"var(--r)"}}>Пора открыть!</div><div style={{fontSize:12,color:"var(--ink3)",marginTop:4}}>от @{n(cap.by)} · нажми чтобы прочитать</div></div>):(<div style={{display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:28}}>🔒</span><div><div style={{fontSize:13,color:"var(--ink2)"}}>Письмо от @{n(cap.by)}</div><div style={{fontSize:11,color:"var(--ink3)",marginTop:2}}>Откроется {new Date(cap.openDate).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"})} · через {daysLeft(cap)} дн.</div></div></div>)}
          </div>))}
        </div>}
        <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(193,66,104,.15)",borderRadius:16,padding:16}}>
          <div style={{fontSize:12,color:"var(--ink3)",marginBottom:10}}>✉️ Написать письмо в будущее</div>
          <textarea className="ta" placeholder="Дорогой(ая)..." value={text} onChange={e=>sText(e.target.value)} style={{marginBottom:10,minHeight:90}}/>
          <input className="fi" type="date" value={openDate} min={new Date(Date.now()+86400000*7).toISOString().slice(0,10)} onChange={e=>sOpenDate(e.target.value)} style={{width:"100%",marginBottom:10}}/>
          <button className="fa" disabled={!text.trim()||!openDate} onClick={add} style={{width:"100%",padding:12}}>Запечатать 🔒</button>
        </div>
      </div>
    </div>
  );
}

/* ─── KISS COUNTER ─── */
function ProfileSec({pid,me,partner,daysT,tgPhotoUrl,theme,applyTheme,appTheme,toggleAppTheme}){
  const c=coll("prof",pid);
  const[data,sData]=useState(null);
  const[editing,sEditing]=useState(false);
  const[bioInp,sBio]=useState("");
  const[sdInp,sSd]=useState("");
  useEffect(()=>{c.load().then(d=>{if(d&&d.bio!==undefined){sData(d);sBio(d.bio||"");sSd(d.startDate||"");}});},[]);
  useEffect(()=>{const iv=setInterval(()=>c.load().then(d=>{if(d&&d.bio!==undefined)sData(d);}),30000);return()=>clearInterval(iv);},[]);
  const save=async()=>{const upd={bio:bioInp.trim(),startDate:sdInp,updBy:me};sData(upd);await c.save(upd);if(sdInp)localStorage.setItem("duo_sd",sdInp);sEditing(false);};
  const bio=data?.bio||"";
  const startDate=data?.startDate||localStorage.getItem("duo_sd")||"";
  const since=startDate?new Date(startDate).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"}):"";
  const meInitial=(n(me)[0]||"?").toUpperCase();
  const ptInitial=(n(partner)[0]||"?").toUpperCase();
  return(
    <div className="sec" id="profile">
      <div className="sec-in">
        <span className="brow">Профиль пары</span>
        <h2 className="sh"><em>Ваша</em> история</h2>
        {/* Theme switcher */}
        <div style={{display:"flex",gap:10,justifyContent:"center",margin:"20px 0"}}>
          {[
            {id:"midnight",c:"#c14268",label:"Ночь"},
            {id:"blush",c:"#e8748a",label:"Розовый"},
            {id:"golden",c:"#b8924a",label:"Золото"},
            {id:"ocean",c:"#4ab8c1",label:"Океан"},
          ].map(t=>(
            <div key={t.id} onClick={()=>applyTheme(t.id)}
              title={t.label}
              style={{width:28,height:28,borderRadius:"50%",background:t.c,cursor:"pointer",
                border:`2px solid ${theme===t.id?"rgba(255,255,255,.8)":"transparent"}`,
                transition:"transform .2s,border .2s",transform:theme===t.id?"scale(1.2)":"scale(1)"}}/>
          ))}
        </div>
        {toggleAppTheme&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderTop:"1px solid rgba(255,255,255,.05)"}}><span style={{fontSize:13,color:"var(--ink2)"}}>Тема оформления</span><div onClick={toggleAppTheme} style={{width:48,height:26,borderRadius:13,background:appTheme==="dark"?"rgba(193,66,104,.3)":"rgba(255,200,0,.3)",border:"1px solid rgba(255,255,255,.1)",position:"relative",cursor:"pointer",transition:"background .2s"}}><div style={{position:"absolute",top:3,left:appTheme==="dark"?3:23,width:18,height:18,borderRadius:"50%",background:appTheme==="dark"?"#c14268":"#ffcc00",transition:"left .2s",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>{appTheme==="dark"?"🌙":"☀️"}</div></div></div>}
        <div className="prof-wrap">
          <div className="prof-avs">
            {tgPhotoUrl?<img className="prof-av" src={tgPhotoUrl} alt={me}/>:<div className="prof-av prof-av-me">{meInitial}</div>}
            <span className="prof-heart">💕</span>
            <div className="prof-av prof-av-pt">{ptInitial}</div>
          </div>
          <div className="prof-names"><span>@{n(me)}</span><span>@{n(partner)}</span></div>
          {since&&<div className="prof-since">Вместе с <b>{since}</b></div>}
          {daysT!==null&&daysT>0&&<div className="prof-stats">
            <div><div className="prof-stat-n">{daysT}</div><div className="prof-stat-l">дней</div></div>
            <div><div className="prof-stat-n">{Math.floor(daysT/7)}</div><div className="prof-stat-l">недель</div></div>
            <div><div className="prof-stat-n">{Math.floor(daysT/30)}</div><div className="prof-stat-l">месяцев</div></div>
          </div>}
          {bio&&!editing&&<div className="prof-bio">"{bio}"</div>}
          {!editing&&<button className="prof-edit-btn" onClick={()=>sEditing(true)}>✏️ {bio?"Редактировать":"Добавить описание"}</button>}
          {editing&&<div className="prof-form">
            <label className="label">Начало отношений</label>
            <input className="fi fi-date" type="date" value={sdInp} onChange={e=>sSd(e.target.value)}/>
            <label className="label">О вас двоих</label>
            <textarea className="ta2" placeholder="Как вы познакомились, что вас объединяет…" value={bioInp} onChange={e=>sBio(e.target.value.slice(0,120))} rows={3}/>
            <div className="prof-char">{bioInp.length}/120</div>
            <div className="row" style={{justifyContent:"flex-end",gap:6}}>
              <button className="prof-edit-btn" onClick={()=>sEditing(false)}>Отмена</button>
              <button className="fa" onClick={save}>Сохранить</button>
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}
const MOODS=[
  {emoji:"😍",label:"Влюблён(а)"},
  {emoji:"🥰",label:"Счастлив(а)"},
  {emoji:"😊",label:"Хорошо"},
  {emoji:"🤩",label:"Восторг"},
  {emoji:"😌",label:"Спокойно"},
  {emoji:"🥳",label:"Праздник"},
  {emoji:"😎",label:"Уверен(а)"},
  {emoji:"🤔",label:"Задумчив(а)"},
  {emoji:"😴",label:"Устал(а)"},
  {emoji:"🥺",label:"Грустно"},
  {emoji:"😤",label:"Раздражён(а)"},
  {emoji:"🤒",label:"Болею"},
  {emoji:"😰",label:"Тревожно"},
  {emoji:"🔥",label:"Энергично"},
  {emoji:"💕",label:"Скучаю"},
  {emoji:"✨",label:"Вдохновлён(а)"},
  {emoji:"🌙",label:"Мечтаю"},
  {emoji:"💪",label:"Силён(а)"},
];
function MoodSec({pid,me,partner}){
  const today=new Date().toISOString().split('T')[0];
  const[myMood,sMy]=useState(null);
  const[ptMood,sPt]=useState(null);
  const[selEm,sSel]=useState(null);
  const[noteInp,sNote]=useState("");
  const[hist,sHist]=useState([]);

  const load=async()=>{
    const[m,p,h]=await Promise.all([db.get(`mood:${norm(me)}`),db.get(`mood:${norm(partner)}`),db.get(`mood_history:${pid}`)]);
    if(m&&m.date===today)sMy(m); else sMy(null);
    if(p&&p.date===today)sPt(p); else sPt(null);
    sHist(h||[]);
  };
  useEffect(()=>{load();},[]);
  useEffect(()=>{const iv=setInterval(load,10000);return()=>clearInterval(iv);},[]);

  const save=async()=>{
    if(!selEm)return;
    const data={emoji:selEm,note:noteInp.trim(),date:today,ts:Date.now()};
    await db.set(`mood:${norm(me)}`,data);
    sMy(data);
    const h=await db.get(`mood_history:${pid}`)||[];
    const newH=h.find(x=>x.date===today)
      ?h.map(x=>x.date===today?{...x,[`${norm(me)}_emoji`]:selEm}:x)
      :[{date:today,[`${norm(me)}_emoji`]:selEm},...h].slice(0,30);
    await db.set(`mood_history:${pid}`,newH);
    sHist(newH);
    sSel(null);sNote("");
  };

  const myM=MOODS.find(m=>m.emoji===myMood?.emoji);
  const ptM=MOODS.find(m=>m.emoji===ptMood?.emoji);
  const histRows=hist.filter(h=>h.date!==today).slice(0,7);

  return(
    <div className="sec" id="mood">
      <div className="sec-in">
        <span className="brow">Настроение дня</span>
        <h2 className="sh">Как вы <em>сейчас</em></h2>
        <p className="sp">Расскажите друг другу о своём настроении — обновляется каждый день.</p>
        <div className="mood-today">
          <div className={`mood-side ${myMood?"has-mood":""}`}>
            <div className="mood-side-who">Я · @{n(me)}</div>
            {myMood?(<><span className="mood-big">{myMood.emoji}</span><div className="mood-label">{myM?.label||""}</div>{myMood.note&&<div className="mood-note">"{myMood.note}"</div>}</>):(<><span className="mood-empty">😶</span><div className="mood-empty-hint">Не выбрано</div></>)}
          </div>
          <div className={`mood-side ${ptMood?"has-mood":""}`}>
            <div className="mood-side-who">@{n(partner)}</div>
            {ptMood?(<><span className="mood-big">{ptMood.emoji}</span><div className="mood-label">{ptM?.label||""}</div>{ptMood.note&&<div className="mood-note">"{ptMood.note}"</div>}</>):(<><span className="mood-empty">❓</span><div className="mood-empty-hint">Ещё не выбрал(а)</div></>)}
          </div>
        </div>
        <div className="mood-picker">{MOODS.map(m=><span key={m.emoji} className={`mood-opt ${selEm===m.emoji?"sel":""}`} onClick={()=>sSel(s=>s===m.emoji?null:m.emoji)} title={m.label}>{m.emoji}</span>)}</div>
        {selEm&&<div className="form" style={{maxWidth:380,margin:"0 auto 16px"}}><div className="row"><input className="fi" placeholder="Заметка к настроению (необязательно)" value={noteInp} onChange={e=>sNote(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()}/><button className="fa" onClick={save}>Сохранить</button></div></div>}
        {histRows.length>0&&<div className="mood-hist"><div className="mood-hist-hd">История</div>{histRows.map((h,i)=><div key={i} className="mood-hist-row"><div className="mood-hist-date">{new Date(h.date).toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}</div><div className="mood-hist-emojis"><span>{h[`${norm(me)}_emoji`]||"—"}</span><span>{h[`${norm(partner)}_emoji`]||"—"}</span></div></div>)}</div>}
      </div>
    </div>
  );
}
const QUESTIONS=["Что тебе больше всего нравится в нас двоих?","Какой момент нашей совместной жизни ты хотел(а) бы пережить снова?","Чем ты восхищаешься во мне больше всего?","Какое наше совместное приключение ты хочешь обязательно повторить?","Что делает тебя счастливым(ой) в наших отношениях?","Какую черту моего характера ты ценишь больше всего?","О чём ты мечтаешь для нас на следующий год?","Какую традицию ты хотел(а) бы завести в наших отношениях?","Что я делаю, что заставляет тебя улыбаться?","Если бы у нас был один день без забот — как бы ты его провёл(а)?","Что для тебя значит чувствовать себя любимым(ой)?","Какой подарок от меня запомнился тебе больше всего?","Чему ты научился(ась) у меня?","Какое место ты хочешь посетить вместе со мной?","Что ты хочешь, чтобы я знал(а) о тебе?","Как ты понял(а), что влюбился(ась)?","Какой твой любимый способ провести время вдвоём?","Что для тебя важнее всего в отношениях?","Какую песню ты ассоциируешь с нами?","Что бы ты хотел(а) изменить в себе ради нас?","Как ты видишь нас через 5 лет?","Что тебя больше всего удивляет во мне?","Какой был наш самый смешной момент?","За что ты благодарен(на) мне прямо сейчас?","Что я могу сделать, чтобы сделать тебя счастливее?","Опиши меня тремя словами.","Какой комплимент от меня ты вспоминаешь чаще всего?","Что ты чувствуешь, когда мы вместе?","Если бы мы написали книгу о нас — как бы она называлась?","Что бы ты сделал(а) для меня, если бы я был(а) расстроен(а)?"];
const getTodayQ=()=>QUESTIONS[Math.floor(Date.now()/86400000)%QUESTIONS.length];
function QASec({pid,me,partner}){
  const today=new Date().toISOString().split('T')[0];
  const[entries,sE]=useState([]);
  const[inp,sInp]=useState("");
  useEffect(()=>{db.get(`qa:${pid}`).then(d=>sE(d||[]));},[]);
  useEffect(()=>{const iv=setInterval(()=>db.get(`qa:${pid}`).then(d=>sE(d||[])),8000);return()=>clearInterval(iv);},[]);
  const todayQ=getTodayQ();
  const todayEntry=entries.find(e=>e.date===today)||{date:today,question:todayQ,answers:{}};
  const myAns=todayEntry.answers[norm(me)];
  const ptAns=todayEntry.answers[norm(partner)];
  const submit=async()=>{
    if(!inp.trim())return;
    const entry={...todayEntry,answers:{...todayEntry.answers,[norm(me)]:{text:inp.trim(),ts:Date.now()}}};
    const updated=[entry,...entries.filter(e=>e.date!==today)].slice(0,30);
    sE(updated);await db.set(`qa:${pid}`,updated);sInp("");
  };
  const archive=entries.filter(e=>e.date!==today&&e.answers[norm(me)]&&e.answers[norm(partner)]).slice(0,7);
  return(
    <div className="sec" id="qa">
      <div className="sec-in">
        <span className="brow">Вопрос дня</span>
        <h2 className="sh">Узнаём <em>друг друга</em></h2>
        <p className="sp">Каждый день — новый вопрос. Ответ партнёра появится только когда ответишь сам(а).</p>
        <div className="qa-today">
          <div className="qa-q">«{todayQ}»</div>
          {!myAns&&<div style={{display:"flex",flexDirection:"column",gap:8}}><textarea className="ta2" placeholder="Твой ответ…" value={inp} onChange={e=>sInp(e.target.value)} rows={3}/><div style={{textAlign:"right"}}><button className="fa" disabled={!inp.trim()} onClick={submit}>Ответить</button></div></div>}
          {myAns&&<div className="qa-answers">
            <div className="qa-ans-card mine"><div className="qa-ans-who">@{n(me)}</div><div className="qa-ans-text">{myAns.text}</div></div>
            {ptAns?<div className="qa-ans-card theirs"><div className="qa-ans-who">@{n(partner)}</div><div className="qa-ans-text">{ptAns.text}</div></div>:<div className="qa-waiting">⏳ Ждём ответа @{n(partner)}…</div>}
          </div>}
        </div>
        {archive.length>0&&<details className="qa-archive"><summary>Предыдущие вопросы ({archive.length})</summary>{archive.map((e,i)=><div key={i} className="qa-archive-item"><div className="qa-q-small">«{e.question}»</div><div className="qa-answers" style={{marginTop:8}}><div className="qa-ans-card mine"><div className="qa-ans-who">@{n(me)}</div><div className="qa-ans-text">{e.answers[norm(me)]?.text}</div></div><div className="qa-ans-card theirs"><div className="qa-ans-who">@{n(partner)}</div><div className="qa-ans-text">{e.answers[norm(partner)]?.text}</div></div></div></div>)}</details>}
      </div>
    </div>
  );
}
const PLACE_EMOJIS=["📍","❤️","🌹","🏠","☕","🎭","🏖️","🏔️","🍕","🎵","✨","💋"];
function MapSec({pid,me}){
  const[ready,sReady]=useState(false);
  useEffect(()=>{
    const check=()=>{if(window.L){sReady(true);}else{setTimeout(check,200);}};
    check();
  },[]);

  const{data:placesRaw,setData:sPlaces,loading:placesLoading,refresh}=useSync(`places:${pid}`,[],30000);
  const places=Array.isArray(placesRaw)?placesRaw:[];
  const[adding,sAdding]=useState(false);
  const[pending,sPending]=useState(null);
  const[name,sName]=useState("");
  const[note,sNote]=useState("");
  const[em,sEm]=useState("📍");
  const mapRef=useRef(null);
  const mapI=useRef(null);
  const mks=useRef({});

  // Init Leaflet map (only when ready)
  useEffect(()=>{
    if(!ready||!mapRef.current||mapI.current||!window.L)return;
    const map=window.L.map(mapRef.current,{zoomControl:true,attributionControl:false}).setView([55.75,37.62],4);
    window.L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:19,attribution:''}).addTo(map);
    map.on("click",e=>{
      if(!mapI._adding)return;
      sPending({lat:e.latlng.lat,lng:e.latlng.lng});
    });
    mapI.current=map;
  },[ready]);

  // Sync adding state to ref so map click handler sees it
  useEffect(()=>{mapI._adding=adding;},[adding]);

  // Update markers when places change
  useEffect(()=>{
    if(!mapI.current||!window.L)return;
    Object.values(mks.current).forEach(m=>m.remove());
    mks.current={};
    places.forEach(p=>{
      const icon=window.L.divIcon({html:`<div style="font-size:22px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))">${p.em}</div>`,className:"",iconSize:[28,28],iconAnchor:[14,14]});
      const mk=window.L.marker([p.lat,p.lng],{icon}).addTo(mapI.current).bindPopup(`<b>${p.name}</b>${p.note?"<br><small>"+p.note+"</small>":""}`);
      mks.current[p.id]=mk;
    });
    if(places.length>0){const last=places[places.length-1];mapI.current.setView([last.lat,last.lng],6);}
  },[places]);

  const save=async()=>{
    if(!pending||!name.trim())return;
    const pl={id:Date.now(),name:name.trim(),note:note.trim(),lat:pending.lat,lng:pending.lng,em,by:me,ts:Date.now()};
    await refresh([...places,pl]);
    sName("");sNote("");sPending(null);sAdding(false);
  };

  const remove=async(id)=>{
    await refresh(places.filter(p=>p.id!==id));
  };

  if(!ready)return(
    <div className="sec" id="map">
      <div className="sec-in" style={{textAlign:"center",padding:"40px 0"}}>
        <p style={{color:"var(--ink3)",fontSize:12}}>Загрузка карты…</p>
      </div>
    </div>
  );

  return(
    <div className="sec" id="map">
      <div className="sec-in">
        <span className="brow">Наши места</span>
        <h2 className="sh">Где мы <em>были вместе</em></h2>
        <p className="sp">Отмечайте места на карте — первое свидание, любимое кафе, путешествия.</p>
        <div ref={mapRef} className="map-container"/>
        <div className="map-controls">
          {!adding&&<button className="fa" onClick={()=>{sAdding(true);sPending(null);}}>+ Отметить место</button>}
          {adding&&!pending&&<div className="map-tip">👆 Нажмите на карту чтобы выбрать место</div>}
          {adding&&pending&&<div className="map-form">
            <div className="ep">{PLACE_EMOJIS.map(e=><span key={e} className={`eo ${em===e?"s":""}`} onClick={()=>sEm(e)}>{e}</span>)}</div>
            <div className="row"><input className="fi" placeholder="Название места" value={name} onChange={e=>sName(e.target.value)}/><button className="fa" disabled={!name.trim()} onClick={save}>Сохранить</button></div>
            <input className="fi" placeholder="Заметка (необязательно)" value={note} onChange={e=>sNote(e.target.value)}/>
            <button className="prof-edit-btn" style={{marginTop:2}} onClick={()=>{sPending(null);sAdding(false);}}>Отмена</button>
          </div>}
        </div>
        {places.length>0&&<div className="places-list">{[...places].reverse().slice(0,8).map(p=>(
          <div key={p.id} className="place-item" onClick={()=>mapI.current?.setView([p.lat,p.lng],13)}>
            <span className="place-em">{p.em}</span>
            <div style={{flex:1}}><div className="place-name">{p.name}</div>{p.note&&<div className="place-note">{p.note}</div>}</div>
            {p.by&&norm(p.by)===norm(me)&&<span className="place-del" onClick={e=>{e.stopPropagation();remove(p.id);}}>✕</span>}
          </div>
        ))}</div>}
      </div>
    </div>
  );
}
function PlannerSec({pid,me,partner}){
  const weekKey=()=>{const d=new Date();const dow=d.getDay();const mon=new Date(d);mon.setDate(d.getDate()-(dow===0?6:dow-1));return mon.toISOString().split('T')[0];};
  const wk=weekKey();
  const{data:plan,loading,refresh}=useSync(`plan:${pid}:${wk}`,{},6000);
  const[inp,sInp]=useState("");
  const[selDay,sSelDay]=useState(null); // "mon","tue"...
  const[selTime,sSelTime]=useState("");

  const DAYS=[
    {id:"mon",label:"Понедельник"},
    {id:"tue",label:"Вторник"},
    {id:"wed",label:"Среда"},
    {id:"thu",label:"Четверг"},
    {id:"fri",label:"Пятница"},
    {id:"sat",label:"Суббота"},
    {id:"sun",label:"Воскресенье"},
  ];

  const today=["sun","mon","tue","wed","thu","fri","sat"][new Date().getDay()];

  const addItem=async(dayId)=>{
    if(!inp.trim())return;
    const item={id:Date.now(),text:inp.trim(),by:me,time:selTime||null};
    const dayItems=[...(plan[dayId]||[]),item];
    const newPlan={...plan,[dayId]:dayItems};
    await refresh(newPlan);
    sInp("");sSelTime("");sSelDay(null);
  };

  const delItem=async(dayId,itemId)=>{
    const newPlan={...plan,[dayId]:(plan[dayId]||[]).filter(i=>i.id!==itemId)};
    await refresh(newPlan);
  };

  if(loading)return(
    <div className="sec" id="planner"><div className="sec-in">
      <span className="brow">Планировщик</span>
      <h2 className="sh">Эта <em>неделя</em></h2>
      <SkeletonCards count={4} height={70}/>
    </div></div>
  );

  return(
    <div className="sec" id="planner">
      <div className="sec-in">
        <span className="brow">Планировщик</span>
        <h2 className="sh">Эта <em>неделя</em></h2>
        <p className="sp">Добавляй планы на каждый день — оба видите расписание.</p>
        <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:"var(--ink3)"}}>
            <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"var(--r)",marginRight:4}}/>@{n(me)}
          </span>
          <span style={{fontSize:11,color:"var(--ink3)"}}>
            <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"var(--teal)",marginRight:4}}/>@{n(partner)}
          </span>
        </div>

        {DAYS.map(day=>{
          const items=plan[day.id]||[];
          const isToday=day.id===today;
          const isOpen=selDay===day.id;
          return(
            <div key={day.id} style={{
              marginBottom:10,
              borderRadius:16,
              border:isToday?"1px solid rgba(193,66,104,.35)":"1px solid rgba(255,255,255,.06)",
              background:isToday?"rgba(193,66,104,.06)":"rgba(255,255,255,.02)",
              overflow:"hidden",
            }}>
              {/* Day header */}
              <div style={{
                display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"12px 14px",cursor:"pointer",
              }} onClick={()=>sSelDay(isOpen?null:day.id)}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{
                    fontFamily:"var(--d)",fontSize:15,fontWeight:isToday?700:400,
                    color:isToday?"var(--r)":"var(--ink2)"
                  }}>{day.label}</span>
                  {isToday&&<span style={{fontSize:10,background:"var(--r)",color:"#fff",padding:"2px 7px",borderRadius:999,fontWeight:600}}>Сегодня</span>}
                  {items.length>0&&<span style={{fontSize:11,color:"var(--ink3)"}}>{items.length} план{items.length>1?"а":""}</span>}
                </div>
                <span style={{color:"var(--ink3)",fontSize:12,transition:"transform .2s",transform:isOpen?"rotate(180deg)":"none"}}>▾</span>
              </div>

              {/* Items */}
              {(isOpen||items.length>0)&&(
                <div style={{padding:"0 14px 12px"}}>
                  {items.map(item=>(
                    <div key={item.id} style={{
                      display:"flex",alignItems:"center",gap:10,
                      padding:"8px 10px",borderRadius:10,marginBottom:6,
                      background:item.by===me?"rgba(193,66,104,.1)":"rgba(74,184,193,.1)",
                      border:`1px solid ${item.by===me?"rgba(193,66,104,.2)":"rgba(74,184,193,.2)"}`,
                    }}>
                      <span style={{width:6,height:6,borderRadius:"50%",flexShrink:0,
                        background:item.by===me?"var(--r)":"var(--teal)"}}/>
                      <div style={{flex:1,minWidth:0}}>
                        {item.time&&<div style={{fontSize:10,color:"var(--g)",marginBottom:2}}>🕐 {item.time}</div>}
                        <div style={{fontSize:13,color:"var(--ink)"}}>{item.text}</div>
                      </div>
                      {item.by===me&&<span onClick={()=>delItem(day.id,item.id)}
                        style={{color:"var(--ink3)",cursor:"pointer",fontSize:13}}>✕</span>}
                    </div>
                  ))}

                  {isOpen&&(
                    <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
                      <input className="fi" placeholder="Добавить план…" value={inp}
                        onChange={e=>sInp(e.target.value)}
                        onKeyDown={e=>e.key==="Enter"&&addItem(day.id)}
                        style={{width:"100%"}}/>
                      <div style={{display:"flex",gap:6}}>
                        <input type="time" className="fi" value={selTime}
                          onChange={e=>sSelTime(e.target.value)}
                          style={{width:100,flexShrink:0}}/>
                        <button className="fa" disabled={!inp.trim()}
                          onClick={()=>addItem(day.id)} style={{flex:1}}>+ Добавить</button>
                      </div>
                    </div>
                  )}

                  {!isOpen&&items.length===0&&(
                    <div style={{fontSize:12,color:"var(--ink3)",paddingBottom:4}}>Нажми чтобы добавить план</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
const SHOP_CATS=[
  {id:'food',icon:'🥦',label:'Еда'},
  {id:'meat',icon:'🥩',label:'Мясо'},
  {id:'fruit',icon:'🍎',label:'Фрукты'},
  {id:'bakery',icon:'🥖',label:'Выпечка'},
  {id:'drinks',icon:'🧃',label:'Напитки'},
  {id:'sweets',icon:'🍫',label:'Сладкое'},
  {id:'frozen',icon:'🧊',label:'Заморозка'},
  {id:'home',icon:'🏠',label:'Дом'},
  {id:'care',icon:'🧴',label:'Уход'},
  {id:'pharma',icon:'💊',label:'Аптека'},
  {id:'pets',icon:'🐾',label:'Питомцы'},
  {id:'other',icon:'📦',label:'Другое'},
];
function ShopSec({pid,me,partner}){
  const{data:items,setData:sI,loading,refresh}=useSync(`shop:${pid}`,[],5000);
  const safeItems=Array.isArray(items)?items:[];
  const[inp,sInp]=useState('');
  const[cat,sCat]=useState('food');
  const[filter,sFilter]=useState('all');
  const add=async()=>{if(!inp.trim())return;await refresh([...safeItems,{id:Date.now(),text:inp.trim(),done:false,by:me,cat,ts:Date.now()}]);sInp('');};
  const toggle=async(id)=>{await refresh(safeItems.map(x=>x.id===id?{...x,done:!x.done,doneBy:!x.done?me:null}:x));};
  const remove=async(id)=>{await refresh(safeItems.filter(x=>x.id!==id));};
  const clearDone=async()=>{await refresh(safeItems.filter(x=>!x.done));};
  const filtered=safeItems.filter(x=>filter==='all'?true:filter==='active'?!x.done:x.done);
  const doneCount=safeItems.filter(x=>x.done).length;
  const activeCount=safeItems.filter(x=>!x.done).length;
  if(loading)return(<div className="sec" id="shop"><div className="sec-in"><span className="brow">Список покупок</span><h2 className="sh">Купить <em>вместе</em></h2><p className="sp">Добавляйте что нужно купить — оба видите список в реальном времени.</p><div style={{marginTop:24}}><SkeletonCards count={3}/></div></div></div>);
  return(
    <div className="sec" id="shop">
      <div className="sec-in">
        <span className="brow">Список покупок</span>
        <h2 className="sh">Купить <em>вместе</em></h2>
        <p className="sp">Добавляйте что нужно купить — оба видите список в реальном времени.</p>
        <div className="shop-form">
          <div className="shop-cats">{SHOP_CATS.map(sc=><div key={sc.id} className={`shop-cat ${cat===sc.id?'on':''}`} onClick={()=>sCat(sc.id)} title={sc.label}>{sc.icon}</div>)}</div>
          <div className="row">
            <input className="fi" placeholder="Добавить товар…" value={inp} onChange={e=>sInp(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()}/>
            <button className="fa" disabled={!inp.trim()} onClick={add}>+</button>
          </div>
        </div>
        {safeItems.length>0&&(
          <div className="shop-filters">
            {[['all','Все',safeItems.length],['active','Нужно',activeCount],['done','Куплено',doneCount]].map(([id,label,count])=><button key={id} className={`shop-filter ${filter===id?'on':''}`} onClick={()=>sFilter(id)}>{label} {count>0&&<span className="shop-filter-n">{count}</span>}</button>)}
            {doneCount>0&&<button className="shop-clear" onClick={clearDone}>Очистить куплено</button>}
          </div>
        )}
        <div className="shop-list">
          {filtered.length===0&&<div className="empty-hint">{filter==='done'?'Ничего не куплено':'Список пуст — добавьте первый товар 🛒'}</div>}
          {filtered.map(item=>{
            const catObj=SHOP_CATS.find(sc=>sc.id===item.cat)||SHOP_CATS.find(sc=>sc.id==='other')||SHOP_CATS[0];
            const isMine=n(item.by)===n(me);
            return(
              <div key={item.id} className={`shop-item ${item.done?'done':''}`}>
                <div className="shop-item-cat">{catObj.icon}</div>
                <div className={`shop-chk ${item.done?'ok':''}`} onClick={()=>toggle(item.id)}>{item.done&&<svg width="8" height="6"><path d="M1 3L3 5 7 1" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round"/></svg>}</div>
                <div className="shop-item-body">
                  <div className={`shop-item-text ${item.done?'done':''}`}>{item.text}</div>
                  <div className="shop-item-meta"><span>@{n(item.by)}</span>{item.done&&item.doneBy&&<span style={{color:'var(--mint)'}}> · куплено @{n(item.doneBy)}</span>}</div>
                </div>
                {isMine&&!item.done&&<div className="shop-del" onClick={()=>remove(item.id)}>✕</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
function KissBox({start}){const[e,se]=useState(0);useEffect(()=>{if(!start)return;const iv=setInterval(()=>se(Math.floor((Date.now()-start)/1000)),100);return()=>clearInterval(iv);},[start]);const f=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;return <div className="kiss-box"><span className="kiss-em">💋</span><div className="kiss-t">{f(e)}</div><div className="kiss-l">Держите…</div></div>;}

/* ─── VIBE RIPPLE ─── */
function VibeRipple({vid,partner,onDone}){const p=VIBES.find(x=>x.id===vid)||VIBES[0];useEffect(()=>{const t=setTimeout(onDone,2400);return()=>clearTimeout(t);},[]);return <div className="vripple" style={{"--vc":p.color||"rgba(193,66,104,.6)"}}>{[0,320,660].map((d,i)=><div key={i} className="vring" style={{"--vd":"1.55s",animationDelay:`${d}ms`}}/>)}<div className="vripple-i">{p.icon}</div><div className="vripple-n">@{n(partner)}</div><div className="vripple-s">{p.name}</div></div>;}

/* ─── TG HOOK ─── */
function useTG(){
  const tg=typeof window!=="undefined"?window.Telegram?.WebApp:null;
  const[uname,setUname]=useState("");
  useEffect(()=>{
    if(!tg)return;
    tg.ready();tg.expand();
    tg.setHeaderColor("#07060d");
    tg.setBackgroundColor("#07060d");
    const u=tg.initDataUnsafe?.user?.username||"";
    if(u)setUname(u);
  },[]);
  const ok=!!(tg?.initData)||!!(tg?.initDataUnsafe?.user);
  const startParam=tg?.initDataUnsafe?.start_param||"";
  const photoUrl=tg?.initDataUnsafe?.user?.photo_url||null;
  const share=me=>{const bot=import.meta.env.VITE_BOT_USERNAME||"duo_viewer_bot";const url=`https://t.me/${bot}?startapp=${encodeURIComponent(me)}`;const txt="Открой наше приложение 💕";if(tg&&ok)tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(txt)}`);else navigator.clipboard?.writeText(url);};
  return{ok,username:uname,startParam,photoUrl,share};
}

/* ─── ONBOARDING ─── */
const OB_STEPS=[
  {icon:"💕",title:<>Только для <em>вас двоих</em></>,desc:"Закрытое пространство для пары. Никаких лишних людей — только вы."},
  {icon:"🔄",title:<>Всё <em>в реальном времени</em></>,desc:"Добавляй планы, воспоминания, списки покупок — партнёр видит всё мгновенно."},
  {icon:"🌹",title:<>Начните <em>прямо сейчас</em></>,desc:"Введите ники Telegram — и окажитесь в одном пространстве. Это займёт 10 секунд."},
];
function Onboarding({onDone}){
  const[step,setStep]=useState(0);
  const s=OB_STEPS[step];
  const isLast=step===OB_STEPS.length-1;
  return(
    <div className="ob">
      <div className="ob-steps">
        {OB_STEPS.map((_,i)=><div key={i} className={`ob-step ${i<=step?"on":""}`}/>)}
      </div>
      <div className="ob-icon">{s.icon}</div>
      <h2 className="ob-title">{s.title}</h2>
      <p className="ob-desc">{s.desc}</p>
      <div className="ob-nav">
        <button className="ob-skip" onClick={onDone}>Пропустить</button>
        <button className="ob-next" onClick={()=>isLast?onDone():setStep(p=>p+1)}>
          {isLast?"Начать 💕":"Далее →"}
        </button>
      </div>
    </div>
  );
}

/* ─── LANDING ─── */
const SECS=[{id:"hero",l:"Главная"},{id:"today",l:"Сегодня"},{id:"profile",l:"Профиль"},{id:"achievements",l:"Награды"},{id:"mood",l:"Настроение"},{id:"qa",l:"Вопрос"},{id:"timer",l:"Счётчик"},{id:"planner",l:"Неделя"},{id:"shop",l:"Покупки"},{id:"calendar",l:"Даты"},{id:"moments",l:"Моменты"},{id:"dreams",l:"Мечты"},{id:"wishes",l:"Желания"},{id:"travel",l:"Путешествия"},{id:"map",l:"Места"},{id:"promises",l:"Обещания"},{id:"capsule",l:"Капсула"}];

function Landing({me,partner,surpriseMsg,connectedAt,tgPhotoUrl,onDisc}){
  const online=useOnline();
  const[stuck,sS]=useState(false);const[active,sA]=useState("hero");
  const[sd,sSD]=useState(()=>localStorage.getItem("duo_sd")||"");
  const[ptRibMood,sPtRibMood]=useState(null);
  const[pSc,sPSc]=useState(null);const[pCu,sPCu]=useState(null);
  const[reacts,sReacts]=useState(false);const[floats,sF]=useState([]);const rid=useRef(0);
  const[chat,sChat]=useState(false);const[msgs,sMsgs]=useState([]);const[cinp,sCInp]=useState("");const[unread,sUnread]=useState(0);const lastTs=useRef(0);const msEnd=useRef(null);
  useEffect(()=>{if(msgs.length>0)msEnd.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  const[isRec,sRec]=useState(false);const mrRef=useRef(null);const chunks=useRef([]);const recSt=useRef(null);
  const[myKiss,sMK]=useState(false);const[ptKiss,sPK]=useState(false);const[kissStart,sKS]=useState(null);const kTK=useRef(0);const[kToast,sKT]=useState(null);
  const[vibe,sVibe]=useState(false);const[vibeR,sVR]=useState(null);const lastVT=useRef(0);
  const[music,sMusic]=useState(false);
  const[trackPicker,sTrackPicker]=useState(false);
  const[currentTrack,sCurrentTrack]=useState("1");
  const[surp,sSurp]=useState(false);const sFired=useRef(false);
  const scroll=useRef(null);
  const[scrollEl,sScrollEl]=useState(null);
  const scrollCb=useCallback(el=>{scroll.current=el;sScrollEl(el);},[]);
  const sRefs=useRef({});const st=useRef({scroll:0,cursor:null});const saveT=useRef(0);
  const pid=pair(me,partner);
  const[theme,setTheme]=useState("midnight");
  const[appTheme,sAppTheme]=useState(()=>localStorage.getItem("duo_theme")||"dark");
  const toggleAppTheme=()=>{const next=appTheme==="dark"?"light":"dark";sAppTheme(next);document.documentElement.setAttribute("data-theme",next);localStorage.setItem("duo_theme",next);};
  useEffect(()=>{document.documentElement.setAttribute("data-theme",appTheme);},[appTheme]);
  const applyTheme=id=>{
    setTheme(id);
    const themeMap={midnight:["#c14268","#9a2f4e"],blush:["#e8748a","#c45570"],golden:["#b8924a","#8a6a2e"],ocean:["#4ab8c1","#2e8a94"]};
    const[r,r2]=(themeMap[id]||themeMap.midnight);
    document.documentElement.style.setProperty("--r",r);
    document.documentElement.style.setProperty("--r2",r2);
    if(pid)db.set(`theme:${pid}`,id);
  };
  useEffect(()=>{if(pid)db.get(`theme:${pid}`).then(t=>{if(t)applyTheme(t);});},[pid]);

  const flush=useCallback(async(extra={})=>{const now=Date.now();if(now-saveT.current<380)return;saveT.current=now;await saveSt(me,{scroll:st.current.scroll,cursor:st.current.cursor,...extra});},[me]);

  useEffect(()=>{const el=scroll.current;if(!el)return;const fn=()=>{const p=el.scrollTop/(el.scrollHeight-el.clientHeight);st.current.scroll=isNaN(p)?0:p;sS(el.scrollTop>14);for(const[id,ref]of Object.entries(sRefs.current)){if(!ref)continue;const r=ref.getBoundingClientRect();if(r.top<=el.clientHeight*.38&&r.bottom>0){sA(id);break;}}if(!sFired.current&&st.current.scroll>0.94){sFired.current=true;sSurp(true);}flush();};el.addEventListener("scroll",fn,{passive:true});return()=>el.removeEventListener("scroll",fn);},[flush]);
  useEffect(()=>{const fn=e=>{st.current.cursor={x:e.clientX/window.innerWidth,y:e.clientY/window.innerHeight};flush();};window.addEventListener("mousemove",fn);return()=>window.removeEventListener("mousemove",fn);},[flush]);

  useEffect(()=>{
    const iv=setInterval(async()=>{
      const d=await loadSt(partner);if(!d)return;
      if(d.scroll!=null)sPSc(d.scroll);
      if(d.cursor)sPCu(d.cursor);
      if(d.reaction&&d.reaction.ts>(rid._last||0)){rid._last=d.reaction.ts;const id=++rid.current;sF(p=>[...p,{id,emoji:d.reaction.emoji,x:`${d.reaction.x}%`,y:`${d.reaction.y}%`}]);}
      if(d.msg&&d.msg.ts>lastTs.current){lastTs.current=d.msg.ts;sMsgs(p=>[...p,{...d.msg,from:partner}]);if(!chat)sUnread(u=>u+1);}
      const pk=d.kissing||false;sPK(pk);if(pk&&myKiss&&!kissStart)sKS(d.kissTs||Date.now());
      if(d.vibe&&d.vibe.ts>lastVT.current){lastVT.current=d.vibe.ts;const pv=VIBES.find(v=>v.id===d.vibe.id);if(pv&&navigator.vibrate)navigator.vibrate(pv.pat);sVR({id:d.vibe.id,ts:d.vibe.ts});}
      // mood ribbon indicator (check every ~10s via counter)
    },1500);
    return()=>clearInterval(iv);
  },[partner,chat,myKiss,kissStart]);

  useEffect(()=>{const today=new Date().toISOString().split('T')[0];const check=()=>db.get(`mood:${norm(partner)}`).then(m=>{if(m&&m.date===today)sPtRibMood(m.emoji);else sPtRibMood(null);});check();const iv=setInterval(check,12000);return()=>clearInterval(iv);},[partner]);
  useEffect(()=>{if(chat)sUnread(0);},[chat]);

  const scrollTo=useCallback((id,dir="left")=>{
    const el=sRefs.current[id];
    if(!el)return;
    const cur=sRefs.current[active];
    if(cur){cur.classList.add(dir==="left"?"swipe-out-left":"swipe-out-right");setTimeout(()=>cur.classList.remove("swipe-out-left","swipe-out-right"),300);}
    el.classList.add(dir==="left"?"swipe-in-left":"swipe-in-right");
    el.scrollIntoView({behavior:"smooth"});
    setTimeout(()=>el.classList.remove("swipe-in-left","swipe-in-right"),300);
  },[active]);
  const SWIPE_ORDER=["hero","today","profile","achievements","mood","qa","timer","planner","shop","calendar","moments","dreams","wishes","travel","map","promises","capsule"];
  const swipeIdx=SWIPE_ORDER.indexOf(active);
  const swipe=useSwipe(
    ()=>{const pv=SWIPE_ORDER[swipeIdx-1];if(pv)scrollTo(pv,"right");},
    ()=>{const nx=SWIPE_ORDER[swipeIdx+1];if(nx)scrollTo(nx,"left");},
    72,
    scrollEl
  );
  const sendReact=async em=>{sReacts(false);const x=35+Math.random()*30,y=25+Math.random()*44;const id=++rid.current;sF(p=>[...p,{id,emoji:em,x:`${x}%`,y:`${y}%`}]);const s=await loadSt(me)||{};await saveSt(me,{...s,reaction:{emoji:em,x,y,ts:Date.now()}});};
  const sendMsg=async(text,vd=null,vdur=null)=>{const ts=Date.now();const msg={text,from:me,ts,vd,vdur,reactions:{}};sMsgs(p=>[...p,msg]);const s=await loadSt(me)||{};await saveSt(me,{...s,msg:{...msg}});if(text&&text!=="🎤 Голосовое")notifyPartner(partner,`@${n(me)}: «${text.slice(0,60)}»`,"💬");};
  const reactToMsg=async(ts,emoji)=>{const updated=msgs.map(m=>{if(m.ts!==ts)return m;const cur=m.reactions?.[emoji]||0;return{...m,reactions:{...m.reactions,[emoji]:cur>0?0:1}};});sMsgs(updated);await db.set(`chat:${pid}`,updated);};
  const startRec=async()=>{try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const mime=["audio/webm","audio/mp4","audio/ogg"].find(t=>MediaRecorder.isTypeSupported(t))||"";const mr=new MediaRecorder(stream,mime?{mimeType:mime}:{});chunks.current=[];mr.ondataavailable=e=>chunks.current.push(e.data);mr.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks.current,mime?{type:mime}:{});if(blob.size>10){const dur=(Date.now()-recSt.current)/1000;const reader=new FileReader();reader.onloadend=async()=>{await sendMsg("🎤 Голосовое",reader.result.split(",")[1],dur);};reader.readAsDataURL(blob);}sRec(false);};mr.start();mrRef.current=mr;recSt.current=Date.now();sRec(true);setTimeout(()=>{if(mr.state==="recording")mr.stop();},30000);}catch(e){}};
  const stopRec=()=>{if(mrRef.current?.state==="recording")mrRef.current.stop();};
  const startKiss=async()=>{playSound("kiss");sMK(true);const ts=Date.now();await flush({kissing:true,kissTs:ts});if(ptKiss)sKS(ts);};
  const endKiss=async()=>{if(!myKiss)return;const dur=kissStart?Math.floor((Date.now()-kissStart)/1000):null;sMK(false);sKS(null);await flush({kissing:false});if(ptKiss&&dur&&dur>0){const k=++kTK.current;sKT({k,dur});setTimeout(()=>sKT(t=>t?.k===k?null:t),4500);}};
  const sendVibe=async p=>{sVibe(false);if(navigator.vibrate){const repeats=p.intensity||1;const pattern=[...p.pat];for(let i=1;i<repeats;i++)pattern.push(100,...p.pat);navigator.vibrate(pattern);}playSound("vibe");const s=await loadSt(me)||{};await saveSt(me,{...s,vibe:{id:p.id,ts:Date.now()}});};
  const toggleMusic=()=>{if(amb.playing){amb.stop();sMusic(false);}else{amb.start(currentTrack);sMusic(true);playSound("music");}};
  const switchTrack=id=>{amb.switchTo(id);sCurrentTrack(id);sMusic(true);sTrackPicker(false);playSound("music");};

  const ghostTop=pSc!==null?`calc(${pSc*100}% - 14px)`:null;
  const msSince=sd?Date.now()-new Date(sd).getTime():0;
  const daysT=sd&&msSince>0?Math.floor(msSince/86400000):null;
  const milestones=[{n:7,l:"7 дней"},{n:30,l:"1 месяц"},{n:100,l:"100 дней"},{n:180,l:"полгода"},{n:365,l:"1 год"},{n:730,l:"2 года"},{n:1000,l:"1000 дней"},{n:1825,l:"5 лет"}];

  return(
    <div ref={scrollCb} className="app">
      {!online&&<div className="offline-bar">⚠️ Нет соединения — данные могут не синхронизироваться</div>}
      <Timer t0={connectedAt}/>
      <nav className={`nav ${stuck?"stuck":""}`}>
        <span className="nav-logo">💕 {n(me)} & {n(partner)}</span>
        <ul className="nav-links">{SECS.map(s=><li key={s.id}><span className={`nl ${active===s.id?"on":""}`} onClick={()=>scrollTo(s.id)}>{s.l}</span></li>)}</ul>
      </nav>

      {/* HERO */}
      <section id="hero" ref={el=>sRefs.current.hero=el}><HeroSec me={me} partner={partner} connectedAt={connectedAt} pid={pid} tgPhotoUrl={tgPhotoUrl}/></section>
      <div className="hr"/>
      <section id="today" ref={el=>sRefs.current.today=el}><TodaySec pid={pid} me={me} partner={partner}/></section>
      <div className="hr"/>
      <section id="profile" ref={el=>sRefs.current.profile=el}><ProfileSec pid={pid} me={me} partner={partner} daysT={daysT} tgPhotoUrl={tgPhotoUrl} theme={theme} applyTheme={applyTheme} appTheme={appTheme} toggleAppTheme={toggleAppTheme}/></section>
      <div className="hr"/>
      <section id="achievements" ref={el=>sRefs.current.achievements=el}><AchievementsSec pid={pid} me={me} partner={partner} connectedAt={connectedAt}/></section>
      <div className="hr"/>
      <section id="mood" ref={el=>sRefs.current.mood=el}><MoodSec pid={pid} me={me} partner={partner}/></section>
      <div className="hr"/>
      <section id="qa" ref={el=>sRefs.current.qa=el}><QASec pid={pid} me={me} partner={partner}/></section>
      <div className="hr"/>
      <section id="timer" ref={el=>sRefs.current.timer=el} className="sec"><div className="sec-in"><span className="brow">Счётчик любви</span><h2 className="sh">Сколько мы <em>вместе</em></h2><p className="sp">Каждая секунда на счету.</p>{sd?<LoveTimer start={sd}/>:<p style={{fontSize:12,color:"var(--ink3)",marginBottom:20}}>Укажи дату начала ↓</p>}<div className="date-box"><span className="date-lbl">Вместе с</span><input className="date-inp" type="date" value={sd} onChange={e=>{sSD(e.target.value);localStorage.setItem("duo_sd",e.target.value);}}/></div>{sd&&daysT!==null&&<div className="milestones">{milestones.map(ms=><div key={ms.n} className={`ms ${daysT>=ms.n?"hit":""}`}>{daysT>=ms.n?"✓ ":""}{ms.l}</div>)}</div>}</div></section>

      <div className="hr"/>
      <section id="planner" ref={el=>sRefs.current.planner=el}><PlannerSec pid={pid} me={me} partner={partner}/></section>
      <div className="hr"/>
      <section id="shop" ref={el=>sRefs.current.shop=el}><ShopSec pid={pid} me={me} partner={partner}/></section>
      <div className="hr"/>
      <section ref={el=>sRefs.current.calendar=el}><CalSec pid={pid} me={me}/></section>
      <div className="hr"/>
      <section ref={el=>sRefs.current.moments=el}><MomSec pid={pid} me={me} partner={partner}/></section>
      <div className="hr"/>
      <section ref={el=>sRefs.current.dreams=el}><DreamsSec me={me} partner={partner}/></section>
      <div className="hr"/>
      <section ref={el=>sRefs.current.wishes=el}><WishesSec pid={pid} me={me} partner={partner}/></section>
      <div className="hr"/>
      <section ref={el=>sRefs.current.travel=el}><TravelSec pid={pid} me={me}/></section>
      <div className="hr"/>
      <section id="map" ref={el=>sRefs.current.map=el}><MapSec pid={pid} me={me}/></section>
      <div className="hr"/>
      <section ref={el=>sRefs.current.promises=el}><PromisesSec pid={pid} me={me} partner={partner}/></section>
      <div className="hr"/>
      <section id="capsule" ref={el=>sRefs.current.capsule=el}><CapsuleSec pid={pid} me={me}/></section>

      <footer className="foot"><p className="foot-t">@{n(me)} & @{n(partner)} · только вы двое 💕</p></footer>

      {/* overlays */}
      {ghostTop&&<div className="pbar"><div className="pbar-track"/><div className="pbar-thumb" style={{top:ghostTop}}/></div>}
      {pCu&&<div className="pcursor" style={{left:`${pCu.x*100}%`,top:`${pCu.y*100}%`}}><div className="pcursor-dot"/><div className="pcursor-label">@{n(partner)}</div></div>}
      {floats.map(r=><FloatReact key={r.id} {...r} onDone={()=>sF(p=>p.filter(x=>x.id!==r.id))}/>)}
      {reacts&&<div className="stickers">
          {STICKERS.map(s=>(
            <div key={s} className="sticker" onClick={()=>{
              sendReact(s);
              const el=document.createElement("div");
              el.textContent=s;
              el.className="sticker-fly";
              el.style.cssText=`bottom:120px;right:${40+Math.random()*60}px;`;
              document.body.appendChild(el);
              setTimeout(()=>el.remove(),900);
              sReacts(false);
            }}>{s}</div>
          ))}
        </div>}
      <div className="kiss-wrap">{(myKiss||ptKiss)&&(myKiss&&ptKiss?<KissBox start={kissStart}/>:<div className="kiss-wait">{myKiss?<>Ждём <b>@{n(partner)}</b>…</>:<><b>@{n(partner)}</b> ждёт! Зажми 💋</>}</div>)}</div>
      {kToast&&<div key={kToast.k} className="kiss-toast">💋 <b>{kToast.dur}с</b> — ваш поцелуй</div>}
      {vibe&&<div className="vpanel"><div className="vpanel-t">Отправить вибрацию</div>{VIBES.map(p=><div key={p.id} className="vopt" onClick={()=>sendVibe(p)}><span className="vopt-i">{p.icon}</span><span className="vopt-n">{p.name}</span></div>)}</div>}
      {vibeR&&<VibeRipple key={vibeR.ts} vid={vibeR.id} partner={partner} onDone={()=>sVR(null)}/>}
      {surp&&surpriseMsg&&<div className="surp-bg" onClick={()=>sSurp(false)}><div className="surp" onClick={e=>e.stopPropagation()}><div className="surp-shimmer"/><span className="surp-em">🌹</span><div className="surp-t">Для тебя</div><div className="surp-msg">"{surpriseMsg}"</div><div className="surp-from">— с любовью, @{n(me)} 💕</div><button className="surp-btn" onClick={()=>sSurp(false)}>Обнять в ответ 🤗</button></div></div>}

      {chat&&<div className="chat"><div className="chat-hd"><div><div className="chat-ht">💬 @{n(partner)}</div><div className="chat-hs">Только вы двое</div></div><div className="chat-xb" onClick={()=>sChat(false)}>✕</div></div><div className="chat-body">{msgs.length===0&&<div className="chat-empty">Напиши первым 🌹</div>}{msgs.map((m,i)=><div key={m.ts||i} className={`cbbl ${m.from===me?"me":"them"}`}>{m.from!==me&&<div className="cbbl-who">{n(m.from)}</div>}{m.vd?<VoicePlayer data={m.vd} dur={m.vdur}/>:<div>{m.text}</div>}<div style={{display:"flex",gap:3,marginTop:4,flexWrap:"wrap"}}>{["❤️","😂","🥺","🔥"].map(r=>(<span key={r} onClick={()=>reactToMsg(m.ts,r)} style={{fontSize:12,cursor:"pointer",padding:"1px 5px",borderRadius:999,background:m.reactions?.[r]?"rgba(193,66,104,.2)":"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.06)"}}>{r}{m.reactions?.[r]?` ${m.reactions[r]}`:""}</span>))}</div></div>)}<div ref={msEnd}/></div><div className="chat-row"><button className={`cmic ${isRec?"rec":""}`} onMouseDown={startRec} onMouseUp={stopRec} onTouchStart={startRec} onTouchEnd={stopRec}>🎤</button><input className="cinp" placeholder="Напиши…" value={cinp} onChange={e=>sCInp(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&cinp.trim()){sendMsg(cinp.trim());sCInp("");}}}/><button className="csend" disabled={!cinp.trim()} onClick={()=>{if(cinp.trim()){sendMsg(cinp.trim());sCInp("");}}}>→</button></div></div>}

      {/* RIBBON */}
      <div className="swipe-dots" onTouchStart={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()}>{["hero","today","profile","achievements","mood","qa","timer","planner","shop","calendar","moments","dreams","wishes","travel","map","promises","capsule"].map(id=><div key={id} className={`swipe-dot ${active===id?"on":""}`}/>)}</div>
      <div className="ribbon">
        <div className="rib-ava">{n(partner)[0]||"?"}</div>
        {ptRibMood&&<div className="rib-mood" title={`Настроение @${n(partner)}`}>{ptRibMood}</div>}
        <div className="rsep"/>
        <div className="rbtns">
          <div style={{display:"flex",alignItems:"center",gap:2}}><div className={`rb ${music?"on":""}`} onClick={()=>{toggleMusic();sTrackPicker(false);}} title="Музыка">{music?<MBars/>:TRACKS.find(t=>t.id===currentTrack)?.icon||"🎵"}</div><div className="rb" style={{width:22,height:22,fontSize:9}} onClick={()=>sTrackPicker(p=>!p)} title="Выбор трека">▾</div></div>
          <div className={`rb ${vibe?"on":""}`} onClick={()=>{sVibe(p=>!p);sReacts(false);sChat(false);}} title="Вибрация">📳</div>
          <div className={`rb ${reacts?"on":""}`} onClick={()=>{sReacts(p=>!p);sVibe(false);sChat(false);}} title="Реакции">🎯</div>
          <div className={`rb ${myKiss?"kiss-on":""}`} onMouseDown={startKiss} onMouseUp={endKiss} onTouchStart={startKiss} onTouchEnd={endKiss} title="Поцелуй">💋</div>
          <div style={{position:"relative"}}><div className={`rb ${chat?"on":""}`} onClick={()=>{sChat(p=>!p);sReacts(false);sVibe(false);playSound("chat");}} title="Чат">💬</div>{unread>0&&!chat&&<div className="rb-badge">{unread}</div>}</div>
        </div>
        <div className="rsep"/>
        <span className="rib-exit" onClick={onDisc}>Выйти</span>
      </div>
      {trackPicker&&(<div className="track-picker"><div style={{fontSize:10,fontWeight:600,letterSpacing:".1em",color:"rgba(193,66,104,.6)",textTransform:"uppercase",padding:"0 4px 6px"}}>Атмосфера</div>{TRACKS.map(t=>(<div key={t.id} className={`track-item ${currentTrack===t.id?"on":""}`} onClick={()=>switchTrack(t.id)}><span className="track-icon">{t.icon}</span><span className="track-name">{t.name}</span>{currentTrack===t.id&&<span className="track-active"/>}</div>))}</div>)}
    </div>
  );
}

/* ─── APP ─── */
class ErrBound extends React.Component {
  state={err:null};
  static getDerivedStateFromError(e){return{err:e};}
  render(){
    if(this.state.err)return(
      <div style={{color:'red',padding:20,fontSize:12,wordBreak:'break-all'}}>
        CRASH: {this.state.err.message}<br/>{this.state.err.stack?.slice(0,300)}
      </div>
    );
    return this.props.children;
  }
}

const _ses=()=>{try{const s=localStorage.getItem("duo_session");return s?JSON.parse(s):null;}catch{return null;}};

export default function App(){
  const[showOb,sShowOb]=useState(()=>!localStorage.getItem("duo_ob_done"));
  const doneOb=()=>{localStorage.setItem("duo_ob_done","1");sShowOb(false);};
  const[phase,sPhase]=useState(()=>_ses()?"landing":"connect");
  const[me,sMe]=useState(()=>_ses()?.me||"");
  const[partner,sPt]=useState(()=>_ses()?.partner||"");
  const{ok,username,startParam,photoUrl,share}=useTG();
  const[meI,sMeI]=useState("");
  const[ptI,sPtI]=useState("");
  const[surpI,sSurpI]=useState(()=>_ses()?.surp||"");
  const[err,sErr]=useState("");const[ca,sCA]=useState(()=>_ses()?.ca||null);const[copied,sCopied]=useState(false);
  const poll=useRef(null);const burst=useRef(null);

  useEffect(()=>{const s=document.createElement("style");s.textContent=CSS;document.head.appendChild(s);return()=>document.head.removeChild(s);},[]);
  useEffect(()=>{if(username)sMeI(username);},[username]);
  useEffect(()=>{if(startParam&&!ptI)sPtI(startParam);},[startParam]);
  useEffect(()=>()=>{clearInterval(poll.current);clearTimeout(burst.current);if(me)db.del(`p:${n(me)}`);amb.stop();},[me]);

  const startPoll=useCallback((myN,ptN)=>{
    const myNorm=n(myN);
    const ptNorm=n(ptN);
    let attempts=0;
    poll.current=setInterval(async()=>{
      attempts++;
      try{
        const d=await loadP(ptNorm);
        console.log("Poll attempt",attempts,"partner data:",d,"wants:",d?.wants,"my norm:",myNorm);
        if(d&&d.wants===myNorm){
          clearInterval(poll.current);
          const connAt=Date.now();
          localStorage.setItem("duo_session",JSON.stringify({
            me:myN, partner:ptN, ca:connAt, surp:surpI||""
          }));
          sMe(myN);sPt(ptN);sCA(connAt);
          sPhase("burst");
          burst.current=setTimeout(()=>sPhase("landing"),3000);
        }
        if(attempts===80){
          sErr("Партнёр ещё не открыл приложение — отправь ему ссылку 💕");
        }
      }catch(e){
        console.error("Poll error:",e);
      }
    },1500);
  },[surpI]);

  const connect=async()=>{
    const myN=n(meI);
    const ptN=n(ptI);
    if(!myN||!ptN){sErr("Заполни оба поля.");return;}
    if(myN===ptN){sErr("Нельзя подключиться к самому себе 😊");return;}
    sErr("");
    await saveP(myN,ptN);
    sPhase("waiting");
    startPoll(myN,ptN);
  };
  const disconnect=()=>{
    localStorage.removeItem("duo_session");
    clearInterval(poll.current);
    clearTimeout(burst.current);
    if(me)db.del(`p:${n(me)}`);
    amb.stop();
    sPhase("connect");
    sMe("");sPt("");sCA(null);
    sMeI(username||"");sPtI("");sSurpI("");
  };

  if(showOb)return <Onboarding onDone={doneOb}/>;
  if(phase==="landing")return <ErrBound><Landing me={me} partner={partner} surpriseMsg={surpI||_ses()?.surp||""} connectedAt={ca} tgPhotoUrl={photoUrl} onDisc={disconnect}/></ErrBound>;
  if(phase==="burst")return(<div className="burst"><BurstPetals/><div className="burst-ring"><div className="burst-icon">💖</div></div><div className="burst-h">Вы вместе</div><div className="burst-s"><span>@{n(me)}</span> & <span>@{n(partner)}</span></div></div>);

  return(
    <div className="co">
      <div className="co-aura"/>
      <div className="petals"><Petals/></div>
      <div className="co-card">
        <span className="co-gem">🌹</span>
        {phase==="waiting"?(
          <div className="wait">
            <div className="orb">💌</div>
            <div className="wait-name">Жду <span>@{n(ptI)}</span>…</div>
            <div className="wait-tip"><span className="wait-dot"/>Попроси <strong style={{color:"var(--ink2)"}}>@{n(ptI)}</strong> открыть и ввести <strong style={{color:"var(--ink2)"}}>@{n(meI)}</strong></div>
            <button className="btn-main" style={{opacity:.82}} onClick={()=>{share(meI.trim());sCopied(true);setTimeout(()=>sCopied(false),2000);}}>{copied?"✓ Скопировано!":(ok?"Отправить в Telegram ✈️":"Скопировать ссылку 🔗")}</button>
            <span className="wait-cancel" onClick={async()=>{localStorage.removeItem("duo_session");clearInterval(poll.current);await db.del(`p:${n(meI.trim())}`);sPhase("connect");}}>Отменить</span>
          </div>
        ):(
          <>
            <h1 className="co-h">Наше приложение,<br/><i>только для двоих</i></h1>
            <p className="co-sub">Введи ники — и окажитесь в одном пространстве.</p>
            <div className="sep"><span>✦</span></div>
            <div className="field">
              <label className="label">Твой ник</label>
              <div className="iw"><span className="iat">@</span><input className="inp" placeholder="username" value={meI} onChange={e=>{sMeI(e.target.value);sErr("");}} onKeyDown={e=>e.key==="Enter"&&connect()} readOnly={!!username}/></div>
              {ok&&username&&<p className="hint">✓ Получено из Telegram</p>}
            </div>
            <div className="field">
              <label className="label">Ник партнёра</label>
              <div className="iw"><span className="iat">@</span><input className="inp" placeholder="её или его username" value={ptI} onChange={e=>{sPtI(e.target.value);sErr("");}} onKeyDown={e=>e.key==="Enter"&&connect()}/></div>
            </div>
            <div className="field">
              <label className="label">💌 Сюрприз-послание</label>
              <textarea className="ta" placeholder="Появится когда она долистает до конца…" value={surpI} onChange={e=>sSurpI(e.target.value)}/>
              <p className="hint">Она увидит это в самом конце 🌹</p>
            </div>
            {err&&<p className="err">{err}</p>}
            <button className="btn-main" disabled={!meI.trim()||!ptI.trim()} onClick={connect}>Войти вместе 💕</button>
            <button className="btn-main" style={{marginTop:8,opacity:.55,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",color:"var(--ink3)"}}
              onClick={()=>{
                const myN=(meI.trim()||"test_me");
                const ptN="partner_test";
                const connAt=Date.now();
                localStorage.setItem("duo_session",JSON.stringify({me:myN,partner:ptN,ca:connAt}));
                sMe(myN);sPt(ptN);sCA(connAt);sPhase("landing");
              }}>
              🧪 Войти без партнёра (тест)
            </button>
          </>
        )}
      </div>
    </div>
  );
}
