// backend/productCatalog.js
// Every product Design Your Pet AND Legend Maker can print on, in one place. Data only — no
// network calls — so every other backend file can import it safely.
//
// Adding a product later = adding one entry here, plus the matching hidden
// product in Wix Stores. Nothing else needs to know about it.
//
// Printful variant IDs checked against Printful's catalog, Sept 2026.
// Plain backend file — not callable from a browser.
//
// ── THE RULES EVERY ENTRY FOLLOWS ─────────────────────────────────────────
//   wixProductId      the hidden Wix Stores product (ID from the address bar
//                     when you open it in Store Products)
//   printfulProductId Printful's catalog product
//   colors            names EXACTLY as the Wix product's "Color" choices,
//                     or null for products with no colour (stickers, posters)
//   sizes             names EXACTLY as the Wix product's "Size" choices
//   variants          { colour: { size: printfulVariantId } }. Products with
//                     no colour use '' as the colour key.
//   placement         Printful print area for the art: 'front' or 'default'
//   layout            'chest' = sits high on the chest (garments)
//                     'fill'  = fills the print area, centred (sticker, poster)
//   sleeveLogo        true = Goodwookie script logo on the left sleeve
//   sleeveAlign       'top' or 'center' (default) within the sleeve print area
//   printSides        (garments only) ['Front', 'Back']. Front = the art on
//                     the chest + sleeve logo. Back = the art on the back + the
//                     script logo on the LEFT CHEST, no sleeve logo.
//   backWixProductId  the separate Wix product a Back print is sold as. It
//                     has the same Color and Size choices, the same "Design
//                     ID" field, and the higher price. (A "Print" option on the
//                     main product isn't possible: Printful's store sync locks
//                     the options on the products it made.)
//   back              where the art sits on a back print, in inches
//   chestLogo         where the left-chest logo sits on a back print, in
//                     inches. centerOffsetIn = from the middle of the shirt to
//                     the middle of the logo, toward the wearer's left.
//   noWixOptions      true = the Wix product has no Color or Size choices at
//                     all (the ornament and mug). The one size listed here is
//                     only for the page's dropdown and Printful's variant.
//   inBundle          true = counts toward "buy them all, 10% off". Only the
//                     four products the Wix discount rule names. Leave it off
//                     for anything else, or the row asks for items the
//                     discount doesn't need.
//   fitScale          (fill layout) 1 = fill the print area. Less than 1
//                     shrinks the art, e.g. to sit inside a round ornament.
//   fitCenterX/Y      (fill layout) where the art's middle sits, 0 to 1 across
//                     and down the print area. 0.5 = centred (the default).
//   backLogo          (mug) the Goodwookie logo printed on the other side of
//                     the mug: { widthShare, heightShare, centerX }.
//   ownPreview        true = Printful can't make a product photo of it, so
//                     the page shows a picture built by holidayPreview.web.js.
//
// LEGEND MAKER (added 19 Nov 2026)
//   app               'legend' = a Legend Maker product. Left off = Design Your
//                     Pet. Each app and page is only ever offered its own
//                     products (productListForPage below).
//   appKey            what the Legend Maker app calls the product ('tee',
//                     'hoodie', 'poster', 'canvas'). appBackend.js translates.
//   artRatio          width ÷ height of the art, used when the art file's own
//                     size can't be read. Legend Maker art is 3:4 (0.75). Left
//                     off = 1, square, as every pet design is.
//   faceWidthIn       ('face' layout, canvas) { size: inches } the width of
//                     the canvas FRONT, so the art covers the front exactly
//                     and the wrap round the sides is left plain.
// ───────────────────────────────────────────────────────────────────────────

// Printful catalog variant IDs for the Christmas products. Read from
// api.printful.com/products/881 and /products/19 (14 Nov 2026).
const PRINTFUL_ORNAMENT_CIRCLE = 22782;   // Ceramic Ornament (Circle)
const PRINTFUL_MUG_11OZ = 1320;          // White Glossy Mug 11 oz

