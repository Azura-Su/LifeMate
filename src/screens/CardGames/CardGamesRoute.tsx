import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParams } from '../../navigation/types';
import { CardGamesScreen } from './CardGamesScreen';

// Render the route directly so opening the online tab does not show a lazy-load
// spinner. Network setup remains deferred until the user creates or joins a room.
export function CardGamesRoute(
  props: BottomTabScreenProps<MainTabParams, 'CardGames'>,
) {
  return <CardGamesScreen {...props} />;
}
