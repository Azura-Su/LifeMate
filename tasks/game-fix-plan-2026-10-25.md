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
