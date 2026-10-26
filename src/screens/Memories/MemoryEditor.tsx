import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { useContext, useEffect, useRef, useState } from 'react';
import { Image, Keyboard, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
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

function dimensionsRatio(width?: number, height?: number) {
  return typeof width === 'number' &&
    typeof height === 'number' &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0 &&
    Number.isFinite(width / height)
    ? width / height
    : null;
}

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
  const insets = useContext(SafeAreaInsetsContext);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
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
  const knownPhoto = useRef<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);
  const editingVisibility = useRef(initialVisibility);
  const choosingVisibility = !entry && visibilityOpen;

  useEffect(() => {
    if (!visible) {
      setKeyboardVisible(false);
      return;
    }
    setKeyboardVisible(Keyboard.isVisible());
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      initializedFor.current = null;
      return;
    }
    const key = `${uid}:${entry?.id ?? 'new'}:${initialPhoto?.uri ?? ''}`;
    if (initializedFor.current === key) return;
    initializedFor.current = key;
    setText(entry?.text ?? '');
    editingVisibility.current = initialVisibility;
    setVisibility(initialVisibility);
    setVisibilityOpen(false);
    setPhotoUri(
      entry
        ? memoryPhotoUri(uid, entry.photoFileName)
        : (initialPhoto?.uri ?? null),
    );
    const ratio = dimensionsRatio(initialPhoto?.width, initialPhoto?.height);
    knownPhoto.current =
      ratio !== null && initialPhoto
        ? {
            uri: initialPhoto.uri,
            width: initialPhoto.width!,
            height: initialPhoto.height!,
          }
        : null;
    setPhotoAspectRatio(
      ratio ??
        (initialPhoto &&
        Number.isFinite(initialPhoto.aspectRatio) &&
        initialPhoto.aspectRatio > 0
          ? initialPhoto.aspectRatio
          : 3 / 4),
    );
    setPhotoMimeType(entry ? null : (initialPhoto?.mimeType ?? null));
    setPhotoChange(entry ? 'keep' : initialPhoto ? 'replace' : 'keep');
    setError(null);
  }, [visible, entry, initialPhoto, initialVisibility, uid]);

  useEffect(() => {
    if (entry || !visible || !photoUri || knownPhoto.current?.uri === photoUri)
      return;
    let current = true;
    Image.getSize(
      photoUri,
      (width, height) => {
        const ratio = dimensionsRatio(width, height);
        if (current && ratio !== null) {
          knownPhoto.current = { uri: photoUri, width, height };
          setPhotoAspectRatio(ratio);
        }
      },
      () => {
        // Keep the ratio provided by the camera when metadata cannot be read.
      },
    );
    return () => {
      current = false;
    };
  }, [entry, visible, photoUri]);

  const photoHeight = Math.min(
    440,
    Math.max(240, photoWidth / photoAspectRatio),
  );

  async function takePhoto() {
    if (entry || picking || busy) return;
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
      const ratio = dimensionsRatio(asset.width, asset.height);
      knownPhoto.current =
        ratio !== null
          ? { uri: asset.uri, width: asset.width, height: asset.height }
          : null;
      setPhotoAspectRatio(ratio ?? 3 / 4);
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
    if (!entry && !photoUri) {
      setError('Hãy chụp ảnh trước khi lưu ký ức.');
      return;
    }
    setError(null);
    const dimensions =
      !entry && knownPhoto.current?.uri === photoUri
        ? { width: knownPhoto.current.width, height: knownPhoto.current.height }
        : undefined;
    try {
      await onSave({
        dateKey: entry?.dateKey ?? toDateKey(new Date()),
        text,
        photoUri: entry ? memoryPhotoUri(uid, entry.photoFileName) : photoUri,
        photoMimeType: entry ? null : photoMimeType,
        ...(dimensions && { photoDimensions: dimensions }),
        photoChange: entry ? 'keep' : photoChange,
        visibility: entry ? editingVisibility.current : visibility,
      });
      onClose();
    } catch (cause) {
      setError((cause as Error).message || 'Chưa lưu được ký ức.');
    }
  }

  return (
    <DialogModal
      visible={visible}
      onTouchEnd={Keyboard.dismiss}
      overlayStyle={[
        { paddingTop: Math.max(insets?.top ?? 0, 24) + 8 },
        keyboardVisible && styles.editorKeyboardOverlay,
      ]}
      onRequestClose={
        busy || picking
          ? undefined
          : choosingVisibility
            ? () => setVisibilityOpen(false)
            : onClose
      }
      style={styles.editorDialog}
    >
      <View
        style={styles.editorHeader}
        accessibilityElementsHidden={choosingVisibility}
        importantForAccessibility={
          choosingVisibility ? 'no-hide-descendants' : 'auto'
        }
      >
        <View style={styles.editorHeading}>
          <Text accessibilityRole="header" style={styles.editorTitle}>
            {entry ? 'Sửa nội dung' : 'Khoảnh khắc mới'}
          </Text>
        </View>
        <DialogCloseButton
          accessibilityLabel="Đóng khoảnh khắc"
          onPress={onClose}
          disabled={busy || picking}
        />
      </View>
      {!entry && (
        <View
          style={styles.editorPhotoBody}
          accessibilityElementsHidden={choosingVisibility}
          importantForAccessibility={
            choosingVisibility ? 'no-hide-descendants' : 'auto'
          }
        >
          {photoUri ? (
            <View
              style={styles.photoPreviewWrap}
              onLayout={(event) =>
                setPhotoWidth(event.nativeEvent.layout.width)
              }
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
                accessibilityState={{
                  disabled: busy || picking,
                  busy: picking,
                }}
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
        </View>
      )}
      <View
        style={styles.editorFooter}
        accessibilityElementsHidden={choosingVisibility}
        importantForAccessibility={
          choosingVisibility ? 'no-hide-descendants' : 'auto'
        }
      >
        {!entry && (
          <View style={styles.visibilitySection}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ai có thể xem? ${visibility === 'private' ? 'Chỉ mình tôi' : 'Bạn bè'}`}
              accessibilityHint="Mở danh sách chọn quyền xem ký ức"
              accessibilityState={{ expanded: visibilityOpen }}
              disabled={busy || picking}
              onPress={() => {
                Keyboard.dismiss();
                setVisibilityOpen(true);
              }}
              hitSlop={8}
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
          </View>
        )}
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
          onTouchEnd={(event) => event.stopPropagation()}
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
      </View>
      {choosingVisibility && (
        <View style={styles.visibilityOverlay} accessibilityViewIsModal>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng chọn quyền xem"
            disabled={busy || picking}
            onPress={() => setVisibilityOpen(false)}
            style={styles.visibilityBackdrop}
          />
          <View style={styles.visibilityPopup}>
            <View style={styles.visibilityPopupHeader}>
              <View style={styles.visibilityPopupHeading}>
                <Text
                  accessibilityRole="header"
                  style={styles.visibilityPopupTitle}
                >
                  Ai có thể xem?
                </Text>
                <Text style={styles.visibilityPopupSubtitle}>
                  Chọn người được xem khoảnh khắc này.
                </Text>
              </View>
              <DialogCloseButton
                accessibilityLabel="Đóng chọn quyền xem"
                onPress={() => setVisibilityOpen(false)}
                disabled={busy || picking}
              />
            </View>
            <View style={styles.visibilityPopupOptions}>
              {(
                [
                  [
                    'private',
                    'lock',
                    'Chỉ mình tôi',
                    'Chỉ bạn xem, đồng bộ theo tài khoản',
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
                  accessibilityState={{
                    selected: visibility === value,
                    disabled: busy || picking,
                  }}
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
                  <Feather name={icon} size={17} color={colors.earth} />
                  <View style={styles.visibilityOptionCopy}>
                    <Text style={styles.visibilityOptionText}>{label}</Text>
                    <Text style={styles.visibilityOptionDescription}>
                      {description}
                    </Text>
                  </View>
                  {visibility === value && (
                    <Feather name="check" size={17} color={colors.success} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}
    </DialogModal>
  );
}
