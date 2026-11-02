# Lv20 Emerald Heaven — source prompts

Generated with the built-in `image_gen` tool, `transparent_background: true`.
The original source/candidate files are retained. No API/CLI generation was used.

## Finished-scene reference: frame15-v2-source.png

Reference/edit target: `frame15-source.png`.
Generated image: `exec-b80588f3-4d4e-4922-af68-8c570169f76d.png`.

> Use case: precise-object-edit. Asset: one finished full-scene game background sprite, final frame 15 of a sleeping celestial stag's Lv20 Emerald Heaven. Edit target: supplied original emerald-heaven painting. Keep this exact soft hand-painted fantasy style and recognizable teal-leaf golden twisting ancient tree embracing a luminous emerald, sapphire/gold cloud palace at upper right, delicate teal/gold rainbow behind it, slender waterfall on the right, low gold/pearl lotus resting dais and turquoise pool. Fix composition for a sleeping animal that will be drawn separately in FRONT: keep an open quiet lower-middle foreground, with no tall ornaments or tree roots in the lower central zone x=30–72% y=65–92%. This zone MUST remain naturally painted as a quiet pale mint pool and flat low golden lotus seat, NOT a transparent hole or cutout. Move the tree trunk to the left of that zone and keep emerald above it. The dais should be very low, near ground, with all pearl trim below the resting animal. No animal or character. Whole scene must stay within x=6–94% and y=7–92.5% of square canvas; baseline at 92.5%, transparent padding around every outer edge. Compact grass/cloud island footprint; upgrade vertically, not wider. Preserve rich but readable details at 168px display. Fully completed static tranquil scene, no floating loose confetti or text. Genuine transparent exterior only. No frame, labels, white matte or checkerboard.

## Growth sheet: growth-sheet-source.png

Reference: `frame15-v2-source.png`.
Generated image: `exec-81416e7a-55fc-4cc4-8f0d-dc88498ae712.png`.
The last cell is retained as `frame15-sheet-source.png`; cell 7 is retained as
`frame07-sheet-source.png` for the early-stage edits below.

> One square 4x4 sprite sheet with SIXTEEN equally sized cells. STRICT GEOMETRY is crucial: each cell is a square. Each scene must sit entirely inside the central 72% of its cell. Minimum 14% TRANSPARENT padding on all four sides of EVERY cell. Every full tree top, rainbow, cloud, root and pool must be visible and must NOT touch ANY cell edge. NO overhanging silhouettes, no touching adjacent scenes. Lots of transparent space between sprites. No text, labels, lines, frame or checkerboard. All cells use IDENTICAL fixed camera and identical object scale and ground line; incomplete scenes are SMALLER than completed scenes.
>
> Whole-scene painted Emerald Heaven garden GROWTH animation. Use the reference image exact art direction: emerald in a golden twisting tree on the LEFT, blue/gold palace on clouds to RIGHT, teal gold rainbow, thin waterfall, a LOW golden lotus dais with pearl trim CENTER FOREGROUND on a calm turquoise pool. No characters. Central resting area is naturally painted pool, NEVER a transparent hole. Each stage is a whole redrawn scene, never fade/wipe.
>
> Cells row-major: 0 empty transparent; 1 ONLY tiny floating emerald at left-of-center, its position exactly where it ends up in tree; 2 emerald + little white gold-edged ground clouds; 3 clouds spread into grass island; 4 very LOW golden lotus dais unfolds center foreground; 5 calm turquoise pool fills around dais; 6 palace appears on right rear clouds; 7 short GOLD tree trunk wraps emerald to left; 8 trunk gets taller and two bare branches extend upward, NO mature canopy yet; 9 small young teal canopy on branches; 10 canopy grows with small stars; 11 slender waterfall starts at right from cloud palace to pool; 12 thin teal/gold rainbow behind palace; 13 gold leaves and hanging emerald jewelry appear; 14 mature tree with more fine pearl/gold details; 15 completed reference scene. Keep the pool and dais identical in size and position from cells5 onward. All grown trees are still fully enclosed inside central72% of each cell. Highest priority is clear transparent gutters and no cropped art. No alpha opacity fade, green matte or colored border.

## Decay sheet: decay-sheet-source.png

