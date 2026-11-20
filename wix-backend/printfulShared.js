/* global globalThis */
// That first line is an instruction to Wix's publish-time code checker, not a
// note to you — without it the build fails with "'globalThis' is not defined".
// Leave it at the very top of the file.
//
// backend/printfulShared.js
// Everything Printful-related that the preview AND the real order both use,
// so they always match: print-area sizes and where the art + sleeve logo sit.
// The products themselves (and their variant tables) live in productCatalog.js.
// Plain backend file — not callable from a browser.

import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import { SLEEVE_LOGO_URL } from 'backend/petDesigns';

import { PRODUCTS, getProduct, getPrintfulVariantIdFor, printSideFor, MUG_LOGO_URL } from 'backend/productCatalog';
import { mediaManager } from 'wix-media-backend';
import { PNG } from 'pngjs';      // already installed for imageTools.js
import jpeg from 'jpeg-js';       // already installed for imageTools.js

export const PRINTFUL_BASE = 'https://api.printful.com';

// THE TEE-ONLY NAMES BELOW ARE KEPT ON PURPOSE.
//
// Products now live in backend/productCatalog.js. These four names still
// point at the tee, so anything that already imports them — including the
// page before it learns about products — carries on working unchanged.
export const PRINTFUL_PRODUCT_ID = PRODUCTS.tee.printfulProductId;
export const SIZES = PRODUCTS.tee.sizes;
export const COLORS = PRODUCTS.tee.colors;

// Printful variant for a colour + size. productKey is optional and defaults
// to the tee, so old two-argument calls still mean "the tee".
export function getPrintfulVariantId(color, size, productKey) {
  return getPrintfulVariantIdFor(productKey, color, size);
}

export async function printfulHeaders() {
  const token = String(await getSecret('PRINTFUL_API_TOKEN')).trim();
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  try {
    const storeId = await getSecret('PRINTFUL_STORE_ID');
    if (storeId) headers['X-PF-Store-Id'] = String(storeId).trim();
  } catch (e) { /* single-store accounts don't need this */ }
  return headers;
}

// Size of each print area (front, sleeve_left…) in pixels for this variant.
async function getPrintAreas(printfulProductId, variantId, headers) {
  const resp = await fetch(`${PRINTFUL_BASE}/mockup-generator/printfiles/${printfulProductId}`, { method: 'GET', headers });
  const json = await resp.json();
  if (!resp.ok) throw new Error(`Printful printfiles error: ${json.error?.message || json.result}`);
  const printfiles = json.result.printfiles || [];
  const vp = json.result.variant_printfiles || [];
  const variant = vp.find(v => v.variant_id === variantId) || vp[0];
  const areas = {};
  for (const [name, printfileId] of Object.entries(variant?.placements || {})) {
    const pf = printfiles.find(p => p.printfile_id === printfileId);
    if (pf) areas[name] = { width: pf.width, height: pf.height, dpi: pf.dpi || 150 };
  }
  return areas;
}

// Front-print placement, as a share of Printful's front print area (12" × 16").
// FRONT_WIDTH 1.0  = the full 12" width of the print area.
// FRONT_TOP   0.08 ≈ 1¼" below the top of the print area — still clear of the
//                    collar, but the art is larger now so it needs less drop.
// Dial FRONT_WIDTH back to 0.9 if full width prints too close to the seams, and
// raise or lower FRONT_TOP to move the art up or down the chest.
const FRONT_WIDTH = 1.0;
const FRONT_TOP = 0.08;

// Chest placement: art centred left-to-right, a set distance down from the top
// of the print area.
//
// A product can give its size in INCHES with `frontWidthIn` and `frontTopIn` in
// productCatalog.js (the tee and hoodie do, measured from Don's own layouts in
// Printful's designer). Inches are converted with the print area's own DPI, so
// they mean the same thing whichever size of print area Printful hands back.
// A product without them uses the two shares above.
function chestPlacement(area, ratio, product) {
  if (!area) throw new Error('Printful did not return the front print area for this shirt.');
  const dpi = area.dpi || 150;
  let width = (product && product.frontWidthIn)
    ? Math.min(area.width, Math.round(product.frontWidthIn * dpi))
    : Math.round(area.width * FRONT_WIDTH);
  let height = Math.round(width / ratio);
  const top = (product && product.frontTopIn != null)
    ? Math.round(product.frontTopIn * dpi)
    : Math.round(area.height * FRONT_TOP);
  if (top + height > area.height) {          // very tall art: shrink to fit
    height = area.height - top;
    width = Math.round(height * ratio);
  }
  const left = Math.round((area.width - width) / 2);
  return { area_width: area.width, area_height: area.height, width, height, top, left };
}

