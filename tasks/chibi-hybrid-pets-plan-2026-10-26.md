# Kế hoạch thú cưng lai chibi 3D — 26/10/2026

Trạng thái 26/10/2026: đã triển khai V1 theo yêu cầu, pin Three0.186.1/Fiber9.8.2/Expo GL55.0.18. Người dùng chốt3D có rig, đồng bộ tài khoản/offline, tối đa một pet và xóa được. Source và hợp đồng thực tế xem `SPEC-pets.md`, `src/types/pet.ts`; báo cáo kiểm chứng xem `tasks/chibi-hybrid-pets-todo-2026-10-26.md`.

Đã review độc lập persistence/rules và diff cuối; sửa các finding stale-create draft, rebuild scene khi sync, save lúc background và hướng particle khi xoay. Rules Firestore đã release lên baseapp-dd227 sau emulator test; user-admin v12 bổ sung purge pet khi xóa tài khoản. Không phát hành app store/OTA. Thiết bị thật, benchmark10 phút và duyệt art vẫn là gate phát hành chưa có bằng chứng.

Quyết định triển khai thay cho các phương án mở rộng bên dưới: asset GLB gốc có skin/rig/blink/7 clips; CPU skin một pet, unlit vertex-color với ánh sáng mềm bake khi dựng scene và một mesh particle buffer để tránh phụ thuộc float bone textures/instancing trên Expo GL. Scene lazy load, dừng khi không active. Không tạo thumbnail vì chỉ hiển thị một pet. Motion/skill dùng clip/effect+variant0–7 với bảng tra bất biến trong catalogVersion, phase từ seed/domain. WireVersion1 nén parts thành species:variant, shape mixed-radix integer và material code; DNA runtime vẫn rõ ràng, hash trên cấu hình đã giải mã. Giảm độ sâu validator để đạt giới hạn1000 biểu thức của Firestore rules; không bỏ kiểm tra nguồn loài/range.

## 1. Kết luận đề xuất

Dùng **Three.js + React Three Fiber/native + Expo GL**, model glTF/GLB được chuẩn hóa cùng bộ rig, generator có seed và DNA đầy đủ. Ghép các mesh đã được thiết kế để tương thích, không ghép tùy ý model động vật tải từ nhiều nguồn. Sinh pet trên máy; chỉ lưu DNA và metadata lên Firestore hiện có, không gọi AI cho mỗi lần random.

Điểm quyết định chất lượng là asset 3D, skin weights, vị trí nối và luật phối. Thư viện dựng hình không tự tạo ra model đẹp, rig đúng hay đảm bảo mọi tổ hợp đáng yêu. Làm spike kỹ thuật và một bộ art mẫu được duyệt trước khi mở rộng số loài.

Mục tiêu “gần như không ai giống ai” được triển khai bằng không gian biến thể có kiểm chứng, phân biệt silhouette/màu/họa tiết, chống trùng với pet hiện tại/các bản xem trước gần nhất và nhiều biến thể chuyển động/kỹ năng. Không tuyên bố duy nhất toàn cầu khi chưa có dịch vụ đặt chỗ fingerprint toàn cầu.

## 2. Nền tảng LifeMate và phạm vi

Đã kiểm tra package.json, package-lock.json và Expo bundledNativeModules đang cài: Expo 55.0.31, React 19.2.0, RN 0.83.10; có Firebase Auth/Firestore, Zustand, expo-asset 55.0.20, expo-file-system 55.0.26, expo-crypto 55.0.19. Chưa có thư viện 3D hoặc model glb/gltf/blend trong source được khảo sát.

Tái sử dụng:

- Navigation types.ts/MainTabs.tsx và `ScreenHeader` cho màn mở từ Home; không cần navigator mới.
- `useAuthStore.sessionEpoch`, `useScreenActive`, accountLifecycle để chặn kết quả trễ và ghi chéo tài khoản.
- encryptedLocalStorage và mẫu hàng đợi theo UID của checklistStorage; không tạo một hệ quản lý khóa khác.
- Firebase modular API và mẫu sync/revision từ memoryCloud; không gắn pet vào dữ liệu game/bảng điểm.
- `accountCleanup.ts`, Firestore `owns(uid)` và adapter xóa Firestore trong user-admin khi thêm collection mới.

V1 gồm chọn 1–3 loài, random lại, xem 3D/xoay pet, idle/tương tác/kỹ năng, đặt tên, lưu/mở lại một pet offline/online và xóa pet. Giới hạn một pet tính theo tài khoản trên mọi thiết bị, được cưỡng chế ở server. Hệ số hiếm/phụ kiện/tính cách/level/evolution được chừa cấu trúc; gameplay nâng cấp, trao đổi, marketplace, chiến đấu, AR và huấn luyện AI không thuộc V1.

Kế hoạch riêng theo ngày theo quy ước nhiều feature plan hiện có; không ghi đè tasks/plan.md hoặc tasks/todo.md đang chứa công việc khác. Working tree Memories/Home hiện có được giữ nguyên; khi tích hợp sau này phải kiểm tra lại các file dùng chung.

## 3. Bản đồ năng lực đề xuất

Đây là module logic trong cùng app, không phải microservice. Bản đồ/phạm vi này cần được duyệt trước khi tạo SPEC riêng và implementation.

