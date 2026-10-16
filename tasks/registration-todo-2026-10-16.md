# Checklist màn đăng ký LifeMate — 16/10/2026

## 1. Chính sách và đặc tả

- [x] Chốt tự đăng ký mở cho mọi email; không dùng lời mời hoặc danh sách cấp trước.
- [x] Firebase Console: Email/Password đang bật; Password policy ở chế độ Notify, tối thiểu 6 ký tự (biểu mẫu dùng ngưỡng 8); email cần xác nhận cho Ký ức chia sẻ.
- [x] Đã tạo và publish parameter Boolean `registration_enabled=false` trong project `baseapp-dd227` (Remote Config version 2); README ghi in-app default và cache/độ trễ.
- [x] Ghi hợp đồng lưu trữ Auth `uid/email/displayName`, không tự lưu mật khẩu/Firebase ID token trong app.
- **Kiểm chứng:** đối chiếu cấu hình Firebase và đặc tả với đường đăng nhập/rules hiện tại.
- **Phụ thuộc:** không có. **Phạm vi:** nhỏ, tài liệu/cấu hình.

## 2. Công tắc Remote Config

- [x] Cùng một đường khởi tạo Remote Config đọc `users` và `registration_enabled`; cờ vắng mặt là `false`, giá trị đã kích hoạt được giữ khi fetch lỗi.
- [x] Listener thời gian thực trong `useAppBootstrap` chỉ tồn tại khi chưa đăng nhập; `activate` xong đọc lại cả hai giá trị, hủy khi đăng nhập/unmount, bỏ kết quả muộn và xử lý lỗi.
- [x] `refresh()` đồng thời với listener không ghi đè giá trị mới; Login luôn dùng được khi cấu hình lỗi.
- **Kiểm chứng:** Jest dịch vụ/store/bootstrap: default false, cache true + fetch lỗi, bật/tắt, lỗi listener/activate, refresh đua nhau, hủy listener sau login.
- **Phụ thuộc:** 1. **File dự kiến:** `src/config/defaults.ts`, `src/services/firebase/remoteConfigService.ts`, `src/store/configStore.ts`, `src/hooks/useAppBootstrap.ts` và tests. **Phạm vi:** chia phần dữ liệu và lifecycle nếu vượt 5 file.

## 3. Dịch vụ và validation đăng ký

- [x] Email được chuẩn hóa, tên 1–60 ký tự hợp lệ, mật khẩu không bị trim, xác nhận phải khớp.
- [x] `createAccount` tạo Firebase Auth user; lỗi tạo được phân biệt với lỗi cập nhật tên/gửi xác nhận sau khi đã tạo.
- [x] Lỗi trùng email, mật khẩu yếu/chính sách mật khẩu, mạng và nhiều lần thử được xử lý rõ mà không lộ lỗi nội bộ.
- **Kiểm chứng:** Jest cho `src/utils/__tests__/auth.test.ts` và test dịch vụ Auth mới.
- **Phụ thuộc:** 1. **File dự kiến:** `src/services/firebase/authService.ts`, `src/utils/auth.ts`, 2 test. **Phạm vi:** trung bình.

## 4. Vòng đời phiên đăng ký

- [x] `AppNavigator` không chuyển khỏi màn đăng ký trước khi bước hoàn tất được xử lý, kể cả khi Auth observer nhận UID sớm.
- [x] Đồng bộ `displayName` mới vào `SessionUser` theo đúng UID; logout/đổi tài khoản hủy kết quả cũ.
- [x] Sau khi account đã tạo, lỗi bước phụ không gọi tạo tài khoản lần nữa; trạng thái chờ luôn được nhả.
- **Kiểm chứng:** Jest `src/navigation/__tests__/AppNavigator.test.tsx`, `src/hooks/__tests__/useAppBootstrap.test.ts` và test trạng thái đăng ký.
- **Phụ thuộc:** 2–3. **File dự kiến:** auth store, navigator, bootstrap, tests. **Phạm vi:** trung bình.

### Checkpoint A

- [x] TypeScript và các test Remote Config/Auth/navigation mục 2–4 đạt.
- [x] Rà không tự lưu/lộ mật khẩu, Firebase ID token hoặc dữ liệu UID khác.

## 5. Giao diện đăng ký

- [x] Khi cờ bật, từ Đăng nhập mở Đăng ký và quay lại được; khi cờ tắt, không có lối vào hoặc form mới. Đăng nhập luôn hiển thị.
- [x] Nếu cờ tắt khi form đang mở và chưa gửi, quay về Đăng nhập và xóa mật khẩu qua unmount; kiểm tra cờ ngay trước lời gọi tạo tài khoản.
- [x] Nếu cờ tắt sau khi lời gọi tạo tài khoản bắt đầu, vẫn nhận và xử lý kết quả; không thông báo nhầm là đã hủy thành công.
- [x] Không gửi lặp; báo lỗi biểu mẫu bằng tiếng Việt; hiện/ẩn mật khẩu; xóa mật khẩu sau khi tạo thành công.
- [x] Màn hoàn tất cho biết tài khoản đã được tạo và có thể tiếp tục dùng app.
- **Kiểm chứng:** Jest component/hook cho Register và Login, gồm cờ tắt lúc form mở/trước submit/đang tạo; kiểm tra iOS/Android bằng tay.
- **Phụ thuộc:** 2–4. **File dự kiến:** `src/screens/Register/`, `src/screens/Login/` và tests. **Phạm vi:** chia thành 2 PR/commit nhỏ nếu vượt 5 file.

## 6. Xác nhận email dùng chung

- [x] Dịch vụ Auth dùng chung gửi lại/kiểm tra email; Ký ức tiếp tục yêu cầu token có email đã xác nhận.
- [x] Lỗi gửi thư/lưu tên sau khi tạo có thao tác thử lại đúng bước hoặc tiếp tục; không báo “đăng ký thất bại”.
- [x] Xác nhận dùng `reload` và làm mới ID token; không nhầm thư đã nhận với email đã xác nhận.
- **Kiểm chứng:** Jest dịch vụ xác nhận email và test Ký ức liên quan.
- **Phụ thuộc:** 3–5. **File dự kiến:** dịch vụ Auth xác nhận, `memorySharing.ts`, màn hoàn tất, tests. **Phạm vi:** trung bình.

### Checkpoint B

- [ ] Tạo tài khoản mới → thấy tên ở Home → đăng xuất/đăng nhập lại cùng UID → dữ liệu riêng vẫn đúng.
- [ ] Tài khoản cũ tiếp tục đăng nhập; hai UID không thấy dữ liệu của nhau.
- [ ] Console đổi cờ `false` → `true` → `false`: UI đổi khi online; app mới chưa tải cờ ẩn Đăng ký; cache offline dùng trạng thái cũ như tài liệu.
- [x] Jest toàn bộ (78 suites/430 tests), `npm run typecheck`, `npm run lint`, `npm run bundle` đạt.
- [ ] Thử thiết bị/simulator với Firebase test; CoreSimulatorService không truy cập được trong môi trường hiện tại.

## 7. Tài liệu và điều kiện phát hành

- [x] README bỏ hướng dẫn “chỉ tài khoản được cấp” và mô tả `registration_enabled`, default/cache, tự đăng ký/lưu trữ/xác nhận email.
- [ ] Nếu mở công khai: chốt giới hạn sử dụng cloud, lộ trình xóa tài khoản và dữ liệu theo UID trước khi phát hành.
- **Kiểm chứng:** rà diff, đối chiếu README với UI và Firebase Console.
- **Phụ thuộc:** 1–6. **Phạm vi:** nhỏ.
