# Phỏm: bài nhỏ, nhãn nút và gợi ý ăn — 25/10/2026

- `10♥` xuống dòng vì text số + chất rộng hơn ô bài nhỏ. Tăng ô 26 → 32 pt,
  giới hạn một dòng và cho phép co chữ; kiểm tra cả bốn chất của lá 10.
- Đổi “Xếp phỏm đã chọn” thành “Gom phỏm”. Chưa gom: “Hạ tự động”; đã gom:
  “Hạ phỏm”. Thêm câu hướng dẫn, giữ nguyên payload hạ tự động/thủ công.
- Khi `canEat` của server cho phép và người chơi còn quyền thao tác ở bước
  ăn/bốc: viền xanh lá vừa đánh, nhãn “Ăn được”/“Ăn chốt được”, nâng hai lá
  ghép được trên tay. Gợi ý không tự chọn bài hoặc gửi action.
- Helper chỉ dùng tay của người xem và lá công khai. Nó giữ khả năng ghép mọi
  lá đã ăn trước đó vào các phỏm rời nhau, tối đa một lá ăn/phỏm; bỏ marker ăn
  đã nằm trong phỏm hạ khi tái. Server tiếp tục quyết định thao tác hợp lệ.
- `PlayingCard` có props gợi ý tùy chọn; khi không truyền giữ cách chọn/chia bài
  hiện tại của Tiến lên. Không đổi server, API, luật hay tính điểm.

## Kiểm chứng

- RED trước sửa: 13 fail, 13 pass trên 2 suite, gồm nhãn, wrap và cue chưa có.
- GREEN cuối: **161/161 test, 6 suite PASS**, gồm Phỏm, Tiến lên, motion lifecycle,
  màn game, vị trí ghế và helper gợi ý. Typecheck, ESLint file đổi, diff check PASS.
- Có case riêng cho A–2–3, không ghép Q–K–A, bài đã ăn/đã hạ, tránh dùng chung
  lá giữa các phỏm, server từ chối, sai lượt, background, mất quyền, busy, hết giờ,
  kết thúc ván, cue mất khi chuyển bước, và giữ nhãn cây chốt.
- Simulator: component thật với snapshot từ ván 4 bot vừa chạy; chỉ làm mới thời
  gian lượt trong fixture. Đối chiếu dọc/ngang: `10♥` một hàng, hai lá trên tay
  nâng/viền xanh, nhãn ăn/chốt, nút Gom phỏm và Hạ tự động cùng hướng dẫn.
- Đây là kiểm tra UI với fixture; không chạy thêm một ván production hoặc deploy.

Ảnh và log:

- [Gợi ý ăn — ngang](/private/tmp/lifemate-phom-hints-20261025/eat-landscape.png)
- [Gợi ý ăn — dọc](/private/tmp/lifemate-phom-hints-20261025/eat-portrait.png)
- [Ăn chốt](/private/tmp/lifemate-phom-hints-20261025/eat-chot-landscape.png)
- [Gom phỏm / Hạ tự động](/private/tmp/lifemate-phom-hints-20261025/group-landscape.png)
- [Test cuối](/private/tmp/lifemate-phom-hints-20261025/regression-final.log)
- [Typecheck](/private/tmp/lifemate-phom-hints-20261025/typecheck-final.log)
- [Lint](/private/tmp/lifemate-phom-hints-20261025/lint-final.log)

Giữ nguyên các thay đổi có sẵn và các thay đổi song song về bố cục/xoay bàn;
không nhận các phần đó là thay đổi của task này. Không commit/push/deploy.
