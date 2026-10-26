import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { AppTextInput } from '../../components/AppTextInput';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import type { PetSpecies } from '../../types/pet';
import { PET_SPECIES } from '../../services/pets/petCatalog';
import { colors, fontSize } from '../../theme';
import { styles } from './PetsScreen.styles';
const animalIcons = {
  cat: 'cat',
  dog: 'dog',
  rabbit: 'rabbit',
  fox: 'paw',
  bear: 'teddy-bear',
  owl: 'owl',
  panda: 'panda',
  hamster: 'rodent',
  penguin: 'penguin',
  deer: 'horse-variant',
  tiger: 'cat',
  pig: 'pig',
} as const;
export function PetSpeciesPicker({
  selected,
  onSelect,
  onCreate,
  busy,
}: {
  selected: PetSpecies[];
  onSelect: (s: PetSpecies) => void;
  onCreate: () => void;
  busy: boolean;
}) {
  const [query, setQuery] = useState('');
  const normalized = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase()
      .trim();
  const filtered = PET_SPECIES.filter((species) =>
    normalized(species.name).includes(normalized(query)),
  );
  return (
    <>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>MỘT CHÚT TƯỞNG TƯỢNG</Text>
        <Text style={styles.title}>Thú cưng mang nét riêng</Text>
        <Text style={styles.subtitle}>
          Chọn từ 1 đến 3 loài yêu thích. Một người bạn chibi nhỏ sẽ mang những
          nét đáng yêu của chúng.
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, styles.grow]}>Loài đã chọn</Text>
        <Text style={styles.label}>{selected.length}/3</Text>
      </View>
      <AppTextInput
        accessibilityLabel="Tìm loài thú cưng"
        placeholder="Tìm loài bạn thích…"
        value={query}
        onChangeText={setQuery}
        style={styles.input}
      />
      {filtered.length === 0 && (
        <Text style={styles.helper}>Chưa tìm thấy loài phù hợp.</Text>
      )}
      <View style={styles.speciesGrid}>
        {filtered.map((species) => {
          const checked = selected.includes(species.id),
            disabled = busy || (!checked && selected.length === 3);
          return (
            <Pressable
              key={species.id}
              accessibilityRole="checkbox"
              accessibilityLabel={`${species.name}, ${species.description}`}
              accessibilityState={{ checked, disabled }}
              disabled={disabled}
              onPress={() => onSelect(species.id)}
              style={[
                styles.species,
                checked && styles.selected,
                disabled && styles.dim,
              ]}
            >
              <View style={styles.speciesTop}>
                <MaterialCommunityIcons
                  name={animalIcons[species.id]}
                  size={fontSize.title}
                  color={colors.earth}
                />
                <Feather
                  name={checked ? 'check-circle' : 'circle'}
                  size={20}
                  color={checked ? colors.earth : colors.primaryBorder}
                />
              </View>
              <Text style={styles.name}>{species.name}</Text>
              <Text style={styles.detail}>{species.description}</Text>
            </Pressable>
          );
        })}
      </View>
      <Button
        title="Gặp thú cưng của bạn"
        disabled={!selected.length}
        loading={busy}
        onPress={onCreate}
      />
      <Text style={styles.helper}>
        Mỗi lần tạo là một diện mạo, chuyển động và phép thuật mới.
      </Text>
    </>
  );
}
