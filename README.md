# Whyframe — Color Analyzer

Module 01 of the Whyframe design reasoning engine. Build or extract a palette, add project context, and get AI-powered analysis with contrast checks, shade scales, and actionable suggestions.

## Features

- Manual palette input (up to 5 colors with semantic roles)
- Image palette extraction via K-means clustering
- Light/dark/both contrast evaluation (WCAG)
- Per-color shade scales with Figma-ready SVG export
- AI overview, harmony notes, and replacement suggestions

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Groq API key

Get a free key at [console.groq.com](https://console.groq.com).

```bash
cp .env.example .env.local
```

Set `GROQ_API_KEY` in `.env.local` (local) or in your Vercel project environment variables (production).

### 3. Run locally

Static UI only (API calls will fail):

```bash
npm start
```

Full stack with API proxy (recommended):

```bash
npx vercel dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Add `GROQ_API_KEY` under **Settings → Environment Variables**.
4. Deploy.

## Project structure

| File | Purpose |
|------|---------|
| `whyframe_color_analyzer.html` | Main UI |
| `app.js` | Client logic, color math, rendering |
| `style.css` | Styles |
| `api/analyze.js` | Serverless proxy to Groq (keeps API key secret) |
| `vercel.json` | Route `/` to the HTML entry point |

## Daily-use tips

- Assign roles (`primary`, `text`, `background`, etc.) before analyzing — the AI uses them for context-aware feedback.
- Use **both** design mode when building themes that support light and dark UI.
- Add a short project mood in the context box for more relevant suggestions.
- After image extraction, click swatches to omit colors you do not want in the palette.

## License

Built during Ship69.
