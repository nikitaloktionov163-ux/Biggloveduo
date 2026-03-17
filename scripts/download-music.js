// scripts/download-music.js
// node scripts/download-music.js

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

const dir = './public/music';
if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});

// Прямые ссылки на треки Free Music Archive — романтическое пианино
// Автор: Lite Saturation (CC BY-ND 4.0 — можно использовать бесплатно)
const tracks = [
  {
    name:'t1.mp3',
    url:'https://freemusicarchive.org/music/lite-saturation/romantic-collection/piano-beautiful/download/',
    title:'Piano Beautiful'
  },
  {
    name:'t2.mp3',
    url:'https://freemusicarchive.org/music/lite-saturation/harmony-in-love/love-unfolding-background-piano-instrumental/download/',
    title:'Love Unfolding'
  },
  {
    name:'t3.mp3',
    url:'https://freemusicarchive.org/music/lite-saturation/harmony-in-love/dreamy-horizon-background-piano-instrumental/download/',
    title:'Dreamy Horizon'
  },
  {
    name:'t4.mp3',
    url:'https://freemusicarchive.org/music/lite-saturation/harmony-in-love/tranquil-affection-background-piano-instrumental/download/',
    title:'Tranquil Affection'
  },
  {
    name:'t5.mp3',
    url:'https://freemusicarchive.org/music/lite-saturation/harmony-in-love/evening-serenade-background-piano-instrumental/download/',
    title:'Evening Serenade'
  },
  {
    name:'t6.mp3',
    url:'https://freemusicarchive.org/music/lite-saturation/harmony-in-love/harmony-in-love-background-piano-instrumental/download/',
    title:'Harmony in Love'
  },
];

const download=(url,dest,redirects=0)=>new Promise((res,rej)=>{
  if(redirects>5)return rej(new Error('Too many redirects'));
  const lib=url.startsWith('https')?https:http;
  const req=lib.get(url,{
    headers:{
      'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept':'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
    }
  },r=>{
    if(r.statusCode===301||r.statusCode===302||r.statusCode===303){
      return download(r.headers.location,dest,redirects+1).then(res).catch(rej);
    }
    if(r.statusCode!==200){
      return rej(new Error(`HTTP ${r.statusCode}`));
    }
    const file=fs.createWriteStream(dest);
    r.pipe(file);
    file.on('finish',()=>{
      file.close();
      const size=fs.statSync(dest).size;
      if(size<10000){
        fs.unlinkSync(dest);
        return rej(new Error(`File too small (${size} bytes) — probably HTML error page`));
      }
      res();
    });
    file.on('error',e=>{fs.unlink(dest,()=>{});rej(e);});
  });
  req.on('error',e=>{fs.unlink(dest,()=>{});rej(e);});
  req.setTimeout(30000,()=>{req.destroy();rej(new Error('Timeout'));});
});

(async()=>{
  let ok=0;
  for(const t of tracks){
    const dest=path.join(dir,t.name);
    if(fs.existsSync(dest)&&fs.statSync(dest).size>10000){
      console.log(`✓ ${t.name} уже есть`);ok++;continue;
    }
    try{
      process.stdout.write(`⬇ Скачиваю ${t.title}... `);
      await download(t.url,dest);
      const size=(fs.statSync(dest).size/1024/1024).toFixed(1);
      console.log(`✓ ${size}MB`);ok++;
    }catch(e){
      console.log(`✗ ${e.message}`);
    }
  }
  console.log(`\n${ok}/${tracks.length} треков скачано.`);
  if(ok>0){
    console.log('\nТеперь запусти:');
    console.log('git add public/music/ && git commit -m "feat: add music tracks" && git push');
  } else {
    console.log('\nНичего не скачалось. Попробуй скачать вручную:');
    console.log('freemusicarchive.org/music/lite-saturation/');
  }
})();
