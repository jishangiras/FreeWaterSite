<p align="center">
  <img src="src/images/freewatersite-logo.svg" alt="FreeWaterSite" height="60">
</p>

<h3 align="center">Find free drinking water — anywhere on Earth</h3>

<p align="center">
  <strong>FreeWaterSite</strong> maps public drinking water worldwide, runs free water stations at events, and builds permanent access points in communities that need them most.
</p>

<p align="center">
  <a href="https://freewatersite.org">freewatersite.org</a> &nbsp;·&nbsp;
  <a href="https://github.com/jishangiras/FreeWaterSite/issues">Report an issue</a>
</p>

---

## Why free water?

Clean drinking water should be free. Always. Everywhere.

Billions of people pay for water that should be a basic right, or can't find a tap when they need one. FreeWaterSite is a community-powered response to that problem — built in the open, run by volunteers, funded by people who agree.

**Three ways we help:**

| | |
|---|---|
| 🔵 **Find water** | Search any city on Earth for free public drinking water using real-time OpenStreetMap data — no account, no fee. |
| 🟢 **Events & stations** | We run free water stations at festivals, marathons, markets, and community events worldwide. |
| 🟤 **Build access** | We design and install permanent free water infrastructure in public spaces where none exists. |

---

## Live site

**[https://freewatersite.org](https://freewatersite.org)**

---

## How it works

FreeWaterSite is a fully static web app — no backend, no database, no login. Everything runs in the browser.

- **Map data**: [OpenStreetMap](https://openstreetmap.org) via the [Overpass API](https://overpass-api.de)
- **Geocoding**: [Nominatim](https://nominatim.openstreetmap.org)
- **Mapping library**: [Leaflet 1.9](https://leafletjs.com)
- **Hosting**: GitHub Pages

---

## Local development

```sh
# Install dependencies
npm ci

# Build to dist/
npm run build

# Serve (or open dist/index.html directly)
npx serve dist -p 4321
```

### Docker

```sh
docker build -t freewatersite .
docker run --rm -p 8080:8080 freewatersite
# → http://localhost:8080
```

---

## Deployment

Every push to `main` triggers `.github/workflows/pages.yml`, which builds `dist/` and deploys it to GitHub Pages automatically.

Custom domain is `freewatersite.org`, configured via `src/CNAME`.

---

## Contributing

All water data comes from [OpenStreetMap](https://openstreetmap.org). The best way to add a missing water source is to add it directly to OSM — it will appear on FreeWaterSite automatically.

For bugs, feature requests, or questions, [open an issue](https://github.com/jishangiras/FreeWaterSite/issues).

---

## Donations

FreeWaterSite is volunteer-run. Donations fund water station equipment, installation costs, and ongoing development. See the **Give** button on the site.

---

<p align="center">
  Made with ☀️ for everyone who just needs a drink of water.
</p>
