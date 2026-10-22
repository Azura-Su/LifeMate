# Checklist — Vào lại bàn và popup mã phòng

- [x] Giữ snapshot ván kết thúc gần nhất trong cache bộ nhớ và bộ nhớ mã hóa theo tài khoản; bỏ dữ liệu bài riêng trước khi lưu.
- [x] Khóa thao tác của cache và đặt loading tại nút `Sẵn sàng`; đổi sang dữ liệu server khi có.
- [x] Back từ preview cache xóa bàn/loading; rời phòng thật xong quay về bảng điểm.
- [x] Dùng popup mã phòng theo design system, gồm sao chép, xem luật và đóng.
- [x] Thêm regression tests cho rejoin với cache và popup.
- [x] Chạy test màn, typecheck, ESLint, Prettier và kiểm tra diff.
