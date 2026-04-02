# Local Asset Slots

Drop your own romantic assets here and then update the constants in `app/index.tsx`:

- `MEMORY_IMAGES` (3 images)
- `FINAL_IMAGES` (2 images)
- `COUPLE_IMAGE` (1 image for puzzle)
- `MUSIC_URL` (1 audio file URL)

If you want fully local files (instead of URLs), use:

```ts
const COUPLE_IMAGE = Asset.fromModule(require("../assets/couple.jpg")).uri;
```

For the web build, keeping URLs is the simplest deployment path.
