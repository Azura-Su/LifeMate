# Đề xuất: khung hình và cảnh riêng cho các linh thú còn lại — 30/10/2026

## Mục tiêu, phạm vi và hiện trạng

Làm các loài còn lại có chuỗi hành động và cảnh ngủ/thức rõ như Cửu Vĩ Hồ,
Lang Linh, Thiên Lộc. Đầu ra là các khung PNG raster và atlas dùng được trên Home,
màn xem thử Home và màn Linh thú. Đây là kế hoạch; chưa tạo thêm art hoặc đổi code.

Giữ nguyên15 loài random và Thiên Dực Linh Lộc riêng của admin.12 loài cần mở rộng
là Kỳ Lân Hỏa, Thiên Mã Kỳ Lân, Huyền Vũ, Nhân Sư, Nhân Mã, Bạch Hổ, Thanh Long,
Lý Ngư Hóa Long, Scylla, Chim Lạc, Phượng Hoàng, Anubis. Garuda đã có cảnh riêng,
chỉ bổ sung/chỉnh khung nối còn thiếu. Ba loài chuẩn không làm lại trong đợt này.
Giữ quyền sở hữu, random, biệt danh, level/EXP, kỹ năng và mốc mở cảnh ngủ hiện tại.

Đã đọc SPEC, catalog, renderer, mapping Home, wake window, cảnh ngủ và tests.
Mỗi loài hiện có atlas Home16 khung:4idle,4move,4happy,4signature; nghỉ và kéo
có atlas riêng. Đã xem trực tiếp sheet Kỳ Lân, Huyền Vũ nghỉ và Thanh Long.
Điểm cần cải thiện là số tư thế trong từng chu kỳ, chuyển tiếp và cảnh theo loài;
không chỉ tăng kích thước sheet hay đổi tốc độ bốn ảnh cũ.

## Chuỗi dùng chung và khung cần bổ sung

Chuỗi: thức → di chuyển chậm → tăng tốc/động tác riêng → đổi hướng/đáp →
di chuyển tới điểm nghỉ → hạ người → ngủ, thở → được chạm/kéo đánh thức.
Mỗi loài chỉ nhận những hành động phù hợp cơ thể; rùa không nhảy/chạy nước đại,
rồng/cá không bị ép bước bốn chân. Có cánh mới có cất cánh, vỗ cánh và lượn.

| Nhóm khung | Ngân sách dự kiến/clip | Những thay đổi phải thấy |
| --- | --- | --- |
| Đứng/chờ | 6–8 | Chớp mắt, tai/mào/râu, ngực thở; hình không trôi khỏi điểm neo. |
| Đi/bò/bơi chậm | 8–12 | Chu kỳ chi rõ, chân sau đổi lượt; thân/vây/xúc tu có độ trễ. |
| Chạy/tăng tốc | 8–12, nếu phù hợp | Tư thế mới ở pha chống/nhấc người; khác đi bộ tăng tốc đồng hồ. |
| Đổi hướng | 6–8 | Đầu nhìn trước, vai/thân/đuôi theo sau; giữ đúng tay cầm đồ. |
| Nhấc/rơi/đáp | 6–8 mỗi pha cần sửa | Co chi khi rơi, duỗi chi trước chạm, nhún chịu lực rồi ổn định. Tái dùng atlas kéo đạt chất lượng. |
| Cất cánh/vỗ/lượn | 8/12–16/8, chỉ loài phù hợp | Khép–mở cánh, chân rời đất, cánh đẩy xuống nâng thân; lượn dang ổn định. |
| Hạ người vào ngủ | 12–16 | Hạ vai/hông, gập chân/gập cánh/cuộn thân rồi mới nhắm mắt. |
| Thở khi ngủ | 6–8 | Ngực/bụng chuyển nhẹ, đầu/chi có trọng lượng; không chỉ scale cả ảnh, không Zz. |
| Thức dậy | 10–12 | Mở mắt, ngẩng đầu, duỗi người, chống chân rồi mới rời chỗ. |
| Dấu ấn riêng | 12–16 | Một động tác nhận ra loài, không lặp nút vui vẻ/nhảy múa giống nhau. |

