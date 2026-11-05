# Stillwater

*Still water - a little place to grow.*

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
- Q / E rotate; R restores the original view.
- Camera controls are mouse and keyboard only, keeping the scene clear.

Left-click builds; a short right-click removes a block. Left/right drags do not move the camera or edit the town. Middle-clicking or dragging never edits the town.

## Building dock

Click the Stillwater logo at the bottom (or press B) to open or close the compact animated building dock. It starts collapsed. Choose tools, timber colors, and roof materials inside. The **Tasks** button reveals progress and discoveries inside the dock; tasks start hidden and hide again when you close the dock. **How to play** contains the building and camera instructions. Escape closes the dock and returns keyboard focus to the logo. Hidden controls cannot receive keyboard focus, and reduced-motion preferences disable animations.

Your selected tool and materials stay active while the dock is collapsed; 1–6 and undo shortcuts work during play.

## Build a town

- **Cottage (1):** click empty ground for a house, a roof to add a floor, or an exposed wall to extend sideways at that floor. Build up to eight floors.
- **Path (2)** and **Tree (3):** click empty ground.
- **Remove (4):** click a block. Unsupported elevated components are removed with their last support. Components connected to another grounded tower remain.
- **Balcony (5):** click an upper wall to add a deck. Railings adapt to adjacent rooms and decks. Choose Cottage and click the deck to enclose it.
- **Alt-click** a room or deck to apply your selected timber and roof without extending it.
- **Undo / Ctrl+Z / Cmd+Z** restores the previous edit, including removed extensions.

To make an archway, build two two-floor towers with one empty tile between them, then click an inner upper wall to bridge the gap. Stone arch supports appear automatically. Single cottages get hipped roofs. Connected roof footprints share a sloped ridge along their longest direction. Exposed lower roofs beside taller rooms become railed timber terraces, with doorways from adjacent rooms. Raised waterside entrances gain steps where the frontage is dry and open. Build directly on a terrace to add another floor; roofs and terraces recalculate after placement, removal, or undo. This remains a grid-based modular system.

Discoveries are earned from distinct cottage plots: villagers at 3, birch at 6, terracotta at 9, cedar and slate at 12. Discoveries stay unlocked after removal and undo. Villagers are small animated characters with walking limbs, varied clothes, hair, and hats. They follow ground and path routes instead of drifting through buildings or open water.

Towns autosave in browser local storage (`mosswood-v2`); this existing key is intentionally retained so the Stillwater rebrand preserves your saved village. The first launch imports a previous `mosswood-v1` town, including floors and materials, without deleting the old save. Storage is specific to your browser and site address.

## Village life

Three cottage plots unlock residents. Each accessible ground-floor cottage can show two residents, up to 24 visible characters. Walkers prefer paths but can explore dry ground. Build at least **three connected path tiles near a home** to see some residents ride bicycles, with turning wheels and pedaling legs. Connected wooden footbridges also support walking and cycling.

Residents follow routes around buildings, trees, open water, and bridge railings. Their feet and wheels follow ground and deck heights. Editing the village recalculates routes immediately; residents without a safe way out stay indoors. Animation pauses with the system's reduced-motion preference. Residents are ambient village life, not a traffic or needs simulation.

## Streams, rivers, and lakes

Choose **Water (6)** in the building dock, then select **Stream**, **River**, or **Lake**. Each click adds one grid tile: streams form narrow connected channels, rivers are wider, and lake tiles fill out an open surface. Different water types join at shared edges; diagonal corners remain separate bodies. Click an existing water tile to change its type.

Water is a separate saved terrain layer. Add it before building or beneath existing cottages and paths. Cottages over water gain timber stilts; paths become planked footbridges. Trees require dry ground and must be removed before painting water beneath them. Villagers avoid open water and can walk on footbridges.

Each connected water body gains detail at these sizes:

- **1–3 tiles:** gentle animated ripples.
- **4+ tiles:** shoreline pebbles.
- **10+ tiles:** larger boulders.
- **18+ tiles:** shoreline reeds and occasional lily pads on lakes.

The water surface has continuous animated ripples, sunlight highlights, pale shallow edges, and deeper color toward the center. Streams move faster than lakes. Surface motion pauses when your system requests reduced motion; lighting and shoreline color remain visible.

