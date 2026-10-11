# Danh sách chuẩn bị

## Mục tiêu

Thêm nơi tạo checklist dùng lại cho mua sắm, đi du lịch, về quê và các dịp khác. Người dùng cần ghi món/việc cần chuẩn bị, số lượng, tích hoàn tất và tiếp tục dùng được khi không có mạng.

## Thiết kế

- Mở màn **Danh sách chuẩn bị** từ menu bên Home, không thêm tab dưới.
- Màn danh sách có tiêu đề, nút tạo nhanh và ba mẫu bắt đầu: **Mua sắm**, **Đi du lịch**, **Về quê**; cũng có thể tạo danh sách trống.
- Mẫu du lịch và về quê khởi tạo vài mục gợi ý có thể sửa/xóa. Mẫu mua sắm để trống để người dùng tự nhập.
- Mỗi thẻ danh sách hiển thị tên, số mục đã xong/tổng số mục, thanh tiến độ và hành động **Dùng lại**. Dùng lại tạo bản mới, bỏ trạng thái đã tích và ngày gắn.
- Mở thẻ để xem checklist. Mỗi mục có ô tích, tên, số lượng tùy chọn và thao tác sửa/xóa. Thêm mục bằng form gọn gồm tên và số lượng tự do như “2 chai” hoặc “1 kg”.
- Tạo danh sách trống, đổi tên danh sách và nhập/sửa mục dùng popup có nút X ở góc trên. Màn chi tiết có nút quay lại.
- Mỗi danh sách có thể gắn một ngày dương lịch; chọn ngày ở chi tiết checklist, đổi hoặc bỏ ngày sau đó.
- Lịch Home đánh dấu ngày có checklist. Chọn ngày để xem danh sách, số mục hoàn thành và tiến độ; chạm một danh sách để mở đúng checklist.
- Giao diện dùng cùng nền kem, thẻ bo tròn, màu sắc và typography hiện tại; trạng thái rỗng hướng dẫn tạo danh sách đầu tiên.

## Quy tắc dữ liệu

- Mỗi danh sách có ID, tên, danh sách mục, thời điểm tạo/cập nhật.
- Ngày gắn lịch là trường tùy chọn `scheduledDateKey` theo định dạng `YYYY-MM-DD`; trường này nằm trong cùng kho mã hóa cục bộ và không đồng bộ cloud.
- Mỗi mục có ID, tên, số lượng dạng chuỗi tùy chọn và trạng thái hoàn tất.
- Dữ liệu lưu mã hóa cục bộ theo UID; thao tác đọc/ghi không phụ thuộc mạng. Đổi tài khoản phải xóa dữ liệu cũ khỏi giao diện trước khi tải dữ liệu của tài khoản mới.
- Bản đầu không đồng bộ cloud hoặc chia sẻ sang thiết bị khác. Mẫu gợi ý được ghi thành dữ liệu thực khi người dùng tạo danh sách từ mẫu.
- Giữ thứ tự danh sách và thứ tự mục; không tự xóa danh sách rỗng.

## Phạm vi

**Bao gồm:** tạo từ mẫu/trống, xem, đổi tên, thêm/sửa/xóa mục, tích/bỏ tích, xóa danh sách, dùng lại danh sách, lưu offline theo tài khoản.

**Không bao gồm:** đồng bộ cloud, chia sẻ với gia đình, nhắc giờ, địa điểm/cửa hàng, giá tiền hoặc tự động liên kết giao dịch Tài chính.

## Tiêu chí nghiệm thu

- Mở được màn từ menu bên; màn không xuất hiện như tab bottom.
- Có thể tạo danh sách trống và từ ba mẫu; tên/mục mẫu sửa được.
- Có thể thêm mục cùng số lượng, sửa, xóa, tích/bỏ tích; tiến độ cập nhật chính xác.
- Dùng lại tạo một danh sách độc lập, giữ tên/mục nhưng bỏ trạng thái đã tích.
- Danh sách còn sau khi đóng/mở app và dùng được hoàn toàn offline.
- Dữ liệu của UID khác không được hiển thị khi đổi tài khoản.
- Có thể gắn, đổi và bỏ ngày; lịch Home đánh dấu đúng ngày và hiển thị tiến độ mới nhất khi quay lại từ checklist.
- Kiểm thử storage, luồng màn, điều hướng; typecheck/lint và toàn bộ test suite đạt.
