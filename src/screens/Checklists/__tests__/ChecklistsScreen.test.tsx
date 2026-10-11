import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ChecklistsScreen } from '../ChecklistsScreen';
import { useAuthStore } from '../../../store/authStore';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);

beforeEach(async () => {
  await AsyncStorage.clear();
  useAuthStore.getState().setUser({
    uid: 'checklist-user',
    email: 'checklists@example.com',
    displayName: 'Asher',
  });
});

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <ChecklistsScreen
        navigation={{ navigate: jest.fn() } as never}
        route={{ key: 'checklists', name: 'Checklists' }}
      />
    </SafeAreaProvider>,
  );
}

it('creates a travel checklist, adds a quantity, and updates completion progress', async () => {
  renderScreen();

  fireEvent.press(
    screen.getByRole('button', { name: 'Tạo từ mẫu Đi du lịch' }),
  );
  expect(screen.getByLabelText('Tên danh sách').props.value).toBe('Đi du lịch');
  fireEvent.press(screen.getByRole('button', { name: 'Tạo danh sách' }));

  expect(await screen.findByText('Đi du lịch')).toBeTruthy();
  expect(screen.getByText('0/5 mục đã chuẩn bị')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Tên mục mới'), 'Máy ảnh');
  fireEvent.changeText(screen.getByLabelText('Số lượng mục mới'), '1 cái');
  fireEvent.press(screen.getByRole('button', { name: 'Thêm mục' }));
  expect(await screen.findByText('Máy ảnh')).toBeTruthy();
  expect(screen.getByText('1 cái')).toBeTruthy();

  fireEvent.press(
    screen.getByRole('checkbox', { name: 'Đánh dấu đã xong: Máy ảnh' }),
  );
  expect(await screen.findByText('1/6 mục đã chuẩn bị')).toBeTruthy();
});

it('keeps lists offline between screen visits and makes reusable unchecked copies', async () => {
  const view = renderScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Tạo từ mẫu Về quê' }));
  fireEvent.press(screen.getByRole('button', { name: 'Tạo danh sách' }));
  expect(await screen.findByText('Về quê')).toBeTruthy();
  fireEvent.press(
    screen.getByRole('checkbox', {
      name: 'Đánh dấu đã xong: Giấy tờ tùy thân',
    }),
  );

  view.unmount();
  renderScreen();
  expect(await screen.findByText('Về quê')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Mở danh sách Về quê' }));
  expect(
    screen.getByRole('checkbox', { name: 'Bỏ đánh dấu: Giấy tờ tùy thân' }),
  ).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Quay lại danh sách' }));
  fireEvent.press(screen.getByRole('button', { name: 'Dùng lại Về quê' }));

  expect(await screen.findByText('Về quê (bản mới)')).toBeTruthy();
  await waitFor(() =>
    expect(
      screen.getByRole('checkbox', {
        name: 'Đánh dấu đã xong: Giấy tờ tùy thân',
      }),
    ).toBeTruthy(),
  );
});

it('closes delete confirmation with X and deletes only after explicit action', async () => {
  renderScreen();

  fireEvent.press(screen.getByRole('button', { name: 'Tạo từ mẫu Mua sắm' }));
  fireEvent.press(screen.getByRole('button', { name: 'Tạo danh sách' }));
  expect(await screen.findByText('Thêm món cần chuẩn bị')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Tên mục mới'), 'Sữa');
  fireEvent.press(screen.getByRole('button', { name: 'Thêm mục' }));
  expect(await screen.findByText('Sữa')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Xóa mục Sữa' }));
  fireEvent.press(screen.getByRole('button', { name: 'Đóng' }));
  expect(screen.getByText('Sữa')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Xóa mục Sữa' }));
  fireEvent.press(screen.getByRole('button', { name: 'Xóa mục' }));
  await waitFor(() => expect(screen.queryByText('Sữa')).toBeNull());
  expect(screen.getByText('0/0 mục đã chuẩn bị')).toBeTruthy();
});

it('omits the empty-list placeholder and zero progress bar', async () => {
  renderScreen();

  fireEvent.press(screen.getByRole('button', { name: 'Tạo từ mẫu Mua sắm' }));
  fireEvent.press(screen.getByRole('button', { name: 'Tạo danh sách' }));
  expect(await screen.findByText('Thêm món cần chuẩn bị')).toBeTruthy();
  expect(screen.getByText('Các món trong danh sách')).toBeTruthy();
  expect(screen.queryByText(/Danh sách đang trống/)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Quay lại danh sách' }));

  expect(await screen.findByText('Chưa có mục · chạm để thêm')).toBeTruthy();
  expect(
    screen.queryByRole('progressbar', { name: 'Tiến độ Mua sắm' }),
  ).toBeNull();
});

it('clears the item validation message when returning to the checklist overview', async () => {
  renderScreen();

  fireEvent.press(screen.getByRole('button', { name: 'Tạo từ mẫu Mua sắm' }));
  fireEvent.press(screen.getByRole('button', { name: 'Tạo danh sách' }));
  expect(await screen.findByText('Thêm món cần chuẩn bị')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Thêm mục' }));
  expect(await screen.findByText('Nhập tên mục cần chuẩn bị.')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Quay lại danh sách' }));

  await waitFor(() =>
    expect(screen.queryByText('Nhập tên mục cần chuẩn bị.')).toBeNull(),
  );
});