// A placement given in inches: `widthIn` wide, `topIn` down from the top of
// the print area, its middle `centerOffsetIn` to the RIGHT of the area's
// middle as you look at the print file (0 = centred). The print file is drawn
// as you face the shirt, so the wearer's LEFT chest is the right-hand side of
// the file. Shrinks to stay inside the print area.
function placeInches(area, ratio, spec, what) {
  if (!area) throw new Error(`Printful did not return the ${what} print area for this shirt.`);
  const dpi = area.dpi || 150;
  let width = Math.min(area.width, Math.round(spec.widthIn * dpi));
  let height = Math.round(width / ratio);
  const top = Math.min(Math.round((spec.topIn || 0) * dpi), Math.max(0, area.height - 1));
  if (top + height > area.height) {
    height = area.height - top;
    width = Math.round(height * ratio);
  }
  const middle = area.width / 2 + Math.round((spec.centerOffsetIn || 0) * dpi);
  const left = Math.max(0, Math.min(area.width - width, Math.round(middle - width / 2)));
  return { area_width: area.width, area_height: area.height, width, height, top, left };
}

// Biggest fit of an image with shape `ratio` (width ÷ height) inside an area.
//
// Two optional extras, for products whose print area isn't a plain rectangle
// to fill (added 14 Nov 2026 for the ornament and the mug):
//   scale    1 = the biggest fit (the default). 0.7 = 70% of that, so square
//            art sits wholly inside a ROUND ornament instead of losing its
//            corners to the edge.
//   centerX  where the art's middle sits across the area, 0 (left edge) to 1
//            (right edge). 0.5 = centred (the default). On a mug the print
//            area wraps round the cup, so this turns the art toward one side.
//   centerY  the same, top (0) to bottom (1). Moves the ornament's art a
//            little down, clear of the hanging hole.
function fitInArea(area, ratio, align, scale, centerX, centerY) {
  if (!area) throw new Error('Printful did not return that print area for this shirt.');
  let width = area.width;
  let height = Math.round(width / ratio);
  if (height > area.height) { height = area.height; width = Math.round(height * ratio); }
  const k = Number(scale) > 0 && Number(scale) < 1 ? Number(scale) : 1;
  width = Math.max(1, Math.round(width * k));
  height = Math.max(1, Math.round(height * k));
  const cx = Number.isFinite(Number(centerX)) && centerX != null ? Math.min(1, Math.max(0, Number(centerX))) : 0.5;
  const left = Math.max(0, Math.min(area.width - width, Math.round(area.width * cx - width / 2)));
  const cy = Number.isFinite(Number(centerY)) && centerY != null ? Math.min(1, Math.max(0, Number(centerY))) : 0.5;
  const top = align === 'top' ? 0 : Math.max(0, Math.min(area.height - height, Math.round(area.height * cy - height / 2)));
  return { area_width: area.width, area_height: area.height, width, height, top, left };
}

