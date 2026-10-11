type QueryState = { loading: boolean; error: boolean; hasData: boolean };

/** An unavailable ledger is not an empty ledger or proof that nobody owes money. */
export function homeState(groups: QueryState, payments: QueryState, bills: QueryState, groupCount: number, openBillCount: number, pendingBillCount = 0) {
  const queries = [groups, payments, bills];
  return {
    unavailable: queries.every((query) => query.error),
    empty: queries.every((query) => query.hasData && !query.loading && !query.error) && groupCount === 0 && openBillCount === 0,
    canShowGroupsClear: groupCount > 0 && [groups, payments].every((query) => query.hasData && !query.loading && !query.error),
    canShowAllClear: groupCount > 0 && pendingBillCount === 0 && queries.every((query) => query.hasData && !query.loading && !query.error),
  };
}

/** Organizer-only bills stay separate from group debts: never add both ledgers together. */
export function pendingDayBills(bills: readonly { archivada: boolean; pendiente: number }[]) {
  const pending = bills.filter((bill) => !bill.archivada && Number.isSafeInteger(bill.pendiente) && bill.pendiente > 0);
  return { count: pending.length, cents: pending.reduce((sum, bill) => sum + bill.pendiente, 0) };
}
