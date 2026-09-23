/* Tinshemet's Gaming Cabinet — shell / framework.
 * Games register into CAB via CAB.register({id,name,icon,kind,mount}).
 *  kind 'sp'  -> single-player, pure client-side.
 *  kind 'mp'  -> multiplayer; mount() gets ctx.net to talk to the room over WS.
 */
(function(){
"use strict";
const WELCOME_DEFAULT =
  "Welcome to Tinshemet's Gaming Cabinet.\nBored — but too classy to look like a snob about it? Play away.";

const CAB = window.CAB = {
  games:{}, order:[],
  me:{id:null, name:"", admin:false},
  ws:null, connected:false,
  presence:[], chat:[], unread:0, leaders:[], vwins:[],
  tab:"solo", host:null, netHandler:null, curGame:null,
  welcome: WELCOME_DEFAULT,
};

/* ---------- tiny DOM helpers ---------- */
function el(tag, attrs, kids){
  const e=document.createElement(tag);
  if(attrs) for(const k in attrs){
    if(k==="class") e.className=attrs[k];
    else if(k==="html") e.innerHTML=attrs[k];
    else if(k==="text") e.textContent=attrs[k];
    else if(k.slice(0,2)==="on") e.addEventListener(k.slice(2), attrs[k]);
    else if(attrs[k]!=null) e.setAttribute(k, attrs[k]);
  }
  if(kids) (Array.isArray(kids)?kids:[kids]).forEach(c=>{ if(c!=null) e.append(c.nodeType?c:document.createTextNode(c)); });
  return e;
}
const app=()=>document.getElementById("app");
function clear(n){ while(n.firstChild) n.removeChild(n.firstChild); }
function save(k,v){ try{ localStorage.setItem("cab_"+k, v);}catch(e){} }
function load(k){ try{ return localStorage.getItem("cab_"+k);}catch(e){ return null; } }
function wipeLocal(){ try{ const ks=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.indexOf("cab_")===0&&k!=="cab_name") ks.push(k); } ks.forEach(k=>{ try{localStorage.removeItem(k);}catch(e){} }); }catch(e){} }
let toastT=null;
function toast(msg){
  let t=document.querySelector(".toast"); if(t) t.remove();
  t=el("div",{class:"toast",text:msg}); document.body.append(t);
  clearTimeout(toastT); toastT=setTimeout(()=>t.remove(),2200);
}
CAB.toast=toast;

/* ---------- registration ---------- */
CAB.register=function(g){ if(!CAB.games[g.id]){ CAB.order.push(g.id);} CAB.games[g.id]=g; };

/* ---------- boot / landing ---------- */
CAB.boot=function(){
  document.body.classList.add("crt");
  CAB.me.name = load("name") || "";
  landing();
};

function landing(){
  const a=app(); clear(a);
  const input=el("input",{class:"name-in",maxlength:16,placeholder:"pick a handle",value:CAB.me.name});
  const go=()=>{
    const n=(input.value||"").trim().slice(0,16) || ("guest"+Math.floor(Math.random()*900+100));
    CAB.me.name=n; save("name",n); connect(); lobby();
  };
  input.addEventListener("keydown",e=>{ if(e.key==="Enter") go(); });
  const lines=CAB.welcome.split("\n");
  a.append(el("div",{class:"land"},[
    el("div",{class:"tag blink",text:"● CABINET ONLINE"}),
    el("h1",{text:"TINSHEMET'S GAMING CABINET"}),
    el("div",{class:"sub"}, lines.map(l=>el("div",{text:l}))),
    input,
    el("button",{class:"big",text:"▶ ENTER",onclick:go}),
    el("div",{class:"sub",style:"font-size:12px",text:"no internet in here — that's the point."}),
  ]));
  setTimeout(()=>{ try{input.focus();}catch(e){} },100);
}

/* ---------- WebSocket ---------- */
function connect(){
  if(CAB.ws && (CAB.ws.readyState===0||CAB.ws.readyState===1)) return;
  let ws;
  try{ ws=new WebSocket("ws://"+location.hostname+":81/"); }catch(e){ setTimeout(connect,1500); return; }
  CAB.ws=ws;
  ws.onopen=()=>{ CAB.connected=true; send({t:"hello",name:CAB.me.name}); syncBar(); };
  ws.onclose=()=>{ CAB.connected=false; syncBar(); setTimeout(connect,1500); };
  ws.onerror=()=>{ try{ws.close();}catch(e){} };
  ws.onmessage=ev=>{ let m; try{ m=JSON.parse(ev.data);}catch(e){ return; } dispatch(m); };
}
function send(obj){ try{ if(CAB.ws && CAB.ws.readyState===1) CAB.ws.send(JSON.stringify(obj)); }catch(e){} }
CAB.send=send;