Đây là ngân sách để làm storyboard, không phải yêu cầu sinh tất cả khung mới.
Tái dùng tư thế đạt yêu cầu. Khung giữ lâu phải khai báo hold time, không tính
nhiều bản sao thành nhiều tư thế. Mỗi clip có thời lượng, điểm tiếp xúc chân và
pose nối; không nối hai silhouette khác nhau bằng hòa mờ làm thừa chân/cánh.

## Thiết kế từng loài

Mỗi hàng dưới đây là một storyboard riêng. Màu, khuôn mặt, tỷ lệ, hoa văn và số
chi/cánh/sừng lấy từ ảnh/atlas đang có, không thay thành nhân vật mới.

| Loài / ID | Khung chuyển động và dấu ấn | Khung hạ người, ngủ, thức | Cảnh mọc lên khi nghỉ → cảnh tan khi thức |
| --- | --- | --- | --- |
| Kỳ Lân Hỏa / `qilin` | Bước bốn vó rõ trước/sau; chạy nhún có pha chống–thu–vươn; giậm một vó làm lóe vòng lửa thấp. Bờm/đuôi trễ nhịp. | Gập hai chân trước, hạ hông, thu chân sau, đuôi ôm sườn; lửa bờm giảm còn ánh ấm. Thức thì chống hai chân trước rồi nâng hông. | Vườn đá ngọc, trúc thấp và khe sáng màu hổ phách xuất hiện từng lớp; đá có phù văn. Khi thức, trúc vàng, ánh khe tắt, đá nứt thành bụi vàng theo gió. |
| Thiên Mã Kỳ Lân / `alicorn` | Đi vó với cánh gập; khuỵu gối lấy đà → đập cánh → bay vòng thấp → duỗi vó đáp → gập cánh. Giữ một sừng và bờm dài. | Chạm đủ vó trước khi gập chân nằm nghiêng; cánh che nhẹ sườn, bờm rũ. Thức duỗi cổ, dựng tai, đứng lên rồi mới mở cánh. | Mỏm đá nhỏ trên mây, tinh thể pastel và vòm sao mảnh kết dần. Khi thức, sao trôi lên, tinh thể mờ vỡ, mây tách hai bên để lộ nền Home. |
| Huyền Vũ / `black_tortoise` | Bò chậm bằng bốn chân đổi lượt; thân nhích sau lực đẩy chân sau; cổ nhìn trái/phải. Mai giữ trọng lượng, không nảy như bóng. | Hạ thấp thân, thu chân trước/sau và cổ dần vào mai; mắt khép cuối. Thở rất nhẹ ở cổ/phần bụng lộ ra. Thức thò đầu trước, chân sau rồi mới bò. | Bờ hồ sen nông, phiến đá rêu, cỏ và hoa sen nở chậm; ký hiệu trên đá sáng dịu. Khi thức, sen khép, nước rút thành vòng gợn, rêu khô thành hạt sáng tan đi. |
| Nhân Sư / `sphinx` | Dáng mèo lớn: vai và hông đổi pha; đuôi quét. Cánh gập khi đi, mở khi bay; dấu ấn là vươn vai rồi ngẩng đầu. | Hạ hai chân trước sát nhau, gập chân sau, nằm kiểu sư tử; cánh khép, đầu đặt nhẹ lên chân. Khi thức, nâng đầu, vươn lưng rồi đứng. | Bệ sa thạch, hai cột thấp, đường nét đền xa và trời chiều vàng; chừa mặt/phụ kiện đầu. Khi thức, cát phủ bệ, cột rạn rồi tan theo luồng gió ngang. |
| Nhân Mã / `centaur` | Bốn chân ngựa đổi pha, thân người cân bằng theo lực chân; tay giữ cung không giật theo từng vó. Dấu ấn giương cung bắn một lá sáng. | Đặt cung cạnh mình, gập bốn chân xuống thân ngựa, thân trên nghiêng nghỉ; không xuất hiện thêm chân người. Thức chống thân, đứng lên rồi nhặt cung. | Trảng rừng nhỏ, vòng đá rêu, cỏ dại và hoa mọc theo đường cong; cây sồi lệch một bên. Khi thức, lá vàng cuốn lên, dây leo thu lại, vòng đá tan thành bụi lá. |
| Bạch Hổ / `white_tiger` | Đi rình thấp vai, chân sau đạp thật; chạy có pha thu và vươn cả bốn chân; cú chồm ngắn rồi đáp. Đuôi giữ nhịp riêng. | Co chân sau, duỗi hai chân trước, hạ đầu lên chân, đuôi vòng bên hông; giữ vằn ổn định. Thức ngáp nhỏ, duỗi chân và vươn lưng. | Rừng trúc xanh bạc, đá thấp và dãy núi mờ; vài lá/tuyết mảnh. Khi thức, gió quét qua trúc, lá xoay lên, cảnh mờ dần thành sương. |
| Thanh Long / `azure_dragon` | Uốn sóng từ đầu qua giữa thân tới đuôi; râu/bờm đi sau một nhịp. Khi đổi hướng, đầu dẫn trước; dấu ấn nâng long châu, lượn quanh nó. | Cuộn thân thấp thành vòng, đầu tựa lên đoạn thân; râu rũ và mắt khép. Thức mở mắt, nâng đầu, tháo từng vòng từ đầu về đuôi. | Núi thủy mặc nhỏ, mây mỏng và cổng đá ven nước hiện dần; long châu giữ trong khoảng trống. Khi thức, mây đổi sắc, nước thành hơi, núi/cổng tan theo dải mây. |
| Lý Ngư Hóa Long / `koi_dragon` | Bơi bằng nhịp đuôi đẩy và vây giữ thăng bằng; tăng tốc làm thân cong sâu hơn; bật một cung nước thấp rồi đáp vào làn nước. Giữ nguyên dạng cá/rồng hiện có. | Giảm nhịp vây, hạ vào hõm nước/đài sen, đuôi cuộn sát thân; không nằm khô trên mặt đất. Thức quẫy đuôi nhẹ, mở vây rồi bơi đi. | Hồ nhỏ, sen, thác thấp và Vũ Môn ở xa dựng theo lớp. Khi thức, cổng phản chiếu vỡ thành gợn, thác ngừng, nước rút thành giọt sáng rồi trong suốt. |
| Scylla / `scylla` | Thân trung tâm ổn định; các cổ đầu chó và đuôi/xúc tu chuyển so le, không lắc tất cả cùng pha. Dấu ấn là các đầu ngẩng theo lượt rồi lóe lửa thấp. | Thân cuộn, các cổ gập về các vị trí khác nhau, từng cặp mắt nhắm lệch nhịp; đủ sáu đầu phụ. Thức từng đầu ngẩng lên, thân mở vòng sau cùng. | Vịnh biển xanh ngọc, đá ven bờ và san hô phát quang mọc dần, nước ôm quanh thân. Khi thức, thủy triều rút, san hô tắt sáng, đá mờ vào bọt biển. |
| Chim Lạc / `lac_bird` | Đi hai chân xen kẽ, đầu nhún ít; lấy đà, vỗ cánh nhiều lớp rồi lượn vòng và đáp. Đuôi dài đi sau đường bay, không xuyên thân. | Đậu lên bệ thấp, khép cánh, thu chân, gập cổ tựa đầu vào vai; đuôi xếp tự nhiên. Thức dựng mào, nâng đầu, duỗi chân rồi mở cánh. | Bãi lau bên hồ, bệ đá hoa văn trống đồng, vòng sáng đồng mờ. Khi thức, lau khô, vòng đồng tách thành nét sáng, sương nước cuốn cảnh đi. |
| Phượng Hoàng / `phoenix` | Vỗ cánh có pha nâng/hạ rõ, thân trễ theo cánh; chân thu khi bay, bung khi đáp. Dấu ấn là một vòng lửa nhỏ mở thành cánh, không che mặt. | Đáp vào tổ thấp, gập cánh, thu chân, đầu cúi vào ngực; đuôi lửa cuộn quanh tổ và giảm sáng. Thức ngẩng đầu, bung cánh, lửa tăng dần rồi cất cánh. | Tổ trên đá núi lửa đã nguội, hoa đỏ và vài đốm than ấm. Khi thức, đốm than bay lên, hoa thành tro, đá vỡ mờ; không chớp sáng toàn màn hình. |
| Anubis / `anubis` | Bước hai chân rõ chuyển trọng lượng gót–mũi; tay cầm trượng/cổ tay giữ ổn định. Dấu ấn nâng biểu tượng ankh với một vòng ký tự nhỏ. | Cất/đặt trượng cạnh bệ, ngồi gập gối, tay đặt lên đùi, đầu cúi nhẹ và khép mắt. Thức ngẩng đầu, chống một chân, đứng rồi cầm trượng. | Bệ đền Ai Cập thấp, cột đá và ký tự vàng từng nét; trời hoàng hôn tím nhạt. Khi thức, ký tự bay lên, cát cuốn quanh chân cột, đền tan thành hạt vàng. |
| Garuda / `garuda`, hoàn thiện | Giữ đường bay và cảnh mây–bệ–đền đang có; thêm khung chân chạm bệ, gập cánh, giữ thăng bằng. Dấu ấn Kim Sí Phong giữ cánh vàng và mặt rõ. | Chuyển từ đáp sang ngồi nghỉ trên bệ bằng pose nối; thức mở mắt, nhấc người, mở cánh rồi rời bệ. | Tái dùng mây khép → bệ đá ghép → núi đền trồi. Bổ sung khung tan: đền tắt sáng, bệ tách đá, mây mở ra; tránh xóa cả cảnh ngay một nhịp. |

