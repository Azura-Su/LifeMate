# Chơi online theo Remote Config usergame

- Thêm parser JSON array email, chuẩn hóa hoa thường/khoảng trắng và bỏ trùng; mặc định rỗng, lỗi/offline giữ danh sách hợp lệ đã kích hoạt theo cơ chế users hiện có.
- Hook chung theo dõi email và gameUsers cho mode tab và navigator. Chỉ hiện Chơi online và đăng ký CardGames khi email nằm trong usergame; giữ cờ bật/tắt dịch vụ hiện có. Tính điểm và Ký ức có điều kiện riêng.
- Gỡ route khi danh sách/tài khoản đổi. Đây là điều kiện UI, không đổi backend hoặc dữ liệu phòng.

## Kiểm chứng

- Parser, Remote Config, config store, Home, CardScore, CardGames: 6 suite đạt, 135 tests.
- Navigation integration: 19 tests đạt, gồm rút email khỏi danh sách khi đang mở route online và quay về Home.
- Typecheck, ESLint file sửa và git diff --check đạt.
- Chưa thử trên thiết bị thật/publish Remote Config; app cần JS mới và nhận cấu hình đã kích hoạt (production giữ minimum fetch interval một giờ hiện tại).