function dispatch(m){
  switch(m.t){
    case "welcome": CAB.me.id=m.id; if(m.welcome){CAB.welcome=m.welcome;} break;
    case "presence": CAB.presence=m.users||[]; syncBar(); if(CAB.tab==="admin"||CAB.tab==="versus") renderView(); if(CAB.host) refreshRoomBadge(); break;
    case "chatlog": CAB.chat=m.items||[]; if(CAB.tab==="chat") renderView(); break;
    case "chat":
      CAB.chat.push(m); if(CAB.chat.length>120) CAB.chat.shift();
      if(CAB.tab==="chat") appendChat(m); else { CAB.unread++; syncTabs(); }
      break;
    case "admin_ok":
      CAB.me.admin=!!m.ok; toast(m.ok?"admin unlocked":"wrong PIN"); if(CAB.tab==="admin") renderView(); break;
    case "leaders": CAB.leaders=m.items||[]; CAB.vwins=m.vwins||[]; if(CAB.tab==="board") renderView(); break;
    case "wipe": wipeLocal(); toast("all game progress reset by host"); if(CAB.host) closeGame(); if(CAB.tab!=="chat") renderView(); break;
    case "sys": toast(m.text); break;
    case "kicked": toast("removed by admin"); if(CAB.host) closeGame(); break;
    case "welcome_set": CAB.welcome=m.welcome; break;
    case "room": case "net":
      if(CAB.netHandler && m.game===CAB.curGame) CAB.netHandler(m);
      break;
  }
}

/* ---------- lobby shell ---------- */
function lobby(){
  const a=app(); clear(a);
  a.append(bar(), tabs(), el("div",{id:"view",class:"view"}));
  renderView();
}
function bar(){
  return el("div",{class:"bar"},[
    el("span",{class:"brand",text:"▚ CABINET"}),
    el("span",{id:"conn",html:'<span class="dot"></span>…'}),
    el("span",{class:"who",id:"who",text:CAB.me.name}),
  ]);
}
function tabItems(){
  const t=[["solo","SOLO"],["versus","VERSUS"],["board","🏆"],["chat","CHAT"]];
  t.push(["admin", CAB.me.admin?"ADMIN⚙":"ADMIN"]);
  return t;
}
function tabs(){
  const wrap=el("div",{class:"tabs",id:"tabs"});
  tabItems().forEach(([id,label])=>{
    const b=el("button",{class:"tab"+(CAB.tab===id?" on":""),onclick:()=>{ CAB.tab=id; if(id==="chat"){CAB.unread=0;} syncTabs(); renderView(); }},[label]);
    if(id==="chat"&&CAB.unread) b.append(el("span",{class:"badge",text:CAB.unread}));
    b.dataset.id=id; wrap.append(b);
  });
  return wrap;
}
function syncTabs(){ const old=document.getElementById("tabs"); if(old) old.replaceWith(tabs()); }
function syncBar(){
  const c=document.getElementById("conn");
  if(c) c.innerHTML='<span class="dot'+(CAB.connected?" ok":"")+'"></span>'+(CAB.connected?(CAB.presence.length+" online"):"offline");
  const w=document.getElementById("who"); if(w) w.textContent=CAB.me.name+(CAB.me.admin?" ⚙":"");
}

function renderView(){
  const v=document.getElementById("view"); if(!v) return; clear(v);
  if(CAB.tab==="solo")   grid(v,"sp");
  else if(CAB.tab==="versus") grid(v,"mp");
  else if(CAB.tab==="board")  boardView(v);
  else if(CAB.tab==="chat")   chatView(v);
  else if(CAB.tab==="admin")  adminView(v);
  syncBar();
}

function grid(v,kind){
  const ids=CAB.order.filter(id=>CAB.games[id].kind===kind);
  v.append(el("div",{class:"section-h",text: kind==="sp"?"single player · "+ids.length+" games":"versus · pass-the-phone or 1v1 over wifi"}));
  const g=el("div",{class:"grid"});
  ids.forEach(id=>{
    const gm=CAB.games[id];
    const inRoom = kind==="mp" ? CAB.presence.filter(u=>u.room===id).length : 0;
    const waiting = inRoom===1;   // one lonely player waiting for an opponent
    const kids=[
      el("div",{class:"ico",text:gm.icon||"🎮"}),
      el("div",{class:"t",text:gm.name}),
      el("div",{class:"d",text:gm.desc||""}),
      el("div",{class:"pill",text: kind==="mp"?(gm.pill||"1v1"):"solo"}),
    ];
    if(waiting) kids.push(el("div",{class:"waitbadge",text:"● waiting — join!"}));
    g.append(el("div",{class:"card"+(kind==="mp"?" mp":"")+(waiting?" waiting":""),onclick:()=>openGame(id)}, kids));
  });
  if(!ids.length) g.append(el("div",{class:"d",text:"(loading…)"}));
  v.append(g);
}

