# Đồng bộ Của tôi — kết quả 16–17/10/2026

## Thay đổi

- Bản gốc riêng đồng bộ Firestore + Firebase Storage theo UID, giữ cache mã hóa và ảnh trên máy. Nhập dữ liệu cũ khi tài khoản mở app mới; giữ hoạt động offline cho chụp mới.
- Stable pending revision, CAS + server acknowledgement, tombstone, xử lý conflict có lựa chọn và kiểm tra lại snapshot/revision; không ghi đè editor hoặc hộp xóa đang mở bằng bản không được nhìn thấy.
- File download partial + kiểm tra cỡ; kiểm tra UID quanh async/transfer và account lifecycle queue. Không có URL ảnh riêng công khai.
- Supabase/R2 vẫn quản lý Bạn bè. delete-own + marker/RPC khóa cùng publish ngăn chia sẻ lại ID đã xóa. Gỡ chia sẻ/xóa cho phép chủ tài khoản chưa xác nhận email, không có profile/invite side effects. Quyền xem chưa kiểm tra được hiển thị chưa xác định.
- Xóa tài khoản dọn memoryAccounts/items, Firebase memories prefix và marker Supabase.
- Review plan và diff độc lập; đã xử lý các finding về stale share hint/conflicted deletion và stale editor/delete snapshot. Final reviewer không còn finding.

## Kiểm chứng

- TypeScript và ESLint các file thay đổi: đạt.
- Jest toàn app: 89 suites, 484 tests đạt (có warning act/Expo từ bộ test hiện hữu).
- Backend: 69 tests đạt, gồm publish/delete cả hai thứ tự, unverified owner-only revoke, retry sau lỗi dọn ảnh.
- Emulator Firestore: đạt, bao gồm metadata riêng, foreign UID, account gate và revoked auth_time. Emulator Storage: đạt sau bổ sung resource == null để chặn ghi đè filename; foreign UID, content type, immutable file, account gate và revoked session đều đạt.
- SQL: chạy migration + fixture regression trong transaction rollback trên PostgreSQL thật, đạt quyền client, hai thứ tự reserve/delete, retry giữ con trỏ ảnh và xóa mục chưa có profile. Không thao tác dữ liệu user thật để thử xóa/khóa.
- Expo export iOS/Android: đạt.
- Runtime Simulator: mở Của tôi bằng JS mới, thấy “Đã đồng bộ theo tài khoản”, hiện 0 mục. Lần tải trước rules release báo permission-denied; mở lại sau release đã thành công.

## Deploy

- Firebase project baseapp-dd227: Firestore và Storage rules released thành công.
- Supabase xbhelntqytleiduzicuj: migration 202610160004_private_memory_deletions.sql áp dụng thành công qua Management API. Project hiện chưa có bảng lịch sử supabase_migrations.schema_migrations; không tạo lịch sử giả cho các migration cũ.
- memory-access v10 ACTIVE, user-admin v6 ACTIVE; audio-access v9/profile-access v2 giữ nguyên.
- Probe delete-own không token trả 401. Bảng marker bật RLS, anon/authenticated không có quyền và reserve RPC đã kiểm tra marker.

## Cần biết

- Chưa xác minh ảnh thực tế đi từ máy thật sang Simulator: máy thật phải chạy JS mới và mở Ký ức để tải dữ liệu trước đây chỉ nằm trên máy. Hai máy cần cùng UID.
- Ảnh cloud phiên bản cũ giữ tới lúc xóa tài khoản để tránh xóa ảnh còn được thiết bị offline tham chiếu. Marker/tombstone cũng giữ tới lúc xóa tài khoản.
- ID đã xóa không thể chia sẻ lại; bản sửa offline được khôi phục riêng cần tạo ký ức mới nếu muốn chia sẻ.
- Chưa commit/push những thay đổi này; giữ nguyên toàn bộ thay đổi đang có trong workspace.