## Storyboard cảnh ngủ/thức

- Cảnh rộng dự kiến240–280pt, bằng khoảng2lần khung pet120pt; điều chỉnh cho máy
  hẹp bằng layout, không thu nhỏ pet riêng. Trời/đền/cây cao hơn đầu nhưng giữ
  khoảng trống quanh mặt, cánh và sừng; mặt trời/trăng chỉ có ở cảnh đã chọn.
- Mỗi cảnh có24–32 khung xuất hiện,6–8 khung vòng yên tĩnh nếu cần,24–32 khung
  tan khi thức. Xuất hiện khoảng3–5giây; tan khoảng4–6giây. Garuda giữ nhịp riêng
  đã có. Bốn mốc để duyệt: trống → nền thấp → kiến trúc/cây chính → hoàn chỉnh;
  thức: nguyên trạng → tàn/rút nước → phân rã → alpha0.
- Tất cả là raster PNG có alpha; cảnh nền không chứa bản sao thú. Mép cảnh
  được xử lý hòa vào màu Home khi đóng gói, không có ô nền chữ nhật, không dùng
  SVG làm cảnh cuối cùng. Vật thể sáng và phần chính nằm trong vùng an toàn.
- Cố định điểm chân/chỗ cuộn ngủ. Pet không dịch ngang để khớp cảnh. Khi thức,
  pet đi trước, cảnh giữ nguyên chỗ cũ rồi tan; dừng/tiếp tục đúng frame khi rời Home.
