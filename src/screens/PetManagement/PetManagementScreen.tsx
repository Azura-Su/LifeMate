import Feather from '@expo/vector-icons/Feather';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useRef, useState } from 'react';
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
} from '../../services/pixelPet/pixelPetApi';
import { pixelPetSpecies } from '../../services/pixelPet/pixelPetCatalog';
import { useAuthStore } from '../../store/authStore';
import { colors, typography } from '../../theme';
import { PET_ART } from '../PixelPet/petArt';
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
const FILTERS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'owned', label: 'Có chủ' },
  { value: 'reserved', label: 'Giữ chỗ' },
  { value: 'available', label: 'Còn trống' },
];
const initial = (name: string) => [...name.trim()][0]?.toUpperCase() ?? '?';

export function PetManagementScreen({
  navigation,
}: BottomTabScreenProps<MainTabParams, 'PetManagement'>) {
  const user = useAuthStore((state) => state.user);
  const epoch = useAuthStore((state) => state.sessionEpoch);
  const allowed = isUserAdmin(user);
  const active = useScreenActive();
  const [pets, setPets] = useState<ManagedPet[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const request = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;

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
  return (
    <Screen
      contentStyle={styles.content}
      refreshControl={
        allowed ? (
          <RefreshControl
            refreshing={busy && !selected}
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
              {FILTERS.map(({ value, label }) => (
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
                    {label} {counts[value]}
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
          {!!pets.length && (
            <View style={styles.tiles}>
              {(['owned', 'reserved', 'available'] as const).map((status) => (
                <View
                  key={status}
                  style={[styles.tile, styles[`${STATUS[status].tone}Soft`]]}
                >
                  <Text style={[styles.tileCount, styles[STATUS[status].tone]]}>
                    {counts[status]}
                  </Text>
                  <Text style={styles.tileLabel}>{STATUS[status].label}</Text>
                </View>
              ))}
            </View>
          )}
          {filtered.map((pet) => {
            const species = pixelPetSpecies(pet.speciesId)!;
            const art = PET_ART[pet.speciesId];
            const status = STATUS[pet.status];
            return (
              <View
                key={pet.speciesId}
                style={[
                  styles.card,
                  pet.status === 'available' && styles.cardFree,
                ]}
              >
                <View
                  style={[
                    styles.accent,
                    { backgroundColor: species.palette[0] },
                  ]}
                />
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
                    <Text accessibilityRole="header" style={styles.name}>
                      {species.name}
                    </Text>
                    <Text style={styles.trait}>
                      {species.personality} · {species.skill}
                    </Text>
                    <View style={[styles.badge, styles[`${status.tone}Soft`]]}>
                      <Feather
                        name={status.icon}
                        size={12}
                        color={
                          pet.status === 'owned'
                            ? colors.success
                            : pet.status === 'reserved'
                              ? colors.sunlight
                              : colors.sky
                        }
                      />
                      <Text style={[styles.badgeText, styles[status.tone]]}>
                        {status.label}
                      </Text>
                    </View>
                  </View>
                  {pet.adoption && (
                    <View style={styles.levelBox}>
                      <Text style={styles.levelNumber}>
                        {pet.adoption.level}
                      </Text>
                      <Text style={styles.levelLabel}>CẤP</Text>
                    </View>
                  )}
                </View>
                {pet.holder && (
                  <View style={styles.owner}>
                    <View style={styles.ownerRow}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {initial(pet.holder.name || pet.holder.email || '?')}
                        </Text>
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.ownerName}>
                          {pet.holder.name || 'Chưa đặt tên'}
                        </Text>
                        {!!pet.holder.email && (
                          <Text selectable style={typography.small}>
                            {pet.holder.email}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text selectable style={styles.uid}>
                      UID: {pet.holder.uid}
                    </Text>
                    {pet.adoption ? (
                      <View style={styles.facts}>
                        <Text style={styles.fact}>
                          {stageLabel[pet.adoption.stage]}
                        </Text>
                        <Text style={styles.fact}>
                          Cấp {pet.adoption.level} · {pet.adoption.totalExp} EXP
                        </Text>
                        <Text style={styles.fact}>
                          Nhận nuôi{' '}
                          {new Date(pet.adoption.adoptedAt).toLocaleDateString(
                            'vi-VN',
                          )}
                        </Text>
                      </View>
                    ) : (
                      <Text style={typography.small}>
                        Giữ đến{' '}
                        {new Date(pet.reservedUntil!).toLocaleTimeString(
                          'vi-VN',
                        )}
                      </Text>
                    )}
                  </View>
                )}
                {pet.status === 'owned' && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Thu hồi ${species.name}`}
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
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
                    <Text style={styles.revokeText}>Thu hồi linh thú</Text>
                  </Pressable>
                )}
              </View>
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
