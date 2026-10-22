# Giảm độ trễ đồng bộ bàn chơi — 22/10/2026

## Phạm vi và nguyên nhân

Yêu cầu: kiểm tra và giảm độ trễ khi vào phòng, sẵn sàng, đánh bài, bỏ lượt.
Controller đang đợi tối đa 2 giây cho Realtime trước khi đọc phòng qua HTTP;
khi Realtime chưa hoạt động, người còn lại chỉ nhận thay đổi ở chu kỳ 3 giây.
Các thao tác này đều dùng chung cơ chế cập nhật snapshot.

## Thay đổi

- Cài listener trước rồi đọc snapshot qua Edge ngay; không đợi handshake.
- Polling foreground 1 giây khi chưa SUBSCRIBED; dừng ngay khi Realtime kết nối.
- Gộp yêu cầu đọc đang chờ, chỉ chạy một sync tại một thời điểm. Lease 20 giây giữ nguyên.
- Nối lại phải đọc thành công trước khi mở thao tác. Lỗi đọc không làm bản cũ trở thành dữ liệu có thể thao tác.
- Callback từ topic cũ và teardown không được khởi động lại polling. Stop hủy request/socket/timer.
- Khi lỗi đọc lại, người dùng vẫn có thể bấm quay lại và xác nhận thoát màn bàn;
  thông báo rõ việc rời phòng chưa được xác nhận, không gửi lệnh leave từ dữ liệu cũ.

Không thay RPC, quyền đọc tay bài, cách xử lý actionId/receipt, CAS, luật game hay dữ liệu phòng.
Không gửi lệnh game lạc quan hoặc tự phát lại lệnh chưa rõ kết quả.
Đây là thay đổi client; không có deployment Firebase/Supabase trong đợt tối ưu này.

## Đo trước/sau

Chạy cùng controller thật với đồng hồ giả lập, HTTP cố định 200 ms, Realtime không phản hồi,
20 thay đổi version với thời điểm khác nhau. Không gọi mạng, không dùng tài khoản/phòng thật.

| Chỉ số                                          |   Trước |     Sau |
| ----------------------------------------------- | ------: | ------: |
| Từ start đến snapshot mới có thể thao tác       | 2400 ms |  400 ms |
| Median thời gian nhận version mới từ người khác | 1675 ms |  675 ms |
| p95 thời gian nhận version mới                  | 2950 ms | 1150 ms |
| Timer còn sau stop                              |       0 |       0 |

Giữ thay đổi vì cải thiện vượt sai số của phép đo có kiểm soát. Không suy ra số liệu
API ack hay độ trễ điện thoại thật từ benchmark này. Độ trễ thực tế còn phụ thuộc mạng,
Edge và tình trạng Realtime; chưa kiểm tra lại đồng thời 2–4 điện thoại thật.

Lệnh tái lập từ thư mục project:

```sh
node scripts/benchmark-game-session.cjs /path/to/before/gameSession.ts
node scripts/benchmark-game-session.cjs
```

Baseline của đợt này được chụp trước khi sửa tại
`/private/tmp/lifemate-game-latency-20261022/before/src/services/cardGames/gameSession.ts`.
Script giới hạn mỗi lần chờ version mới trong 10 giây, không phụ thuộc đồng hồ thật.
Jest khóa kỳ vọng đọc ngay sau listener và chu kỳ polling đúng 1000 ms để chống hồi quy.

Đánh đổi: khi Realtime chưa hoạt động, polling tăng từ khoảng 20 lên 60 read/phút/thiết bị,
cộng lease (giới hạn read hiện có 240/phút/UID). Không polling khi background/blur;
khi SUBSCRIBED chỉ đọc theo hint và lease. Chưa đo tải nhiều phòng hay battery thực tế.

## Kiểm chứng

- Regression mới đã thất bại trên bản cũ: đọc ngay, polling 1 giây, khóa thao tác sau lỗi đọc lại;
  thêm ca UI cho quay lại khi đọc lỗi.
- Kiểm tra callback đồng bộ, đổi topic/teardown, sync chậm không chồng request, stop hủy request,
  giữ thông báo lỗi mới hơn, receipt khi mất ack và khôi phục pending sau foreground.
- 6 suite Jest liên quan: 86 ca đạt. Sau sửa luồng quay lại do review phát hiện,
  chạy lại 2 suite bị ảnh hưởng: 54 ca đạt trên Node 24.
- `npm run typecheck`: đạt; ESLint cả 5 file TS/CJS thay đổi: đạt.
- `npm run bundle`: iOS và Android xuất thành công sau sửa cuối, trên Node 24.
- `git diff --check`: đạt. Plan review và final review độc lập hoàn tất;
  lỗi P2 về xác nhận rời phòng khi chưa có snapshot mới đã sửa và được review lại.
- Một lần chạy Jest có cảnh báo animation `ShuffleDeck` chưa bọc `act`, không có test lỗi;
  lần chạy lại 2 suite sau cùng không xuất hiện cảnh báo đó. Không sửa animation trong đợt này.
- Chưa chạy lại bàn nhiều thiết bị thật, benchmark API thực tế, battery hay tải nhiều phòng.
  Không thay backend/rules nên không chạy lại bộ functions/Firestore emulator trong đợt này.

## Rà soát lại sau phản ánh chậm — 22/10/2026

Đã rà đường đi thực tế của `ready`: app xác thực token và gọi Edge; Edge xác minh
token, kiểm tra receipt, đọc phòng, commit action, rồi tạo snapshot trả về. Phát hiện
hai phần việc không cần thiết nằm nối tiếp trên đường phản hồi:

- Mọi snapshot v2 đợi ký URL ảnh hồ sơ từ Storage tối đa 2 giây. Đây là dữ liệu trang
  trí; ảnh chưa có sẵn thì UI vốn đã có chữ cái dự phòng. Việc ký URL chuyển sang
  background task của Supabase Edge Runtime; snapshot trả URL đã cache hoặc `null`.
- Action `ready` bình thường đọc receipt lần hai sau khi đã đọc phòng. Commit RPC vốn
  kiểm tra receipt nguyên tử bên trong transaction. Kiểm tra lần hai chỉ còn chạy khi
  snapshot cho thấy action trùng có thể đã hoàn tất hoặc phòng đã chuyển match.

Khi Realtime chưa kết nối, poll vẫn giữ nhịp 1 giây để người khác thấy thay đổi nhanh;
thiết bị đang chờ action commit tạm bỏ qua poll để không khóa cùng dòng phòng bằng
đọc nền. Giữ nguyên nhịp fallback 1 giây và polling trên các thiết bị còn lại; không
đổi gate xác thực hai lần, luật game, receipt/commit hay hành vi không lạc quan của UI.

Regression tests xác nhận action trả về trong khi Storage chưa xong, đường ready thường
chỉ đọc receipt một lần, và request trùng được khôi phục khi phòng đã chuyển match.
Chưa đo latency API thật hoặc test trên hai thiết bị; cần deploy Edge Function này mới
có hiệu lực trên server, hiện tại chỉ sửa mã trong workspace.
