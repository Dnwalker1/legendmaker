import { ProductChoice, priceCents } from '../data/catalog';
import type { ImageSourcePropType } from 'react-native';
import type { StyleId } from '../data/catalog';

type ItemBase = { id: string; designId: string; styleId: StyleId; preview: ImageSourcePropType | null };

// Legend Maker has no "Buy them all" bundle (removed 22 Nov 2026), so every
// cart line is one product in one size and colour.
export type CartItem = ItemBase & { kind: 'single'; choice: ProductChoice; quantity: number };

/** A cart item before it gets an ID. */
export type NewCartItem = Omit<CartItem, 'id'>;

export function itemCents(item: CartItem): number {
  return priceCents(item.choice) * item.quantity;
}

export type CartTotals = {
  itemCount: number;
  itemsCents: number;
  totalCents: number;
};

export function cartTotals(items: CartItem[]): CartTotals {
  let itemCount = 0;
  let itemsCents = 0;
  for (const item of items) {
    itemsCents += itemCents(item);
    itemCount += item.quantity;
  }
  return { itemCount, itemsCents, totalCents: itemsCents };
}
