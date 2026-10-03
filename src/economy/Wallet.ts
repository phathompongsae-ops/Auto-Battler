/** Currency balances by stable id ('gold'). No engine code. */
export class Wallet {
  private readonly balances = new Map<string, number>();

  constructor(initial: Readonly<Record<string, number>> = {}) {
    for (const [id, amount] of Object.entries(initial)) this.balances.set(id, amount);
  }

  get(currency: string): number {
    return this.balances.get(currency) ?? 0;
  }

  add(currency: string, amount: number): void {
    if (amount < 0) throw new Error('use spend() to remove currency');
    this.balances.set(currency, this.get(currency) + amount);
  }

  /** Remove `amount`; returns false (and changes nothing) when there isn't enough. */
  spend(currency: string, amount: number): boolean {
    if (amount < 0) return false;
    if (this.get(currency) < amount) return false;
    this.balances.set(currency, this.get(currency) - amount);
    return true;
  }

  toRecord(): Record<string, number> {
    return Object.fromEntries(this.balances);
  }

  assign(record: Readonly<Record<string, number>>): void {
    this.balances.clear();
    for (const [id, amount] of Object.entries(record)) this.balances.set(id, amount);
  }
}
