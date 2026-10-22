# Tab Ký ức theo Remote Config users

## Kế hoạch

1. Dùng email tài khoản và danh sách `useConfigStore.users` đang được Firebase Remote Config kích hoạt. Chuẩn hóa khoảng trắng/chữ hoa thường bằng `normalizeEmail`; email rỗng hoặc danh sách rỗng không hiện tab.
2. Chỉ đăng ký route Memories khi email có trong danh sách. Khi danh sách hoặc tài khoản đổi, navigator tự cập nhật và gỡ màn Ký ức nếu đang mở. Các tab còn lại dùng số thứ tự accessibility chính xác cho ba hoặc bốn tab.
3. Giữ cơ chế cache/fetch Remote Config hiện tại: khi offline dùng danh sách đã kích hoạt; khi chưa có cấu hình dùng danh sách rỗng. Đây là điều kiện hiển thị tính năng trong app, không thay backend/rules hay xóa dữ liệu Ký ức.
4. Cập nhật SPEC và test navigation: có/không có email, email khác hoa thường/khoảng trắng, email null, danh sách trống, cấu hình thu hồi khi đang mở Ký ức, đổi tài khoản. Chạy test navigation, typecheck, lint file sửa và diff check.

## Checklist

- [x] Điều kiện hiển thị và số thứ tự tab.
- [x] Regression tests và SPEC.
- [x] Kiểm chứng và rà diff.

## Kết quả

- Navigator chỉ đăng ký Memories khi email có trong users; reactive theo email và store config. Ba tab còn lại có accessibility count đúng khi Memories bị gỡ.
- Navigation integration: 18 tests đạt, gồm email lạ/null/rỗng, danh sách rỗng, chuẩn hóa email, thêm/thu hồi cấu hình và đổi UID. Các luồng điều hướng/khóa/đăng xuất hiện có tiếp tục đạt.
- Typecheck, ESLint hai file TypeScript sửa và git diff --check đạt. Rà source cuối xác nhận dùng cơ chế Remote Config/cache hiện có, giữ các thay đổi working tree trước lượt này.
- Chưa thử trực tiếp trên thiết bị hoặc publish Remote Config; thay đổi cần app chạy JS mới. Không thay cơ chế fetch hiện tại (production có minimum fetch interval một giờ).
