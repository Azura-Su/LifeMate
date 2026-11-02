# Chọn hình dạng và khung ngủ đã mở khóa

## Yêu cầu và quyết định

- Người sở hữu chọn độc lập **Hình dạng** và **Khung ngủ** trong màn Linh thú. Có tùy chọn **Tự động theo cấp** cho mỗi mục; lựa chọn được lưu theo adoption và đồng bộ tài khoản.
- Chỉ hiển thị mẫu có asset thực: các dạng tiến hóa Lv1/4/8 cho các loài hiện tại; Linh Lộc có thêm các bộ art theo cặp cấp. Các mốc Lv4 và Lv8 vẫn là lựa chọn dạng Trưởng thành/Thăng hoa. Khung ngủ theo catalog thực tế của từng loài; không dùng tên trang phục chưa có ảnh để giả làm skin.
- Cấp thật, EXP, kỹ năng và quyền mở khóa tách khỏi cấp hiển thị. Mốc cao nhất đã mở khóa được ghi nhớ; khi EXP được điều chỉnh giảm, các mẫu đã mở vẫn còn. Thu hồi/nhận nuôi mới tạo adoption mới và đặt lại lựa chọn.
- Máy chủ xác thực UID, adoption hiện tại và mốc mở khóa, không tin dữ liệu cấp do client gửi. Trường mới nullable để client/server cũ tiếp tục dùng chế độ tự động.
- Mọi tổ hợp hình/khung đã mở phải giữ chân nằm trên mặt đất, giữ khoảng trống cho thú, không cắt cánh/sừng/đuôi hoặc làm đổi tỷ lệ khi chuyển động. Layout dùng metadata art có sẵn và kiểm tra ảnh ghép ở các tổ hợp cực trị.

## Kế hoạch theo thứ tự

1. **Chốt hợp đồng và rà kế hoạch**: kiểm tra API/state/RPC, catalog art và số đo sprite; reviewer độc lập rà quyền sở hữu, migration và tương thích. Chấp nhận khi không còn rủi ro chặn triển khai.
2. **Lưu và bảo vệ lựa chọn**: migration bổ sung appearance level, scene level và mốc mở khóa; RPC đặt lựa chọn theo adoption, trả state mới; Edge Function kiểm tra payload và ánh xạ lỗi. Kiểm tra bằng PGlite, handler tests: cấp khóa, sai loài, stale adoption, tài khoản không hợp lệ, EXP giảm và client cũ.
3. **Model và renderer**: parser tương thích trường vắng; resolver tạo cấp/stage hiển thị riêng; Home, detail, cảnh héo giữ đúng lựa chọn đã dùng lúc ngủ. Kiểm tra tổ hợp được mở, fallback và việc đổi scene/skin trong lúc ngủ.
4. **UI chọn mẫu**: sheet hai mục, ảnh xem trước, trạng thái chọn, nhãn cấp mở, Tự động, nút Lưu; không mở mẫu khóa. Lỗi giữ bản đang chọn để thử lại; chống lưu sang adoption/tài khoản khác. Kiểm tra Jest màn hình và trạng thái tải/lỗi.
5. **Căn hình và hoàn tất**: ảnh ghép tổ hợp hình nhỏ/khung cao và hình lớn/khung thấp; Simulator chọn/lưu/mở lại và ngủ/đánh thức. Chạy typecheck, ESLint file ảnh hưởng, Jest liên quan, test:functions. Reviewer rà diff cuối vì có dữ liệu lưu và RPC.

## Cổng kiểm tra

- Server và frontend thống nhất các ID/mốc mở khóa; trường cũ không đổi nghĩa.
- Client không thể mở hình/khung bằng sửa payload; lựa chọn adoption cũ không tác động pet mới.
- Tự động giữ cách hiển thị hiện tại khi chưa chọn; lựa chọn thủ công còn sau reload/đổi thiết bị.
- Mọi khung nghỉ dùng đúng scene đã chọn, kể cả cảnh đang héo khi người dùng đổi lựa chọn.
- Chỉ triển khai cloud sau khi migration và chức năng đã được kiểm tra; báo rõ nếu chưa triển khai.

## Điều chỉnh sau rà độc lập

- Ghi mốc mở khóa tại state cuối thao tác, không dùng trigger theo từng cập nhật EXP hoặc running max ledger: reconcile có thể cộng rồi trừ tạm, không được mở khóa từ giá trị trung gian.
- Backfill từ EXP hiện tại, receipt đã hoàn tất và tổng ledger sau từng batch giao dịch cùng adoption. Ghép các bước reconcile cùng transaction/timestamp trước khi tính peak; không mở từ giá trị trung gian. Lịch sử đổi loài cùng adoption vẫn được giữ.
- Receipt lặp lại sau đổi skin phải trả trạng thái hiện tại, sau khi đã kiểm tra fingerprint; không để ack cũ ghi đè lựa chọn mới.
- Số đo 10 bộ tư thế ngủ Linh Lộc cho thấy bề ngang tối đa <86pt trên canvas120pt (khoảng103pt trên Home144pt hiện tại). Tách cấp art/motion khỏi cấp scene; preview dùng cùng tỷ lệ144/240 với Home. Các loài khác thu đồng đều bố cục chuẩn, giữ baseline và độ nâng lên bệ riêng của Garuda.

## Tiến độ

- [x] Rà state, API, màn Linh thú và đường render Home.
- [x] Rà số đo/layout và reviewer duyệt kế hoạch kỹ thuật.
- [x] Backend migration/RPC/handler và kiểm tra (417 function tests đạt).
- [x] Resolver và tích hợp renderer.
- [x] UI chọn hình/khung.
- [x] Kiểm tra tổ hợp, runtime, kiểm tra tự động và review cuối.

## Kết quả kiểm chứng

- 417 function tests và 117 Jest tests liên quan đạt; typecheck và ESLint các file ảnh hưởng đạt.
- Reviewer độc lập đã rà migration/quyền/replay và hai lần chỉnh layout; không còn phát hiện cần sửa.
- `node scripts/review-pet-appearance-fit.cjs`: 120 tổ hợp × 4 tư thế ngủ = 480 trường hợp không bị cắt; thân rộng tối đa103/240pt. Đã xem ảnh ghép tại `tasks/previews/pet-appearance-all-stag-pairs.png` (hàng theo level1/3/4/5/7/8/9/11/13/15/17/19, cột theo khung2/4/6/8/10/12/14/16/18/20).
- Simulator iPhone17 Pro Max: chọn hình1/khung2, lưu thành công qua Edge Function, mở lại vẫn giữ lựa chọn; Home ngủ/đánh thức đúng hình và cảnh. DB xác nhận EXP100/cấp mở3 không đổi. Sau kiểm tra đã trả cả hai lựa chọn về Tự động như ban đầu.
- Supabase LifeMate `xbhelntqytleiduzicuj`: áp dụng riêng migration20261102010000 trong một transaction cùng history; triển khai riêng `pet-access` bằng nguồn đang deploy + handler đã review. Kiểm tra RPC chỉ cho service_role, anon/authenticated không có quyền; request không đăng nhập trả401.
- Bản RPC/Edge cũ lưu tại `/private/tmp/lifemate-pet-appearance-rollback` để phục hồi nếu cần, giữ nguyên các cột mới khi rollback. Không cần thay đổi Firebase cho tính năng này.
- Ảnh runtime: `tasks/previews/pet-appearance-picker-verified.png`, `tasks/previews/pet-appearance-home-verified.png`.
