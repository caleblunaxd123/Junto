import cron from 'node-cron';
import { ejecutarRecordatoriosAutomaticos } from '../services/recordatorios.service';

/**
 * Cron job: runs daily at 9 AM Peru time (UTC-5 = 14:00 UTC).
 * Cron expression: '0 14 * * *'
 */
export function initRemindersJob(): void {
  cron.schedule('0 14 * * *', async () => {
    try {
      await ejecutarRecordatoriosAutomaticos();
    } catch (err) {
      console.error('[Cron] Error in reminders job:', err);
    }
  });

  console.info('[Cron] Reminders job scheduled for 9 AM Peru time (14:00 UTC)');
}
