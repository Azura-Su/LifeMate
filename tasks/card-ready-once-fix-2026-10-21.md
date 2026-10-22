# Sẵn sàng một lần và chờ vào ván — 21/10/2026

## Nguyên nhân và thay đổi

- Ready dùng snapshot cũ bị Edge trả version-conflict, client làm mới rồi mất lệnh đã bấm. Edge nay tính lại riêng ready trên trạng thái có thẩm quyền trong cùng room/match, tối đa 4 lần CAS để phục vụ 4 người bấm cùng lúc. Join vẫn giới hạn 3 lần. RPC vẫn kiểm tra phiên bản chính xác trong transaction.
- Join từng reset ready của tất cả người đã ngồi. Nay chỉ người mới vào có ready=false; những người đang chờ giữ trạng thái. Leave vẫn reset như trước. Ready cuối tự bắt đầu ván đầu hoặc ván tiếp.
- Mỗi lần thử ready đọc lại receipt trước khi kiểm tra room/match để xử lý request trùng đã bắt đầu match. Giữ nguyên actionId/fingerprint; không tạo match hay cộng kết quả hai lần.
- Không rebase qua match khác, room khác, phiên bản tương lai hoặc phiên điều khiển đã bị thay thế. Play/pass/start/leave vẫn yêu cầu phiên bản client chính xác. Không ẩn lỗi mạng/quyền thật và không dùng optimistic ready.

## Review và kiểm chứng

- Reviewer độc lập đã duyệt plan và bản cuối. Hai góp ý được xử lý: cho phép 4 lần thử thay vì 3 và phục hồi receipt trước guard.
- Các ca tái hiện fail trước sửa: mất ready khi join, ready cùng snapshot, 3 người khác commit trước, request trùng final-ready và hủy ready trên snapshot cũ.
- `npm run test:functions`: 189/189 đạt. Bao gồm PGlite với CAS thực, giới hạn retry, chặn phiên/match/room sai, request trùng, tới trắng cộng đúng một lần và rematch.
- `npm run typecheck`, ESLint trên các file server/test thay đổi và `git diff --check`: đạt.
- Chưa smoke bằng hai điện thoại thật.

## Bản cloud

- Cloud game-access trước sửa là v4, cũ hơn đáng kể so với working tree có nhiều thay đổi khác. Không triển khai nguyên thư mục local.
- Đã phát hành v5 từ đúng bundle v4, chỉ cập nhật handler.mjs (receipt/retry/ready guard) và rooms.mjs (giữ ready khi join). 9 file còn lại giữ nguyên; không migration/schema mới. Các tính năng local khác không được xem là đã phát hành qua lần sửa này.
- 8 test ready/entry chạy với đúng bundle cloud đã chuẩn bị và PGlite đều đạt. Đọc lại 11 file sau triển khai xác nhận khớp hoàn toàn. HTTP POST không đăng nhập trả 401 invalid-session như mong đợi, không tạo dữ liệu người dùng.
