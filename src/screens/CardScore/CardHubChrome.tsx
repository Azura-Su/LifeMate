import { ScreenHeader } from '../../components/ScreenHeader';
import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import { styles } from './CardScoreScreen.styles';
import { useOnlineGameAccess } from '../../hooks/useOnlineGameAccess';

export function CardHubHeader({ onBack }: { onBack: () => void }) {
  return <ScreenHeader title="Trò chơi & điểm số" onBack={onBack} />;
}

export function CardHubModeTabs({
  active,
  onlineEnabled,
  onSelectScore,
  onSelectOnline,
}: {
  active: 'score' | 'online';
  onlineEnabled: boolean;
  onSelectScore: () => void;
  onSelectOnline: () => void;
}) {
  const scoreActive = active === 'score';
  const showOnline = useOnlineGameAccess();
  const onlineActive = active === 'online';
  return (
    <View accessibilityRole="tablist" style={styles.modeChoices}>
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel="Tính điểm"
        accessibilityState={{ selected: scoreActive }}
        onPress={onSelectScore}
        style={({ pressed }) => [
          styles.modeChoice,
          scoreActive && styles.modeChoiceActive,
          pressed && styles.modeChoicePressed,
        ]}
      >
        <Feather
          name="edit-3"
          size={15}
          color={scoreActive ? colors.earth : colors.muted}
        />
        <Text
          numberOfLines={1}
          style={[styles.modeTitle, scoreActive && styles.modeTitleActive]}
        >
          Tính điểm
        </Text>
      </Pressable>
      {showOnline && (
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Chơi online"
          accessibilityState={{
            selected: onlineActive,
            disabled: !onlineEnabled,
          }}
          disabled={!onlineEnabled}
          onPress={onSelectOnline}
          style={({ pressed }) => [
            styles.modeChoice,
            onlineActive && styles.modeChoiceActive,
            !onlineEnabled && styles.modeChoiceDisabled,
            pressed && styles.modeChoicePressed,
          ]}
        >
          <Feather
            name="users"
            size={15}
            color={onlineActive ? colors.earth : colors.muted}
          />
          <Text
            numberOfLines={1}
            style={[styles.modeTitle, onlineActive && styles.modeTitleActive]}
          >
            Chơi online
          </Text>
          {!onlineEnabled && (
            <Text numberOfLines={1} style={styles.modeDescription}>
              · Chưa khả dụng
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}
