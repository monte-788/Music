const $=s=>document.getElementById(s), au=$('au');
const svg=(p,s)=>`<svg viewBox="0 0 24 24" width="1em" height="1em" ${s?'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"':'fill="currentColor"'}>${p}</svg>`;
const IC={
 play:svg('<path d="M6 4.5v15a1 1 0 0 0 1.55.83l12-7.5a1 1 0 0 0 0-1.66l-12-7.5A1 1 0 0 0 6 4.5z"/>'),
 pause:svg('<rect x="5" y="4" width="5" height="16" rx="1.5"/><rect x="14" y="4" width="5" height="16" rx="1.5"/>'),
 prev:svg('<path d="M5 4h2.5v16H5zM20 5.2v13.6a1 1 0 0 1-1.55.83L9.2 12.83a1 1 0 0 1 0-1.66l9.25-5.8A1 1 0 0 1 20 5.2z"/>'),
 next:svg('<path d="M16.5 4H19v16h-2.5zM4 5.2v13.6a1 1 0 0 0 1.55.83l9.25-5.8a1 1 0 0 0 0-1.66L5.55 5.37A1 1 0 0 0 4 5.2z"/>'),
 shuf:svg('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',1),
 rep:svg('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',1),
 vol:svg('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',1),
 mute:svg('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/>',1),
 gear:svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',1)};
let qsig='';
let dbp;const db=()=>dbp||(dbp=new Promise((res,rej)=>{const r=indexedDB.open('mp3lib',1);r.onupgradeneeded=()=>r.result.createObjectStore('t',{keyPath:'key'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}));
const dbDo=(mode,fn)=>db().then(d=>new Promise((res,rej)=>{const tx=d.transaction('t',mode),rq=fn(tx.objectStore('t'));tx.oncomplete=()=>res(rq&&rq.result);tx.onerror=()=>rej(tx.error)}));
const dbPut=t=>dbDo('readwrite',s=>s.put({key:t.key,name:t.file.name||t.key,file:t.file,title:t.title,artist:t.artist,album:t.album,coverBlob:t.coverBlob||null})).catch(()=>{});
const dbClear=()=>dbDo('readwrite',s=>s.clear()).catch(()=>{});
async function restore(){
  try{
    const r=await dbDo('readonly',s=>s.getAll());if(!r||!r.length)return;
    r.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
    tracks=r.map((x,i)=>({id:i,file:x.file,url:URL.createObjectURL(x.file),key:x.key,dur:null,title:x.title,artist:x.artist,album:x.album,coverBlob:x.coverBlob,cover:x.coverBlob?URL.createObjectURL(x.coverBlob):null}));
    renderSide();render();fillDur();
  }catch(e){}
}
const toast=m=>{const b=document.createElement('div');b.className='busy';b.textContent=m;document.body.appendChild(b);setTimeout(()=>b.remove(),2400)};
let sleepAt=0,sleepEnd=false,sleepT=null;
function setSleep(m){clearTimeout(sleepT);sleepAt=0;sleepEnd=false;if(m==='end')sleepEnd=true;else if(m>0){sleepAt=Date.now()+m*60000;sleepT=setTimeout(sleepNow,m*60000)}toast(m==='end'?'Sleep timer: end of song':m?'Sleep timer: '+m+' min':'Sleep timer off')}
function sleepNow(){sleepAt=0;sleepEnd=false;clearTimeout(sleepT);const v=$('vol').value/100,iv=setInterval(()=>{au.volume=Math.max(0,au.volume-.04);if(au.volume<=.01){clearInterval(iv);au.pause();au.volume=v}},150)}
function openSettings(){
  const left=sleepEnd?'End of current song':sleepAt?Math.max(1,Math.ceil((sleepAt-Date.now())/60000))+' min left':'Off';
  openSheet(`<h3>Settings</h3><div class="grp">Sleep timer: <b>${left}</b></div><div class="chips">${[5,15,30,45,60].map(m=>`<button class="pill alt" data-sl="${m}">${m} min</button>`).join('')}<button class="pill alt" data-sl="end">End of song</button><button class="pill alt" data-sl="0">Off</button></div><hr><div class="grp">Playlist backup</div><button class="opt" data-st="export">Export playlists (CSV)</button><button class="opt" data-st="import">Import playlists (CSV)</button><hr><div class="grp">Library: ${tracks.length} songs, saved on this device</div><button class="opt" data-st="folder">Choose music folder</button><button class="opt" data-st="files">Add songs</button><button class="opt" data-st="clear">Clear saved library</button>`);
}
const sig=()=>view.t+'|'+(view.v??'');
const isPlayingHere=()=>!au.paused&&cur>=0&&qsig===sig();
const volIc=()=>{$('vIco').innerHTML=(au.muted||au.volume===0)?IC.mute:IC.vol};
let tracks=[], view={t:'all'}, q='', queue=[], cur=-1, shuffle=false, repeat=0, favSet=new Set();
let pls=[],mix=[],mixAl=[];try{pls=JSON.parse(localStorage.getItem('pls')||'[]')}catch(e){}
if(!Array.isArray(pls))pls=[];
const syncFav=()=>{const f=pls.find(p=>p.fav);favSet=new Set(f?f.keys:[])};
const savePls=()=>{syncFav();try{localStorage.setItem('pls',JSON.stringify(pls))}catch(e){}};
(()=>{ /* permanent Favorites playlist, always first; migrates old hearts */
  let old=[];try{old=JSON.parse(localStorage.getItem('liked')||'[]')}catch(e){}
  let f=pls.find(p=>p.fav)||pls.find(p=>String(p.name).trim().toLowerCase()==='favorites');
  if(!f){f={name:'Favorites',keys:[]};pls.unshift(f)}else if(pls[0]!==f){pls.splice(pls.indexOf(f),1);pls.unshift(f)}
  f.fav=true;f.name='Favorites';if(!Array.isArray(f.keys))f.keys=[];
  old.forEach(k=>{if(!f.keys.includes(k))f.keys.push(k)});
  savePls();try{localStorage.removeItem('liked')}catch(e){}
})();
const tset=()=>new Set(tracks.map(t=>t.key));
const plCount=(p,s)=>p.keys.reduce((n,k)=>n+(s.has(k)?1:0),0);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=s=>{if(!isFinite(s)||s==null)return '–:––';s=Math.floor(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const hue=s=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))%360;return h};
const artStyle=(t,k)=>t.fav?'background:linear-gradient(135deg,#450af5,#8e8ee5)':t.cover?`background-image:url(${t.cover})`:`background:linear-gradient(135deg,hsl(${hue(k||t.album)},45%,32%),hsl(${(hue(k||t.album)+50)%360},50%,22%))`;
const artHtml=(t,k,cls='')=>`<div class="art ${cls}" style="${artStyle(t,k)}">${t.fav?'♥':t.cover?'':'♪'}</div>`;

/* ---------- ID3 tag reader ---------- */
const dec=(d)=>{if(!d.length)return '';const e=d[0],b=d.subarray(1);const l=['iso-8859-1','utf-16','utf-16be','utf-8'][e]||'utf-8';return new TextDecoder(l).decode(b).replace(/\0/g,'').trim()};
async function readTags(file){
  const t={title:file.name.replace(/\.[^.]+$/,''),artist:'Unknown Artist',album:'Unknown Album',cover:null};
  try{
    const h=new Uint8Array(await file.slice(0,10).arrayBuffer());
    if(h[0]!==73||h[1]!==68||h[2]!==51)return t;
    const v=h[3],size=(h[6]<<21)|(h[7]<<14)|(h[8]<<7)|h[9];
    const b=new Uint8Array(await file.slice(10,10+size).arrayBuffer());
    const il=v===2?3:4,hl=v===2?6:10;let p=0;
    while(p+hl<=b.length){
      const id=String.fromCharCode(...b.subarray(p,p+il));
      if(!/^[A-Z0-9]+$/.test(id))break;
      let n;
      if(v===2)n=(b[p+3]<<16)|(b[p+4]<<8)|b[p+5];
      else if(v===4)n=(b[p+4]<<21)|(b[p+5]<<14)|(b[p+6]<<7)|b[p+7];
      else n=((b[p+4]<<24)|(b[p+5]<<16)|(b[p+6]<<8)|b[p+7])>>>0;
      const d=b.subarray(p+hl,p+hl+n);p+=hl+n;
      if(id==='TIT2'||id==='TT2')t.title=dec(d)||t.title;
      else if(id==='TPE1'||id==='TP1')t.artist=dec(d)||t.artist;
      else if(id==='TALB'||id==='TAL')t.album=dec(d)||t.album;
      else if((id==='APIC'||id==='PIC')&&!t.cover){
        const lim=Math.min(d.length-4,300);
        for(let i=0;i<lim;i++){
          const jpg=d[i]===255&&d[i+1]===216&&d[i+2]===255,png=d[i]===137&&d[i+1]===80&&d[i+2]===78&&d[i+3]===71;
          if(jpg||png){t.coverBlob=new Blob([d.subarray(i)],{type:jpg?'image/jpeg':'image/png'});t.cover=URL.createObjectURL(t.coverBlob);break}
        }
      }
    }
  }catch(e){}
  return t;
}

/* ---------- Loading ---------- */
async function load(files,add){
  files=[...files].filter(f=>/\.mp3$/i.test(f.name)||f.type==='audio/mpeg').sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
  if(!files.length){alert('No MP3 files found in that selection.');return}
  const old=add?tracks:[],have=new Set(old.map(t=>t.key));files=files.filter(f=>!have.has(f.name+'|'+f.size));if(!files.length)return;
  if(!add){tracks.forEach(t=>t.url&&URL.revokeObjectURL(t.url));dbClear()}
  const mine=tracks=old.concat(files.map((f,i)=>({id:old.length+i,file:f,url:URL.createObjectURL(f),key:f.name+'|'+f.size,dur:null,title:f.name.replace(/\.[^.]+$/,''),artist:'Unknown Artist',album:'Unknown Album',cover:null})));
  view={t:'all'};q='';if(!add){cur=-1;au.pause();au.removeAttribute('src')}mix=[];mixAl=[];
  renderSide();render();updateBar();
  let b=$('busy');if(!b){b=document.createElement('div');b.id='busy';b.className='busy';document.body.appendChild(b)}
  b.hidden=false;let done=0,next=old.length;
  const worker=async()=>{while(next<mine.length&&mine===tracks){const t=mine[next++],r=await readTags(t.file);Object.assign(t,{title:r.title,artist:r.artist,album:r.album,cover:r.cover,coverBlob:r.coverBlob});dbPut(t);done++;b.textContent='Reading song info '+done+' / '+mine.length;if(done%50===0)await new Promise(r=>setTimeout(r))}};
  await Promise.all(Array.from({length:6},worker));
  if(mine!==tracks)return;
  b.hidden=true;
  const st=$('main').scrollTop;mix=[];renderSide();render();$('main').scrollTop=st;updateBar();fillDur();
}
async function fillDur(){
  const mine=tracks;let i=0;
  const w=async()=>{while(i<mine.length&&mine===tracks){const t=mine[i++];if(t.dur!=null)continue;await new Promise(r=>{const a=new Audio();a.preload='metadata';const end=()=>{a.removeAttribute('src');r()};a.onloadedmetadata=()=>{t.dur=a.duration;end()};a.onerror=()=>{t.dur=0;end()};setTimeout(end,4000);a.src=t.url});const c=document.querySelector(`[data-d="${t.id}"]`);if(c)c.textContent=fmt(t.dur)}};
  await Promise.all([w(),w(),w()]);
}

/* ---------- Views ---------- */
const albums=()=>{const m=new Map();tracks.forEach(t=>{if(!m.has(t.album))m.set(t.album,{name:t.album,artist:t.artist,cover:t.cover,tracks:[]});const a=m.get(t.album);if(!a.cover&&t.cover)a.cover=t.cover;a.tracks.push(t)});return [...m.values()].sort((a,b)=>a.name.localeCompare(b.name))};
function list(){
  let l=tracks;
  if(view.t==='album')l=l.filter(t=>t.album===view.v);
  if(view.t==='artist')l=l.filter(t=>t.artist===view.v);
  if(view.t==='pl'){const p=pls[view.v],ks=new Set(p?p.keys:[]);l=l.filter(t=>ks.has(t.key))}
  if(q){const s=q.toLowerCase();l=l.filter(t=>(t.title+' '+t.artist+' '+t.album).toLowerCase().includes(s))}
  return l;
}
function renderSide(){
  document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('on',b.dataset.nav===grpOf(view.t)));
  const s=tset();
  $('pls').innerHTML=pls.map((p,i)=>`<button class="pl ${view.t==='pl'&&view.v==i?'on':''}" data-pl="${i}">${artHtml(p.fav?{fav:true}:{cover:(tracks.find(x=>p.keys.includes(x.key))||{}).cover},p.name)}<div><b>${esc(p.name)}</b><small>Playlist · ${plCount(p,s)} songs</small></div></button>`).join('');
}
const grpOf=t=>({pl:'playlists',album:'albums',artists:'albums',artist:'albums'})[t]||t;
function go(t,v){view={t,v};q='';if(t==='discover')shuffleMix();renderSide();render();$('main').scrollTop=0}
function shuffleMix(){mix=[...tracks].sort(()=>Math.random()-.5).slice(0,25);mixAl=albums().sort(()=>Math.random()-.5).slice(0,12)}
const artists=()=>{const m=new Map();tracks.forEach(t=>{if(!m.has(t.artist))m.set(t.artist,{name:t.artist,cover:t.cover,n:0});const a=m.get(t.artist);if(!a.cover&&t.cover)a.cover=t.cover;a.n++});return [...m.values()].sort((a,b)=>a.name.localeCompare(b.name))};
const card=(a,kind,v,title,sub,k)=>`<button class="card" data-go="${kind}" data-v="${esc(v)}">${artHtml(a,k||title)}<b>${esc(title)}</b><small>${esc(sub)}</small></button>`;
function render(){
  if(view.t==='pl'&&!pls[view.v])view={t:'playlists'};
  document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('on',b.dataset.nav===grpOf(view.t)));
  if(!tracks.length||['all','album','artist','pl'].includes(view.t))return renderList();
  const m=$('main'),t=view.t,top=h=>`<div class="top"><b class="ttl">${h}</b><span style="flex:1"></span><button class="gear" id="settings" title="Settings">${IC.gear}</button></div>`;
  m.style.setProperty('--tint','#2b2b2b');
  let h;
  if(t==='discover'){
    if(!mix.length)shuffleMix();
    h=top('Discover')+`<div class="sec">Mix for you</div><div class="bar" style="padding-top:0"><button class="big" id="playMix">${IC.play}</button><div style="flex:1;min-width:0"><b>Daily mix</b><br><small style="color:var(--sub)">${mix.length} random songs</small></div><button class="pill alt" id="refMix">Refresh</button></div><div class="sec">Albums to explore</div><div class="grid">${mixAl.map(a=>card(a,'album',a.name,a.name,a.artist)).join('')}</div><div class="sec">Rediscover</div><div id="rows">${mix.slice(0,8).map((x,i)=>row(x,i)).join('')}</div><div style="height:24px"></div>`;
  }else if(t==='playlists'){
    h=top('Playlists')+`<div class="grid" style="padding-top:8px"><button class="card" id="newPl"><div class="art" style="background:#2a2a2a">＋</div><b>New playlist</b><small>Name it, then add songs</small></button>${(s=>pls.map((p,i)=>card(p.fav?{fav:true}:{cover:(tracks.find(x=>p.keys.includes(x.key))||{}).cover},'pl',i,p.name,plCount(p,s)+' songs')).join(''))(tset())}</div>`;
  }else{
    const seg=`<div class="seg"><button class="pill ${t==='albums'?'':'alt'}" data-go="albums">Albums</button><button class="pill ${t==='artists'?'':'alt'}" data-go="artists">Artists</button></div>`;
    h=top('Your library')+seg+`<div class="grid">${(t==='albums'?albums().map(a=>card(a,'album',a.name,a.name,a.artist+' · '+a.tracks.length+' songs')):artists().map(a=>card(a,'artist',a.name,a.name,a.n+' songs'))).join('')}</div>`;
  }
  m.innerHTML=h;
}
function renderList(){
  const m=$('main');
  if(!tracks.length){
    m.style.setProperty('--tint','#2b2b2b');
    m.innerHTML=`<div class="empty"><div style="font-size:64px">♫</div><h2>Play the music on your device</h2><p>Pick the folder that holds your MP3s. Files stay on your device and are never uploaded.</p><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><button class="pill" id="pick">Choose music folder</button><button class="pill alt" id="pickF">Choose files</button></div></div>`;
    return;
  }
  const l=list();
  let title='Your Library',sub=`${tracks.length} songs`,cover=tracks[0],ck='all',tk='all';
  if(view.t==='artist'){title=view.v;sub=`${l.length} songs`;cover=l[0]||{};ck=view.v}
  if(view.t==='pl'){const p=pls[view.v];title=p.name;sub=`${l.length} songs`;cover=p.fav?{fav:true}:(l[0]||{});ck=p.name}
  if(view.t==='album'){const a=albums().find(x=>x.name===view.v)||{name:'',artist:''};title=a.name;sub=`${a.artist} · ${a.tracks.length} songs`;cover=a;ck=a.name}
  m.style.setProperty('--tint',`hsl(${hue(ck)},40%,28%)`);
  const playing=cur>=0?tracks[cur]:null;
  m.innerHTML=`<div class="top"><input class="search" id="q" placeholder="Search songs, artists, albums" value="${esc(q)}"><button class="gear" id="settings" title="Settings">${IC.gear}</button></div>
  <div class="hero">${artHtml(cover,ck)}<div><p>${{all:'Library',pl:'Playlist',artist:'Artist'}[view.t]||'Album'}</p><h1>${esc(title)}</h1><p>${esc(sub)}</p></div></div>
  <div class="bar"><button class="big" id="playAll" title="Play">${isPlayingHere()?IC.pause:IC.play}</button><button class="pill alt" id="shufAll">Shuffle</button>${view.t==='pl'&&!pls[view.v].fav?'<button class="pill alt" id="delPl">Delete</button>':''}</div>
  <div class="row h"><span class="n">#</span><span>Title</span><span class="al">Album</span><span></span><span class="d">Time</span></div>
  <div id="rows">${l.map((t,i)=>row(t,i)).join('')||'<div class="empty"><p>Nothing here yet.</p></div>'}</div><div style="height:24px"></div>`;
  const sq=$('q');if(document.activeElement===document.body&&q){sq.focus();sq.setSelectionRange(q.length,q.length)}
}
const row=(t,i)=>`<div class="row ${t.id===cur?'cur':''}" data-id="${t.id}"><span class="n">${t.id===cur&&!au.paused?'♪':i+1}</span><div class="t">${artHtml(t,t.album)}<div><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></div></div><span class="al">${esc(t.album)}</span><span class="acts"><button class="like ${favSet.has(t.key)?'on':''}" data-like="${t.id}">${favSet.has(t.key)?'♥':'♡'}</button>${view.t==='pl'?`<button class="like" data-rm="${t.id}">✕</button>`:`<button class="like" data-add="${t.id}">＋</button>`}</span><span class="d" data-d="${t.id}">${t.dur!=null?fmt(t.dur):''}</span></div>`;

