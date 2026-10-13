# Xóa lần đã nhận ghi nhầm — 12/10/2026

## Thiết kế

Trong **Lịch sử khoản vay**, mỗi dòng **Đã nhận** có nút thùng rác nhỏ ở mép phải. Dòng đang chờ ghi Tài chính không có nút này. Hộp xác nhận nêu người vay, ngày, số tiền và tác động: lần nhận cùng giao dịch Tài chính liên kết sẽ bị xóa; số còn phải thu tăng lại. Chỉ dòng được chọn hiện trạng thái đang xóa, các thao tác khác trên thẻ tạm khóa. Khoản đã tất toán tự chuyển về **Chưa hoàn thành** nếu sau khi xóa còn nợ.

## Ràng buộc dữ liệu

- Chỉ cho xóa một lần nhận `posted` trên hồ sơ còn tồn tại. Đọc hồ sơ ở phiên bản cloud mới nhất trong Firestore transaction và đối chiếu ID, số tiền, ngày, giao dịch liên kết; không tin dữ liệu thẻ đã tải trước đó.
- Dùng một Firestore transaction để (1) bỏ đúng lần nhận khỏi `repayments`, (2) giảm `recordedRepaymentAmount` nếu trường này tồn tại, (3) xóa giao dịch `loan_repayment` liên kết, và (4) tạo tombstone theo ID giao dịch. Mọi bước cùng thành công hoặc cùng thất bại.
- Rules kiểm tra đúng một phần tử bị bỏ, thứ tự phần còn lại giữ nguyên, tổng giảm đúng số tiền, giao dịch bị xóa và tombstone tương ứng được tạo. Rules chặn thêm lại ID đã có tombstone để thiết bị cũ/retry không khôi phục lần nhận.
- Sau commit, cập nhật cache hồ sơ, tải lại Tài chính và nhắc hạn. Nếu mạng ngắt sau commit, tải lại nhận ra tombstone và không xóa lần khác. Không xóa riêng giao dịch từ tab Tài chính.

## Công việc

1. [x] **Lưu trữ và rules:** thao tác xóa nguyên tử, tombstone chống khôi phục, kiểm tra số dư/lịch sử và quyền UID. Phụ thuộc: không. Chấp nhận: xóa đúng một lần trả bất kỳ, bao gồm lịch sử nhiều lần và dữ liệu cũ hợp lệ; lỗi giữ nguyên cả hồ sơ lẫn giao dịch.
2. [x] **Hook và đồng bộ:** khóa thao tác cùng khoản, kiểm tra phiên đăng nhập, cập nhật hồ sơ/cache/Tài chính/nhắc hạn sau commit; xử lý timeout bằng tải lại. Phụ thuộc: 1. Chấp nhận: số còn phải thu, trạng thái và báo cáo Chi tiêu cập nhật cùng nhau; không hiển thị thất bại giả nếu cloud đã commit.
3. [x] **Giao diện:** nút xóa trên dòng đã nhận, lời xác nhận, spinner riêng và thông báo lỗi; không xóa dòng đang chờ. Phụ thuộc: 2. Chấp nhận: thao tác rõ ràng trên thẻ Chưa hoàn thành và Đã hoàn thành, không nhầm với xóa toàn bộ hồ sơ.
4. [x] **Tài liệu và kiểm tra tĩnh:** cập nhật mô tả, rà thay đổi chưa commit, kiểm tra kiểu/lint/format và biên dịch rules trên Firestore emulator. Phụ thuộc: 1–3. Không thay Supabase.
5. [x] **Phát hành:** phát hành riêng Firestore rules cho `baseapp-dd227` và đọc lại bản đã phát hành. Firebase CLI truy cập được project khi chạy ngoài sandbox; dry-run và deploy đều thành công lúc 18:35 ngày 12/10/2026. Nguồn đang chạy trong Firebase Console có 40.018 ký tự và mã kiểm tra FNV-1a `9045289e`, khớp file workspace.

Ảnh lỗi lúc 18:30 cho thấy lần xóa chưa được xác nhận. Khi đó Firebase Console vẫn dùng bản rules phát hành lúc 16:03, trước khi thêm quyền đọc/tạo `deletedLoanRepayments`; Firestore từ chối transaction ở bước đọc tombstone. Hook đã phân biệt lỗi `permission-denied` để báo đúng nguyên nhân thay vì gộp vào thông báo timeout. Bản rules mới được phát hành lúc 18:35; người dùng cần thử lại thao tác trên ứng dụng để xác nhận luồng thực tế.

## Trường hợp cần rà

- Xóa lần duy nhất 1 ₫ khỏi khoản 1.500.000 ₫: đã nhận về 0, còn phải thu về 1.500.000 ₫, Chi tiêu `Cho vay` tăng lại 1 ₫.
- Xóa lần trả ở giữa nhiều lần: các lần khác giữ nguyên ID, ngày và thứ tự; tổng giảm đúng số tiền.
- Xóa lần trả hết: thẻ chuyển từ Đã hoàn thành sang Chưa hoàn thành; nhắc hạn được đối soát lại.
- Khoản đã hủy: lịch sử vẫn sửa được nếu hồ sơ còn tồn tại, trạng thái hủy giữ nguyên.
- Khoản đã xóa toàn bộ, lần đang chờ, giao dịch liên kết không khớp, tài khoản đổi hoặc hai thiết bị thao tác đồng thời: báo xung đột, không xóa một nửa.
- Timeout sau commit: thử lại cùng ID chỉ xác nhận kết quả đã xóa, không tác động lần nhận khác.

## Kiểm chứng

TypeScript, ESLint, Prettier và `git diff --check` đạt. Firestore emulator khởi động với `firebase/firestore.rules` và biên dịch thành công; Firebase CLI dry-run cũng biên dịch thành công trên project thật. Không thêm/chạy test tự động trong lượt này theo chỉ dẫn phiên. Firestore rules đã được phát hành và đối chiếu với nguồn trong workspace; Supabase không có thay đổi cần phát hành.
