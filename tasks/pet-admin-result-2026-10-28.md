# Quản lý linh thú admin — 28/10/2026

## Đã triển khai trong mã nguồn

- Home → Menu → Quản trị → Quản lý linh thú. Danh mục 15 loài có thumbnail
  tĩnh, tên/email/UID chủ hoặc người giữ chỗ, cấp độ/EXP, ngày nhận nuôi và
  tìm kiếm cục bộ. Chỉ admin được vào trang và gọi API.
- Dùng user-admin với JWT + kiểm tra Firebase admin hiện hành. SQL RPC chỉ
  service_role, cố định admin UID và kiểm tra trạng thái tài khoản/authTime.
  Level/stage tính phía server; profile theo một batch tối đa 15 UID.
- Thu hồi xác nhận và CAS adoptionId/UID/loài, actionId chống lặp, audit nguyên
  tử. Khóa access trước pet_account để đồng bộ với xóa tài khoản. Pet về kho,
  người nhận nuôi mới EXP 0/cấp 1; giữ nguyên lượt random/restore đã sử dụng.
- Chặn restore sau thu hồi và vô hiệu receipt cũ. Finance sync kiểm tra đúng
  adoption; RPC cũ cũng chặn snapshot trước adoption mới. Cache có generation
  và session fence. Home/màn Linh thú đọc trạng thái nhẹ khi đang mở; mất mạng
  giữ dữ liệu gần nhất đến khi đọc lại thành công.
- Không thêm thư viện hoặc thay Firestore rules. Plan và final diff đã được
  reviewer độc lập chỉ đọc; các finding về lock, sync cũ, cache đã được xử lý.

## Kiểm tra

- `npm run test:functions`: **395/395 đạt** (bao gồm PGlite và Edge handlers).
- Jest nhóm pet admin, pet API, refresh, admin transport, UserManagement,
  PixelPet và Home: **8 suite / 34 test đạt**.
- `npm run typecheck`, ESLint các file TypeScript thay đổi, `git diff --check`: đạt.
- Expo export iOS + Android: đạt, output ở
  `/private/tmp/lifemate-pet-admin-export-20261028`.
- Full Jest: **152 suite đạt / 2 suite lỗi**, 1337 test đạt / 1 test lỗi.
  `tabs.integration.test.tsx` chưa có mock native Worklets khi import HomePetRoamer;
  lỗi này đã tái hiện trên HEAD trước tính năng admin trong lượt animation.
  CardScore có một test timeout khi chạy toàn bộ; không thay code/check ngoài scope.
  Chạy riêng CardScore sau đó: **76/76 test đạt**, gồm test đã timeout.
- Simulator iOS: đã xác nhận menu admin mới, điều hướng, header/search/loading và
  trạng thái lỗi kết nối. Danh sách/confirm/retry/blur/quyền được kiểm tra bằng
  fixture Jest; không thu hồi hoặc thay đổi pet thật để test.

## Trạng thái production — deploy 28/10/2026

- Supabase project `xbhelntqytleiduzicuj` / LifeMate: migration
  `20261028052536_pet_admin_management.sql` đã áp dụng. Dry-run sau deploy báo
  database up to date. `pet-access` và `user-admin` đang ACTIVE (version 2 và
  14); request smoke không xác thực trả 401 `invalid-session`.
- Firebase project `baseapp-dd227`: Firestore Rules được biên dịch và phát hành;
  Storage Rules đã đúng phiên bản hiện tại và được giữ nguyên.
- Migration Thiên Lộc `20261028075042_pet_exclusive_celestial_stag.sql` đã được
  áp dụng sau lượt triển khai quản lý linh thú này; admin giữ nguyên adoption và
  EXP, còn Phượng Hoàng trở lại kho.
- App là iOS/Android native. `firebase.json` không cấu hình Hosting hoặc Firebase
  Functions và repository không có gói app build sẵn. Màn admin phía client cần
  được phát hành qua luồng app native để xuất hiện cho người dùng.
- Chưa kiểm chứng cạnh tranh transaction trên PostgreSQL thật hoặc thu hồi giữa
  hai thiết bị thật; PGlite không thay thế concurrency test. Smoke chỉ xác nhận
  endpoint từ chối request không xác thực.
