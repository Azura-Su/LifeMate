import {
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react-native';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { CardScoreAuditDialog } from '../CardScoreAuditDialog';
import { gameRequest } from '../../../services/cardGames/gameApi';
import { useAuthStore } from '../../../store/authStore';
import type { CardScoreMatch } from '../../../types/cardScore';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('../../../services/firebase/remoteConfigService', () => ({}));
jest.mock('../../../services/cardGames/gameApi', () => ({
  gameRequest: jest.fn(),
}));
jest.mock('../../../services/cardGames/gameDeviceSession', () => ({
  getGameDeviceSessionId: jest.fn(async () => 'session'),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 })),
}));

const system = {
  id: 'system',
  at: 1,
  actorUid: null,
  actorName: 'Hệ thống',
  changes: [{ kind: 'table-delete' as const }],
};
const owner = {
  id: 'owner',
  at: 2,
  actorUid: 'former-owner',
  actorName: 'Chủ phòng trước',
  changes: [{ kind: 'table-restore' as const }],
};
const match: CardScoreMatch = {
  id: 'table',
  title: 'Bàn thử',
  players: [],
  seatOrder: [],
  dealerPlayerId: '',
  rounds: [],
  status: 'active',
  createdAt: 1,
  updatedAt: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ user: { uid: 'member' } as never, sessionEpoch: 1 });
});

it('hides system entries while retaining previous owners and a human named Hệ thống', () => {
  const audit = [
    system,
    owner,
    { ...owner, id: 'named-system', actorName: 'Hệ thống' },
  ];
  const view = render(
    <CardScoreAuditDialog
      uid="member"
      epoch={1}
      match={{ ...match, audit }}
      onClose={jest.fn()}
    />,
  );
  expect(view.queryByText('Đã xóa bảng điểm')).toBeNull();
  expect(view.getByText('Chủ phòng trước')).toBeTruthy();
  expect(view.getAllByText('Hệ thống')).toHaveLength(1);
  expect(audit).toHaveLength(3);
});

it.each([320, 844])(
  'bounds the scroll viewport at height %s and keeps close outside it',
  (height) => {
    jest
      .mocked(useWindowDimensions)
      .mockReturnValue({ width: 956, height, scale: 1, fontScale: 1 });
    const view = render(
      <CardScoreAuditDialog
        uid="member"
        epoch={1}
        match={{
          ...match,
          audit: Array.from({ length: 40 }, (_, i) => ({
            ...owner,
            id: String(i),
          })),
        }}
        onClose={jest.fn()}
      />,
    );
    const scroll = view.getByTestId('score-audit-scroll');
    expect(StyleSheet.flatten(scroll.props.style)).toMatchObject({
      flex: 1,
      minHeight: 0,
    });
    expect(
      StyleSheet.flatten(view.getByTestId('dialog-content').props.style).height,
    ).toBe(Math.min(height * 0.85, 640));
    expect(
      within(scroll).queryByRole('button', { name: 'Đóng lịch sử sửa/xóa' }),
    ).toBeNull();
    expect(
      view.getByRole('button', { name: 'Đóng lịch sử sửa/xóa' }),
    ).toBeTruthy();
  },
);

it('preserves pagination through a system-only page and shows owner events from the next page', async () => {
  jest
    .mocked(gameRequest)
    .mockResolvedValueOnce({ events: [system], nextBefore: 30 } as never)
    .mockResolvedValueOnce({ events: [owner], nextBefore: null } as never);
  const view = render(
    <CardScoreAuditDialog
      uid="member"
      epoch={1}
      match={{ ...match, sharedVersion: 1 }}
      onClose={jest.fn()}
    />,
  );
  await waitFor(() =>
    expect(view.getByText('Chưa có chỉnh sửa trong phần đã tải')).toBeTruthy(),
  );
  expect(view.queryByText('Hệ thống')).toBeNull();
  fireEvent.press(view.getByRole('button', { name: 'Xem thay đổi trước' }));
  await waitFor(() => expect(view.getByText('Chủ phòng trước')).toBeTruthy());
  expect(gameRequest).toHaveBeenLastCalledWith(
    'member',
    expect.objectContaining({ before: 30 }),
    expect.any(AbortSignal),
  );
  expect(view.queryByText('Hệ thống')).toBeNull();
});
