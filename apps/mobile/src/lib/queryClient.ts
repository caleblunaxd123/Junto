import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    // Offline, queries wait instead of failing; data already loaded stays on screen.
    queries: { retry: 1, staleTime: 30_000, networkMode: 'offlineFirst' },
    // Never queue money changes to replay later: the person must see they were not saved.
    mutations: { networkMode: 'always' },
  },
});

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false && state.isInternetReachable !== false)),
);
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (status) => setFocused(status === 'active'));
  return () => subscription.remove();
});
