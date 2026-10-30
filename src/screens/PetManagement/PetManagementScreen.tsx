import Feather from '@expo/vector-icons/Feather';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { DialogModal } from '../../components/DialogModal';
import { Screen } from '../../components/Screen';
import { HeaderIconButton, ScreenHeader } from '../../components/ScreenHeader';
import { isUserAdmin } from '../../config/userAdmin';
import { useScreenActive } from '../../hooks/useScreenActive';
import type { MainTabParams } from '../../navigation/types';
import {
  listManagedPets,
  revokeManagedPet,
  type ManagedPet,
} from '../../services/admin/petManagement';
import {
  invalidateOwnedPixelPet,
  newPixelPetAction,
  readOwnedPixelPet,
  subscribeOwnedPixelPet,
} from '../../services/pixelPet/pixelPetApi';
import { CELESTIAL_STAG_ID } from '../../services/pixelPet/celestialStagPuppet';
import { pixelPetSpecies } from '../../services/pixelPet/pixelPetCatalog';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, typography } from '../../theme';
import { PET_ART } from '../PixelPet/petArt';
import { ManagedPetDetailScreen } from './ManagedPetDetailScreen';
import { styles } from './PetManagementScreen.styles';

const fold = (text: string) =>
  text
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
const stageLabel = {
  hatchling: 'Ấu thể',
  juvenile: 'Trưởng thành',
  ascended: 'Thăng hoa',
};
type Selection = { pet: ManagedPet; actionId: string; epoch: number };
type StatusFilter = 'all' | ManagedPet['status'];
const STATUS = {
  owned: { label: 'Đã có chủ', tone: 'owned', icon: 'heart' },
  reserved: { label: 'Đang giữ chỗ', tone: 'reserved', icon: 'clock' },
  available: { label: 'Có thể nhận nuôi', tone: 'available', icon: 'gift' },
} as const;
const FILTERS: readonly {
  value: StatusFilter;
  label: string;
  short: string;
}[] = [
  { value: 'all', label: 'Tất cả', short: 'Tất cả' },
  { value: 'owned', label: 'Có chủ', short: 'Có chủ' },
  { value: 'reserved', label: 'Giữ chỗ', short: 'Giữ chỗ' },
  { value: 'available', label: 'Còn trống', short: 'Trống' },
];
const initial = (name: string) => [...name.trim()][0]?.toUpperCase() ?? '?';

