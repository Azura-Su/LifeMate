import { render, screen } from '@testing-library/react-native';
import { CardGameRules } from '../CardGameRules';

it('explains the Tấn formula, who counts in R, and how picked-up cards are scored', () => {
  render(
    <CardGameRules
      visible
      onClose={jest.fn()}
      gameKind="tan"
      variantConfig={{ pointsPerCard: 2 }}
    />,
  );

  expect(
    screen.getByText(/R là tổng số người kết thúc tự nhiên, tính cả người cuối/),
  ).toBeTruthy();
  expect(
    screen.getByText(/5×\(4−1\)×1=15 điểm; mỗi người về trước nhận 5 điểm/),
  ).toBeTruthy();
  expect(
    screen.getByText(/Bài đã nhặt chỉ tính nếu vẫn còn trên tay lúc kết thúc/),
  ).toBeTruthy();
  expect(
    screen.getByText(/Tấn: C là số lá người cuối còn; R là tổng người kết thúc tự nhiên/),
  ).toBeTruthy();
});

it('shows current and pending North v2 fees when only the next fee changes', () => {
  render(
    <CardGameRules
      visible
      onClose={jest.fn()}
      gameKind="north"
      variantConfig={{
        rulesVersion: 'north-v2',
        pointsPerCard: 1,
        remainingTwoPoints: 2,
        cutTwoPoints: 3,
      }}
      nextVariantConfig={{
        rulesVersion: 'north-v2',
        pointsPerCard: 1,
        remainingTwoPoints: 4,
        cutTwoPoints: 5,
      }}
    />,
  );

  expect(
    screen.getByText(/Bắc v2 hiện tại: mỗi lá 2 còn lại cộng thêm 2 điểm; tứ quý chặt một lá 2 chuyển 3 điểm/),
  ).toBeTruthy();
  expect(
    screen.getByText(/Bắc v2 từ ván tới: mỗi lá 2 còn lại cộng thêm 4 điểm; tứ quý chặt một lá 2 chuyển 5 điểm/),
  ).toBeTruthy();
});

it('shows current and pending Sâm v2 report fees independently', () => {
  render(
    <CardGameRules
      visible
      onClose={jest.fn()}
      gameKind="sam"
      variantConfig={{
        rulesVersion: 'sam-v2',
        pointsPerCard: 1,
        samCallPoints: 20,
      }}
      nextVariantConfig={{
        rulesVersion: 'sam-v2',
        pointsPerCard: 1,
        samCallPoints: 30,
      }}
    />,
  );

  expect(
    screen.getByText(/Sâm v2 hiện tại: báo thành công nhận 20 điểm từ từng đối thủ/),
  ).toBeTruthy();
  expect(
    screen.getByText(/Sâm v2 từ ván tới: báo thành công nhận 30 điểm từ từng đối thủ/),
  ).toBeTruthy();
});

it('shows pending v2 rules alongside the current legacy point rate', () => {
  render(
    <CardGameRules
      visible
      onClose={jest.fn()}
      gameKind="north"
      variantConfig={{ pointsPerCard: 1 }}
      nextVariantConfig={{
        rulesVersion: 'north-v2',
        pointsPerCard: 1,
        remainingTwoPoints: 2,
        cutTwoPoints: 3,
      }}
    />,
  );

  expect(screen.getByText('Ván hiện tại: 1 điểm/lá.')).toBeTruthy();
  expect(screen.getByText('Ván tới: 1 điểm/lá.')).toBeTruthy();
  expect(
    screen.getByText(/Bắc v2 từ ván tới: mỗi lá 2 còn lại cộng thêm 2 điểm/),
  ).toBeTruthy();
});
