import type { ImageSourcePropType } from 'react-native';

// Personas, products and prices. Prices are retail prices in cents and are
// only the starting point: the app loads the live Wix prices at launch.

/** A persona: who the customer is drawn as. The backend calls it the style. */
export type StyleId =
  | 'monarch'
  | 'rockstar'
  | 'moviestar'
  | 'champion'
  | 'astronaut'
  | 'noble'
  | 'hero'
  | 'outlaw'
  | 'chef'
  | 'explorer';

export type DesignStyle = {
  id: StyleId;
  name: string;
  /** The website's key for the persona (the design record's styleChoice). */
  siteKey: string;
  /** PLACEHOLDER tiles until real sample designs exist. See docs/app-spec.md > Art still to make. */
  sample: ImageSourcePropType;
  examples?: ImageSourcePropType[];
  /** One line for the gallery: what this persona is. */
  blurb: string;
  /** True when the design has a banner for a name. The website reads it back and redraws a misspelling. */
  allowsText: boolean;
  /** Example of the name line, shown as the text field's placeholder. */
  textExample?: string;
};

export const MAX_TEXT_LENGTH = 18;

// Every persona is a generic archetype with an invented look. No real teams,
// leagues, films, characters, bands or brands, ever: see docs/app-spec.md.
export const STYLES: DesignStyle[] = [
  {
    id: 'monarch',
    name: 'The Monarch',
    siteKey: 'legendMonarch',
    sample: require('../../assets/images/styles/monarch.png'),
    blurb: 'Crowned and robed in a grand old-master oil portrait. Long may you reign.',
    allowsText: true,
    textExample: 'KING DON',
  },
  {
    id: 'rockstar',
    name: 'Rock Star',
    siteKey: 'legendRockStar',
    sample: require('../../assets/images/styles/rockstar.png'),
    blurb: 'Centre stage under the lights, on the tour poster of a band that only exists for you.',
    allowsText: true,
    textExample: 'DON LIVE',
  },
  {
    id: 'moviestar',
    name: 'Movie Star',
    siteKey: 'legendMovieStar',
    sample: require('../../assets/images/styles/moviestar.png'),
    blurb: 'Your name above the title on the poster of a film that was never made.',
    allowsText: true,
    textExample: 'DON WALKER',
  },
  {
    id: 'champion',
    name: 'The Champion',
    siteKey: 'legendChampion',
    sample: require('../../assets/images/styles/champion.png'),
    blurb: 'The hometown hero on a classic sports card, in a uniform nobody else has ever worn.',
    allowsText: true,
    textExample: 'THE CLOSER',
  },
  {
    id: 'astronaut',
    name: 'Astronaut',
    siteKey: 'legendAstronaut',
    sample: require('../../assets/images/styles/astronaut.png'),
    blurb: 'Suited up for launch on a mission poster, helmet under one arm.',
    allowsText: true,
    textExample: 'COMMANDER DON',
  },
  {
    id: 'hero',
    name: 'Action Hero',
    siteKey: 'legendActionHero',
    sample: require('../../assets/images/styles/hero.png'),
    blurb: 'The caped hero of your own comic cover, watching over the city.',
    allowsText: true,
    textExample: 'CAPTAIN DON',
  },
  {
    id: 'outlaw',
    name: 'Western Legend',
    siteKey: 'legendOutlaw',
    sample: require('../../assets/images/styles/outlaw.png'),
    blurb: 'A weathered frontier poster with your face on it and a reward nobody will collect.',
    allowsText: true,
    textExample: 'DUSTY DON',
  },
  {
    id: 'chef',
    name: 'Head Chef',
    siteKey: 'legendChef',
    sample: require('../../assets/images/styles/chef.png'),
    blurb: 'Whites on, arms folded, at the pass of the finest kitchen in town.',
    allowsText: true,
    textExample: 'CHEF DON',
  },
  {
    id: 'explorer',
    name: 'Explorer',
    siteKey: 'legendExplorer',
    sample: require('../../assets/images/styles/explorer.png'),
    blurb: 'On a vintage expedition poster, at the top of a mountain with the world below.',
    allowsText: true,
    textExample: 'SUMMIT 2027',
  },
  {
    id: 'noble',
    name: 'Renaissance Noble',
    siteKey: 'legendNoble',
    sample: require('../../assets/images/styles/noble.png'),
    blurb: 'Velvet, lace and candlelight, painted the way the masters painted their patrons.',
    allowsText: false,
  },
];

/**
 * Who the portrait is of. Each answer has its own promise on the photo screen,
 * and the website records the answer and the time with the design.
 */
