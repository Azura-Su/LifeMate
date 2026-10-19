# Kế hoạch Quản lý người dùng

1. Xác minh tài khoản admin và kiểm kê các kho dữ liệu. Hoàn tất: UID/email đã kiểm tra trực tiếp Firebase.
2. Review độc lập thiết kế phân quyền và xóa dữ liệu trước khi viết mã.
3. Backend: hợp đồng list/search/detail/lock/unlock/delete/jobs; kiểm tra admin, dữ liệu đầu vào, chống tự khóa/xóa; công việc xóa có retry và quét cuối sau thời hạn URL upload.
4. Chặn user bị khóa/xóa tại Firestore, Storage và hai Edge Functions hiện có; ứng dụng nhận trạng thái máy chủ và kết thúc phiên.
5. Giao diện: menu admin, màn danh sách/tìm kiếm/chi tiết, trạng thái và xác nhận thao tác; dùng theme/component hiện có.
6. Test phân quyền, chống xóa nhầm, retry và phạm vi xóa; typecheck, lint, Jest, functions và emulator rules; review diff độc lập, sửa phát hiện.
7. Cấu hình secrets, migration, cron, deploy nếu phiên dịch vụ cho phép; báo chính xác phần đã kiểm tra và còn thiếu. Không dùng tài khoản thật để thử khóa/xóa.

Theo SPEC-user-management.md. Giữ nguyên các kế hoạch khác đang dở.
