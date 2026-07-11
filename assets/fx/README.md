# Strike effect sprites (`assets/fx/`)

Drop-in textures for the soup strike animations. Each energy event in
`js/config.js` (`energyEvents.table`) names a `sprite:` file here. If the file
exists it is drawn in place of the built-in procedural effect; if it's missing
or still loading, the procedural version runs instead — so the game never breaks
on an absent file. You can add them one at a time.

## What to make (exact spec)

- **Format:** `PNG`, 32-bit, **with alpha transparency**. (SVG also works if you
  prefer vector — keep the same rules and tell the dev to load it as an Image.)
- **Canvas:** square, **256 × 256 px**, art centred. Bigger source = crisper when
  meteors/volcanoes scale up.
- **Background:** fully transparent. Never a solid backdrop.
- **Colour:** paint **near-WHITE** art on transparency. The engine tints every
  effect to that event's colour at runtime and blends it additively (`lighter`),
  so coloured source art comes out wrong. Think "white glow I'll dye later."
- **One element per file. No frames, no timeline.** A single still image — the
  game supplies all motion (travel, rise, spin), size, fade and colour.
- **Do NOT** make GIFs, sprite sheets, videos, or Lottie files.

## Exact file list (5 files cover all 6 events)

| File | Event(s) | How the code animates it | Art brief |
| --- | --- | --- | --- |
| `bolt.png` | Lightning | stretched vertically from sky to the click point, fades in 0.36s | a tall jagged lightning bolt, roughly top-to-bottom, glowing white |
| `ray.png` | Solar / UV | grows + slowly rotates at the click point, fades in 0.7s | a radial sunburst / starburst of rays from the centre |
| `bubble.png` | Bubble Cavitation | many spawned, each rises + grows, fades in 0.8s | a single soft round bubble / ring |
| `volcano.png` | Volcanic | rises + expands from the vent, fades in 1.1s | an erupting column / mushrooming plume |
| `geothermal.png` | Geothermal | same rising draw, drawn smaller (0.7×) | a gentle vertical trail of rising bubbles |
| `meteor.png` | Meteor | drawn as the head streaking down the path (art already faces travel, no runtime rotation) | a comet head with a short tail, head down-left / tail up-right |
| `spark.png` | Meteor (impact) | flashes + spins + grows at the impact point as the streak lands | a 4-point sparkle / star flare |

`plume.png` is included as an unused spare (soft smoke column) — a drop-in
alternative for `volcano.png`/`geothermal.png`; swap it in via the `sprite:` field
in `js/config.js` if preferred.

Tune size/speed/duration per event later in `js/render.js` (`drawEffects`) and
`R.playEvent`. Each event's texture is named by its `sprite:` (and the meteor's
`bloomSprite:`) field in `config.energyEvents.table`.
