# Pet animation atlases

The15 pets each have an activity atlas and a species-specific rest atlas:
30 bundled PNGs ×16 poses =480 frame slots. Each atlas is1024×1024 with4×4
cells of256px. Activity atlas rows remain idle/blink, locomotion, happy, skill;
rest atlases show settling poses and a held sleeping pose. Runtime mappings live
in `pixelPetFrames.ts` and `petRestAnimation.ts`.

The14 illustrated atlases were created with the built-in image_gen tool using
the corresponding original PNG in the parent directory. White Tiger retains
the existing code-native pixel artwork, with leg/head/feature poses baked into
its atlas. No original artwork was overwritten. Full prompt set and provenance
are in provenance.json.

Packing isolates whole connected character silhouettes before assigning cells,
so a wing crossing a nominal source grid line is retained. All poses in one
sheet use one scale and a common source-cell coordinate system; transparent
gutters prevent adjacent-frame bleed. PNG palette transparency is encoded in
tRNS (some image inspectors display the unused transparent RGB colour).

One decoded1024×1024 RGBA atlas is approximately4MiB; this is an estimate, not
a measured application memory profile. There is no preload of all species.
Locomotion has four authored poses. Reanimated cross-fades most of each pose
interval and interpolates body lift on the UI thread at the display refresh
rate (60Hz target on a 60Hz display). This is rendered-frame rate, not 60 unique
hand-authored poses per second. Inactive/reduced-motion views show the neutral
frame; loading/errors show the original art/pixel rig.

The admin-only Celestial Stag is separate from the 15-pet pool: its
`celestial_stag.png` atlas is2048×2048, with8 columns ×8 rows of256px cells
(64 complete character frames): 16 poses each for idle, locomotion, happy, and
skill. Every silhouette is isolated and repacked with transparent margins,
preventing adjacent poses from entering a cell. The UI thread blends poses
continuously at the display refresh rate (60Hz on a 60Hz display); runtime does
not assemble or rotate separate wing, head, or tail layers.
One decoded base stag atlas is approximately16MiB RGBA. Home uses the smaller
gait atlases below and mounts only the atlas for the current gait.

Home uses corrected `_v2` full-body atlases for the Stag's ground trot, flight
loop, takeoff, and landing. All four sheets are 4×4, with16 poses each and a
consistent rounded chest, belly and haunches. Complete poses are registered
using their face anchor at one shared pixel scale, so raised wings do not
shrink or displace the body. The generated pose sheets are
segmented globally before packing so wings and tails that cross nominal cell
edges remain intact. One shared scale per sheet and transparent gutters keep
the character size consistent and prevent adjacent poses from bleeding into a
frame. Takeoff progresses from folded wings to airborne; the glide settles on
spread wings; landing starts with spread wings, extends the hooves, then folds
the wings before ground locomotion resumes. The 20-second Home sequence shares
its takeoff, glide and landing clock with pose playback. Flapping ends at a
complete wingbeat; exact copies of boundary poses bridge the atlases. These
whole-body poses switch without cross-fading to avoid ghosted
legs or wings. Only the atlas for the current phase is mounted. Source and
packing details are in provenance.json and
`scripts/pack-celestial-stag-atlas.py` and
`scripts/assemble-celestial-stag-motion.py`.
The Home sequence lasts 20 seconds before the Stag lies down to sleep. It runs,
walks to its takeoff point, takes off and flaps, glides, lands, walks briefly,
runs before settling at its sleep position. A separate 16-frame whole-body
atlas eases from standing into its curled sleeping pose, with every pose
aligned to a shared hoof baseline. At the same time, a 16-frame background
atlas grows a meadow, flowers, and an ancient tree behind it; the empty opening
frame lets the scene sprout in sync with the lie-down. The pose then holds with
a gentle breathing loop. Walking reuses the folded-wing
full-body ground atlas at a slower cadence. A tap wakes it and starts the
sequence again; its next sleeping location is sampled anywhere along the bar.
The garden atlas is packed with `scripts/pack-home-sleep-garden-atlas.py`.

Waking the Stag leaves a separate scene at the previous sleeping coordinate.
`home_sleep_garden_decay.png` plays16 complete scene frames from green leaves
through yellow/brown foliage to gray ash and drifting dust over4.8 seconds.
Its opening frame is an exact copy of the mature growth frame; root anchors
and scale stay fixed. Scene frames blend on the UI thread and the remaining
dust fades out before the old scene is removed. Early wake-ups retain the
current partial growth frame and dissolve into a smaller dust puff instead of
introducing a mature tree. Packing is reproducible with
`scripts/pack-home-sleep-garden-decay-atlas.py`.

