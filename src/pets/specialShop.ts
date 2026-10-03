import type { Clock } from '../core/clock';
import { SPECIAL_SHOP } from '../data/petData';
import type { Wallet } from '../economy/Wallet';
import type { Inventory } from '../loot/Inventory';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Refresh cycle containing `now`: cycles start at SPECIAL_SHOP.refreshHour in
 * the configured UTC offset. Pure function of time, so a server can compute
 * the same id from its own clock.
 */
export function shopCycleId(now: number, config: { refreshHour: number; utcOffsetMinutes: number } = SPECIAL_SHOP): number {
  return Math.floor((now + config.utcOffsetMinutes * 60_000 - config.refreshHour * HOUR) / DAY);
}

export interface SpecialShopState {
  /** Cycle the purchase count belongs to. */
  cycleId: number | null;
  ticketsBought: number;
}

export type BuyTicketResult = { ok: true; cycleId: number } | { ok: false; reason: 'limit_reached' | 'cannot_afford' };

/**
 * Special Shop: one Random Egg Ticket per daily refresh cycle. Time comes
 * from an injected Clock (DEMO: local; later: server-authoritative).
 */
export class SpecialShop {
  state: SpecialShopState = { cycleId: null, ticketsBought: 0 };

  constructor(private readonly clock: Clock) {}

  /** Purchases left this cycle (a new cycle resets the count). */
  ticketsLeft(): number {
    const cycle = shopCycleId(this.clock.now());
    const bought = this.state.cycleId === cycle ? this.state.ticketsBought : 0;
    return Math.max(0, SPECIAL_SHOP.randomEggTicket.limitPerCycle - bought);
  }

  buyRandomEggTicket(inventory: Inventory, wallet: Wallet): BuyTicketResult {
    const cycle = shopCycleId(this.clock.now());
    if (this.ticketsLeft() <= 0) return { ok: false, reason: 'limit_reached' };
    const price = SPECIAL_SHOP.randomEggTicket.price;
    if (price && !wallet.spend(price.currency, price.amount)) return { ok: false, reason: 'cannot_afford' };
    this.state = { cycleId: cycle, ticketsBought: (this.state.cycleId === cycle ? this.state.ticketsBought : 0) + 1 };
    inventory.add('random_egg_ticket');
    return { ok: true, cycleId: cycle };
  }
}
