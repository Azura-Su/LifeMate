import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import { Alert, Dimensions, StyleSheet } from 'react-native';
import { CardScoreRoundDialog } from '../CardScoreRoundDialog';
import { CardScoreScreen } from '../CardScoreScreen';
import { CardScoreSetupDialog } from '../CardScoreSetupDialog';
import { useAuthStore } from '../../../store/authStore';
import { readCardScoreMatches } from '../../../services/cardScore/cardScoreStorage';
import { colors, layout } from '../../../theme';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);

const uid = 'card-score-screen-test';

beforeEach(async () => {
  await AsyncStorage.clear();
  useAuthStore.getState().setUser({
    uid,
    email: 'player@example.com',
    displayName: 'Player',
  });
});

function renderScreen() {
  return render(
    <CardScoreScreen
      navigation={{ navigate: jest.fn() } as never}
      route={{} as never}
    />,
  );
}

it('keeps the save control outside the scroll area on eight-player games', () => {
  const players = Array.from({ length: 8 }, (_, index) => ({
    id: `player-${index + 1}`,
    name: `Người chơi ${index + 1}`,
  }));
  render(
    <CardScoreRoundDialog
      visible
      busy={false}
      error={null}
      match={{
        id: 'eight-player-match',
        title: 'Bàn tám người',
        players,
        seatOrder: players.map(({ id }) => id),
        dealerPlayerId: players[0].id,
        rounds: [],
        status: 'active',
        createdAt: 0,
        updatedAt: 0,
      }}
      editingRound={null}
      scores={Object.fromEntries(players.map(({ id }) => [id, '0']))}
      onClose={jest.fn()}
      onChange={jest.fn()}
      onSave={jest.fn()}
    />,
  );

  const scrollContent = screen.getByTestId('card-score-round-scroll');
  expect(
    within(scrollContent).getAllByRole('button', {
      name: /^Chọn điểm của Người chơi/,
    }),
  ).toHaveLength(8);
  expect(
    within(scrollContent).queryByRole('button', { name: 'Lưu ván' }),
  ).toBeNull();
  expect(screen.getByRole('button', { name: 'Lưu ván' })).toBeTruthy();
});

it('shows a round loading indicator instead of the create button while saving', () => {
  render(
    <CardScoreSetupDialog
      visible
      busy
      error={null}
      title=""
      onTitleChange={jest.fn()}
      playerNames={['An', 'Bình', 'Chi']}
      drawnSeats={null}
      onClose={jest.fn()}
      onCreate={jest.fn()}
      onNameChange={jest.fn()}
      onRemovePlayer={jest.fn()}
      onAddPlayer={jest.fn()}
      onDrawSeats={jest.fn()}
    />,
  );

  const loadingIndicator = screen.getByRole('progressbar', {
    name: 'Đang tạo bàn',
  });
  expect(StyleSheet.flatten(loadingIndicator.props.style)).toMatchObject({
    width: 48,
    height: 48,
    borderRadius: 24,
  });
  expect(screen.queryByRole('button', { name: 'Tạo' })).toBeNull();
  expect(screen.getByLabelText('Tên bàn chơi').props.editable).toBe(false);
  expect(screen.getByLabelText('Tên người chơi 1').props.editable).toBe(false);
  expect(
    screen.getByRole('button', { name: 'Bỏ người chơi 1' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Thêm người chơi' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Bốc thăm vị trí & người chia bài' }),
  ).toBeDisabled();
});