Each pet's `rest_<id>.png` is a separate, on-demand 4×4 atlas. Sleep runs the
16 frames in order over1.6 seconds; waking reverses the same frames over1.45
seconds. The final rest frame is held with a subtle breathing scale. Motion is
sampled on the UI thread; full-body silhouettes are switched without
cross-fading to avoid doubled tails, paws, wings, or tentacles. Atlases are
packed from imagegen sheets with the same connected-silhouette packer used for
the Stag, then quantized to an indexed PNG palette with alpha. Rest prompts and
source references are listed under `restVariants` in `provenance.json`.
The15 rest atlases total about3.9MB bundled; one decoded sheet is roughly4MiB
RGBA. Only the active atlas is mounted by the component, though the platform
image cache may briefly retain both activity and rest sheets during a swap.

Every available pet, plus the admin-only Celestial Stag, has a dedicated 4×4
Home drag atlas. The Alicorn and Stag keep their reviewed transition atlases.
The remaining atlases are built deterministically by
`scripts/build-pet-drag-atlases.cjs` from each species' own 4×4 activity atlas.
The script reuses the source palette and alpha channel and applies nearest-pixel
pose transforms for lift, falling, impact, and recovery. It does not call image
generation or add new artwork. Atlas frame blends and eased UI-thread poses run
at display refresh; only the active pet atlas is mounted.

All15 user pets now have a dedicated `home_<species>.png` full-body atlas for
Home and motion previews on the Pet screen. Each 4×4 atlas has four authored
rows: calm idle, anatomy-specific travel, playful movement, and a signature
action. The fox's sheet provides its own
walk, scamper, gentle hop/turn, soft landing, and a small tail-fire flourish.
Its Home controller keeps the random edge-to-edge route, lowers the jump and
uses a light playful turn; the existing fox rest atlas still supplies sleep,
breathing, and wake-up poses. The other pets' movement cycles are paced by their
shape in `homePetMotion.ts` (for example, the tortoise is slower than the tiger,
and serpentine pets undulate instead of stepping). Home reuses its existing drag
atlases while the pet is being dragged and mounts only the currently displayed
Home atlas. The 15 Home sheets were generated with the built-in imagegen tool
from each species' existing art, then packed to the runtime 1024×1024 indexed
PNG format; prompt summaries and species actions are in `provenance.json` under
`homeVariants`. The admin-only Celestial Stag keeps its separate Home atlases.

Two Home sleep-scene atlases are available as separate 4×4 landscape sheets:
`home_sleep_nine_tail_fox.png` and `home_sleep_garuda.png`. The Fox's 16 frames
are loaded on Home behind its full-body sleep pose and grow over 2.4 seconds;
the 240px scene is centered on the ground baseline, with the torii gate placed
in the left fifth of each frame. The cherry tree has dense secondary branches
and a fuller layered blossom canopy. The fox remains in its existing position
as it sleeps and wakes. On wake, a separate 16-frame scene remains at the old sleep
spot: blossoms wither, the torii collapses, and the garden dissolves into dust
over 4.8 seconds while the Fox leaves. Growth/decay pauses with Home and resumes
from the same frame on return. Garuda's separate cloud sprites fly inward from
both Home screen edges for 1.5 seconds. The 4×4
`home_sleep_garuda_platform.png` atlas then assembles a compact circular dais
from stone blocks over 1.4 seconds. Finally, the 4×4
`home_sleep_garuda_reveal_v2.png` atlas reveals the mountains and a smaller
temple rising from the center over 4.5 seconds. The dais stays above the scene
bottom beneath Garuda. Generated sources are under `sources/`, and
`scripts/pack-home-sleep-scene-atlas.py` reproducibly removes the flat source
matte and packs frames with a shared scale, ground baseline, and transparent
gutters. Generation and packing details are in `provenance.json` under
`homeSleepScenePilots`.

Lang Linh uses the illustrated 4×4 `home_sleep_rune_wolf_v7.png` atlas.
Its 16 raster frames reuse painted plant, bark and ground growth frames from
`home_sleep_garden.png`, with a warm late-afternoon sky and low sun, spreading moss light and an emerging rune stone.
`scripts/generate-rune-wolf-sleep-atlas.py` uses Pillow/numpy to compose the
1280×1280 transparent PNG reproducibly. The script also writes a contact sheet
and a sleeping-wolf composition under `tasks/previews/` for visual review.
The app uses this atlas on Home and in sleep previews. No new AI generation or
runtime SVG is used for this scene.

The current Wolf composition uses a sheltered tree on the left, an open upper
sky, a warm sun to the right, low painted rune stones and an organically
feathered backdrop. Cropped foreground fronds blend into the clearing.

Lang Linh wake sequence: `home_wake_rune_wolf.png` is a separate 8×4 atlas
with 32 frames at 320px per cell, played once over eight seconds. It starts
at the mature afternoon sleep frame, shifts through night and back to day,
uses the existing illustrated Stag decay frames for leaves and bark ageing,
then dries the clearing to dunes and scatters it as raster sand particles.
`scripts/generate-rune-wolf-wake-atlas.py` builds it locally from bundled art.
The old landscape stays at the sleep position while the pet leaves, pauses
when Home is inactive and is removed when playback completes. No API call.
