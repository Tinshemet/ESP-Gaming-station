/* Rock-Paper-Scissors — multiplayer, first to 3. Server reveals both picks at once. */
CAB.register({ id:"rps", name:"Rock Paper Scissors", icon:"✊", kind:"mp", pill:"1v1 · first to 3",
  desc:"best of five. read your cousin's soul.",
mount(stage, ctx){
  const EM={r:"🪨",p:"📄",s:"✂️"};
  const wrap=ctx.el("div",{style:"flex:1;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:16px"});
  const board=ctx.el("div",{class:"hud",style:"font-size:15px"});
  const big=ctx.el("div",{class:"big-msg",style:"font-size:clamp(22px,8vw,44px)"});
  const sub=ctx.el("div",{class:"hud"});
  const btns=ctx.el("div",{class:"ctrls"});
  wrap.append(board,big,sub,btns); stage.append(wrap);
  let duel=[0,0], names=["",""], amP=false, side=0, canPick=false;
  function setSide(){ amP=duel.indexOf(ctx.me.id)>=0; side=(duel[0]===ctx.me.id)?0:1; }
  ["r","p","s"].forEach(c=>btns.append(ctx.el("button",{class:"btn big2",text:EM[c],
    onclick:()=>{ if(!canPick||!amP) return; canPick=false; ctx.net.send({ev:"pick",c:c});
      big.textContent=EM[c]; big.style.color="var(--cyn)"; sub.textContent="locked in — waiting for them…"; }})));
  const scoreLine=s=>names[0]+" "+(s?s[0]:0)+" — "+(s?s[1]:0)+" "+names[1];
  ctx.net.on(m=>{
    if(m.ev==="wait"){ duel=[0,0]; big.textContent="✊✋✌️"; big.style.color="var(--dim)"; board.textContent="";
      sub.textContent="waiting for a challenger… ("+(m.have||0)+" here)"; canPick=false; }
    else if(m.ev==="round"){ duel=m.duel; names=m.names; setSide(); canPick=amP;
      board.textContent=scoreLine(m.score); big.textContent="?"; big.style.color="var(--ink)";
      sub.textContent=amP?"pick your throw 👇":"spectating this duel"; }
    else if(m.ev==="reveal"||m.ev==="match"){ duel=m.duel; names=m.names; setSide();
      board.textContent=scoreLine(m.score);
      const iWon=m.winnerId===ctx.me.id, tie=!m.winnerId;
      if(m.ev==="match" && amP && iWon) ctx.reportWin();
      if(amP){ const myT=side===0?m.c1:m.c2, opT=side===0?m.c2:m.c1;
        big.textContent=EM[myT]+" vs "+EM[opT]; big.style.color=tie?"var(--yel)":(iWon?"var(--grn)":"var(--red)");
        sub.textContent = m.ev==="match" ? (iWon?"🏆 YOU WIN THE MATCH":"you lost the match — rematch starting")
                        : (tie?"tie — throw again":(iWon?"you win the round":"you lose the round")); }
      else { big.textContent=EM[m.c1]+" vs "+EM[m.c2]; big.style.color="var(--cyn)";
        const wn=m.winnerId?(m.winnerId===duel[0]?names[0]:names[1]):null;
        sub.textContent = m.ev==="match" ? ((wn||"?")+" wins the match") : (tie?"tie":(wn||"?")+" takes the round"); }
      canPick=false; }
  });
  big.textContent="✊✋✌️"; sub.textContent="connecting to the arena…";
  return ()=>{};
}});
