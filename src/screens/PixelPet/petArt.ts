import type { ImageSourcePropType } from 'react-native';
import type { PixelPetSpeciesId } from '../../types/pixelPet';

/**
 * Illustrated art cut from the user's reference images (background removed,
 * cropped to a 384px square). Species without art fall back to the pixel rig.
 */
export const PET_ART: Partial<Record<PixelPetSpeciesId, ImageSourcePropType>> =
  {
    nine_tail_fox: require('../../../assets/pixelPet/nine_tail_fox.png'),
    qilin: require('../../../assets/pixelPet/qilin.png'),
    alicorn: require('../../../assets/pixelPet/alicorn.png'),
    rune_wolf: require('../../../assets/pixelPet/rune_wolf.png'),
    black_tortoise: require('../../../assets/pixelPet/black_tortoise.png'),
    sphinx: require('../../../assets/pixelPet/sphinx.png'),
    centaur: require('../../../assets/pixelPet/centaur.png'),
    white_tiger: require('../../../assets/pixelPet/white_tiger.png'),
    azure_dragon: require('../../../assets/pixelPet/azure_dragon.png'),
    koi_dragon: require('../../../assets/pixelPet/koi_dragon.png'),
    scylla: require('../../../assets/pixelPet/scylla.png'),
    lac_bird: require('../../../assets/pixelPet/lac_bird.png'),
    phoenix: require('../../../assets/pixelPet/phoenix.png'),
    anubis: require('../../../assets/pixelPet/anubis.png'),
    garuda: require('../../../assets/pixelPet/garuda.png'),
    celestial_stag: require('../../../assets/pixelPet/celestial_stag.png'),
  };

/** Only the currently displayed atlas is mounted/decoded; no global preload. */
export const PET_ATLASES: Record<
  Exclude<PixelPetSpeciesId, 'celestial_stag'>,
  ImageSourcePropType
> = {
  nine_tail_fox: require('../../../assets/pixelPet/animations/nine_tail_fox.png'),
  qilin: require('../../../assets/pixelPet/animations/qilin.png'),
  alicorn: require('../../../assets/pixelPet/animations/alicorn.png'),
  rune_wolf: require('../../../assets/pixelPet/animations/rune_wolf.png'),
  black_tortoise: require('../../../assets/pixelPet/animations/black_tortoise.png'),
  sphinx: require('../../../assets/pixelPet/animations/sphinx.png'),
  centaur: require('../../../assets/pixelPet/animations/centaur.png'),
  white_tiger: require('../../../assets/pixelPet/animations/white_tiger.png'),
  azure_dragon: require('../../../assets/pixelPet/animations/azure_dragon.png'),
  koi_dragon: require('../../../assets/pixelPet/animations/koi_dragon.png'),
  scylla: require('../../../assets/pixelPet/animations/scylla.png'),
  lac_bird: require('../../../assets/pixelPet/animations/lac_bird.png'),
  phoenix: require('../../../assets/pixelPet/animations/phoenix.png'),
  anubis: require('../../../assets/pixelPet/animations/anubis.png'),
  garuda: require('../../../assets/pixelPet/animations/garuda.png'),
};

/** Species-specific full-body transition atlases used only while resting. */
export const PET_REST_ATLASES: Record<
  Exclude<PixelPetSpeciesId, 'celestial_stag'>,
  ImageSourcePropType
> = {
  nine_tail_fox: require('../../../assets/pixelPet/animations/rest_nine_tail_fox.png'),
  qilin: require('../../../assets/pixelPet/animations/rest_qilin.png'),
  alicorn: require('../../../assets/pixelPet/animations/rest_alicorn.png'),
  rune_wolf: require('../../../assets/pixelPet/animations/rest_rune_wolf.png'),
  black_tortoise: require('../../../assets/pixelPet/animations/rest_black_tortoise.png'),
  sphinx: require('../../../assets/pixelPet/animations/rest_sphinx.png'),
  centaur: require('../../../assets/pixelPet/animations/rest_centaur.png'),
  white_tiger: require('../../../assets/pixelPet/animations/rest_white_tiger.png'),
  azure_dragon: require('../../../assets/pixelPet/animations/rest_azure_dragon.png'),
  koi_dragon: require('../../../assets/pixelPet/animations/rest_koi_dragon.png'),
  scylla: require('../../../assets/pixelPet/animations/rest_scylla.png'),
  lac_bird: require('../../../assets/pixelPet/animations/rest_lac_bird.png'),
  phoenix: require('../../../assets/pixelPet/animations/rest_phoenix.png'),
  anubis: require('../../../assets/pixelPet/animations/rest_anubis.png'),
  garuda: require('../../../assets/pixelPet/animations/rest_garuda.png'),
};

