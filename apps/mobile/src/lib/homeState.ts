type QueryState = { loading: boolean; error: boolean; hasData: boolean };

/** An unavailable ledger is not an empty ledger or proof that nobody owes money. */
export function homeState(groups: QueryState, payments: QueryState, bills: QueryState, groupCount: number, openBillCount: number) {
  const queries = [groups, payments, bills];
  return {
    unavailable: queries.every((query) => query.error && !query.hasData),
    empty: queries.every((query) => query.hasData && !query.loading && !query.error) && groupCount === 0 && openBillCount === 0,
    canShowAllClear: groupCount > 0 && [groups, payments].every((query) => query.hasData && !query.loading && !query.error),
  };
}
