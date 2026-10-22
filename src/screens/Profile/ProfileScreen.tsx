import { ScreenHeader } from '../../components/ScreenHeader';
import { useState } from 'react';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import Feather from '@expo/vector-icons/Feather';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { UserAvatar } from '../../components/UserAvatar';
import { colors } from '../../theme';
import type { MainTabParams } from '../../navigation/types';
import { AvatarEditorSheet } from './AvatarEditorSheet';
import { useAuthStore } from '../../store/authStore';
import { useProfileEditor } from './useProfileEditor';
import { ProfileEmailVerification } from './ProfileEmailVerification';
export function ProfileScreen({
  navigation,
}: BottomTabScreenProps<MainTabParams, 'Profile'>) {
  const focused = useIsFocused();
  const uid = useAuthStore((state) => state.user?.uid);
  return focused ? <ProfileContent key={uid} navigation={navigation} /> : null;
}
function ProfileContent({
  navigation,
}: Pick<BottomTabScreenProps<MainTabParams, 'Profile'>, 'navigation'>) {
  const model = useProfileEditor();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [avatarVisible, setAvatarVisible] = useState(false);
  const [avatarOpening, setAvatarOpening] = useState(false);
  const insets = useSafeAreaInsets();
  const header = (
    <ScreenHeader
      title="Hồ sơ cá nhân"
      onBack={() => navigation.navigate('Home')}
    />
  );
  return (
    <Screen
      fixedHeader={header}
      contentStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, 24) },
      ]}
    >
      <View style={styles.hero}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đổi ảnh đại diện"
          accessibilityState={{
            disabled: !!model.busy || avatarOpening,
            busy:
              avatarOpening || model.busy === 'pick' || model.busy === 'crop',
          }}
          disabled={!!model.busy || avatarOpening}
          onPress={() => {
            setAvatarOpening(true);
            setAvatarVisible(true);
          }}
          style={styles.photo}
        >
          {model.photo === undefined ? (
            <UserAvatar size={96} />
          ) : (
            <Image source={{ uri: model.photo }} style={styles.image} />
          )}
          <View style={styles.camera}>
            {avatarOpening || model.busy === 'pick' || model.busy === 'crop' ? (
              <ActivityIndicator
                testID="avatar-camera-loading"
                size="small"
                color={colors.earth}
                style={styles.cameraIndicator}
              />
            ) : (
              <Feather name="camera" size={14} color={colors.earth} />
            )}
          </View>
        </Pressable>
        <Text numberOfLines={1} style={styles.heroName}>
          {model.name.trim() || 'Chưa đặt tên'}
        </Text>
        <Text style={styles.heroEmail}>Chạm ảnh để đổi ảnh đại diện</Text>
      </View>
      <Text style={styles.sectionLabel}>Thông tin</Text>
      <View style={styles.card}>
        <View style={styles.photoDetails}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Tên hiển thị</Text>
            <Text style={styles.hint}>{model.name.length}/60</Text>
          </View>
          <TextInput
            accessibilityLabel="Tên hiển thị"
            value={model.name}
            onChangeText={model.setName}
            editable={!model.busy}
            maxLength={60}
            placeholder="Tên bạn muốn được gọi"
            style={styles.input}
          />
        </View>
      </View>
      <Text style={styles.sectionLabel}>Tài khoản</Text>
      <View style={styles.card}>
        <View style={styles.email}>
          <View style={styles.mailIcon}>
            <Feather name="mail" size={16} color={colors.earth} />
          </View>
          <View style={styles.emailDetails}>
            <Text style={styles.hint}>Email đăng nhập</Text>
            <Text selectable style={styles.emailText}>
              {model.user?.email}
            </Text>
          </View>
        </View>
        {model.user && (
          <ProfileEmailVerification
            key={model.user.uid}
            uid={model.user.uid}
            disabled={!!model.busy}
          />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đổi mật khẩu"
          disabled={!!model.busy}
          onPress={() => setPasswordVisible(true)}
          style={styles.passwordRow}
        >
          <View style={styles.mailIcon}>
            <Feather name="lock" size={16} color={colors.earth} />
          </View>
          <Text style={styles.passwordText}>Đổi mật khẩu</Text>
          <Feather name="chevron-right" size={18} color={colors.muted} />
        </Pressable>
      </View>
      <AvatarEditorSheet
        visible={avatarVisible}
        onShown={() => setAvatarOpening(false)}
        source={model.cropSource}
        canEdit={model.canEditPhoto}
        busy={!!model.busy}
        error={model.error}
        onClose={() => {
          setAvatarVisible(false);
          setAvatarOpening(false);
          model.cancelCrop();
        }}
        onEdit={() => void model.editPhoto()}
        onPick={() => void model.pick()}
        onApply={(crop) => {
          setAvatarVisible(false);
          void model.applyCrop(crop);
        }}
      />
      {passwordVisible && model.user && (
        <ChangePasswordDialog
          key={model.user.uid}
          uid={model.user.uid}
          onClose={() => setPasswordVisible(false)}
        />
      )}
      {model.error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {model.error}
        </Text>
      )}
      {model.saved && (
        <Text accessibilityLiveRegion="polite" style={styles.success}>
          Đã lưu hồ sơ của bạn.
        </Text>
      )}
      <View style={styles.footer}>
        <Button
          title="Lưu thay đổi"
          loading={model.busy === 'save'}
          disabled={!!model.busy}
          onPress={() => void model.save()}
        />
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  content: { gap: 16, paddingTop: 8 },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  passwordText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
  footer: { marginTop: 'auto', paddingTop: 16 },
  hero: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 8,
    paddingBottom: 4,
  },
  heroName: {
    maxWidth: '90%',
    marginTop: 12,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.ink,
  },
  heroEmail: { fontSize: 12, color: colors.muted },
  sectionLabel: {
    marginBottom: -8,
    marginLeft: 6,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  photoDetails: { gap: 8 },
  photo: {},
  image: { width: 96, height: 96, borderRadius: 36 },
  camera: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunlightSoft,
    borderWidth: 2,
    borderColor: colors.background,
    borderRadius: 15,
  },
  cameraIndicator: { width: 14, height: 14, transform: [{ scale: 0.75 }] },
  card: {
    padding: 16,
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.background,
  },
  hint: { fontSize: 12, color: colors.muted },
  email: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
  },
  mailIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: colors.sunlightSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailDetails: { flex: 1 },
  emailText: { fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: 3 },
  error: { color: colors.danger, fontSize: 13 },
  success: { color: colors.success, fontSize: 13 },
});