| ID ổn định       | Trách nhiệm                                                                       | Phụ thuộc                        |
| ---------------- | --------------------------------------------------------------------------------- | -------------------------------- |
| pet-catalog      | Asset, loài, rig, socket, palette, compatibility, clip/effect manifest có version | —                                |
| pet-genetics     | Seed → DNA hợp lệ; kiểm tra provenance/chibi và fingerprint                       | pet-catalog                      |
| pet-presentation | Dựng mesh, animation, hiệu ứng, ảnh xem trước                                     | pet-catalog, pet-genetics        |
| pet-collection   | Một slot pet/tài khoản; save/load/rename/delete và sync; cache/outbox             | pet-genetics                     |
| pet-experience   | Ba màn hình và entry Home                                                         | pet-presentation, pet-collection |

Thứ tự: spike catalog + presentation → genetics → lát cắt chọn/tạo/xem → lưu bản nháp offline → sync một slot → màn pet hiện tại/xóa → mở rộng art/QA. Chưa tách package hoặc engine abstraction tổng quát; chỉ tách renderer khỏi DNA để đổi công nghệ không làm thay dữ liệu pet.

## 4. Thư viện và lựa chọn

Khảo sát nguồn chính thức ngày26/10/2026. Version là **ứng viên cho spike**, không khẳng định đã tương thích runtime chỉ vì peerDependencies chấp nhận.

| Lựa chọn                                                   | Hỗ trợ                                                           | Đánh giá cho LifeMate                                                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `three` 0.186.1 + `@react-three/fiber` 9.8.2 qua `/native` | Mesh/material, GLTFLoader, skeleton, AnimationMixer, scene React | Hướng chính. Fiber 9 dành cho React 19, native dùng Expo GL/Asset. Cần thử loader/texture/shader với đúng Hermes/RN/Expo hiện tại [S1] |
| `expo-gl` ~55.0.18                                         | Bề mặt GL native iOS/Android                                     | Version từ SDK55; bắt buộc rebuild development app, không chỉ Metro/OTA [S2]                                                           |
| `react-native-filament` 1.11.0                             | Native renderer, model GLB, animation                            | Phương án dự phòng nếu spike Expo GL không đạt. Có thêm worklets-core/native integration; không cài song song hai renderer [S3]        |
| `@react-three/drei/native`                                 | Helper loader/scene                                              | Chưa thêm ở V1: GLTFLoader/AnimationMixer của Three đủ cho lát cắt ban đầu; cân nhắc khi có nhu cầu cụ thể                             |
| Rive / Lottie                                              | Animation 2D, file thiết kế sẵn                                  | Không đáp ứng model/rig 3D người dùng đã chọn [S4]                                                                                     |
| SVG/Reanimated/Skia                                        | Vẽ2D và animation                                                | Hướng đã bỏ theo lựa chọn 3D; không cài thêm để dựng pet                                                                               |
| Unity/Godot nhúng                                          | Game engine đầy đủ                                               | Chưa có nhu cầu world/physics/editor game; tăng công tích hợp và hai vòng đời ứng dụng                                                 |

Dependency mới dự kiến chỉ 3 runtime: `expo-gl`, `three`, `@react-three/fiber`; `@types/three` tương ứng 0.186.x ở dev. Giữ expo-asset/file-system/crypto đã có; chưa thêm expo-three, physics, Reanimated, gesture library hoặc engine particle riêng. Xoay đơn giản dùng gesture RN có sẵn; nếu cần pinch sau này mới đánh giá thêm.

Lệnh cài chỉ chạy ở bước triển khai đã duyệt: `npx expo install expo-gl`, rồi pin chính xác Three/Fiber/types đã qua spike. `npx expo install --check` và kiểm tra lockfile. Không tự nâng Expo/React/RN để chạy tính năng này. Cấu hình Metro phải merge default để thêm `.glb`, không thay toàn bộ assetExts/sourceExts đang dùng.

## 5. Spike bắt buộc trước sản xuất asset

Một scene nhỏ tải model thật có skin/clip/morph/texture, ghép 3 bộ phận; không dùng cube xoay làm bằng chứng đủ.

1. Tải GLB local bằng GLTFLoader trên **iPhone và Android thật**; thử embedded texture, transparency, skin, morph target, background/resume/context loss. Expo GL/Three có giả định API web ở loader; xác minh bằng thực nghiệm [S2].
2. Tạo hai instance từ cùng template; xoay/đổi màu/chạy clip của pet A không ảnh hưởng B. Dùng clone skeleton đúng cách và material instance riêng; geometry/texture bất biến có thể chia sẻ. Không chỉ `.clone()` rồi giả định skeleton độc lập [S5].
3. AnimationMixer chạy idle → interaction → cast → idle, chuyển mượt, hủy được; camera xoay không lệch socket effect.
4. Random100 lần, vào/ra 20 lần; đo frame time, bộ nhớ/native GPU, thời gian decode/load và giải phóng resource. Không dùng React setState mỗi frame.
5. Đo phiên bản dependency/native bundle delta; chốt rig/material/texture profile. Nếu lỗi nền tảng, thử Filament bằng cùng fixture trước khi chọn; không hạ yêu cầu3D âm thầm.

