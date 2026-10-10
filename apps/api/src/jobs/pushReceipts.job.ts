import cron from "node-cron";
import { checkPushReceipts } from "../lib/firebase";
import { describeError } from "../lib/logSafe";

export function initPushReceiptsJob() {
  cron.schedule("*/5 * * * *", async () => {
    try { await checkPushReceipts(); }
    catch (error) { console.error("[Push] Receipt check failed:", describeError(error)); }
  });
  console.info("[Push] Expo receipt checks scheduled; delivery requires EAS/FCM credentials on the Expo project.");
}
