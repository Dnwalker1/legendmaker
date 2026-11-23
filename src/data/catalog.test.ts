import { applyServerPrices, PRODUCTS, productOrder, STYLES, styleIdFrom, WHO_FOR } from './catalog';

describe('personas', () => {
  it('have unique ids and website keys, and a sample each', () => {
    expect(new Set(STYLES.map((s) => s.id)).size).toBe(STYLES.length);
    expect(new Set(STYLES.map((s) => s.siteKey)).size).toBe(STYLES.length);
    expect(STYLES.every((s) => !!s.sample)).toBe(true);
  });

  it('are found by id, display name or website key', () => {
    expect(styleIdFrom('monarch')).toBe('monarch');
    expect(styleIdFrom('Rock Star')).toBe('rockstar');
    expect(styleIdFrom('legendMovieStar')).toBe('moviestar');
    expect(styleIdFrom('travelStamp')).toBeUndefined();
  });

  it('offer three answers to whose portrait it is, each with its own promise', () => {
    expect(WHO_FOR.map((w) => w.id)).toEqual(['self', 'gift', 'memorial']);
    expect(new Set(WHO_FOR.map((w) => w.promise)).size).toBe(3);
  });
});

describe('productOrder', () => {
  it('offers the wall art first, then the apparel, all year', () => {
    expect(productOrder(new Date(2026, 10, 16))).toEqual(['poster', 'canvas', 'tee', 'hoodie']);
    expect(productOrder(new Date(2027, 5, 2))).toEqual(['poster', 'canvas', 'tee', 'hoodie']);
  });
});

describe('applyServerPrices', () => {
  it('takes the website prices, matching sizes loosely', () => {
    const changed = applyServerPrices([
      { key: 'poster', prices: { '12×16': 30, '18×24': 36 } },
      { key: 'canvas', prices: { '12×16': 46 } },
      { key: 'tee', prices: { S: 27, M: 27, L: 27, XL: 27, '2XL': 29.5, '3XL': 32 }, backPrices: { L: 35 } },
    ]);
    expect(changed).toBeGreaterThan(0);
    const poster = PRODUCTS.poster;
    if (poster.kind !== 'flat') throw new Error('poster should be flat');
    expect(poster.sizes[0].priceCents).toBe(3000);
    const canvas = PRODUCTS.canvas;
    if (canvas.kind !== 'flat') throw new Error('canvas should be flat');
    expect(canvas.sizes[0].priceCents).toBe(4600);
    const tee = PRODUCTS.tee;
    if (tee.kind !== 'apparel') throw new Error('tee should be apparel');
    expect(tee.priceCents.L).toBe(2700);
    expect(tee.backExtraCents).toBe(800);
  });

  it('ignores unknown products and nonsense prices', () => {
    const before = JSON.stringify(PRODUCTS);
    expect(applyServerPrices([{ key: 'sock', prices: { M: 5 } }, { key: 'canvas', prices: { '12×16': -1 } }, { key: 'hoodie', prices: null }])).toBe(0);
    expect(JSON.stringify(PRODUCTS)).toBe(before);
  });
});
