/* 2048 — swipe or arrow keys to merge tiles. Reach 2048, then keep going. */
CAB.register({ id:"2048", name:"2048", icon:"🔢", kind:"sp", desc:"swipe to merge. reach 2048.",
mount(stage, ctx){
  const N=4, gap=8;
  const wrap=ctx.el("div",{style:"display:flex;flex-direction:column;align-items:center;gap:10px;width:100%"});
  const hud=ctx.el("div",{class:"hud"});
  const cv=document.createElement("canvas");
  const ctrls=ctx.el("div",{class:"ctrls"});
  wrap.append(hud, cv, ctrls); stage.append(wrap);

  const g=cv.getContext("2d");
  let size=320, cell=72;
  function fit(){
    const budget=Math.min(stage.clientWidth-20, stage.clientHeight-170, 460);
    cell=Math.max(46, Math.floor((budget-gap*(N+1))/N));
    size=cell*N+gap*(N+1);
    cv.width=size; cv.height=size;
    cv.style.width=size+"px"; cv.style.height=size+"px";
  }

  let board, score, best, overlay, won;
  best=+(ctx.load("2048_best")||0);

  const COLORS={2:["#16202c","#c9d6e2"],4:["#1d3346","#dfe9f2"],8:["#265a78","#eaf6ff"],
    16:["#57d9ff","#06212b"],32:["#7CFFB2","#06251a"],64:["#ffd166","#2a1f00"],
    128:["#ff6ad5","#2a0620"],256:["#ff6b6b","#2a0808"],512:["#b98cff","#1a0730"],
    1024:["#ff9f45","#2a1300"],2048:["#ffe08a","#2a2000"]};
  function tcol(v){ return COLORS[v] || (v>2048?["#ffe08a","#2a2000"]:["#16202c","#c9d6e2"]); }

  function empties(){ const o=[]; for(let r=0;r<N;r++)for(let c=0;c<N;c++) if(!board[r][c]) o.push([r,c]); return o; }
  function addRandom(){ const e=empties(); if(!e.length) return; const [r,c]=e[(Math.random()*e.length)|0]; board[r][c]=Math.random()<0.9?2:4; }
  function reset(){ board=[]; for(let r=0;r<N;r++) board.push([0,0,0,0]); score=0; overlay=null; won=false; addRandom(); addRandom(); draw(); }

  function slide(vals){
    let arr=vals.filter(v=>v), gained=0;
    for(let i=0;i<arr.length-1;i++){ if(arr[i]===arr[i+1]){ arr[i]*=2; gained+=arr[i]; if(arr[i]>=2048&&!won) won="new"; arr.splice(i+1,1); } }
    while(arr.length<N) arr.push(0);
    return {arr, gained};
  }
  function coords(i,dir){ const o=[]; for(let k=0;k<N;k++){ let r,c;
    if(dir==="L"){r=i;c=k;} else if(dir==="R"){r=i;c=N-1-k;} else if(dir==="U"){r=k;c=i;} else {r=N-1-k;c=i;}
    o.push([r,c]); } return o; }
  function canMove(){ if(empties().length) return true;
    for(let r=0;r<N;r++)for(let c=0;c<N;c++){ const v=board[r][c];
      if(c<N-1&&board[r][c+1]===v) return true; if(r<N-1&&board[r+1][c]===v) return true; }
    return false; }
  function move(dir){
    if(overlay) return;
    let moved=false, gained=0;
    for(let i=0;i<N;i++){ const cc=coords(i,dir), vals=cc.map(([r,c])=>board[r][c]), res=slide(vals);
      gained+=res.gained;
      for(let k=0;k<N;k++){ const [r,c]=cc[k]; if(board[r][c]!==res.arr[k]) moved=true; board[r][c]=res.arr[k]; } }
    if(moved){ score+=gained; if(score>best){best=score; ctx.save("2048_best",best);}
      addRandom();
      if(won==="new"){ won=true; overlay="win"; ctx.toast("2048! 🎉 keep going"); }
      else if(!canMove()){ overlay="over"; ctx.save("2048_best",best); ctx.submitScore(score); }
      draw();
    }
  }

  function rr(x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }

  function draw(){
    g.fillStyle="#0e141c"; rr(0,0,size,size,14); g.fill();
    for(let r=0;r<N;r++)for(let c=0;c<N;c++){
      const x=gap+c*(cell+gap), y=gap+r*(cell+gap), v=board[r][c];
      if(!v){ g.fillStyle="#131b26"; rr(x,y,cell,cell,8); g.fill(); continue; }
      const [bg,fg]=tcol(v);
      g.fillStyle=bg; rr(x,y,cell,cell,8); g.fill();
      if(v>=2048){ g.save(); g.shadowColor="#ffe08a"; g.shadowBlur=cell*0.25; rr(x,y,cell,cell,8); g.fill(); g.restore(); }
      g.fillStyle=fg;
      const s=String(v), digs=s.length;
      let fs=cell*(digs<=2?0.44:digs===3?0.34:0.27);
      g.font="700 "+Math.floor(fs)+"px ui-monospace,Menlo,Consolas,monospace";
      g.textAlign="center"; g.textBaseline="middle";
      g.fillText(s, x+cell/2, y+cell/2+1);
    }
    if(overlay){
      g.fillStyle="rgba(11,15,20,.78)"; rr(0,0,size,size,14); g.fill();
      g.textAlign="center"; g.textBaseline="middle";
      if(overlay==="win"){
        g.fillStyle="#ffd166"; g.font="700 "+Math.floor(size*0.14)+"px ui-monospace,monospace";
        g.fillText("2048! 🎉", size/2, size/2-size*0.06);
        g.fillStyle="#c9d6e2"; g.font="600 "+Math.floor(size*0.05)+"px ui-monospace,monospace";
        g.fillText("tap to keep going", size/2, size/2+size*0.08);
      } else {
        g.fillStyle="#ff6b6b"; g.font="700 "+Math.floor(size*0.13)+"px ui-monospace,monospace";
        g.fillText("GAME OVER", size/2, size/2-size*0.08);
        g.fillStyle="#c9d6e2"; g.font="600 "+Math.floor(size*0.055)+"px ui-monospace,monospace";
        g.fillText("score "+score, size/2, size/2+size*0.02);
        g.fillStyle="#7CFFB2"; g.font="600 "+Math.floor(size*0.05)+"px ui-monospace,monospace";
        g.fillText("tap to retry", size/2, size/2+size*0.12);
      }
    }
    hud.innerHTML = overlay==="over"
      ? "💀 game over — score <b>"+score+"</b> · best "+best+" — <u>tap to retry</u>"
      : "score <b>"+score+"</b> · best <b>"+best+"</b>";
  }

  function tap(){ if(overlay==="over") reset(); else if(overlay==="win"){ overlay=null; draw(); } }

  // ---- input ----
  let sx=0, sy=0, lastTouch=0;
  cv.addEventListener("touchstart",e=>{ const t=e.touches[0]; sx=t.clientX; sy=t.clientY; },{passive:true});
  cv.addEventListener("touchend",e=>{ lastTouch=Date.now(); const t=e.changedTouches[0];
    const dx=t.clientX-sx, dy=t.clientY-sy;
    if(Math.abs(dx)<24&&Math.abs(dy)<24){ tap(); return; }
    if(Math.abs(dx)>Math.abs(dy)) move(dx>0?"R":"L"); else move(dy>0?"D":"U"); },{passive:true});
  cv.addEventListener("click",()=>{ if(Date.now()-lastTouch<600) return; tap(); });
  const key=e=>{ const k=e.key;
    if(overlay){ if(k===" "||k==="Enter"){ tap(); e.preventDefault(); } return; }
    if(k==="ArrowLeft"||k==="a"||k==="A") move("L");
    else if(k==="ArrowRight"||k==="d"||k==="D") move("R");
    else if(k==="ArrowUp"||k==="w"||k==="W") move("U");
    else if(k==="ArrowDown"||k==="s"||k==="S") move("D");
    else return;
    e.preventDefault();
  };
  window.addEventListener("keydown",key);

  ctrls.append(ctx.el("button",{class:"btn cyn",text:"↺ new game",onclick:()=>reset()}));

  fit(); reset();
  const onR=()=>{ fit(); draw(); }; window.addEventListener("resize",onR);
  return ()=>{ window.removeEventListener("keydown",key); window.removeEventListener("resize",onR); };
}});
