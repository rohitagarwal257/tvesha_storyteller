# Storytelling by Tvesha

**20** pre-loaded bedtime stories—**5** for each topic: **Unicorn**, **Fantasy**, **Magic**, and **Fairies**.

Each tale is written for **slow read-aloud** (roughly **5–10 minutes**, depending on pace and pauses). They are full stories with beginnings, middles, and endings—not single-scene sketches.

Pick a topic, then **Open tonight’s story** for a random pick. **Another story, same topic** tries not to repeat the one you just read.

Stories live in `preloaded-stories.js` (no AI, no API keys). Read-aloud uses your browser’s built-in speech.

## Run the site

```bash
npm install
npm start
```

Open **http://localhost:3000** (avoid opening `index.html` as `file://` so scripts load reliably).

## Deploy (Netlify)

**Live site:** [tvesha-storyteller.netlify.app](https://tvesha-storyteller.netlify.app)

The site is static files only; **Netlify** can host it without Node. This repo is also on GitHub—you can connect it under **Site configuration → Build & deploy → Continuous deployment → Link repository** so every push rebuilds automatically. Publish directory **`.`**, build settings match `netlify.toml`.

## Change or add stories

Edit **`preloaded-stories.js`**. Each topic is an array of `{ title, paragraphs }`. Keep the keys exactly: `unicorn`, `fantasy`, `magic`, `fairies`.

## Troubleshooting

| Problem | What to try |
|--------|-------------|
| Blank story area | Refresh; confirm `preloaded-stories.js` is in the project folder. |
| Read aloud silent | Check system volume; try Chrome or Edge (speech voices vary by browser). |

Made with love for cozy purple-pink-blue nights.
