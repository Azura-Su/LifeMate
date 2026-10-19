# Avatar editor — 17/10/2026

## Thay đổi

- Profile camera badge22/icon12, avatar64 vẫn là vùng chạm. Yêu cầu bổ sung: spinner ngay khi chạm -> onShow reset; pick/crop tiếp tục spinner trong cùng badge, đóng sớm reset, accessibility busy và khóa double-tap. Mở sheet có Chỉnh sửa ảnh hiện tại, Chọn ảnh từ thư viện; chưa có avatar riêng thì không cho chỉnh ảnh mặc định.
- AvatarCropPreview hiển thị source local, khung vuông, PanResponder kéo/clamp, zoom1–3x qua slider/±, reset, tác vụ trợ năng dịch ảnh và hủy/xác nhận. Hình học dùng chung với export vùng cắt để preview khớp source pixels.
- Hook chọn ảnh không native-autocrop nữa; ảnh thư viện vào cropSource. Edit dùng draft hiện tại hoặc signed URL mới qua readAvatar, native download cache riêng có timeout20s/cancel/cap512KiB. Crop source được dọn riêng với draft xuất ra. UID/generation guards bỏ qua kết quả cũ sau hủy/unmount/đổi tài khoản.
- Xác nhận crop tạo JPEG384x384<=512KiB; chỉ Profile Save upload qua service cũ. Không đổi backend/quyền/cloud schema/dependency. Sheet đóng xong mới mở iOS picker, Android đợi300ms theo pattern hiện có.
- Review độc lập phát hiện race cancel khi xóa prior draft. Regression test tái hiện fail trước fix; hiện swap draft mới đồng bộ rồi mới dọn prior URI. Reviewer xác nhận không còn finding.

## Kiểm chứng

- Final Jest: 95 suites, 527 tests; focused crop/hook/sheet/loading21 tests. Kết quả final logs kiểm tra ở cuối task.
- TypeScript, ESLint file thay đổi, git diff --check đạt.
- Final Expo export iOS/Android đạt.
- iOS26.3 Simulator: mở ảnh hiện tại từ server vào crop preview, zoom±, tác vụ trợ năng dịch ảnh, Dùng ảnh tạo local preview thành công; library mở native PHPicker sau sheet dismiss, chọn ảnh hoa vào crop preview thành công. Không bấm Lưu thay đổi/không upload ảnh thử lên tài khoản thật.
- Gesture logic có test gọi callbacks PanResponder (drag quá biên -> đúng source rect); thao tác kéo qua automation chưa có tín hiệu xác nhận chắc chắn, không khẳng định đã kiểm chứng gesture tay trên Android. Android runtime chưa chạy; bundle đã xuất thành công.
- Ảnh minh họa /tmp/lifemate-avatar-crop.jpg. Không commit/push; giữ các thay đổi khác trong workspace.

## Cách dùng và giới hạn

Chạm avatar -> chỉnh ảnh hiện tại hoặc chọn thư viện -> kéo/zoom -> Dùng ảnh -> Lưu thay đổi. Hủy giữ preview cũ. Avatar đã lưu chỉ có bản crop384, không thể khôi phục phần nguồn đã bỏ; chọn lại ảnh thư viện để lấy lại phần đó.
