# Kế hoạch review và sửa trò chơi — 25/10/2026

## Rà soát tiếp — 27/10/2026

- Phạm vi hiện tại gồm cả Tiến lên Nam/Bắc, Phỏm, Sâm và Tấn; đối chiếu
  SPEC/rulesVersion đang triển khai, không áp đặt luật bên ngoài dự án.
- Main rà phòng, phiên/reconnect, protocol/capability, snapshot, bảng điểm và UI.
  Hai reviewer chỉ đọc rà độc lập nhóm Nam/Bắc/Sâm/Tấn và Phỏm; không full history,
  không sửa file hoặc delegate tiếp. Bảo toàn diff Ký ức đang có.
- Kiểm tra thêm tương thích luật v1/v2, mọi vị trí ghế/rời bàn, người đã về trước
  khi có bỏ cuộc, bảo toàn bộ bài và lượt hợp lệ sau timeout/forfeit.
- Chỉ sửa bug có bước tái hiện; lập và duyệt kế hoạch sửa trước thay đổi luật,
  quyền, hợp đồng hoặc dữ liệu điểm. Regression RED → sửa tối thiểu → GREEN.
- Chạy Jest nhóm game/điểm, backend game tests, typecheck/lint; mở rộng gate khi
  sửa đường dùng chung. Reviewer rà diff cuối; ghi phạm vi/giới hạn vào báo cáo.
  Không deploy hoặc tạo dữ liệu phòng thật trong lượt review.

## Mục tiêu và nguồn chuẩn

Review toàn bộ phần trò chơi đã triển khai: Tiến lên miền Nam, Phỏm, phòng,
kết nối/phiên, quyền chủ phòng, bảng điểm chung và UI. Dùng SPEC-card-games,
SPEC-rules-phom, SPEC-rules-tien-len-south và SPEC-card-score làm chuẩn; yêu cầu
mới trong hội thoại có ưu tiên nếu SPEC chưa cập nhật. Không coi biến thể luật
bên ngoài là bug LifeMate. Bảo toàn working tree hiện có.

Kế hoạch riêng theo ngày để không ghi đè các mục việc còn mở trong tasks/plan.md
và tasks/todo.md. Checklist của lượt này ở game-review-todo-2026-10-25.md.

## Trình tự bắt buộc

1. Lưu baseline file/hash/diff; lập bản đồ đường đi UI → hook/session → protocol
   → Edge handler/engine → RPC/worker → score/snapshot. Đọc báo cáo review24/10
   để không lặp lỗi đã sửa và không kế thừa kết luận cũ như bằng chứng mới.
2. Reviewer chỉ đọc phản biện kế hoạch trước khi review sâu. Tối đa2 reviewer
   đồng thời, không full-history và không sửa file hoặc delegate tiếp.
3. Rà độc lập hai mảng: backend/rules/privacy/RPC và client/UI/session/cache.
   Main sở hữu đối chiếu luật/tính điểm, shared score, test/probe và xác nhận bug.
4. Phân loại từng phát hiện P0–P3: bước tái hiện, đường dẫn/dòng, ảnh hưởng,
   nguyên nhân và bằng chứng. Phân biệt bug xác nhận, nghi vấn và hạn chế kiểm tra.
5. Lập kế hoạch sửa cho các bug xác nhận TRƯỚC implementation. Reviewer duyệt
   trước mọi sửa auth/quyền/contract/persisted/điểm, sau đó test RED → fix tối thiểu
   → GREEN. Không mở rộng tính năng hoặc refactor lớn trong lượt sửa.
6. Reviewer rà diff cuối, xử lý finding, chạy lại phần liên quan. Ghi báo cáo
   kiểm tra/phạm vi/giới hạn và những gì cần rollout; không tự coi review là deploy.

## Ma trận review

| Luồng | Trường hợp bắt buộc | Tiêu chí |
| --- | --- | --- |
| Phòng | tạo/join2–4; ghế5; ready đồng thời; ACK mất; leave/kick; đổi chủ; rejoin/reopen/delete | không out nhầm, đúng quyền/receipt/CAS/session |
| Phiên/mạng | offline/retry/foreground/account switch; takeover; worker lease cũ; phản hồi đảo thứ tự | không thao tác chéo tài khoản/phòng/ván, không mất snapshot hợp lệ |
| South | tổ hợp/chặt/bỏ/reset;2 chế độ; tới trắng; timeout/forfeit/cancel; rematch | luật SPEC,52 lá, input bất biến, tiến triển và delta0 |
| Phỏm | ăn hoặc bốc; bảo vệ lá ăn; hạ/gom/gửi; ù/ù tròn/đền; Tái/Gửi/Ù đền; rematch | luật SPEC, count/roster/stock,52 lá, delta0 |
| Luật phòng | owner/controller; config pin trong match; pending rules; capability1–8 | không đổi luật giữa ván hoặc mất options do client cũ |
| Snapshot | tay mình/nọc/tay người khác; finished/cancelled; avatar URL; result details/cache | chỉ lộ bài kết thúc đúng capability/thành viên; không lưu private payload |
| Điểm | result đúng1 lần; sửa/xóa/history; owner transfer; deleted board; account erasure | không replay điểm đã sửa/xóa; quyền server; không mất/khôi phục ngầm |
| UI |2/3/4 ghế, mọi viewer, dọc/ngang, popup/cuộn, lượt/ready/actions, stale dialogs | thao tác đúng bước/phiên, nội dung không che khuất và đúng người |

### Bổ sung sau review kế hoạch

- Kiểm tra credential hết hạn/thu hồi, tài khoản xóa, member bị loại và subscription
  realtime cũ: không đọc snapshot hoặc gửi thao tác sau khi quyền thay đổi.
- Ngắt/retry giữa commit kết thúc ván, ghi bảng điểm và ACK; sửa/xóa bảng điểm
  cạnh tranh với kết quả/heartbeat: atomic hoặc khôi phục được, không ghi trùng,
  replay hoặc mất chỉnh sửa. Phân biệt receipt idempotency với CAS conflict.
- Reviewer kế hoạch đã duyệt sau hai bổ sung này; bắt đầu review sâu.

## Kiểm chứng theo mức

- Baseline: full Jest (npm test -- --watchman=false), npm run test:functions,
  npm run typecheck, ESLint; lưu log ngoài repo, không in bí mật.
- Reuse probe multiclient24/10 nếu còn phù hợp; nâng lên capability8 khi kiểm
  result mới, tạo database/UID fixture cục bộ mới. Phòng2/3/4, cả2 trò, vòng
  kế tiếp/replace member/duplicate action/lease fence. Không dùng tài khoản thật.
- Fix: regression có ý nghĩa chứng minh RED trước fix. Test UI không thay cho
  phép đo native; PGlite không thay cho PostgreSQL nhiều connection.
- Cuối: test bị ảnh hưởng + full suite khi sửa đường đi dùng chung; typecheck,
  lint, diff-check; Expo export iOS/Android. Simulator khi có phiên chạy phù hợp.

## Rủi ro và giới hạn

- Có working tree từ các yêu cầu trước: chụp baseline, chỉ tự sửa phần xác nhận
  bug, không reset/stash/commit đè. Reviewer xem trạng thái hiện tại, diff cuối
  so baseline của lượt này.
- Code client và cloud có thể khác: đối chiếu source/version chỉ đọc nếu cần;
  không chạy db push toàn bộ hoặc thay lịch sử migration thủ công.
- Không đổi dependency hoặc giảm check để đạt PASS. Hạn chế native/production,
  thời gian thực và tải đa kết nối phải được nói rõ; không hứa không còn bug.
