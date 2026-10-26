import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PetSpeciesPicker } from '../PetSpeciesPicker';
import type { PetSpecies } from '../../../types/pet';
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock(
  '@expo/vector-icons/MaterialCommunityIcons',
  () => 'MaterialCommunityIcons',
);
function Picker() {
  const [selected, setSelected] = useState<PetSpecies[]>([]);
  return (
    <PetSpeciesPicker
      selected={selected}
      onSelect={(id) =>
        setSelected((s) =>
          s.includes(id) ? s.filter((v) => v !== id) : [...s, id],
        )
      }
      busy={false}
      onCreate={() => {}}
    />
  );
}
it('filters twelve animals without losing selections or allowing more than three', () => {
  render(<Picker />);
  expect(screen.getAllByRole('checkbox')).toHaveLength(12);
  const search = screen.getByLabelText('Tìm loài thú cưng');
  fireEvent.changeText(search, 'gau truc');
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  fireEvent.press(screen.getByRole('checkbox', { name: /Gấu trúc/ }));
  fireEvent.changeText(search, '');
  fireEvent.press(screen.getByRole('checkbox', { name: /cánh cụt/ }));
  fireEvent.press(screen.getByRole('checkbox', { name: /Hươu/ }));
  expect(screen.getByRole('checkbox', { name: /Hổ/ })).toBeDisabled();
  expect(screen.getByRole('checkbox', { name: /Gấu trúc/ })).toBeChecked();
  fireEvent.changeText(search, 'không có loài');
  expect(screen.getByText('Chưa tìm thấy loài phù hợp.')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Gặp thú cưng của bạn' }),
  ).toBeEnabled();
});
