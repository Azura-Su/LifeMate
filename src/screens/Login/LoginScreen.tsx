import { styles } from './LoginScreen.styles';
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
import { colors, typography } from '../../theme';
import { useLoginScreen } from './useLoginScreen';

export function LoginScreen() {
  const model = useLoginScreen();
  const passwordInput = useRef<TextInput>(null);
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen>
        <View style={styles.brand}>
          <BrandAvatar size={72} />
          <Text style={styles.wordmark}>LifeMate</Text>
        </View>
        <View style={styles.intro}>
          <Text style={typography.eyebrow}>MỖI NGÀY, CÙNG BẠN</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Chào mừng trở lại.
          </Text>
          <Text style={typography.body}>
            Mở sổ thu chi và thư viện âm thanh của bạn.
          </Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.label}>Địa chỉ email</Text>
          <TextInput
            accessibilityLabel="Địa chỉ email"
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
            editable={!model.loading}
            style={styles.input}
          />
          <Text style={styles.label}>Mật khẩu</Text>
          <View style={styles.password}>
            <TextInput
              ref={passwordInput}
              accessibilityLabel="Mật khẩu"
              placeholder="Nhập mật khẩu"
              placeholderTextColor={colors.muted}
              value={model.password}
              onChangeText={model.setPassword}
              secureTextEntry={!model.visible}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              editable={!model.loading}
              onSubmitEditing={model.submit}
              returnKeyType="go"
              style={styles.passwordInput}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                model.visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
              }
              onPress={model.toggleVisible}
              disabled={model.loading}
              style={styles.eye}
            >
              <Feather
                name={model.visible ? 'eye-off' : 'eye'}
                size={20}
                color={colors.muted}
              />
            </Pressable>
          </View>
          {model.error && (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.error}
            >
              {model.error}
            </Text>
          )}
          <View style={styles.submit}>
            <Button
              title="Đăng nhập"
              onPress={model.submit}
              loading={model.loading}
            />
          </View>
          <Text style={typography.small}>
            Sử dụng tài khoản đã được cấp để bắt đầu.
          </Text>
        </View>
        <View style={styles.footer}>
          <View style={styles.line} />
          <Text style={typography.small}>Chậm lại một chút. Gần mình hơn.</Text>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
