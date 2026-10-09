import { registerRootComponent } from 'expo';
import App from './App';
import { registerBackgroundMessages } from './src/services/firebase/messagingService';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isAgendaReminder =
      typeof notification.request.content.data?.taskId === 'string';
    return {
      shouldShowBanner: isAgendaReminder,
      shouldShowList: isAgendaReminder,
      shouldPlaySound: isAgendaReminder,
      shouldSetBadge: false,
    };
  },
});
registerBackgroundMessages();
registerRootComponent(App);