it('keeps the create action compact and centered in the setup dialog', () => {
  render(
    <CardScoreSetupDialog
      visible
      busy={false}
      error={null}
      title=""
      onTitleChange={jest.fn()}
      playerNames={['', '']}
      drawnSeats={null}
      onClose={jest.fn()}
      onCreate={jest.fn()}
      onNameChange={jest.fn()}
      onRemovePlayer={jest.fn()}
      onAddPlayer={jest.fn()}
      onDrawSeats={jest.fn()}
    />,
  );

  const createButton = screen.getByRole('button', { name: 'Tạo' });
  expect(StyleSheet.flatten(createButton.props.style)).toMatchObject({
    width: 120,
    height: 44,
  });

  const randomizeButton = screen.getByRole('button', {
    name: 'Bốc thăm vị trí & người chia bài',
  });
  expect(StyleSheet.flatten(randomizeButton.props.style)).toMatchObject({
    minHeight: 36,
    paddingHorizontal: 11,
  });
  expect(
    StyleSheet.flatten(
      screen.getByTestId('card-score-setup-secondary-actions').props.style,
    ),
  ).toMatchObject({
    flexDirection: 'row',
    justifyContent: 'space-between',
  });
  expect(screen.getByText('Bốc thăm')).toBeTruthy();
});

