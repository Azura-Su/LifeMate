import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  BackHandler,
  Text,
  View,
  type ScrollView,
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { randomUUID } from 'expo-crypto';
import type { MainTabParams } from '../../navigation/types';
import type { PetRecord, PetSpecies } from '../../types/pet';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { AppTextInput } from '../../components/AppTextInput';
import { colors, typography } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import {
  generatePetDNA,
  newPetSeed,
  petAppearanceHash,
  petDNAHash,
} from '../../services/pets/petGenetics';
import { effectInfo, speciesInfo } from '../../services/pets/petCatalog';
import { normalizePetName } from '../../services/pets/petSlot';
import { resolvePetPlayback } from '../../services/pets/petPlayback';
import { usePet } from './usePet';
import { PetStage } from './PetStage';
import { PetSpeciesPicker } from './PetSpeciesPicker';
import { styles } from './PetsScreen.styles';

type Navigation = BottomTabScreenProps<MainTabParams, 'Pets'>['navigation'];
export function PetsScreen({
  navigation,
}: BottomTabScreenProps<MainTabParams, 'Pets'>) {
  const model = usePet();
  return (
    <PetExperience
      key={`${model.uid}:${model.epoch}`}
      model={model}
      navigation={navigation}
    />
  );
}
function PetExperience({
  model,
  navigation,
}: {
  model: ReturnType<typeof usePet>;
  navigation: Navigation;
}) {
  const [mode, setMode] = useState<'home' | 'species' | 'result'>('home'),
    [selected, setSelected] = useState<PetSpecies[]>([]),
    [draft, setDraft] = useState<PetRecord | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [reduced, setReduced] = useState(false);
  const [action, setAction] = useState<{
    type: 'reaction' | 'cast';
    id: number;
    started: number;
  } | null>(null);
  const [edit, setEdit] = useState<{
    petId: string;
    name: string;
    revision: number;
  } | null>(null);
  const [draftName, setDraftName] = useState('Mây');
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [mode, draft?.petId]);
  const generation = useRef(0),
    mounted = useRef(true),
    live = useRef({ model, mode, draft });
  live.current = { model, mode, draft };
  const lastCast = useRef(-Infinity),
    actionCounter = useRef(0),
    recent = useRef<string[]>([]);
  const pending = model.cache.pending,
    owned = model.cache.slot?.pet ?? null;
  const visible =
    mode === 'result'
      ? draft
      : pending?.type === 'delete'
        ? null
        : (owned ?? (pending?.type === 'create' ? pending.pet : null));
  const isCurrentSession = () =>
    mounted.current &&
    useAuthStore.getState().user?.uid === model.uid &&
    useAuthStore.getState().sessionEpoch === model.epoch;
  const isLive = () => isCurrentSession() && live.current.model.active;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    setAction(null);
    lastCast.current = -Infinity;
    setEdit(null);
  }, [owned?.petId, model.active]);
  useEffect(() => {
    if (edit && edit.revision !== model.cache.slot?.revision) setEdit(null);
  }, [edit, model.cache.slot?.revision]);
  const back = () => {
    if (mode === 'home') {
      navigation.navigate('Home');
      return;
    }
    if (mode === 'result' && draft && !pending) {
      const id = draft.petId;
      Alert.alert('Rời bản nháp?', 'Thú cưng này chưa được lưu.', [
        { text: 'Ở lại', style: 'cancel' },
        {
          text: 'Rời bản nháp',
          onPress: () => {
            if (isLive() && live.current.draft?.petId === id) {
              generation.current++;
              setDraft(null);
              setMode('home');
            }
          },
        },
      ]);
      return;
    }
    generation.current++;
    setBusy(false);
    setMode('home');
  };
  useEffect(() => {
    if (!model.active) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => listener.remove();
    // Back must use the current view/draft, never a stale confirmation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.active, mode, draft, pending]);
  const generate = async () => {
    if (busy || !selected.length || !isLive() || !model.uid) return;
    const token = ++generation.current;
    setBusy(true);
    setError(null);
    try {
      let result: PetRecord | undefined;
      for (let attempt = 0; attempt < 20; attempt++) {
        const dna = await generatePetDNA(selected, await newPetSeed());
        const appearanceHash = await petAppearanceHash(dna);
        if (
          recent.current.includes(appearanceHash) ||
          appearanceHash === owned?.appearanceHash
        )
          continue;
        result = {
          petId: randomUUID(),
          ownerId: model.uid,
          name: 'Mây',
          dna,
          dnaHash: await petDNAHash(dna),
          appearanceHash,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        break;
      }
      if (!isLive() || token !== generation.current) return;
      if (!result) throw new Error('Chưa tìm được biến thể mới. Hãy thử lại.');
      recent.current = [result.appearanceHash, ...recent.current].slice(0, 50);
      setDraft(result);
      setDraftName(result.name);
      setAction(null);
      lastCast.current = -Infinity;
      setMode('result');
    } catch (cause) {
      if (isLive() && token === generation.current)
        setError(
          cause instanceof Error ? cause.message : 'Chưa tạo được thú cưng.',
        );
    } finally {
      if (mounted.current && token === generation.current) setBusy(false);
    }
  };
  const run = async (task: () => Promise<void>) => {
    if (!isLive() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await task();
      if (isCurrentSession()) {
        setDraft(null);
        setMode('home');
      }
    } catch (cause) {
      if (isLive())
        setError(
          cause instanceof Error ? cause.message : 'Chưa lưu được thao tác.',
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const remove = () => {
    if (!owned || pending || busy) return;
    const petId = owned.petId,
      revision = model.cache.slot!.revision;
    Alert.alert(
      'Xóa thú cưng?',
      `Xóa ${owned.name}? Bạn có thể tạo pet mới sau khi việc xóa được đồng bộ.`,
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Xóa thú cưng',
          style: 'destructive',
          onPress: () => {
            const current = live.current.model;
            if (
              !isLive() ||
              current.cache.slot?.pet?.petId !== petId ||
              current.cache.slot.revision !== revision ||
              current.cache.pending
            )
              return;
            void run(() => current.remove(petId, revision));
          },
        },
      ],
    );
  };
  const interact = (type: 'reaction' | 'cast') => {
    if (!visible || !isLive()) return;
    const now = performance.now();
    if (
      type === 'cast' &&
      now - lastCast.current < resolvePetPlayback(visible.dna).skill.cooldownMs
    )
      return;
    if (action && now - action.started < 1200) return;
    if (type === 'cast') lastCast.current = now;
    setAction({ type, id: ++actionCounter.current, started: now });
  };
  const errorMessage = error ?? model.error;
  return (
    <Screen
      scrollRef={scrollRef}
      scrollable
      contentStyle={styles.content}
      fixedHeader={
        <ScreenHeader
          title={
            mode === 'species'
              ? 'Chọn loài'
              : mode === 'result'
                ? 'Người bạn mới'
                : 'Thú cưng của tôi'
          }
          onBack={back}
          backLabel={mode === 'home' ? 'Quay về Home' : 'Quay lại thú cưng'}
        />
      }
    >
      {errorMessage && (
        <View style={styles.errorBox}>
          <Text accessibilityRole="alert" style={styles.error}>
            {errorMessage}
          </Text>
          <Button
            compact
            variant="secondary"
            title="Thử đồng bộ lại"
            loading={model.syncing}
            onPress={model.retry}
          />
        </View>
      )}
      {model.loading ? (
        <ActivityIndicator
          accessibilityLabel="Đang mở thú cưng"
          color={colors.earth}
        />
      ) : mode === 'species' ? (
        <PetSpeciesPicker
          selected={selected}
          onSelect={(id) =>
            setSelected((values) =>
              values.includes(id)
                ? values.filter((s) => s !== id)
                : values.length < 3
                  ? [...values, id]
                  : values,
            )
          }
          onCreate={() => {
            void generate();
          }}
          busy={busy}
        />
      ) : visible ? (
        <>
          <View style={styles.petHeading}>
            <Text style={styles.eyebrow}>
              {mode === 'result' ? 'CHÀO BẠN NHỎ' : 'NGƯỜI BẠN CỦA BẠN'}
            </Text>
            <Text style={styles.petName}>
              {mode === 'result' ? draftName || 'Mây' : visible.name}
            </Text>
            <View style={styles.chips}>
              {visible.dna.species.map((id) => (
                <View key={id} style={styles.chip}>
                  <Text style={styles.chipText}>{speciesInfo(id).name}</Text>
                </View>
              ))}
            </View>
          </View>
          <PetStage
            key={visible.petId}
            dna={visible.dna}
            active={model.active}
            reduced={reduced}
            action={action}
          />
          <Text style={styles.helper}>
            Vuốt ngang để ngắm bạn nhỏ từ mọi phía
          </Text>
          <View style={styles.row}>
            <View style={styles.grow}>
              <Button
                compact
                variant="secondary"
                title="Chơi cùng"
                onPress={() => interact('reaction')}
              />
            </View>
            <View style={styles.grow}>
              <Button
                compact
                title={effectInfo(visible.dna.skill.effectId).name}
                onPress={() => interact('cast')}
              />
            </View>
          </View>
          {mode === 'result' ? (
            <>
              <Text style={styles.label}>Tên bạn nhỏ</Text>
              <AppTextInput
                accessibilityLabel="Tên thú cưng mới"
                style={styles.input}
                value={draftName}
                onChangeText={setDraftName}
                maxLength={96}
              />
              {owned ? (
                <Text style={styles.pending}>
                  Tài khoản đã có thú cưng. Hãy xóa bạn hiện tại trước khi lưu
                  pet mới.
                </Text>
              ) : (
                <Button
                  title="Lưu thú cưng"
                  loading={busy}
                  disabled={!!pending}
                  onPress={() => {
                    void run(async () => {
                      const name = normalizePetName(draftName);
                      await model.save({ ...visible, name });
                    });
                  }}
                />
              )}
              <Button
                title="Tạo diện mạo khác"
                variant="secondary"
                loading={busy}
                onPress={() => {
                  void generate();
                }}
              />
            </>
          ) : (
            <>
              <Text style={pending ? styles.pending : styles.status}>
                {pending
                  ? 'Bản nháp trên thiết bị · Chờ xác nhận lưu'
                  : model.syncing
                    ? 'Đang đồng bộ…'
                    : 'Đã lưu trên tài khoản'}
              </Text>
              <View style={styles.row}>
                <View style={styles.grow}>
                  <Button
                    title="Đổi tên"
                    variant="secondary"
                    disabled={!!pending || busy}
                    onPress={() =>
                      setEdit({
                        petId: visible.petId,
                        name: visible.name,
                        revision: model.cache.slot!.revision,
                      })
                    }
                  />
                </View>
                <View style={styles.grow}>
                  <Button
                    title="Xóa thú cưng"
                    variant="danger"
                    disabled={!!pending || busy}
                    onPress={remove}
                  />
                </View>
              </View>
            </>
          )}
        </>
      ) : (
        <View style={styles.empty}>
          <View style={styles.paw}>
            <Feather name="heart" size={48} color={colors.earth} />
          </View>
          <Text style={[styles.title, styles.center]}>
            {pending?.type === 'delete'
              ? 'Hẹn gặp bạn nhỏ mới'
              : 'Một người bạn,\nmột nét riêng'}
          </Text>
          <Text style={[styles.subtitle, styles.center]}>
            {pending?.type === 'delete'
              ? 'Đang chờ đồng bộ xóa. Sau khi xác nhận, bạn có thể nhận một thú cưng mới.'
              : 'Kết hợp những loài bạn yêu thích để gặp thú cưng chibi của riêng mình.'}
          </Text>
          <Button
            title="Tạo thú cưng"
            disabled={!!pending || busy || !model.uid}
            onPress={() => {
              setMode('species');
              setError(null);
            }}
          />
          {model.cache.draft && !pending && (
            <Button
              title="Mở bản nháp"
              variant="secondary"
              onPress={() => {
                setDraft(model.cache.draft);
                setDraftName(model.cache.draft!.name);
                setSelected(model.cache.draft!.dna.species);
                setMode('result');
              }}
            />
          )}
        </View>
      )}
      {edit && (
        <DialogModal onRequestClose={() => setEdit(null)}>
          <Text style={typography.dialogTitle}>Đổi tên bạn nhỏ</Text>
          <AppTextInput
            accessibilityLabel="Tên thú cưng"
            value={edit.name}
            onChangeText={(name) => setEdit({ ...edit, name })}
            style={styles.input}
            maxLength={96}
          />
          <Button
            title="Lưu tên"
            loading={busy}
            onPress={() => {
              void run(async () => {
                await model.rename(edit.petId, edit.name, edit.revision);
                setEdit(null);
              });
            }}
          />
          <Button
            title="Hủy"
            variant="secondary"
            onPress={() => setEdit(null)}
          />
        </DialogModal>
      )}
    </Screen>
  );
}
