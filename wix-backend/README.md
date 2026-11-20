# Legend Maker: website backend

Three files for the `backend` folder of the goodwookie.com Wix site. They are
kept here so they are versioned with the app; Wix does not read this folder.

| File | What it is |
|---|---|
| `legendDesign.web.js` | **New.** The person generator: photo gate, personas, checks. |
| `appBackend.js` | **Replaces** the existing file. Adds the Legend Maker branches. |
| `http-functions.js` | **Replaces** the existing file. Passes the `X-App` header through. |

`aiDesign.web.js`, `petDesigns.js` and `productCatalog.js` are not changed.

## Status

Written 16 Nov 2026 against the site's files as they were that day. **Never
run on Wix or against Gemini.** The rules were tested here with Wix and
Gemini replaced by stand-ins (22 checks: consent, the photo gate, redraws,
what reaches the customer). The prompts have not drawn a single picture yet.

## What changes for Design Your Pet

Nothing it can see. In `appBackend.js`, 11 original lines are altered and
about 108 added; every Legend Maker path sits behind the `X-App: legend`
header or a persona style key, neither of which Design Your Pet ever sends.
`http-functions.js` has two altered lines. Compare with the live files before
pasting if either has changed since 16 Nov.

## Install

1. **Add three fields to the `PetDesigns` collection** (CMS > PetDesigns >
   Manage fields). The Field ID must match exactly:

   | Field name | Field ID | Type |
   |---|---|---|
   | Subject | `subject` | Text |
   | Subject mode | `subjectMode` | Text |
   | Who consent at | `whoConsentAt` | Date and Time |

   Without them no Legend Maker design is made: the generator checks that
   the promise was saved and stops if it wasn't.
2. In the Wix code panel, add a new backend file named exactly
   `legendDesign.web.js` and paste the whole file in.
3. Replace the whole of `appBackend.js`, then the whole of `http-functions.js`.
4. Publish.

## Check it

1. Open `https://www.goodwookie.com/_functions/ping`. It should answer as before.
2. Make one design in the Design Your Pet app, start to finish. It should
   behave exactly as it did.
3. Ask for Legend Maker's list (any 16+ character device ID will do):

   ```sh
   curl -H "X-App: legend" https://www.goodwookie.com/_functions/products
   ```

   `styles` should list the ten personas (`monarch`, `rockstar`, ...).
   Without the header it should list the eight pet styles.
4. Point the app at the site (`EXPO_PUBLIC_API_BASE_URL`, see `src/api/`) and
   make a design with a photo of yourself.

## Legend Maker products (added 19 Nov 2026)

Four more files carry the products. Replace each whole file, then publish:

| File | Change |
|---|---|
| `productCatalog.js` | Legend Maker tee, hoodie, poster (12×16, 18×24) and canvas (12×16), marked `app: 'legend'`. Each app and page sees only its own products. |
| `printfulShared.js` | Portrait art on posters and canvas (Printful hands their print areas back landscape); the canvas art covers the front and leaves the wrap plain; a Printful catalog lookup. |
| `appBackend.js` | A Legend Maker design goes only on Legend Maker products, and a pet design only on pet products. |
| `http-functions.js` | `GET /_functions/printfulVariants/<id>`, to read a Printful product's variant IDs. |

The new products stay hidden until their `PASTE_..._ID` placeholders are
replaced with real Wix product IDs, and the canvas until its Printful
variant ID replaces the 0.

Checked offline (`tests/placements.test.mjs`): every pet product's print
files, front and back, mockup and order, are byte-for-byte what the old
code produced, and the pet product list is unchanged.

Placements, as print-area pixels at Printful's sizes:

| Product | Art |
|---|---|
| Tee | 10.5 in wide x 14 in tall, 1 in below the top of the 12x16 front |
| Hoodie | 8.25 in wide x 11 in tall, inside the 12x12 front, ending at the pocket |
| Poster 12x16, 18x24 | fills the sheet |
| Canvas 12x16 | covers the 12x16 front; the wrap round the sides prints white |

## Known limits

- Artwork is square. Portrait formats need product work as well.
- Products are Design Your Pet's, so a cart line reads "Design Your Pet".
- The flagged-design email shows the raw persona key as the style.
- The helpers at the bottom of `legendDesign.web.js` are copies of the ones
  in `aiDesign.web.js`. A fix to one needs making in the other.