// The Goodwookie logo printed on the back of the mug. Upload
// goodwookie-mug-logo.png to Wix Media, then paste its https://static.wixstatic.com/...
// address here.
export const MUG_LOGO_URL = 'https://static.wixstatic.com/media/94607f_b68b209bbd3b4579965f2a7c7ff0e5b9~mv2.jpg';

export const PRODUCTS = {
  tee: {
    label: 'T-Shirt',
    wixProductId: '99a7b234-fb1d-4999-9196-1bc4357c9ef3',   // "Design Your Own Pet Tee"
    printfulProductId: 71,                                   // Bella+Canvas 3001
    colors: ['White', 'Natural', 'Ash', 'Heather Dust', 'Athletic Heather'],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    defaultColor: 'White',
    defaultSize: 'L',
    variants: {
      'White':            { S: 4011,  M: 4012,  L: 4013,  XL: 4014,  '2XL': 4015,  '3XL': 5294 },
      'Natural':          { S: 14682, M: 14683, L: 14684, XL: 14685, '2XL': 14686, '3XL': 14687 },
      'Ash':              { S: 4026,  M: 4027,  L: 4028,  XL: 4029,  '2XL': 4030,  '3XL': 8447 },
      'Heather Dust':     { S: 10360, M: 10361, L: 10362, XL: 10363, '2XL': 10364, '3XL': 10365 },
      'Athletic Heather': { S: 6948,  M: 6949,  L: 6950,  XL: 6951,  '2XL': 6952,  '3XL': 6953 }
    },
    placement: 'front',
    layout: 'chest',
    // Don's own tee layout in Printful's designer (26 Sep): a square design
    // 10.7" wide, centred, 3.2" below the top of the front print area. The 4K
    // art prints at about 382 DPI at this size.
    frontWidthIn: 10.7,
    frontTopIn: 3.2,
    sleeveLogo: true,
    inBundle: true,
    // BACK PRINT (added 29 Oct 2026). Sold as its own product, $5 more.
    printSides: ['Front', 'Back'],
    backWixProductId: '813640d0-3c5f-4f22-bf8f-b38d788831b1',   // "Design Your Pet Tee - Back Print"
    // Don, 30 Oct: moved 1" lower after the first mockups (was 1.5).
    back: { widthIn: 11, topIn: 2.5 },
    chestLogo: { widthIn: 3.5, topIn: 1.0, centerOffsetIn: 3.25 }
  },

  hoodie: {
    label: 'Hoodie',
    wixProductId: '62e00cff-8b21-479a-9aad-324507e379f2',   // "Design Your Pet Hoodie"
    printfulProductId: 380,                                  // Cotton Heritage M2580 Premium Pullover
    colors: ['White', 'Bone', 'Oatmeal Heather', 'Khaki', 'Light Pink', 'Lavender',
             'Sky Blue', 'Carolina Blue', 'Carbon Grey'],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    defaultColor: 'White',
    defaultSize: 'L',
    // Printful cost with the sleeve logo: S–XL $33.79, 2XL $35.79, 3XL $37.79
    // (hoodie $27.84 / $29.84 / $31.84 + $5.95 sleeve). Retail $54.50–$59.50.
    variants: {
      'White':           { S: 10774, M: 10775, L: 10776, XL: 10777, '2XL': 10778, '3XL': 13421 },
      'Bone':            { S: 20284, M: 20285, L: 20286, XL: 20287, '2XL': 20288, '3XL': 20289 },
      'Oatmeal Heather': { S: 24975, M: 24976, L: 24977, XL: 24978, '2XL': 24979, '3XL': 24980 },
      'Khaki':           { S: 13899, M: 13900, L: 13901, XL: 13902, '2XL': 13903, '3XL': 13904 },
      'Light Pink':      { S: 24993, M: 24994, L: 24995, XL: 24996, '2XL': 24997, '3XL': 24998 },
      'Lavender':        { S: 25005, M: 25006, L: 25007, XL: 25008, '2XL': 25009, '3XL': 25010 },
      'Sky Blue':        { S: 13917, M: 13918, L: 13919, XL: 13920, '2XL': 13921, '3XL': 13922 },
      'Carolina Blue':   { S: 11496, M: 11497, L: 11498, XL: 11499, '2XL': 11500, '3XL': 13422 },
      'Carbon Grey':     { S: 10784, M: 10785, L: 10786, XL: 10787, '2XL': 10788, '3XL': 13420 }
    },
    placement: 'front',
    layout: 'chest',
    // Don's own hoodie layout in Printful's designer (26 Sep): a square design
    // 9.9" wide, centred, 2.1" below the top of the front print area, ending
    // just above the pocket. The 4K art prints at about 414 DPI at this size.
    frontWidthIn: 9.9,
    frontTopIn: 2.1,
    sleeveLogo: true,
    // The hoodie's sleeve print area runs 3" × 14" down the whole arm. Centred,
    // the logo would land at the elbow; 'top' puts it on the upper arm, just
    // below the shoulder, where a sleeve logo normally sits.
    sleeveAlign: 'top',
    inBundle: true,
    // BACK PRINT (added 29 Oct 2026). Sold as its own product, $7 more.
    printSides: ['Front', 'Back'],
    backWixProductId: '8f8262dd-7d93-402c-be67-bfaca2db2a10',   // "Design Your Pet Hoodie - Back Print"
    // Don, 30 Oct: moved 2" higher after the first mockups (was 3). Still
    // clear of the hood, which hangs above the top of the back print area.
    back: { widthIn: 11, topIn: 1 },
    chestLogo: { widthIn: 3.5, topIn: 1.0, centerOffsetIn: 3.25 }
  },

  sticker: {
    label: 'Sticker',
    wixProductId: '1e805e4e-eace-4a86-9391-5699beff4be9',   // "Bubble-free stickers" (made in Printful)
    printfulProductId: 358,                                  // Kiss-Cut Stickers
    colors: null,
    // Spelled exactly as the Wix product's Size choices ("3x3", not "3 in").
    sizes: ['3x3', '4x4', '5.5x5.5'],
    defaultSize: '4x4',
    // Printful cost $2.34 / $2.54 / $2.74. Retail $10.50 / $10.50 / $11.
    variants: {
      '': { '3x3': 10163, '4x4': 10164, '5.5x5.5': 10165 }
    },
    placement: 'default',
    layout: 'fill',
    sleeveLogo: false,
    inBundle: true
  },

  poster: {
    label: 'Poster',
    wixProductId: '11eb5e97-7490-499a-87c1-54b0059e6cde',   // "Poster" (made in Printful)
    printfulProductId: 1,                                    // Enhanced Matte Paper Poster (in)
    colors: null,
    // Spelled exactly as the Wix product's Size choices. Note the "×" is the
    // multiplication sign Printful uses, not the letter x.
    // Square sizes on purpose: Design Your Pet art is square, so it fills
    // these edge to edge with nothing cropped.
    sizes: ['12×12', '16×16', '18×18'],
    defaultSize: '16×16',
    // Printful cost $9.07 / $11.87 / $12.64. Retail $22 / $26.50 / $27.50.
    variants: {
      '': { '12×12': 4464, '16×16': 4465, '18×18': 6242 }
    },
    placement: 'default',
    layout: 'fill',
    sleeveLogo: false,
    inBundle: true
  },

  // ── CHRISTMAS 2026 (added 14 Nov) ─────────────────────────────────────────
  // Made in Printful and pushed to Wix like the sticker and poster. Both Wix
  // products have NO options, so `noWixOptions` is set and the single size
  // below exists only for the page's dropdown and the Printful variant.
  // Neither is part of the four-item bundle.

  ornament: {
    label: 'Ornament',
    wixProductId: '9aba8664-3470-4089-97ce-8f89a6294fc3',   // "Design Your Pet Christmas Ornament"
    printfulProductId: 881,                                  // Ceramic Ornament (one side), circle
    colors: null,
    sizes: ['Circle'],
    defaultSize: 'Circle',
    noWixOptions: true,
    // Printful cost $4.59 (Growth), US shipping $5.49. Retail set in Wix.
    variants: {
      '': { 'Circle': PRINTFUL_ORNAMENT_CIRCLE }
    },
    placement: 'default',
    layout: 'fill',
    // The design FILLS the ornament (Don, 14 Nov): the square art covers the
    // whole 3" print area and the 2.76" circle trims its corners, like
    // Goodwookie's own Merry Chewmas ornament. The hanging hole goes through
    // the top of the art. (0.62 would fit the whole square inside instead.)
    fitScale: 1,
    fitCenterY: 0.5,
    // Printful can't draw a product photo of the ornament or mug, so the page
    // shows a picture we build instead (holidayPreview.web.js).
    ownPreview: true,
    sleeveLogo: false
  },

  mug: {
    label: 'Mug',
    wixProductId: '521cd3c8-8948-4482-9872-878f9cf937aa',   // "Design Your Pet Holiday Mug"
    printfulProductId: 19,                                   // White Glossy Mug
    colors: null,
    sizes: ['11 oz'],
    defaultSize: '11 oz',
    noWixOptions: true,
    // Printful cost $5.05 (Growth), US shipping $4.99. Retail set in Wix.
    variants: {
      '': { '11 oz': PRINTFUL_MUG_11OZ }
    },
    placement: 'default',
    layout: 'mug',
    // The print wraps round the cup. Its middle (0.5) is opposite the handle.
    // 0.75 is the side a right-handed person sees while drinking (handle on
    // their right), so the pet faces them; 0.25 faces everyone else.
    fitCenterX: 0.75,
    fitScale: 0.94,
    backLogo: { widthShare: 0.30, heightShare: 0.55, centerX: 0.25 },
    ownPreview: true,
    sleeveLogo: false
  },

  // ── LEGEND MAKER (added 19 Nov 2026) ──────────────────────────────────────
  // 3:4 portrait art. Made in Printful and pushed to Wix like the pet
  // products, each with the "Design ID" text box. Until a product's Wix ID
  // replaces its PASTE_ placeholder, it is hidden everywhere and can't be sold.
  // Costs and suggested prices: legend-maker-products.xlsx (19 Nov).

  legendTee: {
    app: 'legend', appKey: 'tee',
    label: 'T-Shirt',
    wixProductId: 'PASTE_LEGEND_TEE_ID',                     // "Legend Maker Tee"
    printfulProductId: 71,                                   // Bella+Canvas 3001
    colors: ['White', 'Natural', 'Ash', 'Heather Dust', 'Athletic Heather'],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    defaultColor: 'White',
    defaultSize: 'L',
    variants: {
      'White':            { S: 4011,  M: 4012,  L: 4013,  XL: 4014,  '2XL': 4015,  '3XL': 5294 },
      'Natural':          { S: 14682, M: 14683, L: 14684, XL: 14685, '2XL': 14686, '3XL': 14687 },
      'Ash':              { S: 4026,  M: 4027,  L: 4028,  XL: 4029,  '2XL': 4030,  '3XL': 8447 },
      'Heather Dust':     { S: 10360, M: 10361, L: 10362, XL: 10363, '2XL': 10364, '3XL': 10365 },
      'Athletic Heather': { S: 6948,  M: 6949,  L: 6950,  XL: 6951,  '2XL': 6952,  '3XL': 6953 }
    },
    placement: 'front',
    layout: 'chest',
    artRatio: 0.75,
    // 3:4 art 10.5" wide is 14" tall: 1" below the top of the 12" x 16" front
    // print area, it ends 1" above the bottom. Adjust after the first mockups.
    frontWidthIn: 10.5,
    frontTopIn: 1.0,
    sleeveLogo: true
  },

  legendHoodie: {
    app: 'legend', appKey: 'hoodie',
    label: 'Hoodie',
    wixProductId: 'PASTE_LEGEND_HOODIE_ID',                  // "Legend Maker Hoodie"
    printfulProductId: 380,                                  // Cotton Heritage M2580 Premium Pullover
    colors: ['White', 'Bone', 'Oatmeal Heather', 'Khaki', 'Light Pink', 'Lavender',
             'Sky Blue', 'Carolina Blue', 'Carbon Grey'],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    defaultColor: 'White',
    defaultSize: 'L',
    variants: {
      'White':           { S: 10774, M: 10775, L: 10776, XL: 10777, '2XL': 10778, '3XL': 13421 },
      'Bone':            { S: 20284, M: 20285, L: 20286, XL: 20287, '2XL': 20288, '3XL': 20289 },
      'Oatmeal Heather': { S: 24975, M: 24976, L: 24977, XL: 24978, '2XL': 24979, '3XL': 24980 },
      'Khaki':           { S: 13899, M: 13900, L: 13901, XL: 13902, '2XL': 13903, '3XL': 13904 },
      'Light Pink':      { S: 24993, M: 24994, L: 24995, XL: 24996, '2XL': 24997, '3XL': 24998 },
      'Lavender':        { S: 25005, M: 25006, L: 25007, XL: 25008, '2XL': 25009, '3XL': 25010 },
      'Sky Blue':        { S: 13917, M: 13918, L: 13919, XL: 13920, '2XL': 13921, '3XL': 13922 },
      'Carolina Blue':   { S: 11496, M: 11497, L: 11498, XL: 11499, '2XL': 11500, '3XL': 13422 },
      'Carbon Grey':     { S: 10784, M: 10785, L: 10786, XL: 10787, '2XL': 10788, '3XL': 13420 }
    },
    placement: 'front',
    layout: 'chest',
    artRatio: 0.75,
    // THE SQUARE FRONT (Don, 19 Nov). The hoodie's front print area is 12" x
    // 12", ending just above the pocket. The whole 3:4 design is fitted inside
    // it: 8.25" wide x 11" tall, 1" below the top, so it ends at the pocket
    // like the pet design does, with plain fabric either side.
    frontWidthIn: 8.25,
    frontTopIn: 1.0,
    sleeveLogo: true,
    sleeveAlign: 'top'
  },

  legendPoster: {
    app: 'legend', appKey: 'poster',
    label: 'Poster',
    wixProductId: 'PASTE_LEGEND_POSTER_ID',                  // "Legend Maker Poster"
    printfulProductId: 1,                                    // Enhanced Matte Paper Poster (in)
    colors: null,
    // Spelled exactly as the Wix product's Size choices, with the × sign.
    sizes: ['12×16', '18×24'],
    defaultSize: '12×16',
    variants: {
      '': { '12×16': 1349, '18×24': 1 }
    },
    placement: 'default',
    layout: 'fill',
    artRatio: 0.75,
    sleeveLogo: false
  },

  legendCanvas: {
    app: 'legend', appKey: 'canvas',
    label: 'Canvas',
    wixProductId: 'PASTE_LEGEND_CANVAS_ID',                  // "Legend Maker Canvas"
    printfulProductId: 3,                                    // Canvas (in)
    colors: null,
    sizes: ['12×16'],
    defaultSize: '12×16',
    // Read from Printful's catalog through GET /_functions/printfulVariants/3
    // (20 Nov 2026): Canvas (in) 12″×16″ is variant 5.
    variants: {
      '': { '12×16': 5 }
    },
    placement: 'default',
    // The print file includes the wrap round the sides. The art covers the
    // 12" front exactly; the wrap is left plain (white).
    layout: 'face',
    faceWidthIn: { '12×16': 12 },
    artRatio: 0.75,
    sleeveLogo: false
  }
};

