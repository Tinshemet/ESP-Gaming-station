// Tinshemet's Gaming Cabinet — ESP32 SoftAP arcade.
//   HTTP:80  serves the gzipped single-page app (webassets.h, built by tools/bundle.sh)
//   WS:81    realtime: presence, chat, admin, versus rooms + Quick-Draw referee
// Offline by design: it hosts its own Wi-Fi, provides NO internet, talks to nobody outside.
#define WEBSOCKETS_SERVER_CLIENT_MAX 8
#include <WiFi.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include "webassets.h"

// ---- config ----
static const char*  AP_SSID   = "Free Games \xF0\x9F\x8E\xAE Join Me";   // the Wi-Fi name people see
static const char*  ADMIN_PIN = "2468";             // host PIN (change to taste)
static const byte   DNS_PORT  = 53;
static const IPAddress AP_IP(192, 168, 4, 1);
#define MAXCL 8
#define CHATN 24

DNSServer        dns;
WebServer        http(80);
WebSocketsServer ws(81);

struct Peer { bool used=false, ready=false, admin=false; uint32_t id=0; char name[18]; char room[16]; };
Peer cl[MAXCL];
uint32_t nextId = 1;
uint32_t cliIP[MAXCL]={0};
uint32_t banned[16]; int banN=0;
bool isBanned(uint32_t ip){ if(!ip) return false; for(int i=0;i<banN;i++) if(banned[i]==ip) return true; return false; }

struct ChatMsg { uint32_t id; char name[18]; char text[160]; };
ChatMsg chat[CHATN]; int chatCount=0, chatHead=0;

char welcomeTxt[180] =
  "Welcome to Tinshemet's Gaming Cabinet.\nBored - but too classy to look like a snob about it? Play away.";

// ---- Quick-Draw referee ----
enum QDPhase { QD_IDLE, QD_SET, QD_GO, QD_RESULT };
struct QD { QDPhase phase=QD_IDLE; uint32_t t=0, drawAt=0; int p1=-1,p2=-1; int s1=0,s2=0; } qd;

// ---------- helpers ----------
void sendJson(int num, JsonDocument& d){ String s; serializeJson(d,s); ws.sendTXT(num, s); }
void broadcast(JsonDocument& d, const char* room=nullptr){
  String s; serializeJson(d,s);
  for(int i=0;i<MAXCL;i++) if(cl[i].used && cl[i].ready && (!room || strcmp(cl[i].room,room)==0)) ws.sendTXT(i, s);
}
int idToNum(uint32_t id){ for(int i=0;i<MAXCL;i++) if(cl[i].used && cl[i].id==id) return i; return -1; }
bool nameTaken(const char* name, int except){ for(int i=0;i<MAXCL;i++) if(i!=except && cl[i].used && cl[i].ready && !strcmp(cl[i].name,name)) return true; return false; }

void sendPresence(){
  JsonDocument d; d["t"]="presence"; JsonArray a=d["users"].to<JsonArray>();
  for(int i=0;i<MAXCL;i++) if(cl[i].used && cl[i].ready){
    JsonObject o=a.add<JsonObject>(); o["id"]=cl[i].id; o["name"]=cl[i].name; o["admin"]=cl[i].admin;
    if(cl[i].room[0]) o["room"]=cl[i].room;
  }
  broadcast(d);
}
void sendChatlog(int num){
  JsonDocument d; d["t"]="chatlog"; JsonArray a=d["items"].to<JsonArray>();
  for(int k=0;k<chatCount;k++){ int idx=(chatHead - chatCount + k + 2*CHATN)%CHATN; ChatMsg&m=chat[idx];
    JsonObject o=a.add<JsonObject>(); o["id"]=m.id; o["name"]=m.name; o["text"]=m.text; }
  sendJson(num,d);
}
void pushChat(uint32_t id, const char* name, const char* text){
  ChatMsg&m=chat[chatHead]; m.id=id; strncpy(m.name,name,17); m.name[17]=0; strncpy(m.text,text,159); m.text[159]=0;
  chatHead=(chatHead+1)%CHATN; if(chatCount<CHATN) chatCount++;
  JsonDocument d; d["t"]="chat"; d["id"]=id; d["name"]=name; d["text"]=text; broadcast(d);
}
void sysToast(int num, const char* txt){ JsonDocument d; d["t"]="sys"; d["text"]=txt; sendJson(num,d); }

