import Feather from '@expo/vector-icons/Feather';
import { useWindowDimensions, View, Text, Pressable } from 'react-native';
import { Button } from '../../components/Button';
import type { CardGameRoom, GameIntent } from '../../types/cardGame';
import { colors } from '../../theme';
import { CardGameAvatarImage } from './CardGameAvatarImage';
import { styles } from './CardGamesScreen.styles';

export function CardGameLobbyTable({
  room,
  uid,
  playerName,
  controller,
  disabled,
  busy,
  onAction,
  onPlayerPress,
}: {
  room: CardGameRoom | null;
  uid: string;
  playerName?: string;
  controller: boolean;
  disabled: boolean;
  busy: boolean;
  onAction: (action: GameIntent) => void;
  onPlayerPress?: (uid: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const ownMember = room?.members.find((member) => member.uid === uid);
  const ownerUid = room?.ownerUid !== undefined ? room.ownerUid : room?.host;
  const others = room?.members.filter((member) => member.uid !== uid) ?? [];
  const allReady =
    !!room &&
    room.members.length >= 2 &&
    room.members.every((member) => member.ready);

  return (
    <View
      testID="lobby-game-table"
      style={[styles.lobbyTable, landscape && styles.landscapeLobbyTable]}
    >
      <View
        testID="lobby-board"
        style={[styles.lobbyBoard, landscape && styles.landscapeLobbyBoard]}
      >
        <View
          testID="lobby-opponents"
          style={[
            styles.lobbyOpponentRow,
            landscape && styles.landscapeLobbyOpponentRow,
          ]}
        >
          {others.map((member) => (
            <Pressable
              key={member.uid}
              style={[
                styles.lobbyPlayer,
                landscape && styles.landscapeLobbyPlayer,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Thông tin người chơi ${member.name}`}
              onPress={() => onPlayerPress?.(member.uid)}
              disabled={!onPlayerPress}
            >
              <View style={styles.lobbyAvatar}>
                <Text style={styles.lobbyAvatarText}>
                  {member.name.slice(0, 1).toUpperCase()}
                </Text>
                <CardGameAvatarImage
                  uid={member.uid}
                  url={member.avatarUrl}
                  name={member.name}
                  size={29}
                />
                <View
                  style={[
                    styles.lobbyReadyDot,
                    member.ready && styles.lobbyReadyDotOn,
                  ]}
                >
                  <Feather
                    name={member.ready ? 'check' : 'clock'}
                    size={9}
                    color={member.ready ? colors.surface : colors.muted}
                  />
                </View>
              </View>
              <View style={styles.lobbyPlayerCopy}>
                <Text numberOfLines={2} style={styles.lobbyPlayerName}>
                  {member.name}
                </Text>
                <Text numberOfLines={1} style={styles.lobbyPlayerStatus}>
                  {member.ready ? 'Sẵn sàng' : 'Đang chờ'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View testID="lobby-deck" style={styles.lobbyDeckStack}>
          <View style={[styles.lobbyDeckCard, styles.lobbyDeckCardBack]} />
          <View style={[styles.lobbyDeckCard, styles.lobbyDeckCardFront]}>
            <Text style={styles.lobbyDeckMark}>◆</Text>
          </View>
        </View>
        <Text style={styles.lobbyTableMessage}>
          {!room || room.members.length < 2
            ? 'Mời bạn bè vào phòng'
            : allReady
              ? 'Đang chia bài…'
              : 'Chờ mọi người sẵn sàng'}
        </Text>
      </View>

      <View
        testID="lobby-ready-panel"
        style={[
          styles.lobbyReadyPanel,
          landscape && styles.landscapeLobbyReadyPanel,
        ]}
      >
        <Pressable
          testID="lobby-own-player"
          style={styles.lobbyOwnPlayer}
          accessibilityRole="button"
          accessibilityLabel={`Thông tin người chơi ${ownMember?.name ?? playerName ?? 'Bạn'}`}
          onPress={() => onPlayerPress?.(uid)}
          disabled={!ownMember || !onPlayerPress}
        >
          <View style={styles.lobbyOwnAvatar}>
            <Text style={styles.lobbyAvatarText}>
              {(ownMember?.name ?? playerName ?? 'B').slice(0, 1).toUpperCase()}
            </Text>
            <CardGameAvatarImage
              uid={uid}
              url={ownMember?.avatarUrl}
              name={ownMember?.name ?? playerName ?? 'Bạn'}
              size={36}
            />
            <View
              style={[
                styles.lobbyReadyDot,
                ownMember?.ready && styles.lobbyReadyDotOn,
              ]}
            >
              <Feather
                name={ownMember?.ready ? 'check' : 'clock'}
                size={9}
                color={ownMember?.ready ? colors.surface : colors.muted}
              />
            </View>
          </View>
          <View style={styles.lobbyPlayerCopy}>
            <Text numberOfLines={2} style={styles.lobbyPlayerName}>
              {ownMember?.name ?? playerName ?? 'Bạn'} (Bạn)
            </Text>
            <Text style={styles.lobbyPlayerStatus}>
              {!room
                ? 'Đang tạo phòng'
                : ownerUid === uid
                  ? 'Chủ phòng'
                  : ownMember?.ready
                    ? 'Sẵn sàng'
                    : 'Đang chờ'}
            </Text>
          </View>
          <Text style={styles.playerCount}>{room?.members.length ?? 1}/4</Text>
        </Pressable>
        <View
          style={[
            styles.lobbyReadyAction,
            landscape && styles.landscapeLobbyReadyAction,
          ]}
        >
          <Button
            compact={landscape || width < 400}
            title={
              busy && !room
                ? 'Sẵn sàng'
                : !controller
                  ? 'Chơi trên thiết bị này'
                  : ownMember?.ready
                    ? 'Bỏ sẵn sàng'
                    : 'Sẵn sàng'
            }
            variant={ownMember?.ready ? 'secondary' : 'primary'}
            loading={busy}
            disabled={disabled}
            onPress={() =>
              onAction(
                controller && room
                  ? { type: 'ready', ready: !ownMember?.ready }
                  : { type: 'takeover' },
              )
            }
          />
        </View>
      </View>
    </View>
  );
}
