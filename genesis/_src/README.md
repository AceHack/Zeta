# Project Genesis — interactive prototype (built static site)

This directory holds an interactive React prototype of an AI-native OS UI
("Project Genesis"), deployed as a **subfolder of the existing Zeta GitHub
Pages site** so it does not disturb the primary (Jekyll) Pages deployment.

- **Live URL:** https://lucent-financial-group.github.io/Zeta/genesis/
- **Served files:** `genesis/index.html` + `genesis/assets/*` (static; served
  verbatim by the existing Jekyll Pages build — Jekyll only copies files that
  have no YAML front matter).
- **`_src/`:** the reproducible source. The leading underscore makes Jekyll
  skip it, so it is committed for auditability but never served.

The component (`_src/src/Genesis.jsx`) is treated as final and is committed
**unchanged** from the original upload. Only the Vite wrapper around it
(`main.jsx`, `index.css`, `index.html`, `vite.config.js`) is project config.

## Rebuild

```bash
cd _src
npm install          # react, react-dom, lucide-react (+ vite, @vitejs/plugin-react)
npm install lucide-react
npm run build        # emits dist/ with base=/Zeta/genesis/
# copy dist/* up into ../  (the served genesis/ folder)
```

`vite.config.js` sets `base: "/Zeta/genesis/"` so assets resolve under the
project Pages path. If this is ever moved to its own repo or to Vercel/Netlify,
set `base` back to `"/"`.

Dependencies (pinned at build time): react 19, react-dom 19, lucide-react 1.x,
vite 8, @vitejs/plugin-react 6.
