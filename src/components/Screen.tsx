import type { PropsWithChildren, ReactElement } from 'react';
import { ScrollView, StyleSheet, type RefreshControlProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

type Props = PropsWithChildren<{
  refreshControl?: ReactElement<RefreshControlProps>;
}>;

export function Screen({ children, refreshControl }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    padding: 24,
    gap: 24,
    paddingBottom: 32,
  },
});
