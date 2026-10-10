import { describeError } from "../lib/logSafe";
import cron from 'node-cron';
import { ejecutarRecordatoriosAutomaticos, ejecutarRecordatoriosPorFecha } from '../services/recordatorios.service';
import { purgeVouchers } from '../services/vouchers.service';

/**
 * Cron job: runs daily at 9 AM Peru time (UTC-5 = 14:00 UTC).
 * Cron expression: '0 14 * * *'
 */
export function initRemindersJob(): void {
  cron.schedule('0 14 * * *', async () => {
    try {
      await ejecutarRecordatoriosAutomaticos();
    } catch (err) {
      console.error('[Cron] Error in reminders job:', describeError(err));
    }
    try {
      await purgeVouchers();
    } catch (err) {
      console.error('[Cron] Error purging vouchers:', describeError(err));
    }
  });

  // Deadlines move by the hour: check every hour (quiet hours are skipped inside).
  cron.schedule('7 * * * *', async () => {
    try {
      await ejecutarRecordatoriosPorFecha();
    } catch (err) {
      console.error('[Cron] Error in deadline reminders:', describeError(err));
    }
  });

  console.info('[Cron] Reminders job scheduled for 9 AM Peru time (14:00 UTC); deadline reminders hourly');
}