References: `frame15-sheet-source.png` (shape) and `frame15-v2-source.png` (style).
Generated image: `exec-fe610638-f050-4dc0-a73b-0518048d6b8b.png`.

> Use case stylized-concept. One square 4x4 game animation sprite sheet, SIXTEEN whole-scene stages of Emerald Heaven garden magically dissolving when the stag wakes. First reference is the EXACT final garden shape to preserve; second reference is painting detail/style only. Same stationary left golden twisting trunk wrapping emerald, blue gold cloud palace right, low gold pearl lotus dais at center foreground, turquoise pool and teal canopy/rainbow. NO animal. All frames share one camera, scale, placement, baseline. Equal square grid, read left-to-right, top-to-bottom. Transparent background, no text, numbers, lines, labels. Every scene fully fits within its cell with ample transparent gutters (14% on every edge); NO touching neighboring art, NO cropping. Incomplete dissolving scenes get smaller as elements vanish; DO NOT zoom in.
>
> 16 individually painted stages, NOT opacity copies: 0 complete reference. 1 emerald dims slightly. 2 emerald dark, scene loses brightness one step. 3 rainbow faint and waterfall slows to a thin trickle. 4 rainbow gone, waterfall stopped. 5 cloud edges dissolve, palace begins sinking. 6 palace gone, only wispy clouds behind golden tree. 7 pool almost dry, low lotus dais petals begin closing inward. 8 pool dry, lotus fully closed very low, fallen pearls nearby. 9 stars in teal canopy go out, teal leaves shed. 10 bare golden tree with dull scales, fallen dull leaves, closed lotus. 11 tree/emerald/lotus start breaking into small golden and emerald stardust fragments, silhouette still recognizable. 12 remaining trunk dissolves into a gently curling spiral of gold/teal dust. 13 small spiral of stardust rising around center, most solid ground gone. 14 only a few faint tiny rising gold/teal dust motes. 15 COMPLETELY EMPTY transparent. No fire, brown rotten wasteland, border, matte or checkerboard. Keep naturally painted pool/dais area, no cutout hole. Distinct small neighboring steps and coherent objects fixed in position. Entire final result is one well-spaced 4x4 atlas of full-scene animation frames.

## Repainted growth stages 4–6

Each call references its `frameNN-sheet-source.png` edit target plus
`frame07-sheet-source.png` as the next-stage reference. Prompt template below,
with the corresponding `DETAIL` substituted.

> Use case: precise-object-edit. Single square full-scene sprite, one growth animation frame. Image 1 is the EDIT TARGET; Image 2 is NEXT frame for emerald position/style only. DETAIL The emerald must be identical in design, size and screen position to the green emerald INSIDE the small gold trunk in Image 2 (approximately x=34%, y=53% of entire canvas). Retain a quiet naturally painted open resting area over the low dais center foreground. Match the exact painted gold/teal style and object scale of the inputs. Preserve camera, bottom baseline and all already existing objects from Image 1; do NOT zoom or move them. Retain the target's square transparent canvas and ample empty upper space. Ground remains at approximately y=85% and dais center x=50%, y=73%. No added animal, text, border, checkerboard or background; true alpha transparent exterior. Return ONLY one whole scene, no sheet or comparison.

- `frame04-source.png`, generated `exec-44d4b159-36de-4789-90e7-006446f0c108.png`:
  DETAIL = Keep the low golden lotus dais. Restore the small low white gold-edged cloud and green grass island underneath the dais (as established by the adjacent growth stage). No turquoise pool yet. Above the LEFT half of the dais, add the luminous small green emerald that will later be embraced by the tree. No tree trunk and no palace yet.
- `frame05-source.png`, generated `exec-72f43588-d941-4ee2-9159-f1e66ed1dbb3.png`:
  DETAIL = Keep the pool, dais, low grass island and rocks exactly. Add the luminous small green emerald floating above the LEFT bank of the pool. No tree trunk or palace yet.
- `frame06-source.png`, generated `exec-7c6379fa-eb0d-4f31-ba17-d7f79b42bb41.png`:
  DETAIL = Keep the palace, clouds, pool, dais and low grass island exactly. Add the luminous small green emerald floating above the LEFT bank of the pool. Do not add a tree trunk yet.

