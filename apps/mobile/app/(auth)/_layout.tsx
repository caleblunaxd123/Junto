import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../src/store/auth.store";
import { authenticatedDestination } from "../../src/lib/invitation";

export default function AuthLayout() {
  const { isAuthenticated, pendingInvitation } = useAuthStore();

  if (isAuthenticated) {
    return <Redirect href={authenticatedDestination(pendingInvitation)} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    />
  );
}
