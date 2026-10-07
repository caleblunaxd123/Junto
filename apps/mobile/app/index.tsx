import { Redirect } from "expo-router";
import { useAuthStore } from "../src/store/auth.store";
import { authenticatedDestination } from "../src/lib/invitation";

export default function Index() {
  const { isAuthenticated, pendingInvitation } = useAuthStore();
  return (
    <Redirect
      href={
        isAuthenticated
          ? authenticatedDestination(pendingInvitation)
          : "/(auth)/splash"
      }
    />
  );
}
