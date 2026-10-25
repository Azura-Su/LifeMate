# Phỏm online — 23/10/2026

## Mục tiêu và luật đã chốt

Người dùng yêu cầu thêm Phỏm chơi thật trong danh mục online và tự cấu hình từng
loại điểm. Đã chọn2–4 người,52 lá,9 lá/người, người mở có10 lá; ăn/bốc, hạ/gửi,
đền ăn3 cây và đền ù. Không thêm bot, giao dịch hoặc thanh toán.

### Quy ước bàn phiên bản phom-v1

- A thấp: A–2–3 hợp lệ; Q–K–A không hợp lệ. Phỏm là3–4 lá cùng số hoặc ít nhất3
  lá cùng chất liên tiếp. Điểm rác A=1, J=11, Q=12, K=13.
- Người thắng ván trước mở; nếu vắng thì ghế đầu hiện tại. Mỗi người đánh4 lượt;
  mặc định không tái. Có thể bật Tái khi tạo phòng hoặc sửa luật ván tới. Ăn trước
  vòng hạ vẫn giữ bốn lượt cố định; ăn sau lần hạ đầu tiên bỏ lá khỏi dãy bài
  người cấp và giảm một lượt đã đánh của họ, để họ có thể có thêm lượt.
  Người đã hạ được bốc/ăn lại, hạ phỏm mới từ rác, gửi nếu bật rồi đánh.
  Giữ nguyên phỏm và thứ tự hạ ban đầu để tính hòa điểm; trong tái được gửi
  vào mọi phỏm người khác đã hạ trước lượt hiện tại.
- Người mở đánh trước. Lượt sau ăn lá mới nhất của người trước nếu còn khả năng
  xếp mọi lá đã ăn vào các phỏm rời nhau, mỗi phỏm tối đa1 lá ăn; hoặc bốc nọc.
  Không được đánh lá đã ăn hoặc phá điều kiện giữ các lá ăn trong phỏm.
- Trước lần đánh thứ4 phải hạ tất cả phỏm có thể hạ; máy gợi ý bộ tối ưu nhưng
  người chơi được chọn cách xếp hợp lệ. Khi bật Gửi bài, sau hạ có thể gửi rác vào phỏm người đã
  hạ trước, mỗi lần1 lá, trước khi đánh lá cuối. Móm không được gửi.
- Sau hạ/gửi, có ít nhất1 phỏm của chính mình và còn0–1 lá rác thì được ù gửi,
  tính mức ù thường. Ù tròn chỉ khi10 lá trước hạ/gửi đều vào phỏm của chính mình.
- Có thể báo ù khi toàn bộ bài hoặc toàn bộ trừ1 lá tạo phỏm; ù tròn khi cả10 lá
  đều tạo phỏm. Server xác nhận; không nhận khai báo điểm/phỏm từ client làm kết quả.
- Nếu không ù: người có phỏm xếp trước móm; ít điểm rác hơn thắng; hòa điểm xét
  thứ tự hạ. Móm hòa xét thứ tự đánh cuối. Người bỏ cuộc xếp sau người còn chơi.
  Nếu tất cả móm, thứ tự hạ quyết định hạng, người hạ trước nhất nhận mức móm.
- Ăn thường/chốt tính chuyển điểm giữa người đánh và người ăn; chốt là lá đánh
  thứ4. Khi bật Ù đền: đền3 cây: nếu một người cấp cả3 lá ăn cho người ù, người đó đền. Nếu ù
  trong vòng hạ và đã có người ăn chốt, người ăn chốt gần nhất đền, trừ chính người
  ù; ưu tiên đền3 cây. Mức đền mỗi đối thủ cấu hình riêng. Không cộng thêm mức
  nhì/ba/bét/móm khi đã ù; giao dịch ăn đã xảy ra vẫn giữ, tổng delta luôn bằng0.
