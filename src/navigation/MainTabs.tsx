import Feather from '@expo/vector-icons/Feather';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useEffect, useRef } from 'react';
import { HomeScreen } from '../screens/Home/HomeScreen';
import { ProtectedFinanceScreen } from '../screens/Finance/ProtectedFinanceScreen';
import { AppState } from 'react-native';
import { useFinancePrivacy } from '../hooks/useFinancePrivacy';
import { Mp3Screen } from '../screens/Mp3/Mp3Screen';
import { NotesScreen } from '../screens/Notes/NotesScreen';
import { AgendaScreen } from '../screens/Agenda/AgendaScreen';
import { colors } from '../theme';
import type { MainTabParams } from './types';

const Tab = createBottomTabNavigator<MainTabParams>();
const icons = {
  Home: 'home',
  Finance: 'pie-chart',
  MP3: 'headphones',
  Notes: 'edit-3',
  Agenda: 'calendar',
} as const;

export function MainTabs() {
  const privacy = useFinancePrivacy();
  const { lock, setAppActive } = privacy;
  const {
    appActive,
    authenticating,
    enabled,
    lockVersion,
    ready,
    uid,
    unlock,
    unlocked,
  } = privacy;
  const autoUnlockVersion = useRef<number | null>(null);
  useEffect(() => {
    setAppActive(
      AppState.currentState !== 'background' &&
        AppState.currentState !== 'inactive',
    );
    const listener = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
      // The biometric prompt itself can make iOS inactive. Only a real
      // background transition invalidates an in-flight authentication.
      if (state === 'background') lock();
    });
    return () => {
      listener.remove();
      lock();
    };
  }, [lock, setAppActive]);

  useEffect(() => {
    if (
      !ready ||
      !enabled ||
      !uid ||
      !appActive ||
      unlocked ||
      authenticating ||
      autoUnlockVersion.current === lockVersion
    )
      return;

    // One prompt per launch/background return. The Face ID sheet can emit
    // inactive itself; that transition does not increment lockVersion.
    autoUnlockVersion.current = lockVersion;
    void unlock(uid);
  }, [
    appActive,
    authenticating,
    enabled,
    lockVersion,
    ready,
    uid,
    unlock,
    unlocked,
  ]);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.earth,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.line,
          justifyContent: 'space-around',
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarItemStyle: { flex: 1 },
        tabBarIcon: ({ color, size }) => (
          <Feather name={icons[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Finance"
        component={ProtectedFinanceScreen}
        options={{ tabBarLabel: 'Tài chính' }}
      />
      <Tab.Screen name="MP3" component={Mp3Screen} />
      <Tab.Screen
        name="Notes"
        component={NotesScreen}
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="Agenda"
        component={AgendaScreen}
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
    </Tab.Navigator>
  );
}