it('creates a shared game table, records and edits scores with the keypad, then keeps its history', async () => {
  const rendered = renderScreen();
  fireEvent.press(await screen.findByText('Tạo bàn chơi'));
  expect(
    within(screen.getByTestId('card-score-setup-scroll')).queryByRole(
      'button',
      { name: 'Tạo' },
    ),
  ).toBeNull();
  expect(
    within(screen.getByTestId('card-score-setup-footer')).getByRole('button', {
      name: 'Tạo',
    }),
  ).toBeTruthy();
  expect(screen.queryByLabelText('Tên người chơi 3')).toBeNull();
  expect(screen.queryByText(/tùy chọn/)).toBeNull();
  expect(screen.queryByText(/Dùng chung cho mọi trò/)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Thêm người chơi' }));
  fireEvent.press(screen.getByRole('button', { name: 'Thêm người chơi' }));
  fireEvent.changeText(screen.getByLabelText('Tên bàn chơi'), 'Phỏm');
  const names = ['An', 'Bình', 'Chi', 'Dung'];
  for (let index = 0; index < names.length; index += 1)
    fireEvent.changeText(
      screen.getByLabelText(`Tên người chơi ${index + 1}`),
      names[index],
    );
  fireEvent.press(
    screen.getByRole('button', {
      name: 'Bốc thăm vị trí & người chia bài',
    }),
  );
  expect(screen.getByText(/1\. .*Chia bài/)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Tạo' }));
  expect(await screen.findByText('Phỏm')).toBeTruthy();
  expect(screen.getByText('4 người · bắt đầu', { exact: false })).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Thêm ván' }));
  expect(screen.getByRole('button', { name: 'Đóng nhập điểm' })).toBeTruthy();
  expect(
    screen.queryByText(
      'Chọn người chơi rồi chạm số. Có thể nhập điểm âm hoặc dương.',
    ),
  ).toBeNull();
  const playerChoices = screen.getByTestId('card-score-player-choices');
  expect(playerChoices.props.horizontal).toBeUndefined();
  expect(StyleSheet.flatten(playerChoices.props.style)).toMatchObject({
    flexDirection: 'row',
    flexWrap: 'wrap',
  });
  expect(
    StyleSheet.flatten(
      screen.getByRole('button', { name: 'Chọn điểm của An' }).props.style,
    ),
  ).toMatchObject({ width: '48%' });
  expect(screen.queryByRole('button', { name: 'Đóng' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Đóng nhập điểm' }));
  expect(screen.queryByText('Nhập điểm nhanh')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Thêm ván' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 1' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 2' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn điểm của Bình' }));
  fireEvent.press(screen.getByRole('button', { name: 'Dấu âm/dương' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 4' }));
  fireEvent.press(screen.getByRole('button', { name: 'Lưu ván' }));
  const roundNumber = await screen.findByRole('button', {
    name: 'Sửa điểm ván 1',
  });
  expect(within(roundNumber).getByText('1')).toBeTruthy();
  expect(within(roundNumber).queryByText('V1')).toBeNull();
  const roundRowActions = within(
    screen.getByTestId('card-score-round-1'),
  ).getAllByRole('button');
  expect(roundRowActions).toHaveLength(6);
  expect(roundRowActions[0].props.accessibilityLabel).toBe('Sửa điểm ván 1');
  expect(
    roundRowActions[roundRowActions.length - 1].props.accessibilityLabel,
  ).toBe('Xóa điểm ván 1');
  expect(
    StyleSheet.flatten(
      screen.getByRole('button', { name: 'Xóa điểm ván 1' }).props.style,
    ),
  ).toMatchObject({
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.dangerSoft,
  });
  expect(screen.queryByText('Σ')).toBeNull();
  expect(
    StyleSheet.flatten(screen.getByTestId('card-score-round-1').props.style)
      .backgroundColor,
  ).toBe(colors.dangerSoft);
  await waitFor(() =>
    expect(screen.getAllByText('+12').length).toBeGreaterThan(0),
  );
  await waitFor(() =>
    expect(screen.getAllByText('-4').length).toBeGreaterThan(0),
  );

  fireEvent.press(screen.getByRole('button', { name: 'Sửa điểm ván 1' }));
  fireEvent.press(
    screen.getByRole('button', { name: 'Xóa điểm người chơi đang chọn' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Số 3' }));
  fireEvent.press(screen.getByRole('button', { name: 'Lưu ván' }));
  await waitFor(() =>
    expect(screen.getAllByText('+3').length).toBeGreaterThan(0),
  );

  const confirm = jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Xóa ván')?.onPress?.();
    });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Xóa điểm ván 1' }),
    ).toBeEnabled(),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Xóa điểm ván 1' }));
  expect(confirm).toHaveBeenCalled();
  await waitFor(async () =>
    expect((await readCardScoreMatches(uid))[0].rounds).toHaveLength(0),
  );
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Sửa điểm ván 1' })).toBeNull(),
  );
  confirm.mockRestore();

  fireEvent.press(screen.getByRole('button', { name: 'Kết thúc bàn chơi' }));
  expect(screen.getByText('Kết thúc bàn chơi?')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục chơi' }));
  expect(screen.getByText('Phỏm')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Kết thúc bàn chơi' }));
  fireEvent.press(
    screen.getByRole('button', { name: 'Xác nhận kết thúc bàn' }),
  );
  const historyButton = await screen.findByRole('button', {
    name: /^Xem lịch sử bàn \d{2}:/,
  });
  fireEvent.press(historyButton);
  expect(
    await screen.findByText('Bàn chưa có ván được ghi điểm.'),
  ).toBeTruthy();
  const [saved] = await readCardScoreMatches(uid);
  expect(saved.title).toBe('Phỏm');
  expect(saved.rounds).toEqual([]);
  expect(saved.players.map(({ name }) => name)).toEqual(names);
  expect(saved.status).toBe('finished');

  rendered.unmount();
  renderScreen();
  const historyCard = await screen.findByTestId(
    `card-score-history-${saved.id}`,
  );
  expect(StyleSheet.flatten(historyCard.props.style)).toMatchObject({
    flexDirection: 'column',
    alignItems: 'stretch',
  });
  const historyTitleButton = screen.getByRole('button', {
    name: `Xem lịch sử bàn ${saved.title}`,
  });
  expect(StyleSheet.flatten(historyTitleButton.props.style)).toMatchObject({
    flex: 1,
    justifyContent: 'center',
  });
  expect(
    StyleSheet.flatten(screen.getByText(saved.title).props.style),
  ).not.toHaveProperty('flex');
  const playerScores = screen.getByTestId(
    `card-score-history-scores-${saved.id}`,
  );
  expect(StyleSheet.flatten(playerScores.props.style)).toMatchObject({
    flexDirection: 'row',
    flexWrap: 'wrap',
  });
  expect(within(playerScores).getByText('An')).toBeTruthy();
  expect(within(playerScores).getByText('Bình')).toBeTruthy();
  expect(within(playerScores).getAllByText('0')).toHaveLength(4);
  expect(screen.getByText(/\d{2}:\d{2} \d+\/\d+\/\d{4} · 0 ván/)).toBeTruthy();
  const resumeButton = screen.getByRole('button', {
    name: `Tiếp tục chơi bàn ${saved.title}`,
  });
  const resumeButtonStyle = StyleSheet.flatten(resumeButton.props.style);
  expect(resumeButtonStyle).toMatchObject({
    width: 36,
    height: 36,
  });
  expect(resumeButtonStyle).not.toHaveProperty('backgroundColor');
  expect(screen.queryByText('Tiếp tục chơi')).toBeNull();
  fireEvent.press(resumeButton);
  expect(await screen.findByRole('button', { name: 'Thêm ván' })).toBeTruthy();
  expect(screen.getByText('Phỏm')).toBeTruthy();
  await waitFor(async () =>
    expect((await readCardScoreMatches(uid))[0].status).toBe('active'),
  );
});

it('closes setup with the X, keeps multiple active tables, and switches between them', async () => {
  renderScreen();
  fireEvent.press(await screen.findByText('Tạo bàn chơi'));
  expect(screen.getByLabelText('Tên bàn chơi')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Đóng tạo bàn chơi' }));
  expect(screen.queryByLabelText('Tên bàn chơi')).toBeNull();
  expect(screen.queryByText('Bỏ giấy bút, tập trung cuộc vui')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Tạo bàn chơi' }));
  fireEvent.changeText(screen.getByLabelText('Tên bàn chơi'), 'Bàn An');
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 1'), 'An');
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 2'), 'Bình');
  fireEvent.press(screen.getByRole('button', { name: 'Tạo' }));
  expect(await screen.findByText('Bàn An')).toBeTruthy();
  expect(screen.getByTestId('card-score-table-grid').props.style.width).toBe(
    Math.min(Dimensions.get('window').width, layout.contentMaxWidth) -
      layout.screenGutter * 2 -
      2,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Thêm ván' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 1' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 0' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn điểm của Bình' }));
  fireEvent.press(screen.getByRole('button', { name: 'Dấu âm/dương' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 1' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 0' }));
  fireEvent.press(screen.getByRole('button', { name: 'Lưu ván' }));
  expect(
    within(
      await screen.findByRole('button', { name: 'Sửa điểm ván 1' }),
    ).getByText('1'),
  ).toBeTruthy();
  expect(screen.queryByText('Σ')).toBeNull();
  expect(
    screen.queryByText('Tổng ván cần bằng 0 · dòng đỏ đang bị lệch'),
  ).toBeNull();
  expect(
    StyleSheet.flatten(screen.getByTestId('card-score-round-1').props.style)
      .backgroundColor,
  ).not.toBe(colors.dangerSoft);

  expect(
    screen.getByRole('button', { name: 'Tạo bàn mới, giữ bàn hiện tại' }),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Tạo bàn chơi mới' })).toBeNull();
  fireEvent.press(
    screen.getByRole('button', { name: 'Tạo bàn mới, giữ bàn hiện tại' }),
  );
  fireEvent.changeText(screen.getByLabelText('Tên bàn chơi'), 'Bàn Bình');
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 1'), 'Thu');
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 2'), 'Minh');
  fireEvent.press(screen.getByRole('button', { name: 'Tạo' }));
  expect(await screen.findByText('Các bàn đang chơi · 2')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Mở bàn Bàn Bình' }).props
      .accessibilityState.selected,
  ).toBe(true);
  expect(screen.getAllByText('Bàn Bình')).toHaveLength(1);
  expect(screen.getByText(/^Bắt đầu /)).toBeTruthy();
  expect(screen.queryByText(/2 người · bắt đầu/)).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Mở bàn Bàn An' }));
  expect(
    screen.getByRole('button', { name: 'Mở bàn Bàn An' }).props
      .accessibilityState.selected,
  ).toBe(true);
  const active = await readCardScoreMatches(uid);
  expect(active.filter((match) => match.status === 'active')).toHaveLength(2);
  expect(active.find((match) => match.title === 'Bàn An')?.rounds).toHaveLength(
    1,
  );
});

it('adds a player to an active table without changing scores from earlier rounds', async () => {
  renderScreen();
  fireEvent.press(await screen.findByText('Tạo bàn chơi'));
  fireEvent.changeText(screen.getByLabelText('Tên bàn chơi'), 'Bàn đang chơi');
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 1'), 'An');
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 2'), 'Bình');
  fireEvent.press(screen.getByRole('button', { name: 'Tạo' }));
  expect(await screen.findByText('Bàn đang chơi')).toBeTruthy();

  expect(
    within(screen.getByTestId('card-score-active-tables-heading')).queryByRole(
      'button',
      { name: 'Quản lý người chơi' },
    ),
  ).toBeNull();
  expect(
    within(screen.getByTestId('card-score-current-match-heading')).getByRole(
      'button',
      { name: 'Quản lý người chơi' },
    ),
  ).toBeTruthy();

  const dealerHeader = screen.getByTestId(
    'card-score-player-header-content-player-1',
  );
  expect(
    StyleSheet.flatten(
      screen.getByTestId('card-score-player-column-player-1').props.style,
    ),
  ).not.toHaveProperty('backgroundColor');
  expect(screen.queryByTestId('card-score-dealer-badge-player-1')).toBeNull();
  expect(dealerHeader.children).toHaveLength(1);
  expect(dealerHeader.children[0].props.children).toBe('An');
  expect(dealerHeader.children[0].props.accessibilityLabel).toBe(
    'An, người chia bài',
  );
  expect(
    StyleSheet.flatten(dealerHeader.children[0].props.style),
  ).toMatchObject({
    width: '100%',
    textAlign: 'center',
    color: colors.earth,
  });
  expect(
    StyleSheet.flatten(
      screen.getByTestId('card-score-player-header-content-player-2')
        .children[0].props.style,
    ),
  ).toMatchObject({ width: '100%', textAlign: 'center' });

  fireEvent.press(screen.getByRole('button', { name: 'Thêm ván' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 5' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn điểm của Bình' }));
  fireEvent.press(screen.getByRole('button', { name: 'Dấu âm/dương' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 5' }));
  fireEvent.press(screen.getByRole('button', { name: 'Lưu ván' }));
  expect(
    within(
      await screen.findByRole('button', { name: 'Sửa điểm ván 1' }),
    ).getByText('1'),
  ).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Quản lý người chơi' }));
  expect(screen.getByText('Quản lý người chơi')).toBeTruthy();
  expect(
    screen.getByText(
      'Khi xóa, điểm người đó trong các ván đã ghi cũng bị xóa.',
    ),
  ).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Tên người chơi mới'), 'An');
  fireEvent.press(
    screen.getByRole('button', { name: 'Thêm người chơi vào bàn' }),
  );
  expect(
    await screen.findByText('Tên người chơi không được trùng nhau.'),
  ).toBeTruthy();
  expect(screen.getByLabelText('Tên người chơi mới')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Tên người chơi mới'), 'Chi');
  fireEvent.press(
    screen.getByRole('button', { name: 'Thêm người chơi vào bàn' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));

  expect(
    await screen.findByRole('button', {
      name: 'Sửa điểm ván 1 của Chi: 0',
    }),
  ).toBeTruthy();
  const [saved] = await readCardScoreMatches(uid);
  expect(saved.players.map(({ name }) => name)).toEqual(['An', 'Bình', 'Chi']);
  expect(saved.rounds[0].scores).toEqual({ 'player-1': 5, 'player-2': -5 });
  expect(saved.rounds[0].scores).not.toHaveProperty(saved.players[2].id);
  expect(screen.getByText('An')).toBeTruthy();
  expect(screen.getByText('Chi')).toBeTruthy();
});

it('redraws only the dealer without changing player positions', async () => {
  renderScreen();
  fireEvent.press(await screen.findByText('Tạo bàn chơi'));
  fireEvent.changeText(screen.getByLabelText('Tên bàn chơi'), 'Bàn thử');
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 1'), 'An');
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 2'), 'Bình');
  fireEvent.press(screen.getByRole('button', { name: 'Tạo' }));
  await screen.findByText('Bàn thử');

  const before = (await readCardScoreMatches(uid)).find(
    (match) => match.status === 'active',
  );
  expect(before?.dealerPlayerId).toBe('player-1');
  expect(before?.seatOrder).toEqual(['player-1', 'player-2']);

  const random = jest.spyOn(Math, 'random').mockReturnValue(0);
  fireEvent.press(
    screen.getByRole('button', {
      name: 'Bốc thăm người chia bài',
    }),
  );
  await waitFor(async () => {
    const after = (await readCardScoreMatches(uid)).find(
      (match) => match.status === 'active',
    );
    expect(after?.dealerPlayerId).toBe('player-2');
    expect(after?.seatOrder).toEqual(before?.seatOrder);
  });
  random.mockRestore();

  expect(
    StyleSheet.flatten(
      screen.getByTestId('card-score-player-header-content-player-1')
        .children[0].props.style,
    ),
  ).not.toMatchObject({ color: colors.earth });
  expect(
    StyleSheet.flatten(
      screen.getByTestId('card-score-player-header-content-player-2')
        .children[0].props.style,
    ),
  ).toMatchObject({ color: colors.earth });
  expect(screen.getByText(/Tên người chia bài được tô màu/)).toBeTruthy();
  expect(screen.queryByText(/Huy hiệu/)).toBeNull();
});

it('renames and removes a player without changing the remaining player IDs', async () => {
  renderScreen();
  fireEvent.press(await screen.findByText('Tạo bàn chơi'));
  fireEvent.changeText(
    screen.getByLabelText('Tên bàn chơi'),
    'Bàn có chỉnh sửa',
  );
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 1'), 'An');
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 2'), 'Bình');
  fireEvent.press(screen.getByRole('button', { name: 'Tạo' }));
  expect(await screen.findByText('Bàn có chỉnh sửa')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Thêm ván' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 5' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn điểm của Bình' }));
  fireEvent.press(screen.getByRole('button', { name: 'Dấu âm/dương' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 5' }));
  fireEvent.press(screen.getByRole('button', { name: 'Lưu ván' }));
  expect(
    await screen.findByRole('button', { name: 'Sửa điểm ván 1' }),
  ).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Quản lý người chơi' }));
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 1'), 'An mới');
  fireEvent.changeText(screen.getByLabelText('Tên người chơi mới'), 'Chi');
  fireEvent.press(
    screen.getByRole('button', { name: 'Thêm người chơi vào bàn' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Xóa người chơi Bình' }));

  const confirmRemoval = jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Xóa và lưu')?.onPress?.();
    });
  fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));

  await waitFor(() => expect(confirmRemoval).toHaveBeenCalled());
  expect(confirmRemoval.mock.calls[0][1]).toContain(
    'Tổng các ván này có thể không còn bằng 0',
  );
  await waitFor(async () => {
    const [saved] = await readCardScoreMatches(uid);
    expect(saved.players.map(({ name }) => name)).toEqual(['An mới', 'Chi']);
    expect(saved.rounds[0].scores).toEqual({ 'player-1': 5 });
  });
  expect(screen.getByText('An mới')).toBeTruthy();
  expect(screen.getByText('Chi')).toBeTruthy();
  expect(screen.queryByText('Bình')).toBeNull();
  expect(
    StyleSheet.flatten(screen.getByTestId('card-score-round-1').props.style)
      .backgroundColor,
  ).toBe(colors.dangerSoft);
  confirmRemoval.mockRestore();
});