- Lượt40 giây dùng deadline server. Timeout bốc nếu cần, tự hạ tối ưu ở lượt cuối,
  đánh lá rác lớn nhất hợp lệ; không tự ăn/gửi khi chưa có thao tác người chơi.
  Lease90 giây, kick/leave/reconnect dùng cùng quyền và receipt của phòng hiện tại.
- Bỏ cuộc xử lý theo batch: còn1 người thì kết thúc thắng do bỏ cuộc, không còn
  người nào thì hủy không quyết toán. Người bỏ cuộc chỉ chịu mức bỏ cuộc thay
  thứ hạng/ù/đền, cộng khoản ăn/chốt đã phát sinh; không bắt người đã rời đền ù
  phát sinh sau đó. Những người còn lại tiếp tục đến4 lượt nếu còn ít nhất2.

## Cấu hình điểm

Chủ phòng nhập số nguyên0..1.000.000.000 cho từng trường khi tạo phòng:
`second=1`, `third=2`, `last=3`, `eat=1`, `chot=4`, `mom=4`, `u=5`,
`uTron=10`, `den=5`, `forfeit=4`. Đây chỉ là giá trị điền sẵn, mọi ô đều sửa được.
Mức0 tắt khoản tương ứng. Với2/3 người, hạng2/3 dùng mức nhì/ba; mức bét chỉ hạng4.
Móm thay mức theo thứ hạng; bỏ cuộc thay mức móm. Đền là mức mỗi đối thủ, một
người trả tổng `(số người - 1) × den`. Điểm ăn cộng riêng, không sửa số dư trước
khi kết thúc ván. Ván hủy không quyết toán khoản nào. Cấu hình giữ nguyên trong từng ván và công khai cho thành viên qua bảng mức.
Chủ phòng sửa luật ván tới ngay trong phòng; khi chia match mới mới áp dụng.

## UI

- Danh mục thêm Phỏm khả dụng. Tạo mới có form nhóm “Thứ hạng”, “Ăn bài”, “Ù và
  đền”; ô số có nhãn, bàn phím số và lỗi tại form. Tham gia dùng mã phòng hiện có.
- Header đổi theo trò. Nút luật mở nội dung Phỏm và bảng mức đã lưu. Loading,
  reconnect, owner/kick, mã phòng và xác nhận rời tái sử dụng luồng đang có.
- Bàn gồm4 ghế, nọc úp+số còn lại và lá ăn được ở giữa; mỗi ghế có dãy bài đã
  đánh/phỏm đã hạ, không lộ tay đối thủ. Người đang hành động có nhãn và đồng hồ
  nổi bật. Bài của bạn và action luôn cạnh dưới trong cả hai hướng.
- Chọn1 lá để đánh/gửi; chọn nhiều lá để hạ phỏm. Gợi ý tự xếp tối ưu và hạ tự
  động vẫn có sẵn để không bắt người chơi thao tác nhiều. Các đích gửi có nhãn
  chủ phỏm, không gửi ngay khi chưa chọn đích. Không xóa bài sớm trước commit.
- Khi server xác nhận ăn được và người chơi còn quyền thao tác ở bước ăn/bốc,
  lá vừa đánh có nhãn “Ăn được”; hai lá trên tay có thể ghép cùng lá đó được
  nâng và viền xanh. Gợi ý giữ được các phỏm chứa bài đã ăn trước đó, không tự
  chọn bài hoặc gửi hành động. Hết quyền/lượt hoặc chuyển bước thì bỏ gợi ý.
- “Gom phỏm” gom các lá đang chọn để xem trước; “Hạ tự động” để server tự hạ,
  còn “Hạ phỏm” xác nhận hạ các bộ đã gom. Bài nhỏ luôn hiện số và chất một hàng.
- Kết quả có hạng, rác/móm/ù/đền, từng khoản và tổng delta; Sẵn sàng ván tiếp
  dùng cơ chế auto-start hiện có. Tự ghi một dòng vào bảng điểm chung theo matchId.
