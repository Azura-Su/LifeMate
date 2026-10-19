# Rà soát toàn dự án — 16/10/2026

## Phạm vi và phương pháp

Rà soát theo module: UI/navigation/profile/login, Home/calendar, Finance/loans/held funds/shared expenses, Memories, MP3/audio/playlist, notes/agenda/checklists/card score, persistence/session isolation, Firebase rules và Supabase functions. Kiểm tra thêm công cụ gửi push trong `server/`.

Giữ nguyên thay đổi từ các tác vụ trước. Main kiểm tra luồng gọi, tests và utilities trước khi sửa; explorer đọc audio/utilities, reviewer độc lập đọc backend/security và duyệt plan + diff của các sửa đổi nhạy cảm. Không khẳng định đã đọc từng dòng hay kiểm chứng mọi tổ hợp dữ liệu/thiết bị.

## Lỗi đã sửa

1. **P1 — Xóa nhầm cache tài khoản khác.** Key `lifemate:loan-repayment-attempt:v1:bob:alice` từng bị coi thuộc Alice vì loanId ở segment cuối trùng UID. Hai họ repayment/advance nay chỉ so segment owner. Regression thất bại trước sửa, qua sau sửa.
2. **P2 — Cleanup job chưa xong có thể chiếm hàng đầu.** Mỗi batch đã lấy lease đặt lần chạy sau; truy vấn bỏ qua lease đang hiệu lực. Regression có hai job chưa hoàn tất, job thứ ba và job đang lease, xác nhận job thứ ba được xử lý ở lượt sau.
3. **P2 — Publish đồng thời vượt quota Ký ức.** Count rồi insert rời rạc từng cho phép 99 + hai publish thành 101. Chuyển sang RPC transaction, advisory lock theo owner và row lock cho mục hiện có. Giữ 409 `already-shared`, 429 `memory-limit`; pending retry không chiếm slot mới. Chỉ service_role được gọi RPC. Thêm hai regression handler và kiểm tra PostgreSQL thực tế.
4. **Lint backend.** AWS import của user-admin dùng import map Deno nhưng chưa được áp dụng override ESLint hiện hữu. Mở rộng đúng thư mục; bỏ biến encodePath không dùng.

Các sửa cache/scheduler và quota đã qua reviewer độc lập, không còn finding cần sửa trong diff này.

## Kiểm chứng

| Kiểm tra                        | Kết quả                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`             | Qua; chạy lại sau sửa                                                                                                                               |
| `npm run lint`                  | Qua; lint lại các file thay đổi sau sửa quota                                                                                                       |
| Full Jest                       | 85 suites / 462 tests qua                                                                                                                           |
| Targeted accountCleanup Jest    | 3 tests qua sau sửa                                                                                                                                 |
| `npm run test:functions`        | 55 tests qua, gồm quota concurrent/pending và scheduler fairness                                                                                    |
| Expo export iOS + Android       | Qua, Hermes bundles trong `.build/audit-2026-10-16` (ignored)                                                                                       |
| `npm --prefix server run check` | Qua, không gửi push thật                                                                                                                            |
| `git diff --check`              | Qua                                                                                                                                                 |
| PostgreSQL quota                | Hai session đồng thời từ 99: một `saved`, một `memory-limit`, tổng 100; pending retry `saved`; anon/authenticated không có EXECUTE, service_role có |

UI trực tiếp trên iPhone 17 Pro Max Simulator: khởi động lại Home, mở/đóng lịch (ngày âm/dương, năm, hàng ghi chú), Drawer, Profile với trạng thái email đã xác nhận, Ký ức riêng/bạn bè và empty states, MP3 playlist và thư viện có 5 bài. Không thấy lỗi bố cục/crash trong các bước này. Không thay tên/avatar, thêm/xóa dữ liệu thật hoặc gửi lời mời thật để thử.

**Giới hạn runtime:** Tài chính và Ghi chú yêu cầu mã khóa thiết bị; không kiểm tra phần sau khóa. Camera thật, Face ID, push, audio native cắt/ghép và Android runtime cần thiết bị/môi trường tương ứng. Bundle không thay thế kiểm tra native. Firebase rules không thay đổi trong đợt sửa audit này, không chạy lại emulator rules trong đợt này.

## Dependency audit

`npm audit --omit=dev --json`: 41 mục dependency được đánh dấu (29 high, 12 moderate, 0 critical). Đây là số mục trong dependency graph, không phải 41 lỗi độc lập trong mã ứng dụng. Đường phụ thuộc và advisory đã được kiểm tra:

- `braces@3.0.3` qua Jest/micromatch: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), chưa có phiên bản vá được advisory công bố.
- `node-forge@1.4.0` qua Expo CLI/code signing: [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), chưa có phiên bản vá được advisory công bố.
- `sprintf-js@1.0.3` qua Jest/Istanbul/js-yaml/argparse: [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), chưa có phiên bản vá được advisory công bố.
- `uuid@7.0.3` qua Expo config plugins/xcode: [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq). Có bản vá major mới, nhưng caller xcode hiện dùng `uuid.v4()` không truyền output buffer; advisory nói đường v3/v5/v6 có buffer. Chưa thấy đường khai thác trong caller này.

Chưa có bản nâng nhỏ đã xác minh tương thích để xử lý hết các cảnh báo trên. Không dùng `npm audit fix --force`: đề xuất hiện có gồm downgrade Expo 44 hoặc đổi major RN/Firebase. Giữ package/lockfile; cần theo dõi upstream và nâng Expo/toolchain có kiểm tra native riêng.

## Triển khai

- RPC migration `202610160003_memory_publish_quota.sql` đã áp dụng trước handler mới, không đổi/xóa dữ liệu hiện có.
- Edge Functions `user-admin` và `memory-access` đã deploy thành công trong project LifeMate.
- Không gọi cleanup sweep trên production hoặc xóa/khóa user thật để kiểm thử.

Bài kiểm tra PostgreSQL dùng profile synthetic riêng và đã dọn sạch profile/các bài giả sau khi hoàn tất. Lần đầu hai CLI khởi tạo role tạm cùng lúc gây lỗi mật khẩu role tạm (không phải lỗi RPC); đã dọn fixture rồi chạy lại bằng cách để CLI thứ nhất kết nối xong trước khi CLI thứ hai khởi tạo. Hai transaction vẫn chồng thời gian (transaction đầu giữ lock 15 giây), lần chạy lại qua toàn bộ assertions.
