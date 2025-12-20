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

## Posters
Poster archive items live in `data/posters.json` and point to files in `assets/posters/`.

## Photo galleries + uploads (GitHub Pages)
Each event can have a gallery manifest at `assets/photos/<eventId>/manifest.json`.

Use the browser uploader at `admin/` to upload images directly into the repo via the GitHub API.
You’ll need a fine-grained GitHub token with **Contents: Read & Write** for this repo.

## Notes
- Make sure `assets/` is committed to the repo (logos/posters/favicons are required for the site to render).
- Discord may cache embeds for a while; if you need a refresh, change the URL slightly (e.g. add `?v=2`) when testing.
