# FreeWaterSite

FreeWaterSite is a lightweight static web app for finding free public drinking water nearby using OpenStreetMap data.

## Overview

The app runs entirely in the browser. It can be hosted for free on GitHub Pages because it builds to plain HTML, CSS, JavaScript, and image assets in `dist/`.

## Features

- Interactive Leaflet map with public drinking water markers
- Search functionality with autocomplete
- Location detection
- Directions links for OpenStreetMap and Google Maps
- Free OpenStreetMap and Overpass API data sources
- Responsive design

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript, Leaflet.js
- **Hosting**: GitHub Pages through GitHub Actions
- **APIs**: OpenStreetMap, Nominatim, Overpass API

## Local Development

```sh
npm ci
npm run build
```

Open `dist/index.html` after building, or serve `dist/` with any static file server.

## Deployment

This repository includes `.github/workflows/pages.yml`, which builds `dist/` and deploys it to GitHub Pages on every push to `main`.

In GitHub, set **Settings > Pages > Build and deployment > Source** to **GitHub Actions**. The project site URL will be:

https://jishangiras.github.io/freewatersite/

## Docker

Build and run the static container:

```sh
docker build -t freewatersite .
docker run --rm -p 8080:8080 freewatersite
```

Then open http://localhost:8080.
