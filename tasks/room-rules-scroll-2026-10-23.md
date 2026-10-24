# Sửa cuộn popup Luật ván tới — 23/10/2026

## Lỗi và nguyên nhân

Popup Phỏm che phần Ù/Ù tròn/Đền, vuốt không cuộn. Đã tái hiện trên iOS
Simulator. Nội dung879.33pt lớn hơn viewport680.33pt, programmatic scroll
vẫn được: lỗi ở đường nhận cử chỉ, không phải thiếu nội dung hoặc giới hạn
chiều cao. DialogModal bọc nội dung bằng hai Pressable của shell popup.

## Sửa

- Overlay là View, backdrop Pressable phủ tuyệt đối làm sibling phía sau
  card View. Không còn onPress ancestor của ScrollView từ shell.
- Giữ props, styles, chiều cao và bố cục hiện tại; tiêu đề/nút Lưu vẫn ở
  ngoài vùng cuộn. Giữ keyboard avoidance, orientation, callbacks onTouchEnd
  và accessibilityViewIsModal của card.
- TestID dialog-backdrop chỉ vùng nhấn nền; dialog-overlay là layout container.
  MemoryEditor tests chuyển selector layout sang overlay, assertions giữ nguyên.
- Không sửa form/styles Phỏm mới của người dùng, luật, server hoặc dữ liệu.

## Kiểm chứng

- Regression thu thập ancestors có onPress của ScrollView: baseline có2 nên
  test thất bại, sau sửa0. Kiểm tra child action và backdrop dismissal riêng.
- Targeted4 suites/80 tests đạt; TypeScript, ESLint file thay đổi và diff check đạt.
- Reviewer độc lập: không có P1/P2, chỉ đọc code, không chạy test.
- Runtime: công cụ drag tạo touchstart nhưng không tạo move ngay cả ở control
  ScrollView. Người dùng vuốt control xác nhận cuộn; sau đó vuốt modal đã sửa
  xác nhận thấy Ù/Đền. Đã đọc screenshot và offset0→199, thấy đủ ba mức cuối.
  Runtime kiểm tra thêm switch vẫn đổi giá trị, popup không đóng khi bấm switch,
  bấm ngoài nền đóng popup. Bản đo ngoài repository đã bỏ khỏi preview sau xác nhận.
- Không xác nhận cuộn Android hoặc VoiceOver; không tuyên bố đã chạy.

Export iOS/Android đạt: `/private/tmp/lifemate-room-rules-scroll-export`.
Simulator đã trở lại app chính server8081; previewlocalhost8082 đã dừng.
Lượt full Jest đầu dừng sau61 suite PASS, chưa có summary nên không tính là
full pass; lượt chạy lại đạt133 suites/1.063 tests, exit0 và JSON success=true. Không cần deploy backend.

Hoàn tất review/diff và toàn bộ kiểm chứng. UI đã sửa trong source, không
phát hành OTA/bản cài mới trong lượt này.
