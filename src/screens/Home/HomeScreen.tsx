import { styles } from './HomeScreen.styles';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { useRef, useState } from 'react';
import { BrandAvatar } from '../../components/BrandAvatar';
import { AppDrawer } from '../../components/AppDrawer';
import { Screen } from '../../components/Screen';
import type { MainTabParams } from '../../navigation/types';
import { colors, typography } from '../../theme';
import { useHomeScreen } from './useHomeScreen';
import { HomeFinanceCard } from './HomeFinanceCard';
import { HomeAgendaCard } from './HomeAgendaCard';

export function HomeScreen({
  navigation,
}: BottomTabScreenProps<MainTabParams, 'Home'>) {
  const model = useHomeScreen();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef(false);
  async function refresh() {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      await model.refresh();
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }
  return (
    <Screen
      fixedHeader={
        <View style={styles.header}>
          <View style={styles.greeting}>
            <Text style={typography.small}>Chào bạn,</Text>
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              style={[typography.title, styles.headerName]}
            >
              {model.name}
            </Text>
            <Text style={typography.small}>{model.date}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở menu"
            onPress={() => setDrawerVisible(true)}
            style={styles.menuButton}
          >
            <BrandAvatar size={36} />
          </Pressable>
        </View>
      }
      fixedHeaderStyle={styles.fixedHeader}
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          tintColor={colors.earth}
        />
      }
    >
      <HomeFinanceCard
        key={model.finance.uid}
        model={model}
        onOpen={() => navigation.navigate('Finance')}
      />
      <HomeAgendaCard onOpenAgenda={() => navigation.navigate('Agenda')} />
      {model.warning && (
        <Text accessibilityLiveRegion="polite" style={typography.small}>
          {model.warning} Kéo xuống để thử lại.
        </Text>
      )}
      <AppDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onOpenNotes={() => navigation.navigate('Notes')}
        privacy={model.privacy}
      />
    </Screen>
  );
}