/* ---------- game host overlay ---------- */
function openGame(id){
  const gm=CAB.games[id]; if(!gm) return;
  closeGame(true);
  CAB.curGame=id;
  const stage=el("div",{class:"stage"});
  const host=el("div",{class:"host"},[
    el("div",{class:"hbar"},[
      el("button",{class:"back",text:"‹ back",onclick:()=>closeGame()}),
      el("span",{class:"gt",text:(gm.icon||"")+" "+gm.name}),
      el("span",{id:"roomb",class:"who",style:"margin-left:auto"}),
    ]),
    stage,
  ]);
  CAB.host=host; document.body.append(host);

  const ctx={
    me:CAB.me, isAdmin:()=>CAB.me.admin, toast, save, load, el,
    close:()=>closeGame(),
    submitScore:(score,lower,sub)=>{ if(typeof score==="number" && isFinite(score)) send({t:"score",game:id+(sub?(":"+sub):""),score:Math.round(score),lo:!!lower}); },
    reportWin:()=>{ send({t:"win",game:id}); },
    net:{
      send:(obj)=>send(Object.assign({t:"net",game:id},obj)),
      on:(cb)=>{ CAB.netHandler=cb; },
      players:()=>CAB.presence.filter(u=>u.room===id),
    },
  };
  if(gm.kind==="mp") send({t:"join",game:id});
  refreshRoomBadge();
  try{ CAB.cleanup = gm.mount(stage, ctx) || null; }
  catch(e){ stage.append(el("div",{class:"big-msg",text:"⚠ game error"})); console.error(e); }
}
function closeGame(silent){
  if(!CAB.host){ return; }
  try{ if(typeof CAB.cleanup==="function") CAB.cleanup(); }catch(e){}
  const wasMp = CAB.curGame && CAB.games[CAB.curGame] && CAB.games[CAB.curGame].kind==="mp";
  if(wasMp && !silent) send({t:"leave",game:CAB.curGame});
  CAB.cleanup=null; CAB.netHandler=null; CAB.curGame=null;
  CAB.host.remove(); CAB.host=null;
}
function refreshRoomBadge(){
  const b=document.getElementById("roomb"); if(!b||!CAB.curGame) return;
  const gm=CAB.games[CAB.curGame]; if(gm.kind!=="mp"){ b.textContent=""; return; }
  const n=CAB.presence.filter(u=>u.room===CAB.curGame).length;
  b.textContent=n+" here";
}

/* ---------- chat ---------- */
function chatView(v){
  const box=el("div",{class:"chat"});
  const log=el("div",{class:"log",id:"clog"});
  CAB.chat.forEach(m=>log.append(chatMsg(m)));
  const input=el("input",{maxlength:200,placeholder:"message the room…"});
  const doSend=()=>{ const t=(input.value||"").trim(); if(!t) return; send({t:"chat",text:t}); input.value=""; };
  input.addEventListener("keydown",e=>{ if(e.key==="Enter") doSend(); });
  box.append(log, el("div",{class:"row"},[input, el("button",{class:"send",text:"▶",onclick:doSend})]));
  v.append(box);
  setTimeout(()=>{ log.scrollTop=log.scrollHeight; },30);
}
function chatMsg(m){
  if(m.sys||m.name==="*") return el("div",{class:"msg sys",text:m.text});
  const mine=m.id===CAB.me.id;
  return el("div",{class:"msg"+(mine?" me":"")},[ el("span",{class:"n",text:m.name+":"}), document.createTextNode(m.text) ]);
}
function appendChat(m){ const log=document.getElementById("clog"); if(!log) return; log.append(chatMsg(m)); log.scrollTop=log.scrollHeight; }

/* ---------- leaderboard ---------- */
function boardView(v){
  const box=el("div",{class:"admin"});
  // ---- versus wins ----
  const wl=el("div",{class:"who-list"});
  const vw=(CAB.vwins||[]).slice().sort((a,b)=>b.wins-a.wins);
  if(vw.length) vw.forEach((W,i)=>{ const mine=W.name===CAB.me.name;
    wl.append(el("div",{class:"who-row"},[
      el("span",{text:(i===0?"🥇":i===1?"🥈":i===2?"🥉":"　")+" "+W.name}),
      el("span",{class:"d",style:"margin-left:auto;color:"+(mine?"var(--grn)":"var(--cyn)"),text:W.wins+" win"+(W.wins===1?"":"s")}),
    ]));
  });
  else wl.append(el("div",{class:"d",text:"No duel wins yet — go win a versus match."}));
  box.append(el("div",{class:"acard"},[ el("h4",{text:"⚔ VERSUS WINS"}), wl ]));
  // ---- high-score records ----
  const list=el("div",{class:"who-list"});
  const rows=(CAB.leaders||[]).slice().sort((a,b)=>{ const ga=CAB.games[a.game],gb=CAB.games[b.game]; return (ga?ga.name:a.game).localeCompare(gb?gb.name:b.game); });
  if(rows.length) rows.forEach(L=>{ const parts=String(L.game).split(":"); const g=CAB.games[parts[0]];
    const label=(g?(g.icon+" "+g.name):parts[0])+(parts[1]?" "+parts[1]:""); const mine=L.name===CAB.me.name;
    list.append(el("div",{class:"who-row"},[
      el("span",{text:label}),
      el("span",{class:"d",style:"margin-left:auto;color:"+(mine?"var(--grn)":"var(--yel)"),text:"👑 "+L.name+" · "+L.score+(L.lo?" ↓":"")}),
    ]));
  });
  else list.append(el("div",{class:"d",text:"No records yet — finish a solo game to claim one."}));
  box.append(el("div",{class:"acard"},[ el("h4",{text:"🏆 HIGH-SCORE RECORDS"}), list ]));
  v.append(box);
}

