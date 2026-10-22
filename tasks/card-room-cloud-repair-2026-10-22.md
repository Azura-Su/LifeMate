# Khôi phục phòng và triển khai game — 22/10/2026

## Nguyên nhân đã xác nhận

- Ứng dụng gọi room-status/reopen nhưng game-access cloud còn v5; database chưa có các RPC vòng đời phòng và bảng điểm dùng chung. Lỗi chung xuất hiện khi vào lại phòng.
- Phòng 4R9X8TS6 vẫn còn, phase closed, không có ghế, ownerUid/host trống. Firebase Auth xác nhận Asher là tài khoản active/verified; UID khớp người tạo ở receipt đầu tiên và danh sách scoreMembers.
- expires_at của phòng cũ còn theo thời hạn dọn dữ liệu 24 giờ, không phải thời hạn hoạt động 30 phút. Vì vậy cần đánh dấu riêng phòng đóng này đã hết hoạt động để chủ phòng mở lại ngay.

## Thực hiện

- Sao lưu 16 function database, 7 phòng, 17 kết quả và source Edge v5 trong thư mục tạm riêng. Không ghi bài riêng, thông tin xác thực hoặc UID vào tài liệu repo.
- Đối chiếu định nghĩa database: bộ game đã áp dụng đến money-score 202610200001; không chạy lại các migration cũ hoặc migration audio.
- Chạy thử transaction trên PGlite với dữ liệu sao lưu: repair có điều kiện đúng phòng đóng/không người và danh tính Asher, giữ game/kết quả; áp dụng 7 migration game theo thứ tự; ghi chính xác 7 phiên bản vừa áp dụng.
- Tạm dừng riêng cron game, deploy phản hồi bảo trì cho game-access để không có ghi/worker cũ trong khoảng chuyển schema. Áp dụng transaction; deploy bundle game đầy đủ; kiểm tra rồi bật lại cron. Không đổi mode game, secrets hoặc cấu hình Auth.
- Phòng 4R9X8TS6 giữ nguyên ID/mã, ownerUid là Asher. Điều chỉnh thời hạn phòng đã đóng để được mở lại; giữ danh sách thành viên, game, số dư và điểm -13/+13. Không đặt lại điểm hoặc dựng lại các ván không còn dữ liệu.
- Supabase xbhelntqytleiduzicuj: game-access **v7 ACTIVE**, gồm room-status, reopen và shared scores; source đọc lại khớp đủ 12 file đã chuẩn bị. verify_jwt=false vẫn được giữ vì handler tự xác minh Firebase JWT.
- Firebase baseapp-dd227: compile và release lại Firestore/Storage rules hiện có. Nội dung rules đã up to date, không thay quyền Firebase hay tài khoản.

## Kiểm chứng

- 193 backend tests đạt. Dry-run trên snapshot giữ đủ 17 kết quả, nguyên game và điểm; chủ phòng mở lại HTTP 200, người khác bị từ chối 403, sau mở lại thành viên cũ có thể vào.
- npm run test:rules đạt; bộ Firestore/Storage emulator có thêm 60 assertion đạt. Dùng JRE 21 chính thức Adoptium tải vào thư mục tạm, kiểm SHA256; không đổi Java hệ thống.
- Reviewer chỉ đọc duyệt plan và nội dung rollout trước khi ghi production; đã xử lý rủi ro cleanup và thứ tự backfill quyền.
- Kiểm tra thật trên Simulator: chọn 4R9X8TS6, bấm Vào lại phòng, vào được bàn. Database xác nhận Asher vừa là owner vừa là host, thành viên khác canRejoin=true, cron active=true, 17 kết quả vẫn còn, bảng điểm có ván -13/+13.
- RLS các bảng mới bật; role authenticated không gọi trực tiếp room-status RPC. Probe Edge không token trả 401 invalid-session sau khi hết bảo trì.
- Không phát hành bản cài iOS/Android hay OTA, không thay dependency hoặc lockfile. Giữ nguyên các sửa khác đang có trong working tree.
- npm audit theo lockfile hiện tại còn 60 advisory (52 high, 8 moderate, không critical). Không tự nâng các dependency ngoài phạm vi bản sửa phòng.

## Theo dõi và phục hồi

- Giữ schema cộng thêm và room tombstone nếu phải phục hồi code; không quay về worker cũ có thể xóa phòng đã hết hạn. Backup và manifest nằm cục bộ trong /private/tmp/lifemate-room-repair-20261022, không đưa vào Git.
- Canonical backfill giữ kết quả cuối còn trong phòng, không tái tạo toàn bộ lịch sử từ các kết quả không còn thông tin phòng. Bản điểm cũ trên thiết bị được giữ để không mất chỉnh sửa riêng.
