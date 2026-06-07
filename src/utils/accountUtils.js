/**
 * Determines if an account is considered "Liquid Money" (Available Money).
 * Liquid accounts are cash-equivalent and denominated in the base currency (IDR).
 */
const isLiquidAccount = (account) => {
  const liquidTypes = ['BANK', 'EWALLET', 'CASH'];
  return liquidTypes.includes(account.type) && account.assetCode === 'IDR';
};

/**
 * Determines if an account can be used to fund Goals or Emergency Funds.
 * Currently, it shares the exact same logic as liquid accounts.
 * Abstracted to allow future rule changes (e.g., excluding 'CASH' from digital allocations).
 */
const isAllocatableAccount = (account) => {
  return isLiquidAccount(account);
};

module.exports = {
  isLiquidAccount,
  isAllocatableAccount
};