export type WhoFor = 'self' | 'gift' | 'memorial';

export const WHO_FOR: { id: WhoFor; title: string; detail: string; promise: string }[] = [
  {
    id: 'self',
    title: "It's me",
    detail: 'A portrait of you.',
    promise: 'This is a photo of me, and I am 18 or older.',
  },
  {
    id: 'gift',
    title: "It's a gift",
    detail: 'A portrait of someone you know.',
    promise: 'The person in this photo is 18 or older and has agreed to me using it for this.',
  },
  {
    id: 'memorial',
    title: 'In memory of someone',
    detail: 'A portrait of someone who has passed.',
    promise: 'I am a member of this person’s family, or have the family’s blessing to use this photo.',
  },
];

/**
 * The app's persona id for whatever the backend sent: the app key ("monarch"),
 * the display name ("The Monarch") or the website key ("legendMonarch").
 */
export function styleIdFrom(value: unknown): StyleId | undefined {
  const v = String(value ?? '').trim().toLowerCase();
  return STYLES.find((s) => s.id === v || s.name.toLowerCase() === v || s.siteKey.toLowerCase() === v)?.id;
}

export function styleById(id: StyleId): DesignStyle {
  const style = STYLES.find((s) => s.id === id);
  if (!style) throw new Error(`Unknown style ${id}`);
  return style;
}

export type ProductId = 'tee' | 'hoodie' | 'sticker' | 'poster' | 'ornament' | 'mug';
export type FlatId = 'sticker' | 'poster' | 'ornament' | 'mug';
export type ApparelSize = 'S' | 'M' | 'L' | 'XL' | '2XL' | '3XL';
export const APPAREL_SIZES: ApparelSize[] = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

export type ProductColor = { name: string; hex: string; mockup: ImageSourcePropType };

/**
 * Where the design prints on a tee or hoodie. Front: the design on the chest
 * and the script logo on the left sleeve. Back: the design on the back and the
 * script logo on the left chest. Names match the Wix "Print" option.
 */
export type PrintSide = 'Front' | 'Back';
export const PRINT_SIDES: PrintSide[] = ['Front', 'Back'];
export type FlatSize = { id: string; label: string; priceCents: number };

type ApparelProduct = {
  id: 'tee' | 'hoodie';
  kind: 'apparel';
  name: string;
  printfulItem: string;
  description: string;
  colors: ProductColor[];
  priceCents: Record<ApparelSize, number>;
  /** What a back print adds to every size (Wix "Print: Back" variants). */
  backExtraCents: number;
};

type FlatProduct = {
  id: FlatId;
  kind: 'flat';
  name: string;
  printfulItem: string;
  description: string;
  sizes: FlatSize[];
};

export type Product = ApparelProduct | FlatProduct;

const SLEEVE = 'Goodwookie script logo on the left sleeve.';
const CHEST = 'Your design on the back, Goodwookie script logo on the left chest.';