Không lấy Simulator iOS làm bằng chứng duy nhất: tài liệu Fiber cảnh báo hỗ trợ OpenGL ES ở Simulator có thể không ổn định [S1]. Nếu chưa có máy thật, ghi trạng thái chưa đạt gate, không tuyên bố sẵn sàng phát hành.

## 6. Asset và quy chuẩn chibi 3D

Đề xuất 6 loài đầu: **mèo, chó, thỏ, cáo, gấu, cú**; danh sách chưa phải lựa chọn đã được người dùng chốt. Có 41 tập1–3 loài. Chỉ đưa loài lên UI khi tất cả tổ hợp liên quan đã có cấu hình hợp lệ. Cá/bướm và cơ thể dưới nước thêm sau với profile/animation riêng; không ép vào rig không phù hợp.

Pipeline: concept/turnaround → model Blender → retopology/UV → rig/skin/morph → clips → GLB export → kiểm tra manifest/geometry → preview trong native app → duyệt art. Blender là công cụ authoring, không nhúng vào app. Mọi asset mua ngoài cần quyền phân phối và sửa trong ứng dụng. AI concept/model có thể hỗ trợ tác giả sau này nhưng vẫn phải qua chuẩn hóa rig/UV/QA; hiện chưa có bộ model được cấp phép/chấp thuận.

Rig family `chibi-v1`: quy ước đơn vị/trục, bone names/hierarchy/rest pose và socket cố định; profile ground/avian được duyệt riêng. Không hứa một clip tự chạy đúng trên mọi topology. Mỗi part khai báo `rigProfile`, `compatibleBodyProfiles`, `socket`, `skinBinding`, `requires`, `excludes`, `providesCapabilities`, `sourceSpecies`, `assetContentHash`. Rebind/retarget giữa skeleton thực hiện lúc authoring, không thử sửa skin weights bằng random runtime.

- Phần cứng như tai/mỏ có thể gắn socket; phần mềm thân/chân/đuôi/cánh có skin/morph theo contract. Seam vòng cổ/chi được che có chủ ý; tránh đầu lơ lửng hoặc xuyên thân.
- Slot: head, ears, eyes, muzzle-or-beak, body, forelimbs, hindlimbs, wings, tail, pattern. Slot đối xứng dùng cùng variant; chỉ 1 cặp tai,1 đuôi,1 cấu trúc miệng, không vừa mỏ vừa mõm. Wings không được chiếm cùng vị trí với forelimbs nếu asset chưa có phối hợp đã duyệt.
- Tỷ lệ art mục tiêu: đầu khoảng45–55% chiều cao nhân vật, thân bo tròn, chi ngắn, mắt lớn/miệng nhỏ. Bound cho từng rig profile/morph được họa sĩ duyệt; không scale bone tùy ý làm méo clip hoặc chân trượt.
- Palette phối sẵn3–5 màu; màu/họa tiết phải thuộc allowlist của loài đã chọn. Không random RGB toàn dải. Phiên bản màu fantasy riêng nếu được duyệt sau này.
- Mỗi loài đã chọn đóng góp ít nhất 1 đặc điểm nhận diện **thấy được**, không chỉ sourceSpecies ẩn hoặc biến thể mắt rất nhỏ. Ví dụ mèo+thỏ+cú có nét mặt mèo, tai thỏ và cánh/lông cú tương thích.
- Kiểm tra toàn vòng xoay, không chỉ góc trước: mắt/tai không xuyên nhau, đuôi/cánh không cắt thân khi idle/cast, không seam hở/lộ mặt sau, không texture kéo giãn.

Không dùng chấm điểm tự động làm chứng nhận “luôn đẹp”. Bảo đảm bằng tập asset/biến thể đã duyệt, solver giới hạn và cấu hình fallback **đúng tập loài**, cộng contact sheet/video QA ở nhiều góc.

## 7. Data model đã triển khai

Hợp đồng chuẩn nằm ở `src/types/pet.ts`; renderer không được serialize. DNA có schemaVersion1, generatorVersion hybrid-3d-v1, catalogVersion chibi-v1, seed128bit, species canonical1–3 và:

- Parts: head/ears/muzzle/body/feet/tail, wings chỉ khi có cú; mỗi part có species và variant0–2.
- Shape: head920–1100, ears850–1150, body920–1080, tail850–1150, eyes900–1100 (integer permille).
- Material: paletteSpecies thuộc tập đã chọn, palette0–2, pattern0–2, patternVariant0–7, iris0–2.
- Animation idle/interaction: clipId allowlist + variant0–7. Skill: effectId allowlist + variant0–7. Bảng tra và seed/domain xác định speed/gap/phase/duration/cooldown, không random lại khi đọc.
- PetRecord: petId/ownerId/name/dna/dnaHash/appearanceHash/createdAt/updatedAt. Name NFC trim, tối đa24 grapheme và96 code units, không control characters.
- PetSlot: schemaVersion1, ownerId, revision nguyên1..1e9, previousRevision=revision-1, lastOperationId, updatedAt, pet|null. Lần đầu baseRevision0; không reset revision sau xóa.
- PetCache: server slot|null, một pending mutation và một draft|null. Pending có type/operationId/baseRevision/nextRevision/targetPetId/pet|null.

