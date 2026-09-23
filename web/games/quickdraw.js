/* Quick-Draw duel — multiplayer, server-timed.
 * Two duelists; everyone else spectates. Wait for GREEN, then tap. Tap early = you lose. */
CAB.register({ id:"quickdraw", name:"Quick-Draw", icon:"⚡", kind:"mp", pill:"1v1 duel",
  desc:"wait for green. first tap wins. flinch = lose.",
mount(stage, ctx){
  const scr=ctx.el("div",{style:"flex:1;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;transition:background .08s;padding:16px"});
  const big=ctx.el("div",{class:"big-msg"});
  const sub=ctx.el("div",{class:"hud",style:"font-size:15px;margin-top:14px"});
  const board=ctx.el("div",{class:"hud",style:"margin-top:18px;font-size:14px"});
  scr.append(big, sub, board); stage.append(scr);

  let phase="wait", amDuelist=false;
  const setBg=c=>{ scr.style.background = c; };

  function iAm(duel){ return duel && duel.indexOf(ctx.me.id)>=0; }
  function scoreLine(names,score){ return (names&&names.length===2)? (names[0]+"  "+ (score?score[0]:0) +" — "+ (score?score[1]:0) +"  "+names[1]) : ""; }

  ctx.net.on(m=>{
    if(m.ev==="wait"){ phase="wait"; amDuelist=false; setBg("#0e141c");
      big.textContent="⚡"; big.style.color="var(--dim)";
      sub.textContent = (m.have>=1?"Waiting for a challenger…":"Waiting for players…")+" ("+m.have+" here)";
      board.textContent="two phones needed. get a cousin over here.";
    }
    else if(m.ev==="round"){ phase="set"; amDuelist=iAm(m.duel); setBg("#241016");
      big.textContent="READY…"; big.style.color="var(--red)";
      sub.textContent = amDuelist ? "wait for GREEN… do NOT tap early" : "watching a duel";
      board.textContent=scoreLine(m.names,m.score);
    }
    else if(m.ev==="go"){ phase="go"; setBg("#0c3");
      big.textContent="DRAW!"; big.style.color="#052";
      sub.textContent = amDuelist ? "TAP!!" : "watching…";
    }
    else if(m.ev==="result"){ phase="result";
      const iWon=m.winnerId===ctx.me.id;
      if(amDuelist && iWon) ctx.reportWin();
      const reason = m.reason==="falsestart" ? "false start!" : "clean draw";
      if(amDuelist){ setBg(iWon?"#0a3":"#301018"); big.style.color=iWon?"#cffce0":"var(--red)";
        big.textContent=iWon?"YOU WON 🏆":"too slow 💀"; }
      else { setBg("#0e141c"); big.style.color="var(--cyn)"; big.textContent=(m.winnerName||"?")+" wins"; }
      sub.textContent=reason+" · next round shortly…";
      board.textContent=scoreLine(m.names,m.score);
    }
  });

  function fire(){ if(phase==="set"||phase==="go"){ ctx.net.send({ev:"tap"}); } }
  scr.addEventListener("touchstart",e=>{ e.preventDefault(); fire(); },{passive:false});
  scr.addEventListener("mousedown",fire);
  const key=e=>{ if(e.key===" "||e.key==="Enter") fire(); };
  window.addEventListener("keydown",key);

  big.textContent="⚡"; sub.textContent="connecting to the range…";
  return ()=>{ window.removeEventListener("keydown",key); };
}});
