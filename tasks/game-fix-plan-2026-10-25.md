# Kế hoạch sửa sau review trò chơi — 25/10/2026

Review đã đối chiếu SPEC, code client/backend, quyền và bảng điểm; chạy baseline toàn bộ test, fuzz engine và probe HTTP/SQL cục bộ. Có bốn lỗi P2 được tái hiện. Không sửa các nghi vấn chưa có bằng chứng.

## 1. Rời phòng phải được xác nhận

- Lỗi: màn hình luôn điều hướng sau `send(leave)`, dù session bỏ qua vì busy/pending/disconnected hoặc request thất bại.
- Sửa: session trả kết quả xác nhận rõ ràng; chặn Back khi đang gửi/chờ thao tác; kiểm tra lại điều kiện tại callback xác nhận; chỉ điều hướng sau leave thành công hoặc snapshot mới xác nhận không còn phòng. Giữ đường quay lại ngoại tuyến có cảnh báo hiện tại.
- Test: thao tác khác đang chờ; leave bị từ chối/mất ACK; retry leave; leave thành công; không phát sinh lệnh ngoài ý muốn.
- Bổ sung sau review diff: kiểm tra kết thúc leave bằng snapshot session chuẩn, không bằng `room` dùng để hiển thị/cache. Khi vào từ lịch sử, cache có thể hiện lại sau `room:null`; phải điều hướng cả ACK đúng và ACK mất. Thêm regression trước sửa và reviewer kiểm tra lại phần này.

## 2. Xác nhận cũ không được bỏ cuộc ván mới

- Lỗi: alert từ lobby vẫn gửi leave với match mới nếu ván bắt đầu trong lúc alert đang mở.
- Sửa: chụp UID, epoch tài khoản, session, room ID, match ID và trạng thái ván lúc mở; xác nhận lại context hiện tại, quyền điều khiển, foreground và trạng thái sẵn sàng ghi trước khi gửi. Context thay đổi thì bỏ callback cũ; người dùng bấm Back lại để có cảnh báo phù hợp.
- Test: lobby → playing, đổi phòng/tài khoản/session, background, controller bị thay thế; vẫn rời bình thường khi context hợp lệ.

## 3. Giữ protocol của thao tác chưa xác nhận

- Lỗi: ACK bị mất sau fallback v8 → v7; retry cùng action ID thử v8 sau backend rollout, khiến fingerprint khác và 409 idempotency-conflict.
- Sửa (đã reviewer duyệt sau bổ sung): client dùng WeakMap theo request đang chờ, kèm UID/epoch; giữ nguyên object request qua retry trong session. Object còn sống thì phiên bản không bị loại do cache pressure; object hết dùng được thu gom tự nhiên. Thao tác mới vẫn thử v8; giữ minimum capability. Không đổi hash receipt hay dữ liệu đã lưu trên server.
- Test: fallback + mất ACK + retry sau rollout; action mới dùng v8; không lẫn tài khoản/session; minimum capability không bị vượt qua.

## 4. Giữ tên người đã rời trong kết quả

- Lỗi: khi nhiều người lần lượt rời giữa ván, người rời sớm bị ghi thành “Người chơi” dù `scoreMembers` vẫn lưu tên.
- Sửa: bổ sung fallback tên từ `state.scoreMembers` hiện tại trước nhãn chung; không đọc bản sao cũ bên ngoài transaction. Không đổi điểm, quyền hay schema.
- Test: Tiến lên/Phỏm 3 người, người thứ hai rời trước, người thứ ba rời kết thúc; tên và tổng tiền đúng. Dữ liệu hiện tại đã ẩn danh phải tiếp tục ẩn danh.

## Thứ tự và kiểm chứng

1. [x] Reviewer độc lập duyệt kế hoạch trước sửa vì liên quan session, hành vi bỏ cuộc và kết quả lưu trữ. Đã xử lý góp ý không được evict protocol của thao tác chưa xác nhận.
2. Thêm regression RED, sửa nhỏ và chạy GREEN từng nhóm.
3. Reviewer rà diff so với baseline đầu audit (không quy các thay đổi có sẵn thành thay đổi mới).
4. Chạy full Jest/functions, typecheck/lint và bundle iOS/Android. Probe lại đường bị ảnh hưởng; báo rõ giới hạn của mock auth/PGlite và chưa xác minh trên thiết bị thật.
5. Không đổi dependency, migration, cấu hình luật, điểm hay deploy trong đợt review này.

## Sửa lỗi xác nhận — 27/10/2026

- P2 / Tấn: ghế ở màn kết quả còn lấy roster ván cũ sau khi người cũ rời,
  người mới vào; người rời trong lúc chơi cũng mất tên dù snapshot còn tên.
  Regression phải kiểm tra người mới có ghế, người rời không có ghế sau kết
  quả, kết quả người rời vẫn giữ nguyên và tên người rời trong ván còn hiển thị.
- Sửa tối thiểu ở TanGameTable: khi chơi lấy participant snapshot, khi chờ ván
  kế tiếp lấy thành viên hiện tại; ưu tiên tên member rồi fallback participant.
  Không đổi engine, điểm, quyền, protocol hay dữ liệu đã lưu.
- Reviewer game_rules_audit_27 đã duyệt phạm vi sửa UI. Test RED trước sửa,
  GREEN sau sửa và rà diff cuối cùng cùng các phát hiện khác của lượt audit.

- P2 / Phỏm Tái: hai người móm trong kết quả có người có phỏm bị xếp theo
  thứ tự hạ thay vì lần đánh cuối. Ghi private `lastDiscardOrder` ở người đánh,
  bằng tổng discards còn trên bàn + số lượt ăn sau khi thêm lá vừa đánh. Ăn
  chuyển một lá từ discards sang eats nên số thứ tự tăng đúng một mỗi lần đánh.
  Chỉ dùng thứ tự này khi so hai người móm trong bàn có người còn chơi có phỏm.
  Hòa điểm có phỏm và tất cả người còn chơi móm vẫn xét thứ tự hạ; bỏ cuộc,
  người thắng và các mức điểm giữ nguyên. State cũ thiếu trường fallback laidOrder.
  Không lộ metadata qua view/snapshot, không rewrite kết quả đã lưu, không migration.
- Reviewer phom_audit_27 đã duyệt kế hoạch trước sửa. Regression: fixture Tái
  bảo toàn 52 lá, móm thường, tất cả móm (kể cả người bỏ cuộc đã có phỏm),
  hòa rác có phỏm, state cũ và privacy. RED → GREEN → review diff cuối.
