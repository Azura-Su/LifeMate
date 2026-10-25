import { ScrollView, Text, View } from 'react-native';
import { DialogModal } from '../../components/DialogModal';
import { ModalHeader } from '../../components/ModalHeader';
import type { PhomView } from '../../types/phom';
import { PhomMiniCards } from './PhomTableParts';
import { phomStyles as s } from './PhomTable.styles';

function CardSection({
  title,
  cards,
  empty,
  hint,
  testID,
  remaining = false,
}: {
  title: string;
  cards?: number[];
  empty: string;
  hint?: string;
  testID: string;
  remaining?: boolean;
}) {
  return (
    <View
      testID={testID}
      style={[s.resultCardsSection, remaining && s.resultCardsRemaining]}
    >
      <View style={s.resultCardsHeading}>
        <Text accessibilityRole="header" style={s.resultCardsTitle}>
          {title}
        </Text>
        {cards && <Text style={s.caption}>{cards.length} lá</Text>}
      </View>
      {hint && <Text style={s.caption}>{hint}</Text>}
      {cards?.length ? (
        <ScrollView horizontal>
          <PhomMiniCards cards={cards} />
        </ScrollView>
      ) : (
        <Text style={s.caption}>{empty}</Text>
      )}
    </View>
  );
}

export function PhomPlayerResultDialog({
  game,
  uid,
  onClose,
}: {
  game: PhomView;
  uid: string;
  onClose: () => void;
}) {
  const player = game.players.find((p) => p.uid === uid);
  const result = game.result?.ranking.find((p) => p.uid === uid);
  if (game.status !== 'finished' || !player || !result) return null;
  const name = result.name ?? player.name ?? 'Người chơi';

  return (
    <DialogModal
      onRequestClose={onClose}
      onBackdropPress={onClose}
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      style={s.resultDialog}
    >
      <ModalHeader
        eyebrow="Kết quả ván"
        title={name}
        accessibilityLabel="Đóng chi tiết bài"
        onClose={onClose}
      />
      <ScrollView
        testID="phom-result-cards-scroll"
        style={s.resultCardsScroll}
        contentContainerStyle={s.resultCardsContent}
      >
        <CardSection
          title={
            player.resultCards ? 'Bài đã đánh' : 'Bài đã đánh còn trên bàn'
          }
          cards={player.resultCards?.discards ?? player.discards}
          empty={
            player.resultCards
              ? 'Chưa đánh lá nào.'
              : 'Không có lá đã đánh còn trên bàn.'
          }
          hint={
            player.resultCards
              ? undefined
              : 'Chưa có đầy đủ lịch sử đánh bài của ván này.'
          }
          testID="phom-result-discards"
        />
        <CardSection
          title="Bài đã ăn"
          cards={player.eaten}
          empty="Không ăn lá nào."
          testID="phom-result-eaten"
        />
        <View testID="phom-result-melds" style={s.resultCardsSection}>
          <View style={s.resultCardsHeading}>
            <Text accessibilityRole="header" style={s.resultCardsTitle}>
              Phỏm đã hạ
            </Text>
            <Text style={s.caption}>{player.melds.length} phỏm</Text>
          </View>
          {player.melds.length ? (
            player.melds.map((meld, index) => (
              <View key={index} style={s.handBody}>
                <Text style={s.caption}>Phỏm {index + 1}</Text>
                <ScrollView horizontal>
                  <PhomMiniCards cards={meld} />
                </ScrollView>
              </View>
            ))
          ) : (
            <Text style={s.caption}>Không có phỏm đã hạ.</Text>
          )}
        </View>
        <CardSection
          title="Bài còn lại"
          cards={player.resultCards?.remaining}
          empty={
            player.resultCards
              ? 'Không còn bài trên tay.'
              : 'Chưa có dữ liệu bài còn lại của ván này.'
          }
          testID="phom-result-remaining"
          remaining
        />
      </ScrollView>
    </DialogModal>
  );
}
