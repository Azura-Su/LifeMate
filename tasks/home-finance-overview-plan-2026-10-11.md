# Kế hoạch: Tổng quan tài chính theo ngày trên Home

**Trạng thái:** Hoàn thành ngày 11/10/2026.

## Mục tiêu

Đưa tổng quan thu chi của ngày đang chọn lên đầu Home. Người dùng mặc định xem hôm nay, có thể chuyển tháng và chọn ngày khác để xem tổng Thu/Chi; các thẻ Lịch và Việc hiện tại nằm phía dưới và giữ nguyên chức năng.

## Quyết định thiết kế

- Thêm một thẻ Tài chính theo màu và khoảng cách hiện có: tiêu đề/lối vào màn Tài chính, tổng Thu và Chi của ngày, bộ chuyển tháng và lưới ngày nhỏ gọn.
- Ngày hôm nay được chọn lúc mở Home. Chuyển tháng giữ số thứ tự ngày gần nhất có thể; chạm ngày trong lưới cập nhật tổng của ngày đó; nút “Hôm nay” đặt lại tháng và lựa chọn.
- Dùng cùng định dạng tiền Việt hiện có và đánh dấu ngày có giao dịch bằng chấm thu/chi nhỏ. Mọi ô ngày có nhãn trợ năng đầy đủ, không dùng màu làm tín hiệu duy nhất.
- Dùng `useFinanceAccount` để tái sử dụng nạp dữ liệu và cách ly UID hiện có; thao tác kéo để làm mới cũng làm mới sổ thu chi.
- Tuân thủ khóa hiện hành: số liệu và dấu ngày chỉ hiện khi khóa tắt hoặc phiên Tài chính hiện tại đã được mở. Khi chưa mở, hiện CTA sang Tài chính để xác thực; Home không tự gọi Face ID.
- Giữ nguyên thẻ HomeTodayCard, lịch trong bottom sheet, danh sách việc và điều hướng hiện có.

## Công việc

### Lát cắt 1 — Thẻ tài chính theo ngày

**Mô tả:** Tạo component trình bày lịch tháng, ngày được chọn, tổng Thu/Chi, trạng thái tải/lỗi/khóa và điều hướng sang màn Tài chính.

**Tiêu chí chấp nhận:**

- [x] Hôm nay được chọn ban đầu; chuyển tháng và chọn ngày đổi đúng số liệu.
- [x] Thu và Chi tính riêng theo ngày địa phương; ngày không có giao dịch có trạng thái rỗng rõ ràng.
- [x] Khi khóa, không lộ số tiền hoặc dấu ngày có giao dịch; CTA mở đúng tab Tài chính.

**Xác minh:** Test component cho tổng ngày, chọn ngày/chuyển tháng, ngày rỗng và khóa.

**Phụ thuộc:** Không.

### Lát cắt 2 — Tích hợp Home và bảo toàn hành vi

**Mô tả:** Nạp dữ liệu qua hook tài khoản hiện có, đặt thẻ Tài chính trước các thẻ Lịch/Việc và bổ sung làm mới.

**Tiêu chí chấp nhận:**

- [x] Thẻ Tài chính xuất hiện trên Lịch/Việc; Lịch và Việc vẫn mở đúng sheet như trước.
- [x] Dữ liệu không bị trộn giữa UID; số tiền tuân theo trạng thái khóa của Tài chính.
- [x] Kéo để làm mới cập nhật Tài chính cùng dữ liệu Home hiện tại.

**Xác minh:** Test Home, typecheck, lint, test liên quan và chạy bundle iOS/Android nếu môi trường khả dụng.

**Phụ thuộc:** Lát cắt 1.

## Rủi ro và giảm thiểu

| Rủi ro                                                        | Ảnh hưởng  | Giảm thiểu                                                                                                 |
| ------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| Home có thêm lưới ngày làm các thẻ khác thấp hơn màn hình đầu | Trung bình | Lưới nhỏ gọn, cuộn trên `Screen` hiện có; không thay đổi chiều cao/scroll của sheet Lịch/Việc.             |
| Số liệu tài chính lộ khi đang khóa hoặc đổi tài khoản         | Cao        | Chỉ hiển thị khi quyền xem hợp lệ theo cùng điều kiện với Finance; ẩn dấu giao dịch trong trạng thái khóa. |
| Ngày giao dịch lệch qua nửa đêm                               | Thấp       | So ngày theo khóa ngày địa phương `toDateKey`, phù hợp cách nhập ngày hiện có.                             |

## Giới hạn phạm vi

Không đổi schema, dịch vụ lưu trữ, giao dịch, khóa sinh trắc học, bottom sheet lịch, hay điều hướng tab. Cập nhật tài liệu khóa Home để phản ánh phần tổng quan mới.