- Đánh thức giữa lúc cảnh đang mọc: bắt đầu tan từ đúng mức đang hiện, không
  nhảy sang cảnh trưởng thành. Giới hạn một cảnh rời đi còn sống; tương tác liên
  tục không nhân bản cảnh hoặc giữ atlas không còn dùng.
- Sau mỗi lần đánh thức, pet hoạt động ít nhất20giây Home active trước khi bắt
  đầu vào ngủ. Nếu đang bay phải đáp an toàn; ngủ xong không tự thức theo timer.
  Mốc Lv2 của cảnh ngủ được giữ nguyên; công cụ admin có thể xem thử để QA.

## Cách làm khung và hệ thống phát

1. Dùng ảnh gốc/atlas hiện có làm reference, liệt kê key pose còn thiếu từng clip.
   Tách mask/lớp đúng khớp và dùng raster tooling để dựng khung trung gian; xử lý
   vùng bị che và thứ tự chân trước/sau theo loài. Bổ sung pixel/texture từ nguồn
   hiện có bằng code, xuất toàn bộ nhân vật vào mỗi frame. Không chỉ xoay, kéo
   giãn nguyên tấm ảnh hoặc pixel hóa ảnh gốc bằng bộ lọc. Không gọi AI tạo ảnh.
2. Có giới hạn thực tế: một ảnh đơn không cho biết mặt sau/phần khuất. Pilot
   phải chứng minh khung mới giữ đúng anatomy và chất lượng. Nếu thiếu dữ liệu,
   ghi rõ pose bị thiếu, chọn góc nhìn giữ được nhận diện hoặc bổ sung dữ liệu
   art hợp lệ; không tự tuyên bố chuyển được mọi ảnh thành hoạt ảnh đẹp.