// ---------- leaderboard (per-game high score, higher = better) ----------
#define NLEAD 40
struct Lead{ char game[16]; char name[18]; int32_t score; bool lo; };
Lead leads[NLEAD]; int leadN=0;
struct WinRec{ char name[18]; int32_t wins; };
WinRec wins[16]; int winN=0;
void addWin(const char* name){ if(!name[0]) return; int idx=-1; for(int i=0;i<winN;i++) if(!strcmp(wins[i].name,name)){ idx=i; break; }
  if(idx<0){ if(winN>=16) return; idx=winN++; strncpy(wins[idx].name,name,17); wins[idx].name[17]=0; wins[idx].wins=0; } wins[idx].wins++; }
void sendLeaders(int num){ JsonDocument d; d["t"]="leaders"; JsonArray a=d["items"].to<JsonArray>();
  for(int i=0;i<leadN;i++){ JsonObject o=a.add<JsonObject>(); o["game"]=leads[i].game; o["name"]=leads[i].name; o["score"]=leads[i].score; o["lo"]=leads[i].lo; }
  JsonArray w=d["vwins"].to<JsonArray>();
  for(int i=0;i<winN;i++){ JsonObject o=w.add<JsonObject>(); o["name"]=wins[i].name; o["wins"]=wins[i].wins; }
  if(num<0) broadcast(d); else sendJson(num,d); }
void submitScore(int num, const char* game, int32_t sc, bool lo){ if(!game[0]) return;
  int idx=-1; for(int i=0;i<leadN;i++) if(!strcmp(leads[i].game,game)){ idx=i; break; }
  if(idx<0){ if(leadN>=NLEAD) return; idx=leadN++; strncpy(leads[idx].game,game,15); leads[idx].game[15]=0; leads[idx].lo=lo; leads[idx].score= lo?INT32_MAX:INT32_MIN; leads[idx].name[0]=0; }
  bool better = leads[idx].lo ? (sc<leads[idx].score) : (sc>leads[idx].score);
  if(better){ leads[idx].score=sc; strncpy(leads[idx].name,cl[num].name,17); leads[idx].name[17]=0; sendLeaders(-1); }
}

// ---------- generic relay games (logic lives in the JS clients) ----------
bool relayGame(const char* g){ return !strcmp(g,"ttt")||!strcmp(g,"battleship")||!strcmp(g,"dots")||!strcmp(g,"trivia")||!strcmp(g,"speedmath")||!strcmp(g,"potato"); }
void relaySeats(const char* room){   // players ordered by join time (id) so seats stay stable when others join/leave
  int idx[MAXCL], n=0;
  for(int i=0;i<MAXCL;i++) if(cl[i].used && cl[i].ready && !strcmp(cl[i].room,room)) idx[n++]=i;
  for(int i=1;i<n;i++){ int k=idx[i], j=i-1; while(j>=0 && cl[idx[j]].id>cl[k].id){ idx[j+1]=idx[j]; j--; } idx[j+1]=k; }
  JsonDocument d; d["t"]="net"; d["game"]=room; d["ev"]="seats"; JsonArray a=d["players"].to<JsonArray>();
  for(int i=0;i<n;i++){ JsonObject o=a.add<JsonObject>(); o["id"]=cl[idx[i]].id; o["name"]=cl[idx[i]].name; }
  d["have"]=n; broadcast(d,room); }

