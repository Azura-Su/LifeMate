# Linh thú: khung hình animation — 28/10/2026

Đã thực hiện plan.md và todo.md:15 atlas, mỗi atlas16 ô, tổng240 khung.
14 bộ minh họa được tạo bằng imagegen tích hợp từ ảnh pet hiện tại; Bạch Hổ
giữ rig/palette pixel và có các pose chân, đầu, đuôi bake riêng. Ảnh gốc còn
nguyên làm fallback. Không thay dữ liệu sở hữu, EXP, API hoặc dependencies.

## Kết quả

- Hàng pose riêng cho idle/chớp mắt, đi/vỗ cánh/uốn thân, vui vẻ và kỹ năng.
  Chọn loại chuyển động theo hình thái loài; lật đúng hướng ảnh ở Home.
- Bộ phát atlas dùng progress tuyến tính trên UI thread. Di chuyển lặp4 pose
  trong400ms; hiệu ứng vận động từ sổ thu chi vẫn one-shot1s. Preview lặp dùng
  state riêng, không gọi API hoặc tiêu lượt chăm sóc/random.
- Dừng khi mất focus/vào nền/Reduced Motion, pose trung tính khi dừng; ảnh
  gốc hiện trong lúc tải hoặc lỗi. Callback one-shot có guard phiên phát và
  chỉ hoàn tất một lần, kể cả callback từ UI đã nằm trong hàng đợi RN.
- Đóng gói theo silhouette toàn ảnh để không cắt đầu cánh ở đường lưới nguồn;
  một tỷ lệ/hệ tọa độ chung mỗi loài và lề trong suốt chống lẫn khung.
  -15 PNG tổng4.080.878 byte (~4,08MB). Atlas1024×1024 có mức giải mã RGBA ước
  tính4MiB; chưa đo resident memory/FPS trên thiết bị thật. Không preload15 loài.

## Kiểm chứng

| Kiểm tra                                      | Kết quả                                                                                                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline pet/rig/Home                         | 13 test đạt                                                                                                                                              |
| Regression riêng phần pet/Home cuối           | 8 suite,32 test đạt                                                                                                                                      |
| Frame/asset validation                        | 15 atlas/240 ô không rỗng, alpha hợp lệ, gutter≥6px; bốn khung di chuyển khác nhau ở mỗi loài; không còn vi phạm                                         |
| Typecheck / ESLint file thay đổi / diff-check | Đạt, không lỗi hoặc warning mới trong file được lint                                                                                                     |
| Expo export iOS + Android                     | Đạt cả hai                                                                                                                                               |
| Simulator iPhone17 Pro Max/iOS26.3            | Home có Phượng Hoàng di chuyển; màn Linh thú thấy cánh đổi pose và nút Nghỉ đưa về trung tính; alpha đúng nền app, không lỗi Worklet mới trong luồng này |
| Reviewer chỉ đọc                              | Review plan và diff. Phát hiện finance move vô tình lặp; đã thêm regression RED, tách preview loop và GREEN. Review lại không còn finding actionable     |

Full Jest cuối:148 suite đạt/2 suite lỗi,1328 test đạt/2 timeout. Suite navigation
không chạy được do thiếu mock native Worklets từ HomePetRoamer; đã export bản
HEAD nguyên trạng sang thư mục riêng và tái hiện cùng lỗi trước các thay đổi
lần này. Hai timeout ở CardScoreScreen xuất hiện ở lượt full trong lúc kiểm
tra native; chạy lại riêng cả suite đạt76/76. Lượt full trước đó CardScore đạt.
Không sửa navigation/CardScore, không tăng timeout hoặc bỏ/giảm assertion để
làm xanh check. Vì vậy không khẳng định full suite đã xanh.

## Artifact và giới hạn

- Atlas: `assets/pixelPet/animations/*.png`; nguồn, prompt set và cách đóng gói
  ở provenance.json/README.md cùng thư mục. Preview thật bốn khung10fps:
  `docs/pet-animations-preview.gif` (Phượng Hoàng, Cửu Vĩ Hồ, Thiên Mã).
- Chỉ Phượng Hoàng đã xem trong native vì tài khoản Simulator hiện sở hữu
  loài này. Không random/nhận nuôi hoặc thay dữ liệu tài khoản để thử loài khác.
  Các loài khác kiểm qua sheet, GIF, parser/bounds và component tests.
- Chưa kiểm Android trên thiết bị thật hoặc profile pin/bộ nhớ/FPS; GIF và
  export không thay cho các phép đo đó. Chưa deploy/OTA hoặc commit.
- Log kiểm tra và script đóng gói nằm tại `/private/tmp/lifemate-pet-*20261028*`;
  đây là dữ liệu tạm. Atlas, prompt, plan và báo cáo trong repo là artifact bền vững.
- Metro cục bộ8088 đang phục vụ bản preview trên Simulator; không phải deployment.
