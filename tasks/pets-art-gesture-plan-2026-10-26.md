# Pet3D: sửa vuốt, đổi tạo hình và thêm loài — 26/10/2026

Người dùng yêu cầu lập plan rồi làm: vuốt ngang đang không xoay ở màn thực tế;
model cũ thô/giống người; tham khảo phong cách chibi từ ảnh và link đã gửi; thêm loài.
Đây là thay đổi tiếp theo của feature pet, giữ những thay đổi khác trong working tree.

## Hướng thiết kế và hợp đồng

- Giữ3D có rig, một pet/tài khoản, offline/account sync, tên và kỹ năng.
- Bản vẽ mới: thú ngồi chibi, đầu lớn, thân tròn liền khối, không cổ/chi dài, mắt
  đen đơn giản có highlight nhỏ, má phớt, mũi/miệng nhỏ. Mesh mượt hơn thay phần
  đầu góc cạnh12×8; palette dịu nhưng rõ tương phản. Tư thế3/4 để thấy đuôi/cánh.
- Tham khảo tỷ lệ/đường nét từ ảnh tìm kiếm người dùng và các mẫu plush/chibi
  online; dựng asset gốc trong repo, không tải hình Google làm asset được phép dùng.
  -12 loài: mèo/chó/thỏ/cáo/gấu/cú + gấu trúc/hamster/cánh cụt/hươu/hổ/heo.
  Mỗi loài có chi tiết nhận diện; không đổi một màu rồi gọi đó là loài khác.
- Giữ nguyên asset và generatorV1 để DNA cũ vẫn parse/resolve đúng vector.
  Source art mới ở assets/pets/v2, clip/bone/part IDs tương thích. Renderer áp
  presentation style plush-v2 cho pet cũ và mới theo yêu cầu cải thiện cách vẽ;
  không ghi đè DNA/petId/name, không xóa/tạo lại pet đã lưu. SPEC ghi rõ việc
  nâng presentation này, không tuyên bố cùng pixel/ngoại hình nguyên bản V1.
- DNA mới dùng generator hybrid-3d-v2/catalog chibi-v2, shape/material/motion
  wire layout giữ nguyên. V1 chỉ nhận6 loài cũ; V2 nhận12 loài. Wings khi có loài
  chim, nguồn wings chỉ từ owl/penguin đã chọn. Signature assignment tránh trùng
  slot để1–3 loài luôn góp bộ phận thấy được. Pet cũ giữ cách kiểm tra V1.
- Rules cập nhật theo version có cặp hợp lệ; không nới owner/CAS/singleton/
  immutability. Không migration hoặc sửa dữ liệu production. Rules deploy chỉ
  sau emulator/reviewer; client mới không được lưu V2 trước rules hỗ trợ.

## Task và kiểm chứng

1. [x] Reproduce gesture với test event ownership trước sửa; capture ngang ở
       viewport, không nhường sau khi đã xoay, vuốt dọc vẫn cuộn. Chỉ PetViewport
       và test/logic gesture nhỏ; kiểm tra điểm chạm ngay giữa canvas màn thật.
2. [x] Dựng một bộ art mới/rig tương thích. Kiểm tra3 mẫu mèo, gấu+cáo,
       mèo+thỏ+cú từ trước/bên; đạt tỷ lệ/đường nét rồi mở rộng12 loài. Giữ V1 SHA.
3. [x] Test RED→GREEN generator/parser/wire V2+V1, signature collision, wings;
       catalog/types thêm12 loài. Không gọi code V2 khi resolve seed V1.
4. [x] Picker12 loài có tìm kiếm tên, chọn vẫn tối đa3. Source PetViewport dùng
       asset mới/camera bounds và giữ hiệu ứng/lifecycle, không thêm runtime lib.
5. [x] Rules fixtures V1/V2, species/version spoof, owner/revocation, concurrent
       create, rename/delete/immutable DNA; reviewer plan trước và diff cuối.
6. [ ] Native qua route PetsScreen/PetStage thật; vuốt canvas→đổi góc, dọc→cuộn,
       cold-start/background/skill. Không thay PetStage bằng eager wrapper khi chốt.
7. [x] Tests source GLB mọi tập loài mới, blend/clip/framing/resources; targeted
       Jest, typecheck/lint, full Jest, rules, iOS/Android export. Report kết quả art
       bằng ảnh native và giới hạn thiết bị thật; không dùng pass test chứng nhận đẹp.

Main triển khai. Explorer chỉ trace gesture; reviewer độc lập đọc plan/rules và
final diff. Tối đa2 subagents, không giao worker hoặc cho agent sửa code.

## Nguồn tham khảo đã xem

Google Images theo link người dùng trả lỗi truy cập qua web tool; ảnh screenshot
người dùng đã cung cấp đủ để đối chiếu phong cách. Image search bổ sung:
https://www.kiwihen.com/products/corgi-bread-loaf-plushie-xl
https://kawaiitherapy.com/shop/kawaii-japanese-style-cat-bunny-dumpling-plush/
Tham khảo hình dáng/tỷ lệ, không lấy asset hoặc suy ra quyền dùng lại từ kết quả.

## Kết quả và bằng chứng

- Tạo hình plush-v2 ngồi tròn đã hiện qua app chính/PetStage lazy: gấu+cáo,
  mèo+cú+hổ, gấu trúc. Các mẫu kiểm tra native thực tế thay cho danh sách mẫu
  dự kiến ở bước2; kiểm tra kết cấu mọi tổ hợp còn lại bằng GLB thật.
