# Rà soát linh thú, trò chơi và triển khai — 30/10/2026

## Phạm vi và lỗi đã sửa

Rà giao diện, sprite/playback, chu kỳ Home/ngủ/thức/kéo, quyền sở hữu và quản trị
linh thú; phòng chơi, session/retry, engine/điểm, cache và quyền ghi bảng điểm.
Giữ lại các thay đổi linh thú và tài sản đang làm trong working tree của người dùng.

- Home atlas không chuyển `onClipEnd` vào playback: clip Vui vẻ/Kỹ năng có thể
  dừng ở khung cuối. Đã nối callback và thêm regression.
- Atlas Home giữ trạng thái tải lỗi của loài trước khi đổi linh thú. Đã dùng
  species key để tải đúng atlas mới, có regression.
- Xóa cache phòng theo mã sau cold start chỉ kiểm tra bộ nhớ, bỏ sót snapshot
  mã hóa trên ổ đĩa. Đã đọc/validate cache cùng UID khi cần, giữ phòng khác và
  bảo vệ phòng mới xuất hiện trong lúc đọc; thêm bốn regression.
- Khai báo Node globals cho script đóng gói atlas để ESLint chạy đúng môi trường.
  Bỏ Python bytecode khỏi Git và thêm ignore. Các bản thử cảnh sói v2…v6 và
  preview ngày/đêm cũ được giữ ở thư mục tạm ngoài repo, không đưa vào bản phát hành.

Reviewer độc lập đã rà pet/game. Thay đổi persisted cache và kế hoạch migration
được rà trước khi sửa/triển khai; reviewer release rà lại sau triển khai và không
còn finding chặn commit/push.

## Production

| Dịch vụ | Kết quả |
| --- | --- |
| Firebase `baseapp-dd227` | Deploy thành công Firestore + Storage rules; server xác nhận nội dung đã khớp. |
| Supabase `xbhelntqytleiduzicuj` | `game-access` v20 ACTIVE; đọc lại22 file khớp source local. |
| `pet-access` / `user-admin` | v3 / v14 đã khớp local; giữ nguyên. |
| SQL | Áp riêng `20261029191125_south_instant_win_penalty` và `20261029191148_preserve_explicit_ownerless_rooms` sau hơn459 giây drain worker cũ. |

Migration có guard fingerprint/quyền trước khi áp; giữ nguyên chữ ký, wrapper
takeover4tham số, search path rỗng và grants service-only. Lịch sử production
được đối chiếu; không chạy `db push` toàn bộ lịch sử thủ công. Cron deadline vẫn
active. POST không có session tới game/pet đều bị từ chối `invalid-session`.
Reviewer đối chiếu độc lập cả9 function bodies được thay với SQL local, kiểm tra
validator chấp nhận cấu hình South legacy và capability12. Số projection owner
còn cần sửa là0. Không tạo fixture hoặc ghi dữ liệu thử lên production.

Security advisor có27 INFO về bảng RLS không có policy (các bảng chỉ được truy cập
qua backend) và một cảnh báo cho RPC kiểm tra quyền đăng ký Realtime, vốn cần
quyền authenticated. Không mở public access để làm mất các thông báo này.

Backups source/SQL trước triển khai và logs riêng nằm ở
`/tmp/lifemate-release-20261030`; không đưa thông tin xác thực vào Git.

## Kiểm chứng

- `npm run typecheck` và `npm run lint`: đạt.
- Toàn bộ Jest:166 suites,1536 tests đạt.
- `npm run test:functions`:405 tests đạt, gồm regression SQL trên PGlite sau khi
  đổi tên migration.
- `npm run bundle`: export iOS và Android đạt; mỗi bundle Hermes khoảng7.2MB.
- Firestore emulator rules suite đạt; dùng JRE21 tạm ngoài project vì máy có
  Java17. Các lỗi PERMISSION_DENIED trong log thuộc ca kiểm tra từ chối truy cập.
- iOS runtime smoke: mở được màn Linh thú với Mina/Thiên Dực Linh Lộc và sprite
  nghỉ hiển thị. Cửa sổ điều khiển thiết bị biến mất trong lúc thử tương tác;
  lần kết nối lại báo máy Mac đã khóa. Chưa xác nhận trọn chu kỳ chuyển động
  thực tế hoặc FPS trên thiết bị.

## Giới hạn

Firebase chỉ cấu hình rules, không có Hosting/Functions target cho UI. Project
chưa có EAS/Expo Updates để phân phối OTA; export native là kiểm tra đóng gói,
không phải phát hành ứng dụng lên App Store/Google Play. Giao diện và animation
trong commit cần build ứng dụng mới. Android runtime chưa khả dụng trong phiên.

Không thêm hay nâng dependency. `npm ci` trong `server/` chỉ khôi phục dependency
theo lockfile để chạy lint; npm báo8 moderate advisories sẵn có, chưa thay lockfile.