## Repainted seed/cloud/grass stages 1–3

References: `frame04-source.png` and `frame07-sheet-source.png`.
Prompt template, substituting INDEX and DETAIL:

> Use case: precise-object-edit. One individual early growth animation frame INDEX for Emerald Heaven garden. The first reference is growth frame4: copy its camera, square canvas coordinates and overall object scale exactly. The second reference gives the next golden trunk's emerald identity. DETAIL Preserve the tiny floating emerald centered at x=35%, y=53% of the ENTIRE square canvas, about 9% canvas width and 13% height, with a soft restrained gold glow. Bottom of any cloud/grass base is fixed at y=85%, leaving 15% transparent space below. First-reference base's full footprint is x=6%..94%; keep those coordinates and DO NOT enlarge unfinished objects to fill the canvas. There must be a LOT of transparent empty upper area. Match hand-painted teal/emerald/gold style. No animal, text, frame, ground shadow, checkerboard or solid matte. Actual alpha-transparent exterior. Output a single square scene, no contact sheet.

- INDEX 1, `frame01-source.png`, generated `exec-2a0406e6-7658-4908-a277-56b577e4405f.png`:
  DETAIL = ONLY a small luminous emerald floating at the same position as the emerald in the first reference. No grass, clouds, dais, pool, rocks, tree, palace or rainbow yet. Surround it entirely with transparent empty space.
- INDEX 2, intermediate `exec-947fc724-0e45-4533-b329-79454f46d716.png`:
  DETAIL = Keep exactly the same floating emerald. Under it, add a low small patch of white clouds with delicate gold edges at the SAME ground baseline as the island in reference 1. The cloud patch is only half the final island width. No grass, dais, pool, tree, palace or rainbow.
- INDEX 3, intermediate `exec-65524e6c-d920-46f7-90ab-4dbdbf3b721b.png`:
  DETAIL = Keep the floating emerald in the exact same position. Spread a very low cloud island across the exact footprint of the island in reference 1 and add a thin fresh green grass cap. No dais, pool, tree, palace or rainbow yet.

The initial stage-2/3 generations retained the dais, so they were corrected with
two object-removal edits. Their source UUIDs identify the intermediate reference
images in the built-in generator output; only the corrected deliverables are
consumed by the packer. Correction template, substituting DETAIL:

> Use case: precise-object-edit. EDIT ONLY by REMOVING THE GOLDEN LOTUS PLATFORM from this image. DETAIL Preserve exact square canvas, fixed camera, scale and positions of the emerald and ground/cloud island. Do not center, zoom, move or duplicate anything. No new object, text, creature, background, border, checkerboard, pond or tree. Match the original painted artwork. Actual alpha-transparent background outside the little island and floating emerald. Output one scene.

- `frame02-source.png`, generated `exec-b196e77a-255f-47df-8644-b26ba5a87e07.png`:
  DETAIL = Keep the floating luminous emerald and the small low white-and-gold CLOUD patch below it. Remove every part of the gold circular platform, lotus petals, pearl rim and green platform-front jewel. The area where the platform was must become TRANSPARENT EMPTY SPACE above the remaining low clouds. No grass.
- `frame03-source.png`, generated `exec-6b1f5459-5175-4f15-acca-b53e7f4053cc.png`:
  DETAIL = Keep the floating luminous emerald and the low green GRASS and white CLOUD island below it. Remove every part of the gold circular platform, lotus petals, pearl rim and green platform-front jewel. Where the platform was, continue the low flat grass surface naturally. Leave the whole central area open; no platform or object.

## Packing and review

`node scripts/pack-home-sleep-garden-lv20.cjs` extracts the source scenes and
replaces stages 1–6, clears faint alpha residue, applies one common scale, anchors
grounded scenes at y=296, and writes `packed320/` plus the two runtime atlases.
The mature scene is the last painted growth-sheet cell, not the separate initial
concept. The first decay frame copies it exactly after quantization. Empty
endpoints and the atlas footprint/budget are asserted before completion.

`swift -module-cache-path /private/tmp/lifemate-lv20-swift-cache scripts/review-home-sleep-garden-lv20.swift`
creates 3.8s growth and 4.8s decay GIFs from the actual runtime atlases.