export const PRODUCTS: Record<ProductId, Product> = {
  tee: {
    id: 'tee',
    kind: 'apparel',
    name: 'T-Shirt',
    printfulItem: 'Bella + Canvas 3001',
    description: `The Unisex Staple T-Shirt feels soft and light with just the right amount of stretch. ${SLEEVE}`,
    colors: [
      { name: 'White', hex: '#F5F5F5', mockup: require('../../assets/images/mockups/tee-white.webp') },
      { name: 'Natural', hex: '#F3E8CA', mockup: require('../../assets/images/mockups/tee-natural.webp') },
      { name: 'Ash', hex: '#DBDCD6', mockup: require('../../assets/images/mockups/tee-ash.webp') },
      { name: 'Heather Dust', hex: '#E2D9D0', mockup: require('../../assets/images/mockups/tee-heather-dust.webp') },
      { name: 'Athletic Heather', hex: '#C4C5C0', mockup: require('../../assets/images/mockups/tee-athletic-heather.webp') },
    ],
    priceCents: { S: 2600, M: 2600, L: 2600, XL: 2600, '2XL': 2850, '3XL': 3100 },
    // Back print costs $8 more (Wix "Design Your Pet Tee - Back Print": $34 / 2XL $36.50 / 3XL $39, 15 Nov 2026).
    backExtraCents: 800,
  },
  hoodie: {
    id: 'hoodie',
    kind: 'apparel',
    name: 'Hoodie',
    printfulItem: 'Cotton Heritage M2580',
    description: `Cotton Heritage M2580 unisex premium pullover hoodie. ${SLEEVE}`,
    colors: [
      { name: 'Bone', hex: '#F1E5CD', mockup: require('../../assets/images/mockups/hoodie-bone.webp') },
      { name: 'Carbon Grey', hex: '#A2A19D', mockup: require('../../assets/images/mockups/hoodie-carbon-grey.webp') },
      { name: 'Carolina Blue', hex: '#93ADDD', mockup: require('../../assets/images/mockups/hoodie-carolina-blue.webp') },
      { name: 'Khaki', hex: '#B38E66', mockup: require('../../assets/images/mockups/hoodie-khaki.webp') },
      { name: 'Lavender', hex: '#ECCDE2', mockup: require('../../assets/images/mockups/hoodie-lavender.webp') },
      { name: 'Light Pink', hex: '#ECC3BF', mockup: require('../../assets/images/mockups/hoodie-light-pink.webp') },
      { name: 'Oatmeal Heather', hex: '#D0C9BC', mockup: require('../../assets/images/mockups/hoodie-oatmeal-heather.webp') },
      { name: 'Sky Blue', hex: '#C8DCE5', mockup: require('../../assets/images/mockups/hoodie-sky-blue.webp') },
      { name: 'White', hex: '#FFFFFF', mockup: require('../../assets/images/mockups/hoodie-white.webp') },
    ],
    priceCents: { S: 5550, M: 5550, L: 5550, XL: 5550, '2XL': 5800, '3XL': 6050 },
    backExtraCents: 700,
  },
  sticker: {
    id: 'sticker',
    kind: 'flat',
    name: 'Sticker',
    printfulItem: 'Kiss-cut, bubble-free sticker',
    description: 'Kiss-cut, bubble-free sticker of your design.',
    sizes: [
      { id: '3x3', label: '3″ × 3″', priceCents: 1150 },
      { id: '4x4', label: '4″ × 4″', priceCents: 1150 },
      { id: '5.5x5.5', label: '5.5″ × 5.5″', priceCents: 1200 },
    ],
  },
  poster: {
    id: 'poster',
    kind: 'flat',
    name: 'Poster',
    printfulItem: 'Matte paper poster',
    description: 'Square matte paper poster of your design.',
    sizes: [
      { id: '12x12', label: '12″ × 12″', priceCents: 2400 },
      { id: '16x16', label: '16″ × 16″', priceCents: 2850 },
      { id: '18x18', label: '18″ × 18″', priceCents: 2950 },
    ],
  },
  // Added 16 Nov 2026 (first sold on the website 14 Nov). One size each; the
  // size ids match the website's productCatalog.js exactly.
  ornament: {
    id: 'ornament',
    kind: 'flat',
    name: 'Ornament',
    printfulItem: 'Ceramic ornament, circle',
    description: 'Glossy round ceramic ornament, 2.76″ across, with a gold string. Your design fills the circle.',
    sizes: [{ id: 'Circle', label: 'Round, 2.76″', priceCents: 1900 }],
  },
  mug: {
    id: 'mug',
    kind: 'flat',
    name: 'Mug',
    printfulItem: 'White glossy mug, 11 oz',
    description: 'White glossy 11 oz ceramic mug. Your design faces you while you drink; the Goodwookie logo is on the other side.',
    sizes: [{ id: '11 oz', label: '11 oz', priceCents: 2000 }],
  },
};

const ALL_PRODUCTS: ProductId[] = ['tee', 'hoodie', 'sticker', 'poster', 'ornament', 'mug'];

/**
 * Seasonal products, offered only between these month-days (a season may run
 * across New Year). The ornament is sold for Christmas (Don, 14 Nov 2026).
 */
export const SEASONAL_PRODUCTS: Partial<Record<ProductId, { from: string; until: string }>> = {
  ornament: { from: '11-01', until: '12-31' },
};

function inSeason(id: ProductId, now: Date): boolean {
  const season = SEASONAL_PRODUCTS[id];
  if (!season) return true;
  const today = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return season.from <= season.until ? today >= season.from && today <= season.until : today >= season.from || today <= season.until;
}

/** The products to offer today, in order. */
export function productOrder(now: Date = new Date()): ProductId[] {
  return ALL_PRODUCTS.filter((id) => inSeason(id, now));
}

/** Kept for anything that wants the list as it is right now. */
export const PRODUCT_ORDER: ProductId[] = productOrder();

// The bundle discount is an automatic discount in the Wix store. The app only
// estimates it for display; Wix applies the real one at checkout.
export const BUNDLE_DISCOUNT = 0.1;

// What a customer picks for one product.
export type ProductChoice =
  | { product: 'tee' | 'hoodie'; color: string; size: ApparelSize; print?: PrintSide }
  | { product: FlatId; size: string };

