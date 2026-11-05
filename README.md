# Mosswood

A peaceful, creative 3D forest village toy for desktop browsers. No build step or package installation is required. The game includes Three.js 0.187.0 in `vendor/` with its MIT license, so it works without a CDN.

## Play locally

Requires Node.js 20+:

```sh
npm start
```

Open port 5173 in your browser. Use `PORT=8080 npm start` to choose another port.

## Camera

- Hold the middle mouse button and drag to orbit horizontally and tilt vertically.
- Hold Shift and middle-drag to pan.
- Scroll the mouse wheel to zoom in or out.
- Use the on-screen rotation buttons, tilt slider, and zoom buttons for precise control.
- Q / E rotate; Recenter restores the original view.

Left-click builds; a short right-click removes a block. Left/right drags do not move the camera or edit the town. Middle-clicking or dragging never edits the town.

## Build a town

- **Cottage (1):** click empty ground for a house, a roof to add a floor, or an exposed wall to extend sideways at that floor. Build up to eight floors.
- **Path (2)** and **Tree (3):** click empty ground.
- **Remove (4):** click a block. Unsupported elevated components are removed with their last support. Components connected to another grounded tower remain.
- **Balcony (5):** click an upper wall to add a deck. Railings adapt to adjacent rooms and decks. Choose Cottage and click the deck to enclose it.
- **Alt-click** a room or deck to apply your selected timber and roof without extending it.
- **Undo / Ctrl+Z / Cmd+Z** restores the previous edit, including removed extensions.

To make an archway, build two two-floor towers with one empty tile between them, then click an inner upper wall to bridge the gap. Stone arch supports appear automatically. Adjacent top rooms connect their roof ridges along the X direction; this is an initial modular system, not a full Townscaper-style geometry engine.

Discoveries are earned from distinct cottage plots: villagers at 3, birch at 6, terracotta at 9, cedar and slate at 12. Discoveries stay unlocked after removal and undo. Villagers currently wander decoratively.

Towns autosave in browser local storage (`mosswood-v2`). The first launch imports a previous `mosswood-v1` town, including floors and materials, without deleting the old save. Storage is specific to your browser and site address.

## Validation

`npm run check` checks JavaScript syntax. `npm test` exercises save migration, supported outward placement, balcony conversion, arch detection, bounds, and removal of disconnected components. Browser validation also covers actual roof/wall clicks, camera gestures, undo, and reload persistence.

## Publish with GitHub Pages

In GitHub **Settings → Pages**, choose **Deploy from a branch**, **main**, and **/ (root)**, then Save. The game is available at https://grs1819.github.io/Astra/ after deployment.

Publish `index.html`, `style.css`, `app.js`, `town.js`, and the complete `vendor/` directory. The Node server is only needed for local development. No secrets or build configuration are required. Desktop browsers with WebGL2 support are required; touch gestures are available but mobile layouts are not yet optimized.
