import { ScrollView, Text } from 'react-native';
import { DialogModal } from '../../components/DialogModal';
import { ModalHeader } from '../../components/ModalHeader';
import { styles } from './CardGamesScreen.styles';

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
    'Được về bằng 2. Chơi đến khi chỉ còn một người có bài. Cóng/thối chỉ gắn nhãn, không trừ điểm; chỉ ghi thứ hạng và số ván thắng.',
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
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <DialogModal
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      visible={visible}
      onRequestClose={onClose}
      style={styles.ruleCard}
    >
      <ModalHeader
        title="Luật miền Nam"
        accessibilityLabel="Đóng luật chơi"
        onClose={onClose}
      />
      <ScrollView
        style={styles.ruleScroll}
        contentContainerStyle={styles.ruleContent}
      >
        {rules.map(([title, text]) => (
          <Text key={title} style={styles.body}>
            <Text style={styles.name}>
              {title}
              {'\n'}
            </Text>
            {text}
          </Text>
        ))}
      </ScrollView>
    </DialogModal>
  );
}