/* ---------- admin ---------- */
function adminView(v){
  const box=el("div",{class:"admin"});
  if(!CAB.me.admin){
    const pin=el("input",{type:"tel",maxlength:8,placeholder:"admin PIN"});
    const unlock=()=>{ send({t:"admin",pin:(pin.value||"").trim()}); };
    pin.addEventListener("keydown",e=>{ if(e.key==="Enter") unlock(); });
    box.append(
      el("div",{class:"acard"},[
        el("h4",{text:"HOST ACCESS"}),
        el("div",{class:"d",style:"color:var(--dim);margin-bottom:8px",text:"Enter the cabinet PIN to run the room. You still play everything as a normal player."}),
        el("div",{class:"lock"},[pin, el("button",{class:"tab",text:"UNLOCK",onclick:unlock})]),
      ]));
    v.append(box); return;
  }
  // unlocked controls
  const who=el("div",{class:"who-list"});
  CAB.presence.forEach(u=>{
    who.append(el("div",{class:"who-row"},[
      el("span",{text:u.name}),
      u.admin?el("span",{class:"tag-admin",text:"host"}):null,
      u.room?el("span",{class:"d",text:"· "+u.room}):null,
      (u.id!==CAB.me.id)?el("button",{class:"kick",style:"margin-left:auto",text:"kick",onclick:()=>send({t:"acmd",cmd:"kick",id:u.id})}):null,
      (u.id!==CAB.me.id)?el("button",{class:"kick",style:"border-color:var(--mag);color:var(--mag)",text:"ban",onclick:()=>{ if(confirm("Ban "+u.name+"? They can't rejoin until reboot.")) send({t:"acmd",cmd:"ban",id:u.id}); }}):null,
    ]));
  });
  const wtxt=el("textarea",{class:"name-in",style:"width:100%;height:64px;text-align:left",text:CAB.welcome});
  box.append(
    el("div",{class:"acard"},[ el("h4",{text:"WHO'S IN THE ROOM ("+CAB.presence.length+")"}), who ]),
    el("div",{class:"acard"},[ el("h4",{text:"CHAT"}),
      el("button",{class:"tab",text:"clear chat",onclick:()=>send({t:"acmd",cmd:"clearchat"})}) ]),
    el("div",{class:"acard"},[ el("h4",{text:"LEADERBOARD"}),
      el("button",{class:"tab",text:"reset all records",onclick:()=>{ send({t:"acmd",cmd:"resetleaders"}); toast("leaderboard cleared"); }}) ]),
    el("div",{class:"acard"},[ el("h4",{text:"GAME DATA"}),
      el("div",{class:"d",style:"margin-bottom:8px",text:"Wipes everyone's saved progress on their own phones — idle clicker, blackjack chips, high scores, best times — and clears the leaderboard."}),
      el("button",{class:"tab",style:"border-color:var(--red);color:var(--red)",text:"reset ALL game data",onclick:()=>{ if(confirm("Reset ALL saved game progress for everyone connected (idle clicker, blackjack, high scores) + the leaderboard? Can't be undone.")) { send({t:"acmd",cmd:"resetall"}); toast("resetting everyone…"); } }}) ]),
    el("div",{class:"acard"},[ el("h4",{text:"VERSUS ROOMS"}),
      el("button",{class:"tab",text:"reset all duels",onclick:()=>send({t:"acmd",cmd:"resetrooms"})}) ]),
    el("div",{class:"acard"},[ el("h4",{text:"WELCOME TEXT"}), wtxt,
      el("button",{class:"tab",style:"margin-top:8px",text:"save",onclick:()=>{ send({t:"acmd",cmd:"welcome",text:wtxt.value}); toast("welcome updated"); }}) ]),
  );
  v.append(box);
}

})();
