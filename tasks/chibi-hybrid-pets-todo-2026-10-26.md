# Triển khai pet chibi3D — 26/10/2026

Đã triển khai theo yêu cầu dùng3D có rig, đồng bộ tài khoản/offline, tối đa một
pet và có xóa. Main sở hữu source; agent docs chỉ kiểm tra API, reviewer chỉ đọc.
Những thay đổi Memory/Home có sẵn trong working tree được giữ nguyên.

- [x] Đọc source/spec/plan, lưu baseline file dùng chung trước sửa.
- [x] Reviewer duyệt singleton/CAS/outbox/rules trước implementation.
- [x] Pin Three0.186.1, Fiber/native9.8.2, Expo GL55.0.18 và types0.186.0.
- [x] Asset GLB gốc có source authoring/license, rig/skin/blink và7 clip.
- [x] DNA/catalog/generator/validator/hash;41 tập loài, vector V1 cố định.
- [x] Ba trạng thái UI: chọn loài, kết quả, thú cưng hiện tại/empty; entry menu Home.
- [x] Tạo lại, tên, interaction/cast, một pet, pending/offline/error và xác nhận xóa.
- [x] Encrypted cache/outbox; cloud transaction/listener với UID/sessionEpoch fences.
- [x] Rules owner/revoked/singleton/CAS/immutable genome/delete fence/concurrent create.
- [x] Account cleanup namespace mới và test adapter/local cleanup.
- [x] Final review persistence/UI/renderer; sửa các finding được nêu dưới đây.
- [x] Typecheck, full lint, Jest, rules/functions tests, iOS/Android export.
- [x] iOS development build có Expo GL, ký Simulator để Keychain hoạt động.
- [x] Cold-start sau đổi material cuối: pet3D, tên/DNA từ cache và resume qua trên iOS Simulator.
- [ ] Gate phát hành máy thật: iPhone/Android, nhiệt/hiệu năng10 phút, art/seam/360°.

## Những lỗi đã sửa trong triển khai/review

- Lost ACK create rồi bị máy khác xóa: bỏ draft có thể từng commit khi server
  revision vượt nextRevision; không hồi sinh pet đã xóa. Regression RED→GREEN.
- Sync trả cùng DNA bằng object mới: giữ canonical genome ổn định để không rebuild
  mixer, phát lại action cũ hoặc bật spinner vô hạn. Remount bỏ action đã hết hạn.
- Save hoàn tất lúc background: clear draft và chuyển home cùng guard phiên,
  không để result rỗng khi resume. Regression defer-save/background qua.
- Particle đi sai hướng khi xoay: offset theo Mouth.matrixWorld; regression thực
  tế trên Three geometry kiểm tra root quay180°.
- Geometry hiệu ứng chưa dispose: cleanup khi thay/thoát; kiểm tra dispose events.
  Tái dùng một buffer/mesh cho các lần cast; thời gian capped cùng rig để shader
  compilation stall không tiêu hết hiệu ứng trước khung hình hiển thị đầu tiên.
- Hidden skinned source không được renderer cập nhật: CPU pose gọi skeleton.update
  rõ ràng, giữ bone/morph gốc, không phụ thuộc GPU float bone textures.
- Firestore giới hạn1000 expressions: wireVersion1 pack part/shape/material; giữ
  full validation/coverage/bounds, hash trên DNA runtime. Không bỏ checks để qua test.
- Rules production trước đó chưa có petAccounts nên báo permission-denied:
  triển khai namespace mới sau emulator; lỗi SDK hiển thị bằng tiếng Việt.
- Metro cũ chưa có glb assetExts và bản native cũ thiếu Expo GL: restart Metro,
  build/cài Simulator mới. Bản build không ký thiếu Keychain đã được thay bản ký.
- Biểu tượng emoji không hiện trên Simulator: dùng icon có sẵn của app; reset
  scroll khi chuyển màn để tên/kết quả không bị che dưới header.

Đường Lambert có lần mở lạnh bị trống dù DNA và7 part hợp lệ. Đường MeshBasic
đã hiển thị model khi thử thay riêng material. Thay cuối giữ ánh sáng mềm bake
vào vertex-color, bỏ normal computation mỗi frame vì material unlit không dùng;
Cold-start sau thay cuối đã qua trên iOS Simulator khi Mac mở khóa: pet hiện
đúng cùng tên/DNA đã lưu; xoay, interaction, cast theo hướng mouth và trở lại
từ nền đều hiển thị đúng. Không còn bước kiểm tra UI bị chặn bởi Mac khóa.

## Bằng chứng kiểm chứng

Log kỹ thuật ở `/private/tmp/lifemate-pets-20261026/` (chỉ là thư mục QA tạm).

- `jest-final3.log`: **148 suites /1324 tests qua**. Hai lượt trước có ca CardScore
  timing fail không ổn định; scoped95 tests rồi76 tests và lượt full sau đều qua.
  Không đổi implementation hoặc nới timeout/checks CardScore để qua test. Test tab
  count đổi6→7 vì thêm một hidden route Pets.
- `targeted-final.log`:13 tests genetics/cloud/errors/UI qua, gồm95.000 seed:
  10.000/loài đơn và1.000/tập lai; mỗi tập trùng appearance config<1%. Đây là đo
  cấu hình, không đo độ giống nhau bằng mắt, không chứng minh unique toàn cầu.
- `assets-final.log`:123 rig/41 tập×3 variant,7 clip, bounds hữu hạn/không collapse,
  skin thay đổi khi animation, instances độc lập; camera fit3 tỷ lệ;8 effect socket,
  reuse geometry qua các cast, shader-stall clock và dispose được kiểm tra.
