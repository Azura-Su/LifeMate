import { fireEvent, render, screen } from '@testing-library/react-native';
import { CardRoomRulesDialog } from '../CardRoomRulesDialog';

it('saves a variant point rate for the next match', () => {
  const onSave = jest.fn();
  render(
    <CardRoomRulesDialog
      gameKind="north"
      rules={{ pointsPerCard: 2 }}
      version={4}
      blocked={false}
      onClose={jest.fn()}
      onSave={onSave}
    />,
  );
  fireEvent.changeText(screen.getByLabelText('Điểm mỗi lá ván tới'), '7');
  fireEvent.press(screen.getByRole('button', { name: 'Lưu luật ván tới' }));
  expect(onSave).toHaveBeenCalledWith(
    {
      type: 'set-variant-rules',
      variantConfig: {
        rulesVersion: 'north-v2',
        pointsPerCard: 7,
        remainingTwoPoints: 2,
        cutTwoPoints: 3,
      },
    },
    4,
  );
});

it('saves a configurable Sâm báo amount as the v2 profile', () => {
  const onSave = jest.fn();
  render(
    <CardRoomRulesDialog
      gameKind="sam"
      rules={{ pointsPerCard: 1 }}
      version={5}
      blocked={false}
      onClose={jest.fn()}
      onSave={onSave}
    />,
  );
  fireEvent.changeText(screen.getByLabelText('Điểm báo Sâm với mỗi người ván tới'), '25');
  fireEvent.press(screen.getByRole('button', { name: 'Lưu luật ván tới' }));
  expect(onSave).toHaveBeenCalledWith(
    {
      type: 'set-variant-rules',
      variantConfig: { rulesVersion: 'sam-v2', pointsPerCard: 1, samCallPoints: 25 },
    },
    5,
  );
});

it('disables saving a variant rule when the point rate is outside the allowed range', () => {
  render(
    <CardRoomRulesDialog
      gameKind="tan"
      rules={{ pointsPerCard: 1 }}
      version={4}
      blocked={false}
      onClose={jest.fn()}
      onSave={jest.fn()}
    />,
  );
  fireEvent.changeText(screen.getByLabelText('Điểm mỗi lá ván tới'), '0');
  expect(
    screen.getByRole('button', { name: 'Lưu luật ván tới' }),
  ).toBeDisabled();
});

it.each([
  ['Điểm cộng cho lá 2 còn lại ván tới', 'remainingTwoPoints'],
  ['Điểm chặt một lá 2 ván tới', 'cutTwoPoints'],
])('requires a value for the North fee field %s', (label) => {
  render(
    <CardRoomRulesDialog
      gameKind="north"
      rules={{ pointsPerCard: 1 }}
      version={4}
      blocked={false}
      onClose={jest.fn()}
      onSave={jest.fn()}
    />,
  );

  fireEvent.changeText(screen.getByLabelText(label), '');
  expect(
    screen.getByRole('button', { name: 'Lưu luật ván tới' }),
  ).toBeDisabled();
});

it('requires a value for the Sâm report fee field', () => {
  render(
    <CardRoomRulesDialog
      gameKind="sam"
      rules={{ pointsPerCard: 1 }}
      version={5}
      blocked={false}
      onClose={jest.fn()}
      onSave={jest.fn()}
    />,
  );

  fireEvent.changeText(
    screen.getByLabelText('Điểm báo Sâm với mỗi người ván tới'),
    '',
  );
  expect(
    screen.getByRole('button', { name: 'Lưu luật ván tới' }),
  ).toBeDisabled();
});

it('still allows an explicit zero fee for North and Sâm', () => {
  const northSave = jest.fn();
  const { unmount } = render(
    <CardRoomRulesDialog
      gameKind="north"
      rules={{ pointsPerCard: 1 }}
      version={4}
      blocked={false}
      onClose={jest.fn()}
      onSave={northSave}
    />,
  );
  fireEvent.changeText(
    screen.getByLabelText('Điểm cộng cho lá 2 còn lại ván tới'),
    '0',
  );
  fireEvent.changeText(screen.getByLabelText('Điểm chặt một lá 2 ván tới'), '0');
  fireEvent.press(screen.getByRole('button', { name: 'Lưu luật ván tới' }));
  expect(northSave).toHaveBeenCalledWith(
    {
      type: 'set-variant-rules',
      variantConfig: {
        rulesVersion: 'north-v2',
        pointsPerCard: 1,
        remainingTwoPoints: 0,
        cutTwoPoints: 0,
      },
    },
    4,
  );
  unmount();

  const samSave = jest.fn();
  render(
    <CardRoomRulesDialog
      gameKind="sam"
      rules={{ pointsPerCard: 1 }}
      version={5}
      blocked={false}
      onClose={jest.fn()}
      onSave={samSave}
    />,
  );
  fireEvent.changeText(
    screen.getByLabelText('Điểm báo Sâm với mỗi người ván tới'),
    '0',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu luật ván tới' }));
  expect(samSave).toHaveBeenCalledWith(
    {
      type: 'set-variant-rules',
      variantConfig: {
        rulesVersion: 'sam-v2',
        pointsPerCard: 1,
        samCallPoints: 0,
      },
    },
    5,
  );
});
