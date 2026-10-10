# Kế hoạch tích hợp lịch vào Home

## Mục tiêu

Giữ Home gọn, đưa lịch âm–dương, các dịp lễ/Tết, ghi chú theo ngày và việc vào bottom sheet riêng. Hai thẻ Home “Lịch” và “Việc” mở trực tiếp nội dung tương ứng trong sheet.

## Bố cục dự kiến

1. Giữ header chào/tên và nút menu hiện tại.
2. Home hiển thị hai thẻ “Lịch” và “Việc” đặt cạnh nhau; lịch tháng không chiếm chỗ trên màn chính.
3. Mỗi thẻ mở bottom sheet vào thẳng phần tương ứng; không lặp lại bộ chọn Lịch/Việc bên trong sheet.
4. Phần Lịch hiển thị tháng:
   - Tiêu đề tháng/năm và nút lùi, tiến, về hôm nay.
   - Lưới tuần bắt đầu từ Chủ nhật như ảnh tham khảo; mỗi ô ghi ngày dương lớn, ngày âm nhỏ.
   - Ngày hôm nay, ngày đang chọn, ngày có lễ và ngày có ghi chú được phân biệt; ngày lễ/ghi chú dùng dấu chấm nhỏ, không nhồi tên dài vào ô.
5. Dưới lưới, hiển thị ngày chọn và tên lễ nếu có. Nếu có ghi chú, hiện một ô xem trước chỉ có tiêu đề; chạm vào mở popup đọc toàn bộ và sửa ghi chú.
6. ~~Giữ tổng quan Tài chính trên Home~~ — đã bỏ theo quyết định ngày 09/10/2026; số liệu tài chính chỉ còn trong tab Tài chính.

## Quy tắc dữ liệu

- Ngày lưu dưới dạng khóa `YYYY-MM-DD`; ngày âm tính theo múi giờ Việt Nam UTC+7.
- Dùng thuật toán chuyển lịch âm Việt Nam dựa trên sóc và kinh độ Mặt Trời, không dùng lịch âm Trung Quốc hoặc phép lệch ngày cố định.
- Lễ/Tết cố định theo dương lịch và các dịp truyền thống cố định theo âm lịch được tính từ cùng bộ chuyển đổi. Phân biệt ngày lễ theo luật với ngày lễ hội truyền thống bằng nhãn.
- Ghi chú theo ngày lưu trong kho ghi chú tài khoản hiện có với mã `calendar-day-YYYY-MM-DD-<id>`; các ghi chú cũ có mã `calendar-day-YYYY-MM-DD` vẫn được nhận diện. Cách này cho phép nhiều ghi chú trong ngày mà không đổi schema, mã hóa cache, hàng đợi offline, đồng bộ Firestore hoặc quy tắc cloud. Màn Ghi chú chung ẩn các bản ghi gắn ngày để không làm lẫn với ghi chú tự do.

## Công việc và tiêu chí nghiệm thu

### 1. Lịch âm–dương và ngày lễ

- [x] Viết hàm chuyển đổi dương–âm/âm–dương có timezone UTC+7 và kiểm thử các mốc đã biết (Tết, Giỗ Tổ, ngày đầu/cuối tháng nhuận).
- [x] Sinh lưới tháng có đủ ngày đệm; tuần bắt đầu Chủ nhật theo ảnh tham khảo; chọn được ngày ngoài tháng đang xem.
- [x] Đánh dấu Tết Dương lịch, Tết Âm lịch, Giỗ Tổ Hùng Vương, 30/4, 1/5, Quốc khánh và Trung thu; phân biệt nghỉ lễ chính thức với ngày hội truyền thống.

### 2. Ghi chú ngày và ngày việc

- [x] Tái sử dụng lưu trữ ghi chú hiện tại; ghi chú theo ngày vẫn hoạt động offline và được đưa vào lần đồng bộ kế tiếp.
- [x] Có thể mở/chọn ngày, xem tiêu đề ghi chú, mở popup đọc nội dung đầy đủ, tạo/sửa tiêu đề và nội dung.
- [x] Mỗi ngày chứa được nhiều ghi chú; chạm một tiêu đề chỉ mở nội dung của ghi chú đó.
- [x] Không hiện ghi chú ngày trong danh sách ghi chú tự do.
- [x] Sheet Việc hiện việc của hôm nay và giữ các thao tác việc hiện có (thêm, sửa, hoàn tất, nhắc).

### 3. Bố cục Home và xác minh

- [x] Home giữ hai thẻ mở Lịch/Việc cạnh nhau (thẻ Tài chính đã bỏ); mỗi thẻ mở đúng nội dung trong bottom sheet, không có bộ chọn trùng lặp.
- [x] Giao diện sheet cuộn được trên iPhone nhỏ; không chồng lấn thanh tab hoặc menu.
- [x] Khóa và trạng thái khôi phục của Tài chính giữ nguyên trong tab Tài chính.
- [x] Chạy test lịch, ghi chú, Home; chạy typecheck và lint phù hợp.

## Nguồn và giới hạn phạm vi

- Danh sách ngày nghỉ chính thức theo Điều 112 Bộ luật Lao động 2019; ngày nghỉ bù hoặc lịch nghỉ nhiều ngày do cơ quan có thẩm quyền thông báo từng năm không được tự suy diễn thành ngày nghỉ chính thức.
- Dịp truyền thống bổ sung được ghi nhãn “lễ hội”, tránh nhầm với ngày nghỉ hưởng lương.
- Không tự động ghi sự kiện vào ứng dụng Lịch của điện thoại; màn này chỉ hiển thị dữ liệu và việc nội bộ của LifeMate.

## Tình trạng

Hoàn tất. Bộ test: 58 suites / 256 tests; TypeScript và ESLint pass. Ghi chú theo ngày dùng schema ghi chú hiện tại để giữ tương thích với Firestore Rules đã có.
