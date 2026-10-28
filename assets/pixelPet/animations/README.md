# Pet animation atlases

15 bundled PNGs ×16 poses =240 frame slots. Each atlas is1024×1024 with4×4
cells of256px: idle/blink, locomotion, happy, skill (one row each). Rest/recovery
poses may intentionally look similar. Runtime mappings live in pixelPetFrames.ts.

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
Locomotion uses four poses at10fps on the UI thread. Inactive/reduced-motion
views show the neutral frame; loading/errors show the original art/pixel rig.
