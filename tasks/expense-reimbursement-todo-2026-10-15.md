# Khoản chi có người trả lại — checklist triển khai

Tham chiếu [kế hoạch](expense-reimbursement-plan-2026-10-15.md). Phần mã và Firestore rules đã triển khai; chưa kiểm tra thao tác trên thiết bị thật.

- [x] **1. Dữ liệu và phép chiếu báo cáo.** Thêm phần người cần trả và lần nhận vào giao dịch chi; đọc dữ liệu cũ nguyên vẹn. Một hóa đơn 500.000 ₫, nhận lại 300.000 ₫ phải cho chi ròng 200.000 ₫, thu nhập 0 ₫; trả ở tháng sau ghi giảm chi ở tháng sau.
- [x] **2. Đồng bộ và Firestore rules.** Lưu lần nhận có ID ổn định; kiểm tra hạn mức từng người, ghi lặp và xung đột hai thiết bị. Không để dữ liệu của tài khoản khác xuất hiện, không để bản ghi cũ bị từ chối.
- [x] **3. Form khoản chi.** Tùy chọn người cần trả, thêm nhiều người, số tiền định dạng chuẩn và tổng `phần của tôi + cần trả lại = tổng đã chi`. Không cho tổng cần trả lại vượt số đã chi.
- [x] **4. Chi tiết và popup nhận lại.** Nhận từng phần, xem lịch sử, sửa/xóa và xử lý xóa khoản gốc có xác nhận. Số còn chờ không âm; khoản nhận không nằm trong Thu nhập.
- [x] **5. Tất cả báo cáo và kiểm tra trước phát hành.** Đối chiếu Thu chi, Chi tiêu, danh mục, Home, tìm kiếm, tháng/năm, kỳ có chi âm, offline/online và dữ liệu cũ. Chỉ phát hành rules sau khi app và rules đã tương thích.

Ghi chú: TypeScript, lint trên các tệp thay đổi và xuất bundle iOS đã thành công. Firestore rules đã biên dịch và phát hành riêng lên `baseapp-dd227`. Chưa kiểm tra tương tác trên thiết bị hoặc chu trình offline/online thực tế.
