import { Pressable, ScrollView, Text, View } from 'react-native';
import type { CardGameRoom, GameMember } from '../../types/cardGame';
import type { PhomView } from '../../types/phom';
import { CardGameAvatarImage } from './CardGameAvatarImage';
import { cardLabel } from './PlayingCard';
import { phomStyles as s } from './PhomTable.styles';

export const phomLabels: Record<string, string> = {
  eat: 'Ăn thường',
  chot: 'Ăn chốt',
  mom: 'Móm',
  u: 'Ù',
  'u-tron': 'Ù tròn',
  den: 'Đền',
  'rank-2': 'Nhì',
  'rank-3': 'Ba',
  'rank-4': 'Bét',
  forfeit: 'Bỏ cuộc',
};
export const phomMoney = (amount: number) =>
  `${amount > 0 ? '+' : ''}${amount.toLocaleString('vi-VN')} đ`;
export function PhomMiniCards({ cards }: { cards: number[] }) {
  return (
    <View style={s.row}>
      {cards.map((card) => (
        <View
          key={card}
          accessible
          accessibilityLabel={cardLabel(card)}
          style={s.cardChip}
        >
          <Text style={[s.cardText, card % 4 >= 2 && s.red]}>
            {cardLabel(card).split(' ')[0]}
            {['♠', '♣', '♦', '♥'][card % 4]}
          </Text>
        </View>
      ))}
    </View>
  );
}
export function PhomSeat({
  room,
  seat,
  seconds,
  landscape,
  onPlayerPress,
}: {
  room: CardGameRoom;
  seat: { participant: PhomView['players'][number] } | { member: GameMember };
  seconds: number;
  landscape: boolean;
  onPlayerPress?: (uid: string) => void;
}) {
  const player = 'participant' in seat ? seat.participant : null;
  const member =
    'member' in seat
      ? seat.member
      : room.members.find((m) => m.uid === seat.participant.uid);
  const uid = 'participant' in seat ? seat.participant.uid : seat.member.uid;
  const name = player?.name ?? member?.name ?? 'Người chơi';
  const turn =
    !!player && room.game?.status === 'playing' && room.game.turn === uid;
  const count =
    player &&
    Number.isInteger(player.count) &&
    player.count >= 0 &&
    player.count <= 10
      ? player.count
      : null;
  return (
    <View
      testID={`phom-seat-${uid}`}
      style={[s.seat, landscape && s.compactSeat, turn && s.turnSeat]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Thông tin người chơi ${name}`}
        onPress={() => onPlayerPress?.(uid)}
        disabled={!onPlayerPress || !member}
        style={[s.playerHeading, landscape && s.compactPlayerHeading]}
        hitSlop={landscape ? 6 : undefined}
      >
        <View style={s.avatar}>
          <Text style={s.name}>{name.slice(0, 1).toUpperCase()}</Text>
          <CardGameAvatarImage
            uid={uid}
            url={member?.avatarUrl}
            name={name}
            size={32}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={s.name}>
            {name}
          </Text>
          <Text style={s.caption}>
            {phomMoney(player?.balance ?? member?.balance ?? 0)}
          </Text>
        </View>
      </Pressable>
      <View style={landscape ? [s.row, s.wrap] : undefined}>
        {count !== null && <Text style={s.caption}>Còn {count} lá</Text>}
        {turn ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[
              s.timer,
              landscape && s.compactTimer,
              seconds <= 5 && s.timerUrgent,
            ]}
          >
            {seconds}s <Text style={s.caption}>Đang đánh</Text>
          </Text>
        ) : (
          <Text style={s.caption}>
            {!player
              ? member?.ready
                ? 'Sẵn sàng'
                : 'Đang chờ'
              : player.forfeited
                ? 'Bỏ cuộc'
                : player.laid
                  ? player.melds.length
                    ? 'Đã hạ'
                    : 'Móm'
                  : `Lượt ${Math.min(player.turns + 1, 4)}/4`}
          </Text>
        )}
      </View>
      {player && !landscape && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
        >
          {player.discards.length > 0 ? (
            <PhomMiniCards cards={player.discards} />
          ) : (
            <Text style={s.caption}>Chưa đánh</Text>
          )}
          {player.melds.map((group, i) => (
            <View key={i} style={s.meld}>
              <PhomMiniCards cards={group} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
export function PhomResults({ game }: { game: PhomView }) {
  if (game.status === 'cancelled')
    return <Text style={s.body}>Ván đã hủy, không ghi điểm.</Text>;
  return (
    <View style={s.result}>
      <Text accessibilityRole="header" style={s.name}>
        Kết quả ván Phỏm
      </Text>
      {game.result?.ranking.map((entry) => (
        <View key={entry.uid} style={s.result}>
          <View style={s.resultRow}>
            <Text style={s.name}>
              #{entry.rank}{' '}
              {entry.name ??
                game.players.find((p) => p.uid === entry.uid)?.name ??
                'Người chơi'}
            </Text>
            <Text style={s.name}>{phomMoney(entry.moneyDelta ?? 0)}</Text>
          </View>
          <Text style={s.caption}>
            {entry.labels.map((l) => phomLabels[l] ?? l).join(' · ')}
            {entry.deadwoodPoints !== undefined
              ? ` · Rác ${entry.deadwoodPoints} điểm`
              : ''}
          </Text>
          {entry.breakdown?.map((part, i) => (
            <Text key={i} style={s.caption}>
              {phomLabels[part.kind] ?? part.kind}: {phomMoney(part.amount)} ·{' '}
              {game.players.find((p) => p.uid === part.otherUid)?.name ??
                'Người chơi'}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
