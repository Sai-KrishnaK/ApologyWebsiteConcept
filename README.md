# Romantic Surprise - Expo Web

Mobile-first cinematic romantic web app built with Expo Router + Moti/Reanimated.

## Run

```bash
npm install
npx expo start --web
```

## Build For Deploy

```bash
npm run build:web
```

This exports to `dist/`.

## Deploy

- Vercel: `vercel.json` is included.
- Netlify: `netlify.toml` is included.

## Experience Notes

- Step-based flow (single session, no page reloads)
- Location gate: 1km radius check via `expo-location`
- Background music starts after user click (`expo-av`)
- Fade-to-black transitions + romantic particle effects
- Balloon pops include heart burst feedback and popup word text
- Pacing tuned for roughly 5-10 minutes depending on interaction speed

## Configure

In `app/index.tsx`:

- `TARGET_COORDS`
- `ALLOWED_RADIUS_METERS`

## Assets

Current demo uses hosted image/audio URLs for immediate web compatibility.
If you want your own files, follow `assets/README.md`.