/** Drag sheets are enabled only after their raw art has been reviewed and packed. */
export const PET_DRAG_ATLASES: Partial<
  Record<PixelPetSpeciesId, ImageSourcePropType>
> = {
  nine_tail_fox: require('../../../assets/pixelPet/animations/drag_nine_tail_fox.png'),
  qilin: require('../../../assets/pixelPet/animations/drag_qilin.png'),
  alicorn: require('../../../assets/pixelPet/animations/drag_alicorn.png'),
  rune_wolf: require('../../../assets/pixelPet/animations/drag_rune_wolf.png'),
  black_tortoise: require('../../../assets/pixelPet/animations/drag_black_tortoise.png'),
  sphinx: require('../../../assets/pixelPet/animations/drag_sphinx.png'),
  centaur: require('../../../assets/pixelPet/animations/drag_centaur.png'),
  white_tiger: require('../../../assets/pixelPet/animations/drag_white_tiger.png'),
  azure_dragon: require('../../../assets/pixelPet/animations/drag_azure_dragon.png'),
  koi_dragon: require('../../../assets/pixelPet/animations/drag_koi_dragon.png'),
  scylla: require('../../../assets/pixelPet/animations/drag_scylla.png'),
  lac_bird: require('../../../assets/pixelPet/animations/drag_lac_bird.png'),
  phoenix: require('../../../assets/pixelPet/animations/drag_phoenix.png'),
  anubis: require('../../../assets/pixelPet/animations/drag_anubis.png'),
  garuda: require('../../../assets/pixelPet/animations/drag_garuda.png'),
  celestial_stag: require('../../../assets/pixelPet/animations/drag_celestial_stag.png'),
};
/** Full-body walk/run/jump/turn/landing poses used by the Home fox sequence. */
export const NINE_TAIL_FOX_HOME_ATLAS = require('../../../assets/pixelPet/animations/home_nine_tail_fox.png');

/** Full-body, species-authored motion atlases used by Home roaming pets. */
export const PET_HOME_ATLASES: Record<
  Exclude<PixelPetSpeciesId, 'celestial_stag'>,
  ImageSourcePropType
> = {
  nine_tail_fox: NINE_TAIL_FOX_HOME_ATLAS,
  qilin: require('../../../assets/pixelPet/animations/home_qilin.png'),
  alicorn: require('../../../assets/pixelPet/animations/home_alicorn.png'),
  rune_wolf: require('../../../assets/pixelPet/animations/home_rune_wolf.png'),
  black_tortoise: require('../../../assets/pixelPet/animations/home_black_tortoise.png'),
  sphinx: require('../../../assets/pixelPet/animations/home_sphinx.png'),
  centaur: require('../../../assets/pixelPet/animations/home_centaur.png'),
  white_tiger: require('../../../assets/pixelPet/animations/home_white_tiger.png'),
  azure_dragon: require('../../../assets/pixelPet/animations/home_azure_dragon.png'),
  koi_dragon: require('../../../assets/pixelPet/animations/home_koi_dragon.png'),
  scylla: require('../../../assets/pixelPet/animations/home_scylla.png'),
  lac_bird: require('../../../assets/pixelPet/animations/home_lac_bird.png'),
  phoenix: require('../../../assets/pixelPet/animations/home_phoenix.png'),
  anubis: require('../../../assets/pixelPet/animations/home_anubis.png'),
  garuda: require('../../../assets/pixelPet/animations/home_garuda.png'),
};

/** Expanded full-body gait sheets; other clips keep the species Home atlas. */
export const PET_HOME_MOVE_ATLASES: Partial<
  Record<PixelPetSpeciesId, ImageSourcePropType>
> = {
  qilin: require('../../../assets/pixelPet/animations/home_qilin_move.png'),
};

export const PET_DRAG_ATLAS_READY: Record<PixelPetSpeciesId, boolean> = {
  nine_tail_fox: true,
  qilin: true,
  alicorn: true,
  rune_wolf: true,
  black_tortoise: true,
  sphinx: true,
  centaur: true,
  white_tiger: true,
  azure_dragon: true,
  koi_dragon: true,
  scylla: true,
  lac_bird: true,
  phoenix: true,
  anubis: true,
  garuda: true,
  celestial_stag: true,
};

