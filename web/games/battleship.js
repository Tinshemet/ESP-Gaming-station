/* Battleship — 1v1 over the relay. Random fleet, ready up, alternate fire. */
CAB.register({ id:"battleship", name:"Battleship", icon:"🚢", kind:"mp", pill:"1v1 · turns",
  desc:"sink their fleet. tap the grid to fire.",
mount(stage, ctx){
  const N=7, SHIPS=[4,3,2];
  let players=[], mySeat=-1, phase="wait", myTurn=false, iReady=false, oppReady=false, over=false;
  let my=Array(N*N).fill(0);   // 0 empty,1 ship,2 hit,3 miss(on me)
  let shots=Array(N*N).fill(0);// tracking of my fire: 0 unknown,1 hit,2 miss
  const seated=()=>mySeat===0||mySeat===1;
  const oppId=()=> (players[1-mySeat]||{}).id;

  const wrap=ctx.el("div",{style:"flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px;width:100%;overflow:auto"});
  const info=ctx.el("div",{class:"hud",style:"font-size:15px"});
  const fireWrap=ctx.el("div",{style:"width:100%"}), myWrap=ctx.el("div",{style:"width:100%"}), ctrls=ctx.el("div",{class:"ctrls"});
  wrap.append(info,fireWrap,myWrap,ctrls); stage.append(wrap);

  function placeRandom(){ my=Array(N*N).fill(0);
    for(const len of SHIPS){ let ok=false,t=0;
      while(!ok&&t++<300){ const h=Math.random()<0.5, r=(Math.random()*N)|0, c=(Math.random()*N)|0, cells=[]; let fits=true;
        for(let k=0;k<len;k++){ const rr=r+(h?0:k), cc=c+(h?k:0); if(rr>=N||cc>=N||my[rr*N+cc]){fits=false;break;} cells.push(rr*N+cc); }
        if(fits){ cells.forEach(i=>my[i]=1); ok=true; } } } }
  function gridEl(cells, tapFn, owner){ const g=ctx.el("div",{style:"display:grid;grid-template-columns:repeat("+N+",1fr);gap:3px;width:min(78vw,300px);margin:2px auto"});
    for(let i=0;i<N*N;i++){ const v=cells[i]; let bg;
      if(owner) bg = v===1?"#2a6f5a": v===2?"#ff5d5d": v===3?"#2a3b4d":"#0b1420";
      else      bg = v===1?"#ff5d5d": v===2?"#2a3b4d":"#0e1826";
      const c=ctx.el("div",{style:"aspect-ratio:1;border-radius:4px;background:"+bg+";box-shadow:inset 0 0 0 1px #14304a"});
      if(tapFn) c.addEventListener("click",()=>tapFn(i)); g.append(c); }
    return g; }
  const shipsAlive=()=>my.reduce((n,v)=>n+(v===1?1:0),0);
  function render(){
    fireWrap.innerHTML=""; myWrap.innerHTML=""; ctrls.innerHTML="";
    if(!seated()){ info.textContent = players.length<2?"waiting for players…":"spectating a naval battle"; return; }
    if(players.length<2){ info.textContent="waiting for an opponent…"; return; }
    if(phase==="place"){ info.textContent = iReady?"waiting for opponent…":"position your fleet";
      myWrap.append(ctx.el("div",{class:"hud",text:"your waters"}), gridEl(my,null,true));
      if(!iReady) ctrls.append(
        ctx.el("button",{class:"btn",text:"🎲 shuffle",onclick:()=>{ placeRandom(); render(); }}),
        ctx.el("button",{class:"btn grn",text:"✓ ready",onclick:()=>{ iReady=true; ctx.net.send({ev:"ready"}); maybeStart(); render(); }}));
      return; }
    if(!over) info.textContent = myTurn?"YOUR turn — fire!":"opponent is aiming…";
    fireWrap.append(ctx.el("div",{class:"hud",text:"enemy waters — tap to fire"}), gridEl(shots, (myTurn&&!over)?fire:null, false));
    myWrap.append(ctx.el("div",{class:"hud",text:"your fleet"}), gridEl(my,null,true));
  }
  function maybeStart(){ if(iReady&&oppReady&&phase==="place"){ phase="battle"; myTurn=(mySeat===0); over=false; render(); } }
  function fire(i){ if(!myTurn||over||shots[i]) return; myTurn=false; ctx.net.send({ev:"fire",i:i}); render(); }
  ctx.net.on(m=>{
    if(m.ev==="seats"){ players=m.players||[]; mySeat=players.findIndex(p=>p.id===ctx.me.id);
      if(seated()&&phase==="wait"&&players.length>=2){ phase="place"; if(my.every(x=>!x)) placeRandom(); }
      render(); return; }
    if(!seated()) return;                 // spectators ignore game traffic
    if(m.ev==="ready"){ if(m.from===oppId()){ oppReady=true; maybeStart(); render(); } }
    else if(m.ev==="fire"){ if(m.from!==oppId()) return; const i=m.i;
      const hit = my[i]===1; my[i] = hit?2:(my[i]===0?3:my[i]);
      const dead = shipsAlive()===0;
      ctx.net.send({ev:"result",i:i,hit:hit,dead:dead});
      if(dead){ over=true; info.textContent="💥 your fleet is sunk — you lose"; } else { myTurn=true; }
      render(); }
    else if(m.ev==="result"){ if(m.from!==oppId()) return; shots[m.i]=m.hit?1:2;
      if(m.dead){ over=true; info.textContent="🏆 enemy fleet destroyed — YOU WIN"; ctx.reportWin(); }
      render(); }
  });
  render();
  return ()=>{};
}});
