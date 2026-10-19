import { audioCloudApiKey, audioCloudUrl } from './audioCloud';

export function cardGamesEnabled() {
  return (
    process.env.EXPO_PUBLIC_CARD_GAMES_ENABLED === 'true' &&
    !!audioCloudUrl() &&
    !!audioCloudApiKey()
  );
}
