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
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import appConfig from '../../app.json';
import { UserAvatar } from './UserAvatar';
import { Button } from './Button';
import type { useFinancePrivacy } from '../hooks/useFinancePrivacy';
import { FinanceLockSetting } from '../screens/Settings/FinanceLockSetting';
import { useSettingsScreen } from '../screens/Settings/useSettingsScreen';
import { colors, typography } from '../theme';
import { styles } from './AppDrawer.styles';
import { isUserAdmin } from '../config/userAdmin';

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenNotes: () => void;
  onOpenCardScore: () => void;
  onOpenChecklists: () => void;
  onOpenAgenda?: () => void;
  onOpenUserManagement?: () => void;
  onOpenProfile?: () => void;
  privacy: ReturnType<typeof useFinancePrivacy>;
};

export function AppDrawer({
  visible,
  onClose,
  onOpenNotes,
  onOpenCardScore,
  onOpenChecklists,
  onOpenAgenda,
  onOpenUserManagement,
  onOpenProfile,
  privacy,
}: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelWidth = Math.min(width * 0.88, 360);
  const translateX = useRef(new Animated.Value(panelWidth)).current;
  const afterClose = useRef<(() => void) | null>(null);
  const closing = useRef(false);
  const model = useSettingsScreen();
  const pushReady = model.permission === 'granted' && !!model.token;
  const notificationDescription = pushReady
    ? 'Đã bật trên thiết bị'
    : model.permission === 'denied'
      ? 'Đang tắt trong thiết bị'
      : 'Chưa bật';

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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mở hồ sơ cá nhân"
                onPress={() => close(onOpenProfile)}
                style={styles.profile}
              >
                <UserAvatar size={52} />
                <View style={styles.profileText}>
                  <Text numberOfLines={1} style={styles.name}>
                    {model.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.profileEmail}>
                    {model.user?.email}
                  </Text>
                  <Text style={styles.profileLink}>Xem hồ sơ</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.muted} />
              </Pressable>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tiện ích</Text>
                <View style={styles.group}>
                  <MenuRow
                    icon="edit-3"
                    tint={colors.earth}
                    badgeStyle={styles.notesIcon}
                    label="Ghi chú"
                    onPress={() => close(onOpenNotes)}
                  />
                  {onOpenAgenda && (
                    <>
                      <View style={styles.divider} />
                      <MenuRow
                        icon="calendar"
                        tint={colors.success}
                        badgeStyle={styles.agendaIcon}
                        label="Lịch và việc"
                        onPress={() => close(onOpenAgenda)}
                      />
                    </>
                  )}
                  <View style={styles.divider} />
                  <MenuRow
                    icon="check-square"
                    tint={colors.sky}
                    badgeStyle={styles.checklistIcon}
                    label="Danh sách chuẩn bị"
                    onPress={() => close(onOpenChecklists)}
                  />
                  <View style={styles.divider} />
                  <MenuRow
                    icon="award"
                    tint={colors.sunlight}
                    badgeStyle={styles.cardScoreIcon}
                    label="Trò chơi & điểm số"
                    onPress={() => close(onOpenCardScore)}
                  />
                </View>
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cài đặt</Text>
                <View style={styles.group}>
                  <View style={styles.card}>
                    <View style={styles.settingRow}>
                      <View style={[styles.iconBadge, styles.notificationIcon]}>
                        <Feather name="bell" size={18} color={colors.sky} />
                      </View>
                      <View style={styles.settingText}>
                        <Text style={styles.actionTitle}>Thông báo</Text>
                        <Text style={styles.settingDescription}>
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

                  <View style={styles.divider} />
                  <FinanceLockSetting
                    privacy={privacy}
                    disabled={model.busy !== null}
                    compact
                  />
                </View>
              </View>
              {isUserAdmin(model.user) && onOpenUserManagement && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Quản trị</Text>
                  <View style={styles.group}>
                    <MenuRow
                      icon="users"
                      tint={colors.earth}
                      badgeStyle={styles.notesIcon}
                      label="Quản lý người dùng"
                      onPress={() => close(onOpenUserManagement)}
                    />
                  </View>
                </View>
              )}
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
                  model.busy !== null ||
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
                  <Feather name="log-out" size={18} color={colors.danger} />
                )}
                <Text style={styles.logoutText}>Đăng xuất</Text>
              </Pressable>

              <Text style={styles.footer}>
                LifeMate · {appConfig.expo.version}
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function MenuRow({
  icon,
  tint,
  badgeStyle,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  tint: string;
  badgeStyle: StyleProp<ViewStyle>;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
    >
      <View style={[styles.iconBadge, badgeStyle]}>
        <Feather name={icon} size={17} color={tint} />
      </View>
      <Text numberOfLines={1} style={styles.actionTitle}>
        {label}
      </Text>
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}
