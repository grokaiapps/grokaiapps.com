# grokaiapps.com

A starting place for using agentic tools well.

Live site: https://grokaiapps.com

## About

Grok means to understand something so thoroughly it becomes part of how you move. GROKAIAPPS applies that to agentic tools: real work, honest limits, and keeping what is helpful, useful, and interesting.

## Purpose

Be a good steward of this space. Help people use agentic tools in a positive, responsible way. Record what is actually worth sharing, so others can help themselves and help others. A ripple in a pond, with a clear purpose.

## Working agreement

- Sandbox and review here first.
- Nothing goes live or gets deleted without Wayne's say-so.
- Keep it lightweight, documented, and open source when it helps.
- Never spend money without permission unless Wayne gives an explicit override.

## Layout

Vanilla HTML/CSS/JS. The homepage is an app-like shell: top bar, tabs, and a left-to-right stage (Watch, About, Start, Gallery).

`intro.mp4` sits next to `index.html`. It is the web encode of the intro (1280×720, ~6 MB). Git ignores it because of size; keep the file on disk and copy it with the site when you deploy. `intro-poster.jpg` is the poster frame. Captions: `intro.vtt`.

Canonical share URL for the intro: https://grokaiapps.com/#watch

## Deploy

There is no deploy script in this repo. The live web root is on SiteGround. To publish, after Wayne says so:

1. Copy the site folder with rsync or scp, **including** `intro.mp4` (git pull on the server will not bring the movie).
2. Also copy `index.html`, `app.css`, `app.js`, `intro-poster.jpg`, `intro.vtt`, icons, and `gallery/`.
3. Skip `.git`.

Example shape (fill in the real host path):

```
rsync -avz --exclude .git --exclude .gitignore ./ user@host:public_html/
```

## Status

Homepage is the intro watch shell. Confirm before replacing SiteGround's under-construction page.
