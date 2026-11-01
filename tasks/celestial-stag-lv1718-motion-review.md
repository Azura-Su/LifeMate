# Thiên Dực Linh Lộc cấp 17–18 — tự duyệt tư thế Home

**Trạng thái: đang làm; chưa hoàn tất bộ A–D.** Level 17–18 hiện chỉ chọn atlas riêng cho walk/run. Flight và sleep tiếp tục dùng atlas legacy cho đến khi có đủ frame đạt yêu cầu.

## Kết quả theo nhóm

| Nhóm | Frame nguồn | Atlas / preview | Tự duyệt |
|---|---:|---|---|
| A — Walk | 8/8 | `celestial_stag_lv1718_walk.png`; contact sheet và GIF trong `tasks/previews/` | Chu kỳ chân đọc được và kích thước nhất quán sau khi dùng một tỉ lệ chung cho cả nhóm. Cánh vẫn xoè/lộ rõ ở tư thế đi, chưa khớp yêu cầu cánh gập hoàn toàn; nên tạo lại nhóm này trước khi coi là đạt cuối. |
| B — Run | 8/8 | `celestial_stag_lv1718_run.png`; contact sheet và GIF trong `tasks/previews/` | Các pha chạy/gallop phân biệt được, kích thước nhất quán. Có vài frame chân giao nhau và cánh vẫn lộ; cần soát/regen nếu muốn đạt sát brief. |
| C — Flight | 16/16 | `celestial_stag_lv1718_flight.png`; contact sheet và GIF trong `tasks/previews/` | Đã đóng gói, 311,079 bytes. Các frame 14–16 lệch phong cách/tỉ lệ so với phần đầu chu kỳ; vẫn dùng flight atlas legacy trong app cho đến khi thay lại ba pose cuối. |
| D — Sleep | 16/16 | `celestial_stag_lv1718_sleep.png`; contact sheet và GIF trong `tasks/previews/` | Đã tự duyệt chuyển từ đứng, gập chân, nằm xuống tới tư thế cuộn ngủ; frame 11 dùng pose ngủ sạch liền kề để bỏ đốm hơi rời khỏi mõm ở bản sinh ban đầu. Atlas 216,504 bytes. Đã tích hợp settle và sleep loop riêng. |

## Kỹ thuật đóng gói

- Atlas 4×4, ô 320×320; walk/run có 8 pose nguồn lặp một lần để lấp 16 ô.
- Dùng cùng tỉ lệ trong mỗi nhóm, căn móng trên cùng baseline và quantize PNG 256 màu có dithering. Walk 288,741 bytes; run 272,880 bytes (đều dưới 700 KB).
- Ảnh gốc từng pose được giữ trong `assets/pixelPet/sourceFrames/celestial_stag_lv1718/`; thao tác đóng gói và xem lại: `scripts/review-celestial-stag-lv1718.swift`.
- Tự soát contact sheet/GIF: giữ được nhận diện màu teal–vàng, bờm, sừng và đuôi lửa nhìn nhất quán ở kích thước preview. Chưa thể xác nhận tuyệt đối số/vị trí mọi món trang sức ở từng frame; các lỗi hình thể/cánh nêu trên khiến A–B chưa được đánh dấu đạt hoàn toàn.

## Kiểm tra tích hợp đã chạy

- Jest tập trung cho level 17–18: 4 sprite tests passed; service track suite: 16 tests passed. Chạy toàn bộ hai file mục tiêu: 74 passed, 1 test hiện thất bại ở assertion level 9 (`keeps the legacy Home atlas at level 9`), do test mong atlas legacy trong khi component đang chọn `celestial_stag_lv910_walk.png`. Thay đổi Lv17–18 không sửa nhánh level 9.
- `npm run typecheck` — passed.
- ESLint cho các TS/TSX đã sửa — passed.
- `git diff --check` và kiểm tra JSON provenance — passed.

## Việc còn lại

1. Tạo lại/soát A–B để gập cánh và sửa các frame chân khó đọc.
2. Tạo lại C frame 14–16 để khớp tỉ lệ/phong cách và soát silhouette cánh, rồi cập nhật routing.
3. Xem xét assertion level 9 đang không đồng bộ với atlas lv9–10 hiện được chọn; không thuộc phạm vi Lv17–18.

**Tiến độ phiên tiếp tục:** ImageGen hiện đã hoạt động. Flight frame 14–16 và sleep frame 1–16 đã được tạo riêng, đóng gói và xem contact sheet/GIF. Ba frame flight cuối chưa đạt độ đồng nhất nên chưa đưa atlas flight vào app. Các khung đầu flight có thể còn cần soát lại theo tiêu chí cánh gập/đúng silhouette.
