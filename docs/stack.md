# Stack

Recommendation: Vite + Phaser 3, vanilla JavaScript.

Why this, in short:

- The official challenge asks for a browser-playable tool with no download and no account. A web game meets that.
- Phaser 3 is a 2D game library (scenes, sprites, input, tweens). It is a better fit than a generic UI framework for a 34-hour outpost game.
- Vite starts fast and is simple on Windows.
- Vanilla JS avoids React or TypeScript setup time. If someone on the team already lives in React, `npm create vite@latest . -- --template react` is fine, then `npm i phaser`. Do not mix in a new language you have not used.

Do not write game code before 8:00 AM PKT on Saturday 14 Nov 2026. You may install Node and create an empty Vite app after the start, or even install Node now. An empty template with no game logic is allowed. This repo does not include a starter app, to keep the pre-start line clean.

## Install on Windows (cmd)

Install Node.js LTS if it is not already installed:

```
winget install OpenJS.NodeJS.LTS
```

Close and reopen cmd, then check:

```
node -v
npm -v
```

You want Node 20 or later.

After the hackathon starts, in the folder where you want the game (not this prep folder, or in a new `game` subfolder you create after 8 AM):

```
npm create vite@latest junior-astronaut -- --template vanilla
cd junior-astronaut
npm i
npm i phaser
npm run dev
```

If `npm create vite` asks questions, accept the defaults for a vanilla project.

The dev server prints a local URL, usually http://localhost:5173/. Open that in a browser.

## What not to install before you need it

Skip Unity, Unreal, and native mobile toolchains. They cost too much time in 34 hours. Skip a backend and a login. If you want Urdu voice, you can use the browser's `speechSynthesis` or a small pre-recorded clip during the event, not a custom voice model.
