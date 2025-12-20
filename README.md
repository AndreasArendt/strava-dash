# Atlo

<p align="center">
  <img src="logo/atlo.png" alt="Atlo logo" width="160" />
</p>

Atlo lets Strava athletes explore their activity history on an interactive map in the selected time window.

## Features
* Plotting activity Data on the map
* Interpolation of polylines for smoother trajectories
* Minimum user-data footprint
* Activity summary
* Filter by Activity

## Architecture Overview

```
├── api/                # serverless functions (Strava OAuth, activities, help pages, etc.)
├── content/            # Markdown content rendered for public pages
├── lib/                # Shared utilities (session handling, cookie helpers, markdown sanitizer)
├── public/             # Static frontend (HTML, JS modules, styles, images)
└── vercel.json         # Deploy configuration
```

- The frontend is a plain HTML/JS app served from `public/`.
- API routes (in `api/`) run on Vercel’s Node runtime and call the Strava API.
- Sessions and tokens are cached in [Vercel KV](https://vercel.com/docs/storage/vercel-kv)
- Map rendering uses [MapTiler SDK](https://www.maptiler.com/maps/sdk/)

## Contributing / Feedback

This is a personal project, but issues and ideas are welcome. Reach out at [info@atlo.me](mailto:info@atlo.me) or open a GitHub issue. If you find a bug, please include reproduction steps if possible.