Firestore wireVersion1 giữ hợp đồng slot, nén DNA parts về species:variant, shape về integer0..530680951940, material về paletteSpecies+code0..215. Client kiểm tra wire, giải mã rồi kiểm tra đầy đủ DNA. SHA-256 hash trên canonical DNA runtime, không hash dạng wire. Appearance hash loại seed/ID/tên/animation/skill; khác seed không chứng minh khác ngoại hình. Không có claim unique toàn cầu. Catalog/lookup/asset V1 phải bất biến; thay thuật toán hoặc art cần version mới.

## 8. Logic sinh có seed

1. Validate1–3 species khác nhau trong catalog hỗ trợ; sort canonical nên thứ tự chọn không đổi kết quả cho cùng seed.
2. Sinh seed128 bit từ expo-crypto; petId UUID riêng. Chỉ tạo seed khi bấm tạo/random, không tạo khi rerender hay mount.
3. Dùng stream xác định từ SHA-256(seed + generatorVersion + domain + counter), các domain tách `parts`, `shape`, `motion`, `skill`. Dùng integer/rejection sampling để chọn có trọng số; không Math.random hoặc Date.now trong quyết định gene. Hash qua expo-crypto lúc tạo, không trong render loop [S6].
4. Chọn body profile từ tập loài và assign các signature traits để đủ coverage trước; sau đó chọn part theo requires/excludes/rig/socket. Tiếp tục màu/morph/họa tiết trong bound đã duyệt.
5. Chọn clip và skill từ capability **đã resolve** (không chỉ loài input). Không có cánh thì không flap/fly; không có đuôi thì không wag. Idle neutral luôn có cho mỗi body profile.
6. Validate anatomy/style/provenance. CatalogV1 tương thích theo thiết kế, assign signature cho từng loài trước khi random phần còn lại; không cần solver thử/sửa. Không âm thầm bỏ loài. Mọi41 tập được kiểm tra nguồn loài và model/clip.
7. Tính hash; trả DNA cùng diagnostic để test (diagnostic không phải runtime scene). Bộ phận/kỹ năng/animation render từ DNA đã resolve, không random lại lúc đọc.

`resolve(seed, versions, species)` là pure theo nghĩa kết quả không phụ thuộc tài khoản/thời gian/bộ sưu tập. `createFresh(existingFingerprints)` bọc ngoài: nếu trùng thì sinh seed mới và resolve lại, tối đa 20 lần. Hết lượt báo chưa tìm được biến thể mới, không block UI hoặc gán danh hiệu độc nhất. DNA cuối giữ đúng seed cuối. Không dùng kho pet hiện tại làm nhánh ẩn trong resolve vì sẽ mất tái tạo.

Test vector cross-platform đóng băng byte serialization, counter và output DNA. Cùng DNA bảo đảm cấu trúc/màu/clip/tham số giống nhau; hình ảnh từng pixel GPU hoặc thời điểm tương tác thực tế không được hứa giống tuyệt đối giữa thiết bị.

## 9. Animation và kỹ năng

AnimationMixer của Three điều khiển clip; scheduler/useFrame chỉ cập nhật mixer/bones/particle buffer, không cập nhật React state theo frame [S7]. Preset chuyển động được authoring trước; randomness chọn preset, tốc độ, biên độ và khoảng nghỉ trong bound an toàn.

- Idle: thở, chớp mắt, nghiêng đầu, lắc tai/đuôi nếu có. Tối thiểu3 họ idle/body profile.
- Tương tác khi chạm: vui/nhún, chào, tò mò; tối thiểu 3 preset hợp lệ/profile. Animation reaction luôn quay lại idle; không trộn hai clip ghi cùng bone thiếu mask.
- Kỹ năng đặc biệt: một skill chính random, cast animation tương thích, emitter theo mouth/paw/body socket và recovery. Random effect không tạo thêm bộ phận của loài ngoài lựa chọn.

| Skill     | Biểu diễn3D nhẹ                   | Điểm phát                 |
| --------- | --------------------------------- | ------------------------- |
| Lửa       | mesh/billboard particle ngắn      | miệng hoặc paw được duyệt |
| Nước      | giọt + đường phun cong            | miệng/paw                 |
| Lốc xoáy  | dải ribbon/particle xoắn          | thân/phía trước           |
| Sét       | polyline emissive ngắn            | paw/body                  |
| Băng      | mảnh pha lê instanced             | body/phía trước           |
| Ánh sáng  | vòng và tia mềm                   | body                      |
| Bong bóng | sphere/particle có alpha giới hạn | miệng/body                |
| Lá bay    | quad lá instanced                 | body                      |

Các skill là **phép thuật trang trí**, không phải giải phẫu: mèo có hiệu ứng lửa vẫn chỉ có đặc điểm hình thể từ loài đã chọn. Màu particle thuộc effect palette, tách màu lông. Nếu muốn skill chỉ theo sinh học loài thì phải đổi pool, nhiều ví dụ lửa/sét sẽ không hợp lệ cho loài thường.