// Width ÷ height of a PNG at a URL, read from its header. Remembered per URL.
//
// THE 206 CHECK IS THE WHOLE POINT OF THIS FUNCTION'S SAFETY.
//
// We ask for the first 32 bytes because a PNG carries its dimensions at byte
// 16. But a Range header is a REQUEST, not a guarantee: a server is free to
// ignore it and answer 200 with the entire file. This used to call
// arrayBuffer() on whatever came back — so when the CDN ignored the range, we
// quietly downloaded the whole image to read twenty-four bytes of it.
//
// That is what was killing the Evening Portrait preview. It is the only style
// that gets circle-masked, so it is the only one saved as a 4K PNG with an
// alpha channel — tens of megabytes. Pulling that down inside a web method ran
// past Wix's gateway timeout and the page showed a 504. The other three styles
// are smaller and squeaked through, which is exactly why it looked like one
// style misbehaving rather than one shared function.
//
// Now: if the answer is not 206 Partial Content, we never touch the body. The
// fallback is right anyway — every style is generated square — so the common
// path is a ratio of 1 with nothing downloaded at all.
const ratioCache = new Map();
async function imageRatio(url, fallback) {
  if (ratioCache.has(url)) return ratioCache.get(url);
  try {
    const resp = await globalThis.fetch(url, { headers: { Range: 'bytes=0-32' } });
    if (resp.status !== 206) {
      // Full file on the way. Walk away from it.
      if (resp.body && typeof resp.body.cancel === 'function') {
        try { await resp.body.cancel(); } catch (ignore) { /* nothing to do */ }
      }
      ratioCache.set(url, fallback);
      return fallback;
    }
    const b = Buffer.from(await resp.arrayBuffer());
    if (b.length >= 24 && b.toString('ascii', 1, 4) === 'PNG') {
      const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
      if (w > 0 && h > 0) { ratioCache.set(url, w / h); return w / h; }
    }
  } catch (e) { /* fallback below */ }
  return fallback;
}

// ── THE MUG (added 14 Nov 2026) ────────────────────────────────────────────
//
// A mug has ONE print area that wraps round the cup, and Printful takes one
// image per print area. So the pet on one side and the Goodwookie logo on the
// other have to be one picture. This builds it: a see-through image exactly
// the size of the mug's print area, the pet centred at fitCenterX, the logo at
// backLogo.centerX. It is saved to Wix Media (folder /mug-prints) and the
// address is remembered, so a preview and the order for the same design reuse
// the same file.
//
// The pet is read through Wix's image service at about the size it prints,
// not as the full 4K file: that keeps this fast enough for a preview. If that
// copy can't be read, it falls back to the full file.

const MUG_FOLDER = '/mug-prints';
const mugCache = new Map();   // art URL + area size → finished print file URL

