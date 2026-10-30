# Chia khoản chi theo người/suất

- [x] Reviewer duyệt plan tính tiền và tương thích receipts.
- [x] Regression utility → phân bổ chính xác, kiểm tra suất và làm tròn.
- [x] UI ba chế độ, giữ tiền khi đổi mode và sửa giao dịch.
- [x] Regression lưu/sửa/các lần nhận lại; typecheck và lint.
- [x] Reviewer diff không còn finding; kết quả trong shared-expense-split-result-2026-10-29.md.

# Đã hoàn tất: Quản lý linh thú admin

- [x] Reviewer rà kế hoạch; chốt khóa access trước pet account và chặn sync cũ.
- [x] Migration và regression quyền/ownership/receipt/restore/EXP.
- [x] API admin list/revoke, Firebase profile batch và tests.
- [x] Trang quản lý, menu admin, xác nhận và tests.
- [x] Làm mới pet sau thu hồi; kiểm tra session và request cũ.
- [x] Reviewer diff không còn finding; kiểm tra và giới hạn trong pet-admin-result-2026-10-28.md.

# Đã hoàn tất: Linh thú — animation frames

- [x] Review plan và baseline kiểm tra pet hiện tại (13 test đạt).
- [x] Sheet mẫu đạt chất lượng và schema atlas/clip được chốt.
- [x] Sinh/kiểm tra/đóng gói frame cho toàn bộ pet hiện tại (15 atlas/240 khung).
- [x] Regression frame mapping, callback, inactive/reduced motion và fallback.
- [x] Renderer và Home/màn xem thử dùng đúng clip; Phượng Hoàng xem trên Simulator.
- [x] Review cuối, sửa finding finance move và chạy32 test pet/Home.
- [x] Ghi kết quả full-suite và giới hạn kiểm chứng vào pet-animation-result-2026-10-28.md.

# Đã hoàn tất: tư thế nghỉ 15 linh thú, 29/10/2026

- [x] Người dùng duyệt plan và hướng mỹ thuật trong pet-rest-animation-plan-2026-10-29.md.
- [x] Tạo và rà pilot Garuda/Thanh Long; chốt chất lượng và pack 4×4.
- [x] Tạo/kiểm tra atlas nghỉ riêng cho15 linh thú (16 khung mỗi atlas).
- [x] Tích hợp chuỗi ngủ/thức đảo chiều và nhịp thở; giữ ổn định style handle Reanimated.
- [x] Regression rest/playback, typecheck, ESLint, export iOS/Android và báo cáo tại pet-rest-animation-result-2026-10-29.md.

# Đã duyệt: chuyển động đặc trưng từng linh thú ngoài Home

- [x] Người dùng duyệt triển khai theo yêu cầu tiếp nối ngày 29/10.
- [x] Kiểm kê atlas, frame mapping và màn Linh thú/Home; chốt baseline.
- [x] Pilot Kỳ Lân/Thanh Long và duyệt atlas theo từng hình thái.
- [x] Tạo atlas và mapping đặc trưng cho đủ 15 loài.
- [x] Regression playback/fallback/Reduced Motion/Reanimated; typecheck, lint, iOS export và kiểm tra trực quan atlas.
- [x] Cập nhật SPEC, provenance và ghi kết quả tại pet-home-motion-result-2026-10-29.md.

# Đã hoàn tất: chuyển động đặc trưng từng linh thú ở Home

- [x] Sinh atlas Home toàn thân riêng cho 15 loài; Cửu Vĩ Hồ có dáng nhún/chạy/nhảy/ngoái nhìn mới.
- [x] Tích hợp atlas theo clip và nhịp riêng; giữ atlas kéo, chu kỳ ngủ và Thiên Dực Linh Lộc.
- [x] Regression animation, typecheck, ESLint, kiểm tra asset và iOS export.
- [x] Cập nhật SPEC/provenance/README và ghi kết quả tại pet-home-motion-result-2026-10-29.md.

# Đã hoàn tất: cảnh ngủ Garuda ở Home

- [x] Dùng atlas núi, mây và đền Garuda đã có; dựng cảnh phía sau atlas ngủ.
- [x] Hiện cảnh trong nhịp nghỉ idle, cho thức dậy bằng chạm/kéo.
- [x] Regression Home/scene; typecheck, ESLint và iOS export đạt.
- [x] Cập nhật SPEC, README và provenance.

