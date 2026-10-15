# Tìm kiếm dùng chung trong Tài chính — 15/10/2026

## Phạm vi và bố cục

- Thu nhập, Chi tiêu, Cho vay và Đóng hộ dùng cùng một thanh tìm kiếm đặt ở đầu danh sách. Mặc định chỉ hiện tiêu đề, số khoản và icon tìm; chạm icon mới mở ô nhập ngay dưới tiêu đề. Nút × đóng và xóa từ khóa. Tab Thu chi không có tìm kiếm theo yêu cầu trước.
- Tìm kiếm lọc dữ liệu đang hiển thị: Thu nhập/Chi tiêu theo kỳ và nguồn thu đã chọn; Cho vay theo trạng thái đang chọn; Đóng hộ theo sổ hiện có. Tổng tiền kỳ/sổ vẫn phản ánh toàn bộ phạm vi đang xem, không thay đổi theo từ khóa.
- Tìm theo văn bản không phân biệt dấu/chữ hoa; số tiền nhận cả chuỗi số và định dạng có phân cách. Không gọi đồng bộ khi gõ.

## Việc cần làm

1. Tạo thanh tìm kiếm dùng chung gồm tiêu đề, số kết quả, nút mở và ô nhập có nút đóng; giữ kích thước chạm, nhãn đọc màn hình và bàn phím phù hợp.
2. Đưa thanh này vào báo cáo Thu nhập/Chi tiêu tại vùng danh sách, bỏ ô tìm kiếm nằm giữa bộ lọc và tổng kết. Kết quả và trạng thái rỗng dùng cùng thứ tự/nhóm giao dịch hiện tại.
3. Dùng thanh đó cho Cho vay và Đóng hộ; lọc tên, nội dung/ghi chú và số tiền trong phạm vi tab. Trạng thái không có dữ liệu khác với không có kết quả.
4. Rà bố cục trên máy ảo ở trạng thái đóng/mở, có/không kết quả và các tab; kiểm tra TypeScript, lint, định dạng.

## Tiêu chí hoàn thành

- Cả bốn danh sách có cùng cách mở, nhập, xóa và đóng tìm kiếm; tab Thu chi giữ nguyên.
- Lọc không đổi dữ liệu hay tổng tiền, không khởi tạo yêu cầu đồng bộ.
- Khi không có kết quả, người dùng thấy thông báo rõ và có thể xóa từ khóa để quay lại danh sách.

## Kết quả

Đã hoàn thành bốn việc trên. Trên iPhone Simulator đã kiểm tra bốn tab có tìm kiếm, mở/đóng ô nhập, tìm tên không dấu và trạng thái không có kết quả; tab Thu chi không hiện tìm kiếm. TypeScript, ESLint, Prettier và `git diff --check` đều đạt. Chưa chạy bộ kiểm thử tự động trong lượt này.
