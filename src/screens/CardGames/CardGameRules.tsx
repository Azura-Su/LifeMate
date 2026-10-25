import { ScrollView, Text } from 'react-native';
import { DialogModal } from '../../components/DialogModal';
import { ModalHeader } from '../../components/ModalHeader';
import { styles } from './CardGamesScreen.styles';
import type { PhomConfig } from '../../types/phom';
import {
  PHOM_THREE_FEED_RULE,
  PHOM_RATES,
  phomOptions,
  visiblePhomOptions,
} from '../../services/cardGames/phomConfig';
import type { SouthConfig, SouthRules } from '../../types/tienLen';
import type { VariantGameConfig } from '../../types/cardGame';
import {
  DEFAULT_SOUTH_CONFIG,
  SOUTH_FINISH_MODES,
} from '../../services/cardGames/tienLenConfig';

const phomRules = [
  [
    'Bộ bài và phỏm',
    '2–4 người, bộ 52 lá. Mỗi người 9 lá; người mở 10 lá, thắng ván trước mở ván sau. Phỏm là bộ 3–4 lá cùng số hoặc từ 3 lá cùng chất liên tiếp. A thấp: A–2–3 hợp lệ, Q–K–A không hợp lệ.',
  ],
  [
    'Ăn, bốc và đánh',
    'Đến lượt: ăn lá mới đánh hoặc bốc nọc rồi đánh 1 lá. Lá ăn phải nằm trong phỏm riêng, mỗi phỏm tối đa 1 lá ăn. Không đánh lá ăn hoặc phá phỏm giữ lá ăn.',
  ],
  [
    'Hạ và gửi',
    'Bình thường mỗi người đánh 4 lượt. Bật Tái: ăn ở vòng hạ dịch lượt, người đã hạ có thể đánh thêm. Trước lá thứ 4 phải hạ phỏm. Có thể hạ tự động hoặc xếp từng nhóm. Nếu bật Gửi bài, sau hạ có thể gửi rác rồi đánh lá cuối; móm không được gửi. Khi tái được gửi vào phỏm người đã hạ.',
  ],
  [
    'Ù và ù tròn',
    'Ù khi 9 lá thành phỏm, hoặc sau hạ/gửi còn tối đa 1 lá rác và có phỏm riêng. Ù tròn khi cả 10 lá trước hạ/gửi đều thành phỏm. Server kiểm tra trước khi công nhận.',
  ],
  [
    'Tính hạng',
    'Điểm bài lẻ (lá không nằm trong phỏm): A=1, J=11, Q=12, K=13; các lá khác theo số. Người có phỏm xếp trước móm; ít điểm hơn thắng, hòa xét thứ tự hạ. Tất cả móm thì người hạ trước thắng.',
  ],
  [
    'Ăn chốt và đền',
    'Lá thứ 4 là chốt. Cấp đủ 3 lá cho người ù luôn phải đền, không phụ thuộc các tùy chọn. Khi bật Tái và Ù đền do tái: A ăn chốt của B khiến B được tái; nếu B ù trong chính lượt thêm đó thì A phải đền. Ưu tiên đền cấp 3 cây. Người đã bỏ cuộc không chịu đền cho lần ù phát sinh sau đó. Đền tính theo mức mỗi đối thủ, không cộng thêm mức ù. Không có người đền thì mỗi người thua trả mức ù/ù tròn riêng. Khoản ăn/chốt đã phát sinh vẫn giữ.',
  ],
  [
    'Thời gian và bỏ cuộc',
    '40 giây/lượt; hết giờ tự bốc, hạ tối ưu và đánh rác lớn nhất hợp lệ. Bỏ cuộc chịu mức riêng thay hạng/ù/đền, cộng khoản ăn đã có. Còn một người thì kết thúc, tất cả mất kết nối thì hủy không tính điểm.',
  ],
];