State machine `idle → reaction/cast → recover → idle`; một foreground action, cooldown và giới hạn particle. Chạm liên tiếp không tạo vô hạn hệ particle. Scheduler/particle seed+version nằm trong DNA; các lần tương tác có event counter tạm nên cùng pet có chuyển động sinh động nhưng không đổi gene. Reduced Motion: dừng chuyển động lặp, effect tĩnh/nhẹ theo thao tác; không chớp sáng mạnh. Pause khi blur/background, không catch-up một lượng lớn delta khi resume.

## 10. Chống trùng và mức độ đa dạng

- `petId` chỉ nhận diện bản ghi; UUID không chứng minh ngoại hình duy nhất.
- Chống trùng appearanceHash của pet hiện tại và 50 kết quả xem trước gần nhất cùng tập loài trong phiên. Chưa có bộ phân loại silhouette; appearanceHash là kiểm tra cấu hình, không chứng minh khác biệt cảm nhận bằng mắt. Không duy trì kho pet đã xóa để chống trùng.
- Chưa cần upload mọi lượt random. Vì các thiết bị offline có thể cùng tạo ngoại hình, V1 không có đảm bảo duy nhất toàn cầu. SHA dài/seed dài không biến một catalog nhỏ thành nhiều hình khác nhau.
- Trước chốt art inventory, sinh 10.000 seed cho từng tập1 loài; ít nhất 1.000 seed/tập2–3 loài. Báo tỉ lệ exact/appearance/silhouette duplicates và số fallback; làm contact sheet/video mẫu. Đây là gate đo lường, chưa có kết quả hay tuyên bố số tỷ biến thể.
- Mục tiêu tạm: appearance duplicate dưới 1% trên tập 10.000 của từng loài đơn, không lỗi provenance/rig. Nếu chưa đạt thì tăng biến thể hình/texture đã duyệt hoặc thu hẹp lời hứa; không tăng seed để che trùng nhìn thấy.
- Yêu cầu unique toàn cầu trong tương lai: reservation appearanceHash trên server + unique constraint/transaction; offline chỉ trạng thái chưa xác minh. Nếu muốn rarity có giá trị/trao đổi thì generator/claim phải do server quyết định, client seed không chống sửa hoặc săn reroll.

## 11. Lưu, đồng bộ và tái tạo

Firestore dùng **một document cố định** `petAccounts/{uid}/state/current` chứa PetSlot. `petId` là ID của pet bên trong, không tạo thêm document theo petId. State là leaf document, private; không lưu scene3D/GLB/image binary. Cache mã hóa theo UID và durable outbox tái dùng cơ chế accountTask/epoch; V1 không tạo thumbnail; chỉ dựng một pet.

### 11.1. Giới hạn một pet và đồng bộ

- Server transaction cho phép `trống → pet A`, `pet A → pet A` khi đổi tên, và `pet A → trống` khi xóa. Không cho `pet A → pet B` trực tiếp; người dùng phải xóa A và nhận xác nhận trước khi lưu B. Hai thiết bị cùng lưu khi trống: chỉ một transaction thắng; thiết bị còn lại nhận pet đang có và giữ bản tạo của mình ở dạng nháp, không tự ghi đè.
- Random không tự lưu. Chạm Save nhiều lần cùng draft giữ petId/operationId. Draft nằm riêng với snapshot slot đã được server xác nhận và không được tính là pet thứ hai đã sở hữu.
- Offline vẫn tạo/xem pet được; ghi bền vững một draft/outbox và báo “Bản nháp trên thiết bị · Chờ xác nhận lưu”. Chưa biết trạng thái server thì không hứa slot còn trống. Khi online phải xác nhận giới hạn một pet; không tự đổi baseRevision của intent cũ để ép lưu.
- Cache+outbox cập nhật atomically theo queue UID; lỗi disk không báo lưu thành công. Worker chỉ flush foreground/online với UID+epoch hợp lệ; listener có cleanup. Chỉ báo đã đồng bộ sau xác nhận server [S8].
- Mỗi create/rename/delete giữ `operationId`, `baseRevision`, `nextRevision`; rename/delete kèm `targetPetId`. CAS kiểm tra toàn slot và pet đích; không reset revision khi trống. Lần đầu chưa có document dùng baseRevision0; sau xóa document còn revision fence nên create cũ từ lúc chưa có pet không thể khôi phục dữ liệu.
- Nếu retry thấy đúng lastOperationId/nextRevision và payload kết quả dự kiến thì xác nhận đã commit (ACK mất). Nếu thiết bị khác đã đẩy slot sang revision mới hơn, một lastOperationId không chứng minh lịch sử mọi thao tác: dừng intent cũ, reconcile trạng thái hiện tại và báo khi cần; không replay hoặc tự rebase. Draft chưa lưu giữ riêng. Delete cũ của A không được xóa pet B.
- Read raw cloud JSON phải validate bounds/schema/asset IDs trước renderer; chỉ load model/material đã bundle/allowlist. Genome của cùng petId bất biến; rename không sửa DNA. Fetch thất bại giữ cache hợp lệ; máy cài mới cần online lần đầu để lấy pet tài khoản.
- Firestore rules chỉ mở đúng document `state/current`, giữ `owns(uid)` và accountAccess/token cutoff; kiểm tra schema/owner/range và những transition trên. Cấm write document tùy ý, cấm hard-delete document fence, cấm đổi A thành B và cấm thay DNA của A kể cả client gọi trực tiếp ngoài app. Không có public/cross-user read.

