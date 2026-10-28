# Linh thú — thêm khung hình animation, 28/10/2026

## Mục tiêu và thiết kế

Giữ ngoại hình 15 linh thú hiện tại. Thay chuyển động cả tấm ảnh bằng các pose
khác nhau: chớp mắt/thở, bước chân hoặc vỗ cánh/uốn thân, vui vẻ và thi triển
kỹ năng. Ảnh gốc là reference và fallback; không thay quyền sở hữu, EXP hay API.

- 14 ảnh minh họa: sinh sprite sheet 4×4 (16 pose/loài), nền trong suốt, cùng
  góc nhìn/tỷ lệ/điểm neo. Kiểm tra từng sheet trước đóng gói. Bạch Hổ tiếp tục
  giữ phong cách rig pixel hiện tại và có các pose di chuyển tương ứng.
- Tạo asset bằng imagegen tích hợp; không thay bằng biến dạng nguyên tấm ảnh.
  Đóng gói atlas cục bộ, giảm kích thước sau kiểm tra, không tải mạng lúc chạy.
- Bộ phát khung hình dùng progress Reanimated trên UI thread, không setInterval
  hoặc React setState mỗi frame. Chỉ atlas của pet đang hiển thị được giải mã.
  Giữ ảnh gốc khi atlas chưa sẵn sàng/lỗi; Reduced Motion/mất focus dừng animation.
- Các clip cũ giữ nguyên ID. Đi/bay lặp dùng cho Home; màn Linh thú cho xem thử
  chuyển động. Giữ callback one-shot và các giai đoạn hiện tại.

## Các bước và tiêu chí

1. Chốt layout atlas, nhóm clip và giới hạn bộ nhớ; reviewer chỉ đọc phản biện.
2. Làm một sheet mẫu có cánh, kiểm tra identity/alpha/alignment/chuyển động;
   sau đó tạo các sheet còn lại theo cùng tiêu chuẩn. Không chấp nhận sheet
   chỉ lặp lại một pose hoặc có cánh/chân bị cắt.
3. Test frame mapping/cancellation/fallback trước rồi thêm renderer atlas;
   chỉ mount atlas đang dùng, dừng khi inactive/reduced motion.
4. Tích hợp Home và nút xem thử, kiểm tra 15 loài và ba giai đoạn. Các nút
   xem animation không gọi API hoặc tiêu lượt random/chăm sóc.
5. Reviewer rà diff; Jest nhóm pet/Home, typecheck, ESLint, kiểm tra assets và
   export native. Ghi rõ những kiểm tra runtime/thiết bị chưa thực hiện được.

Task checklist ở todo.md. Không thêm dependency hoặc deploy trong lượt này.
