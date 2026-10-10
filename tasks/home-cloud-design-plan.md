# Thiết kế hai đám mây trên Home

## Mục tiêu

Làm hai điểm vào Lịch và Việc trên Home trông nhẹ, bay bổng và cân bằng hơn. Nội dung phải nằm gọn giữa phần thân mây; mỗi mục có một silhouette khác nhau để không lặp lại cùng một hình.

## Hướng thiết kế

- Giữ nguyên màu, nội dung, khả năng bấm và khoảng lệch dọc của hai mục.
- Làm dáng mây ngang và thấp hơn; giảm độ nặng của viền tối và bóng xám ở đáy.
- Dùng hai silhouette SVG vẽ riêng: mây Lịch có ba múi thoáng và đáy gọn; mây Việc có nhiều múi so le hơn.
- Căn giữa cụm icon–tiêu đề và nhãn số trong vùng thân trắng, đồng thời giữ nhãn tiêu đề đọc được trên màn hình hẹp.
- Xuất SVG thành PNG độ phân giải cao để React Native hiển thị ổn định, không thêm thư viện native.

## Các bước và tiêu chí nghiệm thu

- [x] Thay các oval ghép bị tạo viền đen gồ ghề bằng hai đường bao SVG riêng, viền mảnh và bóng đáy nhẹ.
- [x] Căn giữa nội dung trong vùng thân mây, xử lý tiêu đề dài và nhãn số để không tràn trên màn hình hẹp.
- [x] Giữ cụm Việc thấp hơn cụm Lịch; giữ nhãn truy cập và hành vi mở nội dung.
- [x] Tăng kích thước hình mây và nới độ lệch của mây Việc theo phản hồi.
- [x] Chạy kiểm thử Home, TypeScript, ESLint, Prettier và kiểm tra diff.

## Kết quả

Mây Lịch dùng dáng dài với ba múi; mây Việc có nhiều múi so le để tạo hình khác. Nội dung của mỗi mây được căn giữa trong vùng thân trắng. Cụm Việc vẫn thấp hơn Lịch. SVG gốc được giữ trong `assets/`; app dùng PNG đã xuất và co ảnh theo khung để tránh thêm dependency hoặc tràn kích thước.

Xác minh: giao diện xem trực tiếp trên iOS Simulator; 5 bài test Home đạt, TypeScript và ESLint đạt; SVG hợp lệ, Prettier và `git diff --check` sạch.

## Giới hạn

Chỉ chỉnh hình và căn nội dung của hai mục Home; không đổi dữ liệu, điều hướng, copy, màu chủ đề hoặc các màn hình khác.
