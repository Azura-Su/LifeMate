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
    azure_dragon: require('../../../assets/pixelPet/azure_dragon.png'),
    koi_dragon: require('../../../assets/pixelPet/koi_dragon.png'),
    scylla: require('../../../assets/pixelPet/scylla.png'),
    lac_bird: require('../../../assets/pixelPet/lac_bird.png'),
    phoenix: require('../../../assets/pixelPet/phoenix.png'),
    anubis: require('../../../assets/pixelPet/anubis.png'),
    garuda: require('../../../assets/pixelPet/garuda.png'),
    celestial_stag: require('../../../assets/pixelPet/celestial_stag.png'),
  };

/** Layer cut-outs for the hand-rigged Celestial Stag puppet (no atlas). */
export const STAG_LAYERS: Record<
  'body' | 'wingL' | 'wingR' | 'tail' | 'head',
  ImageSourcePropType
> = {
  body: require('../../../assets/pixelPet/celestial_stag/body.png'),
  wingL: require('../../../assets/pixelPet/celestial_stag/wing_l.png'),
  wingR: require('../../../assets/pixelPet/celestial_stag/wing_r.png'),
  tail: require('../../../assets/pixelPet/celestial_stag/tail.png'),
  head: require('../../../assets/pixelPet/celestial_stag/head.png'),
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
