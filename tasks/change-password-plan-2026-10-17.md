# Đổi mật khẩu — kế hoạch 17/10/2026

1. Trong Hồ sơ cá nhân thêm mục Đổi mật khẩu, mở form riêng dạng dialog có cuộn/né bàn phím, giữ draft hồ sơ chưa lưu.
2. Ba ô mật khẩu hiện tại/mới/xác nhận có ẩn hiện. Mật khẩu mới tối thiểu8ký tự, khác hiện tại, xác nhận khớp; giữ nguyên khoảng trắng/bytes.
3. Dùng Firebase Auth26.4 EmailAuthProvider.credential + reauthenticateWithCredential trước updatePassword. Không có backend/migration mới, không lưu/log mật khẩu. Chỉ provider password, email chưa xác nhận vẫn dùng được.
4. UID lấy từ phiên hiện tại, đối chiếu native và store trước/sau await, account deletion gate chặn khi đang xóa. Ngăn submit kép và bỏ kết quả muộn khi rời form/đổi UID; xóa input sau thành công/đóng form.
5. Test meaningful cho validation, mật khẩu cũ sai, mạng lỗi, provider, đổi UID giữa reauth/update, giữ bytes, loading/clear form/error/success. Reviewer plan và diff trước hoàn tất.
6. Runtime chỉ kiểm tra bố cục/điều hướng; không tự nhập hoặc đổi mật khẩu tài khoản thật. Người dùng tự thực hiện thao tác thật.

Nguồn: Firebase manage-users iOS https://firebase.google.com/docs/auth/ios/manage-users ; native SDK modular APIs trong dependency26.4.0.