// Accepts either form Wix gives for a Media file: the https://static.wixstatic.com
// address, or the wix:image://v1/<id>/... address the editor copies. Returns
// the https address, or '' if it is neither.
function publicUrl(u) {
  const s = String(u || '').trim();
  if (s.startsWith('https://')) return s;
  const m = s.match(/^wix:image:\/\/v1\/([^/#]+)/);
  return m ? `https://static.wixstatic.com/media/${m[1]}` : '';
}

function staticMediaId(url) {
  const m = String(url).match(/static\.wixstatic\.com\/media\/([^/?#]+)/);
  return m ? m[1] : null;
}

// Decodes a PNG or JPEG into RGBA pixels. Anything else (WebP) returns null.
function decodeImage(buffer) {
  if (!buffer || buffer.length < 8) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    const png = PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: png.data };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    const j = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
    return { width: j.width, height: j.height, data: j.data };
  }
  return null;
}

async function fetchImage(url) {
  const resp = await globalThis.fetch(url, { headers: { Accept: 'image/png,image/jpeg' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${String(url).slice(0, 80)}`);
  return Buffer.from(await resp.arrayBuffer());
}

// The pet art at roughly `px` pixels on its longer side.
async function loadArtNear(artUrl, px) {
  const id = staticMediaId(artUrl);
  if (id) {
    try {
      const small = decodeImage(await fetchImage(`https://static.wixstatic.com/media/${id}/v1/fit/w_${px},h_${px},q_95/${id}`));
      if (small) return small;
    } catch (e) { /* fall back to the full file */ }
  }
  const full = decodeImage(await fetchImage(artUrl));
  if (!full) throw new Error('The design image is in a format the mug builder can\'t read.');
  return full;
}

// Area-average resize of RGBA pixels (only ever shrinks or keeps size).
function resizeRGBA(src, w, h) {
  const out = Buffer.alloc(w * h * 4);
  const sx = src.width / w, sy = src.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < src.height; yy++) {
        for (let xx = x0; xx < x1 && xx < src.width; xx++) {
          const i = (yy * src.width + xx) * 4;
          const al = src.data[i + 3];
          r += src.data[i] * al; g += src.data[i + 1] * al; b += src.data[i + 2] * al; a += al; n++;
        }
      }
      const o = (y * w + x) * 4;
      if (a > 0) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
      out[o + 3] = n ? Math.round(a / n) : 0;
    }
  }
  return { width: w, height: h, data: out };
}

// Paints `img` onto `canvas` with its top-left corner at (left, top).
function paste(canvas, img, left, top) {
  for (let y = 0; y < img.height; y++) {
    const cy = top + y;
    if (cy < 0 || cy >= canvas.height) continue;
    for (let x = 0; x < img.width; x++) {
      const cx = left + x;
      if (cx < 0 || cx >= canvas.width) continue;
      const i = (y * img.width + x) * 4, o = (cy * canvas.width + cx) * 4;
      const a = img.data[i + 3] / 255;
      if (a <= 0) continue;
      const keep = canvas.data[o + 3] / 255 * (1 - a);
      const outA = a + keep;
      for (let c = 0; c < 3; c++) {
        canvas.data[o + c] = Math.round((img.data[i + c] * a + canvas.data[o + c] * keep) / outA);
      }
      canvas.data[o + 3] = Math.round(outA * 255);
    }
  }
}

// Shrinks `img` to fit inside maxW × maxH, keeping its shape.
function fitImage(img, maxW, maxH) {
  const k = Math.min(maxW / img.width, maxH / img.height, 1);
  return resizeRGBA(img, Math.max(1, Math.round(img.width * k)), Math.max(1, Math.round(img.height * k)));
}

// Waits until a just-uploaded Wix Media file can actually be downloaded, so
// Printful doesn't fetch it a moment too early.
async function waitUntilServed(url, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await globalThis.fetch(url, { headers: { Range: 'bytes=0-15' } });
      if (r.status === 200 || r.status === 206) {
        if (r.body && typeof r.body.cancel === 'function') { try { await r.body.cancel(); } catch (ignore) { /* fine */ } }
        return true;
      }
    } catch (e) { /* not yet */ }
    await new Promise(res => setTimeout(res, 700));
  }
  return false;
}