Decorations are automatic and avoid occupied tiles. Splitting or shrinking a body recalculates its detail level. This is a creative water-painting system; water does not simulate flooding or gravity.

With Water selected, **right-click removes water only**, including beneath buildings. With other tools selected, right-click removes the clicked building or exposed water. Removing a building leaves its water underneath. Undo restores both terrain and buildings together. Existing saved villages load with an empty water layer.

## Validation

`npm run check` checks JavaScript syntax. `npm test` exercises save migration, supported outward placement, balcony conversion, arch detection, bounds, and removal of disconnected components. Water tests cover connected bodies, detail thresholds, terrain/building independence, persistence normalization, and invalid edits. Browser validation also covers actual roof/wall clicks, camera gestures, undo, and reload persistence.

## Publish with GitHub Pages

In GitHub **Settings → Pages**, choose **Deploy from a branch**, **main**, and **/ (root)**, then Save. The game is available at https://grs1819.github.io/Stillwater/ after deployment.

Publish `index.html`, `style.css`, `app.js`, `town.js`, `water.js`, `water-view.js`, `navigation.js`, `villagers.js`, and the complete `vendor/` and `assets/` directories. The Node server is only needed for local development. No secrets or build configuration are required. Desktop browsers with WebGL2 support are required; touch gestures are available but mobile layouts are not yet optimized.

## Brand assets

The approved house, warm window, and water-line logo is in `assets/stillwater-mark.png`. The contrasting pine-green app and browser icon is in `assets/stillwater-icon.png`. Both assets are bundled locally. The game name is Stillwater; the displayed slogan is “Still water - a little place to grow”.

### Growing architecture
Connected house rooms evolve together: one or two ground-floor rooms remain cottages;
two stories or three rooms become a log cabin; four stories or ten rooms become an
estate. Log cabins have rounded timber courses. Estates gain stone foundations,
plaster and timber upper walls, paired tall windows, framed entrances, cornices,
steeper roofs, and capped chimneys. Timber and roofing selections still apply.
Terraces and shared roof ridges continue to follow the footprint. Removing rooms,
undoing, and loading a saved town recalculate the style automatically. Balconies
connect walkable spaces without merging separate architectural styles.

Roof finishes evolve with the same architecture stages: cottages use softly
clumped moss; log cabins use weathered ribbed metal with exposed fasteners;
estates use wider standing-seam panels with raised seams and a smoother metallic
finish. Roof color remains selectable. Details follow sloped faces, including
hip roofs and joined gables, while terraces remain usable timber decks.

The roof menu selects Forest green, Rust red (9 cottages), or Slate blue (12 cottages). Cottage moss remains green over the selected roof color; growing buildings retain that color as roofing becomes metal. Existing saved roof selections carry over without migration.

## Beta-first releases

Live: https://grs1819.github.io/Stillwater/
Beta: https://grs1819.github.io/Stillwater/beta/

Changes are developed on the `beta` branch, then staged from a committed snapshot
with `node scripts/stage-beta.mjs <commit>` in the main checkout. Only the generated
`beta/` folder is published to main during testing; root live game files stay
unchanged. `beta/release.json` records the exact source commit. After user approval,
that exact version can be promoted to the live root. See AGENTS.md for the workflow.

Beta has separate browser saves, so it starts with a fresh town and does not read
or overwrite live towns. Saves persist between beta updates, but beta towns are
not automatically transferred to live. The two sites share GitHub Pages hosting;
this is a separate test game and save namespace, not a separate database.

## Building purposes and camping

Use **Role (8)**, choose Home, Fishing hut, Outdoor supply shop, Bakery & café,
Inn & lodge, Carpenter’s workshop, or Boathouse, then click a house. The purpose
applies to all connected house rooms and adds a sign and matching entrance props.
New rooms extended directly from a role building inherit its purpose. Residents
visit reachable entrances and pause there; waterfront buildings also attract
visits to nearby banks, where walkers can fish beside fishing huts. Roles are an
initial activity layer: no money, inventories, boat simulation, or production yet.

Use **Camp (7)** on empty dry ground to place a lean-to. Click it with Camp again
to upgrade to a tent, then a raised glamping shelter with bedding and a lantern.
Camps welcome walkers before the cottage population unlock. Camps block movement
through their occupied tile, cannot be flooded, and support Undo and autosave.
Right-click removes a campsite. Upgrades remain on the same one-tile footprint.