# Đã hoàn tất: review linh thú/trò chơi và cloud deploy, 30/10/2026

- [x] Review pet/game độc lập; sửa callback one-shot, tải lại atlas và cache phòng cold start, kèm regression.
- [x] Đối chiếu cloud source/history; plan review cho cache và hai migration còn thiếu.
- [x] Deploy game-access v20, áp hai migration sau execution drain và deploy Firebase rules.
- [x] Final read-only review:9SQL bodies khớp local, ACL/cron/capability12 đạt; không ghi fixture production.
- [x] TypeScript, ESLint,166Jest suites/1536tests,405functions tests, Firestore emulator và iOS/Android export đạt.
- [x] Ghi kết quả/giới hạn native rollout tại review-pets-games-2026-10-30.md.

# Đề xuất: khung hình và cảnh riêng từng linh thú, 30/10/2026

Plan/storyboard và tiêu chí A/B/C tại `plan.md`. Mỗi A được chia thành cụm
đi/đáp và ngủ/thức; từng lần tối đa5file. B là cảnh xuất hiện/yên/tan, C là tích
hợp Home/preview + regression. Chưa bắt đầu tạo art hoặc triển khai code.

- [ ] Người dùng xem/chốt storyboard và pilot Kỳ Lân Hỏa.
- [ ] F1: inventory/manifest/anchor/capability và budget page cho16ID.
- [ ] F2: renderer/adapter pilot dùng cấu hình, giữ fallback cho loài khác.
- [ ] Kỳ Lân Hỏa — A: bốn vó/giậm lửa/ngủ; B: vườn đá trúc; C: Home+preview+tests.
- [ ] Huyền Vũ — A: bò/rụt cổ/thu chân; B: hồ sen rêu; C: Home+preview+tests.
- [ ] Checkpoint: contact sheet, preview thật120pt, kiểm tra chân sau, alpha/anchor và số đo bộ nhớ hai pilot.
- [ ] Thiên Mã Kỳ Lân — A: đi/cất cánh/lượn/đáp/nằm; B: mây/tinh thể; C: Home+preview+tests.
- [ ] Checkpoint: đường bay, đủ vó tiếp đất, cánh không cắt, tương tác kéo và awake20s.
- [ ] Bạch Hổ — A: rình/chạy/chồm/nằm; B: trúc xanh bạc; C: Home+preview+tests.
- [ ] Nhân Sư — A: bước mèo/cánh/vươn vai/nằm; B: đền sa thạch; C: Home+preview+tests.
- [ ] Nhân Mã — A: bốn vó/cung/ngồi nghỉ; B: trảng rừng; C: Home+preview+tests.
- [ ] Checkpoint: ba loài trên + Cửu Vĩ/Lang Linh/Thiên Lộc không regression.
- [ ] Thanh Long — A: uốn thân/cuộn/ngủ/tháo vòng; B: mây núi; C: Home+preview+tests.
- [ ] Lý Ngư Hóa Long — A: bơi/vượt cung/thu vây; B: hồ/Vũ Môn; C: Home+preview+tests.
- [ ] Scylla — A: thân/cuộn/sáu đầu lệch nhịp; B: vịnh biển/san hô; C: Home+preview+tests.
- [ ] Checkpoint: anatomy rồng/cá/Scylla, pose không giống gait bốn chân; no ghost/teleport.
- [ ] Chim Lạc — A: bước/vỗ/lượn/đậu/ngủ; B: bãi lau/trống đồng; C: Home+preview+tests.
- [ ] Phượng Hoàng — A: bay/đáp/tổ/thức; B: đá núi lửa/than ấm; C: Home+preview+tests.
- [ ] Anubis — A: bước/trượng/ngồi/thức; B: đền Ai Cập; C: Home+preview+tests.
- [ ] Garuda — chỉ bổ sung pose nối đáp–ngồi–thức và cảnh tan, giữ source/đường bay hiện có.
- [ ] Checkpoint cuối:16ID,3scale, Lv1/Lv2/Lv8, pause/resume, Reduced Motion, wake sớm, kéo và ảnh lỗi.
- [ ] Profiler release iOS/Android: target60FPS, frame pacing/RAM theo ngưỡng plan; ghi rõ những máy chưa đo được.
- [ ] Jest pet/Home và full suite cuối; TypeScript, ESLint, export; cập nhật SPEC/README/provenance và kết quả.
