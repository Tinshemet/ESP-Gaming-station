# ESP-Gaming-station 🎮

A pocket **party arcade** that runs entirely on a single ESP32. The board hosts its
own Wi-Fi network; guests join with their phones and get a **~27-game arcade** in the
browser — solo games, head-to-head multiplayer, a live chat, and a shared leaderboard.
No internet, no app install, no cloud. Everything is served off a $3 chip.

> Wi-Fi name: **`Free Games 🎮 Join Me`** → the arcade auto-opens (captive portal), or
> browse to `http://192.168.4.1`.

## What's inside

**Solo (16):** Snake · 2048 · Offline Dino · Whack-a-mole · Flappy · Breakout · Tetris ·
Memory · Minesweeper · Simon · 15-Puzzle · Lights Out · Asteroids · Wordle · Blackjack ·
Idle Clicker.

**Versus (11), over the board's own relay:** Quick-Draw · Rock-Paper-Scissors ·
Tug-of-war · Connect-4 · Reaction Royale · Tic-Tac-Toe · Battleship · Trivia Buzzer ·
Speed Math · Hot Potato · Dots & Boxes.

**Plus:** 💬 lobby chat · 🏆 leaderboard (per-game high-score records **and** cumulative
versus wins) · 🔧 host/admin panel (kick, ban, reset duels, clear chat, reset leaderboard,
reset everyone's saved progress, edit the welcome text).

## Hardware

Any ESP32 (dev-kit / WROOM, CH340 or native USB). 4 MB flash is plenty — the whole
firmware+arcade uses ~32%.

## Architecture

- **SoftAP + captive portal** — the board answers every OS "is there internet?" probe
  with the arcade, so phones auto-pop it. (`DNSServer` wildcard + `onNotFound` serves the app.)
- **HTTP (`WebServer`, port 80)** serves one gzipped single-page app baked into flash as a
  PROGMEM byte array — no filesystem upload needed.
- **WebSockets (`WebSocketsServer`, port 81)** carries presence, chat, admin, the
  leaderboard, and multiplayer. Server-refereed games (Quick-Draw, RPS, Tug, Connect-4,
  Royale) have their logic in the firmware; the rest use a **generic relay** (the ESP just
  forwards messages between players in a room) with the game logic living in each JS file.
- **The web app is authored modularly** (`web/shell.html`, `web/style.css`, `web/app.js`,
  one file per game in `web/games/`). `tools/bundle.sh` inlines + gzips it all into
  `GamingCabinet/webassets.h`.

## Build & flash

Requires [`arduino-cli`](https://arduino.github.io/arduino-cli/) with the **esp32** core,
plus the **WebSockets** (Markus Sattler) and **ArduinoJson** libraries, and Python 3
(for the bundler). Then:

```sh
./flash-cabinet.sh                 # auto-detects /dev/ttyUSB0
./flash-cabinet.sh /dev/ttyUSB1    # or pass a port
```

It bundles the web app, clean-compiles with the `huge_app` partition, uploads, and verifies.
To rebuild the web bundle without flashing: `bash tools/bundle.sh`.

The **admin PIN** is set in `GamingCabinet/GamingCabinet.ino` (`ADMIN_PIN`).

## Ethos

It's harmless by design and by rule: the board runs **its own clearly-named, open network**
and provides no internet — it never impersonates another network, deauths, or spams nearby
devices. It's a toy arcade, not a tool for messing with anyone's phone.

## License

MIT — see [`LICENSE`](LICENSE).
