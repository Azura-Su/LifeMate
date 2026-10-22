import Feather from '@expo/vector-icons/Feather';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppTextInput as TextInput } from '../../components/AppTextInput';
import { colors } from '../../theme';

export const NOTE_BULLET_MIN_HEIGHT = 96;
export const NOTE_BULLET_MAX_HEIGHT = 280;
const NOTE_BULLET_ROW_GAP = 8;
const NOTE_BULLET_VISIBLE_ROWS = 4;
const NOTE_BULLET_LIST_MAX_HEIGHT =
  NOTE_BULLET_VISIBLE_ROWS * NOTE_BULLET_MIN_HEIGHT +
  (NOTE_BULLET_VISIBLE_ROWS - 1) * NOTE_BULLET_ROW_GAP;

const clampBulletHeight = (height: number) =>
  Math.max(NOTE_BULLET_MIN_HEIGHT, Math.min(NOTE_BULLET_MAX_HEIGHT, height));

export type NoteBulletItem = {
  id: string;
  text: string;
  height: number;
};

type Props = {
  items: NoteBulletItem[];
  disabled?: boolean;
  onAdd: () => void;
  onChange: (id: string, text: string) => void;
  onResize: (id: string, height: number) => void;
  onRemove: (id: string) => void;
};

export function NoteBulletListEditor({
  items,
  disabled = false,
  onAdd,
  onChange,
  onResize,
  onRemove,
}: Props) {
  const listRef = useRef<ScrollView>(null);
  const scrollToNewBulletRef = useRef(false);

  function addBullet() {
    scrollToNewBulletRef.current = true;
    onAdd();
  }

  return (
    <View style={styles.editor}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Các ý</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thêm gạch đầu dòng"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={addBullet}
          style={[styles.add, disabled && styles.disabled]}
        >
          <Feather name="plus" size={15} color={colors.earth} />
          <Text style={styles.addText}>Thêm ý</Text>
        </Pressable>
      </View>
      <ScrollView
        ref={listRef}
        style={[styles.list, { maxHeight: NOTE_BULLET_LIST_MAX_HEIGHT }]}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => {
          if (!scrollToNewBulletRef.current) return;
          scrollToNewBulletRef.current = false;
          requestAnimationFrame(() =>
            listRef.current?.scrollToEnd({ animated: true }),
          );
        }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {items.map((item, index) => (
          <NoteBulletRow
            key={item.id}
            item={item}
            index={index}
            disabled={disabled}
            canRemove={items.length > 1}
            onChange={onChange}
            onResize={onResize}
            onRemove={onRemove}
          />
        ))}
      </ScrollView>
    </View>
  );
}

type RowProps = {
  item: NoteBulletItem;
  index: number;
  disabled: boolean;
  canRemove: boolean;
  onChange: Props['onChange'];
  onResize: Props['onResize'];
  onRemove: Props['onRemove'];
};

function NoteBulletRow({
  item,
  index,
  disabled,
  canRemove,
  onChange,
  onResize,
  onRemove,
}: RowProps) {
  // While dragging, only this row re-renders; the form is told on release.
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const inputHeight = dragHeight ?? clampBulletHeight(item.height);
  const heightRef = useRef(inputHeight);
  const startHeightRef = useRef(inputHeight);
  const resizeRef = useRef(onResize);

  useEffect(() => {
    heightRef.current = inputHeight;
    resizeRef.current = onResize;
  }, [inputHeight, onResize]);

  const panResponder = useMemo(() => {
    const commitDrag = () => {
      if (heightRef.current !== startHeightRef.current) {
        resizeRef.current(item.id, heightRef.current);
      }
      setDragHeight(null);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: (_event, gesture) =>
        !disabled && Math.abs(gesture.dy) > 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startHeightRef.current = heightRef.current;
      },
      onPanResponderMove: (_event, gesture) => {
        const height = Math.round(
          clampBulletHeight(startHeightRef.current + gesture.dy),
        );
        heightRef.current = height;
        setDragHeight(height);
      },
      onPanResponderRelease: () => commitDrag(),
      onPanResponderTerminate: () => commitDrag(),
    });
  }, [disabled, item.id]);

  function adjustHeight(delta: number) {
    if (disabled) return;
    onResize(item.id, clampBulletHeight(inputHeight + delta));
  }

  return (
    <View style={styles.row}>
      <Text style={styles.bullet}>•</Text>
      <View style={[styles.inputFrame, { height: inputHeight }]}>
        <TextInput
          accessibilityLabel={`Ý thứ ${index + 1}`}
          placeholder={index === 0 ? 'Nhập ý đầu tiên' : 'Nhập ý tiếp theo'}
          placeholderTextColor={colors.muted}
          value={item.text}
          onChangeText={(text) => onChange(item.id, text)}
          editable={!disabled}
          multiline
          maxLength={20000}
          textAlignVertical="top"
          style={styles.input}
        />
        {canRemove && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Xóa ý ${index + 1}`}
            accessibilityState={{ disabled }}
            hitSlop={8}
            disabled={disabled}
            onPress={() => onRemove(item.id)}
            style={[styles.remove, disabled && styles.disabled]}
          >
            <Feather name="x" size={16} color={colors.danger} />
          </Pressable>
        )}
        <View
          {...panResponder.panHandlers}
          hitSlop={6}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Chiều cao ô nhập ý ${index + 1}`}
          accessibilityHint="Giữ và kéo xuống để tăng chiều cao. Có thể kéo lên để thu nhỏ."
          accessibilityValue={{
            min: NOTE_BULLET_MIN_HEIGHT,
            max: NOTE_BULLET_MAX_HEIGHT,
            now: inputHeight,
          }}
          accessibilityActions={[
            { name: 'increment', label: 'Tăng chiều cao' },
            { name: 'decrement', label: 'Giảm chiều cao' },
          ]}
          onAccessibilityAction={({ nativeEvent }) =>
            adjustHeight(nativeEvent.actionName === 'increment' ? 24 : -24)
          }
          style={styles.resizeHandle}
        >
          <Feather name="maximize-2" size={16} color={colors.muted} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: 8 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  list: { flexGrow: 0 },
  listContent: { gap: NOTE_BULLET_ROW_GAP },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  bullet: {
    width: 12,
    marginTop: 12,
    color: colors.earth,
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
  },
  inputFrame: {
    flex: 1,
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingRight: 38,
    paddingBottom: 8,
    color: colors.ink,
    backgroundColor: 'transparent',
  },
  resizeHandle: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 8,
    borderBottomRightRadius: 10,
    backgroundColor: colors.sunlightFaint,
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 1,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  add: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.skySoft,
  },
  addText: { color: colors.earth, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
