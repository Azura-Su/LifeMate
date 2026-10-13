# Kế hoạch: sổ đóng hộ

## Quyết định

Lưu hồ sơ đóng hộ trong `financeAccounts/{uid}/heldFunds/{id}`, tách hoàn toàn khỏi `transactions`. Mỗi hồ sơ chứa các mục lịch sử. Transaction Firestore bảo vệ thao tác sửa/xóa đồng thời; cache mã hóa chỉ để đọc khi offline. Giới hạn số mục trên một hồ sơ để không vượt giới hạn kích thước tài liệu.

## Thứ tự thực hiện

1. Định nghĩa kiểu, phép tính số dư và parse dữ liệu. Thêm rules riêng theo UID.
2. Thêm service đọc/cache và các thao tác tạo, sửa, xóa hồ sơ/mục lịch sử qua transaction.
3. Thêm tab Đóng hộ với tổng quan, thẻ, lịch sử và các form nhập/sửa; giữ thu chi hiện tại nguyên phép tính.
4. Rà các trường hợp vượt số dư, dữ liệu lỗi, đổi tài khoản, xung đột và trạng thái ngoại tuyến. Kiểm tra TypeScript/ESLint/định dạng; phát hành Firestore rules để tab dùng được.

## Rủi ro

- Thay đổi rules chưa phát hành sẽ khiến thao tác lưu bị từ chối: biên dịch và triển khai đúng project Firebase `baseapp-dd227`.
- Sửa khoản nhận có thể khiến các khoản đã đóng vượt tiền đang giữ: tính lại toàn lịch sử trong transaction và từ chối thay đổi.
- Hai thiết bị sửa cùng một mục: so sánh phiên bản mục trong transaction và yêu cầu tải lại nếu đã đổi.
- Dữ liệu đóng hộ lẫn vào báo cáo cá nhân: không ghi vào collection giao dịch; chỉ UI Đóng hộ đọc collection mới.