// ---------- Quick-Draw ----------
void qdFindDuelists(){
  qd.p1=qd.p2=-1;
  for(int i=0;i<MAXCL;i++) if(cl[i].used && cl[i].ready && strcmp(cl[i].room,"quickdraw")==0){
    if(qd.p1<0 || cl[i].id<cl[qd.p1].id){ qd.p2=qd.p1; qd.p1=i; } else if(qd.p2<0 || cl[i].id<cl[qd.p2].id){ qd.p2=i; }
  }
}
void qdSendRound(const char* ev){
  if(qd.p1<0||qd.p2<0) return;
  JsonDocument d; d["t"]="net"; d["game"]="quickdraw"; d["ev"]=ev;
  JsonArray duel=d["duel"].to<JsonArray>(); duel.add(cl[qd.p1].id); duel.add(cl[qd.p2].id);
  JsonArray nm=d["names"].to<JsonArray>(); nm.add(cl[qd.p1].name); nm.add(cl[qd.p2].name);
  JsonArray sc=d["score"].to<JsonArray>(); sc.add(qd.s1); sc.add(qd.s2);
  broadcast(d,"quickdraw");
}
void qdSendWait(){
  int have=0; for(int i=0;i<MAXCL;i++) if(cl[i].used&&cl[i].ready&&strcmp(cl[i].room,"quickdraw")==0) have++;
  JsonDocument d; d["t"]="net"; d["game"]="quickdraw"; d["ev"]="wait"; d["have"]=have; broadcast(d,"quickdraw");
}
void qdResult(int winner, const char* reason){
  if(winner==qd.p1) qd.s1++; else if(winner==qd.p2) qd.s2++;
  JsonDocument d; d["t"]="net"; d["game"]="quickdraw"; d["ev"]="result";
  d["winnerId"]=cl[winner].id; d["winnerName"]=cl[winner].name; d["reason"]=reason;
  JsonArray duel=d["duel"].to<JsonArray>(); duel.add(cl[qd.p1].id); duel.add(cl[qd.p2].id);
  JsonArray nm=d["names"].to<JsonArray>(); nm.add(cl[qd.p1].name); nm.add(cl[qd.p2].name);
  JsonArray sc=d["score"].to<JsonArray>(); sc.add(qd.s1); sc.add(qd.s2);
  broadcast(d,"quickdraw");
  qd.phase=QD_RESULT; qd.t=millis();
}
void qdTap(int num){
  if(num!=qd.p1 && num!=qd.p2) return;
  int other = (num==qd.p1)? qd.p2 : qd.p1;
  if(qd.phase==QD_SET)      qdResult(other,"falsestart");   // flinched
  else if(qd.phase==QD_GO)  qdResult(num,"draw");           // fastest
}
void qdTick(){
  int before1=qd.p1, before2=qd.p2; qdFindDuelists();
  bool ready = (qd.p1>=0 && qd.p2>=0);
  if(!ready){ if(qd.phase!=QD_IDLE){ qd.phase=QD_IDLE; qdSendWait(); } return; }
  // duelist set changed while mid-round -> restart
  if(qd.phase!=QD_IDLE && (before1!=qd.p1 || before2!=qd.p2)){ qd.phase=QD_IDLE; }
  uint32_t now=millis();
  switch(qd.phase){
    case QD_IDLE:   qd.phase=QD_SET; qd.t=now; qd.drawAt=now+random(1600,4200); qdSendRound("round"); break;
    case QD_SET:    if(now>=qd.drawAt){ qd.phase=QD_GO; qd.t=now; JsonDocument d; d["t"]="net"; d["game"]="quickdraw"; d["ev"]="go"; broadcast(d,"quickdraw"); } break;
    case QD_GO:     break; // waiting for a tap
    case QD_RESULT: if(now>=qd.t+3200){ qd.phase=QD_IDLE; } break;
  }
}
// ---------- shared helpers for the other duels ----------
int findDuel(const char* room, int& a, int& b){ a=b=-1; int n=0;   // two earliest joiners (lowest id) = stable duelists
  for(int i=0;i<MAXCL;i++) if(cl[i].used && cl[i].ready && !strcmp(cl[i].room,room)){ n++;
    if(a<0 || cl[i].id<cl[a].id){ b=a; a=i; } else if(b<0 || cl[i].id<cl[b].id){ b=i; } }
  return n; }
int countRoom(const char* room){ int n=0; for(int i=0;i<MAXCL;i++) if(cl[i].used && cl[i].ready && !strcmp(cl[i].room,room)) n++; return n; }
void sendWait(const char* game){ JsonDocument d; d["t"]="net"; d["game"]=game; d["ev"]="wait"; d["have"]=countRoom(game); broadcast(d,game); }
void sendWaitTo(int num, const char* game){ JsonDocument d; d["t"]="net"; d["game"]=game; d["ev"]="wait"; d["have"]=countRoom(game); sendJson(num,d); }