export function PetManagementScreen({
  navigation,
}: BottomTabScreenProps<MainTabParams, 'PetManagement'>) {
  const user = useAuthStore((state) => state.user);
  const epoch = useAuthStore((state) => state.sessionEpoch);
  const allowed = isUserAdmin(user);
  const active = useScreenActive();
  const [serverPets, setPets] = useState<ManagedPet[]>([]);
  const readOwn = useCallback(
    () => (user ? readOwnedPixelPet(user.uid) : null),
    [user],
  );
  const ownPet = useSyncExternalStore(subscribeOwnedPixelPet, readOwn, readOwn);
  // The admin's Linh Lộc never appears in the server inventory; list it here.
  const pets = useMemo<ManagedPet[]>(() => {
    if (!allowed || !user || !serverPets.length) return serverPets;
    const own = ownPet?.speciesId === CELESTIAL_STAG_ID ? ownPet : null;
    const stag: ManagedPet = {
      speciesId: CELESTIAL_STAG_ID,
      status: 'owned',
      holder: {
        uid: user.uid,
        name: user.displayName ?? '',
        email: user.email ?? '',
      },
      reservedUntil: null,
      adoption: own && {
        id: own.adoptionId,
        adoptedAt: own.adoptedAt,
        totalExp: own.totalExp,
        level: own.level,
        stage: own.stage,
      },
      exclusive: true,
    };
    return [stag, ...serverPets.filter((p) => p.speciesId !== stag.speciesId)];
  }, [allowed, user, ownPet, serverPets]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [detailSpeciesId, setDetailSpeciesId] = useState<
    ManagedPet['speciesId'] | null
  >(null);
  const request = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const closeDetail = useCallback(() => setDetailSpeciesId(null), []);

  const run = useCallback(
    async (operation: (signal: AbortSignal) => Promise<void>) => {
      if (
        busyRef.current ||
        !activeRef.current ||
        !isUserAdmin(useAuthStore.getState().user)
      )
        return;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      setSuccess(null);
      const controller = new AbortController();
      request.current = controller;
      try {
        await operation(controller.signal);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Chưa kết nối được máy chủ.',
          );
      } finally {
        if (request.current === controller) {
          busyRef.current = false;
          setBusy(false);
        }
      }
    },
    [],
  );
  const load = useCallback(
    () =>
      run(async (signal) => {
        const result = await listManagedPets(signal);
        if (!signal.aborted && activeRef.current) setPets(result.pets);
      }),
    [run],
  );

  useEffect(() => {
    setPets([]);
    setSelected(null);
    setDetailSpeciesId(null);
    setError(null);
    setSuccess(null);
    setQuery('');
    setFilter('all');
    if (allowed && active) void load();
    return () => {
      request.current?.abort();
      request.current = null;
      busyRef.current = false;
    };
  }, [allowed, active, epoch, load]);

  const close = () => {
    if (!busyRef.current) {
      setSelected(null);
      setError(null);
    }
  };
  const confirm = () => {
    if (
      !selected ||
      selected.epoch !== useAuthStore.getState().sessionEpoch ||
      !activeRef.current ||
      !isUserAdmin(useAuthStore.getState().user)
    )
      return;
    const { pet, actionId } = selected;
    if (!pet.adoption || !pet.holder) return;
    const input = {
      actionId,
      targetUid: pet.holder.uid,
      speciesId: pet.speciesId,
      adoptionId: pet.adoption.id,
    };
    void run(async (signal) => {
      const result = await revokeManagedPet(input, signal);
      if (signal.aborted || !activeRef.current) return;
      invalidateOwnedPixelPet(input.targetUid);
      setPets(result.pets);
      setSelected(null);
      setSuccess('Đã thu hồi linh thú.');
    });
  };
  const needle = fold(query);
  const filtered = pets.filter(
    (p) =>
      (filter === 'all' || p.status === filter) &&
      fold(
        [
          pixelPetSpecies(p.speciesId)?.name,
          p.holder?.name,
          p.holder?.email,
          p.holder?.uid,
        ].join(' '),
      ).includes(needle),
  );
  const owned = pets.filter((p) => p.status === 'owned').length;
  const reserved = pets.filter((p) => p.status === 'reserved').length;
  const free = pets.length - owned - reserved;
  const counts: Record<StatusFilter, number> = {
    all: pets.length,
    owned,
    reserved,
    available: free,
  };
  const detailPet = detailSpeciesId
    ? pets.find((pet) => pet.speciesId === detailSpeciesId)
    : undefined;
  if (allowed && active && detailPet)
    return (
      <ManagedPetDetailScreen
        pet={detailPet}
        active={active}
        onBack={closeDetail}
      />
    );
  return (
    <Screen
      contentStyle={styles.content}
      refreshControl={
        allowed ? (
          <RefreshControl
            refreshing={busy && !selected && pets.length > 0}
            onRefresh={() => void load()}
          />
        ) : undefined
      }
      fixedHeader={
        <ScreenHeader
          title="Quản lý linh thú"
          onBack={() => navigation.navigate('Home')}
          subtitle={
            allowed && pets.length
              ? `${owned} có chủ · ${reserved} giữ chỗ · ${free} còn trống`
              : undefined
          }
          right={
            allowed ? (
              <HeaderIconButton
                icon="refresh-cw"
                label="Tải lại danh sách linh thú"
                busy={busy}
                onPress={() => void load()}
              />
            ) : undefined
          }
        />
      }
      fixedContent={
        allowed ? (
          <View>
            <View style={styles.searchBox}>
              <Feather name="search" size={18} color={colors.muted} />
              <TextInput
                accessibilityLabel="Tìm linh thú hoặc người sở hữu"
                placeholder="Tên linh thú, tên, email hoặc UID"
                placeholderTextColor={colors.muted}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.search}
              />
            </View>
            <View style={styles.filters}>
              {FILTERS.map(({ value, label, short }) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={`Lọc ${label}`}
                  accessibilityState={{ selected: filter === value }}
                  onPress={() => setFilter(value)}
                  style={[styles.chip, filter === value && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      filter === value && styles.chipTextActive,
                    ]}
                  >
                    {short} {counts[value]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : undefined
      }
    >
      {!allowed ? (
        <Text style={typography.body}>
          Bạn không có quyền truy cập màn hình này.
        </Text>
      ) : (
        <>
          {!selected && !!error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          {!!success && (
            <Text accessibilityRole="alert" style={styles.success}>
              {success}
            </Text>
          )}
          {busy && !pets.length && <ActivityIndicator color={colors.earth} />}
          {!busy && !error && !filtered.length && (
            <Text style={typography.body}>
              Không tìm thấy linh thú phù hợp.
            </Text>
          )}
          {filtered.map((pet) => {
            const species = pixelPetSpecies(pet.speciesId)!;
            const art = PET_ART[pet.speciesId];
            const status = STATUS[pet.status];
            const holder = pet.holder;
            return (
              <Pressable
                key={pet.speciesId}
                accessibilityRole="button"
                accessibilityLabel={`Mở chi tiết ${species.name}`}
                accessibilityHint="Xem hoạt động và biểu cảm của linh thú"
                onPress={() => {
                  setError(null);
                  setSuccess(null);
                  setDetailSpeciesId(pet.speciesId);
                }}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.detailPressed,
                ]}
              >
                <View style={styles.row}>
                  <View
                    style={[
                      styles.thumbnail,
                      { borderColor: species.palette[0] },
                    ]}
                  >
                    {art ? (
                      <Image
                        source={art}
                        style={styles.art}
                        resizeMode="contain"
                        accessibilityIgnoresInvertColors
                      />
                    ) : (
                      <Text style={styles.fallback}>🐯</Text>
                    )}
                  </View>
                  <View style={styles.flex}>
                    <Text
                      accessibilityRole="header"
                      numberOfLines={1}
                      style={styles.name}
                    >
                      {species.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.trait}>
                      {species.personality} · {species.skill}
                    </Text>
                    <View style={styles.badge}>
                      <View style={[styles.dot, styles[`${status.tone}Dot`]]} />
                      <Text style={[styles.badgeText, styles[status.tone]]}>
                        {status.label}
                      </Text>
                    </View>
                  </View>
                  {pet.adoption ? (
                    <View style={styles.levelBox}>
                      <Text style={styles.levelLabel}>LV</Text>
                      <Text style={styles.levelNumber}>
                        {pet.adoption.level}
                      </Text>
                    </View>
                  ) : (
                    <Feather
                      name="chevron-right"
                      size={18}
                      color={colors.muted}
                    />
                  )}
                </View>
                {holder && (
                  <View style={styles.owner}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {initial(holder.name || holder.email || '?')}
                      </Text>
                    </View>
                    <View style={styles.flex}>
                      <Text numberOfLines={1} style={styles.ownerName}>
                        {holder.name || 'Chưa đặt tên'}
                      </Text>
                      {!!holder.email && (
                        <Text numberOfLines={1} style={styles.ownerEmail}>
                          {holder.email}
                        </Text>
                      )}
                      <View style={styles.facts}>
                        {(pet.adoption
                          ? [
                              stageLabel[pet.adoption.stage],
                              `Cấp ${pet.adoption.level} · ${pet.adoption.totalExp} EXP`,
                              new Date(
                                pet.adoption.adoptedAt,
                              ).toLocaleDateString('vi-VN'),
                            ]
                          : pet.exclusive
                            ? ['Độc quyền admin']
                            : [
                                `Giữ đến ${new Date(
                                  pet.reservedUntil!,
                                ).toLocaleTimeString('vi-VN')}`,
                              ]
                        ).map((fact) => (
                          <Text key={fact} style={styles.fact}>
                            {fact}
                          </Text>
                        ))}
                      </View>
                    </View>
                    {pet.status === 'owned' && !pet.exclusive && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Thu hồi ${species.name}`}
                        accessibilityState={{ disabled: busy }}
                        disabled={busy}
                        hitSlop={spacing.xs}
                        onPress={() => {
                          setError(null);
                          setSuccess(null);
                          setSelected({
                            pet,
                            actionId: newPixelPetAction(),
                            epoch,
                          });
                        }}
                        style={({ pressed }) => [
                          styles.revoke,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Feather
                          name="corner-up-left"
                          size={16}
                          color={colors.danger}
                        />
                      </Pressable>
                    )}
                  </View>
                )}
              </Pressable>
            );
          })}
          {selected && active && (
            <DialogModal
              onRequestClose={close}
              onBackdropPress={close}
              style={styles.dialog}
            >
              <ScrollView contentContainerStyle={styles.dialogContent}>
                <Text style={typography.dialogTitle}>
                  Thu hồi {pixelPetSpecies(selected.pet.speciesId)?.name}?
                </Text>
                <Text style={typography.body}>
                  Linh thú sẽ rời khỏi{' '}
                  {selected.pet.holder?.name ||
                    selected.pet.holder?.email ||
                    selected.pet.holder?.uid}{' '}
                  và trở lại danh sách có thể nhận nuôi.
                </Text>
                <Text style={typography.small}>
                  Người nhận nuôi tiếp theo bắt đầu ở cấp 1, EXP 0. Lượt chọn
                  còn lại của người cũ được giữ nguyên; không thể khôi phục lượt
                  nhận nuôi đã thu hồi.
                </Text>
                {!!error && (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {error}
                  </Text>
                )}
                <Button
                  title="Xác nhận thu hồi"
                  variant="danger"
                  onPress={confirm}
                  loading={busy}
                />
                <Button
                  title="Hủy"
                  variant="secondary"
                  onPress={close}
                  disabled={busy}
                />
              </ScrollView>
            </DialogModal>
          )}
        </>
      )}
    </Screen>
  );
}