// Which app a product belongs to: 'legend' or 'pet'.
export function appOfProduct(p) {
  return p && p.app === 'legend' ? 'legend' : 'pet';
}

// The catalog key for what an app calls a product. Legend Maker says 'tee'
// and means legendTee; Design Your Pet's keys are the catalog's own. Returns
// null for a product the app doesn't sell.
export function catalogKeyFor(app, appKey) {
  const want = app === 'legend' ? 'legend' : 'pet';
  const k = String(appKey || '');
  if (want === 'pet') return PRODUCTS[k] && appOfProduct(PRODUCTS[k]) === 'pet' ? k : null;
  if (PRODUCTS[k] && appOfProduct(PRODUCTS[k]) === 'legend') return k;
  const hit = Object.entries(PRODUCTS).find(([, p]) => appOfProduct(p) === 'legend' && p.appKey === k);
  return hit ? hit[0] : null;
}

export const DEFAULT_PRODUCT = 'tee';
export const DEFAULT_LEGEND_PRODUCT = 'legendPoster';

// The product entry, or a clear error. Falls back to the tee when no key is
// given, which is what keeps the current page working before it knows about
// products at all.
export function getProduct(productKey) {
  const key = productKey || DEFAULT_PRODUCT;
  const p = PRODUCTS[key];
  if (!p) throw new Error(`Unknown product "${key}". Known: ${Object.keys(PRODUCTS).join(', ')}.`);
  return { key, ...p };
}

