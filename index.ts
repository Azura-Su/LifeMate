import { registerRootComponent } from 'expo';
import App from './App';
import { registerBackgroundMessages } from './src/services/firebase/messagingService';

registerBackgroundMessages();
registerRootComponent(App);
