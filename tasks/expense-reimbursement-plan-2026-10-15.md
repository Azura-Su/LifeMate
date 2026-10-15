# Kế hoạch: Người khác trả lại một phần khoản chi

## Mục tiêu và quy ước

Một giao dịch Chi tiêu ghi đúng **tổng số tiền người dùng đã thanh toán**. Người dùng có thể ghi một hoặc nhiều người cần trả lại và số tiền của từng người. Mỗi lần họ trả, LifeMate giảm Chi tiêu của **danh mục gốc** trong kỳ nhận tiền; không tăng Thu nhập. Cách phân bổ theo kỳ giống phần nhận lại của Cho vay hiện có.

Ví dụ: thanh toán bữa ăn 500.000 ₫, An cần trả 300.000 ₫. Ngày thanh toán: Chi Ăn uống 500.000 ₫, chờ An trả 300.000 ₫, phần của tôi dự kiến 200.000 ₫. Khi An trả 100.000 ₫: Thu nhập vẫn 0 ₫, Chi Ăn uống trong kỳ nhận giảm 100.000 ₫, còn chờ 200.000 ₫. Khi trả đủ, chi ròng của bữa ăn qua mọi kỳ là 200.000 ₫. Nếu nhận ở tháng sau, tháng trước giữ chi 500.000 ₫ và tháng sau có dòng giảm chi 300.000 ₫; tổng hai tháng là 200.000 ₫.

Các khoản được trả lại chỉ bù tối đa phần đã phân cho từng người. Tiền nhận vượt phần đó phải được ghi riêng theo bản chất giao dịch, không tự động đưa vào Thu nhập hay làm chi âm quá mức.

## UI

1. Trong popup **Thêm/Sửa giao dịch → Chi tiêu**, giữ form ngắn mặc định. Sau danh mục và ghi chú có một hàng `Có người cần trả lại` (công tắc hoặc nút mở rộng). Bật lên mới thấy danh sách người, mỗi hàng gồm **Tên người** và **Số tiền cần trả lại**; nút `+ Thêm người`. Hiện `Phần của tôi dự kiến = Tổng tiền − Tổng cần trả lại`. Dùng `FinanceAmountInput` và dòng đọc tiền bằng chữ theo chuẩn hiện tại.
2. Giao dịch có người trả lại hiển thị nhãn `Còn chờ … ₫` trong danh sách Chi tiêu. Chạm giao dịch mở chi tiết: tổng đã trả, phần dự kiến của tôi, đã nhận lại, còn chờ; tiếp theo là từng người với số còn chờ và lịch sử các lần trả. Không thêm tab đáy hoặc trộn danh sách này vào Cho vay.
3. Nút `+` cạnh người còn nợ mở popup **Nhận lại tiền chi**: tên người đã chọn, số tiền (gợi ý số còn chờ), ngày nhận mặc định hôm nay, ghi chú tùy chọn. Có thể ghi nhận nhiều lần. Sau khi lưu, chi tiết và báo cáo cập nhật cùng lúc.
4. Trong dòng lịch sử, lần nhận lại ghi `An trả lại · Ăn uống`, số dương ở hướng tiền vào nhưng nhãn báo cáo là `Giảm chi Ăn uống`; không xuất hiện ở Thu nhập. Tìm kiếm Chi tiêu hỗ trợ tên người và ghi chú của các lần trả lại. Kỳ không có khoản chi mới vẫn phải hiển thị khoản giảm chi, kể cả tổng chi kỳ đó âm.
5. Sửa/xóa lần nhận lại ngay trong lịch sử, có xác nhận khi xóa. Xóa giao dịch gốc có lần nhận lại phải nêu rõ sẽ xóa toàn bộ liên kết và cập nhật báo cáo. Khi sửa tổng tiền hoặc phần nợ, không cho nhỏ hơn tổng đã nhận; khi sửa danh mục, mọi lần nhận lại vẫn thuộc danh mục mới.

## Hợp đồng dữ liệu và tính toán

