import { styles } from './HomeScreen.styles';
import Feather from '@expo/vector-icons/Feather';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { BrandAvatar } from '../../components/BrandAvatar';
import { Screen } from '../../components/Screen';
import type { MainTabParams } from '../../navigation/types';
import { colors, typography } from '../../theme';
import { useHomeScreen } from './useHomeScreen';

export function HomeScreen({
  navigation,
}: BottomTabScreenProps<MainTabParams, 'Home'>) {
  const model = useHomeScreen();
  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={model.loading}
          onRefresh={model.refresh}
          tintColor={colors.green}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.greeting}>
          <Text style={typography.small}>Chào bạn,</Text>
          <Text accessibilityRole="header" style={typography.title}>
            {model.name}
          </Text>
        </View>
        <BrandAvatar />
      </View>
      <Text style={typography.small}>{model.date}</Text>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Feather name="sun" size={28} color={colors.ink} />
          <Text style={styles.tag}>LIFEMATE / MỖI NGÀY</Text>
        </View>
        <Text style={styles.heroTitle}>
          Dành một chút{'\n'}thời gian cho mình.
        </Text>
        <Text style={styles.heroBody}>
          Một nhịp thở sâu. Một giai điệu quen.{'\n'}Những điều nhỏ làm nên một
          ngày đẹp.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={typography.heading}>Không gian của bạn</Text>
        <Text style={typography.body}>Bắt đầu từ điều bạn muốn hôm nay.</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mở thư viện MP3"
        onPress={() => navigation.navigate('MP3')}
        style={styles.music}
      >
        <View style={styles.musicIcon}>
          <Feather name="headphones" size={26} color={colors.green} />
        </View>
        <View style={styles.rowText}>
          <Text style={typography.heading}>Một chút âm nhạc</Text>
          <Text style={typography.small}>Đến thư viện MP3 của bạn</Text>
        </View>
        <Feather name="arrow-up-right" size={22} color={colors.green} />
      </Pressable>
      {model.warning && (
        <Text accessibilityLiveRegion="polite" style={typography.small}>
          {model.warning} Kéo xuống để thử lại.
        </Text>
      )}
      <View style={styles.note}>
        <View style={styles.noteLine} />
        <Text style={typography.small}>
          Không cần vội. Hôm nay, cứ theo nhịp của bạn.
        </Text>
      </View>
    </Screen>
  );
}
