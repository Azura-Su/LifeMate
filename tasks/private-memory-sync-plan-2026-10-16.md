# Đồng bộ Ký ức Của tôi

Người dùng đã cho phép sao lưu ảnh/nội dung Ký ức riêng lên cloud LifeMate để đồng bộ cùng tài khoản giữa máy thật và Simulator.

- Metadata: Firestore `memoryAccounts/{uid}/items/{id}`; ảnh gốc private Firebase Storage `memories/{uid}/{id}/{fileName}`. Dùng SDK đã cài, tải file với Firebase Auth; không tạo URL download token lâu dài. Giữ chia sẻ Bạn bè trên Supabase/R2 hiện có.
- Cache mã hóa cũ theo UID vẫn đọc được. Thêm revision cloud, revision pending và tombstone cục bộ. Lưu local trước; đọc local ngay rồi đồng bộ. Dữ liệu cũ tự sao lưu khi thiết bị chạy phiên bản mới và mở Ký ức.
- Ghi cloud trong transaction so revision baseline; cùng intent retry là idempotent. Xóa cloud giữ tombstone tối thiểu để thiết bị offline cũ không tạo lại. Sửa đồng thời không ghi đè thầm lặng: giữ draft local và bản cloud, UI chọn bản cần giữ rồi retry với revision mới nhất.
- Upload ảnh trước metadata, ảnh immutable theo entry và filename. Download `.partial`, kiểm tra file, đổi tên sau khi hoàn tất. UID/session checks trước/sau await; queue riêng theo UID và gate xóa tài khoản hiện có.
- Refresh khi mở/foreground/kéo xuống và lắng nghe thay đổi metadata khi timeline đang hiện. UI phân biệt đang đồng bộ/chưa đồng bộ/xung đột; trạng thái chia sẻ không thay đổi do sao lưu.
- Rules chỉ owner, kể cả user chưa xác nhận email; giữ accountAccess revoked/disabled gate. Cập nhật inventory xóa user cho Firestore/Storage mới. Không thêm dependency.
- Gates: tests legacy cache + upload/download/remote edit/delete/offline/retry/conflict/UID switch, rules owner/outsider/unauthed/stale token, backend cleanup regression, typecheck/lint; reviewer plan + diff, rồi deploy Firebase rules và user-admin.