3. Chuẩn hóa metadata theo clip: atlas/page, grid, track, duration, loop, anchor,
   hướng nhìn, sự kiện tiếp đất và capability như bay/bơi. Tái dùng
   `PixelPetAtlas`, `usePetPlayback`, `homePetMotion`, wake window và scene hiện có.
   Cấu hình từng loài ở registry; không thêm12 chuỗi `if species` vào roamer.
4. Tách phần chọn chu kỳ/chọn cảnh khỏi `HomePetRoamer` khi tích hợp pilot;
   renderer chung chỉ phát cấu hình. Giữ default/fallback cho loài chưa triển khai.
   Không thay renderer và toàn bộ điều khiển trong cùng một bước lớn.
5. Ưu tiên atlas16/32 khung mỗi page, ô256px. Không kéo dài một sheet khổng lồ
   để chứa mọi clip. Chỉ mount page hiện tại, chuẩn bị page tiếp theo khi cần;
   thu hồi cảnh/atlas cũ. Nguồn và cách pack ghi vào provenance.
6. Nhịp chân căn với vận tốc thực; chân đang chống không trượt. Không di chuyển
   thì giữ pose đứng. UI thread cập nhật vị trí theo màn hình; không React
   setState/JS timer cho mỗi frame. Giữ các clip/API cũ và callback one-shot.

## Chia việc và thứ tự

Danh sách việc cụ thể ở `todo.md`. Mỗi loài được triển khai theo các lát nhỏ sau,
áp dụng tiêu chí riêng trong bảng storyboard, không làm đồng loạt tất cả assets:

| Lát việc | Tiêu chí chấp nhận | Kiểm chứng | Phụ thuộc / file dự kiến / cỡ |
| --- | --- | --- | --- |
| F1: chốt baseline và manifest clip | Có inventory pose thật/pose lặp, anchor và capability cho16ID; định nghĩa pose nối và budget page. | Đọc registry/manifest; kiểm tra grid, alpha, bbox, frame không rỗng và ID không lẫn. | Không phụ thuộc; `homePetMotion.ts`, metadata asset, test mapping, SPEC;3–4file, M. |
| F2: phát pilot theo cấu hình | Loài pilot dùng manifest, loài khác giữ luồng cũ; clock/callback/fallback vẫn đúng. | Regression đổi loài, page lỗi/tải chậm, one-shot, pause/resume, Reduced Motion. | F1; renderer/manifest/scene cùng tests, mỗi lần tối đa5file, M. |
| A: một cụm clip nhân vật | Điểm neo/tỷ lệ và chi đúng; tất cả key pose của cụm đó thực sự khác; pose đầu/cuối nối đúng. | Contact sheet + phát chậm0.25× và tốc độ thật120pt; kiểm tra contact chân/cánh và loop. | F1;1–2page PNG + metadata + provenance/test, tối đa5file/lần, M. Lặp A cho đi/đáp và ngủ/thức. |
| B: cảnh riêng một loài | Có appearance/hold/decay; alpha0 ở cuối, chừa mặt; đánh thức sớm giữ mức trưởng thành đang hiện. | Contact sheet các mốc; preview mép trái/giữa/phải trên nền Home; scene timeline tests. | A ngủ;1–3page cảnh + metadata + test, tối đa5file/lần, M. |
| C: nối Home và xem thử | Đúng điểm đáp/ngủ; awake20s; kéo giữa mọi pha không khóa tương tác, không làm pet nhảy chỗ. | Jest roamer/preview/scene; iOS runtime, Android khi có; kiểm tra Lv1/Lv2/Lv8 và3scale. | A/B/F2; adapter/registry/preview và tests,3–5file, M. |

