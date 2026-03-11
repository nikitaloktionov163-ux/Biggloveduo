import { useState, useEffect, useRef, useCallback } from "react";

/* ══════════════════════════════════════════════════════
   STORAGE — Supabase
══════════════════════════════════════════════════════ */
const SUPABASE_URL = 'https://zghswvujqwshonctoulx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uLz5P6pKZ_r7aru5HmvMbw_MWoxAM_t';
const TTL = 15 * 60 * 1000;
const norm = s => (s||"").replace(/^@/,"").toLowerCase().trim();
const pairKey = (a,b) => [norm(a),norm(b)].sort().join("_");

const supaFetch = async (key, val) => {
  const base = `${SUPABASE_URL}/rest/v1/duo_store`;
  const h = { apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}`, "Content-Type":"application/json", Prefer:"resolution=merge-duplicates,return=minimal" };
  if (val===undefined) { const r=await fetch(`${base}?key=eq.${encodeURIComponent(key)}&select=value`,{headers:h}); const d=await r.json(); return d?.[0]?.value??null; }
  if (val===null) { await fetch(`${base}?key=eq.${encodeURIComponent(key)}`,{method:"DELETE",headers:h}); return; }
  await fetch(base,{method:"POST",headers:h,body:JSON.stringify({key,value:JSON.stringify(val)})});
};
const db = {
  set: async (k,v)=>{ try{await supaFetch(k,v);}catch(e){} },
  get: async (k)=>{ try{const r=await supaFetch(k);return r?JSON.parse(r):null;}catch{return null;} },
  del: async (k)=>{ try{await supaFetch(k,null);}catch(e){} },
};

const POLL = 1500;

/* presence */
const savePresence = (me,to) => db.set(`duo:${norm(me)}`,{wants:norm(to),ts:Date.now()});
const loadPresence = async n => { const d=await db.get(`duo:${norm(n)}`); return d&&Date.now()-d.ts<TTL?d:null; };
const clearAll = me => ["duo","duo_state","duo_moments","duo_calendar","duo_wishes","duo_dreams","duo_travel"].forEach(k=>db.del(`${k}:${norm(me)}`));

/* live state */
const saveState = (me,data) => db.set(`duo_state:${norm(me)}`,{...data,ts:Date.now()});
const loadState = async n => { const d=await db.get(`duo_state:${norm(n)}`); return d&&Date.now()-d.ts<TTL?d:null; };

/* shared collections */
const dbColl = (key,pair) => ({ save: arr=>db.set(`${key}:${pair}`,arr), load: ()=>db.get(`${key}:${pair}`).then(r=>r||[]) });

/* per-user collections */
const dbUser = (key,user) => ({ save: arr=>db.set(`${key}:${norm(user)}`,arr), load: ()=>db.get(`${key}:${norm(user)}`).then(r=>r||[]) });

/* ══════════════════════════════════════════════════════
   AMBIENT AUDIO
══════════════════════════════════════════════════════ */
class Ambient {
  start() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext||window.webkitAudioContext)();
    const m = this.ctx.createGain(); m.gain.setValueAtTime(0,0); m.gain.linearRampToValueAtTime(.045,this.ctx.currentTime+3); m.connect(this.ctx.destination);
    [[196,.4],[246.9,.3],[293.7,.2],[392,.1]].forEach(([f,v])=>{ const o=this.ctx.createOscillator(),g=this.ctx.createGain(),l=this.ctx.createOscillator(),lg=this.ctx.createGain(); o.type="sine";o.frequency.value=f;l.type="sine";l.frequency.value=.05+Math.random()*.04;lg.gain.value=1.2;l.connect(lg);lg.connect(o.frequency);g.gain.value=v;o.connect(g);g.connect(m);o.start();l.start(); });
    this.master = m;
  }
  stop() { if (!this.ctx) return; try{this.ctx.close();}catch(e){} this.ctx=null; this.master=null; }
}
const amb = new Ambient();

/* ══════════════════════════════════════════════════════
   CSS
══════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,200;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=Cormorant+Garamond:ital,wght@1,300;1,600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --serif:'Libre Baskerville',Georgia,serif;
  --italic:'Cormorant Garamond',Georgia,serif;
  --sans:'DM Sans',sans-serif;
  --rose:#e05d7b;--rose2:#c24565;--rose3:rgba(224,93,123,.12);
  --gold:#c9a44e;--gold2:rgba(201,164,78,.15);
  --teal:#5bbfd4;--green:#27c46e;--amber:#e0934a;
  --bg:#0b0a0f;--bg2:#110f17;--bg3:#17141f;
  --card:rgba(23,20,31,.96);
  --line:rgba(255,255,255,.07);--line2:rgba(224,93,123,.15);
  --fg:#f0ebe8;--fg2:rgba(240,235,232,.65);--fg3:rgba(240,235,232,.35);
  --ease:cubic-bezier(.22,1,.36,1);--spring:cubic-bezier(.34,1.56,.64,1);
  --r8:8px;--r12:12px;--r16:16px;--r20:20px;--r24:24px;
}
html,body,#root{height:100%;background:var(--bg);color:var(--fg);font-family:var(--sans);-webkit-font-smoothing:antialiased;}

/* scrollbar */
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-thumb{background:var(--line2);border-radius:3px;}

/* ── connect screen ── */
.co{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse 80% 60% at 20% 10%,rgba(224,93,123,.09),transparent 55%),radial-gradient(ellipse 60% 50% at 80% 85%,rgba(201,164,78,.07),transparent 50%),var(--bg);}
.co-petals{position:absolute;inset:0;overflow:hidden;pointer-events:none;}
.petal{position:absolute;border-radius:50% 0 50% 0;opacity:0;animation:pfall linear infinite;}
@keyframes pfall{0%{opacity:0;transform:translateY(-20px) rotate(0deg)}8%{opacity:.3}92%{opacity:.15}100%{opacity:0;transform:translateY(105vh) rotate(480deg)}}
.co-card{position:relative;z-index:2;width:min(400px,94vw);background:var(--card);border:1px solid var(--line2);border-radius:28px;padding:clamp(28px,5vw,40px);backdrop-filter:blur(40px);box-shadow:0 0 0 1px rgba(224,93,123,.06) inset,0 40px 120px rgba(0,0,0,.8);animation:fadeup .6s var(--ease) both;}
@keyframes fadeup{from{opacity:0;transform:translateY(24px) scale(.97)}to{opacity:1;transform:none}}
.co-icon{font-size:28px;display:block;margin-bottom:16px;animation:pulse 2.2s ease-in-out infinite;filter:drop-shadow(0 0 10px rgba(224,93,123,.5));}
@keyframes pulse{0%,100%{transform:scale(1)}14%{transform:scale(1.15)}28%{transform:scale(1)}}
.co-h{font-family:var(--serif);font-size:clamp(22px,5vw,28px);font-weight:700;letter-spacing:-.025em;line-height:1.2;margin-bottom:5px;}
.co-h em{font-style:italic;color:rgba(224,93,123,.9);}
.co-sub{font-size:13px;color:var(--fg3);line-height:1.65;margin-bottom:22px;}
.field{margin-bottom:12px;}
.field-label{font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:rgba(224,93,123,.65);display:block;margin-bottom:5px;}
.field-hint{font-size:11px;color:var(--fg3);margin-top:4px;}
.inp-wrap{position:relative;display:flex;align-items:center;}
.inp-at{position:absolute;left:12px;font-size:14px;font-weight:600;color:rgba(224,93,123,.5);pointer-events:none;}
.inp{width:100%;padding:11px 12px 11px 28px;background:rgba(255,255,255,.04);border:1px solid var(--line2);border-radius:var(--r12);color:var(--fg);font-family:var(--sans);font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s;}
.inp:focus{border-color:rgba(224,93,123,.5);box-shadow:0 0 0 3px rgba(224,93,123,.08);}
.inp::placeholder{color:var(--fg3);}
.inp-plain{padding-left:12px;}
.textarea{width:100%;padding:10px 12px;background:rgba(255,255,255,.04);border:1px solid var(--line2);border-radius:var(--r12);color:var(--fg);font-family:var(--sans);font-size:13px;outline:none;resize:none;min-height:62px;line-height:1.55;transition:border-color .2s;}
.textarea:focus{border-color:rgba(224,93,123,.5);}
.textarea::placeholder{color:var(--fg3);}
.err{font-size:12px;color:#f06060;margin-bottom:10px;}
.btn-rose{width:100%;padding:13px;border-radius:var(--r12);background:linear-gradient(135deg,var(--rose),var(--rose2));color:#fff;font-family:var(--sans);font-size:14px;font-weight:600;border:none;cursor:pointer;box-shadow:0 6px 22px rgba(224,93,123,.3);transition:opacity .18s,transform .18s var(--spring);}
.btn-rose:hover:not(:disabled){opacity:.88;transform:scale(1.01);}
.btn-rose:disabled{opacity:.28;cursor:not-allowed;}
.divider-line{display:flex;align-items:center;gap:10px;margin:18px 0;}
.divider-line::before,.divider-line::after{content:"";flex:1;height:1px;background:var(--line2);}
.divider-line span{font-size:12px;color:var(--fg3);}

/* waiting */
.co-wait{display:flex;flex-direction:column;align-items:center;gap:14px;padding:8px 0;animation:fadeup .4s var(--ease) both;}
.orb{width:72px;height:72px;border-radius:50%;background:radial-gradient(circle at 40% 35%,rgba(224,93,123,.4),rgba(224,93,123,.06));border:1px solid rgba(224,93,123,.25);display:flex;align-items:center;justify-content:center;font-size:28px;position:relative;}
.orb::before,.orb::after{content:"";position:absolute;border-radius:50%;border:1px solid rgba(224,93,123,.12);animation:ripple 2.2s ease-out infinite;}
.orb::before{inset:-10px;}
.orb::after{inset:-22px;animation-delay:.75s;border-color:rgba(224,93,123,.06);}
@keyframes ripple{0%{opacity:.9;transform:scale(.85)}100%{opacity:0;transform:scale(1.3)}}
.wait-name{font-family:var(--serif);font-size:20px;font-weight:700;}
.wait-name span{color:rgba(224,93,123,.9);}
.wait-info{font-size:12px;color:var(--fg3);text-align:center;max-width:260px;line-height:1.7;}
.wait-dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--rose);vertical-align:middle;margin-right:5px;animation:blink 1.5s ease-in-out infinite;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.1}}
.wait-cancel{font-size:12px;color:var(--fg3);cursor:pointer;text-decoration:underline;text-underline-offset:3px;transition:color .2s;}
.wait-cancel:hover{color:var(--fg2);}

/* burst */
.burst{position:fixed;inset:0;z-index:1001;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(11,10,15,.97);animation:burstanim 3s var(--ease) forwards;pointer-events:none;}
@keyframes burstanim{0%,55%{opacity:1}100%{opacity:0}}
.burst-bg{position:absolute;inset:0;overflow:hidden;}
.burst-p{position:absolute;animation:bp linear forwards;opacity:0;}
@keyframes bp{0%{transform:translateY(0) rotate(var(--r)) scale(.5);opacity:0}12%{opacity:.85}100%{transform:translateY(-85vh) rotate(calc(var(--r) + 200deg)) scale(.55);opacity:0}}
.burst-ring{width:104px;height:104px;border-radius:50%;border:1.5px solid var(--rose);display:flex;align-items:center;justify-content:center;animation:pop .6s var(--spring) .1s both;box-shadow:0 0 44px rgba(224,93,123,.45);}
@keyframes pop{from{transform:scale(.15);opacity:0}to{transform:scale(1);opacity:1}}
.burst-icon{font-size:42px;animation:pop .7s var(--spring) .22s both;}
.burst-title{font-family:var(--serif);font-size:clamp(30px,6vw,44px);font-weight:700;margin-top:26px;animation:slideup .7s var(--ease) .36s both;}
.burst-names{font-size:14px;color:var(--fg2);margin-top:6px;animation:slideup .7s var(--ease) .5s both;}
.burst-names span{color:rgba(224,93,123,.9);}
@keyframes slideup{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}

/* ── MAIN APP ── */
.app{height:100vh;overflow-y:scroll;overflow-x:hidden;position:relative;scroll-behavior:smooth;}

/* nav */
.nav{position:fixed;top:0;left:0;right:0;z-index:800;height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(14px,4vw,40px);transition:background .3s,border-color .3s;}
.nav.stuck{background:rgba(11,10,15,.88);backdrop-filter:blur(24px);border-bottom:1px solid var(--line);}
.nav-brand{font-family:var(--italic);font-size:18px;font-style:italic;color:rgba(224,93,123,.85);}
.nav-links{display:flex;gap:2px;list-style:none;}
.nav-link{font-size:11px;font-weight:500;color:var(--fg3);cursor:pointer;padding:4px 9px;border-radius:6px;transition:background .2s,color .2s;}
.nav-link:hover,.nav-link.on{background:rgba(255,255,255,.06);color:var(--fg2);}
@media(max-width:580px){.nav-links{display:none;}}

/* together timer */
.together-pill{position:fixed;top:54px;left:50%;transform:translateX(-50%);z-index:805;background:rgba(17,15,23,.9);border:1px solid var(--line2);border-radius:999px;padding:4px 13px;backdrop-filter:blur(16px);display:flex;align-items:center;gap:7px;font-size:11px;color:var(--fg3);animation:fadeup .4s var(--ease) both;white-space:nowrap;}
.tpill-dot{width:5px;height:5px;border-radius:50%;background:var(--rose);animation:blink 1.5s ease-in-out infinite;}
.tpill-val{font-family:var(--serif);font-size:13px;color:rgba(224,93,123,.9);}

/* partner bar */
.pbar{position:fixed;right:5px;top:0;bottom:0;width:2px;z-index:700;pointer-events:none;}
.pbar-track{position:absolute;inset:0;background:rgba(255,255,255,.04);border-radius:2px;}
.pbar-thumb{position:absolute;left:0;right:0;height:32px;border-radius:2px;background:var(--rose);opacity:.7;box-shadow:0 0 8px rgba(224,93,123,.5);transition:top .5s var(--ease);}
.pcursor{position:fixed;pointer-events:none;z-index:850;transition:left .15s linear,top .15s linear;}
.pcursor-dot{width:11px;height:11px;border-radius:50%;background:var(--rose);border:2px solid rgba(255,255,255,.5);box-shadow:0 0 10px rgba(224,93,123,.7);}
.pcursor-name{margin-top:4px;margin-left:4px;background:rgba(17,15,23,.9);border:1px solid var(--line2);border-radius:6px;padding:2px 7px;font-size:10px;color:var(--fg2);white-space:nowrap;}

/* ribbon */
.ribbon{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:900;background:rgba(17,15,23,.96);border:1px solid rgba(224,93,123,.22);border-radius:999px;padding:7px 12px 7px 10px;display:flex;align-items:center;gap:6px;backdrop-filter:blur(24px);box-shadow:0 0 0 1px rgba(224,93,123,.06) inset,0 10px 36px rgba(0,0,0,.7),0 0 24px rgba(224,93,123,.07);animation:fadeup .4s var(--ease) both;white-space:nowrap;max-width:98vw;}
.rib-ava{width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,var(--rose),#7a1230);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;text-transform:uppercase;}
.rib-lbl{font-size:11px;color:var(--fg2);}
.rib-lbl strong{color:var(--fg);font-weight:600;}
.rib-sep{width:1px;height:16px;background:var(--line2);flex-shrink:0;}
.rib-btns{display:flex;gap:3px;}
.rb{width:27px;height:27px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;transition:background .2s,transform .2s var(--spring);position:relative;flex-shrink:0;}
.rb:hover{background:rgba(255,255,255,.12);transform:scale(1.1);}
.rb.on{background:rgba(224,93,123,.2);border-color:rgba(224,93,123,.38);}
.rb.kiss-on{background:rgba(224,93,123,.32);border-color:rgba(224,93,123,.65);box-shadow:0 0 10px rgba(224,93,123,.45);animation:kanim 1s ease-in-out infinite;}
@keyframes kanim{0%,100%{box-shadow:0 0 8px rgba(224,93,123,.35)}50%{box-shadow:0 0 20px rgba(224,93,123,.75)}}
.rb-badge{position:absolute;top:-4px;right:-4px;width:13px;height:13px;border-radius:50%;background:var(--rose);font-size:7.5px;font-weight:700;display:flex;align-items:center;justify-content:center;}
.rib-exit{font-size:10px;color:var(--fg3);cursor:pointer;padding-left:2px;transition:color .18s;}
.rib-exit:hover{color:#f06060;}
.music-bars{display:flex;align-items:center;gap:1.5px;height:12px;}
.mbar{width:2px;border-radius:1px;background:rgba(224,93,123,.8);animation:mb var(--d,.5s) ease-in-out infinite alternate;}
@keyframes mb{0%{height:2px;opacity:.4}100%{height:var(--h,10px);opacity:.9}}

/* float reactions */
.fr{position:fixed;pointer-events:none;z-index:960;font-size:var(--fs,28px);animation:float var(--dur,2.2s) var(--ease) forwards;}
@keyframes float{0%{opacity:0;transform:translate(-50%,-50%) scale(.3)}12%{opacity:1;transform:translate(-50%,-50%) scale(1.2)}100%{opacity:0;transform:translate(-50%,calc(-50% - 100px)) scale(.65)}}

/* react panel */
.react-row{position:fixed;bottom:68px;left:50%;transform:translateX(-50%);z-index:901;display:flex;gap:5px;background:rgba(17,15,23,.94);border:1px solid var(--line2);border-radius:999px;padding:8px 13px;backdrop-filter:blur(20px);animation:fadeup .25s var(--ease) both;}
.react-em{font-size:21px;cursor:pointer;transition:transform .18s var(--spring);}
.react-em:hover{transform:scale(1.32);}

/* vibe panel */
.vibe-panel{position:fixed;bottom:68px;left:50%;transform:translateX(-50%);z-index:901;background:rgba(17,15,23,.96);border:1px solid var(--line2);border-radius:20px;padding:13px 14px 11px;backdrop-filter:blur(22px);min-width:200px;animation:fadeup .25s var(--ease) both;}
.vibe-title{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--fg3);text-align:center;margin-bottom:8px;}
.vibe-opts{display:flex;flex-direction:column;gap:4px;}
.vibe-opt{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:11px;cursor:pointer;border:1px solid transparent;transition:background .18s,transform .18s var(--spring);}
.vibe-opt:hover{background:rgba(255,255,255,.05);transform:scale(1.02);}
.vibe-em{font-size:17px;}
.vibe-lbl{font-size:12px;font-weight:500;color:var(--fg2);}
.vibe-ripple-wrap{position:fixed;inset:0;z-index:970;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:11px;}
.vibe-ring{position:absolute;border-radius:50%;border:1.5px solid;animation:vring var(--vd,1.5s) ease-out forwards;border-color:var(--vc,rgba(224,93,123,.5));}
@keyframes vring{0%{width:0;height:0;opacity:.85;transform:translate(-50%,-50%)}100%{width:75vmax;height:75vmax;opacity:0;transform:translate(-50%,-50%)}}
.vibe-icon{font-size:50px;animation:pop .4s var(--spring) both;filter:drop-shadow(0 0 24px var(--vc,rgba(224,93,123,.7)));}
.vibe-text{font-family:var(--serif);font-size:clamp(17px,3.5vw,24px);font-weight:700;animation:slideup .45s var(--ease) .1s both;}
.vibe-sub{font-size:12px;color:var(--fg3);animation:slideup .45s var(--ease) .22s both;}

/* kiss */
.kiss-wrap{position:fixed;inset:0;z-index:950;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;}
.kiss-box{background:rgba(17,15,23,.92);border:1px solid rgba(224,93,123,.3);border-radius:22px;padding:16px 28px;text-align:center;backdrop-filter:blur(20px);animation:fadeup .35s var(--ease) both;box-shadow:0 0 50px rgba(224,93,123,.2);}
.kiss-em{font-size:40px;display:block;margin-bottom:7px;animation:pulse 1s ease-in-out infinite;}
.kiss-t{font-family:var(--serif);font-size:48px;font-weight:700;letter-spacing:-.04em;line-height:1;background:linear-gradient(135deg,rgba(224,93,123,.9),var(--rose2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.kiss-l{font-size:10px;color:var(--fg3);margin-top:3px;letter-spacing:.07em;text-transform:uppercase;}
.kiss-wait{font-size:13px;color:var(--fg3);background:rgba(17,15,23,.9);border:1px solid var(--line2);border-radius:18px;padding:11px 20px;text-align:center;backdrop-filter:blur(16px);}
.kiss-wait strong{color:rgba(224,93,123,.85);}
.kiss-toast{position:fixed;top:62px;left:50%;transform:translateX(-50%);z-index:910;background:rgba(17,15,23,.95);border:1px solid rgba(224,93,123,.28);border-radius:13px;padding:9px 18px;font-size:12px;color:var(--fg2);animation:fadeup .3s var(--ease) both,fadeout 2.5s var(--ease) 1.5s forwards;pointer-events:none;white-space:nowrap;}
@keyframes fadeout{to{opacity:0}}
.kiss-toast strong{color:rgba(224,93,123,.85);}

/* surprise */
.surprise-bg{position:fixed;inset:0;z-index:990;display:flex;align-items:center;justify-content:center;background:rgba(11,10,15,.95);backdrop-filter:blur(10px);animation:fadeup .5s var(--ease) both;}
.surprise-card{width:min(370px,90vw);background:var(--card);border:1px solid rgba(224,93,123,.22);border-radius:28px;padding:40px 30px 32px;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,.75);animation:pop .65s var(--spring) .15s both;position:relative;overflow:hidden;}
.surp-bg-blur{position:absolute;inset:0;border-radius:28px;background:radial-gradient(ellipse at 50% 0%,rgba(224,93,123,.1),transparent 60%);pointer-events:none;}
.surp-em{font-size:32px;display:block;margin-bottom:14px;animation:pulse 2s ease-in-out infinite;}
.surp-t{font-family:var(--serif);font-size:clamp(17px,4vw,24px);font-weight:700;color:rgba(224,93,123,.9);margin-bottom:11px;}
.surp-msg{font-family:var(--italic);font-size:clamp(14px,2.2vw,19px);font-style:italic;font-weight:300;color:var(--fg2);line-height:1.8;margin-bottom:18px;}
.surp-from{font-size:11px;color:var(--fg3);margin-bottom:20px;letter-spacing:.05em;}
.surp-btn{padding:10px 26px;border-radius:999px;background:linear-gradient(135deg,var(--rose),var(--rose2));color:#fff;font-family:var(--sans);font-size:12px;font-weight:600;border:none;cursor:pointer;transition:transform .18s var(--spring);}
.surp-btn:hover{transform:scale(1.04);}

/* chat panel */
.chat{position:fixed;bottom:66px;right:18px;z-index:902;width:min(280px,86vw);background:rgba(17,15,23,.97);border:1px solid var(--line2);border-radius:20px;backdrop-filter:blur(26px);box-shadow:0 14px 50px rgba(0,0,0,.6);overflow:hidden;display:flex;flex-direction:column;animation:fadeup .25s var(--ease) both;}
.chat-hd{padding:10px 12px 9px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;}
.chat-hd-t{font-family:var(--serif);font-size:13px;font-weight:700;}
.chat-hd-s{font-size:10px;color:var(--fg3);}
.chat-x{width:21px;height:21px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:9px;color:var(--fg3);}
.chat-body{flex:1;overflow-y:auto;padding:9px;display:flex;flex-direction:column;gap:6px;max-height:180px;min-height:40px;}
.chat-bubble{max-width:85%;padding:6px 10px;border-radius:13px;font-size:11px;line-height:1.55;animation:fadeup .2s var(--ease) both;}
.chat-bubble.me{align-self:flex-end;background:linear-gradient(135deg,var(--rose),var(--rose2));color:#fff;border-bottom-right-radius:3px;}
.chat-bubble.them{align-self:flex-start;background:rgba(255,255,255,.08);border:1px solid var(--line);border-bottom-left-radius:3px;}
.chat-who{font-size:8.5px;font-weight:700;opacity:.55;margin-bottom:2px;letter-spacing:.04em;text-transform:uppercase;}
.chat-empty{font-size:11px;color:var(--fg3);text-align:center;padding:12px 0;line-height:1.7;}
.chat-input-row{display:flex;gap:5px;padding:7px 9px;border-top:1px solid var(--line);}
.chat-inp{flex:1;background:rgba(255,255,255,.05);border:1px solid var(--line2);border-radius:10px;padding:7px 9px;color:var(--fg);font-family:var(--sans);font-size:11px;outline:none;}
.chat-inp:focus{border-color:rgba(224,93,123,.45);}
.chat-inp::placeholder{color:var(--fg3);}
.chat-send{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--rose),var(--rose2));border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:transform .18s var(--spring);}
.chat-send:hover:not(:disabled){transform:scale(1.08);}
.chat-send:disabled{opacity:.3;cursor:not-allowed;}
.chat-mic{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.07);border:1px solid var(--line2);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;flex-shrink:0;transition:background .2s;}
.chat-mic.rec{background:rgba(224,93,123,.25);border-color:rgba(224,93,123,.55);animation:kanim 1s ease-in-out infinite;}
.voice-play{display:flex;align-items:center;gap:7px;}
.vp-btn{width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.15);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.vp-bars{flex:1;height:22px;display:flex;align-items:center;gap:1.5px;}
.vp-bar{flex:1;max-width:3px;border-radius:2px;background:rgba(255,255,255,.3);transition:height .1s;}
.vp-dur{font-size:9px;opacity:.6;white-space:nowrap;}

/* ── SECTIONS ── */
.page{height:100svh;overflow-y:auto;position:relative;}

/* hero */
.hero{min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px clamp(20px,5vw,60px) 100px;position:relative;}
.hero-bg{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 70% 50% at 50% 28%,rgba(224,93,123,.10) 0%,transparent 58%),radial-gradient(ellipse 45% 35% at 75% 75%,rgba(201,164,78,.07) 0%,transparent 52%);}
.hero-eyebrow{font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--rose);margin-bottom:14px;display:block;}
.hero-h{font-family:var(--serif);font-size:clamp(52px,10vw,120px);font-weight:700;letter-spacing:-.04em;line-height:.92;margin-bottom:12px;background:linear-gradient(160deg,var(--fg) 35%,rgba(240,235,232,.4));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.hero-sub{font-family:var(--italic);font-size:clamp(15px,2.3vw,22px);font-style:italic;font-weight:300;color:var(--fg2);margin-bottom:34px;max-width:440px;}
.hero-stats{display:flex;gap:clamp(20px,5vw,56px);justify-content:center;flex-wrap:wrap;margin-bottom:44px;}
.hero-stat-n{font-family:var(--serif);font-size:clamp(32px,5.5vw,56px);font-weight:700;letter-spacing:-.04em;line-height:1;color:rgba(224,93,123,.9);}
.hero-stat-l{font-size:10px;color:var(--fg3);margin-top:3px;letter-spacing:.07em;text-transform:uppercase;}
.hero-btns{display:flex;gap:9px;justify-content:center;flex-wrap:wrap;}
.btn-filled{padding:12px 26px;border-radius:999px;background:linear-gradient(135deg,var(--rose),var(--rose2));color:#fff;font-family:var(--sans);font-size:13px;font-weight:600;border:none;cursor:pointer;box-shadow:0 5px 20px rgba(224,93,123,.28);transition:opacity .18s,transform .18s var(--spring);}
.btn-outline{padding:12px 26px;border-radius:999px;background:transparent;color:var(--fg2);font-family:var(--sans);font-size:13px;font-weight:500;border:1.5px solid rgba(255,255,255,.16);cursor:pointer;transition:opacity .18s,transform .18s var(--spring);}
.btn-filled:hover,.btn-outline:hover{opacity:.84;transform:scale(1.02);}
.scroll-cue{position:absolute;bottom:86px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:5px;animation:slideup 1s var(--ease) 2s both;}
.scroll-cue-line{width:1px;height:38px;background:linear-gradient(180deg,transparent,var(--rose));animation:shline 1.8s ease-in-out infinite;}
@keyframes shline{0%,100%{opacity:.25;transform:scaleY(.5)}50%{opacity:.9;transform:scaleY(1)}}

/* section layout */
.sec{padding:clamp(60px,9vw,110px) clamp(20px,5vw,56px);}
.sec-inner{max-width:860px;margin:0 auto;text-align:center;}
.eyebrow{font-size:10px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;color:var(--rose);display:block;margin-bottom:11px;}
.sec-h{font-family:var(--serif);font-size:clamp(26px,4.8vw,52px);font-weight:700;letter-spacing:-.03em;line-height:1.06;margin-bottom:10px;}
.sec-h em{font-family:var(--italic);font-style:italic;color:var(--fg2);}
.sec-p{font-size:clamp(13px,1.7vw,16px);font-weight:300;color:var(--fg2);line-height:1.75;max-width:480px;margin:0 auto 36px;}
.hr{height:1px;background:linear-gradient(90deg,transparent,var(--line2),transparent);margin:0 clamp(18px,5vw,56px);}

/* love timer */
.ltd{display:flex;gap:clamp(10px,2.5vw,28px);justify-content:center;flex-wrap:wrap;margin-bottom:28px;}
.ltd-unit{text-align:center;}
.ltd-n{font-family:var(--serif);font-size:clamp(40px,7.5vw,80px);font-weight:700;letter-spacing:-.04em;line-height:1;background:linear-gradient(135deg,rgba(224,93,123,.9),var(--rose2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.ltd-l{font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--fg3);margin-top:3px;}
.ltd-col{font-family:var(--serif);font-size:clamp(36px,6.5vw,70px);font-weight:300;color:rgba(224,93,123,.2);line-height:1;align-self:flex-start;margin-top:2px;}
.date-row{display:inline-flex;align-items:center;gap:12px;background:rgba(255,255,255,.03);border:1px solid var(--line2);border-radius:var(--r16);padding:14px 20px;}
.date-row-l{font-size:11px;color:var(--fg3);}
.date-inp{background:transparent;border:none;color:rgba(224,93,123,.85);font-family:var(--sans);font-size:13px;font-weight:600;outline:none;cursor:pointer;}
.date-inp::-webkit-calendar-picker-indicator{filter:invert(.4) sepia(1) saturate(2) hue-rotate(280deg);cursor:pointer;}
.milestones{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:20px;}
.ms{padding:5px 14px;border-radius:999px;font-size:11px;font-weight:500;background:rgba(255,255,255,.04);border:1px solid var(--line);color:var(--fg3);}
.ms.hit{background:rgba(224,93,123,.1);border-color:rgba(224,93,123,.25);color:rgba(224,93,123,.8);}

/* calendar */
.cal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:11px;margin-bottom:20px;text-align:left;}
.cal-card{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:var(--r16);padding:14px 16px;transition:border-color .25s,transform .2s var(--spring);animation:fadeup .3s var(--ease) both;}
.cal-card:hover{border-color:var(--line2);transform:translateY(-2px);}
.cal-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;}
.cal-em{font-size:20px;}
.cal-date{font-size:10px;font-weight:600;letter-spacing:.06em;color:var(--gold);text-transform:uppercase;}
.cal-t{font-size:14px;font-weight:600;color:var(--fg);line-height:1.3;}
.cal-desc{font-size:11px;color:var(--fg3);margin-top:3px;line-height:1.5;}
.cal-cd{font-size:10px;margin-top:8px;font-weight:600;}
.cal-cd.soon{color:var(--rose);}
.cal-cd.near{color:var(--gold);}
.cal-cd.far{color:var(--fg3);}
.cal-cd.today{color:var(--green);}
.add-form{display:flex;flex-direction:column;gap:7px;max-width:480px;margin-inline:auto;margin-top:8px;}
.row{display:flex;gap:7px;}
.em-row{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;}
.em-opt{font-size:17px;cursor:pointer;padding:4px;border-radius:8px;transition:background .18s,transform .18s var(--spring);}
.em-opt:hover{background:rgba(255,255,255,.08);transform:scale(1.2);}
.em-opt.sel{background:rgba(224,93,123,.18);}
.add-inp{flex:1;background:rgba(255,255,255,.04);border:1px solid var(--line2);border-radius:var(--r12);padding:10px 12px;color:var(--fg);font-family:var(--sans);font-size:13px;outline:none;transition:border-color .2s;}
.add-inp:focus{border-color:rgba(224,93,123,.48);}
.add-inp::placeholder{color:var(--fg3);}
.add-inp-date{color:var(--fg2);}
.add-inp-date::-webkit-calendar-picker-indicator{filter:invert(.4);}
.add-btn{padding:10px 20px;border-radius:var(--r12);background:linear-gradient(135deg,var(--rose),var(--rose2));color:#fff;font-family:var(--sans);font-size:12px;font-weight:600;border:none;cursor:pointer;white-space:nowrap;transition:opacity .18s,transform .18s var(--spring);}
.add-btn:hover:not(:disabled){opacity:.86;transform:scale(1.02);}
.add-btn:disabled{opacity:.25;cursor:not-allowed;}

/* moments */
.moments-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:11px;margin-bottom:20px;text-align:left;}
.mom-card{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:var(--r16);padding:14px 16px;animation:fadeup .3s var(--ease) both;transition:border-color .25s,transform .2s var(--spring);}
.mom-card:hover{border-color:var(--line2);transform:translateY(-2px);}
.mom-em{font-size:18px;display:block;margin-bottom:6px;}
.mom-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
.mom-who{font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(224,93,123,.65);}
.mom-date{font-size:9px;color:var(--fg3);}
.mom-txt{font-size:12.5px;color:var(--fg2);line-height:1.65;}
.mom-tag{display:inline-block;margin-top:7px;padding:2px 8px;border-radius:6px;font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;}
.mom-tag.happy{background:rgba(224,93,123,.12);color:rgba(224,93,123,.8);}
.mom-tag.tender{background:rgba(201,164,78,.12);color:rgba(201,164,78,.8);}
.mom-tag.funny{background:rgba(91,191,212,.12);color:rgba(91,191,212,.8);}
.mom-tag.important{background:rgba(191,90,242,.12);color:rgba(191,90,242,.8);}
.tag-picker{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;}
.tag-opt{padding:5px 12px;border-radius:999px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid transparent;transition:all .2s;}
.tag-opt.happy{background:rgba(224,93,123,.07);color:rgba(224,93,123,.7);border-color:rgba(224,93,123,.15);}
.tag-opt.tender{background:rgba(201,164,78,.07);color:rgba(201,164,78,.7);border-color:rgba(201,164,78,.15);}
.tag-opt.funny{background:rgba(91,191,212,.07);color:rgba(91,191,212,.7);border-color:rgba(91,191,212,.15);}
.tag-opt.important{background:rgba(191,90,242,.07);color:rgba(191,90,242,.7);border-color:rgba(191,90,242,.15);}
.tag-opt.sel{transform:scale(1.06);box-shadow:0 0 10px rgba(255,255,255,.08);}

/* dreams */
.dreams-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:28px;text-align:left;}
@media(max-width:560px){.dreams-cols{grid-template-columns:1fr;}}
.dream-col{background:rgba(255,255,255,.02);border:1px solid var(--line);border-radius:var(--r20);padding:18px;}
.dream-col-h{font-family:var(--serif);font-size:15px;font-weight:700;margin-bottom:13px;display:flex;align-items:center;gap:7px;}
.dream-item{display:flex;align-items:flex-start;gap:9px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.04);}
.dream-item:last-of-type{border-bottom:none;}
.dream-star{font-size:13px;flex-shrink:0;margin-top:1px;}
.dream-text{font-size:12.5px;color:var(--fg2);line-height:1.55;flex:1;}
.dream-done{text-decoration:line-through;opacity:.4;}
.dream-check{width:16px;height:16px;border-radius:4px;border:1.5px solid var(--line2);background:transparent;cursor:pointer;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;transition:background .2s,border-color .2s;}
.dream-check.done{background:var(--green);border-color:var(--green);}
.dream-add-row{display:flex;gap:6px;margin-top:12px;}

/* wishes */
.wish-tabs{display:inline-flex;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:var(--r12);padding:3px;gap:2px;margin-bottom:24px;}
.wish-tab{padding:6px 16px;border-radius:10px;font-size:11px;font-weight:600;color:var(--fg3);cursor:pointer;transition:all .2s;}
.wish-tab.on{background:rgba(224,93,123,.18);color:rgba(224,93,123,.9);border:1px solid rgba(224,93,123,.25);}
.wishes-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:20px;text-align:left;}
.wish-card{border-radius:var(--r16);padding:13px 15px;animation:fadeup .3s var(--ease) both;transition:transform .2s var(--spring),border-color .2s;}
.wish-card:hover{transform:scale(1.02);}
.wish-card.mine{background:rgba(224,93,123,.06);border:1px solid rgba(224,93,123,.15);}
.wish-card.theirs{background:rgba(255,255,255,.03);border:1px solid var(--line);}
.wish-card.done{opacity:.45;filter:grayscale(.5);}
.wish-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
.wish-by{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(224,93,123,.55);}
.wish-t{font-size:13.5px;font-weight:600;line-height:1.3;}
.wish-d{font-size:11px;color:var(--fg3);margin-top:3px;line-height:1.5;}
.wish-prio{display:inline-block;margin-top:6px;font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px;text-transform:uppercase;letter-spacing:.05em;}
.wish-prio.high{background:rgba(224,93,123,.12);color:rgba(224,93,123,.8);}
.wish-prio.med{background:rgba(201,164,78,.12);color:rgba(201,164,78,.8);}
.wish-prio.low{background:rgba(255,255,255,.06);color:var(--fg3);}
.wish-fulfill{margin-top:10px;padding:5px 11px;border-radius:8px;background:linear-gradient(135deg,var(--rose),var(--rose2));color:#fff;font-size:10px;font-weight:600;border:none;cursor:pointer;transition:opacity .18s;}
.wish-fulfill:hover{opacity:.82;}
.wish-done-lbl{margin-top:8px;font-size:10px;color:var(--green);font-weight:600;}
.prio-picker{display:flex;gap:5px;justify-content:center;}
.prio-opt{padding:5px 13px;border-radius:999px;font-size:10px;font-weight:600;cursor:pointer;border:1px solid transparent;transition:all .2s;}
.prio-opt.high{background:rgba(224,93,123,.07);color:rgba(224,93,123,.65);border-color:rgba(224,93,123,.14);}
.prio-opt.med{background:rgba(201,164,78,.07);color:rgba(201,164,78,.65);border-color:rgba(201,164,78,.14);}
.prio-opt.low{background:rgba(255,255,255,.04);color:var(--fg3);border-color:var(--line);}
.prio-opt.sel{transform:scale(1.06);box-shadow:0 0 10px rgba(255,255,255,.07);}

/* travel */
.travel-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:11px;margin-bottom:20px;text-align:left;}
.travel-card{border-radius:var(--r16);padding:15px 16px;animation:fadeup .3s var(--ease) both;cursor:pointer;transition:transform .2s var(--spring);}
.travel-card:hover{transform:scale(1.02);}
.travel-card.dream{background:rgba(91,191,212,.05);border:1px solid rgba(91,191,212,.14);}
.travel-card.planning{background:rgba(201,164,78,.06);border:1px solid rgba(201,164,78,.18);}
.travel-card.been{background:rgba(39,196,110,.05);border:1px solid rgba(39,196,110,.16);}
.travel-stat-badge{display:inline-block;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:2px 8px;border-radius:999px;margin-bottom:8px;}
.travel-stat-badge.dream{background:rgba(91,191,212,.1);color:var(--teal);}
.travel-stat-badge.planning{background:rgba(201,164,78,.12);color:var(--gold);}
.travel-stat-badge.been{background:rgba(39,196,110,.1);color:var(--green);}
.travel-flag{font-size:26px;display:block;margin-bottom:5px;}
.travel-place{font-size:14px;font-weight:700;line-height:1.3;}
.travel-note{font-size:11px;color:var(--fg3);margin-top:3px;line-height:1.5;}
.travel-who{font-size:9px;color:rgba(224,93,123,.45);font-weight:600;margin-top:7px;text-transform:uppercase;letter-spacing:.05em;}
.travel-hint{font-size:9.5px;color:var(--fg3);margin-top:5px;font-style:italic;}
.status-picker{display:flex;gap:5px;justify-content:center;}
.sopt{padding:5px 12px;border-radius:999px;font-size:10px;font-weight:600;cursor:pointer;border:1px solid transparent;transition:all .2s;}
.sopt.dream{background:rgba(91,191,212,.07);color:var(--teal);border-color:rgba(91,191,212,.14);}
.sopt.planning{background:rgba(201,164,78,.07);color:var(--gold);border-color:rgba(201,164,78,.14);}
.sopt.been{background:rgba(39,196,110,.07);color:var(--green);border-color:rgba(39,196,110,.14);}
.sopt.sel{transform:scale(1.06);}
.travel-counts{display:flex;gap:16px;justify-content:center;margin-bottom:24px;flex-wrap:wrap;}
.tcount{text-align:center;}
.tcount-n{font-family:var(--serif);font-size:32px;font-weight:700;letter-spacing:-.03em;}
.tcount-n.dream{color:var(--teal);}
.tcount-n.planning{color:var(--gold);}
.tcount-n.been{color:var(--green);}
.tcount-l{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:var(--fg3);margin-top:2px;}

/* promises */
.prom-list{display:flex;flex-direction:column;gap:8px;max-width:600px;margin-inline:auto;margin-bottom:20px;text-align:left;}
.prom-item{display:flex;align-items:flex-start;gap:11px;padding:13px 15px;border-radius:var(--r16);border:1px solid var(--line);background:rgba(255,255,255,.02);animation:fadeup .3s var(--ease) both;transition:border-color .2s,transform .2s var(--spring);}
.prom-item:hover{border-color:var(--line2);transform:translateX(3px);}
.prom-em{font-size:17px;flex-shrink:0;margin-top:1px;}
.prom-content{flex:1;}
.prom-text{font-size:13.5px;color:var(--fg2);line-height:1.6;}
.prom-who{font-size:9px;color:rgba(224,93,123,.5);font-weight:600;margin-top:3px;text-transform:uppercase;letter-spacing:.05em;}
.prom-check{width:18px;height:18px;border-radius:5px;border:1.5px solid var(--line2);background:transparent;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .2s;margin-top:1px;}
.prom-check.done{background:var(--rose);border-color:var(--rose);}
.prom-add-row{display:flex;gap:7px;max-width:600px;margin-inline:auto;}

/* footer */
.foot{border-top:1px solid var(--line);padding:26px clamp(20px,5vw,56px);text-align:center;}
.foot-t{font-size:10px;color:rgba(255,255,255,.12);line-height:1.75;}
`;

/* ══════════════════════════════════════════════════════
   ATOMS
══════════════════════════════════════════════════════ */
const VIBE_PATTERNS = [
  {id:"tap",   emoji:"👆",label:"Лёгкое касание", pattern:[60],              color:"rgba(201,164,78,.8)"},
  {id:"heart", emoji:"💓",label:"Сердцебиение",   pattern:[120,80,120],      color:"rgba(224,93,123,.8)"},
  {id:"fire",  emoji:"🔥",label:"Страсть",        pattern:[200,80,200,80,400],color:"rgba(224,130,74,.8)"},
  {id:"miss",  emoji:"💌",label:"Думаю о тебе",   pattern:[80,50,80,50,300],  color:"rgba(91,191,212,.8)"},
];
const REACTS = ["❤️","💕","🌹","😍","✨","🫶","💋","🥰","💖","🔥"];

function Petals() {
  return <>{Array.from({length:12},(_,i)=>(
    <div key={i} className="petal" style={{left:`${5+Math.random()*90}%`,width:`${6+Math.random()*10}px`,height:`${4+Math.random()*8}px`,top:"-20px",background:["rgba(224,93,123,.15)","rgba(201,164,78,.12)","rgba(224,93,123,.08)"][i%3],animationDuration:`${12+Math.random()*16}s`,animationDelay:`${Math.random()*15}s`}}/>
  ))}</>;
}
function BurstPetals() {
  return <div className="burst-bg">{Array.from({length:22},(_,i)=>(
    <div key={i} className="burst-p" style={{left:`${5+Math.random()*90}%`,top:`${55+Math.random()*35}%`,fontSize:`${14+Math.random()*20}px`,"--r":`${Math.random()*60-30}deg`,animationDuration:`${2+Math.random()*2.2}s`,animationDelay:`${Math.random()*.85}s`}}>{"❤️💕🌹✨💖🫶💋🥰"[i%8]}</div>
  ))}</div>;
}
function FloatReact({emoji,x,y,onDone}) {
  const dur = 2.2+Math.random()*.8, fs = 24+Math.random()*18;
  useEffect(()=>{const t=setTimeout(onDone,(dur+.1)*1000);return()=>clearTimeout(t);},[]);
  return <div className="fr" style={{left:x,top:y,"--fs":`${fs}px`,"--dur":`${dur}s`}}>{emoji}</div>;
}
function MusicBars() {
  return <div className="music-bars">{[10,5,9,3,8,6,11].map((h,i)=><div key={i} className="mbar" style={{"--h":`${h}px`,"--d":`${.26+i*.09}s`}}/>)}</div>;
}
function TogetherTimer({t0}) {
  const [e,se]=useState(0);
  useEffect(()=>{const iv=setInterval(()=>se(Math.floor((Date.now()-t0)/1000)),1000);return()=>clearInterval(iv);},[t0]);
  const m=Math.floor(e/60),s=e%60;
  return <div className="together-pill"><div className="tpill-dot"/><span>Вместе</span><span className="tpill-val">{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</span></div>;
}
function LoveTimer({start}) {
  const [d,sd]=useState({});
  useEffect(()=>{
    const calc=()=>{ const ms=Date.now()-new Date(start).getTime(); if(ms<0){sd({});return;} sd({d:Math.floor(ms/86400000),h:Math.floor(ms%86400000/3600000),m:Math.floor(ms%3600000/60000),s:Math.floor(ms%60000/1000)}); };
    calc(); const iv=setInterval(calc,1000); return()=>clearInterval(iv);
  },[start]);
  if(!d.d&&d.d!==0) return null;
  return <div className="ltd">{[["d","дней"],["h","часов"],["m","минут"],["s","секунд"]].map(([k,l],i,a)=>(<div key={k} style={{display:"flex",alignItems:"center",gap:i<a.length-1?"clamp(10px,2vw,28px)":0}}><div className="ltd-unit"><div className="ltd-n">{String(d[k]).padStart(2,"0")}</div><div className="ltd-l">{l}</div></div>{i<a.length-1&&<div className="ltd-col">:</div>}</div>))}</div>;
}
const base64ToBlob=(b64,t)=>{const bin=atob(b64);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:t});};
function VoicePlayer({data,dur}) {
  const [p,sp]=useState(false);const ar=useRef(null);
  useEffect(()=>{if(!data)return;const blob=base64ToBlob(data,"audio/webm");const url=URL.createObjectURL(blob);const audio=new Audio(url);audio.onended=()=>sp(false);ar.current=audio;return()=>{audio.pause();URL.revokeObjectURL(url);};},[data]);
  const toggle=()=>{const a=ar.current;if(!a)return;if(p){a.pause();a.currentTime=0;sp(false);}else{a.play();sp(true);}};
  const bars=Array.from({length:14},()=>Math.max(4,Math.sin(Math.random()*3)*10+Math.random()*6+4));
  const fmt=s=>`0:${String(Math.round(s||0)).padStart(2,"0")}`;
  return <div className="voice-play"><button className="vp-btn" onClick={toggle}>{p?<svg width="9" height="9"><rect x="1" y="1" width="3" height="7" rx="1" fill="white"/><rect x="5" y="1" width="3" height="7" rx="1" fill="white"/></svg>:<svg width="9" height="9"><path d="M2 1l6 3.5-6 3.5V1z" fill="white"/></svg>}</button><div className="vp-bars">{bars.map((h,i)=><div key={i} className="vp-bar" style={{height:p?`${h}px`:"3px"}}/>)}</div><span className="vp-dur">{fmt(dur)}</span></div>;
}

