# Khóa Tài chính bằng xác thực thiết bị

## Thiết kế và phạm vi

- Công tắc trong Cài đặt, mặc định tắt; bật/tắt phải xác thực bằng hệ điều hành. iPhone dùng Face ID/Touch ID, Android dùng sinh trắc học mạnh; cho phép mật mã thiết bị khi hệ điều hành cung cấp fallback.
- Lưu lựa chọn riêng cho Firebase UID trên thiết bị bằng SecureStore. Trạng thái mở khóa dùng chung trong bộ nhớ cho phiên app đang ở foreground, không lưu bền.
- Khi bật khóa, chỉ tab Tài chính cần xác thực. Mở app hoặc quay từ `background` sang `active` ở tab khác không bật Face ID; tab Tài chính sẽ yêu cầu xác thực khi được mở. Nếu app quay lại foreground ngay tại tab Tài chính thì màn này xác thực lại một lần. Chuyển tab trong cùng phiên đã mở khóa không khóa lại. iOS `inactive` do prompt Face ID không hết hạn phiên. Hủy prompt giữ dữ liệu khóa và cho phép thử lại trong tab Tài chính.
- Khi xuống background, hết hạn phiên. Khi app inactive hoặc phiên hết hạn, màn khóa phủ lên tab Tài chính; dữ liệu đã mở trong phiên được giữ phía sau (không nhận chạm, ẩn với trình đọc màn hình, form đang mở tạm ẩn) để mở khóa lại không phải tải lại. Chỉ background mới vô hiệu hóa phiên hoặc prompt còn chờ.
- Khi khóa đang bật và tab Tài chính đang mở khóa, Android chặn chụp/quay màn hình bằng `expo-screen-capture` (`FLAG_SECURE`, ảnh xem trước trong danh sách app gần đây cũng trống). iOS không dùng cơ chế này vì cách Expo gắn cửa sổ vào ô nhập bảo mật làm màn hình đen khi mở khóa; iOS dựa vào lớp che khi app inactive.
- Home không hiển thị số liệu tài chính (cập nhật 09/10/2026), nên không có đường xem số tiền ngoài tab Tài chính.
- Lỗi đọc thiết lập bảo mật, hủy/sai xác thực, đổi UID trong khi prompt còn chờ đều không mở được dữ liệu. Không có đường bỏ qua trong màn khóa.

Đây là khóa giao diện trên thiết bị. Firebase Auth/rules vẫn kiểm soát dữ liệu cloud; không thay đổi schema, không thu thập sinh trắc học, không mã hóa lại cache tài chính. Thiết lập không đồng bộ giữa các thiết bị.

## Các bước thực hiện

1. Thêm Expo LocalAuthentication/SecureStore đúng SDK 55 và cấu hình mô tả Face ID.
2. Store giữ một phiên tài chính theo UID, chỉ hết hạn tại background/tài khoản mới; kết quả Face ID cũ không thể mở phiên mới.
3. Khóa phiên khi app vào background; chỉ gọi Face ID khi màn Tài chính đang được chọn và app ở foreground. Tab blur không khóa phiên; Home không gọi hoặc tái sử dụng Face ID.
4. Công tắc Cài đặt vẫn xác thực khi bật/tắt; gate tab chỉ hiện dữ liệu trong phiên hợp lệ.
5. Đối chiếu đường startup, hủy prompt, nhiều lần chuyển tab, background/resume và account switch.

Nguồn API: [Expo LocalAuthentication SDK 55](https://docs.expo.dev/versions/v55.0.0/sdk/local-authentication/), [Expo SecureStore SDK 55](https://docs.expo.dev/versions/v55.0.0/sdk/securestore/).

## Kiểm chứng

- Review ban đầu tìm thấy hai lỗi: khóa ngay ở Finance blur và xóa trạng thái Home eye khi Face ID làm iOS chuyển tạm sang inactive. Các kết quả 17 tests bên dưới thuộc chính sách cũ, không xác nhận sửa đổi mới.
- Regression cũ: 4 suites / 17 tests pass, gồm hủy/sai, đổi UID, kết quả prompt sau blur/background, bật/tắt, lỗi SecureStore, Home và iOS inactive trong prompt.
- Lượt sửa chính sách phiên dùng chung này cập nhật các regression liên quan nhưng chưa chạy Jest, TypeScript, lint hoặc build.
- TypeScript pass; lint các file khóa pass. Lint toàn workspace còn 4 cảnh báo trong các thay đổi Ghi chú/Công việc/Tài chính đang phát triển song song.
- Hermes Android/iOS export pass; native Android Debug arm64 và native iOS Debug Simulator arm64 build pass.
- Lần full Jest gần nhất: 45 suites / 198 tests pass, 1 suite MP3 chưa chạy được vì mock AsyncStorage cho `audioLearningPreferences` của thay đổi song song. Không coi full suite là xanh.
- Đã cài và chạy bản native mới trên iPhone 17 Pro Max / iOS 26.3 Simulator; app vào màn Đăng nhập. Simulator hiện không có phiên đăng nhập nên chưa thử công tắc/prompt với tài khoản thật. Face ID vật lý và Android sinh trắc học chưa được thử trực tiếp; các regression dùng native mocks.
- Regression mới xác nhận Home không bật Face ID khi khởi động hoặc quay lại từ nền, mở Tài chính thì xác thực, và quay lại từ nền ngay tại Tài chính thì xác thực lại. Full Jest: 58 suites / 257 tests pass; TypeScript, ESLint và `git diff --check` pass.
- Runtime phát hiện module Calendar của thay đổi song song thiếu mô tả quyền iOS, gây fatal ngay lúc khởi tạo. Bổ sung bốn usage-description keys vào app config, prebuild/build/cài lại và xác nhận app khởi động được; không yêu cầu hoặc cấp quyền Lịch trong kiểm thử này.
- Ổ hệ thống thiếu dung lượng khi cài app: chuyển cache Jest/Metro sinh ra trong kiểm thử sang `.build/finance-faceid-cache-backup` trên ổ workspace; bản cài Simulator được strip ký hiệu debug cục bộ, giữ bản build gốc. Không xóa dữ liệu ứng dụng.

Native module mới yêu cầu build/cài lại app, không chỉ reload JavaScript. Nhật ký kiểm chứng ở `.build/finance-faceid-*` (không commit).
