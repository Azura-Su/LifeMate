import { render, screen } from '@testing-library/react-native';
import { CardGamePlayerDialog } from '../CardGamePlayerDialog';

jest.mock('../CardGameAvatarImage', () => ({
  CardGameAvatarImage: () => null,
}));

it('uses the selected game score unit in player details', () => {
  render(
    <CardGamePlayerDialog
      member={{
        uid: 'player',
        name: 'Bình',
        ready: true,
        wins: 1,
        balance: 7,
      }}
      balanceUnit="điểm"
      owner={false}
      self={false}
      canKick={false}
      busy={false}
      onClose={jest.fn()}
      onKick={jest.fn()}
    />,
  );

  expect(screen.getByText('Số dư bàn: 7 điểm')).toBeTruthy();
});
