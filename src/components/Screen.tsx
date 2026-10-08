import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

type Props = PropsWithChildren<{
  refreshControl?: ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  fixedHeader?: ReactNode;
  fixedHeaderStyle?: StyleProp<ViewStyle>;
  fixedContent?: ReactNode;
  fixedContentStyle?: StyleProp<ViewStyle>;
}>;

export function Screen({
  children,
  refreshControl,
  contentStyle,
  fixedHeader,
  fixedHeaderStyle,
  fixedContent,
  fixedContentStyle,
}: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {fixedHeader != null && (
        <View
          testID="screen-fixed-header"
          style={[styles.fixedHeader, fixedHeaderStyle]}
        >
          {fixedHeader}
        </View>
      )}
      {fixedContent != null && (
        <View
          testID="screen-fixed-content"
          style={[styles.fixedContent, fixedContentStyle]}
        >
          {fixedContent}
        </View>
      )}
      <ScrollView
        testID="screen-scroll-area"
        style={styles.scroll}
        contentContainerStyle={[
          fixedContent != null ? styles.belowFixedContent : styles.content,
          fixedHeader != null &&
            fixedContent == null &&
            styles.afterFixedHeader,
          contentStyle,
        ]}
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
  scroll: { flex: 1 },
  fixedHeader: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.background,
  },
  fixedContent: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  afterFixedHeader: { paddingTop: 12 },
  belowFixedContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
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