- Bấm từng dòng kết quả để xem riêng bài đã đánh, bài đã ăn, từng phỏm đã hạ
  và bài còn trên tay của người đó khi kết thúc ván. Bài đã đánh gồm cả lá đã
  bị người khác ăn; các nhóm bài hiển thị riêng, không ngụ ý thứ tự đánh.
  Popup đóng khi đổi phòng/ván, rời màn hoặc bắt đầu ván mới.
- Khi đang chơi, ghế dùng Game Participants, kể cả người đã bỏ cuộc; số lá còn
  lấy từ `player.count`, không lộ tay đối thủ. Sau ván, ghế chờ/popup/quản lý dùng
  Room Members hiện tại và không hiện số lá giả cho người chưa tham gia ván cũ.
  Kết quả và bài công khai lịch sử vẫn dùng participants của ván đó.

## Kiến trúc, hợp đồng và quy ước

Chi tiết bài cuối ván dùng capability8: chỉ snapshot Phỏm `finished` gửi thêm
`players[].resultCards={discards,remaining}`. Không gửi trong ván đang chơi hoặc
ván hủy, không gửi nọc/tay đối thủ dưới trường `hand`. Capability1–7 giữ nguyên
hợp đồng cũ. Client mới có thể hạ phiên bản khi server cũ chưa hỗ trợ; thiếu dữ
liệu phải hiển thị rõ, không suy ra bài từ điểm. Không lưu `resultCards` vào cache
snapshot trên thiết bị. Hai RPC tiếp quản/sửa luật vẫn nhận capability SQL tối đa7,
vì capability8 chỉ mở rộng phần xem kết quả, không đổi luật hoặc quyền thao tác.

Expo55/RN0.83/TS5.9, Zustand5; không thêm dependency. Server engine thuần
`supabase/functions/game-access/phom*.mjs`; Node tests cùng thư mục tests. Client
types/protocol dưới `src/types` và `src/services/cardGames`; UI dưới CardGames.

Room thêm `gameKind: 'phom'` và `phomConfig`; room cũ thiếu kind luôn là south.
PhomView có `rulesVersion:'phom-v1'`, own hand, public meld/discard/eaten, step,
stockCount, turn/deadline/result. Không trả stock/order hoặc tay người khác.
Action mới dùng `play` kèm `phomAction: draw|eat|discard|lay|send|u`, `cards`,
`melds` hoặc `targetUid/meldIndex` khi cần, giữ actionId/version/matchId/roomId.
South play cũ không đổi. Create Phỏm dùng RPC riêng bọc create hiện có, cấu hình
được SQL kiểm tra và giữ bất biến trong cùng match; commit/worker giữ cùng quyền/CAS.
Client mới gửi clientVersion3; server chặn client cũ trước join/rejoin/takeover
Phỏm và khi đọc snapshot, nhưng giữ envelope south v2. Create wrapper sửa đúng
title hệ thống ban đầu trong cùng transaction; không ghi đè title đã được sửa.

```js
export function playPhom(input, uid, action, now) {
  const state = structuredClone(input);
  if (state.turn !== uid) throw Error('not-turn');
  // Validate semantics against authoritative state before applying an action.
  return state;
}
```

## Kiểm chứng và ranh giới

Luôn giữ source cũ, kiến trúc/ACL, xác thực session và dữ liệu thật. Không sửa
vendor/generated/lockfile, không deploy hoặc thử tài khoản thật trong lượt này.
Schema/contract thay đổi additive theo yêu cầu tính năng, reviewer plan+diff.

Commands: `node --test supabase/functions/tests/phom-*.test.mjs`;
`npm run test:functions`; `npm test -- --watchman=false --runTestsByPath
<path>`; `npm run typecheck`; `npm run lint`; `CI=1 EXPO_OFFLINE=1 npx expo
export --platform android --platform ios --output-dir /private/tmp/lifemate-phom-export`.
Test engine tổ hợp/ăn/hạ/gửi/ù/timeout/forfeit, điểm zero-sum và từng cấu hình;
HTTP/SQL create+CAS+quyền+worker+score idempotency; protocol không lộ bài; UI action,
form số0/invalid và dọc/ngang. Runtime thiết bị/PG đa kết nối chỉ báo đạt nếu đã chạy.

