import { Button } from '../../../components/Button';
import { StrictMode } from 'react';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Modal, Platform } from 'react-native';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { HeldMoneyLedger } from '../HeldMoneyLedger';
import type { useHeldMoneyLedger } from '../../../hooks/useHeldMoneyLedger';
import type { HeldMoneyRecord } from '../../../types/heldMoney';

jest.mock('../../../services/finance/heldMoneyStorage', () => ({
  newHeldMoneyId: () => 'new-id',
}));
jest.mock('@react-native-community/datetimepicker', () => ({
  DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
}));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
const record: HeldMoneyRecord = {
  id: 'one',
  ownerId: 'alice',
  senderName: 'An',
  purpose: 'Học phí',
  createdAt: 100,
  updatedAt: 100,
  entries: [
    {
      id: 'entry',
      kind: 'received',
      amount: 100000,
      occurredAt: 100,
      note: '',
    },
  ],
};
function model(): ReturnType<typeof useHeldMoneyLedger> {
  return {
    records: [record],
    loading: false,
    busy: false,
    synced: true,
    error: null,
    load: jest.fn(),
    create: jest.fn(),
    editDetails: jest.fn(),
    addEntry: jest.fn(),
    editEntry: jest.fn(),
    removeRecord: jest.fn(),
    removeEntry: jest.fn(),
  };
}
it.each(['form', 'delete', 'entry', 'menu'])(
  'hides %s when Finance locks and does not reopen it on unlock',
  (kind) => {
    const ledger = model();
    const view = render(
      <HeldMoneyLedger
        uid="alice"
        ledger={ledger}
        addRequestId={0}
        suspended={false}
      />,
    );
    if (kind === 'form')
      fireEvent.press(
        screen.getByRole('button', {
          name: 'Sửa thông tin khoản đóng hộ của An',
        }),
      );
    else if (kind === 'delete')
      fireEvent.press(
        screen.getByRole('button', {
          name: 'Xóa khoản đóng hộ Học phí của An',
        }),
      );
    else {
      fireEvent.press(
        screen.getByRole('button', { name: 'Mở khoản đóng hộ Học phí của An' }),
      );
      if (kind === 'entry')
        fireEvent.press(
          screen.getByRole('button', { name: 'Ghi nhận tiền An gửi thêm' }),
        );
      else
        fireEvent.press(
          screen.getAllByRole('button', { name: /Tùy chọn mục Đã nhận/ })[0],
        );
    }
    expect(
      view.UNSAFE_getAllByType(Modal).filter(({ props }) => props.visible),
    ).toHaveLength(1);
    const savedConfirm =
      kind === 'delete'
        ? view
            .UNSAFE_getAllByType(Button)
            .find(({ props }) => props.title === 'Xác nhận xóa')!.props.onPress
        : null;
    view.rerender(
      <HeldMoneyLedger
        uid="alice"
        ledger={ledger}
        addRequestId={0}
        suspended
      />,
    );
    expect(screen.queryByRole('button', { name: 'Xác nhận xóa' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Lưu/ })).toBeNull();
    expect(screen.queryByRole('header', { name: 'Mục lịch sử' })).toBeNull();
    view.rerender(
      <HeldMoneyLedger
        uid="alice"
        ledger={ledger}
        addRequestId={0}
        suspended={false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Xác nhận xóa' })).toBeNull();
    expect(
      view.UNSAFE_getAllByType(Modal).filter(({ props }) => props.visible),
    ).toHaveLength(0);
    savedConfirm?.();
    expect(ledger.removeRecord).not.toHaveBeenCalled();
  },
);

it('dismisses the native Android date picker when locked', () => {
  const os = Platform.OS;
  Object.defineProperty(Platform, 'OS', {
    value: 'android',
    configurable: true,
  });
  try {
    const ledger = model();
    const view = render(
      <HeldMoneyLedger uid="alice" ledger={ledger} addRequestId={0} />,
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Mở khoản đóng hộ Học phí của An' }),
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Ghi nhận tiền An gửi thêm' }),
    );
    fireEvent.press(screen.getByRole('button', { name: /^Ngày nhận / }));
    expect(DateTimePickerAndroid.open).toHaveBeenCalled();
    view.rerender(
      <HeldMoneyLedger
        uid="alice"
        ledger={ledger}
        addRequestId={0}
        suspended
      />,
    );
    expect(DateTimePickerAndroid.dismiss).toHaveBeenCalledWith('date');
  } finally {
    Object.defineProperty(Platform, 'OS', { value: os });
  }
});

it('rejects old confirmations after owner changes or component unmounts', () => {
  const ledger = model();
  const view = render(
    <HeldMoneyLedger uid="alice" ledger={ledger} addRequestId={0} />,
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Xóa khoản đóng hộ Học phí của An' }),
  );
  const confirm = view
    .UNSAFE_getAllByType(Button)
    .find(({ props }) => props.title === 'Xác nhận xóa')!.props.onPress;
  view.rerender(<HeldMoneyLedger uid="bob" ledger={ledger} addRequestId={0} />);
  confirm();
  view.unmount();
  confirm();
  expect(ledger.removeRecord).not.toHaveBeenCalled();
});

it('keeps delete errors visible and supports retry under StrictMode', async () => {
  const ledger = model();
  jest
    .mocked(ledger.removeRecord)
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValue(undefined);
  render(
    <StrictMode>
      <HeldMoneyLedger uid="alice" ledger={ledger} addRequestId={0} />
    </StrictMode>,
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Xóa khoản đóng hộ Học phí của An' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Xác nhận xóa' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline');
  fireEvent.press(screen.getByRole('button', { name: 'Xác nhận xóa' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Xác nhận xóa' })).toBeNull(),
  );
  expect(ledger.removeRecord).toHaveBeenCalledTimes(2);
});
