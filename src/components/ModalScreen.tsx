import {
  useContext,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { colors } from '../theme';

type Props = PropsWithChildren<{
  onRequestClose: () => void;
  refreshControl?: ReactElement<RefreshControlProps>;
  fixedHeader?: ReactNode;
  fixedFooter?: ReactNode;
  onTouchStart?: () => void;
}>;

// A full-screen Modal is a separate native root on iOS, so SafeAreaView inside
// it can report zero insets and the header slides under the status bar. Read
// the insets from the parent tree (outside the Modal) and pad explicitly.
export function ModalScreen({
  children,
  onRequestClose,
  refreshControl,
  fixedHeader,
  fixedFooter,
  onTouchStart,
}: Props) {
  const insets = useContext(SafeAreaInsetsContext);
  const top = Math.max(insets?.top ?? 0, 20) + 16;
  const bottom = (insets?.bottom ?? 0) + 32;
  return (
    <Modal visible animationType="slide" onRequestClose={onRequestClose}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          testID="modal-screen-root"
          onTouchStart={onTouchStart}
          style={[styles.layout, { paddingTop: top }]}
        >
          {fixedHeader && (
            <View testID="modal-screen-fixed-header" style={styles.fixedHeader}>
              <View style={styles.fixedContent}>{fixedHeader}</View>
            </View>
          )}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: fixedFooter ? 16 : bottom },
            ]}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
          {fixedFooter && (
            <View
              style={[
                styles.fixedFooter,
                { paddingBottom: Math.max(insets?.bottom ?? 0, 12) },
              ]}
            >
              <View style={styles.fixedContent}>{fixedFooter}</View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  layout: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  fixedContent: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  fixedHeader: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.background,
    zIndex: 1,
  },
  fixedFooter: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 24,
  },
});
