# Kết quả sửa 7 findings — 23/10/2026

Đã xử lý cả7 findings trong
[review source](full-app-source-review-2026-10-23.md). Phạm vi là bản source trong
workspace. Không commit, deploy, chạy migration remote hay thử với dữ liệu thật.
Giữ các thay đổi đã có trước lượt sửa.

## Thay đổi

| Finding                                      | Kết quả và regression                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Mất bảng online cũ khi finish/archive mới | Predicate xét latest update/archive; thêm `localFinishedAt` riêng cho device, giữ khi refresh, xóa khi resume. Không đổi timestamp server. Known purged rooms vẫn bị chặn. Storage tests bao phủ finish/archive sau cutoff, refresh, resume và metadata giả từ server.                        |
| 2. Mất draft ghi chú ngày khi lưu            | Khóa cả title/body trong lúc saving, mở lại khi lỗi và giữ draft. Home component test dùng save promise chờ.                                                                                                                                                                                  |
| 3. Gửi lời mời vượt quota                    | RPC service-only khóa UID/email theo thứ tự, count+insert trong transaction:20 attempts/24h,20 outgoing cộng chung hai bảng,20 inbox. Handler gọi RPC bằng verified UID, giữ phản hồi generic và HTTP429 cho daily limit. SQL/handler tests bao phủ mixed pending, claim và rate mapping.     |
| 4. Reminder được tạo lại sau logout          | Capture epoch trước enqueue và trước các store operations; kiểm tra sau await, chặn stale state/reconcile, hủy native ID vừa trả về nếu phiên đổi. Regression cho permission pending, native schedule pending, queued schedule/reconcile và load/save/complete/remove sau login lại cùng UID. |
| 5. Vào/mở phòng sau khi mất gameUsers        | Controls và callback dùng chung live access condition; revoke abort pending entry. Tests cho nút ẩn, pending status, pending reopen và không navigate muộn; bảng điểm vẫn đọc được.                                                                                                           |
| 6. Không sửa được bảng điểm lớn              | Client gửi bounded patch từ đúng editor base; server merge dưới room/table locks rồi dùng owner/CAS/receipt/audit/tombstone cũ. Giữ body limit và legacy save. Regression bảng3.001ván vượt262KB: rename/finish/edit/delete round/remove player, quyền owner, stale version và replay.        |
| 7. Nhận bạn vượt100                          | Accept RPC khóa cả hai UID trước count+insert. SQL tests ở99/100, xác nhận cap cả phía nhận lẫn phía gửi; ACL của invite/accept/claim/lock không cấp cho anon/authenticated.                                                                                                                  |

Các friendship/pending có sẵn không bị tự xóa hoặc cắt ngắn. Các quota mới ngăn
admission tiếp theo vượt giới hạn; không tự sửa dữ liệu vượt quota nếu đã tồn tại.

## Review và kiểm chứng cuối

- Plan đã được review trước các thay đổi có rủi ro về dữ liệu và API.
- Reviewer backend và client đọc diff riêng so với snapshot đầu task, không chỉ
  HEAD vốn có nhiều thay đổi cũ. Không còn actionable finding trong phần sửa.
  Finding bổ sung về epoch ở agendaStore đã sửa và được reviewer xác nhận lại.
- `npm run typecheck`: đạt.
- `npm run lint`: đạt.
- `npm test -- --watchman=false`: **130 suites /1.022 tests đạt**. Watchman mặc
  định bị sandbox chặn ghi state; dùng Jest file crawler, không bỏ suite/check.
- `npm run test:functions`: **211/211 tests đạt**, gồm SQL PGlite và HTTP routes.
- Offline Expo export iOS+Android: đạt. Output
  `/private/tmp/lifemate-seven-export-20261023`.
- `git diff --check`: đạt. Chỉ format các file liên quan lượt sửa.
- Logs cuối: `/private/tmp/lifemate-seven-{jest,functions,typecheck,lint,export}-final.log`.

## Giới hạn

- PGlite là một connection: các batch Promise kiểm tra state/quota nhưng không
  chứng minh hành vi khóa khi PostgreSQL có nhiều connection. Chưa có runtime
  PostgreSQL nhiều connection cục bộ để chạy kiểm tra đó.
- Không chạy Firebase rules emulator vì môi trường thiếu Java21. Không đổi rules
  trong lượt sửa.
- Chưa kiểm chứng notification thật trên thiết bị iOS/Android. Native bundle
  thành công không thay thế kiểm tra thời điểm callback/OS notification.
- Bảng lớn vẫn được đọc/cache như trước; patch xử lý giới hạn request khi sửa,
  không thêm phân trang read hoặc đổi chính sách lưu lịch sử.

## Triển khai

Hai migration mới:

1. `supabase/migrations/20261022185328_memory_invite_quota_transactions.sql`
2. `supabase/migrations/20261022185526_shared_score_patch_operations.sql`

Đối chiếu migration history môi trường đích và áp dụng migration trước Edge
`memory-access`/`game-access`, rồi phát hành client dùng patch. Legacy `save` vẫn
được hỗ trợ. Không push toàn bộ migration cục bộ khi chưa đối chiếu remote.
Các bước triển khai chưa thực hiện; chi tiết rollback ở
[kế hoạch sửa](full-app-review-fixes-plan-2026-10-23.md).
