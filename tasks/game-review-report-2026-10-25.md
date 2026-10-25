# Kết quả review trò chơi — 25/10/2026

Đã hoàn tất: lập kế hoạch → reviewer duyệt kế hoạch → review code và tái hiện lỗi → kế hoạch sửa được duyệt → regression RED → sửa → GREEN → reviewer rà diff và sửa finding bổ sung.

Kế hoạch: `game-review-plan-2026-10-25.md`. Kế hoạch sửa: `game-fix-plan-2026-10-25.md`. Reviewer chỉ đọc; main thực hiện mọi sửa và kiểm chứng. Bảo toàn các thay đổi có sẵn đầu lượt, không commit/deploy/migration hay đổi dependency.

## Phạm vi

- Tiến lên miền Nam và Phỏm: engine, lượt, luật/config, forfeit/timeout/rematch, tính điểm và snapshot riêng tư.
- Create/join/ready/leave/kick, quyền owner/controller, takeover, session/account epoch, retry/idempotency, realtime, worker/lease và cache.
- Bảng điểm chung: quyền sửa/xóa, patch/history, kết quả đúng một lần, cạnh tranh với kết thúc ván và dữ liệu xóa/ẩn danh.
- Client table/lobby/result details, người tham gia đã rời, ghế tương đối, dữ liệu hiển thị/cache và các callback xác nhận cũ.
- Đối chiếu SPEC-card-games, SPEC-rules-phom, SPEC-rules-tien-len-south, SPEC-card-score và yêu cầu hội thoại. Đọc lại review24/10; không dùng kết luận cũ thay cho bằng chứng mới.

## Lỗi đã xác nhận và sửa

| Mức | Lỗi và tình huống | Sửa |
| --- | --- | --- |
| P2 | Back khi ready/play đang busy hoặc pending: `send(leave)` bị bỏ qua nhưng screen vẫn điều hướng; thành viên vẫn ở phòng | Session trả xác nhận rõ ràng; chặn thao tác không sẵn sàng; chỉ thoát sau ACK hợp lệ hoặc snapshot chuẩn xác nhận không còn phòng. Giữ lối quay lại ngoại tuyến có cảnh báo |
| P2 | Mở xác nhận ở lobby, người khác ready làm bắt đầu ván rồi xác nhận cũ: vô tình bỏ cuộc ván mới | Kiểm tra lại UID/epoch/session/room/match/phase, foreground, kết nối và controller tại callback |
| P2 | Backend cũ hạ v8 xuống v7, thao tác commit nhưng mất ACK; backend nâng lên v8 rồi retry cùng action ID: fingerprint khác, 409 | WeakMap giữ protocol theo vòng đời request chưa xác nhận; session giữ identity request qua retry, kể cả optional Phỏm rules. Không đổi receipt/hash đã lưu; action mới vẫn dùng v8 |
| P2 | Ba người chơi; người B rời sớm, C rời kết thúc: kết quả ghi B là “Người chơi” dù scoreMembers còn tên | Fallback tên từ scoreMembers hiện tại; không thay đổi delta hay lấy lại tên ngoài state hiện tại |

Reviewer cuối phát hiện một hồi quy trong bản sửa leave: cache bàn đã kết thúc có thể hiện lại sau snapshot `room:null` khi vào từ lịch sử. Đã thêm hai regression RED (ACK thành công và mất ACK), kiểm tra canonical `serverRoom` thay vì room trình bày/cache; cả hai GREEN. Reviewer kiểm tra lại và không còn finding actionable.

Source sửa giới hạn ở CardGamesScreen, gameSession, gameApi và một dòng fallback trong rooms.mjs; kèm regression ở các test tương ứng. Tất cả diff của lượt review được so với bản sao baseline đầu lượt, không quy phần feature có sẵn vào audit này.

## Bằng chứng kiểm chứng

| Kiểm tra | Kết quả |
| --- | --- |
| Baseline Jest |135 suite /1130 test đạt |
| Baseline backend |266 test đạt |
| Regression mới |Chứng minh RED trước sửa, rồi GREEN. Gồm busy/pending, stale context, lost ACK, protocol retry qua session thật, cache pressure, capability fence, account epoch và tên kết quả2 trò |
| Full Jest cuối |135 suite /1148 test đạt |
| Full backend sau sửa |269 test đạt |
| TypeScript / ESLint / diff-check / format |Đạt; không giảm check |
| Expo export iOS + Android |Đạt cả hai bundle |
| Fuzz engine Phỏm |600 ván seeded /13387 bước,2–4 người, kết hợp options,577 lần ăn/86 gửi/1492 timeout; không phát hiện vi phạm parser,52 lá, input bất biến, delta0 hoặc kết thúc |
| HTTP + SQL đa client cục bộ |6 ván đầy đủ, cả2 trò,2/3/4 ghế,235 bước; receipt lặp, snapshot privacy, kết quả một lần, thay thành viên/rematch, takeover, quyền kick/owner, ghế5 đồng thời, heartbeat và worker lease cũ đạt |

Một lượt full Jest chạy cùng backend/export có một lỗi timing ở test Finance/HeldMoneyLedger ngoài phạm vi (baseline đạt). Không sửa Finance; chạy riêng đạt và full suite cuối đạt1148/1148. Các warning console có sẵn không bị tắt để làm xanh test.

## Giới hạn và rollout

- Probe HTTP dùng UID fixture/PGlite và actual handler/SQL; không thay cho Firebase token thật, mạng realtime production hoặc PostgreSQL nhiều connection. Fuzz là kiểm tra ngẫu nhiên có seed, không phải chứng minh mọi ván.
- Luồng UI được kiểm tra bằng React Native component tests và bundle native. Chưa xác minh các tình huống leave/race này trên điện thoại thật; phiên simulator demo hiện có không chạy luồng room session đó.
- Không có phát hiện P0/P1 được xác nhận trong phạm vi review; không khẳng định không còn bug ngoài các đường đã kiểm tra.
- Chưa deploy đợt sửa này. Cần cập nhật client để nhận sửa session/UI/protocol; deploy game-access để nhận fallback tên ở kết quả mới. Không sửa ngược các kết quả cũ đã lưu sai tên.

Baseline, patch audit, script/probe và log nằm tại `/private/tmp/lifemate-game-audit-20261025`; đây là dữ liệu tạm có thể bị hệ thống dọn. Báo cáo và kế hoạch trong repo là bản ghi bền vững.