/* ---------- Background keep-alive ----------
   Chrome freezes tabs ~5 min after they are hidden, unless they hold a Web Lock or are audibly playing.
   Between songs the audio is silent for a moment, so the tab could get frozen and the next song never started. */
let lockRel=null,errSkips=0;
function keepAlive(on){
  if(!('locks' in navigator))return;
  if(on&&!lockRel){try{navigator.locks.request('player-keepalive',()=>new Promise(r=>{lockRel=()=>{lockRel=null;r()}})).catch(()=>{})}catch(e){}}
  else if(!on&&lockRel)lockRel();
}
const resumeIfWanted=()=>{if(lockRel&&au.paused&&au.src)au.play().catch(()=>{})};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)resumeIfWanted()});

/* ---------- Playback ---------- */
function play(id,fresh){
  if(fresh){queue=list().map(t=>t.id);qsig=sig()}
  cur=id;const t=tracks[id];keepAlive(true);au.src=t.url;au.play().catch(()=>{});NC.track(t);
  if('mediaSession' in navigator){try{navigator.mediaSession.metadata=new MediaMetadata({title:t.title,artist:t.artist,album:t.album,artwork:t.cover?[{src:t.cover}]:[]})}catch(e){}}
  updateBar();markRows();
}
function step(dir,auto){
  if(!queue.length)return;
  if(auto&&repeat===2){au.currentTime=0;au.play();return}
  let pos=queue.indexOf(cur),n;
  if(shuffle&&queue.length>1){do{n=Math.floor(Math.random()*queue.length)}while(n===pos)}
  else{n=pos+dir;if(n>=queue.length||n<0){if(auto&&repeat===0){keepAlive(false);au.pause();updateBar();markRows();return}n=(n+queue.length)%queue.length}}
  play(queue[n]);
  if(auto)setTimeout(resumeIfWanted,1500);
}
function markRows(){
  document.querySelectorAll('.row[data-id]').forEach(r=>{const on=+r.dataset.id===cur;r.classList.toggle('cur',on);r.querySelector('.n').textContent=on&&!au.paused?'♪':[...r.parentNode.children].indexOf(r)+1});
  const pa=$('playAll');if(pa)pa.innerHTML=isPlayingHere()?IC.pause:IC.play;
}
function updateBar(){
  const t=cur>=0?tracks[cur]:null;
  $('player').style.setProperty('--tint',t?`hsl(${hue(t.album)},40%,30%)`:'#333');
  $('now').innerHTML=t?`${artHtml(t,t.album)}<div><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></div>`:'<small style="color:var(--sub)">Choose a song to start</small>';
  $('bPlay').innerHTML=au.paused?IC.play:IC.pause;$('bShuf').innerHTML=IC.shuf;$('bPrev').innerHTML=IC.prev;$('bNext').innerHTML=IC.next;volIc();
  $('bShuf').classList.toggle('on',shuffle);
  $('bRep').classList.toggle('on',repeat>0);$('bRep').innerHTML=IC.rep+(repeat===2?'<span class="one">1</span>':'');
}
const setP=(el)=>el.style.setProperty('--p',(el.value-el.min)/(el.max-el.min)*100+'%');
au.addEventListener('timeupdate',()=>{if(sleepAt&&Date.now()>=sleepAt)sleepNow();if(!isFinite(au.duration))return;$('seek').value=au.currentTime/au.duration*1000;setP($('seek'));$('cur').textContent=fmt(au.currentTime);$('dur').textContent=fmt(au.duration)});
au.addEventListener('play',()=>{keepAlive(true);updateBar();markRows()});
au.addEventListener('pause',()=>{if(!au.ended)keepAlive(false);updateBar();markRows()});
au.addEventListener('playing',()=>{errSkips=0});
au.addEventListener('error',()=>{if(lockRel&&au.src&&errSkips<5){errSkips++;step(1,true)}});
au.addEventListener('ended',()=>{if(sleepEnd){sleepEnd=false;updateBar();return}step(1,true)});
$('seek').oninput=e=>{if(isFinite(au.duration))au.currentTime=e.target.value/1000*au.duration;setP(e.target)};
$('vol').oninput=e=>{au.volume=e.target.value/100;setP(e.target);volIc()};
au.volume=.8;setP($('vol'));
$('bPlay').onclick=()=>{if(cur<0){const l=list();if(l.length)play(l[0].id,true);return}au.paused?au.play():au.pause()};
$('bNext').onclick=()=>step(1);
$('bPrev').onclick=()=>{if(au.currentTime>3){au.currentTime=0}else step(-1)};
$('bShuf').onclick=()=>{shuffle=!shuffle;updateBar()};
$('bRep').onclick=()=>{repeat=(repeat+1)%3;updateBar()};
$('vIco').onclick=()=>{au.muted=!au.muted;volIc()};

