# Review trò chơi — 27/10/2026

Đã rà Tiến lên miền Nam/Bắc, Phỏm, Sâm và Tấn; xác nhận và sửa hai lỗi P2.
Không xác nhận lỗi P0/P1 trong các đường đã kiểm tra. Kết luận không phải bảo
đảm mọi tình huống đều không còn bug.

## Phạm vi và cách review

- Đối chiếu SPEC-card-games, SPEC-card-score và các SPEC-rules của năm game;
  đọc báo cáo25/10 để không lặp findings đã giải quyết.
- Hai reviewer chỉ đọc rà engine/luật/tính điểm; main rà handler/phòng/worker,
  snapshot, session/API/capability, cache, UI và quyền bảng điểm. Phỏm có thêm
  kiểm tra ăn/bốc/hạ/gửi, Tái/Ù đền và chi tiết bài cuối ván.
- Kế hoạch review và sửa nối tiếp trong game-review-plan-2026-10-25.md và
  game-fix-plan-2026-10-25.md. Reviewer duyệt kế hoạch sửa trước implementation;
  main làm regression RED → sửa tối thiểu → GREEN; reviewer rà diff cuối.
- Giữ nguyên các thay đổi Ký ức có sẵn. Không dependency, migration, commit,
  deploy hoặc ghi dữ liệu tài khoản/phòng thật trong lượt này.

## Lỗi đã sửa

| Mức | Tình huống và ảnh hưởng | Sửa và regression |
| --- | --- | --- |
| P2 | Phỏm bật Tái: A móm hạ trước C, chốt của A bị ăn và A đánh lượt thêm sau C; kết quả vẫn xếp A trước C vì dùng thứ tự hạ. Fixture52 lá cho kết quả D,B,A,C thay vì D,B,C,A theo SPEC | phom.mjs ghi thứ tự đánh riêng trong state nội bộ; phom-scoring.mjs dùng lần đánh cuối cho móm trong bàn có người có phỏm. Giữ thứ tự hạ khi hòa rác có phỏm hoặc tất cả người còn chơi móm, kể cả người bỏ cuộc đã có phỏm. State cũ fallback; không tính lại kết quả đã lưu. Test Tái bảo toàn52 lá, zero-sum, legacy và metadata không lọt vào view |
| P2 | Tấn: người B rời sau kết quả, C vào thì ghế còn roster ván cũ, không hiện C; người rời giữa ván bị mất tên dù snapshot còn giữ tên | TanGameTable dùng members hiện tại khi finished/cancelled, participants khi chơi; fallback tên từ participant. Ghế chờ hiện readiness, kết quả vẫn giữ B. Ba regression bao phủ tên người rời và thay thành viên sau finished/cancelled |

Hai reviewer cuối không còn finding actionable trong diff đã sửa. Không thay
luật/mức điểm của các game khác hoặc mở rộng tính năng trong lượt audit.

## Bằng chứng kiểm chứng

| Kiểm tra | Kết quả |
| --- | --- |
| Baseline Jest nhóm game/score/hooks/utils |33 suite,517 test đạt |
| Baseline backend nhóm game |219 test đạt |
| Tấn regression |Trước sửa3 fail/6 pass; sau sửa9/9 pass |
| Phỏm regression mới |Trước sửa3 fail/1 pass; sau sửa4/4 pass. Toàn bộ nhóm Phỏm52/52 pass |
| Reviewer kiểm tra độc lập |72 test engine Nam/Bắc/Sâm/Tấn; reviewer Phỏm chạy thêm15 test liên quan sau sửa, đều đạt |
| Probe seeded do reviewer thực hiện |315 ván leo bài +36 ván Tấn;26.975 action,61 batch rời. Tất cả kết thúc, lượt thuộc người còn hoạt động, bảo toàn52 lá; kiểm tra input bất biến ở probe Tấn |
| Full backend cuối (`npm run test:functions`) |363/363 đạt, gồm SQL/PGlite/HTTP/room/score/privacy |
| Full Jest cuối (`npm test -- --watchman=false`) |141 suite đạt/1 suite lỗi;1315 test đạt/1 lỗi. Lỗi có sẵn bên dưới |
| Typecheck / ESLint các file sửa / diff-check |Đạt |
| Expo export iOS + Android |Đạt cả hai bundle |

### Gate có lỗi sẵn

`src/navigation/__tests__/tabs.integration.test.tsx:248` mong7 mục tab ẩn nhưng
MainTabs hiện có6. Chạy riêng vẫn lỗi. Đã export bản HEAD chưa có các thay đổi
working tree vào `/private/tmp/lifemate-game-baseline-20261027`, dùng cùng
dependencies và chạy lại chính suite: cùng lỗi7/6,18 test khác đạt. Không sửa
navigation hoặc giảm assertion trong lượt review game. Vì vậy không báo full
Jest đã xanh. Warning act/native có sẵn vẫn được giữ trong log.

## Giới hạn và rollout

- Các probe có seed và test mock/PGlite chỉ bao phủ hữu hạn; không thay cho
  PostgreSQL nhiều connection, mạng Realtime production hoặc nhiều điện thoại.
- UI lần này kiểm bằng component tests và bundle, chưa chạy các race/rematch
  trên thiết bị thật. Không tạo phòng thật chỉ để làm fixture review.
- Chưa deploy. Cần deploy `game-access` để nhận sửa xếp hạng Phỏm, cập nhật
  client để nhận sửa ghế Tấn. Không migration hoặc backfill; metadata cũ không
  có thì giữ fallback ổn định, không dựng lịch sử lượt đánh đã mất.
- Log nằm dưới `/private/tmp/lifemate-game-*-20261027.log`, log baseline lỗi
  tại `/private/tmp/lifemate-tabs-head-baseline-20261027.log`; dữ liệu tạm có thể
  bị hệ thống dọn. Báo cáo này là bản ghi bền vững.
