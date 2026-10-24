# Phỏm online — kết quả implementation 23/10/2026

## Đã làm

- Thêm Phỏm khả dụng trong danh mục online, cùng create/join bằng mã phòng.
- Chủ phòng tự nhập từng mức: **nhì, ba, bét, ăn thường, ăn chốt, móm, ù,
  ù tròn, đền mỗi người và bỏ cuộc**. Mỗi mức nhận0..1.000.000.000; giá trị0 tắt
  khoản tương ứng. Cấu hình được server lưu, không đổi xuyên ván/reopen và mọi
  thành viên xem được trong popup luật. Muốn đổi mức thì tạo phòng mới.
- Engine server:9/10 lá, ăn/bốc/đánh, phỏm rời nhau giữ đúng lá ăn, hạ tự động
  hoặc nhóm tự chọn, gửi vào phỏm hạ trước, ù/ù gửi/ù tròn, đền3 cây/đền chốt,
  tính hạng/rác/móm và tổng tiền zero-sum. Tiền là điểm nội bộ như bàn hiện có.
- Bàn mới giữ hand/actions ở dưới; hiện người đánh và đồng hồ server, nọc,
  lá vừa đánh, phỏm và bài đã đánh. Có viewport/cuộn cho hand body, board và
  dialog công khai; xem lại được cả bài đã đánh của chính mình. Kết quả có từng
  khoản cộng/trừ; sẵn sàng và tự ghi bảng điểm chung dùng luồng hiện có.
- Server xử lý timeout, kick/leave và hết lease theo batch; hủy không tính điểm
  khi mọi người cùng mất kết nối. Giữ owner/session/CAS/receipt hiện có.
- Room cũ thiếu kind vẫn là Tiến lên. Client3 có parser và bàn Phỏm; client cũ
  bị chặn trước khi chiếm ghế/tiếp quản/mở lại Phỏm. South vẫn giữ fallback2→1.
  Snapshot chỉ trả bài người gọi và dữ liệu đã công khai, không trả nọc/tay khác.

Luật LifeMate **phom-v1 dùng4 lượt cố định, không tái**. Móm không gửi; sau hạ/gửi
có phỏm riêng và còn0–1 rác được ù thường. Ù tròn chỉ xét10 lá trước hạ/gửi.
Hạng4 dùng mức bét; ở2/3 người, hạng2/3 dùng mức nhì/ba. Các quy ước và ưu tiên
đền được ghi rõ trong popup và [SPEC-rules-phom.md](../SPEC-rules-phom.md).

## Review

Reviewer chỉ đọc đã review plan trước implementation và final diff theo snapshot
đầu task `/private/tmp/lifemate-phom-before-20261023`, không lẫn thay đổi cũ ởHEAD.

- Plan: bổ sung gate client cũ trước seating, nghĩa ù gửi, batch forfeit và sửa
  title hệ thống trong transaction tạo phòng.
- Final backend: sửa timeout từng chọn lá bất kỳ làm vỡ phỏm. Regression bộK
  lớn+rácJ thất bại trước sửa và đạt sau sửa; timeout chỉ chọn rác của layout tối ưu.
  Bổ sung engine fixtures ưu tiên đền3 cây → đền chốt → bỏ qua payer bỏ cuộc.
- Final client: giới hạn chiều cao theo root đo thực, body cuộn và card compact
  khi ngang; bổ sung bài đã đánh của local player. Test ràng buộc chiều cao và
  dialog public history, reviewer xác nhận không còn actionable finding.

## Kiểm chứng cuối

| Kiểm tra                       | Kết quả                                            |
| ------------------------------ | -------------------------------------------------- |
| `npm run typecheck`            | Đạt                                                |
| `npm run lint`                 | Đạt, không warning                                 |
| `npm test -- --watchman=false` | **133 suites /1.032 tests đạt**                    |
| `npm run test:functions`       | **229/229 tests đạt**                              |
| Phỏm HTTP bằng `service_role`  | Đạt, chạy riêng sau khi thêm đúng role vào fixture |
| Export iOS+Android offline     | Đạt, `/private/tmp/lifemate-phom-export`           |
| `git diff --check`             | Đạt                                                |

Engine fixtures bao phủ52 lá không mất/trùng, chơi trọn ván2–4 người, ăn/hạ/gửi,
ù/đền/timeout/forfeit và zero-sum. SQL/HTTP bao phủ create+config, chặn thay kind/
rate, stale/replay, draw/discard, old-client seating/takeover/reopen, title và một
dòng điểm sau kết quả. Parser tests chặn private fields/meld malformed/config sai.
UI tests bao phủ nhập độc lập từng mức,0/blank, create, draw/eat, lay/send, local
discard history, root-height constraint và giữ selected card trước commit.

Một lượt full Jest gặp lại test manual score deletion không ổn định đã tồn tại
trước task; không sửa production/test ở CardScore cho Phỏm. Cả67 tests nhóm đó
đạt khi chạy riêng; full Jest chạy lại không song song các gate nặng cũng đạt.

Logs: `/private/tmp/lifemate-phom-{jest,functions,typecheck,lint,export}-final.log`,
`/private/tmp/lifemate-phom-service-role.log`; focused RED/GREEN trong cùng tmp.

## Cập nhật deploy sau implementation

Ngày23/10/2026 người dùng đã xác nhận deploy. Backend **game-access v10 ACTIVE**,
hai migration score patch/Phỏm đã áp dụng riêng sau khi worker cũ kết thúc. Đã
đọc lại source khớp17 file; fixture PostgreSQL production hoàn tất ba ván2/3/4
người, kiểm đúng điểm từng người và đã rollback. Simulator hiện đã mở được app,
danh mục/form Phỏm và truy cập cuối form. Không tạo phòng thử bằng tài khoản thật.
Chi tiết ở [báo cáo cloud](phom-cloud-deploy-2026-10-23.md).

## Chưa xác nhận

- Chưa thử trọn ván native trên nhiều thiết bị thật, font lớn và dọc/ngang.
  Lỗi Hermes của lượt kiểm tra ban đầu không xuất hiện khi mở app ở lượt deploy;
  chưa coi kiểm tra form native là xác nhận toàn bộ bàn/scroll native.
- PGlite một connection không chứng minh concurrency PostgreSQL nhiều connection.
  Firestore rules không thay đổi; không chạy emulator thiếu prerequisite Java21.
- Cần smoke nhiều thiết bị, font scale và dọc/ngang sau khi có build/runtime phù
  hợp. Không khẳng định mọi biến thể Phỏm vùng miền đã được hỗ trợ.

## Triển khai

Đối chiếu history remote → deploy game-access/worker hai engine → chờ worker cũ
kết thúc → áp dụng migration → phát hành client3. Không chạy worker cũ chỉ hiểu
south khi còn phòng Phỏm. Backend đã deploy; chưa phát hành client/OTA. Xem [rollout](../docs/card-games-online.md),
[plan](phom-plan-2026-10-23.md) và [checklist](phom-todo-2026-10-23.md).
