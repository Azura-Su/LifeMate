import { Image, StyleSheet } from 'react-native';
import { colors } from '../theme';

export function BrandAvatar({ size = 56 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/icon.png')}
      accessibilityLabel="Biểu tượng LifeMate"
      style={[
        styles.image,
        { width: size, height: size, borderRadius: size / 3 },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.background },
});
