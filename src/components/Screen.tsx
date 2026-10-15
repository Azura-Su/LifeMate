import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  type RefreshControlProps,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout } from '../theme';

type Props = PropsWithChildren<{
  scrollable?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  fixedHeader?: ReactNode;
  fixedHeaderStyle?: StyleProp<ViewStyle>;
  fixedContent?: ReactNode;
  fixedContentStyle?: StyleProp<ViewStyle>;
  overlay?: ReactNode;
  backgroundColor?: ColorValue;
  safeAreaBackgroundColor?: ColorValue;
}>;

export function Screen({
  children,
  scrollable = true,
  refreshControl,
  contentStyle,
  fixedHeader,
  fixedHeaderStyle,
  fixedContent,
  fixedContentStyle,
  overlay,
  backgroundColor,
  safeAreaBackgroundColor,
}: Props) {
  const screenColorStyle = {
    backgroundColor: backgroundColor ?? colors.background,
  };
  const safeAreaColorStyle = {
    backgroundColor:
      safeAreaBackgroundColor ??
      (fixedHeader ? colors.sunlightFaint : screenColorStyle.backgroundColor),
  };
  return (
    <SafeAreaView
      style={[styles.safe, safeAreaColorStyle]}
      edges={['top', 'left', 'right']}
    >
      {fixedHeader != null && (
        <View
          testID="screen-fixed-header"
          style={[screenColorStyle, styles.fixedHeader, fixedHeaderStyle]}
        >
          {fixedHeader}
        </View>
      )}
      {fixedContent != null && (
        <View
          testID="screen-fixed-content"
          style={[styles.fixedContent, screenColorStyle, fixedContentStyle]}
        >
          {fixedContent}
        </View>
      )}
      {scrollable ? (
        <ScrollView
          testID="screen-scroll-area"
          style={[styles.scroll, screenColorStyle]}
          contentContainerStyle={[
            fixedContent != null ? styles.belowFixedContent : styles.content,
            fixedHeader != null &&
              fixedContent == null &&
              styles.afterFixedHeader,
            contentStyle,
            screenColorStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          testID="screen-scroll-area"
          style={[styles.staticBody, screenColorStyle, contentStyle]}
        >
          {children}
        </View>
      )}
      {overlay}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  staticBody: {
    flex: 1,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  fixedHeader: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenGutter,
    paddingTop: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.sunlightFaint,
  },
  fixedContent: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenGutter,
    paddingTop: 12,
  },
  afterFixedHeader: { paddingTop: 12 },
  belowFixedContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenGutter,
    paddingTop: 8,
    paddingBottom: 24,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenGutter,
    paddingVertical: 24,
    gap: 24,
    paddingBottom: 32,
  },
});
