import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotificationStore } from '../store/notificationStore';
import { colors, typography } from '../theme';

export function NotificationBanner() {
  const message = useNotificationStore((state) => state.lastMessage);
  const insets = useSafeAreaInsets();
  if (!message) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.banner, { top: insets.top + 8 }]}
    >
      <Feather name="bell" size={22} color={colors.green} />
      <View style={styles.content}>
        <Text style={typography.heading}>{message.title}</Text>
        <Text style={typography.small}>{message.body}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Đóng thông báo"
        style={styles.close}
        onPress={() => useNotificationStore.setState({ lastMessage: null })}
      >
        <Feather name="x" size={22} color={colors.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    maxWidth: 600,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 8,
    boxShadow: '0 4px 20px #00000018',
  },
  content: { flex: 1 },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
