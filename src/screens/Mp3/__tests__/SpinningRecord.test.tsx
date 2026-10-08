import { render } from '@testing-library/react-native';
import { SpinningRecord } from '../SpinningRecord';

it('renders an accessible record that can spin with the current playback state', () => {
  const view = render(<SpinningRecord playing />);

  expect(view.getByTestId('spinning-record').props.accessibilityLabel).toBe(
    'Đĩa đang phát',
  );
  expect(view.getByTestId('record-spin-marker')).toBeTruthy();
  expect(view.getByTestId('spinning-record').props.style.transform).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ rotate: expect.anything() }),
    ]),
  );

  view.rerender(<SpinningRecord playing={false} />);
  expect(view.getByTestId('spinning-record').props.accessibilityLabel).toBe(
    'Đĩa tạm dừng',
  );
});
