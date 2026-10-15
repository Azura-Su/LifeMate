# Tối ưu báo cáo Thu nhập / Chi tiêu — 15/10/2026

## Mục tiêu

Giảm các lớp thẻ và thông tin lặp trên màn Tài chính khi xem báo cáo theo tháng, đồng thời giữ nguyên bộ lọc và cách tính hiện có. Bố cục dùng chung cho Thu nhập và Chi tiêu.

## Thực hiện

1. Gom chọn kỳ và nguồn thu vào một thẻ lọc. Nguồn thu dùng một nút chọn gọn, mở danh sách khi cần; bỏ dòng giải thích lặp lại.
2. Rút thẻ tổng kết về nhãn, số tiền và các dòng danh mục. Kỳ đang xem chỉ hiện ở bộ lọc.
3. Với chế độ một tháng, hiện danh sách giao dịch ngay dưới tiêu đề thay vì thêm một thẻ tháng phải mở. Với cả năm và khoảng tháng, giữ các nhóm tháng có thể thu gọn và nút thêm theo tháng.
4. Giữ tìm kiếm dễ thấy, đối chiếu các trạng thái không có dữ liệu, nhiều danh mục, kỳ dài và màn hình hẹp; kiểm tra giao diện trên máy ảo.

## Tiêu chí hoàn thành

- Số tiền và nguồn/kỳ của báo cáo không đổi.
- Người dùng vẫn chọn được cả năm, một tháng, khoảng tháng và nguồn thu; tìm kiếm và thêm giao dịch vẫn hoạt động.
- Ở kỳ một tháng, giao dịch hiển thị trực tiếp và không lặp lại tiêu đề tháng/tổng tiền trong một thẻ riêng.

## Kết quả

Đã triển khai bốn bước trên. TypeScript, ESLint, Prettier và `git diff --check` đều đạt. Đã xem trên iPhone Simulator ở kỳ một tháng có dữ liệu, kỳ trống, cả năm, khoảng tháng và popup chọn nguồn thu. Chưa chạy bộ kiểm thử tự động trong lượt này.