// ---------- Rock-Paper-Scissors (first to 3) ----------
struct RPSs{ int p1=-1,p2=-1; char c1=0,c2=0; int s1=0,s2=0; int phase=0; uint32_t t=0; } rps;
bool rpsBeats(char a,char b){ return (a=='r'&&b=='s')||(a=='p'&&b=='r')||(a=='s'&&b=='p'); }
void rpsSend(const char* ev,int winnerId){
  JsonDocument d; d["t"]="net"; d["game"]="rps"; d["ev"]=ev;
  JsonArray duel=d["duel"].to<JsonArray>(); duel.add(rps.p1>=0?cl[rps.p1].id:0); duel.add(rps.p2>=0?cl[rps.p2].id:0);
  JsonArray nm=d["names"].to<JsonArray>(); nm.add(rps.p1>=0?cl[rps.p1].name:""); nm.add(rps.p2>=0?cl[rps.p2].name:"");
  JsonArray sc=d["score"].to<JsonArray>(); sc.add(rps.s1); sc.add(rps.s2);
  if(!strcmp(ev,"reveal")||!strcmp(ev,"match")){ char b1[2]={rps.c1,0},b2[2]={rps.c2,0}; d["c1"]=b1; d["c2"]=b2; d["winnerId"]=winnerId; }
  broadcast(d,"rps");
}
void rpsPick(int num,char c){ if(c!='r'&&c!='p'&&c!='s')return; if(rps.phase!=1)return;
  if(num==rps.p1) rps.c1=c; else if(num==rps.p2) rps.c2=c; else return;
  if(rps.c1&&rps.c2){ int w=0; if(rps.c1!=rps.c2){ if(rpsBeats(rps.c1,rps.c2)){rps.s1++;w=cl[rps.p1].id;} else {rps.s2++;w=cl[rps.p2].id;} }
    rps.phase=2; rps.t=millis();
    if(rps.s1>=3||rps.s2>=3) rpsSend("match", rps.s1>=3?cl[rps.p1].id:cl[rps.p2].id); else rpsSend("reveal",w);
  }
}
void rpsTick(){ int a,b; int n=findDuel("rps",a,b); rps.p1=a; rps.p2=b; uint32_t now=millis();
  if(n<2){ if(rps.phase!=0){ rps.phase=0; sendWait("rps"); } return; }
  if(rps.phase==0){ rps.s1=rps.s2=0; rps.c1=rps.c2=0; rps.phase=1; rpsSend("round",0); }
  else if(rps.phase==2 && now>=rps.t+2600){ if(rps.s1>=3||rps.s2>=3) rps.s1=rps.s2=0; rps.c1=rps.c2=0; rps.phase=1; rpsSend("round",0); }
}

// ---------- Tug of War (mash) ----------
struct Tugs{ int p1=-1,p2=-1; int rope=0; int phase=0; uint32_t t=0; bool dirty=false; } tug;
const int TUG_GOAL=20;
void tugSend(const char* ev,int winnerId){
  JsonDocument d; d["t"]="net"; d["game"]="tug"; d["ev"]=ev; d["rope"]=tug.rope; d["goal"]=TUG_GOAL;
  JsonArray duel=d["duel"].to<JsonArray>(); duel.add(tug.p1>=0?cl[tug.p1].id:0); duel.add(tug.p2>=0?cl[tug.p2].id:0);
  JsonArray nm=d["names"].to<JsonArray>(); nm.add(tug.p1>=0?cl[tug.p1].name:""); nm.add(tug.p2>=0?cl[tug.p2].name:"");
  if(winnerId) d["winnerId"]=winnerId;
  broadcast(d,"tug");
}
void tugPull(int num){ if(tug.phase!=2)return;
  if(num==tug.p1) tug.rope--; else if(num==tug.p2) tug.rope++; else return;
  tug.dirty=true;
  if(tug.rope<=-TUG_GOAL){ tug.phase=3; tug.t=millis(); tugSend("result",cl[tug.p1].id); }
  else if(tug.rope>=TUG_GOAL){ tug.phase=3; tug.t=millis(); tugSend("result",cl[tug.p2].id); }
}
void tugTick(){ int a,b; int n=findDuel("tug",a,b); tug.p1=a; tug.p2=b; uint32_t now=millis();
  if(n<2){ if(tug.phase!=0){ tug.phase=0; sendWait("tug"); } return; }
  if(tug.phase==0){ tug.rope=0; tug.phase=1; tug.t=now; tugSend("set",0); }
  else if(tug.phase==1 && now>=tug.t+2000){ tug.phase=2; tug.t=now; tugSend("go",0); }
  else if(tug.phase==2 && tug.dirty){ static uint32_t lb=0; if(now-lb>=70){ lb=now; tug.dirty=false; tugSend("rope",0); } }
  else if(tug.phase==3 && now>=tug.t+3200){ tug.phase=0; }
}