/** Whole-body 64-frame atlas for the admin-only Celestial Stag. */
export const CELESTIAL_STAG_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag.png');
/** Separate whole-body gait loops used while the admin's Stag roams Home. */
export const CELESTIAL_STAG_GROUND_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_ground_v3.png');
export const CELESTIAL_STAG_FLIGHT_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_flight_v2.png');
/** Full-body pose tracks that bridge the ground and flight atlases. */
export const CELESTIAL_STAG_TAKEOFF_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_takeoff_v2.png');
export const CELESTIAL_STAG_LANDING_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_landing_v2.png');
/** Whole-body transition into the sleeping pose used on Home. */
export const CELESTIAL_STAG_SLEEP_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_sleep_transition.png');
/** Home walk/run/hop/sleep atlas for the Celestial Stag's first two levels. */
export const CELESTIAL_STAG_LV12_WALK_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv12_walk.png');
export const CELESTIAL_STAG_LV12_RUN_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv12_run.png');
export const CELESTIAL_STAG_LV12_HOP_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv12_hop.png');
export const CELESTIAL_STAG_LV12_SLEEP_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv12_sleep.png');
/** Level 3–4 authored full-body motion atlases, selected by pet level. */
export const CELESTIAL_STAG_LV34_WALK_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv34_walk.png');
export const CELESTIAL_STAG_LV34_RUN_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv34_run.png');
export const CELESTIAL_STAG_LV34_FLIGHT_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv34_flight.png');
export const CELESTIAL_STAG_LV34_SLEEP_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv34_sleep.png');
/** Adult Celestial Stag home motion, shared by levels seven and eight. */
export const CELESTIAL_STAG_LV78_WALK_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv78_walk.png');
export const CELESTIAL_STAG_LV78_RUN_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv78_run.png');
export const CELESTIAL_STAG_LV78_FLIGHT_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv78_flight.png');
export const CELESTIAL_STAG_LV78_SLEEP_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv78_sleep.png');
/** Level 9–10 reviewed walk/run and sleep transition/loop atlases. */
export const CELESTIAL_STAG_LV910_WALK_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv910_walk.png');
export const CELESTIAL_STAG_LV910_RUN_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv910_run.png');
export const CELESTIAL_STAG_LV910_FLIGHT_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv910_flight.png');
export const CELESTIAL_STAG_LV910_SLEEP_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv910_sleep.png');
/** Level 13–14 authored walk loop (also the run pace); flight/sleep below. */
export const CELESTIAL_STAG_LV1314_WALK_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1314_walk.png');
export const CELESTIAL_STAG_LV1314_FLIGHT_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1314_flight.png');
export const CELESTIAL_STAG_LV1314_SLEEP_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1314_sleep.png');
/** Complete level 15–16 Home motion atlases. */
export const CELESTIAL_STAG_LV1516_WALK_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1516_walk.png');
export const CELESTIAL_STAG_LV1516_RUN_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1516_run.png');
export const CELESTIAL_STAG_LV1516_FLIGHT_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1516_flight.png');
export const CELESTIAL_STAG_LV1516_SLEEP_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1516_sleep.png');
/** Level 17–18 authored walk/run/sleep atlases. */
export const CELESTIAL_STAG_LV1718_WALK_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1718_walk.png');
export const CELESTIAL_STAG_LV1718_RUN_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1718_run.png');
export const CELESTIAL_STAG_LV1718_SLEEP_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1718_sleep.png');
/** Lv17–18 flight (frames 1–13; off-model landing frames 14–16 are skipped). */
export const CELESTIAL_STAG_LV1718_FLIGHT_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1718_flight.png');
/** Lv5–6 and Lv11–12 complete sets, packed by scripts/pack-celestial-stag-level.py. */
export const CELESTIAL_STAG_LV56_WALK_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv56_walk.png');
export const CELESTIAL_STAG_LV56_RUN_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv56_run.png');
export const CELESTIAL_STAG_LV56_FLIGHT_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv56_flight.png');
export const CELESTIAL_STAG_LV56_SLEEP_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv56_sleep.png');
export const CELESTIAL_STAG_LV1112_WALK_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1112_walk.png');
export const CELESTIAL_STAG_LV1112_RUN_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1112_run.png');
export const CELESTIAL_STAG_LV1112_FLIGHT_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1112_flight.png');
export const CELESTIAL_STAG_LV1112_SLEEP_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1112_sleep.png');
/** Completed Lv19–20 ground, flight, and sleep motion atlases. */
export const CELESTIAL_STAG_LV1920_WALK_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1920_walk.png');
export const CELESTIAL_STAG_LV1920_RUN_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1920_run.png');
export const CELESTIAL_STAG_LV1920_FLIGHT_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1920_flight.png');
export const CELESTIAL_STAG_LV1920_SLEEP_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_lv1920_sleep.png');
/** Background-only growth atlas mounted while the admin Stag falls asleep. */
export const CELESTIAL_STAG_SLEEP_GARDEN_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden.png');
/** One-shot leaf yellowing, withering and ash-dust scene after waking. */
export const CELESTIAL_STAG_SLEEP_GARDEN_DECAY_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_decay.png');
/** Levels 4–10 sleep garden scene atlases. */
export const CELESTIAL_STAG_SLEEP_GARDEN_LV04_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv04.png');
export const CELESTIAL_STAG_SLEEP_GARDEN_LV04_DECAY_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv04_decay.png');
export const CELESTIAL_STAG_SLEEP_GARDEN_LV06_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv06.png');
export const CELESTIAL_STAG_SLEEP_GARDEN_LV06_DECAY_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv06_decay.png');
export const CELESTIAL_STAG_SLEEP_GARDEN_LV08_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv08_v2.png');
export const CELESTIAL_STAG_SLEEP_GARDEN_LV08_DECAY_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv08_decay_v2.png');
export const CELESTIAL_STAG_SLEEP_GARDEN_LV10_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv10.png');
export const CELESTIAL_STAG_SLEEP_GARDEN_LV10_DECAY_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv10_decay.png');
/** Lv12 feather forest growth and decay scene atlases. */
export const CELESTIAL_STAG_SLEEP_GARDEN_LV12_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv12.png');
export const CELESTIAL_STAG_SLEEP_GARDEN_LV12_DECAY_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv12_decay.png');
/** Lv14 Golden Sanctuary growth and decay scene atlases. */
export const CELESTIAL_STAG_SLEEP_GARDEN_LV14_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv14.png');
export const CELESTIAL_STAG_SLEEP_GARDEN_LV14_DECAY_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv14_decay.png');
/** Lv16 Starlit Grove growth and decay scene atlases. */
export const CELESTIAL_STAG_SLEEP_GARDEN_LV16_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv16_v2.png');
export const CELESTIAL_STAG_SLEEP_GARDEN_LV16_DECAY_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv16_decay_v2.png');
/** Lv18 Sapphire Palace growth and decay scene atlases. */
export const CELESTIAL_STAG_SLEEP_GARDEN_LV18_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv18.png');
export const CELESTIAL_STAG_SLEEP_GARDEN_LV18_DECAY_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv18_decay.png');
/** Lv20 Emerald Heaven growth and decay scene atlases. */
export const CELESTIAL_STAG_SLEEP_GARDEN_LV20_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv20.png');
export const CELESTIAL_STAG_SLEEP_GARDEN_LV20_DECAY_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_lv20_decay.png');
/** Background-only Japanese shrine and cherry blossom scene for the sleeping Fox. */
export const NINE_TAIL_FOX_SLEEP_SCENE_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_nine_tail_fox.png');
/** Blossom, torii and garden collapse into dust when the Fox wakes. */
export const NINE_TAIL_FOX_SLEEP_SCENE_DECAY_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_nine_tail_fox_decay.png');
/** Background-only mountain, cloud and shrine scene for sleeping Garuda. */
/** Clouds converge and the shrine rises through 16 frames during Garuda's sleep scene. */
export const GARUDA_HOME_SLEEP_REVEAL_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garuda_reveal_v2.png');
/** Cloud banks that fly inward from the Home screen edges before the dais builds. */
export const GARUDA_HOME_SLEEP_CLOUD_LEFT = require('../../../assets/pixelPet/animations/home_sleep_garuda_cloud_left.png');
export const GARUDA_HOME_SLEEP_CLOUD_RIGHT = require('../../../assets/pixelPet/animations/home_sleep_garuda_cloud_right.png');
/** Stone blocks assemble into the Garuda sleep platform over 16 frames. */
export const GARUDA_SLEEP_PLATFORM_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garuda_platform.png');
/** Composited 16-frame illustrated late-afternoon moss and rune background for Lang Linh. */
export const RUNE_WOLF_SLEEP_SCENE_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_rune_wolf_v7.png');
/** Night/day ageing, desertification and wind dispersal after the Wolf wakes. */
export const RUNE_WOLF_WAKE_SCENE_ATLAS = require('../../../assets/pixelPet/animations/home_wake_rune_wolf.png');