// 'Front' or 'Back' for a product, from whatever the caller sent. Anything
// missing or unknown is 'Front', and a product without a back-print product
// (sticker, poster) is always 'Front'. So old callers that know nothing about
// print sides keep getting exactly what they got before.
export function printSideFor(productKey, print) {
  const p = getProduct(productKey);
  if (!p.printSides || !p.backWixProductId) return 'Front';
  const want = String(print || '').trim().toLowerCase();
  return p.printSides.find(side => side.toLowerCase() === want) || 'Front';
}

// The Wix product to sell: the back-print product for 'Back', else the main one.
export function wixProductIdFor(productKey, print) {
  const p = getProduct(productKey);
  return printSideFor(p.key, print) === 'Back' ? p.backWixProductId : p.wixProductId;
}

// 'Back' when a Wix product ID is one of the back-print products, else 'Front'.
export function printSideForWixProductId(wixProductId) {
  for (const p of Object.values(PRODUCTS)) {
    if (p.backWixProductId && p.backWixProductId === wixProductId) return 'Back';
  }
  return 'Front';
}

export function getPrintfulVariantIdFor(productKey, color, size) {
  const p = getProduct(productKey);
  // A product with only one size (the ornament and mug) needs no choice: a
  // paid Wix order for it carries no size at all, so use the only one there is.
  const pick = p.sizes.length === 1 ? p.sizes[0] : size;
  const id = p.variants[p.colors ? color : '']?.[pick];
  if (!id) throw new Error(`No Printful variant for ${p.label} ${p.colors ? `${color} / ` : ''}${size}.`);
  return id;
}