Thứ tự triển khai: **Kỳ Lân Hỏa** (pilot bốn chân) → **Huyền Vũ** (pilot chậm,
rụt vào mai) → checkpoint chất lượng → **Thiên Mã Kỳ Lân** (pilot có cánh) →
checkpoint đường bay → **Bạch Hổ → Nhân Sư → Nhân Mã → Thanh Long → Lý Ngư →
Scylla → Chim Lạc → Phượng Hoàng → Anubis** → hoàn thiện Garuda → QA toàn bộ.

Sau mỗi2–3 loài, kiểm tra lại Cửu Vĩ/Lang Linh/Thiên Lộc để phát hiện regression.
Không mở rộng pilot khi pose hoặc đường nối chưa đạt. Chốt preview pilot ở kích
thước Home thật trước khi nhân rộng. Mỗi lát A/B/C là một commit có thể quay lại.

## Chất lượng và hiệu năng phải đo

- Nhìn thumbnail120pt vẫn nhận ra loài; khuôn mặt, màu và hoa văn khớp reference,
  không mất/nhân đôi chân, đầu phụ, cánh, sừng hoặc đồ cầm. Duyệt được từng khung.
- Chân sau phải có pha chống–nhấc–vươn; wing downstroke/upstroke và ngực thở có
  chuyển động thực. Không chấp nhận chỉ rung/scale cả ảnh, nhân đôi frame, hoặc
  hòa mờ để che dáng sai. Không đặt tiêu chí “giống99%” khi chưa có cách đo hợp lệ.
- Nối clip không đổi tỷ lệ/điểm chân; kiểm tra silhouette nhảy bất thường và vị
  trí tiếp đất. Khi ngủ không chèn Zz, Buồn ngủ/Tò mò/nhảy múa riêng đã bỏ.
- Mục tiêu60FPS trên màn60Hz. Ngưỡng QA dự kiến: sau warm-up, median ít nhất58FPS,
  p95 khoảng cách frame≤20ms, frame>33.3ms dưới1% trong bài120giây có ngủ/thức/kéo.
  Đo UI và JS riêng trên bản release; ghi rõ máy, OS, RAM, build và kết quả.
- Atlas256px×32frame RGBA chiếm8MiB giải mã, không phụ thuộc PNG nén bao nhiêu.
  Budget phần ảnh active dự kiến24MiB, trần32MiB với prefetch/cảnh rời đi;
  phải đo tổng memory/GPU thực tế và giảm page/chi tiết nếu vượt. Không preload16loài.
- Test đầy đủ background/foreground, mở menu/lịch, đổi loài, bật Reduced Motion,
  tải ảnh lỗi và đánh thức nhiều lần. Chỉ cảnh phát xong mới gỡ, callback cũ
  không được thay clip mới. Home bên ngoài hitbox pet vẫn cuộn/chạm được.
- Chạy Jest liên quan Home/playback/atlas/frame/drag; `npm run typecheck`, ESLint
  file đổi, `npm run bundle`. Full Jest khi kết thúc; test backend chỉ khi thực
  sự chạm backend. Chưa cần migration hay cloud deploy cho phần mỹ thuật này.

## Rủi ro và điều kiện chốt