export async function buildMugPrintFile(artUrl, area, product) {
  const key = `${artUrl}|${area.width}x${area.height}`;
  if (mugCache.has(key)) return mugCache.get(key);
  const logoUrl = publicUrl(MUG_LOGO_URL);
  if (!logoUrl) {
    throw new Error('MUG_LOGO_URL is not set in backend/productCatalog.js.');
  }

  const W = area.width, H = area.height;
  // White, like the mug itself (white prints as no ink on a white mug). This
  // also makes the preview read as a mug and hides a logo's white box.
  const canvas = { width: W, height: H, data: Buffer.alloc(W * H * 4, 255) };

  // The pet: as tall as the print area allows (fitScale), centred at fitCenterX.
  const petMax = Math.round(H * (product.fitScale || 1));
  const pet = fitImage(await loadArtNear(artUrl, Math.max(petMax, 600)), Math.round(W * 0.48), petMax);
  const petCX = (product.fitCenterX != null ? product.fitCenterX : 0.75) * W;
  paste(canvas, pet, Math.round(petCX - pet.width / 2), Math.round((H - pet.height) / 2));

  // The logo on the other side.
  const bl = product.backLogo || { widthShare: 0.3, heightShare: 0.55, centerX: 0.25 };
  const logoSrc = decodeImage(await fetchImage(logoUrl));
  if (!logoSrc) throw new Error('The mug logo must be a PNG or JPEG.');
  const logo = fitImage(logoSrc, Math.round(W * bl.widthShare), Math.round(H * bl.heightShare));
  paste(canvas, logo, Math.round(bl.centerX * W - logo.width / 2), Math.round((H - logo.height) / 2));

  const png = new PNG({ width: W, height: H });
  canvas.data.copy(png.data);
  const buffer = PNG.sync.write(png, { colorType: 6 });

  const name = `mug-${(staticMediaId(artUrl) || 'art').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}-${W}x${H}.png`;
  const up = await mediaManager.upload(MUG_FOLDER, buffer, name, {
    mediaOptions: { mimeType: 'image/png', mediaType: 'image' },
    metadataOptions: { isPrivate: false, isVisitorUpload: false }
  });
  const m = String(up.fileUrl || '').match(/^wix:image:\/\/v1\/([^/#]+)/);
  const url = m ? `https://static.wixstatic.com/media/${m[1]}` : String(up.fileUrl || '');
  if (!url.startsWith('https://')) throw new Error('Wix Media did not return an address for the mug print file.');
  await waitUntilServed(url, 8000);
  mugCache.set(key, url);
  console.log(`Mug print file ${W}x${H} built: ${url}`);
  return url;
}

// ── PREVIEWS WE DRAW OURSELVES (added 14 Nov 2026) ─────────────────────────
// Printful's product-photo generator doesn't cover the ornament or the mug,
// so holidayPreview.web.js asks for these instead.

// The size of a product's main print area, straight from Printful.
export async function mainPrintArea(productKey) {
  const product = getProduct(productKey);
  const variantId = getPrintfulVariantIdFor(product.key, '', product.sizes[0]);
  const areas = await getPrintAreas(product.printfulProductId, variantId, await printfulHeaders());
  const names = Object.keys(areas);
  return areas[product.placement] || (names.length === 1 ? areas[names[0]] : null);
}

const previewCache = new Map();

// The ornament as it will look: a white ceramic disc with the art placed
// exactly as the print file places it (fitScale, fitCenterY), the hanging
// hole, and nothing outside the circle. With fitScale 1 the art covers the
// whole disc and the circle trims its corners, as on the real ornament.
export async function buildOrnamentPreview(artUrl, product) {
  if (previewCache.has(artUrl)) return previewCache.get(artUrl);
  const S = 1000;
  const canvas = { width: S, height: S, data: Buffer.alloc(S * S * 4) };
  // Printful's print area is 3" square; the ceramic circle is 2.76" across,
  // so it fills 92% of the area (radius 0.46). The hanging hole sits about a
  // sixth of the way down.
  const r = S * 0.46, c = S / 2;
  // White disc with a soft grey rim.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (d > r + 1) continue;
      const o = (y * S + x) * 4;
      const v = d > r - 6 ? 205 : 255;
      canvas.data[o] = v; canvas.data[o + 1] = v; canvas.data[o + 2] = v;
      canvas.data[o + 3] = d > r ? Math.round(255 * (r + 1 - d)) : 255;
    }
  }
  // The art, placed as on the print file, kept inside the rim.
  const scale = product.fitScale || 1;
  const art = fitImage(await loadArtNear(artUrl, 800), Math.round(S * scale), Math.round(S * scale));
  const cy = (product.fitCenterY != null ? product.fitCenterY : 0.5) * S;
  const layer = { width: S, height: S, data: Buffer.alloc(S * S * 4) };
  paste(layer, art, Math.round(c - art.width / 2), Math.round(cy - art.height / 2));
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (Math.hypot(x + 0.5 - c, y + 0.5 - c) > r - 7) layer.data[(y * S + x) * 4 + 3] = 0;
    }
  }
  paste(canvas, layer, 0, 0);
  // The hanging hole near the top.
  const hy = S * 0.17, hr = S * 0.03;
  for (let y = Math.floor(hy - hr - 2); y <= hy + hr + 2; y++) {
    for (let x = Math.floor(c - hr - 2); x <= c + hr + 2; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - hy);
      const o = (y * S + x) * 4;
      if (d <= hr) canvas.data[o + 3] = 0;
      else if (d <= hr + 2) { canvas.data[o] = 190; canvas.data[o + 1] = 190; canvas.data[o + 2] = 190; }
    }
  }
  const url = await saveToMedia(canvas, '/holiday-previews', `ornament-${(staticMediaId(artUrl) || 'art').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}.png`);
  previewCache.set(artUrl, url);
  return url;
}

