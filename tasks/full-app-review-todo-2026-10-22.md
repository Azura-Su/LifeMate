# Checklist review toàn ứng dụng — 22/10/2026

- [x] Đọc bản đồ module, các SPEC liên quan và báo cáo review trước.
- [x] Review logic/state/persistence theo lát cắt tính năng.
- [x] Review authz, security, backend contracts, rules và migrations.
- [x] Review UI/accessibility/navigation/platform behavior.
- [x] Chạy kiểm tra phù hợp và ghi nhận giới hạn môi trường.
- [x] Tổng hợp findings theo severity, vị trí và điều kiện tái hiện.

## Kết quả lượt review

- [x] **P2 — Trạng thái sẵn sàng không hiển thị theo từng ghế sau khi kết thúc ván.**
  `src/screens/CardGames/CardGameTable.tsx`: khu vực tên/metadata đối thủ chỉ hiện số
  lá, bỏ cuộc hoặc chờ ván mới; không còn badge dựa trên `room.members[].ready`.
  Sau khi bấm Sẵn sàng, người chơi chỉ thấy tổng `N/M sẵn sàng`, không biết ai đã
  sẵn sàng. Đã thêm trạng thái riêng theo ghế, style phân biệt đã/chưa sẵn sàng,
  accessibility label cho cả host lẫn thành viên; các assertion `player-ready-a/b`
  hiện đạt.
- [x] **P2 — Hai test CardGames không khởi tạo được do import avatar kéo Firebase web SDK.**
  `CardGameAvatarImage.tsx` import `profileStore`, chuỗi import đi qua `avatarService`
  và RNFirebase; Jest rơi vào web fallback rồi không parse được ESM ở
  `firebase/app/dist/esm/index.esm.js`. Đã mock component avatar tại hai suite UI
  cần kiểm thử table/screen mà không phụ thuộc Firebase. Cả hai suite khởi tạo và đạt.
- [x] Test phát hiện UI chưa hiện nhãn kết quả Thắng/Thua trong giai đoạn thu bài;
  đã thêm nhãn cho người hiện tại dựa theo hạng kết quả.
- Kiểm chứng sau sửa: 3 suite CardGames liên quan đạt (71 tests); typecheck,
  toàn repo lint và `git diff --check` đạt. Full Jest: 126/127 suites, 965/966
  tests; còn fail `CardScoreScreen.test.tsx` ở xóa bàn và test đó cũng fail khi chạy
  riêng sau lượt sửa, dù từng pass ở lần chạy riêng trước đó. Đây là vùng không sửa
  trong lượt này, cần xử lý riêng nếu muốn bộ suite toàn repo xanh.
- Giới hạn: không chạy Firebase rules emulator, Expo bundle hoặc thiết bị thật;
  không kiểm chứng dịch vụ production.
