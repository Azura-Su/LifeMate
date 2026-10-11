# Kế hoạch: Danh sách chuẩn bị

Đặc tả và thiết kế: [SPEC-checklists.md](../SPEC-checklists.md).

## Trình tự

1. **Contract và storage cục bộ** — thêm model checklist, validate dữ liệu đã đọc, CRUD mã hóa theo UID, serialize ghi theo tài khoản; kiểm thử tạo/cập nhật/tích/xóa/dùng lại và cách ly UID.
2. **Màn checklist** — thêm danh sách, form tạo/đổi tên, chi tiết mục, số lượng, tiến độ, sửa/xóa/tích và bản dùng lại; kiểm thử luồng chính và trạng thái rỗng/busy/lỗi.
3. **Điều hướng từ drawer** — thêm mục “Danh sách chuẩn bị”, route ẩn khỏi bottom bar và callback từ Home; kiểm thử drawer mở được màn và quay lại Home.
4. **Hoàn thiện** — cập nhật tài liệu phạm vi, rà accessibility và kích thước màn nhỏ, chạy test, typecheck và lint.

## Rủi ro và quyết định

- Mất mạng: không ảnh hưởng vì chưa có backend cho module này; lưu cục bộ mã hóa theo cùng mẫu bảo vệ dữ liệu riêng tư hiện có.
- Đổi tài khoản: route phải chỉ render dữ liệu khi UID đã tải xong; khi logout/đổi UID không giữ checklist trước đó trong state.
- Nội dung mẫu chỉ là gợi ý ban đầu; mọi mục và số lượng đều có thể sửa/xóa.
- Không thêm quyền thiết bị, notification hoặc dependency mới.
