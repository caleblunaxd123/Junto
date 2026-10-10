import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearTryBill } from "./tryBillHandoff";

/** What stays on the phone after signing out: nothing from the "probar sin cuenta" calculation. */
export async function forgetSessionData() {
  await clearTryBill();
}

/** Deleting the account also deletes its bill drafts on this phone (they are kept per account). */
export async function forgetAccountDrafts(userId: string) {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith(`junto.billDraft.v1.${userId}.`)));
  } catch {
    /* Storage unavailable: nothing to remove. */
  }
}
