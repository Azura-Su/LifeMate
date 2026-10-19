# Avatar trong quản lý user — 17/10/2026

- Thay icon user bằng ảnh hồ sơ đúng UID, dùng logo LifeMate khi chưa có ảnh hoặc ảnh lỗi.
- user-admin ký URL avatar 600 giây chỉ sau kiểm tra admin hiện hành. Đường dẫn từ UID do Google trả; lỗi từng ảnh không làm hỏng list/detail/mutation.
- Client kiểm tra origin, đường dẫn UID và token trước khi render; không dùng profile store của admin cho user khác.
- Typecheck và ESLint đạt; 4 UI tests, 71 backend tests đạt. Reviewer độc lập không còn finding.
- Đã deploy user-admin thành công. Không đổi quyền bucket/IAM hoặc tạo credential.
- Simulator đã hiển thị logo dự phòng thay icon user; tải lại danh sách sau deploy để nhận ảnh đã đặt.
