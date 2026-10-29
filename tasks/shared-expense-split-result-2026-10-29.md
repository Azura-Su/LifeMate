# Chia khoản chi — 29/10/2026

## Đã làm

- Thêm ba lựa chọn trong Có người cần trả lại: Chia đều / Theo suất / Tự nhập.
  Mặc định Tự nhập giữ luồng cũ. Chia đều gồm tôi và người cần trả, có toggle
  bỏ tôi; theo suất nhận phần lẻ hai chữ số (dấu phẩy/chấm), tôi có thể 0 suất.
- Tính ngay khi thay hóa đơn/người/suất; số tiền tự tính không sửa trực tiếp.
  Chuyển về Tự nhập chụp đúng số đang hiển thị. Mở lại giao dịch cũ giữ nợ/ID
  và receipts, không suy đoán lại suất hoặc tự thay đổi số tiền cũ.
- Tỷ lệ tính bằng BigInt và phân bổ số dư lớn nhất; tie theo thứ tự hiển thị.
  Tổng tiền khớp hóa đơn tới từng đồng, kể cả gần MAX_SAFE_INTEGER. Chặn số
  suất sai hoặc kết quả khiến người cần trả 0đ; giữ chặn giảm dưới tiền đã nhận.
- Tách editor khỏi FinanceTransactionDialog, bỏ các style chỉ dùng bởi block
  vừa thay. Không thêm dependency hoặc thay contract lưu/rules/schema/backend.

## Kiểm tra

- Reviewer độc lập đã duyệt plan và diff, không có finding cần sửa.
- Utility regression chạy đỏ khi chưa có utility, sau triển khai xanh; 5 test
  arithmetic/portion/exact total/invalid inputs. UI10 test + FinanceScreen lưu
  số tiền thật qua store/parser và luồng nhận lại hiện có.
- Jest nhóm liên quan: **4 suite / 62 test đạt**.
- Full Jest: **159/160 suite đạt**, 1436 test đạt / 1 test lỗi CardScore
  `keeps a failed local finish open for retry without changing shared scores`.
  Lỗi chập chờn này đã ghi nhận trước task; không đổi hoặc nới test ngoài scope.
  Chạy riêng đúng test lỗi sau đó đạt (1/1; các test khác được filter).
- `npm run typecheck`, `npm run lint`, `git diff --check`: đạt.
- Export Hermes iOS/Android đạt:
  `/private/tmp/lifemate-shared-split-export-20261029`.
- Người dùng chọn hoàn tất với kiểm tra tự động, bỏ qua Simulator đang yêu cầu
  mật mã thiết bị ở tab Tài chính. Chưa xác nhận keyboard/layout và BigInt
  runtime qua tương tác native. Không lưu giao dịch giả vào tài khoản thật.
- Hermes hỗ trợ BigInt theo [release chính thức](https://github.com/facebook/hermes/releases/tag/v0.12.0).

Chưa deploy hoặc phát hành app mới. Tính năng chỉ thay client, không cần
migration hoặc deploy Firebase/Supabase.
