// backend/appBackend.js
// Everything the Design Your Pet and Legend Maker PHONE APPS need, in one place.
// http-functions.js is only the front door: it reads the request, calls one
// function in this file, and sends the answer back.
//
// This file adds nothing new to how designs are made. It reuses the website's
// own code: startPetDesign, the product catalog, the Printful previews and the
// order pipeline in events.js. The rules stay the same:
//   - 5 good designs and 12 tries per device in any 24 hours, 180 site-wide an hour
//   - only the WATERMARKED preview ever leaves the server, never the print file
//   - every failure comes back as data ({ ok: false, code, message }), never a throw
//   - elevate() is always called inside a function, never when the file loads
//
// Plain backend file. It can't be called from a browser.

import wixData from 'wix-data';
import { fetch } from 'wix-fetch';
import { getSecret } from 'wix-secrets-backend';
import { elevate } from 'wix-auth';
import { cart, checkout, orders } from 'wix-ecom-backend';
import { files as mediaFiles } from '@wix/media';
import { auth } from '@wix/essentials';
import { productsV3 } from '@wix/stores';
import { reportDesign } from 'backend/designReports';
import { startPetDesign } from 'backend/aiDesign.web';
// LEGEND MAKER (added 16 Nov 2026): the second app, portraits of people.
import { startLegendDesign, LEGEND_PERSONAS } from 'backend/legendDesign.web';
import { createMockupTask, checkMockupTask } from 'backend/printfulMockup.web';
import { getDesignRecord } from 'backend/petDesigns';
import { PRODUCTS, getProduct, productListForPage, printSideFor, printSideForWixProductId, wixProductIdFor, DEFAULT_PRODUCT } from 'backend/productCatalog';
import { findWixVariantId } from 'backend/wixProduct';
import { PRINTFUL_BASE, printfulHeaders } from 'backend/printfulShared';

// ── SETTINGS ────────────────────────────────────────────────────────────────
// These MUST match the numbers at the top of aiDesign.web.js. The website
// enforces them either way; the copies here only tell the app what to show
// ("4 of 5 left, next one unlocks at 8:14 PM").
const MAX_GOOD_PER_DAY = 5;
const MAX_TRIES_PER_DAY = 12;
const GALLERY_DAYS = 7;

// A design still "generating" after this long is treated as failed. The
// website waits up to 3 minutes, so this is comfortably past that.
const STUCK_AFTER_MS = 5 * 60 * 1000;

const COLLECTION = 'PetDesigns';
const WIX_STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';
const DEVICE_PREFIX = 'app_';   // app designs are stored as visitorId "app_<device id>"

// The app's style names → the website's style keys. Both are accepted.
const STYLE_KEYS = {
  stamp: 'travelStamp',
  poster: 'travelPoster',
  evening: 'eveningPortrait',
  sticker: 'adventureSticker',
  job: 'onTheJob',          // added 30 Oct 2026
  sketch: 'pencilSketch',   // added 30 Oct 2026
  hero: 'animeHero',        // added 8 Nov 2026
  portrait: 'portraitStudio' // added 8 Nov 2026
};
const STYLE_LABELS = {
  travelStamp: 'Travel Stamp',
  travelPoster: 'Travel Poster',
  eveningPortrait: 'Evening Portrait',
  adventureSticker: 'Adventure Sticker',
  onTheJob: 'On the Job',
  pencilSketch: 'Pencil Sketch',
  animeHero: 'Anime Hero',
  portraitStudio: 'Portrait Studio'
};
// Styles whose text reaches the design. For On the Job the "text" is the job
// title the customer picked, and for Portrait Studio it is the sitting;
// aiDesign.web.js accepts only names on its own lists for those two. Anime
// Hero takes an optional pet name, like the Stamp and the Poster.
const TEXT_STYLES = ['travelStamp', 'travelPoster', 'onTheJob', 'animeHero', 'portraitStudio'];

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];

// ── LEGEND MAKER (added 16 Nov 2026) ────────────────────────────────────────
// The Legend Maker app sends the header  X-App: legend  with every request.
// Design Your Pet sends no such header, so everything it does is untouched:
// every Legend Maker branch below sits behind isLegendApp() or isLegendDesign().
function isLegendApp(app) {
  return String(app || '').trim().toLowerCase() === 'legend';
}
// 'monarch' (what the app sends), 'legendMonarch' or 'The Monarch' → 'legendMonarch'.
// Kept here, not imported: a function exported from a .web.js file comes
// back as a remote call that answers with a Promise, not a value.
function legendPersonaKey(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return null;
  for (const [key, p] of Object.entries(LEGEND_PERSONAS)) {
    if (key.toLowerCase() === v || p.appKey === v || p.label.toLowerCase() === v) return key;
  }
  return null;
}
// A design made by Legend Maker, told by its style (a persona key).
function isLegendDesign(d) {
  return !!(d && LEGEND_PERSONAS[d.styleChoice]);
}
// Legend Maker's product lookups live here, reading PRODUCTS, rather than
// being imported. 20 Nov 2026: importing new names from productCatalog.js
// left this whole file empty on the live site (every export "is not a
// function"), so this file imports only the names it always has.
const DEFAULT_LEGEND_PRODUCT = 'legendPoster';
function appOfProduct(p) {
  return p && p.app === 'legend' ? 'legend' : 'pet';
}
function catalogKeyFor(app, appKey) {
  const want = app === 'legend' ? 'legend' : 'pet';
  const k = String(appKey || '');
  if (want === 'pet') return PRODUCTS[k] && appOfProduct(PRODUCTS[k]) === 'pet' ? k : null;
  if (PRODUCTS[k] && appOfProduct(PRODUCTS[k]) === 'legend') return k;
  const hit = Object.entries(PRODUCTS).find(([, p]) => appOfProduct(p) === 'legend' && p.appKey === k);
  return hit ? hit[0] : null;
}

// The product a design may be printed on. A Legend Maker design goes only on
// Legend Maker products, and the app calls them 'tee', 'poster', 'canvas'...
// A pet design goes only on pet products, looked up exactly as before.
// Throws with a plain reason; callers turn that into bad_product.
function productForDesign(d, productKey) {
  if (isLegendDesign(d)) {
    const key = productKey ? catalogKeyFor('legend', productKey) : DEFAULT_LEGEND_PRODUCT;
    if (!key) throw new Error(`Legend Maker doesn't sell "${productKey}".`);
    return getProduct(key);
  }
  const p = getProduct(productKey);
  if (appOfProduct(p) !== 'pet') throw new Error(`Design Your Pet doesn't sell "${productKey}".`);
  return p;
}
// The display name of any design's style, pet or person.
function styleLabelOf(d) {
  const key = d && d.styleChoice;
  if (LEGEND_PERSONAS[key]) return LEGEND_PERSONAS[key].label;
  return STYLE_LABELS[key] || key;
}
// ────────────────────────────────────────────────────────────────────────────

