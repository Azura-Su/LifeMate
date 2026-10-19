# Quản lý người dùng

## Phạm vi

Admin `su.azura99@gmail.com`, UID Firebase `CQmmT9iJvKPP79UZqYbvmZ3gXZQ2`, có mục **Quản lý người dùng** trong Menu. Máy chủ xác minh đồng thời UID, email đã xác nhận và tài khoản hiện hành; ẩn menu chỉ phục vụ giao diện.

- Danh sách phân trang 50 người; tìm chính xác email hoặc UID; xem tên, UID, email, nhà cung cấp, ngày tạo/đăng nhập, trạng thái xác nhận/khóa.
- Avatar trước tên lấy từ ảnh hồ sơ của đúng UID, URL ký 10 phút chỉ cấp sau kiểm tra admin hiện hành; thiếu ảnh hoặc tải lỗi dùng logo LifeMate. Không dùng avatar của phiên admin cho user khác.
- Ẩn admin khỏi danh sách và kết quả tìm kiếm. Khi mở chi tiết, spinner thay icon mũi tên của đúng user đang tải, giữ nguyên bố cục danh sách.
- Khóa/mở tài khoản; khóa thu hồi phiên và chặn truy cập dữ liệu bằng trạng thái máy chủ.
- Xóa cần nhập lại email. Không cho khóa/xóa admin. Khi đã bắt đầu xóa không được mở lại.
- Xóa toàn bộ dữ liệu theo UID: Firebase Auth, các cây Firestore audioLibraries/financeAccounts/noteAccounts/agendaAccounts, Firebase Storage audio, Supabase audio/memories và quan hệ bạn bè/lời mời, R2 ảnh. Giữ bản ghi UID/trạng thái tối thiểu để chặn phiên cũ và theo dõi công việc; không giữ email sau hoàn tất.
- Xóa khóa quyền ngay, gỡ lời mời theo email tới mốc yêu cầu xóa bất biến và hồ sơ UID cũ trước khi xóa Firebase Auth, giải phóng email để đăng ký lại. Xóa Auth idempotent và lưu `auth_deleted_at` sau khi dịch vụ xác nhận. Dữ liệu Firestore/SQL được dọn trước file, thử ngay trong request với ngân sách 35 giây; lô chưa xong hoặc lỗi được cron tiếp tục. Không có thời gian chờ 8 ngày. URL upload/lượt tải tiếp tục cũ có thể hoàn tất muộn; deny marker giữ vĩnh viễn và job đã hoàn tất vẫn quét orphan hằng ngày. Không giữ tài khoản đăng nhập để chờ lượt quét này.
- Dữ liệu riêng trên thiết bị offline không thể bị xóa từ xa ngay lập tức. App dọn cache/file/nhắc lịch của UID khi nhận trạng thái xóa; quy tắc máy chủ chặn đồng bộ dữ liệu cũ trở lại.

“Toàn bộ dữ liệu” trong thao tác admin là dữ liệu máy chủ liệt kê ở trên. App mới dọn thêm dữ liệu riêng do LifeMate quản lý trên thiết bị khi kết nối lại. Không cam kết xóa vật lý mọi bản sao offline, bản sao lưu hệ điều hành, file người dùng đã xuất hoặc cache nội bộ của Firebase SDK. Không xóa toàn bộ cache Firestore của thiết bị vì có thể làm mất dữ liệu offline chưa đồng bộ của tài khoản khác.

## Triển khai

Supabase Edge `user-admin` dùng Google service account chỉ ở secret máy chủ. Firebase JWT được xác minh bằng jose như chức năng hiện có. Các bảng trạng thái/công việc không cấp quyền client; cron gọi worker bằng secret trong Vault. Không ghi token, mật khẩu, khóa riêng hoặc nội dung dữ liệu user vào log.

Nguồn: [Firebase quản lý user](https://firebase.google.com/docs/auth/admin/manage-users), [Supabase signed upload: 2 giờ](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl), [lịch chạy Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions), [quyền Storage/Firestore](https://firebase.google.com/docs/rules/manage-deploy).

## Xóa ngay — 17/10/2026

- Migration `202610170001_immediate_account_deletion.sql` thêm `deletion_requested_at` và `auth_deleted_at`; các job cũ lấy mốc yêu cầu từ `final_after - 8 ngày`, chuyển sang due ngay. Áp dụng migration trước deploy user-admin mới.
- Lời mời theo email chỉ xóa khi created_at <= deletion_requested_at; thử lại không ảnh hưởng lời mời cho tài khoản đăng ký lại cùng email sau đó. Dữ liệu theo UID chỉ dọn UID cũ.
- Nếu Auth đã biến mất sau lần gọi thành công nhưng mất acknowledgment, worker bỏ qua thao tác disable với Auth không còn tồn tại và tiếp tục xóa idempotent. Không báo xóa email đăng nhập chỉ dựa vào status deleting.
- Client cho request delete tối đa 60 giây; backend bỏ ký avatar trong phản hồi delete. Sau thành công đóng chi tiết, báo đúng mức hoàn tất, tải lại danh sách. Nếu còn file/dữ liệu cần retry, hiển thị đang dọn nền, không có ngày chờ quét cuối.
- Các yêu cầu khác có ngân sách25 giây. Deadline và hủy từ caller/đổi phiên áp
  dụng từ bước lấy token đến khi đọc xong JSON; đăng nhập lại cùng UID không
  tiếp tục yêu cầu cũ. Không tự thử lại thao tác ghi có kết quả chưa xác định.
