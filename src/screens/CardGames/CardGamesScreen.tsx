import Feather from '@expo/vector-icons/Feather';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { AppTextInput } from '../../components/AppTextInput';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { useCardGame } from '../../hooks/useCardGame';
import { useAuthStore } from '../../store/authStore';
import type { MainTabParams } from '../../navigation/types';
import { colors } from '../../theme';
import type { GameIntent } from '../../types/cardGame';
import { CardGameRules } from './CardGameRules';
import { CardGameTable } from './CardGameTable';
import { styles } from './CardGamesScreen.styles';

const reasons: Record<string, string> = {
  dragon: 'Tới trắng · Sảnh rồng',
  'four-twos': 'Tới trắng · Tứ quý 2',
  'six-pairs': 'Tới trắng · Sáu đôi',
  'played-out': 'Ván đã kết thúc',
  forfeit: 'Ván kết thúc có người bỏ cuộc',
  'all-disconnected': 'Ván đã hủy',
};
const labels: Record<string, string> = {
  cong: 'Cóng',
  forfeit: 'Bỏ cuộc',
  'remaining-twos': 'Thối 2',
  'remaining-quad': 'Thối tứ quý',
  'remaining-pairs': 'Thối đôi thông',
  'instant-win': 'Tới trắng',
};

