# Vào lại bàn và popup mã phòng — cập nhật 20/10/2026

## Thiết kế lại tạo/vào phòng — 27/10/2026

- [ ] Đưa hai lựa chọn Tạo phòng mới / Vào phòng có sẵn lên đầu danh mục.
  Tạo phòng chọn game rồi cấu hình; vào phòng chỉ nhập một mã chung, server
  nhận diện game và trả luật thật của phòng. Bỏ form join lặp trong từng game.
- [ ] Giữ draft khi đổi chế độ, chặn thao tác lặp khi busy/pending/loading,
  giữ nguyên rejoin/cache/takeover và các hàng rào UID/phiên/phòng hiện có.
- [ ] Regression cho vào phòng không chọn game, nhập mã chuẩn hóa, mọi game
  dùng cùng join, tạo từng game giữ đúng config và quay lại draft không mất.
- [ ] Tới trắng miền Nam: hiển thị ba điều kiện đã hỗ trợ (sảnh rồng, tứ quý 2,
  sáu đôi) trong cấu hình trước tạo. Cách tính tiền đang hỏi người dùng; không
  đổi engine/payout khi chưa chốt. Kế hoạch phần cấu hình tiền nối tiếp tại
  south-config-plan-2026-10-23.md.
- [ ] Reviewer duyệt kế hoạch phần contract/điểm trước sửa, rà diff cuối;
  Jest liên quan, functions nếu đổi backend, typecheck/lint và native/bundle.
  Không dependency hoặc deploy trong lượt này. Bảo toàn diff có sẵn.

## Mục tiêu

Khi vào lại phòng đang có snapshot kết thúc trong phiên hiện tại, giữ bàn kết quả làm nền và đặt trạng thái tải tại nút `Sẵn sàng`; không thay bằng trang loading riêng. Snapshot cũ chỉ để hiển thị, khóa mọi thao tác đến khi server trả phòng mới. Nếu không có snapshot cục bộ hoặc server từ chối vào phòng thì dùng trạng thái lỗi/form hiện có. Khi bấm back ở bàn cache thì xóa preview và về bảng điểm; khi xác nhận rời một phòng thật thì gửi lệnh rời, sau đó điều hướng về bảng điểm. Nút `?` mở hộp thoại theo design system thay native alert, hiển thị mã, sao chép mã, xem luật và đóng.

## Kế hoạch

1. Lưu snapshot ván đã kết thúc trong cache bộ nhớ và bộ nhớ mã hóa theo tài khoản; loại bỏ bài riêng và chỉ dùng khi mã phòng khớp. Cache bộ nhớ giúp mở lại màn ngay trong cùng phiên; khi khởi động ứng dụng mới thì đọc cache mã hóa. Dùng snapshot server làm nguồn chuẩn ngay khi nhận được.
2. Khi hiện bàn cache, khóa action và dùng `busy` ở nút `Sẵn sàng`; khi snapshot server đến thì bỏ trạng thái tải và đồng bộ bàn.
3. Thay native alert mã phòng bằng `DialogModal` đồng bộ kiểu app, gồm mã dễ đọc, sao chép, xem luật và đóng.
4. Back từ cache phải xóa preview ngay; xác nhận rời phòng thật phải kết thúc ở bảng điểm thay vì giữ người dùng trên nút loading.
5. Bổ sung regression tests cho rejoin có/không có cache, rời phòng, trạng thái action và popup; chạy test màn CardGames, typecheck, ESLint, Prettier và `git diff --check`.

## Tiêu chí chấp nhận

- Có cache đúng phòng thì vào lại thấy bàn kết quả ngay, nút `Sẵn sàng` hiển thị loading và không gửi thao tác trên dữ liệu cũ; cache vẫn còn sau khi màn bị tạo lại hoặc ứng dụng khởi động lại.
- Snapshot mới của server thay cache và khôi phục action phù hợp; lỗi rejoin bỏ trạng thái chờ.
- Back từ preview cache bỏ bàn/loading ngay; xác nhận rời phòng thật sẽ quay về bảng điểm sau khi lệnh leave hoàn tất.
- Không có cache thì giữ fallback tải hiện có, không dựng dữ liệu phòng giả.
- Popup `?` gọn, thống nhất giao diện, hiển thị mã và các nút sao chép/xem luật/đóng hoạt động.
