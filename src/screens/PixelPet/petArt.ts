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

/** Whole-body 64-frame atlas for the admin-only Celestial Stag. */
export const CELESTIAL_STAG_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag.png');
/** Separate whole-body gait loops used while the admin's Stag roams Home. */
export const CELESTIAL_STAG_GROUND_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_ground_v2.png');
export const CELESTIAL_STAG_FLIGHT_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_flight_v2.png');
/** Full-body pose tracks that bridge the ground and flight atlases. */
export const CELESTIAL_STAG_TAKEOFF_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_takeoff_v2.png');
export const CELESTIAL_STAG_LANDING_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_landing_v2.png');
/** Whole-body transition into the sleeping pose used on Home. */
export const CELESTIAL_STAG_SLEEP_ATLAS = require('../../../assets/pixelPet/animations/celestial_stag_sleep_transition.png');
/** Background-only growth atlas mounted while the admin Stag falls asleep. */
export const CELESTIAL_STAG_SLEEP_GARDEN_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden.png');
/** One-shot leaf yellowing, withering and ash-dust scene after waking. */
export const CELESTIAL_STAG_SLEEP_GARDEN_DECAY_ATLAS = require('../../../assets/pixelPet/animations/home_sleep_garden_decay.png');
