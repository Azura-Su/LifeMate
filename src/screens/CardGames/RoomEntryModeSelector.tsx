import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import { styles } from './CardGamesScreen.styles';

export type RoomEntryMode = 'create' | 'join';

const modeOptions: {
  value: RoomEntryMode;
  label: string;
  icon: 'plus-circle' | 'log-in';
}[] = [
  { value: 'create', label: 'Tạo phòng mới', icon: 'plus-circle' },
  { value: 'join', label: 'Vào phòng có sẵn', icon: 'log-in' },
];

export const roomEntryActions: Record<
  RoomEntryMode,
  { title: string; variant: 'primary' | 'secondary' }
> = {
  create: { title: 'Tạo phòng', variant: 'primary' },
  join: { title: 'Vào phòng', variant: 'secondary' },
};

export function RoomEntryModeSelector({
  mode,
  onChange,
}: {
  mode: RoomEntryMode;
  onChange: (mode: RoomEntryMode) => void;
}) {
  return (
    <View style={styles.entryModes}>
      {modeOptions.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: mode === option.value }}
          onPress={() => onChange(option.value)}
          style={[
            styles.entryMode,
            mode === option.value && styles.entryModeSelected,
          ]}
        >
          <Feather
            name={option.icon}
            size={15}
            color={mode === option.value ? colors.earth : colors.muted}
          />
          <Text
            style={[
              styles.entryModeTitle,
              mode === option.value && styles.entryModeTitleSelected,
            ]}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
