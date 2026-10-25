# Xem bài của từng người sau ván Phỏm — 25/10/2026

## Hành vi

Bấm một dòng trong Kết quả ván để mở bài của đúng người đó. Popup có các mục
Bài đã đánh, Bài đã ăn, từng Phỏm đã hạ và Bài còn lại. Các hàng bài cuộn ngang;
popup cuộn dọc và giữ nút đóng trên màn hình thấp/ngang. Kết quả dùng người tham
gia ván, kể cả người đã rời ghế. Đổi phòng/ván, mất focus hoặc bắt đầu ván mới
đóng phần chi tiết.

`resultCards.discards` kết hợp bài còn trên bàn với các lá đã bị người khác ăn
từ sự kiện engine hiện có, loại trùng và sắp theo mã lá; không biểu diễn thứ tự
nước đi. `resultCards.remaining` sao chép tay bài cuối ván, tách khỏi phỏm đã hạ.
Không đổi engine tính điểm, luật chơi, database hoặc dependency.

## Quyền riêng tư và tương thích

- Chỉ snapshot Phỏm đã finished, cho client capability8, có resultCards; đang
  chơi, hủy ván và client1–7 không nhận trường này. Quyền thành viên phòng giữ
  nguyên; không trả nọc hoặc thêm hand đối thủ vào player.
- Client kiểm tra số lá, mã lá, loại trùng, count khớp và chỉ nhận ở trạng thái
  finished. Không lưu resultCards vào cache snapshot trên máy.
- Client8 vẫn hạ phiên bản cho backend cũ. Khi không có resultCards, UI ghi rõ
  bài đã đánh còn trên bàn/lịch sử chưa đầy đủ và dữ liệu bài còn lại chưa có;
  không đoán từ điểm hoặc coi thiếu dữ liệu là tay rỗng.
- Capability8 chỉ bổ sung phần xem kết quả. Hai RPC tiếp quản/sửa luật Phỏm vẫn
  nhận capability SQL tối đa7 để tương thích giới hạn database hiện có.

## Kiểm chứng

- Reviewer chỉ đọc duyệt plan và diff. Đã xử lý giới hạn SQL capability7, lịch
  sử đánh lớn hơn4 lá khi tái, và nhãn fallback lịch sử cũ không đầy đủ.
- 266/266 test backend đạt, gồm snapshot finished/playing/cancelled, client cũ,
  người ngoài phòng, tính bất biến và giới hạn capability RPC.
- Đợt kiểm tra client đầu:80 test/5 suite đạt (bàn, ghế, parser, API, cache).
  Sau sửa fallback:117 test/5 suite đạt (bàn, screen, session, hook, protocol).
  Hai đợt có trùng test bàn; không cộng thành tổng duy nhất.
- Typecheck, ESLint các file sửa, Prettier và git diff --check đạt.
- Simulator iOS26.3: dữ liệu demo4 bot qua projection capability8 từ snapshot
  đã lưu; bấm kết quả My/Trang đúng người, bài đánh/ăn/phỏm riêng, cuộn đến bài
  còn lại được ở chiều ngang. Không dùng dữ liệu phòng production trong preview.
  Chưa xác minh tương tác trên điện thoại thật.

## Triển khai

- Trước rollout đọc game-access v15 và đối chiếu18 file: khớp source trước sửa.
- Deploy riêng game-access v16 qua Supabase connector vào xbhelntqytleiduzicuj.
  Chỉ handler.mjs, rooms.mjs và phom.mjs thay nội dung so với bản đang chạy;
  không migration, không đổi secrets hoặc triển khai function khác.
- Đọc lại cloud: v16 ACTIVE, verify_jwt=false giữ nguyên,18/18 file khớp gói.
  Probe POST không token trả401 invalid-session. Không tạo/sửa phòng production.
- Chưa phát hành app iOS/Android hoặc OTA. Client source mới qua Metro nhận
  tính năng; bản cài cũ cần cập nhật client để dùng capability8 và popup.
- Backup v15 và gói deploy được lưu trong thư mục tạm
  /private/tmp/lifemate-phom-result-details; có thể deploy lại source v15 nếu cần.
