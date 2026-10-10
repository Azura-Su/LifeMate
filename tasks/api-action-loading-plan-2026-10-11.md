# Kế hoạch: Loading cho thao tác bất đồng bộ — 11/10/2026

## Mục tiêu

Cho người dùng thấy ngay khi thao tác tạo, sửa, xóa hoặc đồng bộ đang chờ API/dịch vụ hoàn tất; ngăn gửi lặp và giữ nguyên phản hồi lỗi hiện có.

## Quyết định giao diện

- Nút lưu biểu mẫu dùng spinner và trạng thái disabled hiện có.
- Thao tác trên danh sách hiển thị spinner tại đúng dòng/nút đang chờ.
- Tác vụ dài như audio giữ thanh trạng thái/tiến trình hiện có.
- Không thêm spinner cho cập nhật đồng bộ hoặc thao tác chỉ thay state cục bộ.

## Các lát cắt

1. **Ghi chú và lịch:** loading khi xóa ghi chú, hoàn thành/bỏ hoàn thành, xóa việc và thêm việc vào lịch thiết bị; chặn thao tác lặp tại dòng đang xử lý.
2. **Tài chính:** loading theo giao dịch khi xóa; giữ trạng thái lưu biểu mẫu và trạng thái cập nhật danh mục hiện có.
3. **Âm thanh và tài khoản:** rà các thao tác nhập, đổi tên, xóa, tải lên/tải xuống, playlist, bật thông báo và đăng xuất; thêm phản hồi tại chỗ nếu chưa có.
4. **Rà soát hoàn tất:** kiểm tra mọi mutation bất đồng bộ do người dùng khởi chạy, typecheck, lint và diff.

## Tiêu chí chấp nhận

- Mỗi thao tác API đang chờ có trạng thái tiến trình dễ nhận biết.
- Nút đang xử lý không nhận lần bấm trùng; thao tác không liên quan vẫn hoạt động khi an toàn.
- Spinner dừng khi thành công hoặc lỗi; lỗi vẫn được báo cho người dùng.
- Không thay đổi hành vi lưu local-only hoặc thêm dependency.