| Rủi ro | Cách xử lý |
| --- | --- |
| Nguồn thiếu góc/chi bị che; tạo thêm frame làm méo nhận diện | Pilot key pose trước; ghi pose thiếu; chỉ nhận khung đạt thay vì ép tăng số lượng. |
| Cánh/đuôi bị cắt hoặc biểu tượng bị đảo khi quay trái | Safe gutter theo silhouette; hướng riêng cho clip bất đối xứng, không flip tùy tiện cả đồ cầm. |
| Cảnh riêng gây cảm giác dán ô vuông hoặc che thú | Layout dựa ground anchor; alpha feather ở asset, mặt nằm trước cảnh, review trên nền Home thật. |
| Roamer phình với nhiều nhánh theo loài | Manifest và adapter nhỏ; chuyển pilot trước, giữ fallback; không viết lại sở hữu hay luồng random. |
| Thêm nhiều PNG làm giảm FPS hoặc tăng RAM | Page nhỏ, tải theo clip, giới hạn cảnh rời đi, profiler release trước/sau. |
| SPEC có đoạn cũ nói ngủ sớm/tự thức hoặc nền vector | Khi triển khai đồng bộ lại theo luật20s và raster hiện tại; không phục hồi hành vi cũ. |

Kết quả cần giao mỗi loài: contact sheet PNG, preview động ở kích thước Home,
atlas+metadata+provenance, regression và số đo runtime. Kế hoạch cần được người
dùng xem trước khi chuyển sang tạo assets và thay code. Các kế hoạch đã hoàn tất
bên dưới được giữ nguyên làm lịch sử.

---

# Chia khoản chi theo người/suất — 29/10/2026

1. Trong Thêm/Sửa giao dịch → Có người cần trả lại, thêm lựa chọn Chia đều,
   Theo suất, Tự nhập. Giữ Tự nhập làm mặc định và giữ nguyên tiền đã lưu khi
   mở sửa giao dịch cũ. Chia đều có tính phần của tôi mặc định, cho phép bỏ;
   theo suất cho nhập suất từng người và suất của tôi (có thể 0).
2. Utility tính số tiền nguyên đồng bằng phân bổ tỷ lệ + phần dư lớn nhất,
   tie theo thứ tự hiển thị (tôi rồi các người khác). Nhận suất thập phân tối đa
   2 chữ số, dấu chấm/phẩy; không dùng số thực để nhân số tiền lớn. Tổng các
   phần phải bằng hóa đơn; không lưu người nợ 0đ hoặc số tiền vượt khả năng lưu.
3. Tách block chia khoản chi sang SharedExpenseSplitEditor theo UI token; tiền
   tự tính hiển thị rõ, Tự nhập vẫn sửa trực tiếp. Đổi sang Tự nhập giữ số đang
   xem; thêm/bớt người hoặc sửa hóa đơn tự tính lại ở chế độ tự động.
4. Giữ data contract SharedExpense hiện tại (participants/receipts); lưu số tiền
   kết quả như cũ, không thêm metadata/rules/migration. Giữ chặn giảm nợ thấp
   hơn đã nhận, xóa người có lịch sử trả, receipts và công thức báo cáo hiện có.
5. Reviewer duyệt plan/diff vì thay tính tiền. Test phân bổ/tổng/làm tròn/suất
   sai/số lớn và luồng UI lưu/sửa/receipt. Typecheck, lint, Jest liên quan và
   kiểm tra native khi có Simulator. Không deploy trong lượt này.

---

# Đã hoàn tất: Quản lý linh thú cho admin, 28/10/2026

1. Trang riêng trong menu Quản trị: danh mục 15 linh thú, trạng thái trống/giữ
   chỗ/có chủ, tên/email/UID người giữ, cấp độ và EXP do backend tính. Tìm kiếm
   cục bộ, tải lại/kéo để làm mới. Thumbnail tĩnh, không chạy 15 animation.
2. Dùng user-admin và kiểm tra admin Firebase hiện hành; RPC chỉ service_role,
   kiểm tra lại admin ở SQL. Không nhận UID người thao tác hoặc EXP từ client.
