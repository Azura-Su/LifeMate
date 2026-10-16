import Feather from '@expo/vector-icons/Feather';
import { useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BrandAvatar } from '../../components/BrandAvatar';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { useAuthStore } from '../../store/authStore';
import { colors, typography } from '../../theme';
import { styles as loginStyles } from '../Login/LoginScreen.styles';
import { RegisterCompletion } from './RegisterCompletion';
import { styles } from './RegisterScreen.styles';
import { useRegisterScreen } from './useRegisterScreen';

export function RegisterScreen() {
  const model = useRegisterScreen();
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const confirmationInput = useRef<TextInput>(null);
  return (
    <KeyboardAvoidingView
      style={loginStyles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen>
        {!model.created && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại đăng nhập"
            disabled={!!model.busy}
            onPress={() => useAuthStore.getState().closeRegistration()}
            style={styles.back}
          >
            <Text style={styles.backText}>‹ Đăng nhập</Text>
          </Pressable>
        )}
        <View style={loginStyles.brand}>
          <BrandAvatar size={56} />
          <Text style={loginStyles.wordmark}>LifeMate</Text>
        </View>
        {model.created ? (
          <RegisterCompletion model={model} />
        ) : (
          <>
            <View style={styles.intro}>
              <Text style={typography.eyebrow}>BẮT ĐẦU VỚI LIFEMATE</Text>
              <Text accessibilityRole="header" style={styles.title}>
                Tạo tài khoản
              </Text>
              <Text style={typography.body}>
                Giữ những điều quan trọng trong một nơi dành riêng cho bạn.
              </Text>
            </View>
            <View style={loginStyles.form}>
              <Text style={loginStyles.label}>Tên hiển thị</Text>
              <TextInput
                accessibilityLabel="Tên hiển thị"
                placeholder="Tên của bạn"
                placeholderTextColor={colors.muted}
                value={model.name}
                onChangeText={model.setName}
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                onSubmitEditing={() => emailInput.current?.focus()}
                editable={!model.busy}
                style={loginStyles.input}
              />
              <Text style={loginStyles.label}>Địa chỉ email</Text>
              <TextInput
                ref={emailInput}
                accessibilityLabel="Địa chỉ email đăng ký"
                placeholder="ban@example.com"
                placeholderTextColor={colors.muted}
                value={model.email}
                onChangeText={model.setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passwordInput.current?.focus()}
                editable={!model.busy}
                style={loginStyles.input}
              />
              <Text style={loginStyles.label}>Mật khẩu</Text>
              <View style={loginStyles.password}>
                <TextInput
                  ref={passwordInput}
                  accessibilityLabel="Mật khẩu đăng ký"
                  placeholder="Ít nhất 8 ký tự"
                  placeholderTextColor={colors.muted}
                  value={model.password}
                  onChangeText={model.setPassword}
                  secureTextEntry={!model.visible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="next"
                  onSubmitEditing={() => confirmationInput.current?.focus()}
                  editable={!model.busy}
                  style={loginStyles.passwordInput}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    model.visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
                  }
                  onPress={model.toggleVisible}
                  disabled={!!model.busy}
                  style={loginStyles.eye}
                >
                  <Feather
                    name={model.visible ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.muted}
                  />
                </Pressable>
              </View>
              <Text style={loginStyles.label}>Nhập lại mật khẩu</Text>
              <TextInput
                ref={confirmationInput}
                accessibilityLabel="Nhập lại mật khẩu"
                placeholder="Nhập lại mật khẩu"
                placeholderTextColor={colors.muted}
                value={model.confirmation}
                onChangeText={model.setConfirmation}
                secureTextEntry={!model.visible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={() => void model.submit()}
                editable={!model.busy}
                style={loginStyles.input}
              />
              {model.error && (
                <Text accessibilityRole="alert" style={loginStyles.error}>
                  {model.error}
                </Text>
              )}
              <View style={loginStyles.submit}>
                <Button
                  title="Tạo tài khoản"
                  loading={model.busy === 'create'}
                  disabled={!!model.busy}
                  onPress={() => void model.submit()}
                />
              </View>
              <Text style={styles.hint}>
                Chúng tôi sẽ gửi thư xác nhận đến email này ngay sau khi tạo tài
                khoản.
              </Text>
            </View>
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