// ============================================================================
// SMALL HELPERS
// ============================================================================

export function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

// The app sends a random ID it made on first launch (header X-Device-Id).
// Anything that doesn't look like one is refused rather than guessed at.
export function deviceToVisitorId(deviceId) {
  const id = String(deviceId || '').trim();
  if (!/^[A-Za-z0-9-]{16,64}$/.test(id)) return null;
  return DEVICE_PREFIX + id;
}

function styleKeyFrom(style) {
  const s = String(style || '').trim();
  if (STYLE_LABELS[s]) return s;
  return STYLE_KEYS[s] || null;
}

// The design's watermarked preview. The print file (generatedArtUrl) is only
// ever returned by artworkOf() below, and only for a paid order.
function previewOf(d) {
  return d && d.previewArtUrl ? d.previewArtUrl : null;
}

// FREE ARTWORK WITH ANY ORDER (added 13 Nov 2026).
// Once an order is paid, each design on it comes with its full-size print file
// (no watermark) to keep. Nothing is returned for an unpaid, refunded or
// cancelled order, so the file can't be had by starting a checkout and walking
// away. Ordered designs are kept, so the link keeps working.
const ARTWORK_PAID = new Set(['PAID']);
function orderEarnsArtwork(o) {
  return o && o.status !== 'CANCELED' && ARTWORK_PAID.has(o.paymentStatus);
}
function artworkOf(d) {
  const u = d && d.generatedArtUrl ? String(d.generatedArtUrl) : '';
  if (!u) return null;
  if (u.startsWith('https://')) return u;
  // wix:image://v1/<fileId>/<name>#... → the public file address
  const m = u.match(/^wix:image:\/\/v1\/([^/#]+)/);
  return m ? `https://static.wixstatic.com/media/${m[1]}` : null;
}

async function loadOwnDesign(designId, visitorId) {
  if (!designId || typeof designId !== 'string') return null;
  let d;
  try { d = await getDesignRecord(designId); } catch (e) { return null; }
  // Another device's design, or a website design, is "not found" to this device.
  if (!d || d.visitorId !== visitorId) return null;
  return d;
}

// ============================================================================
// OPTIONAL APP KEY
// ============================================================================
// If you add a secret named DESIGN_APP_KEY in the Secrets Manager, every call
// must carry the same value in an X-App-Key header. It's baked into the app,
// so it won't stop a determined person, but it stops casual scripts poking the
// endpoints. No secret = no check.

let appKeyCache = { value: undefined, time: 0 };
export async function appKeyOk(sentKey) {
  if (appKeyCache.value === undefined || Date.now() - appKeyCache.time > 10 * 60 * 1000) {
    try { appKeyCache = { value: String(await getSecret('DESIGN_APP_KEY') || '').trim(), time: Date.now() }; }
    catch (e) { appKeyCache = { value: '', time: Date.now() }; }
  }
  if (!appKeyCache.value) return true;
  return String(sentKey || '').trim() === appKeyCache.value;
}

// ============================================================================
// ALLOWANCE: "4 of 5 designs left, next one unlocks at 8:14 PM"
// ============================================================================
// Same rolling 24 hours as the website. unlockAt is when the OLDEST design in
// the window turns 24 hours old, which is the moment a slot opens.

export async function getAllowance(visitorId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const good = await wixData.query(COLLECTION)
    .eq('visitorId', visitorId)
    .gt('_createdDate', since)
    .hasSome('status', ['ready', 'flagged', 'ordered'])
    .ascending('_createdDate')
    .limit(MAX_GOOD_PER_DAY)
    .find({ suppressAuth: true });

  const tries = await wixData.query(COLLECTION)
    .eq('visitorId', visitorId)
    .gt('_createdDate', since)
    .ascending('_createdDate')
    .limit(MAX_TRIES_PER_DAY)
    .find({ suppressAuth: true });

  const goodCount = good.totalCount;
  const tryCount = tries.totalCount;
  const unlock = (items) => items.length
    ? new Date(new Date(items[0]._createdDate).getTime() + 24 * 60 * 60 * 1000).toISOString()
    : null;

  return {
    designsUsed: goodCount,
    designsLeft: Math.max(0, MAX_GOOD_PER_DAY - goodCount),
    designsLimit: MAX_GOOD_PER_DAY,
    // When the next design slot opens. null when nothing has been used.
    designUnlockAt: unlock(good.items),
    triesUsed: tryCount,
    triesLeft: Math.max(0, MAX_TRIES_PER_DAY - tryCount),
    triesLimit: MAX_TRIES_PER_DAY,
    tryUnlockAt: unlock(tries.items)
  };
}

// The design still being made on this device, if any. Used to keep it to one
// at a time: a second design started while one is running wouldn't count
// toward the 5 until it finished, so the limit could be overshot.
async function findInProgress(visitorId) {
  const since = new Date(Date.now() - STUCK_AFTER_MS);
  const res = await wixData.query(COLLECTION)
    .eq('visitorId', visitorId)
    .eq('status', 'pending')
    .gt('_createdDate', since)
    .descending('_createdDate')
    .limit(1)
    .find({ suppressAuth: true });
  return res.items[0] || null;
}

// ============================================================================
// PRODUCTS AND PRICES
// ============================================================================
// Colours and sizes come from productCatalog.js (the same list the website
// uses). Prices come from the Wix Stores products themselves, so when you
// change a price in the dashboard the app follows within 10 minutes.

const priceCache = new Map();

async function loadPrices(wixProductId) {
  const hit = priceCache.get(wixProductId);
  if (hit && Date.now() - hit.time < 10 * 60 * 1000) return hit.list;

  const getProductElevated = auth.elevate(productsV3.getProduct);
  const res = await getProductElevated(wixProductId, { fields: ['VARIANT_OPTION_CHOICE_NAMES'] });
  const product = /** @type {any} */ (res).product || res;

  const list = [];
  for (const v of (product?.variantsInfo?.variants) || []) {
    const picked = {};
    for (const c of v.choices || []) {
      const opt = c.optionChoiceNames?.optionName;
      if (opt) picked[opt.trim().toLowerCase()] = String(c.optionChoiceNames?.choiceName || '').trim();
    }
    const amount = Number(v.price?.actualPrice?.amount ?? v.price?.amount ?? NaN);
    list.push({
      color: picked.color || picked.colour || '',
      size: picked.size || '',
      print: picked.print || '',
      price: Number.isFinite(amount) ? amount : null
    });
  }
  priceCache.set(wixProductId, { list, time: Date.now() });
  return list;
}

export async function getProductsForApp(app) {
  const products = [];
  const legend = isLegendApp(app);
  for (const p of productListForPage(legend ? 'legend' : undefined)) {
    const entry = PRODUCTS[p.value];
    const out = {
      // Legend Maker's app knows its products by their short names.
      key: legend ? (entry.appKey || p.value) : p.value,
      label: p.label,
      colors: p.colors,              // null for sticker and poster
      sizes: p.sizes,
      defaultColor: p.defaultColor,
      defaultSize: p.defaultSize,
      sleeveLogo: !!entry.sleeveLogo,
      prices: {},                    // { size: price } for a FRONT print (same for every colour)
      priceFrom: null,
      priceTo: null,
      // BACK PRINT (added 29 Oct 2026). Only sent when the back-print product
      // exists and its prices could be read, so the app can't offer a choice
      // Wix can't sell.
      printSides: null,              // ['Front', 'Back'] when available
      backPrices: null               // { size: price } for a back print
    };
    try {
      const list = await loadPrices(entry.wixProductId);
      // Ornament and mug (16 Nov 2026) have no size option in Wix, so their
      // one variant carries no size: it is the price of their only size.
      const oneSize = p.sizes.length === 1;
      for (const size of p.sizes) {
        const v = list.find(x => (x.size === size || (oneSize && !x.size)) && (x.print || 'Front') === 'Front' && x.price != null);
        if (v) out.prices[size] = v.price;
      }
      if (entry.printSides && entry.backWixProductId) {
        try {
          const backList = await loadPrices(entry.backWixProductId);
          const backPrices = {};
          for (const size of p.sizes) {
            const v = backList.find(x => x.size === size && x.price != null);
            if (v) backPrices[size] = v.price;
          }
          if (Object.keys(backPrices).length) {
            out.printSides = entry.printSides;
            out.backPrices = backPrices;
          }
        } catch (e) {
          console.warn(`App products: couldn't read back-print prices for ${p.value}: ${e.message}`);
        }
      }
      const all = Object.values(out.prices);
      if (all.length) { out.priceFrom = Math.min(...all); out.priceTo = Math.max(...all); }
    } catch (e) {
      // Prices missing is not fatal. The app shows the product without them,
      // and checkout always charges the real Wix price anyway.
      console.warn(`App products: couldn't read prices for ${p.value}: ${e.message}`);
    }
    products.push(out);
  }
  return {
    ok: true,
    products,
    defaultProduct: legend ? ((PRODUCTS[DEFAULT_LEGEND_PRODUCT] || {}).appKey || 'poster') : DEFAULT_PRODUCT,
    styles: isLegendApp(app)
      ? Object.entries(LEGEND_PERSONAS).map(([key, p]) => ({
          key: p.appKey, styleKey: key, label: p.label, allowsText: p.allowsText
        }))
      : Object.entries(STYLE_KEYS).map(([appKey, key]) => ({
          key: appKey, styleKey: key, label: STYLE_LABELS[key], allowsText: TEXT_STYLES.includes(key)
        })),
    maxTextLength: 18
  };
}

// ============================================================================
// STEP 1: PHOTO UPLOAD
// ============================================================================
// The app never sends the photo through this backend (Wix caps request sizes).
// It asks for a one-time upload address, then sends the photo straight to the
// Wix Media Manager:
//
//   1. POST /_functions/uploadUrl  { mimeType: "image/jpeg" }
//      → { ok: true, uploadUrl }
//   2. PUT  <uploadUrl>?filename=pet.jpg   (body = the photo bytes,
//                                            Content-Type = the same mimeType)
//      → Wix answers { file: { id, url, ... } }
//   3. POST /_functions/designs  { fileId: file.id, style, text }
//
// Limits are checked here too, so a device that's out of designs is told so
// BEFORE the customer uploads a photo, not after.

export async function createUploadUrl(visitorId, body) {
  const mimeType = String(body?.mimeType || 'image/jpeg').toLowerCase();
  if (!PHOTO_TYPES.includes(mimeType)) {
    return fail('bad_photo_type', 'Please choose a JPEG, PNG or HEIC photo.');
  }

  const limitProblem = await checkLimits(visitorId);
  if (limitProblem) return limitProblem;

  const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');
  const fileName = `app-pet-${Date.now()}.${ext}`;
  const generate = auth.elevate(mediaFiles.generateFileUploadUrl);
  try {
    let res;
    try {
      res = await generate(mimeType, { fileName, filePath: '/app-uploads' });
    } catch (e) {
      // Older accounts refuse filePath. Try again straight into the root.
      console.warn(`uploadUrl: filePath refused (${e.message}), retrying without it.`);
      res = await generate(mimeType, { fileName });
    }
    return { ok: true, uploadUrl: res.uploadUrl, fileName };
  } catch (e) {
    console.error(`uploadUrl failed: ${e.message}`);
    return fail('upload_unavailable', 'Photo upload is unavailable right now. Please try again in a minute.');
  }
}

// ============================================================================
// STEP 2: START A DESIGN
// ============================================================================

// Returns null when the device may make a design, or the matching problem.
async function checkLimits(visitorId) {
  const a = await getAllowance(visitorId);
  if (a.designsLeft <= 0) {
    return fail('limit_designs', `That's ${MAX_GOOD_PER_DAY} for now.`, { unlockAt: a.designUnlockAt, allowance: a });
  }
  if (a.triesLeft <= 0) {
    return fail('limit_tries', `That's ${MAX_TRIES_PER_DAY} tries today, which is the limit.`, { unlockAt: a.tryUnlockAt, allowance: a });
  }
  return null;
}

// Wix media file IDs look like "94607f_1a2b3c...~mv2.jpg".
function cleanFileId(raw) {
  const id = String(raw || '').trim();
  return /^[A-Za-z0-9_~.-]{6,120}$/.test(id) ? id : null;
}

// A freshly uploaded photo takes a moment before Wix can serve it.
async function photoReady(fileId) {
  const readDescriptor = auth.elevate(mediaFiles.getFileDescriptor);
  const started = Date.now();
  let delay = 400;
  while (Date.now() - started < 8000) {
    try {
      const d = await readDescriptor(fileId);
      if (d?.mediaType && d.mediaType !== 'IMAGE') return { ok: false, notImage: true };
      if (d?.operationStatus === 'READY') return { ok: true, url: d.url };
      if (d?.operationStatus === 'FAILED') return { ok: false };
    } catch (e) { /* not there yet */ }
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 1500);
  }
  return { ok: false, pending: true };
}

// The steps startPetDesign and startLegendDesign name when they stop, as the
// codes the apps pick a screen with.
const START_CODES = {
  'daily limit': 'limit_designs',
  'attempt ceiling': 'limit_tries',
  'site busy': 'studio_busy',
  'text': 'text_rejected',
  'text checker': 'text_checker_down',
  'style': 'bad_style',
  'job': 'bad_style',
  'consent': 'consent_needed'
};

// LEGEND MAKER's version of startDesign. Same checks in the same order; the
// differences are the persona, and the promise about whose photo it is.
// Body: { fileId, style, text?, who, whoConsent }
async function startLegendDesignForApp(visitorId, body) {
  const personaKey = legendPersonaKey(body?.style);
  if (!personaKey) {
    return fail('bad_style', `Unknown style. Use one of: ${Object.values(LEGEND_PERSONAS).map(p => p.appKey).join(', ')}.`);
  }
  // WHOSE PORTRAIT IT IS. The app keeps Generate disabled until the customer
  // has picked self, gift or memorial and ticked that answer's promise. This
  // is the same rule on the server, so an old or tampered app can't skip it.
  const who = String(body?.who || '').trim().toLowerCase();
  if (!['self', 'gift', 'memorial'].includes(who) || body?.whoConsent !== true) {
    return fail('consent_needed', 'Please tell us who is in the photo and tick the box that goes with it.');
  }
  const fileId = cleanFileId(body?.fileId);
  if (!fileId) return fail('bad_photo', 'The photo reference is missing. Please upload the photo again.');

  const running = await findInProgress(visitorId);
  if (running) {
    return fail('one_at_a_time', 'Your last design is still being made.', { designId: running._id });
  }
  const limitProblem = await checkLimits(visitorId);
  if (limitProblem) return limitProblem;

  const ready = await photoReady(fileId);
  if (!ready.ok) {
    if (ready.notImage) return fail('bad_photo', 'That file isn\'t a photo.');
    return fail('upload_not_ready', 'Your photo is still arriving. Trying again…', { retryAfterMs: 2000 });
  }

  const photoUrl = `wix:image://v1/${fileId}/${fileId}`;
  const persona = LEGEND_PERSONAS[personaKey];
  const text = persona.allowsText ? String(body?.text || '') : '';

  const r = await startLegendDesign(photoUrl, personaKey, visitorId, text, who, true);
  if (r && r.ok) {
    return { ok: true, designId: r.designRecordId, style: persona.label };
  }
  const step = r?.step || '';
  const code = START_CODES[step] || 'server_error';
  if (code === 'server_error') console.error(`App startLegendDesign: ${step}: ${r?.reason}`);
  const extra = {};
  if (code === 'limit_designs' || code === 'limit_tries') {
    const a = await getAllowance(visitorId);
    extra.allowance = a;
    extra.unlockAt = code === 'limit_designs' ? a.designUnlockAt : a.tryUnlockAt;
  }
  return fail(code, r?.reason || 'Something went wrong starting your design.', extra);
}

export async function startDesign(visitorId, body, app) {
  if (isLegendApp(app)) return startLegendDesignForApp(visitorId, body);
  const styleKey = styleKeyFrom(body?.style);
  if (!styleKey) {
    return fail('bad_style', `Unknown style. Use one of: ${Object.keys(STYLE_KEYS).join(', ')}.`);
  }
  const fileId = cleanFileId(body?.fileId);
  if (!fileId) return fail('bad_photo', 'The photo reference is missing. Please upload the photo again.');

  // One at a time. If one is still being made, hand its ID back so the app
  // can go straight back to the progress screen instead of starting another.
  const running = await findInProgress(visitorId);
  if (running) {
    return fail('one_at_a_time', 'Your last design is still being made.', { designId: running._id });
  }

  const limitProblem = await checkLimits(visitorId);
  if (limitProblem) return limitProblem;

  const ready = await photoReady(fileId);
  if (!ready.ok) {
    if (ready.notImage) return fail('bad_photo', 'That file isn\'t a photo.');
    // Nothing was used up. The app waits two seconds and tries again.
    return fail('upload_not_ready', 'Your photo is still arriving. Trying again…', { retryAfterMs: 2000 });
  }

  // wix:image:// form, so the website code can delete a refused photo.
  const photoUrl = `wix:image://v1/${fileId}/${fileId}`;
  const text = TEXT_STYLES.includes(styleKey) ? String(body?.text || '') : '';

  // PEOPLE IN THE DESIGN. Only drawn when the switch is on AND the customer
  // ticked "Everyone in this photo is 13 or older and agreed to be in the
  // design". The app keeps Generate disabled until then; this is the same rule
  // enforced on the server, so an old or tampered app can't skip it.
  const includePeople = body?.includePeople === true;
  if (includePeople && body?.peopleConsent !== true) {
    return fail('people_consent_needed', 'Please confirm everyone in the photo is 13 or older and agreed to be in the design.');
  }

  const r = await startPetDesign(photoUrl, styleKey, visitorId, text, includePeople);
  if (r && r.ok) {
    return { ok: true, designId: r.designRecordId, style: STYLE_LABELS[styleKey] };
  }

  // startPetDesign names what stopped it in `step`. Turn that into a code the
  // app can pick a screen with.
  const step = r?.step || '';
  const codes = {
    'daily limit': 'limit_designs',
    'attempt ceiling': 'limit_tries',
    'site busy': 'studio_busy',
    'text': 'text_rejected',
    'text checker': 'text_checker_down',
    'style': 'bad_style',
    'job': 'bad_style'
  };
  const code = codes[step] || 'server_error';
  if (code === 'server_error') console.error(`App startDesign: ${step}: ${r?.reason}`);
  const extra = {};
  if (code === 'limit_designs' || code === 'limit_tries') {
    const a = await getAllowance(visitorId);
    extra.allowance = a;
    extra.unlockAt = code === 'limit_designs' ? a.designUnlockAt : a.tryUnlockAt;
  }
  return fail(code, r?.reason || 'Something went wrong starting your design.', extra);
}

// ============================================================================
// STEP 3: IS IT READY?
// ============================================================================
// The app asks every 2 seconds. status is one of:
//   working         still being made
//   ready           done; previewUrl is the watermarked picture
//   no_pet          no animal found (photo already deleted, doesn't count)
//   no_person       Legend Maker: no clear face found (photo deleted, doesn't count)
//   photo_rejected  failed the content check (photo deleted, doesn't count)
//   checker_down    the photo checker was unavailable (doesn't count)
//   failed          didn't come out clean enough (doesn't count toward 5)

export async function getDesignForApp(visitorId, designId) {
  const d = await loadOwnDesign(designId, visitorId);
  if (!d) return fail('not_found', 'We couldn\'t find that design.');

  const note = String(d.moderationNote || '');
  let status;
  switch (d.status) {
    case 'ready':
    case 'flagged':
    case 'ordered':
      status = previewOf(d) ? 'ready' : 'failed';
      break;
    case 'pending':
      status = Date.now() - new Date(d._createdDate).getTime() > STUCK_AFTER_MS ? 'failed' : 'working';
      break;
    case 'blocked':
      if (isLegendDesign(d) && /^No clear face/i.test(note)) status = 'no_person';
      else if (note === 'No animal in the photo.') status = 'no_pet';
      else if (note === 'Gemini returned no image.') status = 'failed';
      else status = 'photo_rejected';
      break;
    case 'error':
      status = /photo checker is busy/i.test(note) ? 'checker_down' : 'failed';
      break;
    default:
      status = 'failed';   // 'unclean' and anything unexpected
  }

  // Why a photo was refused, so the app can word its screen:
  // child | famous | too_many | content
  let reason = null;
  if (status === 'photo_rejected' && isLegendDesign(d)) {
    // Legend Maker: minor | famous | too_many | content. Read from the note's
    // wording, as for pets, not from strings imported from the .web.js file:
    // that file's exports reach other backend files through Wix's remote-call
    // wrapper, so a plain import is not guaranteed to arrive as a value.
    reason = /someone under 18/i.test(note) ? 'minor'
      : /well-known person/i.test(note) ? 'famous'
      : /more than one person/i.test(note) ? 'too_many'
      : 'content';
  } else if (status === 'photo_rejected') {
    reason = /child in the photo/i.test(note) ? 'child'
      : /well-known person/i.test(note) ? 'famous'
      : /too many people/i.test(note) ? 'too_many'
      : 'content';
  }

  const out = {
    ok: true,
    designId: d._id,
    status,
    reason,
    includePeople: d.includePeople === true,
    style: styleLabelOf(d),
    text: d.customText || '',
    createdAt: d._createdDate,
    previewUrl: status === 'ready' ? previewOf(d) : null
  };
  // After a finish or failure, the updated count so the app can show
  // "4 of 5 designs available" without another call.
  if (status !== 'working') out.allowance = await getAllowance(visitorId);
  return out;
}

// "Your designs": this device's finished designs from the last 7 days.
export async function listDesignsForApp(visitorId) {
  const since = new Date(Date.now() - GALLERY_DAYS * 24 * 60 * 60 * 1000);
  const res = await wixData.query(COLLECTION)
    .eq('visitorId', visitorId)
    .gt('_createdDate', since)
    .hasSome('status', ['ready', 'flagged', 'ordered'])
    .descending('_createdDate')
    .limit(30)
    .find({ suppressAuth: true });

  const designs = res.items
    .filter(d => previewOf(d))
    .map(d => ({
      designId: d._id,
      style: styleLabelOf(d),
      text: d.customText || '',
      includePeople: d.includePeople === true,
      previewUrl: previewOf(d),
      createdAt: d._createdDate,
      // Unordered designs are deleted by the nightly clean-up after 7 days.
      expiresAt: d.status === 'ordered' ? null
        : new Date(new Date(d._createdDate).getTime() + GALLERY_DAYS * 24 * 60 * 60 * 1000).toISOString()
    }));

  const inProgress = await findInProgress(visitorId);
  return {
    ok: true,
    designs,
    inProgressDesignId: inProgress ? inProgress._id : null,
    allowance: await getAllowance(visitorId)
  };
}

// ============================================================================
// STEP 4: PRODUCT PREVIEWS (Printful mockups)
// ============================================================================
// The app sends the design ID, not an image address. The server looks up the
// watermarked preview itself, so nobody can use this to mock up other art.

export async function startMockup(visitorId, body) {
  const d = await loadOwnDesign(body?.designId, visitorId);
  if (!d || !previewOf(d)) return fail('not_found', 'We couldn\'t find that design.');

  let product;
  try { product = productForDesign(d, body?.productKey); }
  catch (e) { return fail('bad_product', e.message); }

  const color = product.colors ? String(body?.color || product.defaultColor) : '';
  const size = String(body?.size || product.defaultSize);
  const side = printSideFor(product.key, body?.print);

  const r = await createMockupTask(previewOf(d), color, size, product.key, side);
  if (!r?.ok) {
    console.error(`App mockup ${product.key} ${color}/${size}: ${r?.step}: ${r?.reason}`);
    return fail('mockup_failed', 'The product preview couldn\'t be made right now.');
  }
  return { ok: true, taskKey: r.taskKey };
}

export async function getMockup(taskKey) {
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(String(taskKey || ''))) return fail('bad_request', 'Bad preview key.');
  try {
    const r = await checkMockupTask(taskKey);
    if (r?.status === 'completed') {
      const urls = (r.mockups || []).flatMap(m => [m.mockup_url, ...((m.extra || []).map(x => x.url))]).filter(Boolean);
      // Which side of the garment each main picture shows ('front', 'back'),
      // so a back-print preview can open on the back (added 29 Oct 2026).
      const mockups = (r.mockups || []).filter(m => m.mockup_url).map(m => ({ placement: m.placement || '', url: m.mockup_url }));
      return { ok: true, status: 'ready', mockupUrl: urls[0] || null, mockupUrls: urls, mockups };
    }
    if (r?.status === 'failed') return { ok: true, status: 'failed' };
    return { ok: true, status: 'working' };
  } catch (e) {
    return fail('mockup_failed', 'The product preview couldn\'t be checked right now.');
  }
}

// ============================================================================
// STEP 5: CHECKOUT
// ============================================================================
// The app sends its whole cart:
//   { items: [ { designId, productKey, color, size, quantity }, ... ] }
// The server builds a real Wix cart from it (same hidden products, same
// designRecordId line the website uses, so events.js and Printful work exactly
// as they do for website orders), turns it into a Wix checkout, and returns
// the checkout page address. The app opens that page in a browser sheet; the
// customer pays with card, PayPal, Apple Pay or Google Pay there.
//
// Automatic discounts (your 10% bundle discount) apply on their own, because
// this is an ordinary Wix cart.

export async function createAppCheckout(visitorId, body) {
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) return fail('empty_cart', 'Your cart is empty.');
  if (items.length > 20) return fail('bad_request', 'That cart has too many lines.');

  const lineItems = [];
  for (const [i, item] of items.entries()) {
    const d = await loadOwnDesign(item?.designId, visitorId);
    if (!d || !['ready', 'flagged', 'ordered'].includes(d.status)) {
      console.warn(`App checkout: design ${item?.designId} refused — ${d ? 'status ' + d.status : 'not found for this device'}`);
      return fail('design_unavailable', 'One of the designs in your cart is no longer available.', { index: i });
    }

    let product;
    try { product = productForDesign(d, item.productKey); }
    catch (e) { return fail('bad_product', e.message, { index: i }); }

    // Colour and size are matched loosely (12 Nov 2026): the app writes a
    // sticker as "4x4" and a poster as "16×16", and the catalog may spell
    // them "4×4" or 4″ × 4″. The bundle (sticker + poster in one go) failed
    // checkout on that alone. The catalog's own spelling is what's used next.
    const color = product.colors ? sameAs(product.colors, item.color) : '';
    const size = sameAs(product.sizes, item.size);
    if ((product.colors && !color) || !size) {
      console.warn(`App checkout: ${product.key} refused — colour "${item.color}" / size "${item.size}" not in [${(product.colors || []).join(', ')}] / [${product.sizes.join(', ')}]`);
      return fail('bad_choice', `${product.label}: pick a ${product.colors ? 'color and ' : ''}size.`, { index: i, productKey: product.key });
    }
    const quantity = Math.max(1, Math.min(10, parseInt(item.quantity, 10) || 1));
    // 'Front' unless the app asked for 'Back' (tee and hoodie only).
    const print = printSideFor(product.key, item.print);

    let wixVariantId;
    try { wixVariantId = await findWixVariantId(color, size, product.key, print); }
    catch (e) {
      console.error(`App checkout: ${e.message}`);
      return fail('bad_choice', `${product.label} ${color ? color + ' / ' : ''}${size}${print === 'Back' ? ' (back print)' : ''} isn't available.`, { index: i });
    }

    lineItems.push({
      catalogReference: {
        appId: WIX_STORES_APP_ID,
        catalogItemId: wixProductIdFor(product.key, print),   // the "- Back Print" product for a back print
        options: { variantId: wixVariantId, customTextFields: { 'Design ID': String(d._id) } }
      },
      quantity,
      catalogOverrideFields: {
        // Same three lines the website adds. events.js finds the design by
        // "designRecordId"; the other two are for you and the customer.
        descriptionLines: [
          { name: { original: 'designRecordId' }, plainText: { original: d._id } },
          ...(product.colors ? [{ name: { original: 'Color' }, plainText: { original: color } }] : []),
          { name: { original: 'Size' }, plainText: { original: size } },
          ...(product.printSides ? [{ name: { original: 'Print' }, plainText: { original: print } }] : [])
        ],
        // The customer's design as the cart thumbnail. Needs admin rights,
        // which this backend has; if Wix refuses it anyway we retry without.
        image: wixImageFromStatic(previewOf(d))
      }
    });
  }

  try {
    let newCart;
    try {
      newCart = await elevate(cart.createCart)({ lineItems });
    } catch (e) {
      console.warn(`App checkout: cart with thumbnails refused (${e.message}); retrying without.`);
      for (const li of lineItems) delete li.catalogOverrideFields.image;
      newCart = await elevate(cart.createCart)({ lineItems });
    }
    const { checkoutId } = await elevate(cart.createCheckout)(newCart._id, { channelType: 'WEB' });
    const { checkoutUrl } = await elevate(checkout.getCheckoutUrl)(checkoutId);

    // The real totals from Wix, discount included, for the app's review screen.
    let summary = null;
    try {
      const co = await elevate(checkout.getCheckout)(checkoutId);
      summary = moneySummary(co.priceSummary);
    } catch (e) { /* the page still works without the summary */ }

    return { ok: true, checkoutId, checkoutUrl, summary };
  } catch (e) {
    console.error(`App checkout failed: ${e.message}`);
    return fail('checkout_failed', 'Checkout isn\'t available right now. Please try again in a minute.');
  }
}

