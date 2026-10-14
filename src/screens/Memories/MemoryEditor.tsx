import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { AppTextInput } from '../../components/AppTextInput';
import { Button } from '../../components/Button';
import { DialogCloseButton } from '../../components/DialogCloseButton';
import { DialogModal } from '../../components/DialogModal';
import { memoryPhotoUri } from '../../services/memories/memoryStorage';
import { colors } from '../../theme';
import type { MemoryDraft, MemoryEntry } from '../../types/memory';
import { toDateKey } from '../../utils/vietnameseCalendar';
import type { CapturedMemoryPhoto } from './MemoryCapture';
import { styles } from './MemoryScreen.styles';

type Props = {
  visible: boolean;
  uid: string;
  entry: MemoryEntry | null;
  initialVisibility: 'private' | 'friends';
  initialPhoto?: CapturedMemoryPhoto | null;
  busy: boolean;
  onClose: () => void;
  onSave: (draft: MemoryDraft) => Promise<void>;
};

export function MemoryEditor({
  visible,
  uid,
  entry,
  initialVisibility,
  initialPhoto,
  busy,
  onClose,
  onSave,
}: Props) {
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'friends'>(
    'private',
  );
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoAspectRatio, setPhotoAspectRatio] = useState(3 / 4);
  const [photoWidth, setPhotoWidth] = useState(280);
  const [photoMimeType, setPhotoMimeType] = useState<string | null>(null);
  const [photoChange, setPhotoChange] =
    useState<MemoryDraft['photoChange']>('keep');
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) {
      initializedFor.current = null;
      return;
    }
    const key = `${uid}:${entry?.id ?? 'new'}:${initialPhoto?.uri ?? ''}`;
    if (initializedFor.current === key) return;
    initializedFor.current = key;
    setText(entry?.text ?? '');
    setVisibility(initialVisibility);
    setVisibilityOpen(false);
    setPhotoUri(
      entry
        ? memoryPhotoUri(uid, entry.photoFileName)
        : (initialPhoto?.uri ?? null),
    );
    setPhotoAspectRatio(initialPhoto?.aspectRatio ?? 3 / 4);
    setPhotoMimeType(entry ? null : (initialPhoto?.mimeType ?? null));
    setPhotoChange(entry ? 'keep' : initialPhoto ? 'replace' : 'keep');
    setError(null);
  }, [visible, entry, initialPhoto, initialVisibility, uid]);

  useEffect(() => {
    if (!visible || !photoUri) return;
    let current = true;
    Image.getSize(
      photoUri,
      (width, height) => {
        if (current && width > 0 && height > 0)
          setPhotoAspectRatio(width / height);
      },
      () => {
        // Keep the ratio provided by the camera when metadata cannot be read.
      },
    );
    return () => {
      current = false;
    };
  }, [visible, photoUri]);

  const photoHeight = Math.min(
    440,
    Math.max(240, photoWidth / photoAspectRatio),
  );

  async function takePhoto() {
    if (picking || busy) return;
    setPicking(true);
    setError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Cho phép dùng máy ảnh trong Cài đặt để chụp khoảnh khắc.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) throw new Error('Chưa lấy được ảnh. Hãy thử lại.');
      if (asset.fileSize && asset.fileSize > 15 * 1024 * 1024)
        throw new Error('Ảnh cần nhỏ hơn 15 MB. Hãy chọn ảnh khác.');
      setPhotoUri(asset.uri);
      setPhotoAspectRatio(
        asset.width > 0 && asset.height > 0
          ? asset.width / asset.height
          : 3 / 4,
      );
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
    if (!photoUri) {
      setError('Hãy chụp ảnh trước khi lưu ký ức.');
      return;
    }
    setError(null);
    try {
      await onSave({
        dateKey: entry?.dateKey ?? toDateKey(new Date()),
        text,
        photoUri,
        photoMimeType,
        photoChange,
        visibility,
      });
      onClose();
    } catch (cause) {
      setError((cause as Error).message || 'Chưa lưu được ký ức.');
    }
  }

  return (
    <DialogModal
      visible={visible}
      onRequestClose={busy || picking ? undefined : onClose}
      style={styles.editorDialog}
    >
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
          <View
            style={styles.photoPreviewWrap}
            onLayout={(event) => setPhotoWidth(event.nativeEvent.layout.width)}
          >
            <Image
              source={{ uri: photoUri }}
              style={[styles.photoPreview, { height: photoHeight }]}
              resizeMode="contain"
              accessibilityLabel="Ảnh khoảnh khắc đã chọn"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chụp lại ảnh"
              accessibilityState={{ disabled: busy || picking, busy: picking }}
              disabled={busy || picking}
              onPress={() => void takePhoto()}
              style={styles.photoRetake}
            >
              <Feather name="camera" size={19} color={colors.ink} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Feather name="image" size={25} color={colors.sky} />
            <Text style={styles.photoPlaceholderText}>
              Chụp ảnh để thêm vào ký ức
            </Text>
          </View>
        )}
        {!photoUri && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chụp ảnh"
            disabled={busy || picking}
            onPress={() => void takePhoto()}
            style={styles.photoAction}
          >
            <Feather name="camera" size={17} color={colors.earth} />
            <Text style={styles.photoActionText}>Chụp ảnh</Text>
          </Pressable>
        )}
        <View style={styles.visibilitySection}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ai có thể xem? ${visibility === 'private' ? 'Chỉ mình tôi' : 'Bạn bè'}`}
            accessibilityHint="Mở danh sách chọn quyền xem ký ức"
            accessibilityState={{ expanded: visibilityOpen }}
            disabled={busy || picking}
            onPress={() => setVisibilityOpen((open) => !open)}
            style={styles.visibilityDropdown}
          >
            <View style={styles.visibilitySelected}>
              <Feather
                name={visibility === 'private' ? 'lock' : 'users'}
                size={14}
                color={colors.earth}
              />
              <Text style={styles.visibilitySelectedText}>
                {visibility === 'private' ? 'Chỉ mình tôi' : 'Bạn bè'}
              </Text>
              <Feather
                name={visibilityOpen ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.muted}
              />
            </View>
          </Pressable>
          {visibilityOpen && (
            <View style={styles.visibilityMenu}>
              {(
                [
                  [
                    'private',
                    'lock',
                    'Chỉ mình tôi',
                    'Chỉ lưu trên thiết bị này',
                  ],
                  [
                    'friends',
                    'users',
                    'Bạn bè',
                    'Bạn bè hiện tại và sau này có thể xem',
                  ],
                ] as const
              ).map(([value, icon, label, description], index) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={`Chọn ${label}. ${description}`}
                  accessibilityState={{ selected: visibility === value }}
                  disabled={busy || picking}
                  onPress={() => {
                    setVisibility(value);
                    setVisibilityOpen(false);
                  }}
                  style={[
                    styles.visibilityOption,
                    index > 0 && styles.visibilityOptionDivider,
                  ]}
                >
                  <Feather name={icon} size={15} color={colors.earth} />
                  <View style={styles.visibilityOptionCopy}>
                    <Text style={styles.visibilityOptionText}>{label}</Text>
                    <Text style={styles.visibilityOptionDescription}>
                      {description}
                    </Text>
                  </View>
                  {visibility === value && (
                    <Feather name="check" size={15} color={colors.success} />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>
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
      </ScrollView>
    </DialogModal>
  );
}
