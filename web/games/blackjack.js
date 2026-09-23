/* Blackjack — beat the dealer to 21. Dealer stands on 17, blackjack pays 3:2. */
CAB.register({ id:"blackjack", name:"Blackjack", icon:"♠️", kind:"sp", desc:"hit, stand, pray. 3:2 on blackjack.",
mount(stage, ctx){
  const MINBET=5, START=100;
  let bankroll=+(ctx.load("bj_bank")); if(!isFinite(bankroll)||ctx.load("bj_bank")===null) bankroll=START;
  let best=+(ctx.load("bj_best")||bankroll); if(bankroll>best) best=bankroll;
  let bet=Math.min(25, Math.max(MINBET, bankroll));
  let deck=[], player=[], dealer=[], phase="bet", handBet=0, msg="", holeHidden=true;

  const wrap=ctx.el("div",{style:"display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:420px;margin:0 auto;padding:8px"});
  const hud=ctx.el("div",{class:"hud"});
  const table=ctx.el("div",{style:"width:100%;display:flex;flex-direction:column;gap:12px"});
  const dealerRow=ctx.el("div",{style:"display:flex;flex-direction:column;gap:6px;align-items:center"});
  const playerRow=ctx.el("div",{style:"display:flex;flex-direction:column;gap:6px;align-items:center"});
  const msgEl=ctx.el("div",{style:"min-height:26px;text-align:center;font-size:16px;font-weight:700"});
  const rules=ctx.el("div",{style:"font-size:11.5px;color:var(--dim);text-align:center;line-height:1.45;max-width:330px",
    html:"Get closer to <b>21</b> than the dealer — without going over. Face cards=10, Ace=1 or 11. Dealer draws to 17. Blackjack pays 3:2."});
  const prompt=ctx.el("div",{style:"text-align:center;font-size:13px;color:var(--cyn);min-height:18px;font-weight:600"});
  const ctrls=ctx.el("div",{class:"ctrls",style:"padding:6px"});
  table.append(dealerRow, msgEl, playerRow);
  wrap.append(hud, rules, table, prompt, ctrls); stage.append(wrap);

  const SUITS=[["♠","b"],["♥","r"],["♦","r"],["♣","b"]];
  const RANKS=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  function buildDeck(){
    deck=[];
    for(const [s,col] of SUITS) for(const r of RANKS) deck.push({r,s,col});
    for(let i=deck.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=deck[i]; deck[i]=deck[j]; deck[j]=t; }
  }
  function drawCard(){ if(deck.length<8) buildDeck(); return deck.pop(); }
  function cardVal(c){ if(c.r==="A") return 11; if(c.r==="K"||c.r==="Q"||c.r==="J"||c.r==="10") return 10; return +c.r; }
  function handTotal(h){
    let t=0, aces=0;
    for(const c of h){ t+=cardVal(c); if(c.r==="A") aces++; }
    while(t>21 && aces>0){ t-=10; aces--; }
    return t;
  }
  function isBlackjack(h){ return h.length===2 && handTotal(h)===21; }

  function cardEl(c, hidden){
    if(hidden) return ctx.el("div",{style:"width:44px;height:62px;border-radius:8px;border:1px solid var(--line);background:repeating-linear-gradient(45deg,var(--bg2) 0 6px,var(--panel) 6px 12px);display:flex;align-items:center;justify-content:center;color:var(--dim);font-size:20px",text:"?"});
    const color=c.col==="r"?"var(--red)":"var(--ink)";
    return ctx.el("div",{style:"width:44px;height:62px;border-radius:8px;border:1px solid var(--line);background:#f2f5f8;color:"+(c.col==="r"?"#c1121f":"#0b0f14")+";display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:700;line-height:1",html:"<span style='font-size:16px'>"+c.r+"</span><span style='font-size:18px'>"+c.s+"</span>"});
  }
  function renderHands(){
    dealerRow.innerHTML=""; playerRow.innerHTML="";
    const dLbl = dealer.length ? (holeHidden ? handTotal([dealer[0]])+" + 🂠" : handTotal(dealer)) : "–";
    dealerRow.append(ctx.el("div",{class:"hud",style:"padding:0",html:(holeHidden?"DEALER shows · <b>":"DEALER · <b>")+dLbl+"</b>"}));
    const drow=ctx.el("div",{style:"display:flex;gap:6px;flex-wrap:wrap;justify-content:center;min-height:62px"});
    dealer.forEach((c,i)=>drow.append(cardEl(c, holeHidden && i===1)));
    dealerRow.append(drow);

    const pLbl = player.length ? handTotal(player) : "–";
    playerRow.append(ctx.el("div",{class:"hud",style:"padding:0",html:"YOUR HAND · <b>"+pLbl+"</b>"+(isBlackjack(player)?" ♠ BLACKJACK":(typeof pLbl==="number"&&pLbl>21?" 💥 BUST":""))}));
    const prow=ctx.el("div",{style:"display:flex;gap:6px;flex-wrap:wrap;justify-content:center;min-height:62px"});
    player.forEach(c=>prow.append(cardEl(c,false)));
    playerRow.append(prow);
  }
  function syncHud(){ hud.innerHTML="💰 chips <b>$"+bankroll+"</b> · best $"+best+(phase==="bet"?" · betting $"+bet:" · in play $"+handBet); }

  // ---- controls per phase ----
  function renderCtrls(){
    ctrls.innerHTML="";
    prompt.textContent = phase==="bet" ? "① set your bet, then tap DEAL"
                       : phase==="player" ? "② HIT to draw a card · STAND to hold"
                       : "tap ▶ NEXT HAND to play again";
    if(phase==="bet"){
      if(bankroll<MINBET){
        prompt.textContent="you're out of chips — reset to keep playing";
        ctrls.append(ctx.el("button",{class:"btn red big2",text:"💥 busted — reset to $"+START,onclick:()=>{ bankroll=START; ctx.save("bj_bank",bankroll); bet=Math.min(25,bankroll); msg=""; syncHud(); renderCtrls(); }}));
        msgEl.textContent="out of chips."; return;
      }
      const dec=ctx.el("button",{class:"btn",style:"min-width:0;padding:14px 18px",text:"–",onclick:()=>chgBet(-MINBET)});
      const inc=ctx.el("button",{class:"btn",style:"min-width:0;padding:14px 18px",text:"+",onclick:()=>chgBet(MINBET)});
      const betLbl=ctx.el("div",{style:"min-width:70px;text-align:center;font-weight:700;font-size:18px;color:var(--yel)",text:"$"+bet});
      const betRow=ctx.el("div",{style:"display:flex;gap:8px;align-items:center;justify-content:center"},[dec,betLbl,inc]);
      const chips=ctx.el("div",{style:"display:flex;gap:6px;justify-content:center;flex-wrap:wrap"});
      [25,50,100].forEach(v=>chips.append(ctx.el("button",{class:"btn cyn",style:"min-width:0;padding:9px 12px;font-size:13px",text:"$"+v,onclick:()=>setBet(v)})));
      chips.append(ctx.el("button",{class:"btn cyn",style:"min-width:0;padding:9px 12px;font-size:13px",text:"ALL IN",onclick:()=>setBet(bankroll)}));
      const dealBtn=ctx.el("button",{class:"btn grn big2",text:"▶ DEAL",onclick:deal});
      ctrls.append(ctx.el("div",{style:"display:flex;flex-direction:column;gap:10px;align-items:center;width:100%"},[betRow,chips,dealBtn]));
    } else if(phase==="player"){
      const canDouble = player.length===2 && bankroll>=handBet;
      ctrls.append(ctx.el("button",{class:"btn grn big2",text:"HIT",onclick:hit}));
      ctrls.append(ctx.el("button",{class:"btn red big2",text:"STAND",onclick:stand}));
      if(canDouble) ctrls.append(ctx.el("button",{class:"btn cyn",text:"DOUBLE",onclick:dbl}));
    } else { // done
      ctrls.append(ctx.el("button",{class:"btn grn big2",text:"▶ next hand",onclick:()=>{ phase="bet"; msg=""; msgEl.textContent=""; bet=Math.min(bet,Math.max(MINBET,bankroll)); syncHud(); renderCtrls(); renderHands(); }}));
    }
  }
  function chgBet(d){ bet=Math.min(bankroll, Math.max(MINBET, bet+d)); syncHud(); renderCtrls(); }
  function setBet(v){ bet=Math.min(bankroll, Math.max(MINBET, v)); syncHud(); renderCtrls(); }

  // ---- game flow ----
  function deal(){
    bet=Math.min(bankroll, Math.max(MINBET, bet));
    handBet=bet; bankroll-=handBet;
    holeHidden=true;
    player=[drawCard(),drawCard()]; dealer=[drawCard(),drawCard()];
    phase="player"; syncHud(); renderHands();
    if(isBlackjack(player) || isBlackjack(dealer)){ holeHidden=false; settle(); return; }
    renderCtrls();
  }
  function hit(){
    player.push(drawCard()); renderHands();
    if(handTotal(player)>21){ holeHidden=false; settle(); }
  }
  function dbl(){
    bankroll-=handBet; handBet*=2; syncHud();
    player.push(drawCard()); renderHands();
    if(handTotal(player)>21){ holeHidden=false; settle(); } else stand();
  }
  function stand(){
    holeHidden=false; renderHands();
    while(handTotal(dealer)<17) dealer.push(drawCard());
    renderHands(); settle();
  }
  function settle(){
    phase="done"; holeHidden=false; renderHands();
    const p=handTotal(player), d=handTotal(dealer);
    const pBJ=isBlackjack(player), dBJ=isBlackjack(dealer);
    let result, payout=0; // payout added back to bankroll
    if(pBJ && dBJ){ result="push — both blackjack"; payout=handBet; }
    else if(pBJ){ result="♠ BLACKJACK! +$"+Math.floor(handBet*1.5); payout=handBet+Math.floor(handBet*1.5); }
    else if(dBJ){ result="dealer blackjack — you lose"; payout=0; }
    else if(p>21){ result="bust — you lose $"+handBet; payout=0; }
    else if(d>21){ result="dealer busts — you win $"+handBet; payout=handBet*2; }
    else if(p>d){ result="you win $"+handBet; payout=handBet*2; }
    else if(p<d){ result="dealer wins — you lose $"+handBet; payout=0; }
    else { result="push"; payout=handBet; }
    bankroll+=payout;
    if(bankroll>best){ best=bankroll; ctx.save("bj_best",best); }
    ctx.save("bj_bank",bankroll);
    ctx.submitScore(bankroll);
    msgEl.style.color = payout>handBet?"var(--grn)":payout===handBet?"var(--yel)":"var(--red)";
    msgEl.textContent=result;
    syncHud(); renderCtrls();
  }

  // keyboard shortcuts (desktop)
  const onKey=e=>{
    const k=e.key.toLowerCase();
    if(phase==="player"){ if(k==="h") hit(); else if(k==="s") stand(); else if(k==="d"){ if(player.length===2&&bankroll>=handBet) dbl(); } }
    else if(phase==="bet"){ if(k==="enter") deal(); else if(k==="arrowup") chgBet(MINBET); else if(k==="arrowdown") chgBet(-MINBET); }
    else if(phase==="done"){ if(k==="enter"){ phase="bet"; msg=""; msgEl.textContent=""; syncHud(); renderCtrls(); renderHands(); } }
  };
  window.addEventListener("keydown",onKey);

  buildDeck(); syncHud(); renderHands(); renderCtrls();
  return ()=>{ window.removeEventListener("keydown",onKey); ctx.save("bj_bank",bankroll); };
}});
