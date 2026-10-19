# Hồ sơ cá nhân — kế hoạch

1. Review thiết kế quyền/lưu trữ trước implementation. Dùng lại Firebase Auth, Expo ImagePicker/Manipulator, Supabase; không thêm dependency/credential.
2. Lát backend: bucket private, endpoint avatar-url/upload/remove chỉ đúng UID, gate khóa/thu hồi; test sai phiên, sai path, quá cỡ, MIME và lỗi storage. Bổ sung avatar vào inventory xóa user.
3. Lát tên: validator dùng chung, ưu tiên tên tự đặt, cập nhật session sau Firebase save; test tên và đổi UID.
4. Lát giao diện: thẻ Menu có thể bấm → route Hồ sơ ẩn khỏi bottom tabs; avatar preview, tên/email, chọn ảnh/logo mặc định, Lưu/Hủy, trạng thái lỗi và lưu từng phần.
5. Đồng bộ avatar trong bộ nhớ theo UID, refresh foreground, fallback logo; bảo vệ callback và dọn file tạm khi rời màn/đổi tài khoản.
6. Typecheck/lint, Jest/function tests phù hợp, review diff độc lập; deploy bucket/Edge/update cleanup backend và kiểm tra Simulator.

Mỗi lát có test trước/kiểm tra sau. Giữ nguyên các kế hoạch và thay đổi quản lý user đang có.