// ---------- Connect 4 (server-authoritative) ----------
struct C4s{ int p1=-1,p2=-1; int turn=1; char g[42]; int phase=0; int winner=0; uint32_t t=0; } c4;
void c4Clear(){ for(int i=0;i<42;i++) c4.g[i]='0'; c4.turn=1; c4.winner=0; }
bool c4Win(int who){ char c='0'+who; int dirs[4][2]={{0,1},{1,0},{1,1},{1,-1}};
  for(int r=0;r<6;r++)for(int col=0;col<7;col++){ if(c4.g[r*7+col]!=c)continue;
    for(int k=0;k<4;k++){ int cnt=1,rr=r,cc=col; for(int s=1;s<4;s++){ rr+=dirs[k][0]; cc+=dirs[k][1];
      if(rr<0||rr>=6||cc<0||cc>=7||c4.g[rr*7+cc]!=c)break; cnt++; } if(cnt>=4)return true; } }
  return false; }
void c4Send(const char* ev){
  JsonDocument d; d["t"]="net"; d["game"]="c4"; d["ev"]=ev;
  char buf[43]; memcpy(buf,c4.g,42); buf[42]=0; d["board"]=buf;
  d["turn"] = c4.turn==1?(c4.p1>=0?cl[c4.p1].id:0):(c4.p2>=0?cl[c4.p2].id:0);
  JsonArray duel=d["duel"].to<JsonArray>(); duel.add(c4.p1>=0?cl[c4.p1].id:0); duel.add(c4.p2>=0?cl[c4.p2].id:0);
  JsonArray nm=d["names"].to<JsonArray>(); nm.add(c4.p1>=0?cl[c4.p1].name:""); nm.add(c4.p2>=0?cl[c4.p2].name:"");
  if(c4.winner) d["winnerId"]= c4.winner==1?cl[c4.p1].id:cl[c4.p2].id;
  broadcast(d,"c4");
}
void c4Drop(int num,int col){ if(c4.phase!=1||col<0||col>=7)return;
  int who=(num==c4.p1)?1:(num==c4.p2)?2:0; if(!who||who!=c4.turn)return;
  int row=-1; for(int r=5;r>=0;r--){ if(c4.g[r*7+col]=='0'){ row=r; break; } } if(row<0)return;
  c4.g[row*7+col]='0'+who;
  if(c4Win(who)){ c4.winner=who; c4.phase=2; c4.t=millis(); c4Send("state"); return; }
  bool full=true; for(int i=0;i<42;i++) if(c4.g[i]=='0'){ full=false; break; }
  if(full){ c4.phase=2; c4.t=millis(); c4Send("draw"); return; }
  c4.turn=(c4.turn==1)?2:1; c4Send("state");
}
void c4Tick(){ int a,b; int n=findDuel("c4",a,b); uint32_t now=millis();
  if(n<2){ if(c4.phase!=0){ c4.phase=0; sendWait("c4"); } return; }
  if(c4.phase==0 || a!=c4.p1 || b!=c4.p2){ c4.p1=a; c4.p2=b; c4Clear(); c4.phase=1; c4Send("state"); return; }
  if(c4.phase==2 && now>=c4.t+4500){ c4Clear(); c4.phase=1; c4Send("state"); }
}

// ---------- Reaction Royale (N players) ----------
struct Roys{ int phase=0; uint32_t t=0,goAt=0; int winner=0; } roy;
void roySend(const char* ev,int winnerId,const char* winnerName){
  JsonDocument d; d["t"]="net"; d["game"]="royale"; d["ev"]=ev; d["have"]=countRoom("royale");
  if(winnerId){ d["winnerId"]=winnerId; d["winnerName"]=winnerName; }
  broadcast(d,"royale");
}
void royTap(int num){ if(strcmp(cl[num].room,"royale"))return;
  if(roy.phase==1){ JsonDocument d; d["t"]="net"; d["game"]="royale"; d["ev"]="jumped"; sendJson(num,d); }
  else if(roy.phase==2){ roy.winner=cl[num].id; roy.phase=3; roy.t=millis(); roySend("result",cl[num].id,cl[num].name); }
}
void royTick(){ int n=countRoom("royale"); uint32_t now=millis();
  if(n<2){ if(roy.phase!=0){ roy.phase=0; sendWait("royale"); } return; }
  if(roy.phase==0){ roy.phase=1; roy.t=now; roy.goAt=now+random(2000,5200); roySend("set",0,0); }
  else if(roy.phase==1 && now>=roy.goAt){ roy.phase=2; roy.t=now; roySend("go",0,0); }
  else if(roy.phase==3 && now>=roy.t+3500){ roy.phase=0; }
}

