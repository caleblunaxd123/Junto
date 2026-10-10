import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { AppState, Platform } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    // Offline, queries wait instead of failing; data already loaded stays on screen.
    queries: { retry: 1, staleTime: 30_000, networkMode: 'offlineFirst' },
    // Never queue money changes to replay later: the person must see they were not saved.
    mutations: { networkMode: 'always' },
  },
});

onlineManager.setEventListener((setOnline) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Native NetInfo's external reachability probe is blocked by our CSP; it must not
    // label an online web beta as offline. API failures are handled by each request.
    const update = () => setOnline(window.navigator.onLine !== false);
    update(); window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }
  return NetInfo.addEventListener((state) => setOnline(state.isConnected !== false && state.isInternetReachable !== false));
});
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (status) => setFocused(status === 'active'));
  return () => subscription.remove();
});
