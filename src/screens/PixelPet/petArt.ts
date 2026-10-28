import type { ImageSourcePropType } from 'react-native';
import type { PixelPetSpeciesId } from '../../types/pixelPet';

/**
 * Illustrated art cut from the user's reference images (background removed,
 * cropped to a 384px square). Species without art fall back to the pixel rig.
 */
export const PET_ART: Partial<Record<PixelPetSpeciesId, ImageSourcePropType>> = {
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
};
