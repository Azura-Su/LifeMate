import {
  Component,
  lazy,
  Suspense,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { colors, typography } from '../../theme';

// Keep native GL out of application startup and all non-pet utility routes.
const Viewport = lazy(() =>
  import('./PetViewport').then((module) => ({ default: module.PetViewport })),
);
class StageBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <View>
        <Text accessibilityRole="alert" style={typography.small}>
          Chưa mở được hình thú cưng. Hãy thử lại.
        </Text>
      </View>
    ) : (
      this.props.children
    );
  }
}
export function PetStage(
  props: ComponentProps<typeof import('./PetViewport').PetViewport>,
) {
  return (
    <StageBoundary key={props.dna.seed}>
      <Suspense
        fallback={
          <ActivityIndicator
            accessibilityLabel="Đang tải hình thú cưng"
            color={colors.earth}
          />
        }
      >
        <Viewport {...props} />
      </Suspense>
    </StageBoundary>
  );
}
