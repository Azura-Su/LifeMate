# Xóa tài khoản ngay — 17/10/2026

## Yêu cầu

Xóa cả dữ liệu và email đăng nhập ngay, không chờ 8 ngày; giữ quét orphan nền cho lượt upload hoàn tất muộn.

## Thực hiện

- Deny gate và khóa Firebase trước; xóa lời mời theo email với cutoff bất biến, xóa memory profile UID cũ để giải phóng email unique, rồi xóa Firebase Auth idempotent.
- Lưu auth_deleted_at chỉ sau Auth xác nhận. Crash/mất ack có thể retry khi Auth đã vắng mà không mắc kẹt ở disable.
- Dọn Firestore và SQL metadata trước object prefix; thử ngay trong budget35giây, phần chưa xong cron tiếp tục. Client delete timeout60giây, phản hồi delete không ký avatar.
- Giữ deny tombstone và daily orphan sweep. Không có final_after/chờ8ngày; UI thông báo đúng completed/loginremoved/accepted.
- Migration202610170001 áp dụng trước deploy user-admin thành công. Backfill job cũ từ final_after-8ngày để không xóa nhầm lời mời mới của người đăng ký lại cùng email.

## Kiểm chứng

- 75 backend tests đạt; gồm Auth lỗi khôngack, objectcleanup lỗi giữretry, mấtAuthack rồiabsentAuth ởblocking, cutoff giữ nguyên, profile trướcAuth, metadata trướcobject, lease/protectedadmin.
- Toàn app90suites/487tests đạt; targetedUI5tests đạt. Typecheck/lint/diffcheck đạt.
- Reviewer plan và diff không còn finding. Migration thử transactionrollback có0missingcutoff và0waitingdeadline, sau đó áp dụng thật.
- Job UID iW61gRjKEJbOpTmp0fAmaDc9X492 đã được cron hiện hữu xử lý: statusdeleted/phasecomplete, final_afternull. auth_deleted_atnull vì worker cũ đang chạy lúc chuyển phiên bản đã hoàn tất; không backfill bằng chứng Auth giả.
- Auto-review chặn gọi sweep thủ công vì endpoint có thể xử lý mọi job due ngoài tài khoản trong ảnh. Không thực hiện lệnh đó. Chỉ đọc trạng thái sau đó; cron hiện hữu tự hoàn tất.
- Runtime admin sau gọi tải lại từ Firebase: NGƯỜI DÙNG · 0, không còn tài khoản hoặc job đang xử lý. Xác minh trên Simulator, không tạo/xóa user thử nghiệm thật.
