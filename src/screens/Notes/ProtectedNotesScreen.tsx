import Feather from '@expo/vector-icons/Feather';
import { useIsFocused } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { PreventScreenCapture } from '../../components/PreventScreenCapture';
import { Screen } from '../../components/Screen';
import { useNotesPrivacy } from '../../hooks/useNotesPrivacy';
import type { MainTabParams } from '../../navigation/types';
import { colors, typography } from '../../theme';
import { NotesScreen } from './NotesScreen';

export function ProtectedNotesScreen({
  navigation,
}: BottomTabScreenProps<MainTabParams, 'Notes'>) {
  const { authenticating, error, lock, uid, unlock, unlocked } =
    useNotesPrivacy();
  const isFocused = useIsFocused();
  const [appState, setAppState] = useState(AppState.currentState);
  const promptAttempted = useRef(false);
  const [retainedNotesUid, setRetainedNotesUid] = useState<string | null>(null);
  const canViewNotes = isFocused && appState === 'active' && !!uid && unlocked;
  const shouldRetainNotes = !!uid && retainedNotesUid === uid;

  const promptUnlock = useCallback(
    async (userId: string) => {
      promptAttempted.current = true;
      const didUnlock = await unlock(userId);
      // iOS can resume after Face ID without delivering an `active` event to
      // this screen. Read the current state after authentication so the lock
      // overlay does not remain over notes that were successfully unlocked.
      if (didUnlock && AppState.currentState === 'active')
        setAppState('active');
    },
    [unlock],
  );

  useEffect(() => {
    if (unlocked && uid) setRetainedNotesUid(uid);
  }, [uid, unlocked]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (nextState) => {
      setAppState(nextState);
      if (nextState === 'background') {
        promptAttempted.current = false;
        setRetainedNotesUid(null);
        lock();
      }
    });
    return () => listener.remove();
  }, [lock]);

  useEffect(() => {
    if (!isFocused) {
      promptAttempted.current = false;
      if (authenticating) lock();
      return;
    }
    if (
      appState !== 'active' ||
      !uid ||
      unlocked ||
      authenticating ||
      promptAttempted.current
    )
      return;
    void promptUnlock(uid);
  }, [appState, isFocused, authenticating, lock, promptUnlock, uid, unlocked]);

  const lockScreen = (
    <Screen
      fixedHeader={
        <Text
          accessibilityRole="header"
          style={[typography.title, styles.headerTitle]}
        >
          Ghi chú
        </Text>
      }
      fixedHeaderStyle={styles.header}
      contentStyle={styles.content}
    >
      <View style={styles.lockIcon}>
        <Feather name="lock" size={30} color={colors.earth} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        Ghi chú riêng tư
      </Text>
      <Text style={styles.hint}>
        Xác thực bằng{' '}
        {Platform.OS === 'ios' ? 'Face ID hoặc Touch ID' : 'sinh trắc học'} hoặc
        mật mã thiết bị để xem ghi chú.
      </Text>
      {authenticating ? (
        <ActivityIndicator
          accessibilityLabel="Đang xác thực"
          color={colors.earth}
        />
      ) : (
        <Button
          title="Mở khóa ghi chú"
          onPress={() => {
            if (uid) void promptUnlock(uid);
          }}
        />
      )}
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Button
        title="Về Home"
        variant="secondary"
        onPress={() => navigation.navigate('Home')}
      />
    </Screen>
  );

  if (canViewNotes || shouldRetainNotes) {
    return (
      <View style={styles.protected}>
        <View
          pointerEvents={canViewNotes ? 'auto' : 'none'}
          accessibilityElementsHidden={!canViewNotes}
          importantForAccessibility={
            canViewNotes ? 'auto' : 'no-hide-descendants'
          }
          style={styles.notesLayer}
        >
          {canViewNotes && <PreventScreenCapture id="notes-tab" />}
          <NotesScreen navigation={navigation} suspended={!canViewNotes} />
        </View>
        {!canViewNotes && <View style={styles.lockLayer}>{lockScreen}</View>}
      </View>
    );
  }

  return lockScreen;
}

const styles = StyleSheet.create({
  protected: { flex: 1 },
  notesLayer: { flex: 1 },
  lockLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  header: {
    minHeight: 56,
    paddingHorizontal: 20,
    justifyContent: 'center',
    backgroundColor: colors.sunlightFaint,
  },
  headerTitle: { textAlign: 'center' },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  lockIcon: {
    alignSelf: 'center',
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
  },
  title: { ...typography.heading, textAlign: 'center' },
  hint: { ...typography.body, textAlign: 'center' },
  error: { ...typography.small, color: colors.danger, textAlign: 'center' },
});
