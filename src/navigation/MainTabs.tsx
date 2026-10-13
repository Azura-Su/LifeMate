import Feather from '@expo/vector-icons/Feather';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useEffect } from 'react';
import { HomeScreen } from '../screens/Home/HomeScreen';
import { ProtectedFinanceScreen } from '../screens/Finance/ProtectedFinanceScreen';
import { AppState } from 'react-native';
import { useFinancePrivacy } from '../hooks/useFinancePrivacy';
import { useNotesLockStore } from '../store/notesLockStore';
import { Mp3Screen } from '../screens/Mp3/Mp3Screen';
import { ProtectedNotesScreen } from '../screens/Notes/ProtectedNotesScreen';
import { AgendaScreen } from '../screens/Agenda/AgendaScreen';
import { CardScoreScreen } from '../screens/CardScore/CardScoreScreen';
import { ChecklistsScreen } from '../screens/Checklists/ChecklistsScreen';
import { colors } from '../theme';
import type { MainTabParams } from './types';

const Tab = createBottomTabNavigator<MainTabParams>();
const icons = {
  Home: 'home',
  Finance: 'pie-chart',
  MP3: 'headphones',
  Notes: 'edit-3',
  Agenda: 'calendar',
  CardScore: 'award',
  Checklists: 'check-square',
} as const;

export function MainTabs() {
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
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.earth,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.bottomBar,
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
      {/* Hidden routes stay reachable from Home; label only the 3 visible tabs. */}
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarAccessibilityLabel: 'Home, tab, 1 of 3' }}
      />
      <Tab.Screen
        name="Finance"
        component={ProtectedFinanceScreen}
        options={{
          tabBarLabel: 'Tài chính',
          tabBarAccessibilityLabel: 'Tài chính, tab, 2 of 3',
        }}
      />
      <Tab.Screen
        name="MP3"
        component={Mp3Screen}
        options={{ tabBarAccessibilityLabel: 'MP3, tab, 3 of 3' }}
      />
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
      <Tab.Screen
        name="Checklists"
        component={ChecklistsScreen}
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tab.Navigator>
  );
}