- `rules-final.log`: toàn suite Firestore qua, gồm pet owner/cross-user/revoked,
  wire malformed, singleton/immutable genome, delete/recreate, stale intent và hai
  thiết bị cùng create chỉ một thắng. Không đụng tài khoản thật để thử xóa.
- `functions-final.log`: **357 tests qua** (bao gồm cleanup pet root).
- `types-final.log`, `lint-all-final.log`: `npm run typecheck` / `npm run lint` qua.
- `bundle-handoff.log`: export iOS/Android qua, có GLB trong asset bundle.
- `native-signed-build.log`: Xcode iOS Simulator build qua. Không có iPhone hay
  Android thật kết nối. Không có bằng chứng Android native build/runtime.
- Dependency check offline báo up to date nhưng tự cảnh báo offline không đáng
  tin hoàn toàn; npm ls xác nhận đúng3 version mới. Cả lockfile chỉ thay vì thêm
  dependency3D; yarn giữ toàn bộ block baseline và thêm selector cần thiết.
- UI native QA dùng source screen/hook/storage/renderer thật, auth UID thử riêng,
  cloud adapter giả lập. Đã chọn3 loài, tạo/xem3D, đặt tên, save, rename, restart
  và đọc lại tên/DNA từ encrypted cache. Không coi đây là thử sync production.
  Full flow xóa đồng bộ kiểm tra bằng unit+emulator; không xóa pet người dùng thật.

Reviewer đã duyệt plan và trả final findings persistence/UI/renderer; các finding
cụ thể đã sửa. Lượt follow-up renderer trả thêm finding geometry leak rồi dừng vì
hạn mức tài khoản, chưa hoàn tất review lại mọi sửa cuối. Main tự rà phần material,
camera và test asset sau cùng; không gọi đó là một lượt review độc lập sạch findings.

## Kiểm tra Simulator sau cùng

Ngày26/10/2026, cửa sổ LifeMate Pets QA, iOS26.3; app được mở sau khi đã shutdown
và boot lại Simulator. Dùng source PetExperience/usePet/encryptedLocalStorage/
PetViewport thực tế, UID QA riêng, cloud adapter giả lập; PetStage eager trong
harness vì project root Metro tạm nằm ngoài repository. Không gọi đó là kiểm
chứng end-to-end qua tài khoản production hoặc native lazy chunk production.

- Pet Mochi QA với mèo/thỏ/cú xuất hiện sau mở lạnh, giữ tên và DNA từ encrypted cache.
- Vuốt ngang đổi góc nhìn trước→bên; cast Tia sét phát từ miệng theo góc quay.
- App ra nền→quay lại: scene dựng lại đúng, action cũ không tự phát lại.
- Nút Chơi cùng hoạt động; mở xác nhận xóa rồi Giữ lại giữ nguyên pet.
- Ảnh QA tại `/private/tmp/lifemate-pets-20261026/pet-native-coldstart-final.png`.
  Log runtime `preview-metro-coldstart.log` không có lỗi ứng dụng mới; cảnh báo
  Three.Clock deprecated và WEBGL_lose_context không hỗ trợ vẫn có trên Simulator.
- Gate điện thoại thật và benchmark/art review vẫn chưa thực hiện. Không tuyên bố
  hiệu năng hay kết quả native Android từ lần kiểm tra Simulator này.

## Triển khai backend và rollback

Firestore `baseapp-dd227`: release26/10/2026 07:47:00 UTC,
`2ba11e86-2ffd-43b3-9420-d4331eb17506`. Đọc lại release xác nhận nội dung khớp source
và có petAccounts. Bản trước không có namespace mới. Candidate chỉ thêm helper và
match pet; những namespace production khác giữ nguyên. Có backup rules/release
trước và checksum sau trong thư mục QA tạm; không rollback rules cũ khi đã có pet
nếu không có kế hoạch giữ quyền đọc cho client mới.

Supabase `xbhelntqytleiduzicuj`, user-admin **v12 ACTIVE**: chỉ bổ sung
`petAccounts: ['state']` vào source cloud đang chạy, giữ nguyên các file remote
khác và cách xác minh Firebase token. Probe POST action=list không token trả401.
Không deploy thay đổi game-access local ngoài phạm vi. Gói deploy đầu bị lỗi
import-map path; retry path tương đối thành công, không có release lỗi phục vụ.

Không phát hành OTA/App Store/TestFlight. Khi phát hành cần binary có Expo GL,
đồng thời giữ asset/catalog/lookup V1 để pet cũ luôn tái tạo được. Các mục tiêu
trong plan như thumbnail/silhouette classifier/global uniqueness/progression chưa
thuộc V1 thực tế; xem SPEC-pets.md cho hợp đồng hiện tại.

## Refresh theo phản hồi tạo hình/vuốt/loài

Xem tasks/pets-art-gesture-plan-2026-10-26.md cho thay đổi mới nhất, bằng chứng
và giới hạn kiểm chứng. Renderer đã nâng presentation plush-v2 cho pet cũ/mới
có chủ đích; không ghi lại DNA cũ. GeneratorV1 và assetV1 vẫn giữ nguyên;
client mới tạo hybrid-3d-v2/chibi-v2 với12 loài. Firestore đã hỗ trợ cả hai version.
Lượt review độc lập mới đã hoàn tất, finding ownership gesture đã sửa và kiểm tra
lại. Kiểm tra native mới đi qua app chính/PetStage lazy, không dùng eager QA
wrapper hoặc cloud adapter giả lập; không lưu/xóa pet người dùng thật.
