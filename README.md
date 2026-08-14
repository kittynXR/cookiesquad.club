# cookiesquad.club
CookieSquad VRChat raves & events — posters, lineups, and photo galleries.

## Local preview
Run a local static server from the repo root:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Updating the Discord embed (OpenGraph)
Discord link previews do **not** run JavaScript, so the embed comes from `index.html` meta tags.

1. Update `data/events.json`
2. Run:

```powershell
node scripts/sync-embed.mjs
```

This will automatically switch the embed text between:
- “Next event will be …” (when there’s an upcoming event)
- “Previous event was on …” (when there isn’t)

## Event fields
Each entry in `data/events.json` needs `id`, `title` and `doorsAt` (Unix epoch **seconds**). Optional:

- `poster` / `posterAlt` — omit both when there's no poster yet; the site renders a “Poster TBA” placeholder and the Discord embed falls back to the logo.
- `lineup` — omit or leave empty when the lineup isn't announced.
- `note` — one-line context shown under the title (world, collab, why it's a pop-up).
- `timeTba: true` — the date is confirmed but the start time isn't. Set `doorsAt` to the usual 9:30 PM ET doors so ordering and the countdown still work; the site and the embed will show the date and say the time is TBA.

Times are stored as epoch seconds and rendered in each visitor's local zone. Poster times are Eastern
(the `EST` column), which is 3 hours ahead of the times posted in Discord.

## Posters
Poster archive items live in `data/posters.json` and point to files in `assets/posters/`.

## Photo galleries + uploads (GitHub Pages)
Each event can have a gallery manifest at `assets/photos/<eventId>/manifest.json`.

Use the browser uploader at `admin/` to upload images directly into the repo via the GitHub API.
You’ll need a fine-grained GitHub token with **Contents: Read & Write** for this repo.

## Notes
- Make sure `assets/` is committed to the repo (logos/posters/favicons are required for the site to render).
- Discord may cache embeds for a while; if you need a refresh, change the URL slightly (e.g. add `?v=2`) when testing.
