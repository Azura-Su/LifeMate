# Quản lý linh thú cho admin, 28/10/2026

1. Trang riêng trong menu Quản trị: danh mục 15 linh thú, trạng thái trống/giữ
   chỗ/có chủ, tên/email/UID người giữ, cấp độ và EXP do backend tính. Tìm kiếm
   cục bộ, tải lại/kéo để làm mới. Thumbnail tĩnh, không chạy 15 animation.
2. Dùng user-admin và kiểm tra admin Firebase hiện hành; RPC chỉ service_role,
   kiểm tra lại admin ở SQL. Không nhận UID người thao tác hoặc EXP từ client.
3. Thu hồi có xác nhận; gửi UID + loài + adoptionId đã xem và actionId ổn định.
   Giao dịch khóa tài khoản pet, kiểm tra đúng lượt nhận nuôi, lưu audit và
   chống thực thi lại. Pet trở lại kho; lượt random đã dùng được giữ nguyên,
   tiến trình cũ không chuyển sang người nhận nuôi mới.
4. Vô hiệu kết quả yêu cầu cũ, chặn khôi phục sau thu hồi; lượt random còn lại
   vẫn dùng được. Đồng bộ EXP kiểm tra adoptionId để snapshot cũ không áp dụng
   sang pet mới. Màn đang hoạt động đọc trạng thái nhẹ để bỏ pet đã thu hồi.
5. Reviewer đọc plan trước triển khai và diff sau triển khai. Regression SQL
   (quyền, CAS, idempotency, restore, receipt, EXP, xóa tài khoản), Edge auth,
   client/UI và session/abort. Chạy test:functions, Jest liên quan, typecheck,
   ESLint và export. Không thêm thư viện, không thao tác pet thật. Deploy
   Supabase và Firebase Rules theo yêu cầu ngày 28/10.

Triển khai: migration → pet-access mới → user-admin mới. App native cần phát
hành riêng để màn admin xuất hiện cho người dùng.
Nguồn: Supabase Database Functions (security definer/search_path và EXECUTE),
https://supabase.com/docs/guides/database/functions; changelog đã kiểm tra 28/10.

---

# Đã hoàn tất: Linh thú — thêm khung hình animation, 28/10/2026

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
