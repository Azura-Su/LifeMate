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