/* ---------- Events ---------- */
$('fFolder').onchange=e=>{if(e.target.files.length)load(e.target.files);e.target.value=''};
$('fFiles').onchange=e=>{if(e.target.files.length)load(e.target.files,true);e.target.value=''};
$('main').addEventListener('click',e=>{
  const c=e.target.closest('button,.row[data-id]');if(!c)return;
  const d=c.dataset;
  if(c.id==='settings')return openSettings();
  if(d.go)return go(d.go,d.v);
  if(d.add!==undefined)return openAdd(+d.add);
  if(d.rm!==undefined){const p=pls[view.v];p.keys=p.keys.filter(x=>x!==tracks[+d.rm].key);savePls();renderSide();return render()}
  if(c.id==='newPl')return openNew();
  if(c.id==='delPl'){if(pls[view.v].fav)return;pls.splice(view.v,1);savePls();return go('playlists')}
  if(c.id==='refMix'){shuffleMix();return render()}
  if(c.id==='playMix'){queue=mix.map(x=>x.id);qsig='mix';if(queue.length)play(queue[0]);return}
  if(c.id==='pick')return $('fFolder').click();
  if(c.id==='pickF'||c.id==='pickF2')return $('fFiles').click();
  if(c.dataset.like!==undefined){const t=tracks[+c.dataset.like],f=pls.find(p=>p.fav),was=favSet.has(t.key);f.keys=was?f.keys.filter(x=>x!==t.key):[...f.keys,t.key];savePls();c.classList.toggle('on',!was);c.textContent=was?'♡':'♥';renderSide();return}
  if(c.id==='playAll'){const l=list();if(!l.length)return;if(qsig===sig()&&cur>=0){au.paused?au.play():au.pause()}else play(l[0].id,true);return}
  if(c.id==='shufAll'){const l=list();if(!l.length)return;shuffle=true;play(l[Math.floor(Math.random()*l.length)].id,true);return}
  if(c.dataset.id!==undefined)play(+c.dataset.id,true);
});
$('main').addEventListener('input',e=>{if(e.target.id!=='q')return;q=e.target.value;const l=list();$('rows').innerHTML=l.map((t,i)=>row(t,i)).join('')||'<div class="empty"><p>No matches. Try a different search.</p></div>'});
document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>go(b.dataset.nav));
$('pls').addEventListener('click',e=>{const b=e.target.closest('[data-pl]');if(b)go('pl',b.dataset.pl)});
$('nNew').onclick=()=>openNew();
$('now').onclick=()=>{if(cur>=0&&matchMedia('(max-width:760px)').matches)$('player').classList.add('full')};
$('bClose').onclick=()=>$('player').classList.remove('full');
const sheet=$('sheet');
const openSheet=h=>{sheet.innerHTML='<div>'+h+'</div>';sheet.hidden=false};
const newForm=id=>`<h3>New playlist</h3><input id="plName" placeholder="Playlist name" maxlength="60"><button class="pill" data-mk="${id}">Create playlist</button>`;
function openNew(){openSheet(newForm(-1))}
function openAdd(id){openSheet(`<h3>Add to playlist</h3>${pls.map((p,i)=>`<button class="opt" data-ad="${i}" data-t="${id}">${esc(p.name)}<small>${p.keys.length} songs</small></button>`).join('')}${pls.length?'<hr>':''}${newForm(id)}`)}
sheet.addEventListener('click',e=>{
  if(e.target===sheet){sheet.hidden=true;return}
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.sl!==undefined){const v=b.dataset.sl;sheet.hidden=true;setSleep(v==='end'?'end':+v);return}
  if(b.dataset.st==='folder'){sheet.hidden=true;$('fFolder').click();return}
  if(b.dataset.st==='files'){sheet.hidden=true;$('fFiles').click();return}
  if(b.dataset.st==='export'){sheet.hidden=true;exportPlaylists();return}
  if(b.dataset.st==='import'){sheet.hidden=true;$('fCsv').click();return}
  if(b.dataset.st==='clear'){tracks.forEach(t=>t.url&&URL.revokeObjectURL(t.url));tracks=[];cur=-1;au.pause();au.removeAttribute('src');dbClear();view={t:'all'};sheet.hidden=true;renderSide();render();updateBar();toast('Library cleared');return}
  if(b.dataset.ad!==undefined){const p=pls[+b.dataset.ad],k=tracks[+b.dataset.t].key;if(!p.keys.includes(k))p.keys.push(k);savePls();sheet.hidden=true;renderSide();return}
  if(b.dataset.mk!==undefined){const n=$('plName').value.trim();if(!n)return;const p={name:n,keys:[]},id=+b.dataset.mk;if(id>=0)p.keys.push(tracks[id].key);pls.push(p);savePls();sheet.hidden=true;renderSide();if(view.t==='playlists')render()}
});

