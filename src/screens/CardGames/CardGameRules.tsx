import { ScrollView, Text } from 'react-native';
import { DialogModal } from '../../components/DialogModal';
import { ModalHeader } from '../../components/ModalHeader';
import { styles } from './CardGamesScreen.styles';
import type { PhomConfig } from '../../types/phom';
import {
  PHOM_OPTIONS,
  PHOM_RATES,
  phomOptions,
} from '../../services/cardGames/phomConfig';
import type { SouthConfig, SouthRules } from '../../types/tienLen';
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
    'Rác: A=1, J=11, Q=12, K=13; các lá khác theo số. Người có phỏm xếp trước móm; ít điểm rác thắng, hòa xét thứ tự hạ. Tất cả móm thì người hạ trước thắng.',
  ],
  [
    'Ăn chốt và đền',
    'Lá thứ 4 là chốt. Khi bật Ù đền: ăn 3 cây của một người rồi ù: người đó đền. Nếu ù sau ăn chốt, người ăn chốt gần nhất đền, trừ chính người ù; ưu tiên đền 3 cây. Đền tính theo mức mỗi đối thủ, không cộng thêm mức ù. Tắt Ù đền thì mỗi người thua trả mức ù/ù tròn riêng. Khoản ăn/chốt đã phát sinh vẫn giữ.',
  ],
  [
    'Thời gian và bỏ cuộc',
    '40 giây/lượt; hết giờ tự bốc, hạ tối ưu và đánh rác lớn nhất hợp lệ. Bỏ cuộc chịu mức riêng thay hạng/ù/đền, cộng khoản ăn đã có. Còn một người thì kết thúc, tất cả mất kết nối thì hủy không tính điểm.',
  ],
];

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
}: {
  visible: boolean;
  onClose: () => void;
  gameKind?: 'south' | 'phom';
  phomConfig?: PhomConfig;
  southConfig?: SouthConfig;
  amountPerCard?: number;
  nextSouthRules?: SouthRules;
  nextPhomConfig?: PhomConfig;
}) {
  return (
    <DialogModal
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      visible={visible}
      onRequestClose={onClose}
      style={styles.ruleCard}
    >
      <ModalHeader
        title={gameKind === 'phom' ? 'Luật Phỏm' : 'Luật miền Nam'}
        accessibilityLabel="Đóng luật chơi"
        onClose={onClose}
      />
      <ScrollView
        style={styles.ruleScroll}
        contentContainerStyle={styles.ruleContent}
      >
        {(gameKind === 'phom' ? phomRules : rules).map(([title, text]) => (
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
            {PHOM_OPTIONS.map(({ key, label }) => (
              <Text style={styles.body} key={key}>
                {label}: {phomOptions(phomConfig)[key] ? 'Bật' : 'Tắt'}
              </Text>
            ))}
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
            {PHOM_OPTIONS.map(({ key, label }) => (
              <Text style={styles.body} key={key}>
                {label}: {phomOptions(nextPhomConfig)[key] ? 'Bật' : 'Tắt'}
              </Text>
            ))}
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