/* ══════════════════════════════════════════════════════
   CALENDAR SECTION
══════════════════════════════════════════════════════ */
const CAL_EMOJIS=["💍","🌹","🎂","✈️","🏠","💑","🎁","⭐","🥂","🌙","🎭","🌺"];
function daysUntil(ds){const now=new Date();now.setHours(0,0,0,0);const d=new Date(ds);const nx=new Date(now.getFullYear(),d.getMonth(),d.getDate());if(nx<now)nx.setFullYear(now.getFullYear()+1);return Math.round((nx-now)/86400000);}
function CalSec({pair,me}) {
  const coll=dbColl("duo_calendar",pair);
  const [evs,sEvs]=useState([]);
  const [t,sT]=useState("");const [dt,sDt]=useState("");const [desc,sDesc]=useState("");const [em,sEm]=useState("💍");
  useEffect(()=>{coll.load().then(sEvs);},[]);
  useEffect(()=>{const iv=setInterval(()=>coll.load().then(sEvs),6000);return()=>clearInterval(iv);},[]);
  const add=async()=>{if(!t.trim()||!dt)return;const ev={id:Date.now(),title:t.trim(),date:dt,desc:desc.trim(),emoji:em,by:me};const u=[...evs,ev].sort((a,b)=>daysUntil(a.date)-daysUntil(b.date));sEvs(u);await coll.save(u);sT("");sDt("");sDesc("");};
  const cdClass=n=>n===0?"today":n<=7?"soon":n<=30?"near":"far";
  const cdText=n=>n===0?"🎉 Сегодня!":n===1?"Завтра!":`через ${n} дн.`;
  return (
    <div className="sec" id="calendar" style={{background:"rgba(255,255,255,.01)"}}>
      <div className="sec-inner">
        <span className="eyebrow">Важные даты</span>
        <h2 className="sec-h">Наш <em>календарь</em></h2>
        <p className="sec-p">Годовщины, путешествия, особые события — всё вместе.</p>
        <div className="cal-grid">
          {evs.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"28px",color:"var(--fg3)",fontSize:12}}>Добавьте первую важную дату 💍</div>}
          {evs.map(ev=><div key={ev.id} className="cal-card"><div className="cal-card-top"><span className="cal-em">{ev.emoji}</span><span className="cal-date">{new Date(ev.date).toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}</span></div><div className="cal-t">{ev.title}</div>{ev.desc&&<div className="cal-desc">{ev.desc}</div>}<div className={`cal-cd ${cdClass(daysUntil(ev.date))}`}>{cdText(daysUntil(ev.date))}</div></div>)}
        </div>
        <div className="add-form">
          <div className="em-row">{CAL_EMOJIS.map(e=><span key={e} className={`em-opt ${em===e?"sel":""}`} onClick={()=>sEm(e)}>{e}</span>)}</div>
          <div className="row"><input className="add-inp" placeholder="Название события" value={t} onChange={e=>sT(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/><input className="add-inp add-inp-date" type="date" value={dt} onChange={e=>sDt(e.target.value)} style={{width:140,flexShrink:0}}/></div>
          <div className="row"><input className="add-inp" placeholder="Описание (необязательно)" value={desc} onChange={e=>sDesc(e.target.value)}/><button className="add-btn" disabled={!t.trim()||!dt} onClick={add}>+ Добавить</button></div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MOMENTS SECTION
══════════════════════════════════════════════════════ */
const MOM_EMOJIS=["🌹","💕","✨","😍","🥰","💋","🫶","🌙","☕","🎵","🌊","🏔️","🎭","💌","🎉","🌸"];
const TAGS=[{id:"happy",l:"Счастье"},{id:"tender",l:"Нежность"},{id:"funny",l:"Смешно"},{id:"important",l:"Важно"}];
function MomSec({pair,me}) {
  const coll=dbColl("duo_moments",pair);
  const [items,sI]=useState([]);
  const [txt,sT]=useState("");const [em,sE]=useState("🌹");const [tag,sTag]=useState("happy");
  useEffect(()=>{coll.load().then(sI);},[]);
  useEffect(()=>{const iv=setInterval(()=>coll.load().then(sI),5000);return()=>clearInterval(iv);},[]);
  const add=async()=>{if(!txt.trim())return;const m={id:Date.now(),text:txt.trim(),emoji:em,tag,by:me,ts:Date.now()};const u=[m,...items];sI(u);await coll.save(u);sT("");};
  const fmt=ts=>new Date(ts).toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"});
  return (
    <div className="sec" id="moments">
      <div className="sec-inner">
        <span className="eyebrow">Воспоминания</span>
        <h2 className="sec-h">Моменты, <em>которые остаются</em></h2>
        <p className="sec-p">Ваш личный архив — первое свидание, смешные случаи, нежные слова.</p>
        <div className="add-form">
          <div className="em-row">{MOM_EMOJIS.map(e=><span key={e} className={`em-opt ${em===e?"sel":""}`} onClick={()=>sE(e)}>{e}</span>)}</div>
          <div className="tag-picker">{TAGS.map(t=><div key={t.id} className={`tag-opt ${t.id} ${tag===t.id?"sel":""}`} onClick={()=>sTag(t.id)}>{t.l}</div>)}</div>
          <textarea className="textarea" placeholder="Запиши момент…" value={txt} onChange={e=>sT(e.target.value)}/>
          <div className="row" style={{justifyContent:"flex-end"}}><button className="add-btn" disabled={!txt.trim()} onClick={add}>Сохранить</button></div>
        </div>
        <div className="moments-grid">
          {items.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"28px",color:"var(--fg3)",fontSize:12}}>Сохраните первый момент 🌹</div>}
          {items.map(m=><div key={m.id} className="mom-card"><span className="mom-em">{m.emoji}</span><div className="mom-top"><span className="mom-who">@{norm(m.by)}</span><span className="mom-date">{fmt(m.ts)}</span></div><div className="mom-txt">{m.text}</div>{m.tag&&<span className={`mom-tag ${m.tag}`}>{TAGS.find(t=>t.id===m.tag)?.l||m.tag}</span>}</div>)}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   DREAMS SECTION
══════════════════════════════════════════════════════ */
function DreamsSec({me,partner}) {
  const myDb=dbUser("duo_dreams",me);const ptDb=dbUser("duo_dreams",partner);
  const [my,sMy]=useState([]);const [pt,sPt]=useState([]);
  const [inp,sI]=useState("");
  useEffect(()=>{myDb.load().then(sMy);ptDb.load().then(sPt);},[]);
  useEffect(()=>{const iv=setInterval(()=>{myDb.load().then(sMy);ptDb.load().then(sPt);},6000);return()=>clearInterval(iv);},[]);
  const add=async()=>{if(!inp.trim())return;const u=[...my,{id:Date.now(),text:inp.trim(),done:false}];sMy(u);await myDb.save(u);sI("");};
  const toggle=async(id)=>{const u=my.map(d=>d.id===id?{...d,done:!d.done}:d);sMy(u);await myDb.save(u);};
  const DreamCol=({title,em,items,isMe})=>(
    <div className="dream-col">
      <div className="dream-col-h"><span>{em}</span>{title}</div>
      {items.length===0&&<p style={{fontSize:11,color:"var(--fg3)",lineHeight:1.7}}>Мечты пока не добавлены…</p>}
      {items.map(d=><div key={d.id} className="dream-item">
        {isMe?<div className={`dream-check ${d.done?"done":""}`} onClick={()=>toggle(d.id)}>{d.done&&<svg width="9" height="7"><path d="M1 3.5L3.5 6 8 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>  </svg>}</div>:<span className="dream-star">{d.done?"✅":"✨"}</span>}
        <span className={`dream-text ${d.done?"dream-done":""}`}>{d.text}</span>
      </div>)}
      {isMe&&<div className="dream-add-row"><input className="add-inp" placeholder="Добавить мечту…" value={inp} onChange={e=>sI(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/><button className="add-btn" disabled={!inp.trim()} onClick={add}>+</button></div>}
    </div>
  );
  return (
    <div className="sec" id="dreams" style={{background:"rgba(255,255,255,.01)"}}>
      <div className="sec-inner">
        <span className="eyebrow">Мечты</span>
        <h2 className="sec-h">То, о чём <em>мы мечтаем</em></h2>
        <p className="sec-p">Каждый пишет своё — и оба видят мечты друг друга. Можно отмечать выполненные.</p>
        <div className="dreams-cols">
          <DreamCol title={`@${norm(me)}`} em="🌟" items={my} isMe={true}/>
          <DreamCol title={`@${norm(partner)}`} em="💫" items={pt} isMe={false}/>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   WISHES SECTION
══════════════════════════════════════════════════════ */
const WISH_EMOJIS=["🎁","💍","👗","📚","🎵","🍕","💄","🏋️","📷","🎮","🌸","💅","🎭","🍷","✈️","🛍️"];
function WishesSec({pair,me,partner}) {
  const coll=dbColl("duo_wishes",pair);
  const [items,sI]=useState([]);const [tab,sTab]=useState("all");
  const [t,sT]=useState("");const [d,sD]=useState("");const [em,sE]=useState("🎁");const [prio,sPrio]=useState("med");
  useEffect(()=>{coll.load().then(sI);},[]);
  useEffect(()=>{const iv=setInterval(()=>coll.load().then(sI),6000);return()=>clearInterval(iv);},[]);
  const add=async()=>{if(!t.trim())return;const w={id:Date.now(),title:t.trim(),desc:d.trim(),emoji:em,prio,by:me,done:false,doneBy:null};const u=[w,...items];sI(u);await coll.save(u);sT("");sD("");};
  const fulfill=async(id)=>{const u=items.map(w=>w.id===id?{...w,done:true,doneBy:me}:w);sI(u);await coll.save(u);};
  const filtered=tab==="all"?items:tab==="mine"?items.filter(w=>norm(w.by)===norm(me)):items.filter(w=>norm(w.by)===norm(partner));
  const prioLabels={high:"Очень хочу",med:"Хочу",low:"Когда-нибудь"};
  return (
    <div className="sec" id="wishes">
      <div className="sec-inner">
        <span className="eyebrow">Список желаний</span>
        <h2 className="sec-h">Что мы <em>хотим</em></h2>
        <p className="sec-p">Желания каждого. Нажми «Исполнить» — сделай приятное любимому человеку.</p>
        <div className="wish-tabs">{[["all","Все"],["mine","Мои"],["theirs","Партнёра"]].map(([v,l])=><div key={v} className={`wish-tab ${tab===v?"on":""}`} onClick={()=>sTab(v)}>{l} {tab!==v&&<span style={{opacity:.4,fontSize:9,marginLeft:2}}>({(v==="all"?items:v==="mine"?items.filter(w=>norm(w.by)===norm(me)):items.filter(w=>norm(w.by)===norm(partner))).length})</span>}</div>)}</div>
        <div className="wishes-grid">
          {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"28px",color:"var(--fg3)",fontSize:12}}>Пусто — добавь первое желание 🎁</div>}
          {filtered.map(w=><div key={w.id} className={`wish-card ${norm(w.by)===norm(me)?"mine":"theirs"} ${w.done?"done":""}`}>
            <div className="wish-card-top"><span style={{fontSize:19}}>{w.emoji}</span><span className="wish-by">@{norm(w.by)}</span></div>
            <div className="wish-t">{w.title}</div>
            {w.desc&&<div className="wish-d">{w.desc}</div>}
            <span className={`wish-prio ${w.prio}`}>{prioLabels[w.prio]}</span>
            {!w.done&&norm(w.by)!==norm(me)&&<button className="wish-fulfill" onClick={()=>fulfill(w.id)}>✨ Исполнить</button>}
            {w.done&&<div className="wish-done-lbl">✅ @{norm(w.doneBy)} исполнил</div>}
          </div>)}
        </div>
        <div className="add-form">
          <div className="em-row">{WISH_EMOJIS.map(e=><span key={e} className={`em-opt ${em===e?"sel":""}`} onClick={()=>sE(e)}>{e}</span>)}</div>
          <div className="prio-picker">{[["high","🔥 Очень хочу"],["med","💫 Хочу"],["low","🌿 Когда-нибудь"]].map(([v,l])=><div key={v} className={`prio-opt ${v} ${prio===v?"sel":""}`} onClick={()=>sPrio(v)}>{l}</div>)}</div>
          <div className="row"><input className="add-inp" placeholder="Моё желание…" value={t} onChange={e=>sT(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/><button className="add-btn" disabled={!t.trim()} onClick={add}>+ Добавить</button></div>
          <input className="add-inp" placeholder="Описание (необязательно)" value={d} onChange={e=>sD(e.target.value)}/>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TRAVEL SECTION
══════════════════════════════════════════════════════ */
const FLAGS=["🇯🇵","🇮🇹","🇫🇷","🇪🇸","🇬🇷","🇹🇭","🇧🇦","🇵🇹","🇲🇽","🇮🇸","🇳🇴","🇨🇭","🇦🇹","🇨🇿","🇹🇷","🌍"];
const STAT_MAP={dream:"Мечта",planning:"Планируем",been:"Были ✓"};
function TravelSec({pair,me}) {
  const coll=dbColl("duo_travel",pair);
  const [items,sI]=useState([]);const [pl,sPl]=useState("");const [nt,sNt]=useState("");const [fl,sFl]=useState("🇯🇵");const [st,sSt]=useState("dream");
  useEffect(()=>{coll.load().then(sI);},[]);
  useEffect(()=>{const iv=setInterval(()=>coll.load().then(sI),6000);return()=>clearInterval(iv);},[]);
  const add=async()=>{if(!pl.trim())return;const p={id:Date.now(),place:pl.trim(),note:nt.trim(),flag:fl,status:st,by:me};const u=[...items,p];sI(u);await coll.save(u);sPl("");sNt("");};
  const cycle=async id=>{const order=["dream","planning","been"];const u=items.map(p=>p.id!==id?p:{...p,status:order[(order.indexOf(p.status)+1)%order.length]});sI(u);await coll.save(u);};
  const counts={dream:items.filter(x=>x.status==="dream").length,planning:items.filter(x=>x.status==="planning").length,been:items.filter(x=>x.status==="been").length};
  return (
    <div className="sec" id="travel" style={{background:"rgba(255,255,255,.01)"}}>
      <div className="sec-inner">
        <span className="eyebrow">Путешествия</span>
        <h2 className="sec-h">Куда мы <em>хотим поехать</em></h2>
        <p className="sec-p">Нажми на карточку чтобы изменить статус: Мечта → Планируем → Были ✓</p>
        {items.length>0&&<div className="travel-counts"><div className="tcount"><div className={`tcount-n dream`}>{counts.dream}</div><div className="tcount-l">Мечты</div></div><div className="tcount"><div className={`tcount-n planning`}>{counts.planning}</div><div className="tcount-l">Планируем</div></div><div className="tcount"><div className={`tcount-n been`}>{counts.been}</div><div className="tcount-l">Были</div></div></div>}
        <div className="travel-grid">
          {items.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"28px",color:"var(--fg3)",fontSize:12}}>Добавьте первое место мечты ✈️</div>}
          {items.map(p=><div key={p.id} className={`travel-card ${p.status}`} onClick={()=>cycle(p.id)}>
            <span className={`travel-stat-badge ${p.status}`}>{STAT_MAP[p.status]}</span>
            <span className="travel-flag">{p.flag}</span>
            <div className="travel-place">{p.place}</div>
            {p.note&&<div className="travel-note">{p.note}</div>}
            <div className="travel-who">@{norm(p.by)}</div>
            <div className="travel-hint">Нажми чтобы изменить статус</div>
          </div>)}
        </div>
        <div className="add-form">
          <div className="em-row">{FLAGS.map(f=><span key={f} className={`em-opt ${fl===f?"sel":""}`} onClick={()=>sFl(f)}>{f}</span>)}</div>
          <div className="status-picker">{Object.entries(STAT_MAP).map(([v,l])=><div key={v} className={`sopt ${v} ${st===v?"sel":""}`} onClick={()=>sSt(v)}>{l}</div>)}</div>
          <div className="row"><input className="add-inp" placeholder="Название места" value={pl} onChange={e=>sPl(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/><button className="add-btn" disabled={!pl.trim()} onClick={add}>+ Добавить</button></div>
          <input className="add-inp" placeholder="Заметка (необязательно)" value={nt} onChange={e=>sNt(e.target.value)}/>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   PROMISES SECTION
══════════════════════════════════════════════════════ */
const DEF_PROMISES=[{id:1,emoji:"🌅",text:"Встречать каждый день вместе, даже на расстоянии"},{id:2,emoji:"💬",text:"Говорить честно, даже когда это трудно"},{id:3,emoji:"🌱",text:"Расти вместе и поддерживать мечты друг друга"},{id:4,emoji:"💋",text:"Никогда не забывать, почему мы начали"},{id:5,emoji:"🤝",text:"Быть командой — всегда"}];
function PromisesSec({me}) {
  const [items,sI]=useState(DEF_PROMISES);const [inp,sInp]=useState("");
  const toggle=id=>sI(p=>p.map(x=>x.id===id?{...x,done:!x.done}:x));
  const add=()=>{if(!inp.trim())return;sI(p=>[...p,{id:Date.now(),emoji:"💌",text:inp.trim(),by:me,done:false}]);sInp("");};
  return (
    <div className="sec" id="promises">
      <div className="sec-inner">
        <span className="eyebrow">Обещания</span>
        <h2 className="sec-h">Слова, <em>которые важны</em></h2>
        <p className="sec-p">То, что вы обещаете друг другу — здесь, навсегда. Отмечай выполненные.</p>
        <div className="prom-list">
          {items.map(p=><div key={p.id} className="prom-item">
            <span className="prom-em">{p.emoji}</span>
            <div className="prom-content"><div className="prom-text" style={p.done?{textDecoration:"line-through",opacity:.45}:{}}>{p.text}</div>{p.by&&<div className="prom-who">@{norm(p.by)}</div>}</div>
            <div className={`prom-check ${p.done?"done":""}`} onClick={()=>toggle(p.id)}>{p.done&&<svg width="9" height="7"><path d="M1 3.5L3.5 6 8 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}</div>
          </div>)}
        </div>
        <div className="prom-add-row">
          <input className="add-inp" placeholder="Добавить своё обещание…" value={inp} onChange={e=>sInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/>
          <button className="add-btn" disabled={!inp.trim()} onClick={add}>+ Добавить</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   LANDING
══════════════════════════════════════════════════════ */
const SECTIONS=[{id:"hero",l:"Главная"},{id:"timer",l:"Счётчик"},{id:"calendar",l:"Даты"},{id:"moments",l:"Моменты"},{id:"dreams",l:"Мечты"},{id:"wishes",l:"Желания"},{id:"travel",l:"Путешествия"},{id:"promises",l:"Обещания"}];

function Landing({me,partner,surpriseMsg,connectedAt,onDisc}) {
  const [stuck,sStuck]=useState(false);const [active,sActive]=useState("hero");
  const [startDate,sSD]=useState(()=>localStorage.getItem("duo_start")||"");
  const [partnerScroll,sPScroll]=useState(null);const [partnerCursor,sPCursor]=useState(null);
  const [showReacts,sReacts]=useState(false);const [floats,sFloats]=useState([]);const reactId=useRef(0);
  const [showChat,sChat]=useState(false);const [msgs,sMsgs]=useState([]);const [chatInp,sChatInp]=useState("");const [unread,sUnread]=useState(0);const lastMsgTs=useRef(0);const msgsEnd=useRef(null);
  const [isRec,sRec]=useState(false);const mrRef=useRef(null);const acRef=useRef([]);const recStart=useRef(null);
  const [myKiss,sMK]=useState(false);const [ptKiss,sPK]=useState(false);const [kissStart,sKS]=useState(null);const kissToastKey=useRef(0);const [kissToast,sKT]=useState(null);
  const [showVibe,sVibe]=useState(false);const [vibeR,sVibeR]=useState(null);const lastVibeTs=useRef(0);
  const [musicOn,sMusicOn]=useState(false);
  const [surprise,sSurprise]=useState(false);const surpriseFired=useRef(false);
  const scrollRef=useRef(null);const secRefs=useRef({});const stRef=useRef({scroll:0,cursor:null});const saveT=useRef(0);
  const pair=pairKey(me,partner);

  const flush=useCallback(async(extra={})=>{const now=Date.now();if(now-saveT.current<400)return;saveT.current=now;await saveState(me,{scroll:stRef.current.scroll,cursor:stRef.current.cursor,...extra});},[me]);

  useEffect(()=>{
    const el=scrollRef.current;if(!el)return;
    const fn=()=>{const pct=el.scrollTop/(el.scrollHeight-el.clientHeight);stRef.current.scroll=isNaN(pct)?0:pct;sStuck(el.scrollTop>16);
    for(const[id,ref]of Object.entries(secRefs.current)){if(!ref)continue;const r=ref.getBoundingClientRect();if(r.top<=el.clientHeight*.4&&r.bottom>0){sActive(id);break;}}
    if(!surpriseFired.current&&stRef.current.scroll>0.94){surpriseFired.current=true;sSurprise(true);}
    flush();};
    el.addEventListener("scroll",fn,{passive:true});return()=>el.removeEventListener("scroll",fn);
  },[flush]);

  useEffect(()=>{const fn=e=>{stRef.current.cursor={x:e.clientX/window.innerWidth,y:e.clientY/window.innerHeight};flush();};window.addEventListener("mousemove",fn);return()=>window.removeEventListener("mousemove",fn);},[flush]);

  useEffect(()=>{
    const iv=setInterval(async()=>{
      const d=await loadState(partner);if(!d)return;
      if(d.scroll!=null)sPScroll(d.scroll);
      if(d.cursor)sPCursor(d.cursor);
      if(d.reaction&&d.reaction.ts>(reactId._last||0)){reactId._last=d.reaction.ts;const id=++reactId.current;sFloats(p=>[...p,{id,emoji:d.reaction.emoji,x:`${d.reaction.x}%`,y:`${d.reaction.y}%`}]);}
      if(d.msg&&d.msg.ts>lastMsgTs.current){lastMsgTs.current=d.msg.ts;sMsgs(p=>[...p,{...d.msg,from:partner}]);if(!showChat)sUnread(n=>n+1);}
      const pk=d.kissing||false;sPK(pk);if(pk&&myKiss&&!kissStart)sKS(d.kissTs||Date.now());
      if(d.vibe&&d.vibe.ts>lastVibeTs.current){lastVibeTs.current=d.vibe.ts;const pat=VIBE_PATTERNS.find(p=>p.id===d.vibe.id);if(pat&&navigator.vibrate)navigator.vibrate(pat.pattern);sVibeR({id:d.vibe.id,ts:d.vibe.ts});}
    },POLL);
    return()=>clearInterval(iv);
  },[partner,showChat,myKiss,kissStart]);

  useEffect(()=>{msgsEnd.current?.scrollIntoView({behavior:"smooth"});},[msgs,showChat]);
  useEffect(()=>{if(showChat)sUnread(0);},[showChat]);

  const scrollTo=id=>secRefs.current[id]?.scrollIntoView({behavior:"smooth"});
  const sendReact=async em=>{sReacts(false);const x=35+Math.random()*30,y=25+Math.random()*45;const id=++reactId.current;sFloats(p=>[...p,{id,emoji:em,x:`${x}%`,y:`${y}%`}]);const st=await loadState(me)||{};await saveState(me,{...st,reaction:{emoji:em,x,y,ts:Date.now()}});};
  const sendMsg=async(text,voiceData=null,voiceDur=null)=>{const ts=Date.now();sMsgs(p=>[...p,{text,from:me,ts,voiceData,voiceDur}]);const st=await loadState(me)||{};await saveState(me,{...st,msg:{text,ts,voiceData,voiceDur}});};
  const startRec=async()=>{try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const mr=new MediaRecorder(stream,{mimeType:"audio/webm"});acRef.current=[];mr.ondataavailable=e=>acRef.current.push(e.data);mr.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(acRef.current,{type:"audio/webm"});if(blob.size>10){const dur=(Date.now()-recStart.current)/1000;const reader=new FileReader();reader.onloadend=async()=>{await sendMsg("🎤 Голосовое",reader.result.split(",")[1],dur);};reader.readAsDataURL(blob);}sRec(false);};mr.start();mrRef.current=mr;recStart.current=Date.now();sRec(true);setTimeout(()=>{if(mr.state==="recording")mr.stop();},30000);}catch(e){}};
  const stopRec=()=>{if(mrRef.current?.state==="recording")mrRef.current.stop();};
  const startKiss=async()=>{sMK(true);const ts=Date.now();await flush({kissing:true,kissTs:ts});if(ptKiss)sKS(ts);};
  const endKiss=async()=>{if(!myKiss)return;const dur=kissStart?Math.floor((Date.now()-kissStart)/1000):null;sMK(false);sKS(null);await flush({kissing:false});if(ptKiss&&dur&&dur>0){const key=++kissToastKey.current;sKT({key,dur});setTimeout(()=>sKT(t=>t?.key===key?null:t),4500);}};
  const sendVibe=async pat=>{sVibe(false);if(navigator.vibrate)navigator.vibrate([40]);const st=await loadState(me)||{};await saveState(me,{...st,vibe:{id:pat.id,ts:Date.now()}});};
  const toggleMusic=()=>{if(musicOn){amb.stop();sMusicOn(false);}else{amb.start();sMusicOn(true);}};

  const ghostTop=partnerScroll!==null?`calc(${partnerScroll*100}% - 16px)`:null;
  const msSince=startDate?Date.now()-new Date(startDate).getTime():0;
  const daysTogether=startDate&&msSince>0?Math.floor(msSince/86400000):null;
  const milestones=[{n:7,l:"7 дней"},{n:30,l:"1 месяц"},{n:100,l:"100 дней"},{n:180,l:"полгода"},{n:365,l:"1 год"},{n:730,l:"2 года"},{n:1000,l:"1000 дней"}];

  return (
    <div ref={scrollRef} className="app">
      <TogetherTimer t0={connectedAt}/>
      <nav className={`nav ${stuck?"stuck":""}`}>
        <span className="nav-brand">💕 {norm(me)} & {norm(partner)}</span>
        <ul className="nav-links">{SECTIONS.map(s=><li key={s.id}><span className={`nav-link ${active===s.id?"on":""}`} onClick={()=>scrollTo(s.id)}>{s.l}</span></li>)}</ul>
      </nav>

      {/* HERO */}
      <section id="hero" ref={el=>secRefs.current.hero=el} className="hero">
        <div className="hero-bg"/>
        <span className="hero-eyebrow">Только вы двое</span>
        <h1 className="hero-h">Наши<br/>отношения</h1>
        <p className="hero-sub">Ваш личный мир — календарь, воспоминания, мечты и желания.</p>
        {daysTogether!==null&&<div className="hero-stats"><div><div className="hero-stat-n">{daysTogether}</div><div className="hero-stat-l">дней вместе</div></div><div><div className="hero-stat-n">{Math.floor(daysTogether/7)}</div><div className="hero-stat-l">недель</div></div><div><div className="hero-stat-n">{Math.floor(daysTogether/30)}</div><div className="hero-stat-l">месяцев</div></div></div>}
        <div className="hero-btns"><button className="btn-filled" onClick={()=>scrollTo("moments")}>Наши моменты 🌹</button><button className="btn-outline" onClick={()=>scrollTo("calendar")}>Календарь 📅</button></div>
        <div className="scroll-cue"><div className="scroll-cue-line"/></div>
      </section>

      <div className="hr"/>

      {/* TIMER */}
      <section id="timer" ref={el=>secRefs.current.timer=el} className="sec">
        <div className="sec-inner">
          <span className="eyebrow">Счётчик любви</span>
          <h2 className="sec-h">Сколько мы <em>вместе</em></h2>
          <p className="sec-p">Каждая секунда на счету.</p>
          {startDate?<LoveTimer start={startDate}/>:<p style={{color:"var(--fg3)",fontSize:12,marginBottom:20}}>Укажи дату начала</p>}
          <div className="date-row"><span className="date-row-l">Вместе с</span><input className="date-inp" type="date" value={startDate} onChange={e=>{sSD(e.target.value);localStorage.setItem("duo_start",e.target.value);}}/></div>
          {startDate&&daysTogether!==null&&<div className="milestones">{milestones.map(ms=><div key={ms.n} className={`ms ${daysTogether>=ms.n?"hit":""}`}>{daysTogether>=ms.n?"✓ ":""}{ms.l}</div>)}</div>}
        </div>
      </section>

      <div className="hr"/>
      <section ref={el=>secRefs.current.calendar=el}><CalSec pair={pair} me={me}/></section>
      <div className="hr"/>
      <section ref={el=>secRefs.current.moments=el}><MomSec pair={pair} me={me}/></section>
      <div className="hr"/>
      <section ref={el=>secRefs.current.dreams=el}><DreamsSec me={me} partner={partner}/></section>
      <div className="hr"/>
      <section ref={el=>secRefs.current.wishes=el}><WishesSec pair={pair} me={me} partner={partner}/></section>
      <div className="hr"/>
      <section ref={el=>secRefs.current.travel=el}><TravelSec pair={pair} me={me}/></section>
      <div className="hr"/>
      <section ref={el=>secRefs.current.promises=el}><PromisesSec me={me}/></section>

      <footer className="foot"><p className="foot-t">@{norm(me)} & @{norm(partner)} · только вы двое 💕</p></footer>

      {/* ═══ OVERLAYS ═══ */}
      {ghostTop&&<div className="pbar"><div className="pbar-track"/><div className="pbar-thumb" style={{top:ghostTop}}/></div>}
      {partnerCursor&&<div className="pcursor" style={{left:`${partnerCursor.x*100}%`,top:`${partnerCursor.y*100}%`}}><div className="pcursor-dot"/><div className="pcursor-name">@{norm(partner)}</div></div>}
      {floats.map(r=><FloatReact key={r.id} {...r} onDone={()=>sFloats(p=>p.filter(x=>x.id!==r.id))}/>)}
      {showReacts&&<div className="react-row">{REACTS.map(e=><span key={e} className="react-em" onClick={()=>sendReact(e)}>{e}</span>)}</div>}
      {/* kiss */}
      <div className="kiss-wrap">{(myKiss||ptKiss)&&(myKiss&&ptKiss?<KissCounter start={kissStart}/>:<div className="kiss-wait">{myKiss?<>Ждём <strong>@{norm(partner)}</strong>…</>:<><strong>@{norm(partner)}</strong> ждёт!</>}</div>)}</div>
      {kissToast&&<div key={kissToast.key} className="kiss-toast">💋 <strong>{kissToast.dur}с</strong> — ваш поцелуй</div>}
      {showVibe&&<div className="vibe-panel"><div className="vibe-title">Отправить вибрацию</div><div className="vibe-opts">{VIBE_PATTERNS.map(p=><div key={p.id} className="vibe-opt" onClick={()=>sendVibe(p)}><span className="vibe-em">{p.emoji}</span><span className="vibe-lbl">{p.label}</span></div>)}</div></div>}
      {vibeR&&<VibeRipple key={vibeR.ts} vid={vibeR.id} partner={partner} onDone={()=>sVibeR(null)}/>}
      {surprise&&surpriseMsg&&<div className="surprise-bg" onClick={()=>sSurprise(false)}><div className="surprise-card" onClick={e=>e.stopPropagation()}><div className="surp-bg-blur"/><span className="surp-em">🌹</span><div className="surp-t">Для тебя</div><div className="surp-msg">"{surpriseMsg}"</div><div className="surp-from">— с любовью, @{norm(me)} 💕</div><button className="surp-btn" onClick={()=>sSurprise(false)}>Обнять в ответ 🤗</button></div></div>}

      {/* CHAT */}
      {showChat&&<div className="chat"><div className="chat-hd"><div><div className="chat-hd-t">💬 @{norm(partner)}</div><div className="chat-hd-s">Только вы двое</div></div><div className="chat-x" onClick={()=>sChat(false)}>✕</div></div><div className="chat-body">{msgs.length===0&&<div className="chat-empty">Напиши первым 🌹</div>}{msgs.map((m,i)=><div key={i} className={`chat-bubble ${m.from===me?"me":"them"}`}>{m.from!==me&&<div className="chat-who">@{norm(m.from)}</div>}{m.voiceData?<VoicePlayer data={m.voiceData} dur={m.voiceDur}/>:<div>{m.text}</div>}</div>)}<div ref={msgsEnd}/></div><div className="chat-input-row"><button className={`chat-mic ${isRec?"rec":""}`} onMouseDown={startRec} onMouseUp={stopRec} onTouchStart={startRec} onTouchEnd={stopRec}>🎤</button><input className="chat-inp" placeholder="Напиши…" value={chatInp} onChange={e=>sChatInp(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&chatInp.trim()){sendMsg(chatInp.trim());sChatInp("");}}}/><button className="chat-send" disabled={!chatInp.trim()} onClick={()=>{if(chatInp.trim()){sendMsg(chatInp.trim());sChatInp("");}}}><svg width="12" height="12" viewBox="0 0 12 12"><path d="M11 1L1 4.5l4 2 1.5 4L11 1z" fill="white"/></svg></button></div></div>}

      {/* RIBBON */}
      <div className="ribbon">
        <div className="rib-ava">{norm(partner)[0]}</div>
        <div className="rib-lbl">С <strong>@{norm(partner)}</strong></div>
        <div className="rib-sep"/>
        <div className="rib-btns">
          <div className={`rb ${musicOn?"on":""}`} onClick={toggleMusic}>{musicOn?<MusicBars/>:"🎵"}</div>
          <div className={`rb ${showVibe?"on":""}`} onClick={()=>{sVibe(p=>!p);sReacts(false);sChat(false);}}>📳</div>
          <div className={`rb ${showReacts?"on":""}`} onClick={()=>{sReacts(p=>!p);sVibe(false);sChat(false);}}>🎯</div>
          <div className={`rb ${myKiss?"kiss-on":""}`} onMouseDown={startKiss} onMouseUp={endKiss} onTouchStart={startKiss} onTouchEnd={endKiss}>💋</div>
          <div style={{position:"relative"}}><div className={`rb ${showChat?"on":""}`} onClick={()=>{sChat(p=>!p);sReacts(false);sVibe(false);}}>💬</div>{unread>0&&!showChat&&<div className="rb-badge">{unread}</div>}</div>
        </div>
        <span className="rib-sep"/>
        <span className="rib-exit" onClick={onDisc}>Выйти</span>
      </div>
    </div>
  );
}

function KissCounter({start}) {
  const [e,se]=useState(0);
  useEffect(()=>{if(!start)return;const iv=setInterval(()=>se(Math.floor((Date.now()-start)/1000)),100);return()=>clearInterval(iv);},[start]);
  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  return <div className="kiss-box"><span className="kiss-em">💋</span><div className="kiss-t">{fmt(e)}</div><div className="kiss-l">Держите…</div></div>;
}
function VibeRipple({vid,partner,onDone}) {
  const p=VIBE_PATTERNS.find(x=>x.id===vid)||VIBE_PATTERNS[0];
  useEffect(()=>{const t=setTimeout(onDone,2300);return()=>clearTimeout(t);},[]);
  return <div className="vibe-ripple-wrap" style={{"--vc":p.color}}>{[0,320,650].map((delay,i)=><div key={i} className="vibe-ring" style={{position:"absolute",left:"50%",top:"50%","--vd":"1.5s",animationDelay:`${delay}ms`}}/>)}<div className="vibe-icon">{p.emoji}</div><div className="vibe-text">@{norm(partner)}</div><div className="vibe-sub">{p.label}</div></div>;
}

/* ══════════════════════════════════════════════════════
   TELEGRAM HOOK
══════════════════════════════════════════════════════ */
function useTG() {
  const tg=typeof window!=="undefined"?window.Telegram?.WebApp:null;
  const ok=!!(tg?.initData);
  useEffect(()=>{if(!tg||!ok)return;tg.ready();tg.expand();tg.setHeaderColor("#0b0a0f");tg.setBackgroundColor("#0b0a0f");},[]);
  const user=tg?.initDataUnsafe?.user;
  const share=me=>{const bot=import.meta.env.VITE_BOT_USERNAME||"duo_viewer_bot";const url=`https://t.me/${bot}?startapp=${encodeURIComponent(me)}`;const txt="Открой наше приложение 💕";if(tg&&ok)tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(txt)}`);else navigator.clipboard?.writeText(url);};
  return {ok,username:user?.username||"",startParam:tg?.initDataUnsafe?.start_param||"",share};
}

/* ══════════════════════════════════════════════════════
   APP
══════════════════════════════════════════════════════ */
export default function App() {
  const [phase,sPhase]=useState("connect");
  const [me,sMe]=useState("");const [partner,sPartner]=useState("");
  const [meI,sMeI]=useState("");const [ptI,sPtI]=useState("");const [surprise,sSurprise]=useState("");
  const [err,sErr]=useState("");const [connectedAt,sCA]=useState(null);const [copied,sCopied]=useState(false);
  const pollRef=useRef(null);const burstRef=useRef(null);
  const {ok,username,startParam,share}=useTG();

  useEffect(()=>{const tag=document.createElement("style");tag.textContent=CSS;document.head.appendChild(tag);return()=>document.head.removeChild(tag);},[]);
  useEffect(()=>{if(username)sMeI(username);if(startParam)sPtI(startParam);},[username,startParam]);

  const startPoll=useCallback((myN,ptN)=>{
    pollRef.current=setInterval(async()=>{const d=await loadPresence(ptN);if(d&&d.wants===norm(myN)){clearInterval(pollRef.current);sMe(myN);sPartner(ptN);sPhase("burst");burstRef.current=setTimeout(()=>{sCA(Date.now());sPhase("landing");},3000);}},POLL);
  },[]);

  useEffect(()=>()=>{clearInterval(pollRef.current);clearTimeout(burstRef.current);if(me)clearAll(me);amb.stop();},[me]);

  const connect=async()=>{const myN=meI.trim(),ptN=ptI.trim();if(!myN||!ptN){sErr("Заполни оба поля.");return;}if(norm(myN)===norm(ptN)){sErr("Нельзя подключиться к самому себе 😊");return;}sErr("");await savePresence(myN,ptN);sPhase("waiting");startPoll(myN,ptN);};
  const disconnect=async()=>{clearInterval(pollRef.current);if(me)await clearAll(me);amb.stop();sPhase("connect");sMe("");sPartner("");sCA(null);sMeI(username||"");sPtI("");sSurprise("");};

  if(phase==="landing") return <Landing me={me} partner={partner} surpriseMsg={surprise} connectedAt={connectedAt} onDisc={disconnect}/>;
  if(phase==="burst") return <div className="burst"><BurstPetals/><div className="burst-ring"><div className="burst-icon">💖</div></div><div className="burst-title">Вы вместе</div><div className="burst-names"><span>@{norm(me)}</span> & <span>@{norm(partner)}</span></div></div>;

  return (
    <div className="co"><div className="co-petals"><Petals/></div>
      <div className="co-card">
        <span className="co-icon">🌹</span>
        {phase==="waiting"?(
          <div className="co-wait">
            <div className="orb">💌</div>
            <div className="wait-name">Жду <span>@{norm(ptI)}</span>…</div>
            <div className="wait-info"><span className="wait-dot"/>Попроси <strong style={{color:"var(--fg2)"}}>@{norm(ptI)}</strong> открыть приложение и ввести <strong style={{color:"var(--fg2)"}}>@{norm(meI)}</strong></div>
            <button className="btn-rose" style={{opacity:.82}} onClick={()=>{share(meI.trim());sCopied(true);setTimeout(()=>sCopied(false),2000);}}>{copied?"✓ Скопировано!":(ok?"Отправить ссылку в Telegram ✈️":"Скопировать ссылку 🔗")}</button>
            <span className="wait-cancel" onClick={async()=>{clearInterval(pollRef.current);await clearAll(meI.trim());sPhase("connect");}}>Отменить</span>
          </div>
        ):(
          <>
            <h1 className="co-h">Наше приложение,<br/><em>только для двоих</em></h1>
            <p className="co-sub">Введи ники — и окажитесь в одном пространстве.</p>
            <div className="divider-line"><span>✦</span></div>
            <div className="field">
              <label className="field-label">Твой ник</label>
              <div className="inp-wrap"><span className="inp-at">@</span><input className="inp" placeholder="username" value={meI} onChange={e=>{sMeI(e.target.value);sErr("");}} onKeyDown={e=>e.key==="Enter"&&connect()} readOnly={ok&&!!username}/></div>
              {ok&&username&&<p className="field-hint">✓ Получено из Telegram</p>}
            </div>
            <div className="field">
              <label className="field-label">Ник партнёра</label>
              <div className="inp-wrap"><span className="inp-at">@</span><input className="inp" placeholder="её или его username" value={ptI} onChange={e=>{sPtI(e.target.value);sErr("");}} onKeyDown={e=>e.key==="Enter"&&connect()}/></div>
            </div>
            <div className="field">
              <label className="field-label">💌 Сюрприз-послание</label>
              <textarea className="textarea" placeholder="Появится когда она долистает до конца…" value={surprise} onChange={e=>sSurprise(e.target.value)}/>
              <p className="field-hint">Она увидит это только в конце 🌹</p>
            </div>
            {err&&<p className="err">{err}</p>}
            <button className="btn-rose" disabled={!meI.trim()||!ptI.trim()} onClick={connect}>Войти вместе 💕</button>
          </>
        )}
      </div>
    </div>
  );
}