// send the current snapshot of a room to everyone in it (used when someone joins)
// Tell ONLY the joining client the current state — never broadcast a reset to a room
// that already has an active duel (that was booting the 2 players when a 3rd joined).
void gameOnJoin(int num, const char* room){
  if(!strcmp(room,"quickdraw")||!strcmp(room,"rps")||!strcmp(room,"tug")||!strcmp(room,"royale")) sendWaitTo(num,room);
  else if(!strcmp(room,"c4")){ if(c4.phase==1||c4.phase==2) c4Send("state"); else sendWaitTo(num,"c4"); }
  else if(relayGame(room)) relaySeats(room);
}

void resetRooms(){ qd.phase=QD_IDLE; qd.s1=qd.s2=0; rps.phase=0; rps.s1=rps.s2=0; tug.phase=0; c4.phase=0; c4Clear(); roy.phase=0;
  qdSendWait(); sendWait("rps"); sendWait("tug"); sendWait("c4"); sendWait("royale"); }

// ---------- WS events ----------
void onText(int num, uint8_t* payload, size_t len){
  JsonDocument d;
  if(deserializeJson(d, payload, len)) return;
  const char* t = d["t"] | "";
  Peer& c = cl[num];

  if(!strcmp(t,"hello")){
    char base[18]; strncpy(base, d["name"] | "guest", 17); base[17]=0; if(!base[0]) strcpy(base,"guest");
    char nm[20]; strncpy(nm, base, 17); nm[17]=nm[18]=nm[19]=0;
    for(int sfx=2; nameTaken(nm, num) && sfx<100; sfx++) snprintf(nm, sizeof(nm), "%.14s%d", base, sfx);
    strncpy(c.name, nm, 17); c.name[17]=0;
    c.ready=true; c.room[0]=0;
    JsonDocument w; w["t"]="welcome"; w["id"]=c.id; w["name"]=c.name; w["welcome"]=welcomeTxt; sendJson(num,w);
    sendChatlog(num); sendPresence(); sendLeaders(num);
  }
  else if(!strcmp(t,"chat")){
    const char* txt=d["text"] | ""; if(txt[0] && c.ready) pushChat(c.id, c.name, txt);
  }
  else if(!strcmp(t,"admin")){
    bool ok = !strcmp(d["pin"] | "", ADMIN_PIN); c.admin = c.admin || ok;
    JsonDocument r; r["t"]="admin_ok"; r["ok"]=ok; sendJson(num,r); if(ok) sendPresence();
  }
  else if(!strcmp(t,"join")){
    strncpy(c.room, d["game"] | "", 15); c.room[15]=0; sendPresence();
    gameOnJoin(num, c.room);
  }
  else if(!strcmp(t,"leave")){ char old[16]; strncpy(old,c.room,15); old[15]=0; c.room[0]=0; sendPresence(); if(relayGame(old)) relaySeats(old); }
  else if(!strcmp(t,"net")){
    const char* g=d["game"] | ""; const char* ev=d["ev"] | "";
    if(!strcmp(g,"quickdraw") && !strcmp(ev,"tap")) qdTap(num);
    else if(!strcmp(g,"rps")  && !strcmp(ev,"pick")) rpsPick(num, (d["c"] | "?")[0]);
    else if(!strcmp(g,"tug")  && !strcmp(ev,"pull")) tugPull(num);
    else if(!strcmp(g,"c4")   && !strcmp(ev,"drop")) c4Drop(num, d["col"] | -1);
    else if(!strcmp(g,"royale") && !strcmp(ev,"tap")) royTap(num);
    else if(relayGame(g)){ d["from"]=cl[num].id; String s; serializeJson(d,s);
      for(int i=0;i<MAXCL;i++) if(cl[i].used && cl[i].ready && i!=num && !strcmp(cl[i].room,g)) ws.sendTXT(i,s); }
  }
  else if(!strcmp(t,"score")){ submitScore(num, d["game"] | "", (int32_t)(d["score"] | 0), (bool)(d["lo"] | false)); }
  else if(!strcmp(t,"win")){ if(c.ready){ addWin(c.name); sendLeaders(-1); } }
  else if(!strcmp(t,"acmd")){
    if(!c.admin){ sysToast(num,"not authorized"); return; }
    const char* cmd=d["cmd"] | "";
    if(!strcmp(cmd,"kick")){ int n=idToNum(d["id"] | 0); if(n>=0 && n!=num){ JsonDocument k; k["t"]="kicked"; sendJson(n,k); ws.disconnect(n); } }
    else if(!strcmp(cmd,"ban")){ int n=idToNum(d["id"] | 0); if(n>=0 && n!=num){ if(banN<16) banned[banN++]=cliIP[n]; JsonDocument k; k["t"]="kicked"; sendJson(n,k); ws.disconnect(n); } }
    else if(!strcmp(cmd,"resetleaders")){ leadN=0; winN=0; sendLeaders(-1); }
    else if(!strcmp(cmd,"resetall")){ leadN=0; winN=0; sendLeaders(-1); JsonDocument w; w["t"]="wipe"; broadcast(w); }
    else if(!strcmp(cmd,"clearchat")){ chatCount=0; chatHead=0; JsonDocument e; e["t"]="chatlog"; e["items"].to<JsonArray>(); broadcast(e); }
    else if(!strcmp(cmd,"resetrooms")){ resetRooms(); }
    else if(!strcmp(cmd,"welcome")){ strncpy(welcomeTxt, d["text"] | welcomeTxt, 179); welcomeTxt[179]=0;
      JsonDocument e; e["t"]="welcome_set"; e["welcome"]=welcomeTxt; broadcast(e); }
  }
}
void onWsEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t len){
  if(num>=MAXCL) return;
  if(type==WStype_CONNECTED){ uint32_t ip=(uint32_t)ws.remoteIP(num); if(isBanned(ip)){ ws.disconnect(num); return; }
    cl[num]=Peer(); cl[num].used=true; cl[num].id=nextId++; cliIP[num]=ip; }
  else if(type==WStype_DISCONNECTED){ char old[16]; strncpy(old,cl[num].room,15); old[15]=0; cl[num].used=false; cl[num].ready=false; sendPresence(); if(relayGame(old)) relaySeats(old); }
  else if(type==WStype_TEXT){ onText(num, payload, len); }
}

