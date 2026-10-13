import Feather from '@expo/vector-icons/Feather';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { AppTextInput } from '../../components/AppTextInput';
import { Button } from '../../components/Button';
import { DialogCloseButton } from '../../components/DialogCloseButton';
import { DialogModal } from '../../components/DialogModal';
import { memoryPhotoUri } from '../../services/memories/memoryStorage';
import { colors } from '../../theme';
import type { MemoryDraft, MemoryEntry } from '../../types/memory';
import { parseDateKey, toDateKey } from '../../utils/vietnameseCalendar';
import type { CapturedMemoryPhoto } from './MemoryCapture';
import { styles } from './MemoryScreen.styles';

type Props = {
  visible: boolean;
  uid: string;
  entry: MemoryEntry | null;
  initialPhoto?: CapturedMemoryPhoto | null;
  busy: boolean;
  onClose: () => void;
  onSave: (draft: MemoryDraft) => Promise<void>;
};

const formatDate = (key: string) => {
  const date = parseDateKey(key);
  return date ? date.toLocaleDateString('vi-VN') : key;
};

export function MemoryEditor({
  visible,
  uid,
  entry,
  initialPhoto,
  busy,
  onClose,
  onSave,
}: Props) {
  const [dateKey, setDateKey] = useState(() => toDateKey(new Date()));
  const [text, setText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState<string | null>(null);
  const [photoChange, setPhotoChange] =
    useState<MemoryDraft['photoChange']>('keep');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDateKey(entry?.dateKey ?? toDateKey(new Date()));
    setText(entry?.text ?? '');
    setPhotoUri(
      entry
        ? memoryPhotoUri(uid, entry.photoFileName)
        : (initialPhoto?.uri ?? null),
    );
    setPhotoMimeType(entry ? null : (initialPhoto?.mimeType ?? null));
    setPhotoChange(entry ? 'keep' : initialPhoto ? 'replace' : 'keep');
    setPickerOpen(false);
    setError(null);
  }, [visible, entry, initialPhoto, uid]);

  const selectedDate = parseDateKey(dateKey) ?? new Date();

  function openDatePicker() {
    Keyboard.dismiss();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selectedDate,
        mode: 'date',
        maximumDate: new Date(),
        onChange: (event, date) => {
          if (event.type === 'set' && date) setDateKey(toDateKey(date));
        },
      });
    } else setPickerOpen(true);
  }

  async function pick(source: 'camera' | 'library') {
    if (picking || busy) return;
    setPicking(true);
    setError(null);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('Cho phép dùng máy ảnh trong Cài đặt để chụp khoảnh khắc.');
          return;
        }
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.8,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsMultipleSelection: false,
              quality: 0.8,
            });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) throw new Error('Chưa lấy được ảnh. Hãy thử lại.');
      if (asset.fileSize && asset.fileSize > 15 * 1024 * 1024)
        throw new Error('Ảnh cần nhỏ hơn 15 MB. Hãy chọn ảnh khác.');
      setPhotoUri(asset.uri);
      setPhotoMimeType(asset.mimeType ?? null);
      setPhotoChange('replace');
    } catch (cause) {
      setError((cause as Error).message || 'Chưa mở được ảnh.');
    } finally {
      setPicking(false);
    }
  }

  async function submit() {
    if (busy || picking) return;
    if (!text.trim() && !photoUri) {
      setError('Thêm ảnh hoặc viết vài dòng để lưu.');
      return;
    }
    setError(null);
    try {
      await onSave({ dateKey, text, photoUri, photoMimeType, photoChange });
      onClose();
    } catch (cause) {
      setError((cause as Error).message || 'Chưa lưu được ký ức.');
    }
  }

  return (
    <DialogModal
      visible={visible}
      onRequestClose={
        busy || picking
          ? undefined
          : pickerOpen
            ? () => setPickerOpen(false)
            : onClose
      }
      style={styles.editorDialog}
    >
      {pickerOpen && Platform.OS === 'ios' ? (
        <View style={styles.editorBody}>
          <View style={styles.editorHeader}>
            <Text style={styles.editorTitle}>Chọn ngày</Text>
            <DialogCloseButton
              accessibilityLabel="Đóng bộ chọn ngày"
              onPress={() => setPickerOpen(false)}
            />
          </View>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="inline"
            maximumDate={new Date()}
            themeVariant="light"
            accentColor={colors.earth}
            onChange={(event, date) => {
              if (event.type === 'set' && date) setDateKey(toDateKey(date));
            }}
          />
          <Button title="Xong" onPress={() => setPickerOpen(false)} compact />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.editorBody}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.editorHeader}>
            <View style={styles.editorHeading}>
              <Text accessibilityRole="header" style={styles.editorTitle}>
                {entry ? 'Sửa ký ức' : 'Khoảnh khắc mới'}
              </Text>
              <Text style={styles.editorSubheading}>
                Ghi lại điều bạn muốn nhớ.
              </Text>
            </View>
            <DialogCloseButton
              accessibilityLabel="Đóng khoảnh khắc"
              onPress={onClose}
              disabled={busy || picking}
            />
          </View>
          <Text style={styles.fieldLabel}>Ảnh khoảnh khắc</Text>
          {photoUri ? (
            <View style={styles.photoPreviewWrap}>
              <Image
                source={{ uri: photoUri }}
                style={styles.photoPreview}
                accessibilityLabel="Ảnh khoảnh khắc đã chọn"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bỏ ảnh"
                disabled={busy || picking}
                onPress={() => {
                  setPhotoUri(null);
                  setPhotoMimeType(null);
                  setPhotoChange('remove');
                }}
                style={styles.removePhoto}
              >
                <Feather name="x" size={18} color={colors.ink} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Feather name="image" size={25} color={colors.sky} />
              <Text style={styles.photoPlaceholderText}>
                Thêm một bức ảnh cho ngày này
              </Text>
            </View>
          )}
          <View style={styles.photoActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chụp ảnh"
              disabled={busy || picking}
              onPress={() => void pick('camera')}
              style={styles.photoAction}
            >
              <Feather name="camera" size={17} color={colors.earth} />
              <Text style={styles.photoActionText}>Chụp ảnh</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chọn ảnh từ thư viện"
              disabled={busy || picking}
              onPress={() => void pick('library')}
              style={styles.photoAction}
            >
              <Feather name="image" size={17} color={colors.earth} />
              <Text style={styles.photoActionText}>Thư viện</Text>
            </Pressable>
          </View>
          <Text style={styles.fieldLabel}>Ngày của ký ức</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Chọn ngày ký ức, ${formatDate(dateKey)}`}
            disabled={busy || picking}
            onPress={openDatePicker}
            style={styles.dateButton}
          >
            <Feather name="calendar" size={17} color={colors.earth} />
            <Text style={styles.dateButtonText}>{formatDate(dateKey)}</Text>
            <Feather name="chevron-down" size={16} color={colors.muted} />
          </Pressable>
          <View style={styles.textLabelRow}>
            <Text style={styles.fieldLabel}>Nội dung</Text>
            <Text style={styles.counter}>{text.length}/2000</Text>
          </View>
          <AppTextInput
            accessibilityLabel="Nội dung ký ức"
            placeholder="Hôm nay có điều gì đáng nhớ?"
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            editable={!busy && !picking}
            maxLength={2000}
            multiline
            textAlignVertical="top"
            style={styles.textInput}
          />
          {!!error && (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {error}
            </Text>
          )}
          <Button
            title={entry ? 'Lưu thay đổi' : 'Lưu khoảnh khắc'}
            onPress={() => void submit()}
            loading={busy}
            disabled={picking}
          />
          <Text style={styles.editorFootnote}>
            Lưu riêng theo tài khoản trên thiết bị này.
          </Text>
        </ScrollView>
      )}
    </DialogModal>
  );
}