// Which product a paid Wix line item belongs to, from its Wix product ID.
export function productKeyForWixProductId(wixProductId) {
  for (const [key, p] of Object.entries(PRODUCTS)) {
    if (p.wixProductId === wixProductId || (p.backWixProductId && p.backWixProductId === wixProductId)) return key;
  }
  return null;
}

// What the page needs to build its dropdowns. No Printful IDs leave the server.
// app: 'legend' for Legend Maker's products; left off, Design Your Pet's, so
// every existing caller gets exactly the list it got before.
export function productListForPage(app) {
  const want = app === 'legend' ? 'legend' : 'pet';
  return Object.entries(PRODUCTS)
    .filter(([, p]) => appOfProduct(p) === want)
    .filter(([, p]) => !String(p.wixProductId).startsWith('PASTE_'))   // hide products not set up yet
    // ...and a product whose Printful variant isn't filled in yet, so it can't
    // be offered before it can be printed.
    .filter(([, p]) => Object.values(p.variants).every(sizes => Object.values(sizes).every(id => id > 0)))
    .map(([key, p]) => ({
      value: key,
      label: p.label,
      wixProductId: p.wixProductId,   // lets the page see which products are in the cart (bundle tracker)
      colors: p.colors,
      sizes: p.sizes,
      defaultColor: p.defaultColor || null,
      defaultSize: p.defaultSize,
      printSides: (p.printSides && p.backWixProductId) ? p.printSides : null,   // ['Front', 'Back'] on the tee and hoodie
      backWixProductId: p.backWixProductId || null,   // lets the page see a back print in the cart
      inBundle: !!p.inBundle,                         // counts toward "buy them all, 10% off"
      ownPreview: !!p.ownPreview                      // the page shows our own picture, not a Printful photo
    }));
}