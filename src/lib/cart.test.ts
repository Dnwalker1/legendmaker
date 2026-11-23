import { CartItem, cartTotals, itemCents } from './cart';
import { formatMoney, formatRange } from './money';
import { describeChoice, priceRange } from '../data/catalog';

const base = { designId: 'd1', styleId: 'monarch' as const, preview: null };

describe('cart totals', () => {
  it('adds up single items with no bundle discount', () => {
    const items: CartItem[] = [
      { ...base, id: 'a', kind: 'single', choice: { product: 'poster', size: '18x24' }, quantity: 1 },
      { ...base, id: 'b', kind: 'single', choice: { product: 'tee', color: 'Natural', size: 'M' }, quantity: 2 },
      { ...base, id: 'c', kind: 'single', choice: { product: 'canvas', size: '12x16' }, quantity: 1 },
    ];
    const t = cartTotals(items);
    expect(t.itemCount).toBe(4);
    expect(formatMoney(t.itemsCents)).toBe('$133.00');
    expect(t.totalCents).toBe(t.itemsCents);
    expect(itemCents(items[1])).toBe(5200);
  });
});

describe('price ranges', () => {
  it('matches the product list', () => {
    expect(formatRange(priceRange('poster'))).toBe('$29–$36');
    expect(formatRange(priceRange('canvas'))).toBe('$45');
  });
});

describe('describeChoice', () => {
  it('names poster and canvas sizes', () => {
    expect(describeChoice({ product: 'poster', size: '12x16' })).toBe('Poster · 12″ × 16″');
    expect(describeChoice({ product: 'canvas', size: '12x16' })).toBe('Canvas · 12″ × 16″');
  });
});
