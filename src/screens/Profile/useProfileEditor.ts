import { useEffect, useRef, useState } from 'react';
import { Image } from 'react-native';
import { randomUUID } from 'expo-crypto';
import {
  validAvatarCrop,
  type AvatarCropRect,
  type AvatarCropSource,
} from './avatarCrop';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { useProfile } from '../../hooks/useProfile';
import { useAuthStore } from '../../store/authStore';
import { useProfileStore } from '../../store/profileStore';
import {
  currentSessionUser,
  updateAccountDisplayName,
} from '../../services/firebase/authService';
import { readAvatar, uploadAvatar } from '../../services/profile/avatarService';
import { accountTask } from '../../services/security/accountLifecycle';
import { validateDisplayName } from '../../utils/auth';

export function useProfileEditor() {
  const { user, name: resolvedName } = useProfile();
  const uid = user?.uid;
  const [name, setName] = useState(resolvedName);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState<'pick' | 'crop' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [cropSource, setCropSource] = useState<AvatarCropSource | null>(null);
  const cropTemp = useRef<string | null>(null);
  const operation = useRef({ generation: 0 }).current;
  const download = useRef<ReturnType<
    typeof FileSystem.createDownloadResumable
  > | null>(null);
  const avatarUrl = useProfileStore((state) =>
    state.uid === uid ? state.avatarUrl : null,
  );
  const active = useRef<string | null>(uid ?? null),
    pending = useRef(false),
    temp = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const current = () =>
    active.current === uid &&
    !!uid &&
    useAuthStore.getState().user?.uid === uid;
  const discard = async () => {
    const uri = temp.current;
    temp.current = null;
    if (uri)
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(
        () => undefined,
      );
  };
  const discardCrop = async () => {
    const uri = cropTemp.current;
    cropTemp.current = null;
    if (uri)
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(
        () => undefined,
      );
  };
  const cancelCrop = () => {
    operation.generation++;
    void download.current?.cancelAsync().catch(() => undefined);
    setCropSource(null);
    void discardCrop();
  };
  useEffect(() => {
    active.current = uid ?? null;
    setName(resolvedName);
    setPhoto(undefined);
    setCropSource(null);
    setError(null);
    setSaved(false);
    setBusy(null);
    return () => {
      active.current = null;
      operation.generation++;
      void download.current?.cancelAsync().catch(() => undefined);
      void discardCrop();
      controller.current?.abort();
      void discard();
    };
    // Draft belongs to this UID; incoming profile refresh must not replace edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);
  const beginPhotoOperation = () => {
    const mine = ++operation.generation;
    pending.current = true;
    setError(null);
    setSaved(false);
    return () => current() && operation.generation === mine;
  };
  const pick = async () => {
    if (!uid || pending.current) return;
    const valid = beginPhotoOperation();
    setBusy('pick');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      if (!valid() || result.canceled) return;
      const asset = result.assets[0];
      if (
        !asset?.uri ||
        !Number.isFinite(asset.width) ||
        !Number.isFinite(asset.height) ||
        asset.width < 1 ||
        asset.height < 1
      )
        throw new Error('Chưa lấy được ảnh.');
      if (asset.fileSize && asset.fileSize > 20 * 1024 * 1024)
        throw new Error('Hãy chọn ảnh nhỏ hơn 20 MB.');
      await discardCrop();
      if (valid())
        setCropSource({
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
        });
    } catch (cause) {
      if (valid())
        setError(
          cause instanceof Error ? cause.message : 'Chưa mở được thư viện ảnh.',
        );
    } finally {
      pending.current = false;
      if (current()) setBusy(null);
    }
  };
  const editPhoto = async () => {
    if (!uid || pending.current) return;
    const valid = beginPhotoOperation();
    setBusy('pick');
    let generated: string | null = null;
    try {
      if (photo) {
        if (valid()) setCropSource({ uri: photo, width: 384, height: 384 });
        return;
      }
      await accountTask(uid, async () => {
        const url = await readAvatar(uid); // Fresh owner-only URL; never reuse an expired preview URL.
        if (!valid()) return;
        if (!url)
          throw new Error('Chưa có ảnh đại diện. Hãy chọn ảnh từ thư viện.');
        if (!FileSystem.cacheDirectory)
          throw new Error('Chưa mở được bộ nhớ ảnh tạm.');
        generated = `${FileSystem.cacheDirectory}avatar-edit-${randomUUID()}.jpg`;
        const task = FileSystem.createDownloadResumable(url, generated, {
          sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
        });
        download.current = task;
        let timer: ReturnType<typeof setTimeout>;
        try {
          const response = await Promise.race([
            task.downloadAsync(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                void task.cancelAsync().catch(() => undefined);
                reject(new Error('Tải ảnh quá lâu. Hãy thử lại.'));
              }, 20000);
            }),
          ]);
          if (!valid()) return;
          if (!response || response.status !== 200)
            throw new Error('Chưa tải được ảnh đại diện. Hãy thử lại.');
        } finally {
          clearTimeout(timer!);
          await task.cancelAsync().catch(() => undefined);
          download.current = null;
        }
        const info = await FileSystem.getInfoAsync(generated!);
        if (!valid()) return;
        if (
          !info.exists ||
          info.isDirectory ||
          !info.size ||
          info.size > 524288
        )
          throw new Error(
            'Ảnh đại diện không hợp lệ. Hãy chọn lại ảnh từ thư viện.',
          );
        const size = await Image.getSize(generated!);
        if (!valid()) return;
        if (
          !Number.isFinite(size.width) ||
          !Number.isFinite(size.height) ||
          size.width < 1 ||
          size.height < 1
        )
          throw new Error('Kích thước ảnh không hợp lệ.');
        await discardCrop();
        if (!valid()) return;
        cropTemp.current = generated;
        setCropSource({
          uri: generated!,
          width: size.width,
          height: size.height,
        });
        generated = null;
      });
    } catch (cause) {
      if (valid())
        setError(
          cause instanceof Error ? cause.message : 'Chưa mở được ảnh đại diện.',
        );
    } finally {
      if (generated)
        await FileSystem.deleteAsync(generated, { idempotent: true }).catch(
          () => undefined,
        );
      pending.current = false;
      if (current()) setBusy(null);
    }
  };
  const applyCrop = async (crop: AvatarCropRect) => {
    if (!uid || pending.current || !cropSource) return;
    if (!validAvatarCrop(cropSource, crop)) {
      setError('Vùng cắt ảnh không hợp lệ. Hãy căn lại ảnh.');
      return;
    }
    const valid = beginPhotoOperation();
    setBusy('crop');
    try {
      await accountTask(uid, async () => {
        const context = ImageManipulator.manipulate(cropSource.uri);
        let image: Awaited<ReturnType<typeof context.renderAsync>> | null =
          null;
        let generated: string | null = null;
        try {
          context.crop(crop);
          context.resize({ width: 384, height: 384 });
          image = await context.renderAsync();
          generated = (
            await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 })
          ).uri;
          const info = await FileSystem.getInfoAsync(generated);
          if (
            !info.exists ||
            info.isDirectory ||
            !info.size ||
            info.size > 524288
          )
            throw new Error('Ảnh quá lớn. Hãy chọn ảnh khác.');
          if (!valid()) return;
          await discardCrop();
          if (!valid()) return;
          // Publish the replacement before asynchronous cleanup: cancellation must
          // never leave the preview pointing at a deleted previous draft.
          const previous = temp.current;
          temp.current = generated;
          setPhoto(generated);
          setCropSource(null);
          generated = null;
          if (previous && previous !== temp.current)
            await FileSystem.deleteAsync(previous, { idempotent: true }).catch(
              () => undefined,
            );
        } finally {
          if (generated)
            await FileSystem.deleteAsync(generated, { idempotent: true }).catch(
              () => undefined,
            );
          image?.release();
          context.release();
        }
      });
    } catch (cause) {
      if (valid())
        setError(
          cause instanceof Error
            ? cause.message
            : 'Chưa cắt được ảnh. Hãy thử lại.',
        );
    } finally {
      pending.current = false;
      if (current()) setBusy(null);
    }
  };
  const save = async () => {
    if (!uid || pending.current) return;
    const validation = validateDisplayName(name);
    if (validation) {
      setError(validation);
      return;
    }
    pending.current = true;
    setBusy('save');
    setError(null);
    setSaved(false);
    let nameSaved = false;
    controller.current = new AbortController();
    try {
      if (!current()) return;
      await updateAccountDisplayName(uid, name);
      if (!current()) return;
      const fresh = currentSessionUser(uid);
      if (!fresh) throw new Error('Phiên tài khoản đã thay đổi.');
      useAuthStore.getState().setUser(fresh);
      nameSaved = true;
      if (photo !== undefined) {
        const url = await uploadAvatar(uid, photo, controller.current.signal);
        if (!current()) return;
        useProfileStore.getState().accept(uid, url);
        await discard();
        if (!current()) return;
        setPhoto(undefined);
      }
      if (current()) {
        setName(name.trim());
        setSaved(true);
      }
    } catch (cause) {
      if (current())
        setError(
          `${nameSaved ? 'Tên đã được lưu. Ảnh chưa được xác nhận; hãy thử lưu lại. ' : ''}${cause instanceof Error ? cause.message : 'Chưa lưu được hồ sơ.'}`,
        );
    } finally {
      pending.current = false;
      if (current()) setBusy(null);
      else if (uid && useAuthStore.getState().user?.uid === uid)
        void useProfileStore.getState().load(uid, true);
    }
  };
  return {
    user,
    name,
    setName: (value: string) => {
      setName(value);
      setSaved(false);
    },
    photo,
    busy,
    error,
    saved,
    cropSource,
    canEditPhoto: !!photo || !!avatarUrl,
    editPhoto,
    cancelCrop,
    applyCrop,
    pick,
    save,
  };
}
