import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearTryBill } from "./tryBillHandoff";
import { expenseDraftPrefix, draftOperation } from "./draftStorage";

/** What stays on the phone after signing out: nothing from the "probar sin cuenta" calculation. */
export async function forgetSessionData() {
  await clearTryBill();
}

/** Deleting the account also deletes its bill drafts on this phone (they are kept per account). */
export async function forgetAccountDrafts(userId: string) {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await Promise.all(keys.filter((key) => key.startsWith(`junto.billDraft.v1.${userId}.`) || key.startsWith(expenseDraftPrefix(userId))).map((key) => draftOperation(key, () => AsyncStorage.removeItem(key))));
  } catch {
    /* Storage unavailable: nothing to remove. */
  }
}
