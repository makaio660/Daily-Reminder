# Daily-Reminder

Life Planner is a browser-based daily planner with tasks, repeat reminders, quiet hours, and local browser notifications.

## Run locally

Open `index.html` in a browser, or run a local server from this folder:

```bash
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000/`.

## Deploy with Vercel

Use this one-click import link while signed in to Vercel:

[Import Daily-Reminder into Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmakaio660%2FDaily-Reminder)

Use these project settings if Vercel asks for them:

- Root directory: repository root (`.`)
- Framework preset: `Other`
- Build command: leave blank
- Output directory: leave blank
- Install command: leave blank

Vercel will serve the root `index.html` file. The existing `vercel.json` is kept at the repository root for Vercel configuration.

## GitHub Pages fallback

This repository also includes a GitHub Pages workflow. In the repository settings, open **Pages**, set the source to **GitHub Actions**, and the site will publish at:

`https://makaio660.github.io/Daily-Reminder/`
