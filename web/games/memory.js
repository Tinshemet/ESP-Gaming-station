/* Memory — match the pairs. Pick your grid size; 8x8 is punishing. */
CAB.register({ id:"memory", name:"Memory", icon:"🃏", kind:"sp", desc:"flip & match. bigger grid = brutal.",
mount(stage, ctx){
  // single-codepoint emojis only (no variation selectors) — need >=32 for 8x8
  const POOL=["🍎","🍌","🍇","🍒","🍑","🍍","🥝","🍓","🥥","🍉","🍋","🥕","🌽","🍄","🧄","🧅",
    "🥑","🍆","🐶","🐱","🦊","🐻","🐼","🐨","🐯","🦁","🐸","🐵","🐔","🐧","🦄","🐝",
    "🐙","🦀","🐳","🦖","🌵","🌊","⭐","🌈","🎈","🎮","🎲","🎸","🚀","🛸","🔑","💎",
    "🎁","🍩","🍕","🌮","🍔","🎃","💀","👾","🤖","🐬","🦉","🌻","🍭","🧩","🎯","🔔"];
  const SIZES={easy:[4,4],medium:[4,6],hard:[6,6],insane:[8,8]};
  let diff=ctx.load("memory_diff")||"medium"; if(!SIZES[diff]) diff="medium";

  const wrap=ctx.el("div",{style:"display:flex;flex-direction:column;align-items:center;gap:8px;width:100%"});
  const diffbar=ctx.el("div",{class:"ctrls",style:"padding:2px;gap:6px;flex-wrap:wrap"});
  const hud=ctx.el("div",{class:"hud"});
  const grid=ctx.el("div",{style:"display:grid;gap:5px;width:min(96vw,440px)"});
  wrap.append(diffbar,hud,grid); stage.append(wrap);

  let cards=[],first=null,lock=false,moves=0,matched=0,pairs=0,t0=0,timer=null,won=false;
  function renderDiff(){ diffbar.innerHTML="";
    [["easy","4×4"],["medium","4×6"],["hard","6×6"],["insane","8×8 💀"]].forEach(([k,lbl])=>
      diffbar.append(ctx.el("button",{class:"btn"+(diff===k?" grn":""),style:"min-width:0;padding:7px 12px;font-size:13px",text:lbl,
        onclick:()=>{ diff=k; ctx.save("memory_diff",k); renderDiff(); deal(); }}))); }
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const tmp=a[i]; a[i]=a[j]; a[j]=tmp; } return a; }
  function tick(){ const s=Math.floor((Date.now()-t0)/1000);
    if(!won) hud.innerHTML="pairs <b>"+matched+"/"+pairs+"</b> · moves "+moves+" · "+s+"s"; }
  function show(el,on){ el._up=on; el.style.background=on?"var(--bg2)":"var(--panel)"; el.style.color=on?"var(--grn)":"transparent"; }
  function flip(el){ if(lock||won||el._up||el._done) return; show(el,true);
    if(!first){ first=el; return; } moves++;
    if(first._em===el._em){ el._done=first._done=true; el.style.color=first.style.color="var(--cyn)"; matched++; first=null; tick(); if(matched===pairs) win(); }
    else { lock=true; const a=first,b=el; first=null; setTimeout(()=>{ show(a,false); show(b,false); lock=false; },700); }
    tick();
  }
  function win(){ won=true; clearInterval(timer); const s=Math.floor((Date.now()-t0)/1000);
    const key="memory_best_"+diff, prev=+(ctx.load(key)||0), best=prev?Math.min(prev,moves):moves; ctx.save(key,best);
    ctx.submitScore(moves, true, SIZES[diff][0]+"x"+SIZES[diff][1]);
    hud.innerHTML="🎉 <b>"+pairs+"</b> pairs in <b>"+moves+"</b> moves · "+s+"s · best "+best+" — <u>tap a size to replay</u>"; }
  function deal(){
    const sz=SIZES[diff], r=sz[0], c=sz[1], n=r*c; pairs=n/2; won=false;
    grid.style.gridTemplateColumns="repeat("+c+",1fr)";
    const chosen=shuffle(POOL.slice()).slice(0,pairs); const deck=shuffle(chosen.concat(chosen));
    grid.innerHTML=""; cards=[]; first=null; lock=false; moves=0; matched=0;
    const fs = c>=8?"clamp(13px,4vw,24px)" : c>=6?"clamp(17px,6vw,30px)" : "clamp(24px,9vw,40px)";
    deck.forEach(em=>{ const el=ctx.el("button",{style:"aspect-ratio:1;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:transparent;font-size:"+fs+";line-height:1;display:flex;align-items:center;justify-content:center"});
      el._em=em; el._up=false; el._done=false; el.textContent=em;
      el.addEventListener("click",()=>flip(el)); cards.push(el); grid.append(el); });
    clearInterval(timer); t0=Date.now(); timer=setInterval(tick,500); tick();
  }
  renderDiff(); deal();
  return ()=>{ clearInterval(timer); };
}});
