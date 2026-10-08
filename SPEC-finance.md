# Spec: Quản lý thu nhập và chi tiêu

## Objective

Thêm tab Tài chính cho người dùng đã đăng nhập LifeMate để ghi lại thu nhập (bao gồm lương) và chi tiêu, theo dõi số liệu trong tháng và xem các giao dịch gần đây. Dữ liệu luôn được tách theo Firebase UID và lưu bền trên thiết bị bằng AsyncStorage qua Zustand store.

## Tech Stack

- React Native 0.83, TypeScript strict, React Navigation bottom tabs.
- Zustand cho state dùng chung; AsyncStorage cho dữ liệu cục bộ theo UID.
- Giao diện dùng component `Screen`, theme và button hiện có.

## Commands

- Tests: `npm test -- --runInBand`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Bundles: `npm run bundle`

## Project Structure

- `src/types/finance.ts`: giao dịch và danh mục.
- `src/services/finance/financeStorage.ts`: đọc/ghi JSON tách theo UID và xác thực dữ liệu.
- `src/store/financeStore.ts`: Zustand state/actions có kiểm tra UID.
- `src/screens/Finance/`: tab, form và tổng hợp.
- `src/navigation/`: route và integration test tab.

## Code Style

Theo cấu trúc screen/hook/styles và component hiện tại; validate dữ liệu đầu vào ở service boundary; chỉ dùng màu, button và typography từ `src/theme`.

## Testing Strategy

- Unit tests cho parse/validate và đọc/ghi storage theo UID.
- Store tests cho nạp tài khoản, thêm/xóa giao dịch và cách ly UID.
- Component tests cho summary, danh sách, form và các trạng thái trống/loading/lỗi.
- Navigation integration test xác nhận tab mới.
- Chạy Jest, typecheck, lint và bundle Android/iOS.

## Boundaries

- Always: chỉ cho số tiền hữu hạn lớn hơn 0; kiểm tra owner UID; không render dữ liệu tài chính của tài khoản khác; dùng theme hiện có.
- Ask first: đồng bộ cloud/Firestore, ngân sách định kỳ, xuất báo cáo, chỉnh sửa giao dịch hoặc thêm thư viện mới.
- Never: gửi dữ liệu tài chính lên server, ghi thông tin nhạy cảm vào log, hoặc lưu dữ liệu dưới một key dùng chung giữa các tài khoản.

## Success Criteria

- Người dùng có thể ghi giao dịch thu nhập/lương và chi tiêu với số tiền, danh mục, mô tả ngắn.
- Tab hiển thị tổng thu, tổng chi, chênh lệch của tháng hiện tại và danh sách giao dịch.
- Giao dịch được lưu bền và chỉ hiện cho UID đã tạo chúng; thêm/xóa cập nhật Zustand state và storage.
- Người dùng có thể xóa một giao dịch; trạng thái rỗng, loading và lỗi được trình bày rõ.
- Các kiểm tra dự án nêu trên đều đạt.

## Open Questions

- Không có câu hỏi chặn. Bản đầu lưu cục bộ theo UID, chưa đồng bộ cloud.
