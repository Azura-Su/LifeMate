# Sổ đóng hộ

## Mục tiêu

Ghi tiền một người đưa để nhờ thanh toán hộ, theo dõi từng lần nhận, đóng và trả lại tiền dư. Đây là tiền giữ hộ, nên không xuất hiện trong giao dịch, tổng thu, tổng chi, số còn lại hoặc biểu đồ tài chính cá nhân.

## Quy tắc

- Mỗi hồ sơ có người gửi, mục đích (ví dụ: điện nước tháng 10) và lịch sử các mục `received`, `paid`, `returned`.
- Tạo hồ sơ cần một khoản nhận ban đầu lớn hơn 0. Có thể thêm nhiều lần nhận hoặc thanh toán.
- Số còn giữ = tổng nhận − tổng đã đóng − tổng trả lại. Số này luôn không âm. Nếu hóa đơn lớn hơn số còn giữ, cần ghi nhận tiền A đưa thêm trước khi ghi khoản đóng.
- Mỗi mục có số tiền nguyên dương, ngày và nội dung tùy chọn. Cho phép sửa/xóa mục ghi nhầm nếu toàn bộ lịch sử sau sửa vẫn hợp lệ. Có thể sửa tên người gửi, mục đích hoặc xóa hồ sơ với xác nhận.
- Dữ liệu riêng theo UID. Mọi thay đổi đọc bản mới nhất trong Firestore transaction rồi kiểm tra số dư và phiên bản mục trước khi ghi. Khi offline, danh sách cache hiện ngay nhưng thao tác ghi yêu cầu kết nối; không hiện thay đổi chưa được server xác nhận. Không tự báo thất bại cho một transaction vẫn còn đang chạy.
- Sau khi ghi, tải lại toàn bộ danh sách trước khi báo đã đồng bộ. Nếu một hồ sơ trên cloud không hợp lệ, vẫn hiển thị các hồ sơ hợp lệ và báo sổ chưa đầy đủ. Cache trên thiết bị được mã hóa. Không tạo `FinanceTransaction` cho sổ này.

## Giao diện

- Tab `Đóng hộ` đứng sau `Cho vay` trong Tài chính. Đầu tab có tổng số đang giữ hộ và số hồ sơ, sau đó là thẻ theo từng hồ sơ.
- Thẻ có người gửi, mục đích, tổng nhận, tổng đóng, số còn giữ. Mở thẻ để xem riêng lịch sử gửi thêm và lịch sử đóng hộ; mỗi phần có nút thêm phù hợp. Khoản trả lại được ghi rõ trong lịch sử đóng hộ.
- Mỗi mục lịch sử có ngày, nội dung, số tiền và menu sửa/xóa. Form có số tiền và ngày cùng một hàng, nội dung ở dưới; tiền được định dạng theo hàng nghìn và đọc bằng chữ ngay khi nhập, ngày được chọn bằng lịch.
- Trạng thái trống hướng dẫn tạo khoản đầu tiên. Trạng thái mất mạng và lỗi lưu có lời giải thích, nút tải lại.

## Kỹ thuật và kiểm chứng

- React Native/TypeScript, React Native Firebase Firestore, cache mã hóa hiện có; không thêm dependency.
- Mã: `src/types`, `src/services/finance`, `src/screens/Finance`, `firebase/firestore.rules`. Giữ quy ước component, theme và xác thực UID của dự án.
- Kiểm chứng tĩnh bằng TypeScript, ESLint, Prettier và rà diff. Đối chiếu thủ công các ca: nhận 500.000 → đóng 320.000 → còn 180.000; trả lại 180.000 → còn 0; không thể đóng 200.000 khi chỉ còn 180.000; thu chi cá nhân không đổi.

## Giới hạn

- Sổ ghi lại việc thanh toán hộ, không thực hiện chuyển tiền hay thanh toán hóa đơn thật.
- Chỉ số tiền được nhập thủ công; không liên kết ngân hàng hoặc OCR hóa đơn.