export function priceCents(choice: ProductChoice): number {
  const product = PRODUCTS[choice.product];
  if (product.kind === 'apparel') {
    const back = 'print' in choice && choice.print === 'Back' ? product.backExtraCents : 0;
    return product.priceCents[choice.size as ApparelSize] + back;
  }
  const size = product.sizes.find((s) => s.id === choice.size);
  if (!size) throw new Error(`Unknown size ${choice.size} for ${choice.product}`);
  return size.priceCents;
}

// Lowest to highest price over every option, the back print included, so the
// range on Pick your product never undersells the shirt (test report, 6 Nov 2026).
export function priceRange(id: ProductId): [number, number] {
  const product = PRODUCTS[id];
  if (product.kind === 'apparel') {
    const prices = Object.values(product.priceCents);
    return [Math.min(...prices), Math.max(...prices) + product.backExtraCents];
  }
  const prices = product.sizes.map((s) => s.priceCents);
  return [Math.min(...prices), Math.max(...prices)];
}

export function colorFor(product: 'tee' | 'hoodie', name: string): ProductColor {
  const p = PRODUCTS[product] as ApparelProduct;
  return p.colors.find((c) => c.name === name) ?? p.colors[0];
}

export function describeChoice(choice: ProductChoice): string {
  const product = PRODUCTS[choice.product];
  if (choice.product === 'tee' || choice.product === 'hoodie') {
    return `${product.name} · ${choice.color} · ${choice.size}${choice.print === 'Back' ? ' · Back print' : ''}`;
  }
  const size = (product as FlatProduct).sizes.find((s) => s.id === choice.size);
  return `${product.name} · ${size?.label ?? choice.size}`;
}

/** The product description, worded for where the design prints. */
export function productDescription(choice: ProductChoice): string {
  const product = PRODUCTS[choice.product];
  if ((choice.product === 'tee' || choice.product === 'hoodie') && choice.print === 'Back') {
    return product.description.replace(SLEEVE, CHEST);
  }
  return product.description;
}

export const DEFAULT_CHOICES: Record<ProductId, ProductChoice> = {
  tee: { product: 'tee', color: 'White', size: 'L' },
  hoodie: { product: 'hoodie', color: 'Bone', size: 'L' },
  sticker: { product: 'sticker', size: '4x4' },
  poster: { product: 'poster', size: '16x16' },
  ornament: { product: 'ornament', size: 'Circle' },
  mug: { product: 'mug', size: '11 oz' },
};

// ── PRICES FROM THE WEBSITE (added 16 Nov 2026) ─────────────────────────────
// The prices above are only the starting point. On launch the app asks the
// website for its live Wix prices (GET /_functions/products) and replaces
// them, so a price change in Wix needs no app update. Anything odd in the
// answer is ignored and the built-in price stays.

export type ServerProduct = {
  key: string;
  prices?: Record<string, number> | null;
  backPrices?: Record<string, number> | null;
};

const sizeKey = (s: string) => s.toLowerCase().replace(/×/g, 'x').replace(/[^a-z0-9.]/g, '');
const sane = (v: unknown): number | null => (typeof v === 'number' && v > 0 && v < 1000 ? Math.round(v * 100) : null);

/** Applies the website's prices. Returns how many prices changed. */
export function applyServerPrices(list: ServerProduct[]): number {
  let changed = 0;
  for (const sp of list) {
    const product = PRODUCTS[sp.key as ProductId];
    if (!product || !sp.prices) continue;
    const prices = Object.fromEntries(Object.entries(sp.prices).map(([k, v]) => [sizeKey(k), sane(v)]));
    if (product.kind === 'apparel') {
      for (const size of APPAREL_SIZES) {
        const cents = prices[sizeKey(size)];
        if (cents && cents !== product.priceCents[size]) {
          product.priceCents[size] = cents;
          changed++;
        }
      }
      const back = sp.backPrices ? sane(sp.backPrices.L ?? sp.backPrices.M) : null;
      const front = prices.l ?? prices.m;
      if (back && front && back > front && back - front !== product.backExtraCents) {
        product.backExtraCents = back - front;
        changed++;
      }
    } else {
      const only = product.sizes.length === 1 ? Object.values(prices).filter(Boolean) : [];
      for (const size of product.sizes) {
        const cents = prices[sizeKey(size.id)] ?? (only.length === 1 ? only[0] : null);
        if (cents && cents !== size.priceCents) {
          size.priceCents = cents;
          changed++;
        }
      }
    }
  }
  return changed;
}