// Saves RGBA pixels as a PNG in Wix Media and returns its https address once
// it can be downloaded.
async function saveToMedia(canvas, folder, name) {
  const png = new PNG({ width: canvas.width, height: canvas.height });
  canvas.data.copy(png.data);
  const buffer = PNG.sync.write(png, { colorType: 6 });
  const up = await mediaManager.upload(folder, buffer, name, {
    mediaOptions: { mimeType: 'image/png', mediaType: 'image' },
    metadataOptions: { isPrivate: false, isVisitorUpload: false }
  });
  const m = String(up.fileUrl || '').match(/^wix:image:\/\/v1\/([^/#]+)/);
  const url = m ? `https://static.wixstatic.com/media/${m[1]}` : String(up.fileUrl || '');
  if (!url.startsWith('https://')) throw new Error('Wix Media did not return an address for the picture.');
  await waitUntilServed(url, 8000);
  return url;
}

// The print files for one product, placed.
//   Garments, Front: pet art high on the chest + Goodwookie logo on the left sleeve.
//   Garments, Back:  pet art on the back + the same script logo on the left
//                    chest, and no sleeve logo (added 29 Oct 2026).
//   Stickers and posters: pet art filling the print area, no logo.
//   Ornament: the art shrunk to sit inside the circle (fitScale, fitCenterY).
//   Mug: one wrap-around picture, pet facing the drinker + logo on the back
//        (buildMugPrintFile above).
// style: 'mockup' → Printful mockup-generator format; 'order' → orders format.
// productKey is optional and defaults to the tee. print is 'Front' (the
// default) or 'Back'.
export async function buildPrintFiles(artUrl, variantId, headers, style, productKey, print) {
  const product = getProduct(productKey);
  const side = printSideFor(product.key, print);
  if (product.sleeveLogo && !SLEEVE_LOGO_URL.startsWith('https://')) {
    throw new Error('SLEEVE_LOGO_URL is not set in backend/petDesigns.js.');
  }
  const areas = await getPrintAreas(product.printfulProductId, variantId, headers);

  // Stickers and posters have a single print area. If Printful names it
  // something other than we expect, use the only one there is rather than
  // failing a customer's preview over a label.
  const names = Object.keys(areas);
  const mainArea = areas[product.placement] || (names.length === 1 ? areas[names[0]] : undefined);
  if (!mainArea) {
    throw new Error(`Printful has no "${product.placement}" print area for ${product.label}. It offers: ${names.join(', ') || 'none'}.`);
  }

  const ratio = await imageRatio(artUrl, 1);

  if (side === 'Back') {
    // Printful prints the first placement free and charges for the second, so
    // the back art is listed first.
    const logoRatio = await imageRatio(SLEEVE_LOGO_URL, 3);
    const list = [
      { placement: 'back', url: artUrl, position: placeInches(areas.back, ratio, product.back, 'back') },
      { placement: 'front', url: SLEEVE_LOGO_URL, position: placeInches(mainArea, logoRatio, product.chestLogo, 'front') }
    ];
    return list.map(f => style === 'mockup'
      ? { placement: f.placement, image_url: f.url, position: f.position }
      : { type: f.placement === 'front' ? 'default' : f.placement, url: f.url, position: f.position });
  }

  let main;
  if (product.layout === 'mug') {
    // One finished picture the exact size of the wrap: pet + logo already in place.
    const mugUrl = await buildMugPrintFile(artUrl, mainArea, product);
    main = {
      placement: product.placement,
      url: mugUrl,
      position: { area_width: mainArea.width, area_height: mainArea.height, width: mainArea.width, height: mainArea.height, top: 0, left: 0 }
    };
  } else {
    main = {
      placement: product.placement,
      url: artUrl,
      position: product.layout === 'chest'
        ? chestPlacement(mainArea, ratio, product)
        : fitInArea(mainArea, ratio, 'center', product.fitScale, product.fitCenterX, product.fitCenterY)
    };
  }
  const list = [main];
  if (product.sleeveLogo) {
    list.push({ placement: 'sleeve_left', url: SLEEVE_LOGO_URL, position: fitInArea(areas.sleeve_left, await imageRatio(SLEEVE_LOGO_URL, 3), product.sleeveAlign || 'center') });
  }

  return list.map(f => style === 'mockup'
    ? { placement: f.placement, image_url: f.url, position: f.position }
    : { type: f.placement === 'front' ? 'default' : f.placement, url: f.url, position: f.position });
}