### 11.2. Xóa pet

- Nút **Xóa thú cưng** có xác nhận. Xóa thành công loại pet khỏi màn hình, bỏ DNA/tên/metadata pet và thumbnail khỏi dữ liệu ứng dụng; không có kho lịch sử hay chức năng khôi phục. Slot chỉ giữ metadata revision/operation chống phát lại, không giữ pet có thể phục hồi. Asset loài dùng chung của app không bị xóa.
- Xóa offline: ẩn pet trên thiết bị này và lưu durable intent, báo “Đang chờ đồng bộ xóa”. Cho tạo/xem bản nháp mới, nhưng chưa gửi save pet mới cho tới khi server xác nhận slot trống. Nếu server đã có pet khác, delete cũ bị từ chối và tải pet hiện tại.
- Thiết bị khác đang online nhận slot trống hoặc petId mới phải dọn cache DNA/tên/thumb cũ, hủy thao tác/callback cũ và ngừng scene/mixer/effect của pet cũ. Thiết bị offline chỉ có thể nhận và áp dụng việc xóa khi kết nối lại; không hứa xóa tức thì bản cache trên máy đang mất mạng.
- Không phục hồi pet cũ từ outbox, cache hoặc seed sau reconcile. Draft đang tham chiếu chính pet bị xóa phải bị hủy; draft pet mới chưa lưu được giữ riêng. Tạo pet mới sau xóa dùng petId mới và tiếp nối revision slot, không dùng lại trạng thái trước lần xóa.
- Xóa tài khoản vẫn block→drain→purge slot/outbox/thumb; đăng ký root `petAccounts`/collection `state` trong `user-admin/google.mjs` và tests. Không đổi Auth hoặc publish rules trong lượt lên plan.

Mở lại pet hiện tại: validate DNA → chọn manifest version → load part assets → dựng/bind → apply material/morph → mixer+effect. Giữ asset/clip cũ khi thêm loài mới; DNA đầy đủ là nguồn chuẩn. Xóa pet không ảnh hưởng pet của tài khoản khác.

## 12. Ba màn hình

1. **Chọn loài**: entry từ Home/màn pet → grid loài, chọn 1–3, bộ đếm, nút tạo chỉ bật khi hợp lệ; chọn thứ 4 giải thích giới hạn. Giữ draft selection khi quay lại; tạo preview không làm thay pet đang sở hữu.
2. **Kết quả pet**: một viewport3D lớn, xoay, tương tác/kỹ năng, tên và Random lại cùng tập loài. Nút Lưu chỉ cho nhận pet khi slot trống; nếu đã có pet thì chỉ preview và hướng dẫn xóa pet hiện tại trước. Offline hiển thị rõ bản nháp chờ xác nhận. Mode saved cho đổi tên/tương tác/xóa, không reroll ghi đè DNA.
3. **Thú cưng của tôi** (thay màn bộ sưu tập nhiều pet): một card pet + tên/loài/trạng thái sync, nút xem/đổi tên/xóa. Không có pet thì hiển thị tạo mới; đang xóa thì có trạng thái chờ xác nhận. Không grid danh sách pet, phân trang hay kho đã xóa.

Chỉ một scene hoạt động ở detail/result. Card dùng thumbnail tĩnh, chụp sau render hoặc khi xem; chưa có thì dùng placeholder. Thumb có thể tái tạo từ DNA của pet hiện tại; xóa pet dọn thumb cũ. Không buộc upload thumbnail lên Storage V1.

## 13. Ngân sách runtime dự kiến

Các số sau là **mục tiêu thử nghiệm**, chưa đo trên máy thật và có thể điều chỉnh sau spike:

- Một pet khoảng≤15.000 triangles,≤40 active bones,≤12 draw calls; texture atlas tối đa1024px, tối đa 2 atlas. Material đơn giản/toon bằng màu/gradient; không postprocessing nặng/shadow realtime V1.
- Hiệu ứng≤64 particles,1 effect một lúc; fake blob shadow và ánh sáng cố định. Không simulation chất lỏng, cloth/hair/fur hoặc physics engine.
- Target 60 fps ở máy chuẩn, có profile 30 fps ở máy thấp; đo frame-time p95 và 10 phút idle/cast chứ không chỉ FPS tức thời. GL chạy JS có thể tranh tài nguyên với UI: benchmark với điều hướng/network thật.
- Chỉ một GL context có scene đang chạy; card pet dùng thumb tĩnh. Xóa/đổi pet phải dọn instance, mixer, material và particle; không dispose geometry/texture dùng chung trước instance cuối.
- Morph, decode asset và tạo thumb không block thao tác lâu; có loading/cancel-generation theo UID/draft, last-request-wins. Random 20 lần liên tiếp chỉ hiện kết quả cuối, không nạp 20 scene.
- Mục tiêu DNA+metadata≤24KiB/pet; cache/outbox có giới hạn và báo hết dung lượng. Download asset pack chỉ là mở rộng sau này; V1 bundle bộ loài được duyệt để offline hoạt động.

## 14. Mở rộng có kiểm soát

