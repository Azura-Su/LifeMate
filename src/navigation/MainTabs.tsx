import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from '../screens/Home/HomeScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { ProtectedFinanceScreen } from '../screens/Finance/ProtectedFinanceScreen';
import { AppState, Platform, StyleSheet } from 'react-native';
import { useFinancePrivacy } from '../hooks/useFinancePrivacy';
import { useNotesLockStore } from '../store/notesLockStore';
import { Mp3Screen } from '../screens/Mp3/Mp3Screen';
import { MemoryScreen } from '../screens/Memories/MemoryScreen';
import { ProtectedNotesScreen } from '../screens/Notes/ProtectedNotesScreen';
import { AgendaScreen } from '../screens/Agenda/AgendaScreen';
import { CardScoreScreen } from '../screens/CardScore/CardScoreScreen';
import { CardGamesRoute } from '../screens/CardGames/CardGamesRoute';
import { ChecklistsScreen } from '../screens/Checklists/ChecklistsScreen';
import { PetsScreen } from '../screens/Pets/PetsScreen';
import { colors } from '../theme';
import { UserManagementScreen } from '../screens/UserManagement/UserManagementScreen';
import { isUserAdmin } from '../config/userAdmin';
import { useAuthStore } from '../store/authStore';
import { useConfigStore } from '../store/configStore';
import { normalizeEmail } from '../utils/users';
import type { MainTabParams } from './types';
import { TabBarIcon } from './TabBarIcon';
import { useOnlineGameAccess } from '../hooks/useOnlineGameAccess';

const Tab = createBottomTabNavigator<MainTabParams>();
const icons = {
  Profile: 'user',
  UserManagement: 'users',
  Home: 'home',
  Finance: 'pie-chart',
  Memories: 'camera',
  MP3: 'headphones',
  Notes: 'edit-3',
  Agenda: 'calendar',
  CardScore: 'award',
  CardGames: 'layers',
  Checklists: 'check-square',
  Pets: 'heart',
} as const;

export function MainTabs() {
  const insets = useSafeAreaInsets();
  const showOnline = useOnlineGameAccess();
  const admin = useAuthStore((state) => isUserAdmin(state.user));
  const email = useAuthStore((state) => state.user?.email);
  const users = useConfigStore((state) => state.users);
  const showMemories =
    !!email?.trim() &&
    users.some((user) => normalizeEmail(user.mail) === normalizeEmail(email));
  const visibleTabCount = showMemories ? 4 : 3;
  const privacy = useFinancePrivacy();
  const { lock, setAppActive } = privacy;
  useEffect(() => {
    setAppActive(
      AppState.currentState !== 'background' &&
        AppState.currentState !== 'inactive',
    );
    const listener = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
      // The biometric prompt itself can make iOS inactive. Only a real
      // background transition invalidates an in-flight authentication.
      if (state === 'background') {
        lock();
        useNotesLockStore.getState().lock();
      }
    });
    return () => {
      listener.remove();
      lock();
      useNotesLockStore.getState().lock();
    };
  }, [lock, setAppActive]);
  return (
    <Tab.Navigator
      safeAreaInsets={
        Platform.OS === 'android'
          ? { bottom: Math.max(insets.bottom, 12) }
          : undefined
      }
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: 'fade',
        tabBarActiveTintColor: colors.earth,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: 6,
          justifyContent: 'space-around',
          shadowColor: colors.ink,
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -2 },
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarItemStyle: { flex: 1 },
        tabBarIcon: ({ color, focused }) => (
          <TabBarIcon
            name={icons[route.name]}
            focused={focused}
            color={color}
          />
        ),
      })}
    >
      {/* Hidden utility routes stay reachable from Home. */}
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarAccessibilityLabel: `Home, tab, 1 of ${visibleTabCount}`,
        }}
      />
      <Tab.Screen
        name="Finance"
        component={ProtectedFinanceScreen}
        options={{
          tabBarLabel: 'Tài chính',
          tabBarAccessibilityLabel: `Tài chính, tab, 2 of ${visibleTabCount}`,
        }}
      />
      {showMemories && (
        <Tab.Screen
          name="Memories"
          component={MemoryScreen}
          options={{
            tabBarLabel: 'Ký ức',
            tabBarAccessibilityLabel: 'Ký ức, tab, 3 of 4',
          }}
        />
      )}
      <Tab.Screen
        name="MP3"
        component={Mp3Screen}
        options={{
          tabBarAccessibilityLabel: `MP3, tab, ${visibleTabCount} of ${visibleTabCount}`,
        }}
      />
      {admin && (
        <Tab.Screen
          name="UserManagement"
          component={UserManagementScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
            tabBarStyle: { display: 'none' },
          }}
        />
      )}
      <Tab.Screen
        name="Notes"
        component={ProtectedNotesScreen}
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="Agenda"
        component={AgendaScreen}
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="CardScore"
        component={CardScoreScreen}
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
          tabBarStyle: { display: 'none' },
        }}
      />
      {showOnline && (
        <Tab.Screen
          name="CardGames"
          component={CardGamesRoute}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
            tabBarStyle: { display: 'none' },
          }}
        />
      )}
      <Tab.Screen
        name="Checklists"
        component={ChecklistsScreen}
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tab.Screen name="Pets" component={PetsScreen} options={{tabBarButton:()=>null,tabBarItemStyle:{display:'none'},tabBarStyle:{display:'none'}}}/>
    </Tab.Navigator>
  );
}
