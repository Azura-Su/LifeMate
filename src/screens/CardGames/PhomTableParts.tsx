import { useState } from 'react';
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
export function PhomMiniCards({
  cards,
  overlap = false,
}: {
  cards: number[];
  overlap?: boolean;
}) {
  return (
    <View style={overlap ? s.overlapRow : s.row}>
      {cards.map((card, index) => (
        <View
          key={card}
          accessible
          accessibilityLabel={cardLabel(card)}
          style={[
            s.cardChip,
            overlap && s.fanChip,
            overlap && index > 0 && s.overlapChip,
          ]}
        >
          {overlap ? (
            <>
              <Text style={[s.fanRank, card % 4 >= 2 && s.red]}>
                {cardLabel(card).split(' ')[0]}
              </Text>
              <Text style={[s.fanSuit, card % 4 >= 2 && s.red]}>
                {['♠', '♣', '♦', '♥'][card % 4]}
              </Text>
            </>
          ) : (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[s.cardText, card % 4 >= 2 && s.red]}
            >
              {cardLabel(card).split(' ')[0]}
              {['♠', '♣', '♦', '♥'][card % 4]}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
// Once a player has laid melds, only the melds are shown; otherwise the
// discards are shown as an overlapped fan to save room.
export function PhomPublicCards({
  discards,
  melds,
}: {
  discards: number[];
  melds: number[][];
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.publicCards}
    >
      {melds.length > 0 ? (
        melds.map((group, i) => (
          <View
            key={i}
            accessibilityLabel={`Phỏm ${i + 1}`}
            style={s.meldGroup}
          >
            <PhomMiniCards cards={group} overlap />
          </View>
        ))
      ) : (
        <PhomMiniCards cards={discards} overlap />
      )}
    </ScrollView>
  );
}
export function PhomSeat({
  room,
  seat,
  seconds,
  landscape,
  dense = false,
  onPlayerPress,
}: {
  room: CardGameRoom;
  seat: { participant: PhomView['players'][number] } | { member: GameMember };
  seconds: number;
  landscape: boolean;
  dense?: boolean;
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
  const status = !player
    ? null
    : player.forfeited
      ? 'Bỏ cuộc'
      : player.laid
        ? player.melds.length
          ? 'Đã hạ'
          : 'Móm'
        : `Lượt ${Math.min(player.turns + 1, 4)}/4`;
  const hasPublic =
    !!player && (player.discards.length > 0 || player.melds.length > 0);
  return (
    <View
      testID={`phom-seat-${uid}`}
      style={[
        s.seat,
        landscape && s.compactSeat,
        dense && s.denseSeat,
        turn && s.turnSeat,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Thông tin người chơi ${name}`}
        onPress={() => onPlayerPress?.(uid)}
        disabled={!onPlayerPress || !member}
        style={[s.playerHeading, dense && s.densePlayerHeading]}
        hitSlop={6}
      >
        <View>
          <View style={s.avatar}>
            <Text style={s.name}>{name.slice(0, 1).toUpperCase()}</Text>
            <CardGameAvatarImage
              uid={uid}
              url={member?.avatarUrl}
              name={name}
              size={32}
            />
          </View>
          {!player && member?.ready && (
            <View accessible accessibilityLabel="Sẵn sàng" style={s.readyBadge}>
              <Text style={s.readyBadgeText}>✓</Text>
            </View>
          )}
        </View>
        <View style={[s.playerCopy, dense && s.densePlayerCopy]}>
          <View style={s.nameRow}>
            <Text
              numberOfLines={1}
              style={[s.name, s.nameFlex, dense && s.denseName]}
            >
              {name}
            </Text>
            {turn ? (
              <Text
                accessibilityLiveRegion="polite"
                accessibilityLabel={`Đang đánh, còn ${seconds} giây`}
                style={[s.timer, seconds <= 5 && s.timerUrgent]}
              >
                {seconds}s
              </Text>
            ) : (
              status && (
                <Text numberOfLines={1} style={s.statusText}>
                  {status}
                </Text>
              )
            )}
          </View>
          <View style={[s.meta, dense && s.denseMeta]}>
            <Text style={s.caption}>
              {phomMoney(player?.balance ?? member?.balance ?? 0)}
            </Text>
            {count !== null && (
              <>
                <Text style={s.dot}>•</Text>
                <Text style={s.caption}>Còn {count} lá</Text>
              </>
            )}
          </View>
        </View>
      </Pressable>
      {player && hasPublic && (
        <PhomPublicCards discards={player.discards} melds={player.melds} />
      )}
    </View>
  );
}
export function PhomResults({
  game,
  onPlayerResultPress,
}: {
  game: PhomView;
  onPlayerResultPress?: (uid: string) => void;
}) {
  const [detail, setDetail] = useState(false);
  if (game.status === 'cancelled')
    return <Text style={s.body}>Ván đã hủy, không ghi điểm.</Text>;
  const nameOf = (id?: string) =>
    game.players.find((p) => p.uid === id)?.name ?? 'Người chơi';
  const ranking = game.result?.ranking ?? [];
  const hasDetail = ranking.some((e) => e.breakdown?.length);
  return (
    <View style={[s.resultCard, { alignSelf: 'stretch' }]}>
      <View style={s.resultRow}>
        <Text accessibilityRole="header" style={s.resultTitle}>
          Kết quả ván
        </Text>
        {hasDetail && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setDetail((v) => !v)}
            hitSlop={8}
          >
            <Text style={s.chipText}>{detail ? 'Thu gọn' : 'Chi tiết'}</Text>
          </Pressable>
        )}
      </View>
      {ranking.map((entry, index) => {
        const amount = entry.moneyDelta ?? 0;
        const tags = entry.labels.map((l) => phomLabels[l] ?? l);
        if (entry.deadwoodPoints !== undefined)
          tags.push(`${entry.deadwoodPoints} điểm`);
        return (
          <Pressable
            key={entry.uid}
            accessibilityRole="button"
            accessibilityLabel={`Xem bài của ${entry.name ?? nameOf(entry.uid)}`}
            accessibilityHint="Xem bài đã đánh, đã ăn và bài còn lại khi kết thúc ván"
            disabled={!onPlayerResultPress || game.status !== 'finished'}
            onPress={() => onPlayerResultPress?.(entry.uid)}
            style={[
              s.resultLine,
              s.resultTouchable,
              index > 0 && s.resultDivider,
              entry.rank === 1 && s.resultWinner,
            ]}
          >
            <View style={s.resultRow}>
              <Text numberOfLines={1} style={s.resultName}>
                #{entry.rank} {entry.name ?? nameOf(entry.uid)}
              </Text>
              <View style={s.resultTags}>
                {tags.map((t, i) => (
                  <Text key={i} numberOfLines={1} style={s.tag}>
                    {t}
                  </Text>
                ))}
              </View>
              <Text
                style={[
                  s.resultMoney,
                  amount > 0 && s.moneyUp,
                  amount < 0 && s.red,
                ]}
              >
                {phomMoney(amount)}
              </Text>
            </View>
            {detail &&
              entry.breakdown?.map((part, i) => (
                <Text key={i} numberOfLines={1} style={s.resultDetail}>
                  {phomLabels[part.kind] ?? part.kind} {phomMoney(part.amount)}{' '}
                  · {nameOf(part.otherUid)}
                </Text>
              ))}
          </Pressable>
        );
      })}
    </View>
  );
}
