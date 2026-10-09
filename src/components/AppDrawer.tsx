import Feather from '@expo/vector-icons/Feather';
import { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import appConfig from '../../app.json';
import { BrandAvatar } from './BrandAvatar';
import { Button } from './Button';
import type { useFinancePrivacy } from '../hooks/useFinancePrivacy';
import { FinanceLockSetting } from '../screens/Settings/FinanceLockSetting';
import { useSettingsScreen } from '../screens/Settings/useSettingsScreen';
import { colors, typography } from '../theme';
import { styles } from './AppDrawer.styles';

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenNotes: () => void;
  privacy: ReturnType<typeof useFinancePrivacy>;
};

export function AppDrawer({ visible, onClose, onOpenNotes, privacy }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelWidth = Math.min(width * 0.88, 360);
  const translateX = useRef(new Animated.Value(panelWidth)).current;
  const afterClose = useRef<(() => void) | null>(null);
  const closing = useRef(false);
  const model = useSettingsScreen();
  const pushReady = model.permission === 'granted' && !!model.token;
  const notificationDescription = pushReady
    ? 'Đang bật trên thiết bị này.'
    : model.permission === 'denied'
      ? 'Đang tắt. Mở cài đặt để bật.'
      : 'Bật để nhận cập nhật từ LifeMate.';

  useEffect(() => {
    if (!visible) return;
    translateX.setValue(panelWidth);
    Animated.timing(translateX, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [panelWidth, translateX, visible]);

  const close = useCallback(
    (after?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      afterClose.current = after ?? null;
      Animated.timing(translateX, {
        toValue: panelWidth,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          closing.current = false;
          afterClose.current = null;
          return;
        }
        onClose();
        afterClose.current?.();
        afterClose.current = null;
        closing.current = false;
      });
    },
    [onClose, panelWidth, translateX],
  );

  const pushTitle = model.permission === 'denied' ? 'Mở cài đặt' : 'Bật';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => close()}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng menu bằng cách chạm bên ngoài"
          onPress={() => close()}
          style={styles.backdrop}
        />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.panel,
            { width: panelWidth, transform: [{ translateX }] },
          ]}
        >
          <View
            testID="drawer-safe-area-content"
            style={[
              styles.safeArea,
              { paddingTop: insets.top, paddingBottom: insets.bottom },
            ]}
          >
            <View style={styles.header}>
              <Text accessibilityRole="header" style={typography.heading}>
                Menu
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng menu"
                onPress={() => close()}
                style={styles.closeButton}
              >
                <Feather name="x" size={22} color={colors.ink} />
              </Pressable>
            </View>

            <ScrollView
              testID="drawer-settings-scroll"
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.profile}>
                <BrandAvatar size={36} />
                <View style={styles.profileText}>
                  <Text numberOfLines={1} style={styles.name}>
                    {model.name}
                  </Text>
                  <Text numberOfLines={1} selectable style={typography.small}>
                    {model.user?.email}
                  </Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ghi chú"
                onPress={() => close(onOpenNotes)}
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.iconBadge, styles.notesIcon]}>
                  <Feather name="edit-3" size={18} color={colors.earth} />
                </View>
                <Text style={styles.actionTitle}>Ghi chú</Text>
                <View style={styles.actionSpacer} />
                <Feather name="chevron-right" size={20} color={colors.muted} />
              </Pressable>

              <View style={styles.card}>
                <View style={styles.settingRow}>
                  <View style={[styles.iconBadge, styles.notificationIcon]}>
                    <Feather name="bell" size={18} color={colors.sky} />
                  </View>
                  <View style={styles.settingText}>
                    <Text style={styles.actionTitle}>Bật thông báo</Text>
                    <Text numberOfLines={2} style={typography.small}>
                      {notificationDescription}
                    </Text>
                  </View>
                  {!pushReady && (
                    <Button
                      compact
                      title={pushTitle}
                      onPress={model.enablePush}
                      loading={model.busy === 'push'}
                      disabled={model.busy === 'logout'}
                      variant="secondary"
                    />
                  )}
                </View>
                {model.pushError && (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {model.pushError}
                  </Text>
                )}
                {__DEV__ && model.token && (
                  <Button
                    compact
                    title={
                      model.copied
                        ? 'Đã sao chép FCM token'
                        : 'Sao chép FCM token để kiểm thử'
                    }
                    onPress={model.copyToken}
                    variant="secondary"
                  />
                )}
              </View>

              <FinanceLockSetting
                privacy={privacy}
                disabled={model.busy !== null}
                compact
              />
            </ScrollView>

            <View testID="drawer-bottom-actions" style={styles.bottomDock}>
              {model.error && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {model.error}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đăng xuất"
                accessibilityState={{ busy: model.busy === 'logout' }}
                disabled={
                  model.busy === 'push' ||
                  privacy.authenticating ||
                  privacy.changing
                }
                onPress={model.signOut}
                style={({ pressed }) => [
                  styles.logout,
                  pressed && styles.pressed,
                ]}
              >
                {model.busy === 'logout' ? (
                  <ActivityIndicator color={colors.danger} />
                ) : (
                  <Feather name="log-out" size={19} color={colors.danger} />
                )}
                <Text style={styles.logoutText}>Đăng xuất</Text>
              </Pressable>

              <View style={styles.footer}>
                <Text style={typography.small}>
                  LifeMate · {appConfig.expo.version}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