3. Thu hồi có xác nhận; gửi UID + loài + adoptionId đã xem và actionId ổn định.
   Giao dịch khóa tài khoản pet, kiểm tra đúng lượt nhận nuôi, lưu audit và
   chống thực thi lại. Pet trở lại kho; lượt random đã dùng được giữ nguyên,
   tiến trình cũ không chuyển sang người nhận nuôi mới.
4. Vô hiệu kết quả yêu cầu cũ, chặn khôi phục sau thu hồi; lượt random còn lại
   vẫn dùng được. Đồng bộ EXP kiểm tra adoptionId để snapshot cũ không áp dụng
   sang pet mới. Màn đang hoạt động đọc trạng thái nhẹ để bỏ pet đã thu hồi.
5. Reviewer đọc plan trước triển khai và diff sau triển khai. Regression SQL
   (quyền, CAS, idempotency, restore, receipt, EXP, xóa tài khoản), Edge auth,
   client/UI và session/abort. Chạy test:functions, Jest liên quan, typecheck,
   ESLint và export. Không thêm thư viện, không thao tác pet thật. Deploy
   Supabase và Firebase Rules theo yêu cầu ngày 28/10.

Triển khai: migration → pet-access mới → user-admin mới. App native cần phát
hành riêng để màn admin xuất hiện cho người dùng.
Nguồn: Supabase Database Functions (security definer/search_path và EXECUTE),
https://supabase.com/docs/guides/database/functions; changelog đã kiểm tra 28/10.

---

# Đã hoàn tất: Linh thú — thêm khung hình animation, 28/10/2026

## Mục tiêu và thiết kế

Giữ ngoại hình 15 linh thú hiện tại. Thay chuyển động cả tấm ảnh bằng các pose
khác nhau: chớp mắt/thở, bước chân hoặc vỗ cánh/uốn thân, vui vẻ và thi triển
kỹ năng. Ảnh gốc là reference và fallback; không thay quyền sở hữu, EXP hay API.

- 14 ảnh minh họa: sinh sprite sheet 4×4 (16 pose/loài), nền trong suốt, cùng
  góc nhìn/tỷ lệ/điểm neo. Kiểm tra từng sheet trước đóng gói. Bạch Hổ tiếp tục
  giữ phong cách rig pixel hiện tại và có các pose di chuyển tương ứng.
- Tạo asset bằng imagegen tích hợp; không thay bằng biến dạng nguyên tấm ảnh.
  Đóng gói atlas cục bộ, giảm kích thước sau kiểm tra, không tải mạng lúc chạy.
- Bộ phát khung hình dùng progress Reanimated trên UI thread, không setInterval
  hoặc React setState mỗi frame. Chỉ atlas của pet đang hiển thị được giải mã.
  Giữ ảnh gốc khi atlas chưa sẵn sàng/lỗi; Reduced Motion/mất focus dừng animation.
- Các clip cũ giữ nguyên ID. Đi/bay lặp dùng cho Home; màn Linh thú cho xem thử
  chuyển động. Giữ callback one-shot và các giai đoạn hiện tại.

## Các bước và tiêu chí

1. Chốt layout atlas, nhóm clip và giới hạn bộ nhớ; reviewer chỉ đọc phản biện.
2. Làm một sheet mẫu có cánh, kiểm tra identity/alpha/alignment/chuyển động;
   sau đó tạo các sheet còn lại theo cùng tiêu chuẩn. Không chấp nhận sheet
   chỉ lặp lại một pose hoặc có cánh/chân bị cắt.
3. Test frame mapping/cancellation/fallback trước rồi thêm renderer atlas;
   chỉ mount atlas đang dùng, dừng khi inactive/reduced motion.
4. Tích hợp Home và nút xem thử, kiểm tra 15 loài và ba giai đoạn. Các nút
   xem animation không gọi API hoặc tiêu lượt random/chăm sóc.
5. Reviewer rà diff; Jest nhóm pet/Home, typecheck, ESLint, kiểm tra assets và
   export native. Ghi rõ những kiểm tra runtime/thiết bị chưa thực hiện được.

Task checklist ở todo.md. Không thêm dependency hoặc deploy trong lượt này.