/* ---------- Playlist backup (CSV) ---------- */
const csvEsc=v=>{v=String(v==null?'':v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
function parseCsv(s){
  s=s.replace(/^\ufeff/,'');const out=[];let row=[],f='',q=false;
  for(let i=0;i<s.length;i++){const c=s[i];
    if(q){if(c==='"'){if(s[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
    else if(c==='"')q=true;
    else if(c===','){row.push(f);f=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&s[i+1]==='\n')i++;row.push(f);f='';out.push(row);row=[]}
    else f+=c}
  if(f!==''||row.length){row.push(f);out.push(row)}
  return out.filter(r=>r.some(x=>x.trim()!==''));
}
async function saveCsv(text,name){
  const blob=new Blob(['\ufeff'+text],{type:'text/csv'});
  try{const file=new File([blob],name,{type:'text/csv'});
    if(matchMedia('(hover:none)').matches&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});return}
  }catch(e){if(e&&e.name==='AbortError')return}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);
}
function exportPlaylists(){
  const byKey=new Map(tracks.map(t=>[t.key,t])),rows=[['Playlist','Title','Artist','Album','File','Size']];
  pls.forEach(p=>{
    if(!p.keys.length){rows.push([p.name,'','','','','']);return}
    p.keys.forEach(k=>{const t=byKey.get(k),i=k.lastIndexOf('|');rows.push([p.name,t?t.title:'',t?t.artist:'',t?t.album:'',k.slice(0,i),k.slice(i+1)])});
  });
  saveCsv(rows.map(r=>r.map(csvEsc).join(',')).join('\r\n'),'playlists-backup-'+new Date().toISOString().slice(0,10)+'.csv');
  toast('Playlists exported');
}
function importPlaylists(text){
  if(!tracks.length){toast('Add your songs first, then import');return}
  const rows=parseCsv(text);if(rows.length<2){toast('That file has no playlists');return}
  const h=rows[0].map(x=>x.trim().toLowerCase()),ix=n=>h.indexOf(n);
  const iP=ix('playlist'),iT=ix('title'),iA=ix('artist'),iAl=ix('album'),iF=ix('file'),iS=ix('size');
  if(iP<0){toast("That doesn't look like a playlist backup");return}
  const byKey=new Map(tracks.map(t=>[t.key,t])),byName=new Map(),byMeta=new Map();
  const meta=(a,b,c)=>[a,b,c].map(x=>String(x||'').trim().toLowerCase()).join('|');
  tracks.forEach(t=>{if(!byName.has(t.file.name))byName.set(t.file.name,t);const m=meta(t.title,t.artist,t.album);if(!byMeta.has(m))byMeta.set(m,t)});
  const g=(r,i)=>i>=0?(r[i]||''):'';
  let added=0,missing=0;const touched=new Set();
  rows.slice(1).forEach(r=>{
    const name=g(r,iP).trim();if(!name)return;
    let p=pls.find(x=>x.name.trim().toLowerCase()===name.toLowerCase());
    if(!p){p={name,keys:[]};pls.push(p)}
    touched.add(p);
    const file=g(r,iF),title=g(r,iT);if(!file&&!title)return;
    const t=byKey.get(file+'|'+g(r,iS))||byName.get(file)||byMeta.get(meta(title,g(r,iA),g(r,iAl)));
    if(!t){missing++;return}
    if(!p.keys.includes(t.key)){p.keys.push(t.key);added++}
  });
  savePls();renderSide();render();
  toast('Imported '+touched.size+' playlists · '+added+' songs added'+(missing?' · '+missing+' not found':''));
}
$('fCsv').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)importPlaylists(await f.text())};
document.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'&&e.target.type!=='range')return;if(e.code==='Space'){e.preventDefault();$('bPlay').click()}else if(e.code==='ArrowRight'&&e.shiftKey)step(1);else if(e.code==='ArrowLeft'&&e.shiftKey)step(-1)});
if('mediaSession' in navigator){const ms=navigator.mediaSession,h=(a,f)=>{try{ms.setActionHandler(a,f)}catch(e){}};
  h('play',()=>au.play());h('pause',()=>au.pause());h('nexttrack',()=>step(1));h('previoustrack',()=>$('bPrev').click());
  h('seekto',d=>{if(d.seekTime!=null)au.currentTime=d.seekTime});
  const pos=()=>{try{if(isFinite(au.duration))ms.setPositionState({duration:au.duration,position:Math.min(au.currentTime,au.duration),playbackRate:au.playbackRate||1})}catch(e){}};
  au.addEventListener('loadedmetadata',pos);au.addEventListener('seeked',pos);
  au.addEventListener('play',()=>{ms.playbackState='playing';pos()});au.addEventListener('pause',()=>{ms.playbackState='paused';pos()})}