// ---------- HTTP ----------
void handleRoot(){
  http.sendHeader("Content-Encoding","gzip");
  http.sendHeader("Cache-Control","no-cache, no-store");
  http.sendHeader("Connection","close");
  http.send_P(200, "text/html", (PGM_P)WEB_HTML_GZ, WEB_HTML_GZ_LEN);
}

void setup(){
  Serial.begin(115200);
  randomSeed(esp_random());
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(AP_IP, AP_IP, IPAddress(255,255,255,0));
  WiFi.softAP(AP_SSID, NULL, 1, 0, MAXCL);
  delay(200);
  Serial.printf("\nGaming Cabinet AP '%s' @ %s\n", AP_SSID, WiFi.softAPIP().toString().c_str());

  dns.start(DNS_PORT, "*", AP_IP);
  // Serve the arcade for EVERY request (any path/host). Because the wildcard DNS
  // points all lookups here, each OS "is there internet?" probe (Android
  // generate_204, iOS hotspot-detect, Windows ncsi) gets the arcade instead of
  // the success token it expects -> the phone decides a captive portal exists and
  // auto-opens it. Non-tech guests just join the Wi-Fi and the arcade pops up.
  http.on("/", handleRoot);
  http.onNotFound(handleRoot);
  http.begin();
  ws.begin(); ws.onEvent(onWsEvent);
  Serial.println("http:80 + ws:81 up — arcade live");
}

void loop(){
  dns.processNextRequest();
  http.handleClient();
  ws.loop();
  static uint32_t last=0; if(millis()-last>=60){ last=millis(); qdTick(); rpsTick(); tugTick(); c4Tick(); royTick(); }
}
