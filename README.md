# Mosswood

A peaceful isometric forest village toy for desktop browsers. No build step or external dependencies; requires Node.js 20+.

## Play locally

```sh
npm start
```

Open port 5173 in your browser. Use `PORT=8080 npm start` to choose another port.

Click ground to place cottages, paths, or trees. Click a cottage to add floors (up to three) and apply the selected materials. Right-click to remove. Drag to pan, scroll to zoom, and use 1–4 to select tools. Undo supports Ctrl/Cmd+Z. Towns save automatically in browser local storage.

Discoveries are earned from distinct cottages: villagers at 3, birch at 6, terracotta at 9, cedar and slate at 12. Discoveries remain unlocked after removing cottages or undoing edits.

## Checks

`npm run check` checks JavaScript syntax. The prototype uses procedural Canvas 2D artwork and an isometric camera. Villagers currently wander decoratively; connected roofs, pathfinding, sound, and dedicated mobile controls are future work.

## Publish with GitHub Pages

In the GitHub repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select **main** and **/ (root)**, then Save. Once deployment finishes, the game is available at https://grs1819.github.io/Astra/.

The site consists of `index.html`, `style.css`, and `app.js`; the Node server is only needed for local development. No secrets or build configuration are required for GitHub Pages.
