# Phỏm: Tái, Gửi bài, Ù đền — 23/10/2026

## Yêu cầu và quyết định

Thêm ba lựa chọn độc lập trước khi tạo phòng; dùng cùng form sửa luật ván tới.
Người dùng đã chọn Tái theo biến thể dịch lượt khi ăn ở vòng hạ.
Mặc định giữ hành vi cũ: Tái tắt, Gửi bật, Ù đền bật.

- Optional `phomConfig.options` chứa đủ `tai`, `send`, `uDen` kiểu boolean.
  Thiếu options giữ nguyên cấu hình cũ, không tự normalize dữ liệu đã lưu.
- Tái: ăn sau lần hạ đầu tiên giảm một lượt đã đánh của người cấp lá, để
  người đó được quay lại. Giữ phỏm/thứ tự hạ ban đầu; hạ thêm từ rác; được
  gửi vào mọi phỏm đối thủ đã hạ nếu Gửi bật. Ăn trước vòng hạ giữ biến thể cũ.
- Gửi tắt: server từ chối thao tác, giao diện không hiện nút gửi.
- Ù đền tắt: không gán người cấp3 cây/ăn chốt làm người đền; người thua trả
  mức ù/ù tròn của mình. Khoản ăn/chốt và mức bỏ cuộc giữ nguyên.
- Options hiện tại bất biến trong match; pending chỉ áp dụng khi chia ván mới.

## Triển khai và review

Main agent thực hiện toàn bộ thay đổi, giữ các thay đổi có sẵn trong working
tree; baseline ở `/private/tmp/lifemate-phom-options-before-20261023`.
Reviewer độc lập đã review kế hoạch và diff. Đã xử lý ba phát hiện:

1. Không trả pending options cho v6 để parser10 trường cũ vẫn chơi ván cũ.
2. Tái cho người hạ đầu gửi vào phỏm người đã hạ sau họ; thứ tự gốc chỉ dùng
   phân hạng hòa điểm.
3. Shared request path giữ minimum7 cho sync/lease và bootstrap sau reconnect,
   kể cả metadata bootstrap đầu chưa publish vào UI. Có regression cho cả
   current và pending options. Review lại các sửa này không còn P1/P2.

## Kiểm chứng

- RED/GREEN: config, gửi tắt, ù đền tắt, tái và form ba công tắc.
- 96 ván engine2–4 người, mọi tổ hợp options, ăn nối tiếp/timeout: hoàn tất,
  bảo toàn52 lá, bounds protocol và tổng delta0.
- Jest toàn bộ:133 suites,1.062 tests đạt.
- Backend toàn bộ cuối cùng:261 tests đạt, gồm test tạo trực tiếp config
  có options và tên migration trùng lịch sử production.
- TypeScript, ESLint các file TS/TSX thay đổi, diff whitespace đạt.
- Export iOS/Android đạt: `/private/tmp/lifemate-phom-options-export`.
- Parser v6 thật từ baseline, compile trong fixture: nhận snapshot current
  cũ với pending options bị bỏ; từ chối full pending v7 như dự kiến.
- Simulator dùng component thật trong harness cục bộ: ba switch hiển thị,
  lưu và mở lại đúng Tái bật/Gửi tắt/Ù đền tắt; quan sát form dọc và ngang.
  App chính server8081 đã mở lại đúng phần Tạo mới Phỏm và hiển thị cả ba
  switch. Không tạo phòng thật. Không xác nhận vuốt cuộn ngang bằng automation vì gesture không làm thay
  đổi viewport; không kết luận đây là lỗi sản phẩm. Không thử nhiều máy thật.
- Hai ca Jest bảng điểm/lỗi xóa tài chính bị timeout trong lượt chạy đầu
  khi chạy đồng thời functions/export; cả74 tests của hai suite chạy riêng
  đạt và full rerun1.062 đạt. Không sửa source/assertion/timeout hoặc skip.

## Production

Project `xbhelntqytleiduzicuj`, `game-access` v14 ACTIVE. Đối chiếu18 files
read-back bằng payload, chỉ thay handler/rooms/phom/phom-scoring từ v13.
`verify_jwt=false` giữ nguyên do endpoint xác thực Firebase bằng verifier cũ.

1. Migration `20261023154433_phom_options_capability`: mở takeover1..7,
   yêu cầu7 nếu có options; validator vẫn chặn options trong giai đoạn này.
2. Edge v14 deploy hoàn tất15:44:43UTC.
3. Sau421 giây chờ execution cũ kết thúc, bật validator/status bằng
   `20261023155152_phom_optional_rules`.
4. SQL thật rollback fixture đạt3 phòng2/3/4 người,46 bước,6 kết quả; kiểm
   tra edit/owner/CAS/receipt, luật mới ở rematch, điểm/số dòng/idempotency.
   Chạy thêm fixture tạo trực tiếp config có options cũng đạt3 phòng tương tự.
5. Mode open, deadline cron active. Validator/status/cả2 takeover signatures
   chỉ service_role execute; anon/authenticated=false. Probe phòng/ghế/receipt
   bằng0 sau rollback. Không thay đổi phòng/tài khoản người dùng.

Security advisors giữ nguyên19 INFO bảng service-only RLS không policy và1
WARN subscribe RPC security definer có chủ ý; không có phát hiện mới. Hướng
xử lý advisory cũ: [Supabase function privileges](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
Một truy vấn unified logs trả lỗi backend; thời gian drain dùng clock thực,
không tuyên bố đã đọc/đối chiếu version trong log.

Backup payload/v13/SQL/fixture/task diff ở
`/private/tmp/lifemate-phom-options-deploy-20261023`.
CLI-created draft migration đã đổi tên theo timestamp connector thực tế.
Không push toàn bộ migration history cũ. Sau kích hoạt cần giữ engine hiểu
options, sửa tiến tiếp; không rollback v13 hoặc xóa options người dùng đã chọn.
Chưa phát hành OTA/bản cài. Không commit/push thay đổi có sẵn của người dùng.

## Runtime setup

Metro localhost mặc định nghe IPv6, Simulator request IPv4. Auto-review từ
chối phương án LAN; đã dùng phương án an toàn hơn: `NODE_OPTIONS` ưu tiên
IPv4 và `--localhost`, xác nhận chỉ listen127.0.0.1. Không mở source ra LAN.

Hoàn tất: backend v14 trả401 invalid-session cho request không đăng nhập;
preview localhost đã dừng, Simulator đã trở lại app chính. Không còn bước
triển khai backend nào cho tính năng này; UI cần OTA/bản cài mới trên máy khác.
