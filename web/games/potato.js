/* Hot Potato — N players over the relay. seat0 hosts the bomb + fuse. */
CAB.register({ id:"potato", name:"Hot Potato", icon:"💣", kind:"mp", pill:"party · pass",
  desc:"pass the bomb before it blows. holder loses.",
mount(stage, ctx){
  let players=[], mySeat=-1, amHost=false, holderId=0, timers=[], fuseTimer=null, hostId=0;
  const T=(fn,ms)=>{ const id=setTimeout(fn,ms); timers.push(id); return id; };
  const clearT=()=>{ timers.forEach(clearTimeout); timers=[]; };
  let hFuseEnd=0;

  const scr=ctx.el("div",{style:"flex:1;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;transition:background .1s;padding:16px;gap:14px"});
  const big=ctx.el("div",{class:"big-msg",style:"font-size:clamp(26px,8vw,48px)"});
  const sub=ctx.el("div",{class:"hud",style:"font-size:15px"});
  const barWrap=ctx.el("div",{style:"width:min(80vw,320px);height:10px;background:var(--panel);border:1px solid var(--line);border-radius:999px;overflow:hidden"});
  const bar=ctx.el("div",{style:"height:100%;width:100%;background:linear-gradient(90deg,var(--red),var(--yel));transition:width .1s linear"});
  barWrap.append(bar);
  const passBtn=ctx.el("button",{class:"btn big2 red",style:"display:none;width:min(80vw,320px)",text:"🔥 PASS IT!"});
  scr.append(big,sub,barWrap,passBtn); stage.append(scr);

  const nameOf=id=>{ const p=players.find(x=>x.id===id); return p?p.name:"someone"; };
  function stopFuse(){ if(fuseTimer){ clearInterval(fuseTimer); fuseTimer=null; } }
  function runFuse(ms){ stopFuse(); const end=Date.now()+ms; bar.style.width="100%";
    fuseTimer=setInterval(()=>{ const left=Math.max(0,end-Date.now()); bar.style.width=(left/ms*100)+"%"; if(left<=0) stopFuse(); },100); }
  function showHold(fuse){ const mine=holderId===ctx.me.id;
    scr.style.background = mine?"#301018":"#0e141c"; big.textContent = mine?"🔥 IT'S YOU!":"💣";
    big.style.color = mine?"var(--red)":"var(--ink)";
    sub.textContent = mine?"PASS before it blows!":(nameOf(holderId)+" is holding it…");
    passBtn.style.display = mine?"":"none"; runFuse(fuse); }
  function showBoom(loserId){ stopFuse(); const me=loserId===ctx.me.id; scr.style.background=me?"#3a0d0d":"#0e141c";
    big.textContent=me?"💥 YOU BLEW UP":(nameOf(loserId)+" exploded 💥"); big.style.color=me?"var(--red)":"var(--yel)";
    sub.textContent="new round shortly…"; passBtn.style.display="none"; bar.style.width="0%"; }
  function doPass(){ if(holderId!==ctx.me.id) return; if(amHost) hostPass(ctx.me.id); else ctx.net.send({ev:"pass"}); passBtn.style.display="none"; }
  passBtn.addEventListener("click",doPass);

  // host
  function hostStart(){ if(!amHost)return; if(players.length<2){ return; }
    holderId=players[(Math.random()*players.length)|0].id; hFuseEnd=Date.now()+ (9000+Math.random()*13000|0);
    hostHold(); scheduleBoom(); }
  function scheduleBoom(){ clearT(); T(hostBoom, Math.max(0,hFuseEnd-Date.now())); }
  function hostHold(){ ctx.net.send({ev:"hold",holderId:holderId,fuse:Math.max(0,hFuseEnd-Date.now())}); showHold(Math.max(0,hFuseEnd-Date.now())); }
  function hostPass(fromId){ if(!amHost||fromId!==holderId)return; const others=players.filter(p=>p.id!==holderId);
    if(!others.length) return; holderId=others[(Math.random()*others.length)|0].id; hostHold(); }
  function hostBoom(){ if(!amHost)return; ctx.net.send({ev:"boom",loserId:holderId}); showBoom(holderId); holderId=0; T(hostStart,4500); }   // no live bomb between rounds

  ctx.net.on(m=>{
    if(m.ev==="seats"){ players=m.players||[]; mySeat=players.findIndex(p=>p.id===ctx.me.id); amHost=(mySeat===0);
      const h=players.length>=2?players[0].id:0;
      if(!h){ hostId=0; clearT(); holderId=0; stopFuse(); big.textContent="💣"; big.style.color="var(--dim)"; sub.textContent="waiting for players… ("+(m.have||0)+" in)"; passBtn.style.display="none"; bar.style.width="100%"; scr.style.background="#0e141c"; }
      else if(h!==hostId){ hostId=h; clearT(); holderId=0;   // host changed (left, or first start): seat0 deals a fresh bomb
        if(amHost) hostStart(); else { stopFuse(); big.textContent="💣"; big.style.color="var(--ink)"; sub.textContent="next round starting…"; passBtn.style.display="none"; scr.style.background="#0e141c"; } }
      else if(amHost && holderId && !players.some(p=>p.id===holderId)){   // holder walked off with it: hand it on, same fuse
        holderId=players[(Math.random()*players.length)|0].id; hostHold(); }
      return; }
    if(m.ev==="pass"){ if(amHost) hostPass(m.from); return; }
    if(m.from!==hostId) return;                     // hold/boom only count from the current host
    if(m.ev==="hold"){ holderId=m.holderId; showHold(m.fuse!=null?m.fuse:10000); }
    else if(m.ev==="boom"){ showBoom(m.loserId); }
  });
  big.textContent="💣"; sub.textContent="connecting…";
  return ()=>{ clearT(); stopFuse(); };
}});