| Mở rộng              | Điểm thiết kế đã chừa                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Độ hiếm              | Policy/version riêng và thống kê có điều kiện; server authority nếu ảnh hưởng giá trị                                           |
| Phụ kiện             | Socket+compatibility registry; state trang bị riêng, không sửa genome                                                           |
| Tính cách            | Gene chọn pool scheduler/reaction; không reroll toàn pet khi thêm field                                                         |
| Level                | Progress state/version riêng theo petId; phép tăng server kiểm soát nếu cạnh tranh                                              |
| Tiến hóa             | Nếu triển khai: transition/version evolution riêng, vẫn tối đa một pet; V1 chưa cho đổi DNA bằng rename hoặc thay pet trực tiếp |
| Animation/skill hiếm | Tag/tier trong manifest với capability gate và trọng số versioned                                                               |
| Tương tác thêm       | Event/controller hiện tại; không cần thêm physics hoặc online multiplayer ngay                                                  |
| Thêm loài            | Asset pack + validation toàn các tập loài mới + test backward rendering                                                         |

## 15. Task triển khai và checkpoint

Chỉ bắt đầu sau khi duyệt hướng, capability map, danh sách loài/art mẫu và plan. Mỗi task khoảng2–5 file source/test; asset bundle là deliverable art riêng. Không dựng tất cả phần nền rồi mới có màn chạy được.

| ID / phụ thuộc | Lát cắt, file dự kiến                                                                     | Acceptance / kiểm chứng                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 / —         | Spike riêng + fixture GLB + dependency candidate matrix                                   | Model thật skin/texture/clip ghép 3 part chạy 2 nền tảng; 2 instance độc lập; có số đo và chốt renderer. Không sửa Home/Memory trong spike            |
| P1 / P0        | `assets/pets/v1/` rig/body/parts; `catalog.ts`, test manifest                             | Art mẫu 3 loài mèo/thỏ/cú được duyệt; seam/clip/morph/360° đạt; mỗi set có fallback đúng loài                                                         |
| P2 / P1        | `types/pet.ts`, `petDNA.ts`, test validate/hash/vector                                    | Version+canonicalization rõ; cùng input cùng DNA; input lỗi/ngoài allowlist bị chặn                                                                   |
| P3 / P2        | `petGenerator.ts`, test generator, `catalog.ts`                                           | 1–3 loài, coverage, bounded solver, không trait ngoài loài; random wrapper chống trùng không phá resolve                                              |
| P4 / P3        | `PetViewport.tsx`, `petScene.ts`, scene tests                                             | Ghép DNA3D chính xác, clone/release đúng, camera/idle pause; native fixture kiểm chứng độc lập                                                        |
| Checkpoint A   | Chọn3 loài mẫu → random nhiều lần → xem 3D                                                | Khóa art/rig/API; chưa mở thêm loài nếu core không đạt                                                                                                |
| P5 / P4        | `petMotion.ts`, `petEffects.ts`, tests controller                                         | Idle/reaction/cast/recover,8 effect template, capability/RM/stop/cooldown; UI không lag khi chạm nhanh                                                |
| P6 / P5        | `PetSpeciesScreen.tsx`, `PetResultScreen.tsx`, styles/tests (tách thành2 task nếu>5 file) | Chọn1–3, random lại cùng loài, tên/draft, render/error/accessibility; E2E chưa lưu                                                                    |
| P7 / P2,P6     | `petStorage.ts`, `petOutbox.ts`, storage tests                                            | Một draft/outbox bền vững, giữ petId/operation khi retry, tắt/mở offline; không báo sở hữu pet khi server chưa xác nhận                               |
| P8 / P7        | `petCloud.ts`, cloud tests, firestore.rules/rules tests                                   | Singleton slot/rules, owns+cutoff, immutable DNA, CAS create/rename/delete; hai thiết bị không lưu hai pet và stale intent không khôi phục pet đã xóa |
| P9 / P8        | `usePetCollection.ts`, `PetCollectionScreen.tsx`, styles/tests                            | Màn một pet/empty/pending-delete, xác nhận xóa và dọn cache/thumb; nhận thay đổi từ máy khác; không lẫn UID hoặc phục hồi pet cũ                      |
| P10 / P9       | accountCleanup, google.mjs và tests tương ứng                                             | Account deletion hết cache/outbox/cloud root; drain chặn late writes; không đụng collection khác                                                      |
| Checkpoint B   | Draft offline → online nhận một pet → máy khác mở lại → xóa → lưu pet mới                 | Tối đa một pet/account; xóa đồng bộ; stale save/rename/delete không tác động pet mới; conflict có cách xử lý                                          |
| P11 / P9,P10   | navigation types/MainTabs + một entry Home + test                                         | Tái dùng ScreenHeader/theme; kiểm tra working tree Home lúc triển khai, không ghi đè thay đổi khác                                                    |
| P12 / P11      | Asset4–6, manifests + regression vectors/art QA                                           | Đủ41 tập hỗ trợ; báo cáo đa dạng, không chỉ đổi màu để đếm biến thể                                                                                   |
| P13 / P12      | Full QA, SPEC/capability docs, rollout checklist                                          | Gates dưới đạt, reviewer final cho persistence/rules, native device evidence; rollout rules/cleanup trước mở sync client                              |

