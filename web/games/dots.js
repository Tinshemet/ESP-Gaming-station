/* Dots & Boxes — 1v1 over the relay. Deterministic: both apply (edge,seat). */
CAB.register({ id:"dots", name:"Dots & Boxes", icon:"🔵", kind:"mp", pill:"1v1 · turns",
  desc:"claim edges, close boxes, own the grid.",
mount(stage, ctx){
  const R=3, C=3, GY=2*R+1, GX=2*C+1;
  let players=[], mySeat=-1, turn=0, claimed={}, owner={}, scores=[0,0], over=false, started=false, reported=false;
  const key=(y,x)=>y+","+x;
  const wrap=ctx.el("div",{style:"flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:14px;width:100%"});
  const info=ctx.el("div",{class:"hud",style:"font-size:15px"});
  const grid=ctx.el("div",{style:"display:grid;grid-template-columns:repeat("+GX+",1fr);gap:0;width:min(86vw,320px)"});
  const btn=ctx.el("button",{class:"btn cyn",style:"display:none",text:"↺ rematch"});
  wrap.append(info,grid,btn); stage.append(wrap);

  function reset(){ claimed={}; owner={}; scores=[0,0]; turn=0; over=false; reported=false; }
  const isEdge=(y,x)=>((y%2===0)!==(x%2===0));
  function boxesFor(y,x){ const b=[];
    if(y%2===0){ if(y-1>=1)b.push([y-1,x]); if(y+1<=GY-2)b.push([y+1,x]); }
    else { if(x-1>=1)b.push([y,x-1]); if(x+1<=GX-2)b.push([y,x+1]); }
    return b; }
  const boxDone=(by,bx)=>claimed[key(by-1,bx)]&&claimed[key(by+1,bx)]&&claimed[key(by,bx-1)]&&claimed[key(by,bx+1)];
  function apply(y,x,seat){ if(claimed[key(y,x)]) return; claimed[key(y,x)]=seat+1; let got=0;
    boxesFor(y,x).forEach(([by,bx])=>{ if(owner[key(by,bx)]==null && boxDone(by,bx)){ owner[key(by,bx)]=seat; scores[seat]++; got++; } });
    if(got===0) turn=1-turn;
    if(scores[0]+scores[1]>=R*C) over=true; }
  const seatCol=s=>s===0?"var(--grn)":"var(--mag)";
  function render(){
    grid.innerHTML="";
    for(let y=0;y<GY;y++) for(let x=0;x<GX;x++){
      const c=ctx.el("div",{style:"aspect-ratio:1;position:relative"});
      if(y%2===0&&x%2===0){ c.style.display="flex"; c.style.alignItems="center"; c.style.justifyContent="center";
        c.append(ctx.el("div",{style:"width:7px;height:7px;border-radius:50%;background:var(--dim)"})); }
      else if(y%2===1&&x%2===1){ const o=owner[key(y,x)];
        if(o!=null) c.style.background = o===0?"rgba(124,255,178,.18)":"rgba(255,106,213,.18)";
        c.style.borderRadius="3px"; }
      else { const cl=claimed[key(y,x)]; const horiz=(y%2===0);
        const line=ctx.el("div",{style:"position:absolute;"+(horiz?"top:50%;left:6%;right:6%;height:4px;transform:translateY(-50%)":"left:50%;top:6%;bottom:6%;width:4px;transform:translateX(-50%)")+";border-radius:3px;background:"+(cl?seatCol(cl-1):"#1d2836")});
        c.append(line);
        if(!cl && !over) c.addEventListener("click",()=>tap(y,x)); }
      grid.append(c);
    }
    const meP = mySeat>=0&&mySeat<=1;
    let msg;
    if(!meP) msg = players.length<2?"waiting for players…":"spectating "+scores[0]+"–"+scores[1];
    else if(players.length<2) msg="waiting for an opponent…";
    else { const you=mySeat===0?"🟢":"🟣"; const sc=" "+you+" you "+scores[mySeat]+" — "+scores[1-mySeat]+" them";
      msg = over ? ((scores[mySeat]>scores[1-mySeat]?"🏆 you win":scores[mySeat]<scores[1-mySeat]?"you lose":"tie")+sc)
                 : ((turn===mySeat?"your turn":"opponent's turn")+sc); }
    info.textContent=msg;
    btn.style.display=(over&&meP&&players.length>=2)?"":"none";
    if(over && meP && scores[mySeat]>scores[1-mySeat] && !reported){ reported=true; ctx.reportWin(); }
  }
  function tap(y,x){ if(over||mySeat<0||mySeat>1||turn!==mySeat||claimed[key(y,x)]) return;
    apply(y,x,mySeat); ctx.net.send({ev:"edge",y:y,x:x,seat:mySeat}); render(); }
  function newGame(){ reset(); ctx.net.send({ev:"reset"}); render(); }
  btn.addEventListener("click",newGame);
  ctx.net.on(m=>{
    if(m.ev==="seats"){ players=m.players||[]; mySeat=players.findIndex(p=>p.id===ctx.me.id);
      if(mySeat===0 && players.length>=2 && !started){ started=true; reset(); ctx.net.send({ev:"reset"}); } render(); }
    else if(m.ev==="edge"){ apply(m.y,m.x,m.seat); started=true; render(); }
    else if(m.ev==="reset"){ reset(); started=true; render(); }
  });
  render();
  return ()=>{};
}});
