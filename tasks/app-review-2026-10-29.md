# Rà soát LifeMate — 29/10/2026

## Phạm vi và cách làm

- Baseline clean tại `a23d4ef`; đọc SPEC, callers và tests trước khi sửa.
- Main rà UI/navigation, animation, loading/error và đường gọi chung.
- Hai reviewer chỉ đọc rà dữ liệu/auth/session và game/điểm/tài chính; tối đa
  hai người cùng lúc, không lặp lại cùng một tìm kiếm.
- Chỉ sửa lỗi có trigger cụ thể; bỏ code khi có bằng chứng không còn caller.
  Không đổi kiến trúc, dependency, schema hoặc dữ liệu production để dọn code.

## Danh sách công việc

- [x] Typecheck/lint baseline: typecheck đạt, lint 0 lỗi / 4 warning trong tests.
- [x] Baseline Jest: 155/158 suite đạt, 1391 test đạt / 1 test lỗi; hai suite
  không chạy do thiếu mock Worklets, test blend còn kỳ vọng cũ.
- [x] Baseline functions: 398/398 test đạt.
- [x] Reviewer data: request pet không có deadline, có thể kẹt busy/polling.
  Plan: deadline cho token/fetch/JSON, abort khi timeout/đổi session, giữ actionId
  khi retry; test treo từng bước và phản hồi muộn. Reviewer đã chấp thuận.
- [x] Request pet: tái hiện cả token/fetch/JSON treo, sửa deadline/session abort,
  kiểm tra phản hồi muộn và retry giữ actionId.
- [x] Audio: tái hiện lỗi loading còn che điều khiển sau khi file đã phát;
  xóa lỗi cũ khi tải xong, regression red → green.
- [x] Game: ownerUid null bị worker/projection/score SQL fallback thành host.
  Reviewer duyệt kế hoạch, sửa JS + 3 hàm SQL; migration mới chỉ sửa projection
  owner sai ở phòng còn tồn tại, không thay điểm/membership/audit/receipts.
  Bốn regression JS + ba regression PGlite đạt, có vòng worker commit thật.
- [x] Sửa mock native ở tests điều hướng/admin, cập nhật test blend đúng SPEC
  hiện tại, giữ các assertions. Đổi require mock sang jest.requireActual để
  bỏ 4 lint warning, không tắt rule.
- [x] Review diff độc lập: cả hai reviewer không còn finding cần sửa.
- [x] Typecheck và lint cuối sạch; full Jest 158 suite / 1421 test đạt.
- [x] Backend cuối: 405/405 test đạt.
- [x] Expo export iOS + Android đạt, output
  `/private/tmp/lifemate-audit-export-20261029`.
- [x] Native iOS Simulator: Home, Linh thú, menu, MP3 và quản lý linh thú mở
  thành công; admin tải đủ 15 loài, dữ liệu chủ sở hữu/cấp/EXP và bộ lọc. Chỉ
  xem và điều hướng; lỗi treo mạng/audio chậm kiểm tra bằng regression có điều
  khiển thời gian, không giả mất mạng hoặc sửa dữ liệu thật trên Simulator.

## Ba lỗi đã sửa

| Mức | Trigger và ảnh hưởng | Thay đổi |
| --- | --- | --- |
| P2 | Token/fetch/JSON của pet không kết thúc → busy và rename không đóng được, polling dừng | `pixelPetApi.ts`: deadline tổng 25s, abort theo session, cleanup; giữ actionId khi retry. |
| P2 | Audio tải xong sau cảnh báo 12s → nhạc phát nhưng nút điều khiển vẫn bị lỗi che | `useAudioPlayback.ts`: dọn lỗi loading khi nguồn đã tải. |
| P2 | Phòng explicit `ownerUid: null` bị fallback thành người chơi/host → lấy lại quyền phòng/bảng điểm ngoài ý muốn | `worker.mjs`, `rooms.mjs` và migration: chỉ fallback cho trường thiếu; trigger và quyền ghi dùng cùng quy tắc; sửa projection lưu sai. |

Test lỗi đều chạy đỏ trước khi sửa. Hai reviewer duyệt kế hoạch phần dữ liệu và
quyền, sau đó review diff cuối không còn finding. Reviewer game tự chạy lại 7
regression JS/SQL và đều đạt.

## Giới hạn phạm vi

Đã chạy kiểm tra toàn bộ app và backend, đọc các đường quan trọng theo nhóm
auth/dữ liệu, game/điểm và UI. Đây không phải chứng nhận mọi dòng code hoặc mọi
trạng thái thiết bị đều không có lỗi. Chưa có bằng chứng đủ chắc về module
không còn caller để xóa; không gỡ tính năng dựa trên phỏng đoán.

Chưa chạy runtime Android, game nhiều thiết bị hoặc PostgreSQL nhiều connection.
SQL kiểm tra bằng PGlite. Các sửa lần này chưa deploy: phần quyền phòng cần áp
dụng migration `20261029022648_preserve_explicit_ownerless_rooms.sql` và deploy
`game-access`; request pet/audio cần bản app mới. Không đổi Firebase Rules nên
không chạy lại emulator rules.

Nguồn tham chiếu SQL: Supabase Database Functions,
https://supabase.com/docs/guides/database/functions; changelog kiểm tra 29/10.

Đây là rà soát mã nguồn và môi trường local; không tự deploy sửa lỗi trong lượt này.
