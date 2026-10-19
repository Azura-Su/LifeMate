import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { lazy, Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { MainTabParams } from '../../navigation/types';
import { colors } from '../../theme';
import { styles } from './CardGamesScreen.styles';

const OnlineGame = lazy(() =>
  import('./CardGamesScreen').then((module) => ({
    default: module.CardGamesScreen,
  })),
);

// Firebase/Realtime modules initialize only when this route is opened.
export function CardGamesRoute(
  props: BottomTabScreenProps<MainTabParams, 'CardGames'>,
) {
  return (
    <Suspense
      fallback={
        <View style={styles.loader}>
          <ActivityIndicator
            accessibilityLabel="Đang mở trò chơi"
            color={colors.earth}
          />
        </View>
      }
    >
      <OnlineGame {...props} />
    </Suspense>
  );
}
