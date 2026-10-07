import { styles } from './Mp3Screen.styles';
import Feather from '@expo/vector-icons/Feather';
import { Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors, typography } from '../../theme';

export function Mp3Screen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.eyebrow}>MỘT NHỊP RIÊNG</Text>
        <Text accessibilityRole="header" style={typography.title}>
          Thư viện MP3
        </Text>
        <Text style={typography.body}>
          Góc nhỏ dành cho những giai điệu bạn yêu.
        </Text>
      </View>
      <View style={styles.empty}>
        <View style={styles.disc}>
          <View style={styles.innerDisc}>
            <Feather name="music" size={36} color={colors.primary} />
          </View>
        </View>
        <Text style={typography.heading}>Âm nhạc sẽ ở đây</Text>
        <Text style={styles.description}>
          Thư viện chưa có bài hát.{'\n'}Nội dung sẽ xuất hiện khi được bổ sung.
        </Text>
      </View>
      <Text style={styles.footer}>
        Một chút yên tĩnh cũng là một giai điệu.
      </Text>
    </Screen>
  );
}