const variantRules = {
  north: [
    [
      'Chia bài và mở ván',
      '2–4 người, mỗi người 13 lá. Ván đầu người có 3♠ đi trước; nếu không có trong bàn ít người, lá thấp nhất đã chia mở ván. Ván sau người về nhất mở.',
    ],
    [
      'Bộ hợp lệ và chặn',
      'Lẻ, đôi cùng màu, sám, tứ quý và sảnh từ 3 lá liên tiếp cùng chất. Sảnh không có 2. Bài lẻ thường phải cùng chất và cao hơn; riêng 2 cao hơn mọi lá thường, hai lá 2 so chất. Tứ quý chặt một lá 2 hoặc tứ quý thấp hơn; không chặt đôi 2.',
    ],
    [
      'Bỏ lượt và kết quả',
      'Bỏ lượt thì chờ vòng mới. Khi mọi người khác bỏ hoặc đã hết bài, người đánh cuối còn bài mở vòng mới. Ván kéo đến khi còn một người. Trong Bắc v2, mỗi lá 2 còn lại cộng thêm điểm 2 và tứ quý chặt một lá 2 chuyển khoản chặt giữa hai người; chặt tứ quý không tạo thêm phí.',
    ],
  ],
  sam: [
    [
      'Chia bài và báo Sâm',
      '2–4 người, mỗi người 10 lá. Trước nước đầu tiên, lần lượt chọn báo Sâm hoặc bỏ qua; người báo đầu tiên đánh trước. Nếu không ai báo, người mở ván đi trước.',
    ],
    [
      'Bộ bài và chặn',
      'Lẻ, đôi, sám, tứ quý và sảnh từ 3 lá liên tiếp; không so chất và không có 2 trong sảnh. Chặn cùng loại, cùng số lá bằng bộ có hạng cao hơn. Trong Sâm v2, tứ quý chặt một lá 2; không chặt đôi 2. Khi người báo Sâm bị chặn, báo thất bại nhưng ván vẫn tiếp tục.',
    ],
    [
      'Báo một và tính điểm',
      'Còn một lá sẽ hiện báo một, không phát sinh phạt riêng. Báo Sâm thành công nếu người báo hết bài trước khi bị chặn. Sâm v2: báo thành công nhận mức điểm báo từ từng đối thủ, không cộng điểm bài còn; báo thất bại trả mức đó cho từng đối thủ và vẫn tính điểm bài còn. Nếu báo bị hủy trước khi có kết quả thì không thu điểm báo.',
    ],
  ],
  tan: [
    [
      'Chia bài và chất chủ',
      '2–4 người, mỗi người 8 lá. Lật một lá để chọn chất chủ; lá ngửa được rút cuối nọc. Hạng 2 thấp nhất, A cao nhất.',
    ],
    [
      'Tấn và đỡ',
      'Người tấn đánh một lá; người chơi khác ngoài người đỡ có thể tấn thêm lá trùng hạng đã xuất hiện. Người đỡ chặn bằng lá cùng chất cao hơn hoặc chất chủ; lá chủ chỉ bị lá chủ cao hơn chặn. Có thể nhận toàn bộ bài trên bàn.',
    ],
    [
      'Rút bài và kết quả',
      'Sau lượt, mọi người rút lên tối đa 8 lá theo thứ tự tấn trước, người đỡ sau; lá chủ ngửa rút cuối. Khi hết nọc, chơi đến khi chỉ còn một người giữ bài. C là số lá người cuối còn trên tay; R là tổng số người kết thúc tự nhiên, tính cả người cuối và không tính người bỏ cuộc. Người cuối mất C × (R−1) × điểm/lá; mỗi người về trước nhận C × điểm/lá. Ví dụ 4 người, người cuối còn 5 lá, mức 1 điểm/lá: R=4 (gồm người thua và 3 người về trước), người cuối mất 5×(4−1)×1=15 điểm; mỗi người về trước nhận 5 điểm. Bài đã nhặt chỉ tính nếu vẫn còn trên tay lúc kết thúc, không cộng lần hai. Nếu tất cả hết bài thì 0 điểm.',
    ],
  ],
};

