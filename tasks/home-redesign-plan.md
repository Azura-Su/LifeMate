# Kế hoạch thiết kế lại Home

## Mục tiêu

Biến Home thành bảng tổng quan gọn, dễ quét trên điện thoại: người dùng nhận diện ngày/tài khoản, xem nhanh thu chi tháng và xử lý việc hôm nay. MP3 vẫn ở thanh điều hướng dưới; Home không lặp lại lối vào thư viện nghe.

## Quyết định thiết kế

- Giữ phần chào, tên, ngày và nút menu trong header.
- Bỏ banner câu chào trang trí và câu quote cuối trang vì không mang thông tin hay thao tác.
- Giữ thẻ Tài chính trước tiên vì đây là chức năng chính; giữ nguyên trạng thái ẩn số tiền và kiểm tra Face ID.
- Giữ thẻ Hôm nay cùng thao tác thêm việc, mở lịch và trạng thái rỗng hiện có.
- Xóa thẻ Danh sách nghe khỏi Home; người dùng mở MP3 từ tab MP3.
- Dùng một cột, khoảng cách gọn và nhất quán; trên màn hình hẹp nội dung vẫn cuộn, không ép chữ hoặc số liệu.

## Phạm vi

Chỉ chỉnh Home, style liên quan và regression test. Không đổi dữ liệu, hook, điều hướng MP3, nghiệp vụ thu chi hoặc lịch.

## Kế hoạch công việc

### Task 1 — Tập trung nội dung Home

**Mô tả:** Bỏ thẻ Danh sách nghe và hai khối chữ trang trí, giữ header, Tài chính, Hôm nay và thông báo lỗi.

**Tiêu chí chấp nhận:**
- [x] Home không còn thẻ hoặc nút mở thư viện MP3.
- [x] MP3 vẫn mở từ tab dưới.
- [x] Tài chính, bảo vệ số tiền, thao tác việc hôm nay và trạng thái tải/lỗi giữ nguyên.

**Xác minh:** HomeScreen test và tab integration test.

**Phụ thuộc:** Không.

**Tệp dự kiến:** `src/screens/Home/HomeScreen.tsx`, `src/screens/Home/HomeScreen.styles.ts`, `src/screens/Home/__tests__/HomeScreen.test.tsx`.

**Quy mô:** Vừa.

### Task 2 — Cân lại nhịp và khoảng cách

**Mô tả:** Giảm khoảng trống quanh nội dung, giữ thứ tự Finance rồi Hôm nay để màn hình ngắn gọn mà vẫn ưu tiên thông tin chính.

**Tiêu chí chấp nhận:**
- [x] Header và hai thẻ dùng lề ngang nhất quán.
- [x] Nội dung không bị cắt trên điện thoại hẹp; có thể cuộn khi cần.
- [x] Không thêm thẻ hoặc lối tắt trùng với thanh tab.

**Xác minh:** Typecheck, lint, test UI hiện có và rà style responsive.

**Phụ thuộc:** Task 1.

**Tệp dự kiến:** `src/screens/Home/HomeScreen.styles.ts`.

**Quy mô:** Nhỏ.

## Điểm kiểm tra hoàn tất

- [x] Toàn bộ Jest pass (47 suites / 215 tests).
- [x] TypeScript và ESLint pass.
- [x] Home chỉ còn header, tổng quan Tài chính, việc Hôm nay và trạng thái hệ thống.

## Rủi ro

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Bỏ khối trang trí khiến phần dưới Home thoáng hơn | Thấp | Giữ khoảng trắng có chủ đích thay vì thêm nội dung trùng; ưu tiên hai thẻ có dữ liệu thật. |
| Màn hình hẹp làm nội dung trong thẻ xuống dòng | Thấp | Không cố định chiều cao; giữ ScrollView và kiểm tra text wrap. |

## Câu hỏi mở

Không có. Phạm vi được chốt theo ảnh và yêu cầu: bỏ Danh sách nghe, giữ Tài chính và việc hôm nay.