- Mở rộng `FinanceTransaction` loại `expense` bằng trường tùy chọn `sharedExpense`, chứa danh sách `{id, name, owedAmount}` và các lần nhận `{id, participantId, amount, receivedAt, note}`. Giao dịch cũ không có trường này giữ nguyên cách đọc và tính. Một khoản chi chỉ có **một** bản ghi gốc; lần nhận nằm trong cùng bản ghi, không tạo giao dịch Thu nhập độc lập và không nhân đôi số dư.
- `gross = transaction.amount`; `owed = Σ participant.owedAmount`; `received(person) = Σ receipt.amount` của người đó; `remaining(person) = owed(person) − received(person)`; `netExpense(all time) = gross − Σ receipts`. Luôn yêu cầu `0 < owed`, `Σ owed ≤ gross`, `0 < receipt ≤ remaining`, tên sau khi trim không rỗng, ID duy nhất và số tiền là số nguyên an toàn. Cho phép nhiều người trùng tên vì liên kết bằng ID.
- Tạo một phép chiếu báo cáo dùng chung từ bản ghi gốc: sự kiện `+gross` cho danh mục chi vào ngày thanh toán và một sự kiện `−amount` cho **mỗi lần nhận** vào ngày thực nhận, cùng danh mục của giao dịch gốc. `getFinanceReport`, `getExpenseReport`, Home và các danh sách theo kỳ dùng cùng phép chiếu; `getIncomeReport` bỏ qua toàn bộ sự kiện nhận lại. `balance = income − net expense` tiếp tục khớp tiền thực vào/ra.
- Vì danh mục được lấy từ giao dịch gốc lúc đọc, đổi danh mục không để lại khoản bù ở danh mục cũ. Không sửa ngày thanh toán khi ghi nhận lần trả. Sửa/xóa lần trả phải đảo đúng ảnh hưởng báo cáo của kỳ tương ứng.
- Lưu/sửa lần nhận bằng thao tác đọc-sửa-ghi có điều kiện trên một tài liệu Firestore, kiểm tra lại số còn chờ và ID để tránh lưu trùng khi bấm lại hoặc có hai thiết bị. Hàng đợi offline lưu từng thao tác với ID ổn định, khi đồng bộ thì hợp nhất các lần nhận khác ID nếu vẫn hợp lệ; xung đột thật được báo để người dùng chọn, không âm thầm ghi đè. Cập nhật parser, so sánh bản ghi, cache mã hóa và Firestore rules cho trường tùy chọn; giới hạn số người/lần nhận để tài liệu không phình vô hạn.

## Trường hợp cần xử lý rõ

- Nhiều người cùng một hóa đơn; một người trả nhiều đợt; nhiều lần nhận ở các tháng/năm khác nhau.
- Chưa ai trả, trả đủ, còn nợ một phần, nhập vượt nợ, trả cùng ngày; thao tác lặp do mạng chậm.
- Sửa tiền/danh mục/ngày của khoản chi gốc, sửa hoặc xóa một lần trả, xóa giao dịch gốc.
- Mẫu giao dịch chỉ sao chép thông tin chi, không mặc nhiên tạo khoản người khác nợ; người dùng phải chọn lại người và số tiền.
- Dữ liệu cũ, chuyển tài khoản, offline rồi đồng bộ, hai thiết bị cùng ghi, quy tắc bảo mật chỉ cho chủ tài khoản đọc/ghi.

## Thứ tự triển khai

1. **Mô hình và phép chiếu**: thêm trường tùy chọn, parser/validation, hàm số dư theo người và sự kiện báo cáo. Chấp nhận: dữ liệu cũ không đổi; khoản nhận không bao giờ cộng vào Thu nhập.
2. **Lưu trữ và phân quyền**: mở rộng local/cloud storage, hợp nhất thao tác offline, Firestore rules, giới hạn và tính bất biến của dữ liệu. Chấp nhận: bấm lưu lặp hoặc hai thiết bị không tạo khoản nhận trùng/vượt nợ.
3. **Nhập khoản chi có người trả lại**: form nhiều người, tổng đối chiếu tức thời, sửa phần nợ hợp lệ. Chấp nhận: khoản chi thường giữ UI hiện tại; phần của tôi và phần chờ luôn cộng khớp tổng.
4. **Chi tiết và nhận lại**: lịch sử theo người, popup nhận từng phần, sửa/xóa, xử lý xóa giao dịch gốc. Chấp nhận: thao tác cập nhật đúng số còn chờ và không xuất hiện trong tab Thu nhập.
5. **Báo cáo và hoàn thiện**: cùng quy tắc ở Thu chi, Chi tiêu, danh mục, Home, tìm kiếm và các kỳ năm/tháng; kiểm tra tình huống âm ở kỳ chỉ có tiền trả lại. Đối chiếu trên thiết bị và cloud trước khi phát hành rules/app.

## Phạm vi

Áp dụng cho tất cả danh mục Chi tiêu cá nhân (Ăn uống, Mua sắm, Di chuyển, v.v.), không dùng cho bản ghi Cho vay hoặc Đóng hộ vốn có quy trình riêng. Chưa có tự động yêu cầu chuyển tiền, chia hóa đơn qua tài khoản bạn bè hay nhận diện giao dịch ngân hàng.
