# Kế hoạch review toàn ứng dụng — 22/10/2026

## Mục tiêu và phạm vi

Review kỹ trạng thái ứng dụng LifeMate hiện tại, ưu tiên các thay đổi đang có trong working tree chưa commit và kiểm tra các luồng liên quan đủ rộng để phát hiện lỗi xuyên tầng. Bao gồm TypeScript app, UI/navigation/state, persistence và bảo mật dữ liệu, Firebase/native integration, Supabase Edge Functions/RPC/migrations, server và các SPEC tương ứng. Đối chiếu với các báo cáo review trước để tránh lặp finding đã xử lý. Đây là review chỉ đọc: giữ nguyên mọi thay đổi dirty/untracked; không sửa mã, chạy formatter, tạo migration, commit, deploy hoặc ghi dữ liệu production.

## Cách review

1. **Chốt baseline và bản đồ hệ thống:** phân loại diff hiện tại, đọc test/spec liên quan, nhận diện luồng người dùng và ranh giới module. Ghi nhận các giới hạn do không có thiết bị/runtime/cloud production.
2. **Logic và dữ liệu:** rà invariants, trạng thái loading/error/offline, đồng bộ/xung đột, account/UID isolation, tính toán tài chính/điểm số, thao tác lặp và vòng đời async.
3. **Backend và bảo mật:** rà authz ở client lẫn server, kiểm tra input, RLS/rules, Edge handlers/RPC, migrations, quota, xóa dữ liệu và quyền native. Không giả định test/mock thay thế production.
4. **UI và điều hướng:** rà màn hình, dialog/sheet, layout nhỏ/keyboard/safe-area, loading/empty/error, accessibility labels/targets, trạng thái tương tác và platform differences; đối chiếu UI tokens và ScreenHeader.
5. **Kiểm chứng và báo cáo:** chạy các kiểm tra sẵn có phù hợp khi an toàn; phân biệt lỗi mới với baseline/environment. Mỗi finding phải có severity, file/dòng, điều kiện tái hiện, tác động và hướng sửa. Không có finding thì nêu rõ phạm vi/giới hạn review.

## Các lát cắt và tiêu chí hoàn tất

### 1. Shell, auth, profile và navigation
- [ ] Auth gate, session restore/logout/account switch và quyền truy cập màn hình không để lộ dữ liệu phiên trước.
- [ ] Điều hướng tab/drawer/back, header, focus/background và Android/iOS behavior nhất quán.
- [ ] Hồ sơ/avatar và quyền quản lý tài khoản giữ đúng ranh giới UID và trạng thái lỗi.

### 2. Home, Agenda, Notes và Checklists
- [ ] Hành vi ngày/giờ/timezone, CRUD, hoàn tất/bỏ hoàn tất và reminder khớp dữ liệu đã lưu.
- [ ] Offline/conflict/reload không mất dữ liệu hoặc hiển thị trạng thái stale sai.
- [ ] Các sheet/editor xử lý bàn phím, empty/error/loading và thao tác lặp tốt.

### 3. Finance, loans và held money
- [ ] Tổng hợp, filter, kỳ báo cáo, sửa/xóa và liên kết ledger không sai lệch hoặc nhân đôi.
- [ ] Khóa riêng tư, Face ID/account switch và dữ liệu mã hóa tuân thủ SPEC.
- [ ] Nhắc hạn và các giao dịch nhận lại/đóng hộ giữ đúng semantics.

### 4. Memories, sharing và private sync
- [ ] Đồng bộ ảnh, xác minh quyền, tùy chọn bạn bè và thao tác xóa không rò/chệch quyền.
- [ ] Upload/download/cancel/retry và trạng thái UI phản ánh đúng kết quả.

### 5. MP3/audio và native modules
- [ ] Import, quota, local-first, upload/sync, ghép/cắt, queue/player và xử lý lỗi bảo toàn file.
- [ ] Native iOS/Android lifecycle và quyền thiết bị phù hợp contract hiện tại.

### 6. CardScore và CardGames
- [ ] Quy tắc điểm/game, owner/member permissions, reconnect/cache/realtime và kết thúc/xóa phòng đúng invariant.
- [ ] Migration/RPC/Edge/client protocol nhất quán; nhập liệu và animation/UI không gây trạng thái sai hoặc khó thao tác.

### 7. UI dùng chung, specs và kiểm chứng
- [ ] Components/tokens/accessibility, responsive layout, contrast và hành vi platform được rà xuyên màn hình.
- [ ] Chạy typecheck, lint, test phù hợp, rules/functions và bundle nếu môi trường cho phép; ghi lại lệnh/kết quả.
- [ ] Rà diff cuối chỉ để đảm bảo không có thay đổi do reviewer và báo cáo findings theo severity.

## Rủi ro và giới hạn

- Working tree đang chứa nhiều thay đổi có sẵn chưa commit và untracked; kết luận phải gắn với đúng snapshot này, không quy nguồn gốc thay đổi cho lượt review.
- Rà code/test không thay cho kiểm thử trực tiếp trên thiết bị, dữ liệu thật hay backend production. Các lệnh có thể bị giới hạn bởi emulator, credentials hoặc nền tảng host.
- Không sửa finding trong lượt review này; nếu phát hiện lỗi, cung cấp finding đủ cụ thể để người dùng chọn sửa tiếp.