/* Android notification bridge: Capacitor (capacitor-v3-music-controls) or Cordova (cordova-plugin-music-controls2). Does nothing in a normal browser. */
const NC=(()=>{
  let P=null,kind='',on=false,lis=false;
  const get=()=>{if(P)return P;try{if(window.MusicControls){P=window.MusicControls;kind='c'}else if(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform()){P=Capacitor.registerPlugin('CapacitorMusicControls');kind='p'}}catch(e){}return P};
  const evt=raw=>{let m=raw;try{if(typeof raw==='string')m=JSON.parse(raw)}catch(e){return}
    switch(m&&m.message){
      case 'music-controls-next':step(1);break;
      case 'music-controls-previous':$('bPrev').click();break;
      case 'music-controls-pause':case 'music-controls-headset-unplugged':au.pause();break;
      case 'music-controls-play':au.play();break;
      case 'music-controls-toggle-play-pause':au.paused?au.play():au.pause();break;
      case 'music-controls-seek-to':if(m.position!=null)au.currentTime=+m.position;break;
      case 'music-controls-destroy':au.pause();on=false}};
  const toData=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.onerror=()=>r(undefined);f.readAsDataURL(b)});
  return{
    async track(t){const p=get();if(!p)return;try{
      const o={track:t.title,artist:t.artist,album:t.album,cover:t.coverBlob?await toData(t.coverBlob):undefined,isPlaying:true,dismissable:false,hasPrev:true,hasNext:true,hasClose:false,hasScrubbing:true,duration:t.dur||0,elapsed:0,ticker:'Now playing '+t.title,notificationIcon:'notification'};
      if(kind==='c'){p.create(o,()=>{},()=>{});if(!lis){p.subscribe(evt);p.listen();lis=true}}
      else{await p.create(o);if(!lis){p.addListener('controlsNotification',evt);lis=true}}
      on=true}catch(e){}},
    state(){const p=get();if(!p||!on)return;try{const s={elapsed:au.currentTime,isPlaying:!au.paused};if(kind==='c'){p.updateIsPlaying(!au.paused);p.updateElapsed(s)}else p.updateState(s)}catch(e){}}
  };
})();
['play','pause','seeked'].forEach(e=>au.addEventListener(e,()=>NC.state()));
render();updateBar();restore();try{navigator.storage.persist()}catch(e){}
