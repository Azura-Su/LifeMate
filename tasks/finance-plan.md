# Implementation Plan: Quản lý thu nhập và chi tiêu

## Overview

Thêm tab Tài chính theo tài khoản Firebase hiện tại. Ghi nhận thu nhập (bao gồm lương) và chi tiêu, xem tổng thu/chi/chênh lệch theo tháng hiện tại và quản lý danh sách giao dịch. Dữ liệu lưu cục bộ tách theo UID qua AsyncStorage và Zustand; không đưa dữ liệu lên cloud.

## Architecture Decisions

- Mỗi UID có một AsyncStorage key riêng (`lifemate:finance:v1:<uid>`), tương tự thư viện audio.
- `financeStore` chỉ nhận kết quả nạp/ghi khớp UID đang bind để ngăn dữ liệu cũ lọt qua lúc đổi tài khoản.
- Giao dịch là một bản ghi chung với `type` income/expense, category, amount, note và timestamp; giao diện chọn loại bằng hai trạng thái rõ ràng.
- Không thêm dependency mới; form ngày lấy thời điểm hiện tại trong MVP.

## Task List

### Phase 1: Persistence foundation

- [x] Task 1: Thêm model, parser, UID-scoped storage và Zustand store.
  - Acceptance: số tiền sai bị từ chối; đọc/ghi tách UID; thao tác store không làm lộ giao dịch khi chuyển tài khoản.
  - Verify: unit tests cho parser/storage/store (11 tests pass).
  - Dependencies: None.

### Checkpoint: Foundation

- [x] Tests phần finance pass; typecheck pass.

### Phase 2: Finance screen

- [x] Task 2: Xây tab Finance với số liệu tháng, danh sách và form thêm/xóa giao dịch.
  - Acceptance: thêm thu nhập/lương hoặc chi tiêu; summary đúng; trạng thái loading/lỗi/rỗng rõ ràng; UI theo theme.
  - Verify: screen tests cho form, summary, list và UID switch (2 screen tests pass; store tests cover UID switch).
  - Dependencies: Task 1.

### Phase 3: Navigation and verification

- [x] Task 3: Thêm route/tab, icon, label và integration test.
  - Acceptance: tab Tài chính xuất hiện giữa Home và MP3; logout vẫn reset navigation hiện có.
  - Verify: integration test, 41 Jest suites / 160 tests, lint, typecheck, iOS/Android bundle pass.
  - Dependencies: Task 2.

### Checkpoint: Complete

- [x] Mọi acceptance criteria của SPEC-finance.md đạt.
- [x] Jest (41 suites / 160 tests), lint, typecheck và bundle Android/iOS thành công.

## Risks and Mitigations

| Risk                                     | Impact                            | Mitigation                                                 |
| ---------------------------------------- | --------------------------------- | ---------------------------------------------------------- |
| Tài khoản đổi trong khi storage đang tải | Có thể hiện dữ liệu sai người     | Guard UID ở store và bỏ kết quả cũ                         |
| JSON cục bộ lỗi                          | Có thể mất khả năng xem giao dịch | Báo lỗi có thể hiểu được, giữ dữ liệu gốc, không tự ghi đè |
| Giao dịch có timestamp không hợp lệ      | Sai tổng tháng/thứ tự             | Validate trước khi ghi và khi parse                        |

## Open Questions

- Cloud sync và giao dịch định kỳ nằm ngoài phạm vi bản đầu.