Có thể làm art và pure DNA tests song song sau khi khóa rig/manifest; renderer và storage cùng dùng contract đã chốt. Agent chỉ đọc explorer/docs khi có câu hỏi hẹp; reviewer trước persistence/rules và diff cuối. Tối đa2 subagents, không gửi full history; main sở hữu implementation.

## 16. Kiểm chứng và tiêu chí xong

- Unit: fixed seed vectors; reorder selection; every trait source in selected set; mỗi loài có signature thấy được; geometry/capability constraints; bounded retry/fallback; phân biệt DNA/appearance hash; clip/FX gene không mất qua roundtrip.
- Property-style test seeded loop, không thêm thư viện test chỉ để random; ít nhất 10.000 mẫu/loài đơn và 1.000/set lai, có báo cáo diversity. So sánh config bằng giá trị; không dùng screenshot GPU exact giữa 2 nền tảng.
- UI: chọn 0/1/3/4, tap liên tiếp, đổi draft khi đang tạo, loading lỗi, save retry, reopen/rename, một pet/empty/pending-delete, hủy/xác nhận xóa, chặn save khi đã có pet; keyboard/small screen/landscape, VoiceOver/TalkBack, Reduced Motion, blur/unmount.
- Storage/sync: offline restart; double save; hai thiết bị cùng create (chỉ một thắng); delete ACK mất/retry; create hoặc rename cũ sau delete; delete cũ sau tạo pet mới; revision đã tiến quá lastOperationId; không tự rebase; cleanup cache/thumb khi nhận empty/petId mới; account switch/logout/delete khi có tác vụ; malformed/unknown version. Rules emulator phải chặn UID khác/revoked, document tùy ý, hard-delete fence, đổi A→B và sửa DNA trái phép.
- 3D: turntable mọi profile/part, idle/reaction/cast seams, thiếu optional socket, GPU context loss,20 navigation cycles,100 rerolls và 10 phút FPS/memory; máy Android thấp+máy chuẩn và iPhone thật. Kiểm tra game/audio/memory navigation không bị loop3D chạy ngầm.
- Gate theo repo: `npm run typecheck`; `npm run lint`; `npm test -- --watchman=false --runTestsByPath <test-path>`; full `npm test -- --watchman=false`; `npm run test:rules` khi đổi rules; `npm run test:functions` khi đổi user-admin; `npm run bundle` và development build iOS/Android cho native dependency.
- Bàn giao: ba màn chạy đủ requirement, mỗi tài khoản tối đa một pet đã lưu, xóa được và sau xác nhận có thể nhận pet mới, stale offline không làm sống lại pet đã xóa. Asset có license, pet hiện tại tái tạo được, diversity/performance có số đo và giới hạn; không claim “độc nhất” chỉ dựa petId/seed.

## 17. Các điểm cần chốt trước khi code

1. Renderer chính vẫn là ứng viên tới khi spike máy thật đạt; không thêm Rive/Skia/Reanimated vào nhánh3D.
2. Người dùng duyệt bộ 6 loài và concept chibi 3D mẫu; xác định ai cung cấp/sản xuất model/rig/clip và quyền sử dụng. Đây là đường găng, không được thay bằng mesh primitive tạm rồi coi feature hoàn thành.
3. Chốt mức “ít trùng” sau đo catalog; V1 chưa có cam kết unique toàn cầu/giá trị trao đổi.
4. Người dùng đã chốt 3D, đồng bộ tài khoản/offline, tối đa một pet và có thể xóa. Skill effect là magic cosmetic trong đề xuất; không có monetization hay hệ chiến đấu.

## 18. Nguồn chính thức

- [S1 React Three Fiber: React 19/Fiber 9 và native Expo/GL/assets](https://r3f.docs.pmnd.rs/getting-started/installation).
- [S2 Expo 55 GLView: version, native context và lưu ý thư viện dùng API web](https://docs.expo.dev/versions/v55.0.0/sdk/gl-view/).
- [S3 React Native Filament: repository](https://github.com/margelo/react-native-filament), [installation](https://margelo.github.io/react-native-filament/docs/guides), [Animator](https://margelo.github.io/react-native-filament/docs/guides/animator).
- [S4 Rive runtime](https://rive.app/docs/runtimes/react-native/react-native), [Lottie React Native](https://github.com/lottie-react-native/lottie-react-native).
- [S5 Three SkeletonUtils source: clone skinned mesh/bone mapping](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/utils/SkeletonUtils.js), [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html). Implementation phải pin theo version đã chọn, không import branch dev.
- [S6 Expo 55 Crypto: random bytes, UUID và digest](https://docs.expo.dev/versions/v55.0.0/sdk/crypto/).
- [S7 Three AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html).
- [S8 Firestore offline](https://firebase.google.com/docs/firestore/manage-data/enable-offline), [security conditions](https://firebase.google.com/docs/firestore/security/rules-conditions).
- Registry publisher metadata để khảo sát peer versions: [Fiber 9.8.2](https://www.npmjs.com/package/@react-three/fiber/v/9.8.2), [Three 0.186.1](https://www.npmjs.com/package/three/v/0.186.1). Các version chính đã cài; benchmark máy thật chưa thực hiện.
