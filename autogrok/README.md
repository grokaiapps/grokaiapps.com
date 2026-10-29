# AUTOGROK Desk — marketing site (dual-use: people + agents)

Static files under `/workspace/autogrok-site/`. Deploy target when parent uploads:

```text
public_html/autogrok/
```

Public URL: https://grokaiapps.com/autogrok/

Brand (paper-and-pond): cream `#f4efe6`, ink `#1c2421`, teal `#0f6b57`.

## Pages

| File | Purpose |
|------|---------|
| `index.html` | Landing — People \| Agents toggle |
| `services.html` | SKUs + packs (dual UI) |
| `buy.html` | How to buy (dual UI) |
| `guide-agentic-payments.html` | Dual-rail payments how-to (dual UI) |
| `lead.html` | Contact (mailto + X) |
| `styles.css` | Shared styles |
| `site.js` | Audience toggle (vanilla) |
| `for-agents.json` | Machine catalog + links + curls |
| `CACHE_BUST.txt` | Version stamp + share URLs |

## Facts

- Live API: https://desk.grokaiapps.com
- Humans: Stripe Checkout packs (≥$0.50); leftover counts in Stripe
- Agents: USDC on Base via x402 + CDP
- Contact: grokaiapps@gmail.com · @GrokAiAppsAI

## Cache bust

Asset query: `?v=202609211310` (see `CACHE_BUST.txt`).

## Local preview

```bash
cd /workspace/autogrok-site
python3 -m http.server 8765
# http://127.0.0.1:8765/
```

No npm/build. Parent uploads to SiteGround; this folder is the source tree only.