const rules = [
  [
    'Bộ bài và lượt',
    '2–4 người, mỗi người 13 lá. Thứ tự 3 → A → 2; bích < chuồn < rô < cơ. Ván đầu ai giữ lá nhỏ nhất đã chia mở trước, bộ mở phải chứa lá đó. Ván tiếp người thắng trước mở.',
  ],
  [
    'Đánh và bỏ lượt',
    'Đánh lẻ, đôi, sám, tứ quý, sảnh từ 3 lá hoặc 3/4 đôi thông. Sảnh và đôi thông không có 2. Bộ cùng loại và độ dài so lá cao nhất. Bỏ lượt thì phải đợi vòng mới; người giữ bộ lớn nhất mở vòng tiếp. Nếu đã hết bài, người còn chơi kế tiếp mở.',
  ],
  [
    'Chặt',
    '3 đôi thông chặt một 2 hoặc 3 đôi thông nhỏ hơn. Tứ quý chặt một/đôi 2, 3 đôi thông hoặc tứ quý nhỏ hơn. 4 đôi thông chặt một/đôi/ba 2, 3 đôi thông, tứ quý hoặc 4 đôi thông nhỏ hơn; được chặt ngoài lượt, kể cả đã bỏ. Sau chặt bằng 4 đôi thông, mọi người được tham gia lại vòng.',
  ],
  [
    'Tới trắng',
    'Ưu tiên: sảnh rồng đủ 13 số → tứ quý 2 → sáu đôi khác số. Cùng điều kiện thì xét ghế từ người mở. Người thắng hạng nhất, các người khác đồng hạng nhì.',
  ],
  [
    'Kết quả',
    'Được về bằng 2. Chế độ kết thúc và tiền mỗi lá do chủ phòng chọn. Có thể sửa trong phòng để áp dụng từ ván sau. Người nhất nhận tiền bài còn của người thua; khoản chặt 2 chuyển giữa người bị chặt và người chặt. Cóng/thối chỉ gắn nhãn, không cộng phạt riêng.',
  ],
  [
    'Thời gian và kết nối',
    '40 giây/lượt. Hết giờ tự bỏ; nếu mở vòng thì đánh lá nhỏ nhất hợp lệ. Mất kết nối/vào nền giữ ghế 90 giây nhưng thời gian lượt vẫn chạy. Quá hạn hoặc tự rời thì bỏ cuộc, xếp cuối. Tất cả mất kết nối cùng lúc thì hủy ván.',
  ],
  [
    'Quy ước của bàn',
    'Luật cố định trong ván, không dùng tiền cược. Xóa tài khoản sẽ đóng phòng có bài của tài khoản đó.',
  ],
];
export function CardGameRules({
  visible,
  onClose,
  gameKind = 'south',
  phomConfig,
  southConfig = DEFAULT_SOUTH_CONFIG,
  amountPerCard = 0,
  nextSouthRules,
  nextPhomConfig,
  variantConfig,
  nextVariantConfig,
}: {
  visible: boolean;
  onClose: () => void;
  gameKind?: 'south' | 'phom' | 'north' | 'sam' | 'tan';
  phomConfig?: PhomConfig;
  southConfig?: SouthConfig;
  amountPerCard?: number;
  nextSouthRules?: SouthRules;
  nextPhomConfig?: PhomConfig;
  variantConfig?: VariantGameConfig;
  nextVariantConfig?: VariantGameConfig;
}) {
  const currentNorthConfig =
    gameKind === 'north' &&
    !!variantConfig &&
    'rulesVersion' in variantConfig &&
    variantConfig.rulesVersion === 'north-v2'
      ? variantConfig
      : undefined;
  const currentSamConfig =
    gameKind === 'sam' &&
    !!variantConfig &&
    'rulesVersion' in variantConfig &&
    variantConfig.rulesVersion === 'sam-v2'
      ? variantConfig
      : undefined;
  const nextNorthConfig =
    gameKind === 'north' &&
    !!nextVariantConfig &&
    'rulesVersion' in nextVariantConfig &&
    nextVariantConfig.rulesVersion === 'north-v2'
      ? nextVariantConfig
      : undefined;
  const nextSamConfig =
    gameKind === 'sam' &&
    !!nextVariantConfig &&
    'rulesVersion' in nextVariantConfig &&
    nextVariantConfig.rulesVersion === 'sam-v2'
      ? nextVariantConfig
      : undefined;
  return (
    <DialogModal
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      visible={visible}
      onRequestClose={onClose}
      style={styles.ruleCard}
    >
      <ModalHeader
        title={{
          south: 'Luật miền Nam',
          phom: 'Luật Phỏm',
          north: 'Luật miền Bắc',
          sam: 'Luật Sâm',
          tan: 'Luật Tấn',
        }[gameKind]}
        accessibilityLabel="Đóng luật chơi"
        onClose={onClose}
      />
      <ScrollView
        style={styles.ruleScroll}
        contentContainerStyle={styles.ruleContent}
      >
        {(gameKind === 'north' || gameKind === 'sam' || gameKind === 'tan') && (
          <>
            <Text style={styles.heading}>Cấu hình điểm</Text>
            <Text style={styles.body}>
            Ván hiện tại: {(variantConfig?.pointsPerCard ?? 1).toLocaleString('vi-VN')} điểm/lá.
            </Text>
            {nextVariantConfig && (
              <Text style={styles.body}>
                Ván tới: {nextVariantConfig.pointsPerCard.toLocaleString('vi-VN')} điểm/lá.
              </Text>
            )}
            {currentNorthConfig && (
              <Text style={styles.body}>
                Bắc v2 hiện tại: mỗi lá 2 còn lại cộng thêm{' '}
                {currentNorthConfig.remainingTwoPoints} điểm; tứ quý chặt một lá
                2 chuyển {currentNorthConfig.cutTwoPoints} điểm. Chỉ tính lá 2
                đơn, không tính phí khi chặt tứ quý.
              </Text>
            )}
            {nextNorthConfig && (
              <Text style={styles.body}>
                Bắc v2 từ ván tới: mỗi lá 2 còn lại cộng thêm{' '}
                {nextNorthConfig.remainingTwoPoints} điểm; tứ quý chặt một lá 2
                chuyển {nextNorthConfig.cutTwoPoints} điểm.
              </Text>
            )}
            {currentSamConfig && (
              <Text style={styles.body}>
                Sâm v2 hiện tại: báo thành công nhận{' '}
                {currentSamConfig.samCallPoints} điểm từ từng đối thủ và không
                cộng điểm bài còn; báo thất bại trả mức đó cho từng đối thủ,
                cộng điểm bài còn.
              </Text>
            )}
            {nextSamConfig && (
              <Text style={styles.body}>
                Sâm v2 từ ván tới: báo thành công nhận{' '}
                {nextSamConfig.samCallPoints} điểm từ từng đối thủ và không cộng
                điểm bài còn; báo thất bại trả mức đó cho từng đối thủ, cộng
                điểm bài còn.
              </Text>
            )}
            {gameKind === 'tan' && (
              <Text style={styles.body}>
                Tấn: C là số lá người cuối còn; R là tổng người kết thúc tự
                nhiên, gồm cả người cuối và không gồm người bỏ cuộc. Người cuối
                mất C × (R−1) ×{' '}
                {(variantConfig?.pointsPerCard ?? 1).toLocaleString('vi-VN')}{' '}
                điểm; mỗi người về trước nhận C ×{' '}
                {(variantConfig?.pointsPerCard ?? 1).toLocaleString('vi-VN')}{' '}
                điểm. Ví dụ 4 người, còn 5 lá, mức 1 điểm/lá: mất 15 điểm, mỗi
                người về trước +5. Bài nhặt chỉ tính nếu còn trên tay lúc kết
                thúc.
              </Text>
            )}
            {(gameKind === 'north' || gameKind === 'sam') &&
              !currentNorthConfig &&
              !nextNorthConfig &&
              !currentSamConfig &&
              !nextSamConfig && (
                <Text style={styles.body}>
                  Phòng cũ đang giữ profile v1 cho đến khi chủ phòng lưu luật
                  v2. Điểm nội bộ, không phải tiền cược.
                </Text>
              )}
          </>
        )}
        {(gameKind === 'phom'
          ? phomRules
          : gameKind === 'south'
            ? rules
            : variantRules[gameKind]
        ).map(([title, text]) => (
          <Text key={title} style={styles.body}>
            <Text style={styles.name}>
              {title}
              {'\n'}
            </Text>
            {text}
          </Text>
        ))}
        {gameKind === 'south' && (
          <>
            <Text style={styles.heading}>
              {nextSouthRules ? 'Luật ván hiện tại' : 'Thiết lập của phòng'}
            </Text>
            <Text style={styles.body}>
              {
                SOUTH_FINISH_MODES.find(
                  (m) => m.value === southConfig.finishMode,
                )?.label
              }
            </Text>
            <Text style={styles.body}>
              Bài còn:{' '}
              {Number.isSafeInteger(amountPerCard)
                ? amountPerCard.toLocaleString('vi-VN')
                : '—'}{' '}
              đ/lá.
            </Text>
            <Text style={styles.body}>
              Chặt 2: {southConfig.cutTwoAmount.toLocaleString('vi-VN')} đ/lá 2.
              Chặt đôi 2 tính hai lá; ba 2 tính ba lá. Đè 2 bằng 2 lớn hơn và
              chặt bộ chặt khác không tính khoản này.
            </Text>
            <Text style={styles.body}>
              {southConfig.finishMode === 'first-winner'
                ? 'Người đầu tiên hết bài làm ván kết thúc ngay; người còn chơi đồng hạng nhì và trả theo số lá còn.'
                : 'Ván tiếp tục đến khi chỉ còn một người có bài, giữ thứ hạng theo thứ tự hết bài.'}{' '}
              Tiền chặt được cộng vào tổng kết cuối ván; ván hủy do tất cả mất
              kết nối không tính điểm. Chủ phòng có thể sửa luật cho ván sau;
              ván hiện tại giữ nguyên.
            </Text>
          </>
        )}
        {gameKind === 'south' && nextSouthRules && (
          <>
            <Text style={styles.heading}>Luật ván tới</Text>
            <Text style={styles.body}>
              {
                SOUTH_FINISH_MODES.find(
                  (m) => m.value === nextSouthRules.southConfig.finishMode,
                )?.label
              }
            </Text>
            <Text style={styles.body}>
              {nextSouthRules.amountPerCard.toLocaleString('vi-VN')} đ/lá còn ·
              Chặt 2:{' '}
              {nextSouthRules.southConfig.cutTwoAmount.toLocaleString('vi-VN')}{' '}
              đ/lá 2.
            </Text>
            <Text style={styles.body}>
              Áp dụng khi chia ván mới. Các ván đã tính điểm giữ nguyên.
            </Text>
          </>
        )}
        {gameKind === 'phom' && phomConfig && (
          <>
            <Text style={styles.heading}>
              {nextPhomConfig ? 'Luật ván hiện tại' : 'Mức điểm đã chốt'}
            </Text>
            <Text style={styles.body}>{PHOM_THREE_FEED_RULE}</Text>
            {visiblePhomOptions(phomOptions(phomConfig)).map(
              ({ key, label }) => (
                <Text style={styles.body} key={key}>
                  {label}: {phomOptions(phomConfig)[key] ? 'Bật' : 'Tắt'}
                </Text>
              ),
            )}
            {PHOM_RATES.map((rate) => (
              <Text style={styles.body} key={rate.key}>
                {rate.label}: {phomConfig[rate.key].toLocaleString('vi-VN')}
              </Text>
            ))}
            <Text style={styles.body}>
              Mức 0 tắt khoản tương ứng. Mức bét dùng cho hạng 4; đền là mức mỗi
              đối thủ. Chủ phòng có thể sửa mức điểm trong phòng để áp dụng từ
              ván sau.
            </Text>
          </>
        )}
        {gameKind === 'phom' && nextPhomConfig && (
          <>
            <Text style={styles.heading}>Luật ván tới</Text>
            <Text style={styles.body}>{PHOM_THREE_FEED_RULE}</Text>
            {visiblePhomOptions(phomOptions(nextPhomConfig)).map(
              ({ key, label }) => (
                <Text style={styles.body} key={key}>
                  {label}: {phomOptions(nextPhomConfig)[key] ? 'Bật' : 'Tắt'}
                </Text>
              ),
            )}
            {PHOM_RATES.map((rate) => (
              <Text style={styles.body} key={rate.key}>
                {rate.label}: {nextPhomConfig[rate.key].toLocaleString('vi-VN')}
              </Text>
            ))}
            <Text style={styles.body}>
              Áp dụng khi chia ván mới. Ván đang chơi và điểm đã ghi giữ nguyên.
            </Text>
          </>
        )}
      </ScrollView>
    </DialogModal>
  );
}