- Gesture RED→GREEN cho capture, raw start/end khi move bị gộp, giữ góc giữa
  các lần vuốt, dọc không capture. Reviewer phát hiện lệch dọc sau khi đã xoay
  có thể nhường ScrollView; đã thêm latch, regression RED→GREEN và reviewer
  kiểm tra lại: không còn finding cần sửa. Native đã thấy trước→sau và quay lại.
- Phát hiện blink dùng relative morph delta nhưng eye-size xử lý như absolute;
  sửa và test trực tiếp GLB chứng minh các vertex ngoài mắt không bị dời.
- Sửa splash không ẩn khi reload native: hide sau layout foreground, giữ guard
  headless; AppSplash2 test qua. App chính khởi động lại hiện Home bình thường.
  -12 loài và tìm kiếm tên không dấu; native nhập gau truc chỉ ra Gấu trúc.
  Test chọn tối đa3, giữ selection khi filter và empty search result qua.
- V1 seed/hash vector và SHA asset không đổi; V2 parser/wire/rules dùng cặp
  generator/catalog riêng. Full Jest **152 suites /1335 tests pass**, gồm
  **95.000 V1 +406.000 V2 seeded drafts**, tỷ lệ trùng appearance config<1%
  ở mỗi tập. Đây không phải đo độ giống bằng mắt hoặc unique toàn cầu.
- `npm run typecheck`, full `npm run lint`, `npm run bundle` iOS/Android pass.
  `npm run test:pets-assets`:1017 assembled rigs,7 clip,3 aspect ratio,
  relative blink, private resources,8 effect emitters/disposal pass; V2≤12MiB,
  mỗi pet≤15.000 triangles/40bones. Full Firestore emulator pass với JDK21;
  Java mặc định cũ không đáp ứng CLI nên đã trỏ JAVA_HOME tới JDK21 có sẵn.
- Không thêm thư viện runtime trong lượt refresh này. Các thay đổi Home/Memory
  khác có sẵn trong working tree được giữ nguyên. Không đổi cleanup backend,
  không chạy lại test:functions vì lượt này không sửa functions.
- Rules production baseapp-dd227 đã phát hành **26/10/2026 10:26:53 UTC**,
  ruleset `bde25a8f-4c43-4154-a50d-918557c80395`; đọc lại khớp workspace
  SHA256 `1c9e7dd9b5ac67cf04358e4866ca0714365d6227d98a9b2cfd7fc6a64a5bbd8a`.
  So source production trước/sau chỉ khác helpers/namespace pet; owner/CAS
  không đổi. Không sửa/xóa dữ liệu production. Không phát hành OTA/App Store.

Ảnh/log QA: `/private/tmp/lifemate-pets-refresh-20261026/`. Gồm full-jest.log,
rules-v2-green.log, assets-final.log, typecheck-final.log, lint-assets-final.log,
export-final.log, production-before/after.rules/json, production-pet-only.diff,
native-plush-v2-cat-owl-tiger.png và native-plush-v2-panda.png.

Bước6 mới hoàn thành route/cold startup/rotation. Chưa chứng nhận hiệu năng
trên iPhone/Android thật hoặc native Android. Công cụ drag Simulator thường chỉ
đưa touch start/end, không đủ chứng minh cuộn dọc mượt hay frame-by-frame; unit
đã kiểm tra quyền responder và native xác nhận góc xoay sau khi render cập nhật.
Background/resume và cast được kiểm tra bổ sung bên dưới nếu có bằng chứng,
không coi lời gọi click đơn lẻ là xác nhận hiệu ứng hiển thị. Gate máy thật và
art feedback người dùng vẫn cần trước phát hành chính thức.

Lần mở mẫu gấu trúc có thời điểm loading đã tắt nhưng chỉ thấy bóng; log native
xác nhận6 mesh đúng và bounds hữu hạn, sau remount model hiện bình thường.
Lần tạo tiếp theo xuất hiện bình thường không cần reload; chưa xác định nguyên
nhân của khung đầu trống trên Simulator, cần kiểm chứng tiếp ở máy thật; không coi pass cấu trúc là đủ chứng minh native hiển thị.

Kiểm tra gấu trúc phát hiện mắt bị lớp mask che: raycast trên GLB gốc báo RED
panda/0; nâng mắt/mắt sáng ra trước lớp mask, thêm kiểm tra36 head variants ×2
mắt. GLB V2 dựng lại và toàn bộ asset tests/lint/iOS+Android export qua lại.
Reviewer đọc phần sửa/raycast mới: không có finding cần sửa; chưa chạy test thay
main. Native lần cuối sau khi xóa Metro cache đã dùng asset mới; xem kết quả bên dưới.

Lượt cuối: đã khôi phục App/entry `index.ts`, xóa harness tạm và log chẩn đoán,
không giữ thử nghiệm precompile vì đối chứng tắt nó vẫn hiện pet. Kiểm tra trên
màn chính: gấu trúc hiện đúng mắt sau sửa, Home native→mở lại LifeMate giữ đúng
preview và model, không cần tạo lại. Ảnh native-plush-v2-panda.png đã lưu.
Typecheck/lint chạy lại sau khi dọn mã thử nghiệm qua. Hiện tượng floor-only
ở một số lần mở lạnh trên Simulator chưa có root cause ổn định; các lần sau
renderer gốc hiển thị bình thường. Ghi nhận rủi ro này, không gọi thử nghiệm
shader là bản sửa hoặc tuyên bố mọi lần khởi động native đã được chứng nhận.
Chưa quan sát rõ hiệu ứng native qua công cụ click;8 loại vẫn qua kiểm tra
geometry/playback/lifecycle thật trong Node. Không dùng kiểm tra click thay cho
bằng chứng hiệu ứng hiển thị. Background/resume đã xác nhận hình ảnh trên app chính.