// The catalog's own spelling of a colour or size the app sent, or '' if
// there's none. Ignores case, spaces, inch marks and x versus ×.
function sameAs(list, wanted) {
  const norm = (v) => String(v || '').toLowerCase().replace(/[″"”'\s]/g, '').replace(/[×✕*]/g, 'x');
  const w = norm(wanted);
  return w ? (list || []).find(v => norm(v) === w) || '' : '';
}

function moneySummary(ps) {
  if (!ps) return null;
  const m = (x) => (x ? { amount: Number(x.amount || 0), formatted: x.formattedAmount || '' } : null);
  return { subtotal: m(ps.subtotal), discount: m(ps.discount), shipping: m(ps.shipping), tax: m(ps.tax), total: m(ps.total) };
}

// https://static.wixstatic.com/media/<id>  →  wix:image://v1/<id>/<id>
function wixImageFromStatic(url) {
  const m = String(url || '').match(/static\.wixstatic\.com\/media\/([^/?#]+)/);
  return m ? `wix:image://v1/${m[1]}/${m[1]}` : undefined;
}

// After the browser sheet closes, the app asks whether the customer paid.
// completed: false just means they closed it without paying. The cart is
// still theirs.
export async function getCheckoutResult(visitorId, checkoutId) {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(String(checkoutId || ''))) return fail('bad_request', 'Bad checkout ID.');
  try {
    const co = await elevate(checkout.getCheckout)(checkoutId);
    if (!co?.completed) return { ok: true, completed: false };

    // The order behind it, for "ORDER #10042" on the confirmation screen.
    const recent = await searchRecentOrders(1);
    const order = recent.find(o => o.checkoutId === checkoutId);
    return { ok: true, completed: true, orderNumber: order ? String(order.number) : null };
  } catch (e) {
    console.error(`App checkout status ${checkoutId}: ${e.message}`);
    return fail('server_error', 'Couldn\'t check that order right now.');
  }
}

// ============================================================================
// MY ORDERS
// ============================================================================
// No account needed: an order belongs to this device if any of its lines
// carries one of this device's designs. The stage comes from Printful:
//   Printful draft          → "In review"  (you check every order by hand)
//   pending / in process    → "Printing"
//   fulfilled / shipped     → "Shipped", with the tracking link
//   Wix order cancelled     → "Cancelled"

async function searchRecentOrders(pages) {
  const found = [];
  let cursor;
  for (let i = 0; i < pages; i++) {
    const res = await elevate(orders.searchOrders)({
      cursorPaging: cursor ? { limit: 100, cursor } : { limit: 100 }
    });
    found.push(...(res.orders || []));
    cursor = res.metadata?.cursors?.next || res.pagingMetadata?.cursors?.next;
    if (!cursor) break;
  }
  return found;
}

function lineField(li, name) {
  const l = (li.descriptionLines || []).find(x => x.name?.original === name);
  return l?.plainText?.original || l?.colorInfo?.original || '';
}

// Must match how printfulOrders.js builds it.
  function externalIdFor(order, lineItem) {
    const lineTail = String(lineItem._id || lineItem.id || '').replace(/[^A-Za-z0-9]/g, '').slice(-12);
    return `${order.number || String(order._id).replace(/[^A-Za-z0-9]/g, '').slice(0, 12)}-${lineTail}`
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, 32);
  }

async function printfulStage(externalId, headers) {
  try {
    const resp = await fetch(`${PRINTFUL_BASE}/orders/@${encodeURIComponent(externalId)}`, { method: 'GET', headers });
    if (resp.status === 404) return { stage: 'In review', tracking: null };
    const json = await resp.json();
    if (!resp.ok) return { stage: 'In review', tracking: null };
    const o = json.result || {};
    const shipments = o.shipments || [];
    const tracking = shipments.map(s => s.tracking_url).filter(Boolean)[0] || null;
    if (o.status === 'canceled') return { stage: 'Cancelled', tracking: null };
    if (shipments.some(s => s.status === 'delivered' || s.delivered_at)) return { stage: 'Delivered', tracking };
    if (o.status === 'fulfilled' || shipments.length) return { stage: 'Shipped', tracking };
    if (o.status === 'draft') return { stage: 'In review', tracking: null };
    return { stage: 'Printing', tracking: null };
  } catch (e) {
    return { stage: 'In review', tracking: null };
  }
}

const STAGE_ORDER = ['In review', 'Printing', 'Shipped', 'Delivered'];

export async function listOrdersForApp(visitorId) {
  // Every design this device has made (ordered ones are never cleaned up).
  const mine = await wixData.query(COLLECTION)
    .eq('visitorId', visitorId)
    .limit(1000)
    .find({ suppressAuth: true });
  const myDesigns = new Map(mine.items.map(d => [d._id, d]));
  if (!myDesigns.size) return { ok: true, orders: [] };

  let recent;
  try { recent = await searchRecentOrders(3); }
  catch (e) {
    console.error(`App orders: ${e.message}`);
    return fail('server_error', 'Your orders couldn\'t be loaded right now.');
  }

  const headers = await printfulHeaders();
  const out = [];
  for (const o of recent) {
    const lines = (o.lineItems || []).filter(li => myDesigns.has(lineField(li, 'designRecordId')));
    if (!lines.length) continue;

    const items = [];
    let lowest = STAGE_ORDER.length - 1;
    let tracking = null;
    for (const li of lines) {
      const d = myDesigns.get(lineField(li, 'designRecordId'));
      const st = o.status === 'CANCELED'
        ? { stage: 'Cancelled', tracking: null }
        : await printfulStage(externalIdFor(o, li), headers);
      const idx = STAGE_ORDER.indexOf(st.stage);
      if (idx >= 0) lowest = Math.min(lowest, idx);
      tracking = tracking || st.tracking;
      items.push({
        title: li.productName?.original || 'Design Your Pet',
        detail: [lineField(li, 'Color'), lineField(li, 'Size'), (lineField(li, 'Print') === 'Back' || printSideForWixProductId(li.catalogReference?.catalogItemId) === 'Back') ? 'Back print' : '',
                 LEGEND_PERSONAS[d?.styleChoice]?.label || STYLE_LABELS[d?.styleChoice]].filter(Boolean).join(' · '),
        quantity: li.quantity || 1,
        previewUrl: previewOf(d),
        artworkUrl: orderEarnsArtwork(o) ? artworkOf(d) : null,
        stage: st.stage
      });
    }
    const stillInReview = o.status !== 'CANCELED' && o.fulfillmentStatus !== 'FULFILLED'
      && items.every(it => it.stage === 'In review');
    out.push({
      orderNumber: String(o.number),
      placedAt: o._createdDate || o.createdDate,
      total: o.priceSummary?.total?.formattedAmount || null,
      stage: o.status === 'CANCELED' ? 'Cancelled' : STAGE_ORDER[lowest],
      stages: STAGE_ORDER,
      trackingUrl: tracking,
      items,
      // Where it ships, and whether the app may offer "Change address"
      // (added 1 Nov 2026). The change itself re-checks every line with
      // Printful before touching anything; this flag only shows the button.
      shipTo: shipToOf(o),
      canChangeAddress: stillInReview
    });
    if (out.length >= 20) break;
  }
  return { ok: true, orders: out };
}
// ============================================================================
// CHANGE THE SHIPPING ADDRESS (added 1 Nov 2026)
// ============================================================================
// A customer typed her house number one digit off, and the order was headed for
// an empty lot next to the campground. Wix's checkout can't be changed, so the
// fix happens afterwards, from My orders, while the order is still In review.
//
//   POST /_functions/orderAddress
//   { orderNumber: "10042",
//     address: { name, addressLine, addressLine2, city, state, postalCode, country } }
//
// Rules, in order:
//   1. The order must belong to this phone: at least one line carries one of
//      this device's designs. Anyone else's order is "not found".
//   2. Every line must still be a Printful DRAFT, or not at Printful yet. One
//      line confirmed for printing locks the whole order: it ships together.
//      All lines are checked BEFORE anything is changed.
//   3. The country can't change (shipping and tax were charged for it).
//   4. Printful drafts are updated first (that's what actually ships), then
//      the Wix order, so your dashboard and the confirmation agree.
// Orders not at Printful yet need only the Wix change: printfulOrders.js reads
// the address from the Wix order when it sends them.

// Where a Wix order ships. Same three places, same order, as printfulOrders.js.
function destinationOf(order) {
  const candidates = [
    order.recipientInfo,
    order.shippingInfo?.logistics?.shippingDestination,
    order.shippingInfo?.shippingDestination
  ].filter(Boolean);
  return candidates.find(c => c.address) || candidates[0] || {};
}

function shipToOf(order) {
  const dest = destinationOf(order);
  const a = dest.address || {};
  const c = dest.contactDetails || order.recipientInfo?.contactDetails || {};
  const line1 = a.addressLine || a.addressLine1
    || [a.streetAddress?.number, a.streetAddress?.name].filter(Boolean).join(' ');
  if (!line1 && !a.city) return null;
  return {
    name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
    addressLine: line1 || '',
    addressLine2: a.addressLine2 || '',
    city: a.city || '',
    state: String(a.subdivision || '').replace(/^[A-Z]{2}-/, ''),
    postalCode: a.postalCode || '',
    country: a.country || 'US'
  };
}

// The customer's typing, narrowed and checked. Returns { address } or { problem }.
function cleanAddress(raw, country) {
  const s = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const a = {
    name: s(raw?.name, 80),
    addressLine: s(raw?.addressLine, 100),
    addressLine2: s(raw?.addressLine2, 100),
    city: s(raw?.city, 60),
    state: s(raw?.state, 40).toUpperCase(),
    postalCode: s(raw?.postalCode, 12).toUpperCase(),
    country
  };
  if (!a.name) return { problem: 'Please give the name it\'s going to.' };
  if (!a.addressLine || !/\d/.test(a.addressLine)) return { problem: 'Please include the house or building number.' };
  if (!a.city) return { problem: 'Please give the city.' };
  if (country === 'US') {
    if (!/^[A-Z]{2}$/.test(a.state)) return { problem: 'Please use the two-letter state, like TN.' };
    if (!/^\d{5}(-\d{4})?$/.test(a.postalCode)) return { problem: 'Please check the ZIP code: five digits, like 37774.' };
  } else if (!a.postalCode) {
    return { problem: 'Please give the postal code.' };
  }
  return { address: a };
}

export async function updateOrderAddressForApp(visitorId, body) {
  const number = String(body?.orderNumber || '').trim();
  if (!/^\d{1,12}$/.test(number)) return fail('bad_request', 'Bad order number.');

  // 1. This phone's order?
  const mine = await wixData.query(COLLECTION).eq('visitorId', visitorId).limit(1000).find({ suppressAuth: true });
  const myDesigns = new Set(mine.items.map(d => d._id));
  let recent;
  try { recent = await searchRecentOrders(3); }
  catch (e) {
    console.error(`App address change: ${e.message}`);
    return fail('server_error', 'Your order couldn\'t be loaded right now. Please try again.');
  }
  const order = recent.find(o => String(o.number) === number);
  if (!order || !(order.lineItems || []).some(li => myDesigns.has(lineField(li, 'designRecordId')))) {
    return fail('not_found', 'We couldn\'t find that order.');
  }
  if (order.status === 'CANCELED' || order.fulfillmentStatus === 'FULFILLED') {
    return fail('order_locked', 'This order can\'t be changed any more.');
  }

  // 3. The new address, same country as before.
  const current = shipToOf(order);
  const country = current?.country || 'US';
  const cleaned = cleanAddress(body?.address, country);
  if (cleaned.problem) return fail('bad_address', cleaned.problem);
  const a = cleaned.address;

  // 2. Every line still a draft (or not at Printful yet)? Check them ALL first.
  const headers = await printfulHeaders();
  const drafts = [];
  for (const li of order.lineItems || []) {
    const externalId = externalIdFor(order, li);
    const resp = await fetch(`${PRINTFUL_BASE}/orders/@${encodeURIComponent(externalId)}`, { method: 'GET', headers });
    if (resp.status === 404) continue;                        // not sent yet: the Wix change covers it
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error(`App address change: Printful ${externalId} answered ${resp.status}`);
      return fail('server_error', 'We couldn\'t check your order with the printer just now. Please try again.');
    }
    const po = json.result || {};
    if (po.status !== 'draft') {
      return fail('order_locked', 'This order has already gone to print, so the address can\'t be changed here.');
    }
    drafts.push({ externalId, recipient: po.recipient || {} });
  }

  // 4a. Printful drafts.
  const stateCode = country === 'US' ? a.state : a.state.slice(0, 10);
  for (const d of drafts) {
    const recipient = {
      ...d.recipient,
      name: a.name,
      address1: a.addressLine,
      address2: a.addressLine2,
      city: a.city,
      state_code: stateCode,
      country_code: country,
      zip: a.postalCode
    };
    const resp = await fetch(`${PRINTFUL_BASE}/orders/@${encodeURIComponent(d.externalId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ recipient })
    });
    if (!resp.ok) {
      const json = await resp.json().catch(() => ({}));
      const why = String(json.error?.message || json.result || resp.status);
      console.error(`App address change: Printful ${d.externalId} refused the address: ${why}`);
      // Printful checks addresses too; its reason is usually readable.
      return fail('bad_address', `The printer couldn't use that address: ${why}`.slice(0, 200));
    }
  }

  // 4b. The Wix order, so the dashboard and receipts match.
  const [firstName, ...rest] = a.name.split(' ');
  const wixAddress = {
    country,
    subdivision: country === 'US' ? `US-${a.state}` : a.state,
    city: a.city,
    postalCode: a.postalCode,
    addressLine: a.addressLine,
    addressLine2: a.addressLine2 || null,
    streetAddress: null
  };
  const contact = { firstName, lastName: rest.join(' ') };
  try {
    await elevate(orders.updateOrder)(order._id, {
      recipientInfo: { address: wixAddress, contactDetails: { ...(order.recipientInfo?.contactDetails || {}), ...contact } },
      shippingInfo: { logistics: { shippingDestination: {
        address: wixAddress,
        contactDetails: { ...(order.shippingInfo?.logistics?.shippingDestination?.contactDetails || {}), ...contact }
      } } }
    });
  } catch (e) {
    // Printful already has the right address, which is what ships. Logged
    // loudly so the Wix order can be corrected by hand.
    console.error(`App address change: order ${number} — Printful updated, but the Wix order wasn't: ${e.message}`);
    if (!drafts.length) {
      return fail('server_error', 'That didn\'t save. Please try again in a minute.');
    }
  }

  console.log(`App address change: order ${number} now ships to ${a.addressLine}, ${a.city} ${a.state} ${a.postalCode} (${drafts.length} Printful draft(s) updated).`);
  return { ok: true, shipTo: a };
}

// "Report this design" from the app.  Body: { designId, reason }
export async function reportDesignForApp(visitorId, body) {
  const d = await loadOwnDesign(body?.designId, visitorId);
  if (!d) return fail('not_found', 'We couldn\'t find that design.');
  return reportDesign(d, visitorId, String(body?.reason || 'other'), previewOf(d));
}