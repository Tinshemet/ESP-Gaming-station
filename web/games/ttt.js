/* Tic-Tac-Toe — 1v1 over the relay. seat0=X (goes first), seat1=O. */
CAB.register({ id:"ttt", name:"Tic-Tac-Toe", icon:"⭕", kind:"mp", pill:"1v1",
  desc:"three in a row. quick grudge match.",
mount(stage, ctx){
  let players=[], mySeat=-1, board=Array(9).fill(""), turn=0, winner=null, started=false, reported=false;
  const wrap=ctx.el("div",{style:"flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:14px;width:100%"});
  const info=ctx.el("div",{class:"hud",style:"font-size:15px"});
  const grid=ctx.el("div",{style:"display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:min(86vw,320px)"});
  const btn=ctx.el("button",{class:"btn cyn",style:"display:none",text:"↺ rematch"});
  wrap.append(info,grid,btn); stage.append(wrap);
  const cells=[];
  for(let i=0;i<9;i++){ const c=ctx.el("button",{style:"aspect-ratio:1;font-size:clamp(30px,12vw,56px);background:var(--panel);border:1px solid var(--line);border-radius:12px;color:var(--ink)"});
    c.addEventListener("click",()=>move(i)); cells.push(c); grid.append(c); }
  const LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  function checkWin(b){ for(const L of LINES){ if(b[L[0]]&&b[L[0]]===b[L[1]]&&b[L[0]]===b[L[2]]) return b[L[0]]; } return b.every(x=>x)?"draw":null; }
  const myMark=()=>mySeat===0?"X":"O";
  function render(){
    board.forEach((v,i)=>{ cells[i].textContent=v; cells[i].style.color=v==="X"?"var(--grn)":"var(--mag)"; });
    let msg;
    if(mySeat<0||mySeat>1) msg = players.length<2?"waiting for players…":"spectating "+((players[0]||{}).name||"?")+" vs "+((players[1]||{}).name||"?");
    else if(players.length<2) msg="waiting for an opponent…";
    else if(winner==="draw") msg="draw — rematch?";
    else if(winner) msg=(winner===myMark()?"🏆 you win":"you lose")+" — rematch?";
    else msg=(turn===mySeat?"your turn (you're "+myMark()+")":"opponent's turn…");
    info.textContent=msg;
    btn.style.display=(winner&&mySeat>=0&&mySeat<=1&&players.length>=2)?"":"none";
    if(winner && winner!=="draw" && mySeat>=0 && mySeat<=1 && winner===myMark() && !reported){ reported=true; ctx.reportWin(); }
  }
  const bcast=()=>ctx.net.send({ev:"state",board:board,turn:turn,winner:winner});
  function move(i){ if(mySeat<0||mySeat>1||winner||players.length<2) return; if(turn!==mySeat||board[i]) return;
    board[i]=myMark(); winner=checkWin(board); turn=turn===0?1:0; render(); bcast(); }
  function newGame(){ board=Array(9).fill(""); turn=0; winner=null; reported=false; render(); bcast(); }
  btn.addEventListener("click",newGame);
  ctx.net.on(m=>{
    if(m.ev==="seats"){ players=m.players||[]; mySeat=players.findIndex(p=>p.id===ctx.me.id);
      if(players.length>=2 && mySeat===0 && !started){ started=true; newGame(); } else render(); }
    else if(m.ev==="state"){ board=m.board||board; turn=m.turn||0; winner=m.winner||null; started=true; render(); }
  });
  render();
  return ()=>{};
}});
