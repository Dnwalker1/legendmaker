// backend/http-functions.js
// The Design Your Pet app's front door. Wix turns each export below into a
// web address the app can call:
//
//   export function get_products   →  GET  https://www.goodwookie.com/_functions/products
//   export function post_designs   →  POST https://www.goodwookie.com/_functions/designs
//
// The file name must be EXACTLY http-functions.js, in the backend folder, or
// Wix won't serve it. It only works on the PUBLISHED site. Test with the
// addresses above after publishing, not in Preview.
//
// Every request from the app carries:
//   X-Device-Id: <random ID the app made on first launch>   (required)
//   X-App-Key:   <value of the DESIGN_APP_KEY secret>        (only if you add that secret)
//   X-App:       legend     (the Legend Maker app only, added 16 Nov 2026;
//                            Design Your Pet sends no such header)
//
// Every answer is JSON. A normal outcome, good or bad, is HTTP 200 with
// { ok: true, ... } or { ok: false, code, message }. The app picks its screen
// from `code`. Only a broken request (400), a missing app key (401) or a crash
// (500) uses anything else.
//
// All the real work is in backend/appBackend.js.

import { ok, badRequest, response, serverError } from 'wix-http-functions';
import {
  fail, deviceToVisitorId, appKeyOk, getAllowance, getProductsForApp,
  createUploadUrl, startDesign, getDesignForApp, listDesignsForApp,
  startMockup, getMockup, createAppCheckout, getCheckoutResult, listOrdersForApp, reportDesignForApp,
  updateOrderAddressForApp,
} from 'backend/appBackend';

// ── plumbing ────────────────────────────────────────────────────────────────

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

function send(body) {
  return ok({ headers: HEADERS, body });
}

// Runs one endpoint with the checks every endpoint shares. `needsDevice` is
// false only for the product list, which is the same for everyone.
async function handle(request, needsDevice, work) {
  try {
    if (!(await appKeyOk(request.headers['x-app-key']))) {
      return response({ status: 401, headers: HEADERS, body: fail('bad_app_key', 'This app needs updating.') });
    }
    let visitorId = null;
    if (needsDevice) {
      visitorId = deviceToVisitorId(request.headers['x-device-id']);
      if (!visitorId) {
        return badRequest({ headers: HEADERS, body: fail('device_missing', 'Missing or malformed X-Device-Id header.') });
      }
    }
    return send(await work(visitorId));
  } catch (e) {
    // Logged in full for you (Dashboard → Developer Tools → Logs); the app
    // gets a plain sentence.
    console.error(`App endpoint ${request.method} /${request.functionName}/${(request.path || []).join('/')} crashed: ${e.stack || e.message}`);
    return serverError({ headers: HEADERS, body: fail('server_error', 'Something went wrong on our side. Please try again.') });
  }
}

// Which app is asking: 'legend' for Legend Maker, '' for Design Your Pet.
function appOf(request) {
  return String((request.headers && request.headers['x-app']) || '').trim().toLowerCase();
}

async function readJson(request) {
  try { return await request.body.json(); }
  catch (e) { return {}; }
}

// ── endpoints ───────────────────────────────────────────────────────────────

// Products, colours, sizes, prices and styles. Call on launch.
export function get_products(request) {
  return handle(request, false, () => getProductsForApp(appOf(request)));
}

// "4 of 5 designs left, next one unlocks at 8:14 PM".
export function get_allowance(request) {
  return handle(request, true, async (visitorId) => ({ ok: true, allowance: await getAllowance(visitorId) }));
}

// Step 1: a one-time address to upload the photo to.  Body: { mimeType }
export function post_uploadUrl(request) {
  return handle(request, true, async (visitorId) => createUploadUrl(visitorId, await readJson(request)));
}

// Step 2: start a design.  Body: { fileId, style, text }
// Legend Maker adds: { who: 'self' | 'gift' | 'memorial', whoConsent: true }
export function post_designs(request) {
  return handle(request, true, async (visitorId) => startDesign(visitorId, await readJson(request), appOf(request)));
}

// GET /designs        → this device's designs from the last 7 days
// GET /designs/<id>   → one design's progress (ask every 2 seconds)
export function get_designs(request) {
  return handle(request, true, (visitorId) => {
    const id = (request.path || [])[0];
    return id ? getDesignForApp(visitorId, id) : listDesignsForApp(visitorId);
  });
}

// Product preview.  Body: { designId, productKey, color, size }
export function post_mockups(request) {
  return handle(request, true, async (visitorId) => startMockup(visitorId, await readJson(request)));
}

// GET /mockups/<taskKey>  → { status: working | ready | failed, mockupUrl }
export function get_mockups(request) {
  return handle(request, true, () => getMockup((request.path || [])[0]));
}

// Turn the app's cart into a Wix checkout.
// Body: { items: [ { designId, productKey, color, size, quantity } ] }
export function post_checkout(request) {
  return handle(request, true, async (visitorId) => createAppCheckout(visitorId, await readJson(request)));
}

// GET /checkout/<checkoutId>  → did they pay? { completed, orderNumber }
export function get_checkout(request) {
  return handle(request, true, (visitorId) => getCheckoutResult(visitorId, (request.path || [])[0]));
}

// My orders, with the stage and tracking link.
export function get_orders(request) {
  return handle(request, true, (visitorId) => listOrdersForApp(visitorId));
}

// Quick "is it switched on?" check for you: open
// https://www.goodwookie.com/_functions/ping in a browser after publishing.
export function get_ping(request) {
  return send({ ok: true, service: 'Design Your Pet app API', time: new Date().toISOString() });
}

// Report a design.  Body: { designId, reason }
export function post_report(request) {
  return handle(request, true, async (visitorId) => reportDesignForApp(visitorId, await readJson(request)));
}

// Correct an order's shipping address while it's still In review (added 1 Nov 2026).
// Body: { orderNumber, address: { name, addressLine, addressLine2, city, state, postalCode, country } }
export function post_orderAddress(request) {
  return handle(request, true, async (visitorId) => updateOrderAddressForApp(visitorId, await readJson(request)));
}