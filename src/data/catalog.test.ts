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
  it('shows the ornament in November and December only, and the mug all year', () => {
    expect(productOrder(new Date(2026, 10, 16))).toEqual(['tee', 'hoodie', 'sticker', 'poster', 'ornament', 'mug']);
    expect(productOrder(new Date(2027, 0, 2))).not.toContain('ornament');
    expect(productOrder(new Date(2027, 0, 2))).toContain('mug');
  });
});

describe('applyServerPrices', () => {
  it('takes the website prices, matching sizes loosely', () => {
    const changed = applyServerPrices([
      { key: 'poster', prices: { '12″×12″': 25, '16″×16″': 28.5, '18″×18″': 29.5 } },
      { key: 'ornament', prices: { Circle: 21 } },
      { key: 'mug', prices: { '11 oz': 22 } },
      { key: 'tee', prices: { S: 27, M: 27, L: 27, XL: 27, '2XL': 29.5, '3XL': 32 }, backPrices: { L: 35 } },
    ]);
    expect(changed).toBeGreaterThan(0);
    const poster = PRODUCTS.poster;
    if (poster.kind !== 'flat') throw new Error('poster should be flat');
    expect(poster.sizes[0].priceCents).toBe(2500);
    const ornament = PRODUCTS.ornament;
    const mug = PRODUCTS.mug;
    if (ornament.kind !== 'flat' || mug.kind !== 'flat') throw new Error('should be flat');
    expect(ornament.sizes[0].priceCents).toBe(2100);
    expect(mug.sizes[0].priceCents).toBe(2200);
    const tee = PRODUCTS.tee;
    if (tee.kind !== 'apparel') throw new Error('tee should be apparel');
    expect(tee.priceCents.L).toBe(2700);
    expect(tee.backExtraCents).toBe(800);
  });

  it('ignores unknown products and nonsense prices', () => {
    const before = JSON.stringify(PRODUCTS);
    expect(applyServerPrices([{ key: 'sock', prices: { M: 5 } }, { key: 'mug', prices: { '11 oz': -1 } }, { key: 'hoodie', prices: null }])).toBe(0);
    expect(JSON.stringify(PRODUCTS)).toBe(before);
  });
});
