# Apartment Monsters — a mixed-reality shooter for Quest 3

Monsters break through the walls of your real room. Runs in the Meta Quest 3 browser via WebXR (React Three Fiber + `@react-three/xr`). The game speaks English and Russian; switch on the title screen.

## How to play

- The blaster is in your right hand; the trigger fires.
- Small flyers come out of the walls. At first only eye orbs; from level 3 winged skulls join them (faster, they dive from above); from level 4 flaming skulls too: they hover, flare up and ram you, bursting on impact, and a single shot brings them down. Each spawn opens several rifts, but the creature comes out of only one of them; you hear the rift crack from the side where it opened.
- Before a lunge a creature freezes and shudders: that is your chance to shoot. A lunge that lands bites off one of your five armor points.
- A level ends after 6 kills, then 2 more each level. Creatures take 1 hit on level 1, 2 on level 2, and 3 from level 3 on.
- Every third level ends with a boss: the Three-Head Baby Mutant walks out of a wall, stalks you and leaps.
- Lose all armor and the level starts over.
- A panel lies along your left forearm: level, armor, creature counter or boss health, and the buttons Pause, Restart, Shadows, Light −, Light + and Occlusion. Look at the panel and the blaster turns into a pointer; aim at a button and pull the trigger.

Without a room scan (Space Setup) the game puts virtual walls around you at three metres.

Level balance lives in `src/game/rules.ts`.

## Running on the headset over Wi-Fi

1. Connect the Mac and the Quest 3 to the same Wi-Fi network.
2. Start the dev server:

   ```bash
   npm run dev
   ```

3. In the headset browser, open `https://<Mac IP>:5173` (the IP is on the Network line of the server output).
4. On the certificate warning, tap Advanced, then Proceed.
5. Tap Enter the room and allow access to your space.

## Running on the headset over USB

Use this when the headset cannot reach the Mac over Wi-Fi (a different subnet or client isolation on the router).

1. Turn on developer mode for the headset (Meta Horizon app → your device → headset settings).
2. Connect the headset to the Mac with a USB-C data cable and allow USB debugging in the headset.
3. Start the dev server with `npm run dev`.
4. Forward the port:

   ```bash
   adb reverse tcp:5173 tcp:5173
   ```

5. In the headset browser, open `https://localhost:5173`.

## Running on a Mac with the emulator

```bash
npm run dev:local
```

Open `http://localhost:5174`. The Quest 3 emulator (IWER) supplies a synthetic living room.

To look at a single creature on a turntable, open `http://localhost:5174/?preview=orb` (or `wingskull`, `fireskull`).

## Models

- The game loads compressed models from `public/models/*.glb`.
- The Blender scene (`assets/source/hunter-models.blend`, textures packed) and full-size exports (`assets/export/*.glb`) are kept out of the repository because of their size. With them in place, `npm run models` rebuilds the compressed models.

## Model credits (CC BY 4.0)

- Prototype Pistol — vaportrash, https://sketchfab.com/3d-models/863482cf4d384e49a403b2963c7e7f8f
- Three-Head Baby Mutant — LxNazarov, https://sketchfab.com/3d-models/a769a92a263d47488b8fb2136c2759fb
- Flyning monster (eye orb) — Vladies, https://sketchfab.com/3d-models/8bccab10deb54ea090d99a6255a20195
- Hoefnagel creature (winged skull, gold ornaments removed) — silicat, https://sketchfab.com/3d-models/9a92596a121f412299dfbc61b1bb01aa
- Realistic Skull with animation (flaming skull) — theauditor, https://sketchfab.com/3d-models/f18b6609047d4183a4d7c72abca9e553
