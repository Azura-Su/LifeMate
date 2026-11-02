# Khắc phục lỗi cache mã hóa — 02/11/2026

Người dùng báo ảnh Thu chi/Thu nhập/Chi tiêu có clouddata nhưng cache recovery,
Cho vay tải lỗi. Giữ nguyên mọi cache/khóa/dữ liệu thật và các thay đổi UI đang
làm song song. Chưa reset/cài lại, không coi fallbackcloud là dữ liệu local đã đủ.

- [x] Đối chiếu caller/SPEC/test và kiểm native AES bằng fixture tổng hợp.
- [x] Probe chỉ đọc trên runtime hiện tại, không in UID/khóa/ciphertext/plaintext.
- [x] Regression đỏ trước sửa cho guard khóa thiếu, Finance/Loan recovery và UI.
- [x] Sửa luồng cache và phục hồi, reviewer duyệt plan và final diff.
- [x] Chạy toàn bộ test liên quan, typecheck/lint/export và xác nhận runtime.

## Bằng chứng

- Crypto native roundtrip với khóa ngẫu nhiên tạm và chuỗi`probe` đạt; output là
  Uint8Array và TextDecoder hoạt động. Không phải lỗi ArrayBuffer như giả thuyết.
- Cache Tài chính của phiên hiện tại đọc được ciphertext và khóa, parse được
  sealeddata, nhưng native decrypt trả`ERR_UNEXPECTED`, khớp CryptoKit
  authentication failure. Không thay khóa hoặc dữ liệu để làm probe.
- Cho vay đọc cache trước cloudtry; lỗi giải mã chặn đọc cloud hoàn toàn.
- Reviewer phát hiện thêm P1: khi SecureStore trảnull, write có thể tạo khóa mới
  dù còn cache mã hóa của UID; Finance fallback edit sau đó ghi đè cache chưa
  phục hồi. Cần chặn tạo khóa trong trường hợp này; chưa chứng minh đây là sự
  kiện lịch sử cụ thể đã làm hỏng cache trên Simulator.

## Thay đổi

- Tách matcher ownership hiện có để chặn sinh khóa mới khi còn cache mã hóa;
  giữ API account cleanup tương thích và không thay hợp đồng key cũ.
- Finance preflight bốn cache trước mọi reconcile/mutation. Lỗi decrypt pending
  hoặc baseline không còn bị biến thành hàng đợi rỗng. Preflight không migrate
  plaintext; public reader vẫn giữ hành vi nâng cấp plaintext có sẵn.
- Loan cache/attempt lỗi vẫn đọc cloud, giữ read-only và không backfill/retire
  attempt. Ba atomic write trước đây ngoài queue được đưa vào cùng per-UID queue.
- Khôi phục có xác nhận riêng từng sổ: archive mã hóa immutable + readback,
  marker bền trước livewrite, whitelist targets, giữ marker khi lỗi/đổi phiên,
  resume có kiểm tra khóa và targets. Loan resume lấy cloud mới trước livewrite.
- Giao diện không báo refresh cloud thất bại chỉ vì đang recovery; sổ Cho vay
  tải lỗi không hiển thị như sổ rỗng. Hành động chỉnh sửa bị chặn khi recovery.
- HeldMoney đã đọc cloud trước cache và không có hàng đợi offline kiểu Finance;
  không mở rộng phạm vi khôi phục sang namespace này.

## Xác minh

- Reviewer độc lập duyệt plan và final diff; không còn finding về correctness,
  security hoặc mất dữ liệu. Reviewer không thực hiện phục hồi dữ liệu người dùng.
- Native fixture độc lập: restored=true, originalPreserved=true,
  markerCleared=true, fixtureCleaned=true. Không đụng UID/cache thật trong fixture.
- Simulator hiện tại: Thu chi báo đã lưu trên tài khoản, Cho vay hiện được khoản
  cloud. Không nhấn nút phục hồi trên dữ liệu người dùng và không reset/cài lại app.
- Chưa xác định được sự kiện lịch sử gây mất khả năng authenticate ciphertext;
  guard khóa mới ngăn một nguyên nhân khả dĩ nhưng không chứng minh nguồn lỗi cũ.
- Typecheck, lint các file thay đổi và export Android/iOS đều đạt. Full Jest lần
  đầu: 169/171 suites, 1796/1798 tests; Finance legacy-reader compatibility đã sửa,
  CardScore deletion pass khi chạy lại cả suite (75 tests khác cùng suite cũng qua).
  Lần chạy cuối trên source hoàn chỉnh: 171/171 suites, 1800/1800 tests đạt.
- Bổ sung regression đỏ cho cache Cho vay chưa tồn tại và không ghi được sau
  cloud read. Đã giữ merged/cloud data thay vì trả danh sách local rỗng, giữ
  attempt cũ và chặn mutation đến khi load ghi cache thành công hoặc khôi phục
  explicit hoàn tất. Reviewer duyệt plan và final delta; 2 test mới đạt.
- Typecheck/lint và export Android/iOS chạy lại sau delta cuối đều đạt.
  Artifact: `/private/tmp/lifemate-cache-recovery-export-complete`.
  Logs: `/private/tmp/lifemate-cache-full-jest-complete.log`,
  `/private/tmp/lifemate-cache-typecheck-complete.log`,
  `/private/tmp/lifemate-cache-lint-complete.log`,
  `/private/tmp/lifemate-cache-export-complete.log`.
- Không đổi backend/rules/functions; đợt deploy backend trước đã hoàn thành.
  Bản sửa này nằm ở client.