## Nguồn đối chiếu luật

Phỏm có biến thể; các quy ước trên là hợp đồng LifeMate, không mặc định mọi nguồn
đồng nhất. Đối chiếu nhà cung cấp game:
[Sảnh Rồng](https://sanhrong.info/game-phom/luat-choi),
[Vinagames](https://vinagames.com/phom.php),
[BS.FYI](https://bs.fyi/phom/rules). Các mức điểm do chủ phòng chọn, không lấy
cố định từ các nguồn. Dùng4 lượt cố định theo biến thể BS.FYI; đền chốt theo mô tả
Sảnh Rồng, công khai trong luật LifeMate.

## Sửa mức điểm trong phòng

Menu mã phòng → Sửa luật ván tới cho chủ phòng đang điều khiển. Form dùng
chung10 mức với tạo phòng, cho mức0 và khôi phục mặc định. `nextPhomConfig`
độc lập với `phomConfig`/`game.config` đang chơi; tất cả khoản ăn/chốt/ù/đền/
bỏ cuộc đang phát sinh và điểm đã ghi giữ nguyên. Start/rematch lấy pending
config, giữ lại làm cấu hình cho các ván sau. Lưu ở sảnh/kết quả xóa cờ ready;
lệnh sẵn sàng dựa trên version cũ không rebase qua lần lưu luật.

Protocol6 hiển thị luật hiện tại và ván tới cho cả phòng. Client3/4/5 đã ngồi
được chơi hết ván/giữ lease/rời phòng; phải cập nhật trước sẵn sàng, tham gia
lại hoặc quản lý phòng đã đổi luật. SQL takeover kiểm tra capability dưới
room lock; signature cũ giữ lại và từ chối phòng vượt capability.

## Tùy chọn luật trước tạo phòng

`phomConfig.options={tai:boolean,send:boolean,uDen:boolean}` là trường tùy chọn
additive. Thiếu hoàn toàn options giữ đúng hợp đồng phòng cũ: Tái tắt, Gửi bật,
Ù đền bật; không tự thêm options vào config đã lưu hoặc game.config của ván cũ.
Nếu có thì phải đủ ba boolean, từ chối trường lạ/số/chuỗi/null.

Form tạo và sửa luật dùng chung ba switch kèm mô tả; lưu cả lựa chọn bật và tắt,
khôi phục mặc định cho cả lựa chọn và 10 mức. Tắt gửi chặn action tại server.
Tắt ù đền loại bỏ cả đền cấp3 cây và đền do ăn chốt: từng đối thủ còn chơi trả
mức ù/ù tròn, bỏ cuộc vẫn chịu mức bỏ cuộc; khoản ăn/chốt trước đó giữ nguyên.

Protocol7 yêu cầu cho phòng đang dùng options; pending options yêu cầu7 để
ready/tham gia lại/quản lý. Client6 đang chơi config cũ vẫn sync/lease/play/leave
được; snapshot không trả pending options cho client6. Client7 không hạ protocol
khi biết current/pending options, kể cả sync/lease/bootstrap sau kết nối lại.
Các lựa chọn sửa trong phòng chỉ áp dụng khi chia match mới.

SQL lưu luật nhận capability bắt buộc và kiểm tra current/pending/incoming
options khi đang khóa phòng. Client6 không được ghi đè options bằng config
10 mức cũ; từ chối trước thay đổi state, version, ready, lease hay receipt.
RPC cũ chỉ suy ra capability7 khi payload có options đã qua validator Edge;
payload 10 mức vẫn là6. Retry receipt đã commit được trả lại mà không ghi mới.

Popup Luật ván tới giữ tiêu đề và nút Lưu ngoài vùng cuộn; nội dung phải
vuốt tới đủ10 mức, gồm Ù/Ù tròn/Đền, khi vượt chiều cao màn hình.
