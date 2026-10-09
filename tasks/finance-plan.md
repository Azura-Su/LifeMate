# Implementation Plan: Quản lý thu nhập và chi tiêu

## Overview

Thêm tab Tài chính theo tài khoản Firebase hiện tại. Ghi nhận thu nhập (bao gồm lương) và chi tiêu, xem báo cáo năm trong khoảng tháng tùy chọn, nhóm giao dịch và tổng hợp theo tháng. Firestore giữ dữ liệu bền theo UID; Zustand dùng cho state và AsyncStorage làm cache/offline fallback.

## Architecture Decisions

- Mỗi UID có Firestore path riêng (`financeAccounts/<uid>/transactions/<id>`), bảo vệ bằng Firestore rules; AsyncStorage cache dùng key riêng (`lifemate:finance:v1:<uid>`).
- Dữ liệu thu chi cũ trên máy được migrate lên Firestore một lần; bản ghi mới cập nhật cloud trước khi báo đã đồng bộ.
- `financeStore` chỉ nhận kết quả nạp/ghi khớp UID đang bind để ngăn dữ liệu cũ lọt qua lúc đổi tài khoản.
- Giao dịch là một bản ghi chung với `type` income/expense, category, amount, note và timestamp; giao diện chọn loại bằng hai trạng thái rõ ràng.
- Không thêm dependency mới; nhập ngày phát sinh theo dạng `DD/MM/YYYY`, mặc định là ngày hiện tại.

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

## Mở rộng: Báo cáo theo năm và khoảng tháng

- [x] Task 4: Thêm hàm báo cáo năm/khoảng tháng, tổng theo tháng và xác thực ngày giao dịch.
  - Acceptance: lọc đúng năm và tháng đầu/cuối bao gồm; tháng ngoài kỳ bị loại; ngày giao dịch hợp lệ được chuẩn hóa an toàn.
  - Verify: unit tests cho date parser, tổng kỳ, chia nhóm tháng và khoảng không hợp lệ pass.
  - Dependencies: Task 1.
- [x] Task 5: Cho chọn năm/tháng trên màn hình, hiển thị giao dịch theo nhóm tháng và subtotal; cho chọn ngày khi thêm giao dịch.
  - Acceptance: đổi năm/khoảng tháng cập nhật nhóm và tổng; nhập được giao dịch ngày trước đó; tổng tháng và tổng kỳ khớp từng dòng.
  - Verify: 3 component tests cho nhập ngày, lọc tháng, đổi năm pass; UI đã xem trên iOS Simulator.
  - Dependencies: Task 4.
- [x] Task 6: Chạy lại Jest, typecheck, lint và bundle Android/iOS.
  - Acceptance: không hồi quy báo cáo và cách ly UID.
  - Verify: Jest (41 suites / 164 tests), typecheck, lint và bundle Android/iOS đều pass.
  - Dependencies: Task 5.

### Checkpoint: Báo cáo năm hoàn tất

- [x] Acceptance criteria của báo cáo năm và kỳ tùy chọn đạt.

## Mở rộng: Lưu bền theo tài khoản

- [x] Task 7: Lưu giao dịch trong Firestore theo UID, giữ cache AsyncStorage riêng từng UID và migrate dữ liệu local cũ khi kết nối.
  - Acceptance: đăng nhập lại cùng UID có thể tải giao dịch cloud; khi offline vẫn xem cache và trạng thái chưa đồng bộ được báo rõ.
  - Verify: cloud storage tests cho khôi phục sau khi cache mất, tách UID, migrate một lần, offline fallback và lỗi xóa.
  - Dependencies: Task 1.
- [x] Task 8: Thêm Firestore rules giới hạn đường dẫn giao dịch theo UID và kiểm tra bằng emulator.
  - Acceptance: chủ UID đọc/ghi/xóa đúng giao dịch; khách hoặc UID khác bị từ chối; dữ liệu sai schema bị từ chối.
  - Verify: 29 assertions Firestore/Storage rules pass trên emulator.
  - Dependencies: Task 7.
- [x] Task 9: Chạy toàn bộ kiểm tra sau khi thêm cloud sync.
  - Acceptance: không hồi quy UI, state, báo cáo năm hay audio.
  - Verify: 42 Jest suites / 172 tests, typecheck, lint và bundle Android/iOS pass.
  - Dependencies: Task 8.
- [x] Task 10: Publish rules đã kiểm thử lên Firebase project `baseapp-dd227`.
  - Verify: rules được publish ngày 08/10/2026; nhập và xác minh 172 giao dịch lịch sử thu nhập trên Firestore theo tài khoản hiện tại.
  - Dependencies: Task 8.

- [x] Nhập dữ liệu lương và khoản thu lịch sử từ 2023 đến 2026 vào tài khoản hiện tại; chỉ nhập từng dòng giao dịch, bỏ qua tổng phụ tháng.

## Risks and Mitigations

| Risk                                     | Impact                            | Mitigation                                                   |
| ---------------------------------------- | --------------------------------- | ------------------------------------------------------------ |
| Tài khoản đổi trong khi storage đang tải | Có thể hiện dữ liệu sai người     | Guard UID ở store và bỏ kết quả cũ                           |
| JSON cục bộ lỗi                          | Có thể mất khả năng xem giao dịch | Báo lỗi có thể hiểu được, giữ dữ liệu gốc, không tự ghi đè   |
| Giao dịch có timestamp không hợp lệ      | Sai tổng tháng/thứ tự             | Validate trước khi ghi và khi parse                          |
| Cloud chưa kết nối                       | Mất sao lưu mới khi gỡ app        | Giữ cache cục bộ, báo trạng thái chưa đồng bộ và cho thử lại |

## Open Questions

- Giao dịch định kỳ nằm ngoài phạm vi.