export function CardGamesScreen({
  navigation,
}: BottomTabScreenProps<MainTabParams, 'CardGames'>) {
  const { enabled, active, uid, state, session } = useCardGame();
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(
    user?.displayName?.trim().slice(0, 30) || 'Người chơi',
  );
  const [code, setCode] = useState('');
  const [rules, setRules] = useState(false);
  const [copyNote, setCopyNote] = useState(false);
  const room = active ? state?.snapshot?.room : null;
  const playing = room?.phase === 'playing' && !!room.game;
  const blocked =
    !active ||
    !state?.connected ||
    !!state.busy ||
    !!state.pending ||
    room?.controller === false;
  useEffect(() => {
    setName(user?.displayName?.trim().slice(0, 30) || 'Người chơi');
    setCode('');
    setRules(false);
  }, [user?.uid, user?.displayName]);
  useEffect(() => {
    if (!active) setRules(false);
  }, [active]);
  const send = (intent: GameIntent) => {
    Keyboard.dismiss();
    void session?.send(intent);
  };
  const leave = () => {
    if (!room) {
      navigation.navigate('CardScore');
      return;
    }
    Alert.alert(
      playing ? 'Rời ván đang chơi?' : 'Rời phòng?',
      playing
        ? 'Bạn sẽ bỏ cuộc và xếp sau những người còn chơi.'
        : 'Bạn có thể vào lại bằng mã nếu phòng còn chỗ.',
      [
        { text: 'Ở lại', style: 'cancel' },
        {
          text: 'Rời phòng',
          style: 'destructive',
          onPress: () => send({ type: 'leave' }),
        },
      ],
    );
  };
  const header = (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quay lại bảng điểm"
        style={styles.iconButton}
        onPress={() => navigation.navigate('CardScore')}
      >
        <Feather name="arrow-left" size={22} color={colors.earth} />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text accessibilityRole="header" style={styles.title}>
          Tiến lên miền Nam
        </Text>
        <View style={styles.status}>
          <View
            style={[styles.dot, !state?.connected && styles.reconnecting]}
          />
          <Text style={styles.subtitle}>
            {room
              ? state?.connected
                ? 'Phòng online'
                : 'Đang nối lại…'
              : 'Chơi cùng bạn bè'}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Xem luật chơi"
        style={styles.iconButton}
        onPress={() => setRules(true)}
      >
        <Feather name="help-circle" size={22} color={colors.earth} />
      </Pressable>
    </View>
  );
  const error =
    state && (state.error || state.pending) ? (
      <View style={styles.errorBox}>
        <Text accessibilityRole="alert" style={styles.error}>
          {state.error ??
            'Thao tác trước chưa được xác nhận. Hãy kiểm tra lại để tiếp tục.'}
        </Text>
        <Button
          compact
          variant="secondary"
          title={state.pending ? 'Kiểm tra lại thao tác' : 'Kết nối lại'}
          loading={state.busy}
          onPress={() => void session?.retry()}
        />
      </View>
    ) : null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        fixedHeader={header}
        scrollable={!playing}
        contentStyle={
          playing
            ? [
                styles.tableContent,
                { paddingBottom: Math.max(insets.bottom, 12) },
              ]
            : [styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]
        }
      >
        {!enabled ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Phòng online đang được chuẩn bị</Text>
            <Text style={styles.body}>
              Bạn vẫn có thể dùng bảng điểm cho các ván chơi cùng nhau.
            </Text>
            <Button
              title="Về bảng điểm"
              onPress={() => navigation.navigate('CardScore')}
            />
          </View>
        ) : state?.loading && !room ? (
          <View style={styles.loader}>
            <ActivityIndicator
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Đang mở phòng online"
              color={colors.earth}
            />
            <Text style={styles.body}>Đang kết nối phòng chơi…</Text>
          </View>
        ) : !room ? (
          <>
            {error}
            <View style={styles.section}>
              <Text style={styles.eyebrow}>CÙNG NHAU CHƠI MỘT VÁN</Text>
              <Text style={styles.heading}>Một bộ bài, một nhóm bạn</Text>
              <Text style={styles.body}>
                Tạo phòng rồi gửi mã cho bạn bè. Mọi tài khoản LifeMate đều có
                thể tham gia.
              </Text>
              <AppTextInput
                accessibilityLabel="Tên hiển thị trong phòng"
                value={name}
                onChangeText={setName}
                maxLength={30}
                editable={!state?.busy}
                placeholder="Tên của bạn"
                style={styles.input}
              />
              <Button
                title="Tạo phòng miền Nam"
                loading={state?.busy}
                disabled={blocked || !name.trim()}
                onPress={() =>
                  send({ type: 'create', name: name.trim(), game: 'south' })
                }
              />
            </View>
            <View style={styles.section}>
              <Text style={styles.heading}>Bạn đã có mã phòng?</Text>
              <AppTextInput
                accessibilityLabel="Mã phòng"
                value={code}
                onChangeText={(v) =>
                  setCode(v.toUpperCase().replace(/\s/g, '').slice(0, 8))
                }
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={16}
                editable={!state?.busy}
                placeholder="ABCDEFGH"
                style={[styles.input, styles.codeInput]}
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (code.length === 8 && !blocked && name.trim())
                    send({ type: 'join', name: name.trim(), code });
                }}
              />
              <Button
                title="Vào phòng"
                variant="secondary"
                disabled={blocked || code.length !== 8 || !name.trim()}
                onPress={() => send({ type: 'join', name: name.trim(), code })}
              />
            </View>
            <View style={styles.mutedBox}>
              <Text style={styles.name}>Sắp có thêm trò</Text>
              <Text style={styles.body}>Tiến lên miền Bắc · Phỏm</Text>
            </View>
          </>
        ) : playing ? (
          <>
            {error}
            {!room.controller && (
              <View style={styles.errorBox}>
                <Text style={styles.body}>
                  Bạn đang điều khiển bàn trên thiết bị khác.
                </Text>
                <Button
                  compact
                  title="Chơi trên thiết bị này"
                  onPress={() => send({ type: 'takeover' })}
                />
              </View>
            )}
            <CardGameTable
              room={room}
              uid={uid!}
              serverTime={state!.snapshot!.serverTime}
              active={active}
              disabled={blocked}
              busy={!!state?.busy}
              onAction={send}
            />
            <Button
              compact
              variant="secondary"
              title="Rời phòng"
              disabled={blocked}
              onPress={leave}
            />
          </>
        ) : (
          <>
            {error}
            <View style={styles.section}>
              <View style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sao chép mã phòng"
                  style={styles.codeButton}
                  onPress={() =>
                    void Clipboard.setStringAsync(room.code)
                      .then(() => setCopyNote(true))
                      .catch(() => setCopyNote(false))
                  }
                >
                  <Text style={styles.eyebrow}>MÃ PHÒNG</Text>
                  <Text style={styles.code}>{room.code}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Chia sẻ mã phòng"
                  style={styles.iconButton}
                  onPress={() =>
                    void Share.share({
                      message: `Vào LifeMate → Ghi điểm bài → Chơi online, nhập mã ${room.code} để chơi Tiến lên miền Nam cùng mình nhé!`,
                    }).catch(() => undefined)
                  }
                >
                  <Feather name="share-2" size={21} color={colors.earth} />
                </Pressable>
              </View>
              {copyNote && (
                <Text accessibilityLiveRegion="polite" style={styles.ready}>
                  Đã sao chép mã phòng
                </Text>
              )}
              <Text style={styles.body}>
                2–4 người · 30 giây/lượt · south-v1
              </Text>
            </View>
            {!!room.game?.result && (
              <View style={styles.section}>
                <Text style={styles.heading}>
                  {reasons[room.game.result.reason] ?? 'Kết quả ván'}
                </Text>
                {room.game.result.ranking.map((p) => (
                  <View key={p.uid} style={styles.resultRow}>
                    <Text style={styles.rank}>#{p.rank}</Text>
                    <View style={styles.grow}>
                      <Text style={styles.name}>
                        {room.members.find((m) => m.uid === p.uid)?.name ??
                          'Người chơi đã rời'}
                        {p.uid === uid ? ' (Bạn)' : ''}
                      </Text>
                      <Text style={styles.subtitle}>
                        {p.labels.map((l) => labels[l] ?? l).join(' · ')}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.section}>
              <Text style={styles.heading}>
                Người chơi · {room.members.length}/4
              </Text>
              {room.members.map((p) => (
                <View key={p.uid} style={styles.seat}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {p.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.name}>
                      {p.name}
                      {p.uid === uid ? ' (Bạn)' : ''}
                    </Text>
                    <Text style={styles.subtitle}>
                      {p.uid === room.host ? 'Chủ phòng · ' : ''}
                      {p.wins} ván thắng
                    </Text>
                  </View>
                  <Text style={p.ready ? styles.ready : styles.subtitle}>
                    {p.ready ? 'Sẵn sàng' : 'Đang chờ'}
                  </Text>
                </View>
              ))}
              {room.members.length < 4 && (
                <View style={styles.emptySeat}>
                  <Text style={styles.body}>
                    Gửi mã để mời thêm bạn vào phòng
                  </Text>
                </View>
              )}
              {!room.controller ? (
                <Button
                  title="Chơi trên thiết bị này"
                  onPress={() => send({ type: 'takeover' })}
                />
              ) : (
                <>
                  <Button
                    title={
                      room.members.find((p) => p.uid === uid)?.ready
                        ? 'Bỏ sẵn sàng'
                        : 'Sẵn sàng'
                    }
                    variant="secondary"
                    disabled={blocked}
                    onPress={() =>
                      send({
                        type: 'ready',
                        ready: !room.members.find((p) => p.uid === uid)?.ready,
                      })
                    }
                  />
                  {room.host === uid ? (
                    <Button
                      title="Bắt đầu ván"
                      loading={state?.busy}
                      disabled={
                        blocked ||
                        room.members.length < 2 ||
                        !room.members.every((p) => p.ready)
                      }
                      onPress={() => send({ type: 'start' })}
                    />
                  ) : (
                    <Text style={styles.body}>
                      Chủ phòng sẽ bắt đầu khi mọi người sẵn sàng.
                    </Text>
                  )}
                </>
              )}
            </View>
            <Button
              title="Rời phòng"
              variant="secondary"
              compact
              disabled={blocked}
              onPress={leave}
            />
          </>
        )}
      </Screen>
      <CardGameRules
        visible={rules && active}
        onClose={() => setRules(false)}
      />
    </KeyboardAvoidingView>
  );
}
