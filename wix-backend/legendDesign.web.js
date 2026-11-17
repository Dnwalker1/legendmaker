/* global globalThis */
// backend/legendDesign.web.js
// Legend Maker: turns a photo of ONE ADULT into a Goodwookie portrait of them
// as a legend (the Monarch, the Rock Star, the Movie Star...).
//
// That first line is an instruction to Wix's publish-time code checker, the
// same as in aiDesign.web.js. Leave it at the very top.
//
// THIS FILE IS SEPARATE FROM aiDesign.web.js ON PURPOSE (16 Nov 2026).
// Design Your Pet is live, and nothing in here can change how a pet design is
// made. The price is some copied plumbing: the helpers at the bottom of this
// file are copies of the ones in aiDesign.web.js, marked COPIED. If one of
// those is fixed there, fix it here too.
//
// What is shared, by importing it:
//   petDesigns.js    the PetDesigns collection (same limits, same 7-day
//                    clean-up, same flagged-design email)
//   imageTools.js    the picture tools
//   watermark.js     the preview watermark
//
// What is different from a pet design:
//   - the photo must show exactly ONE person, an adult, and nobody famous
//   - every design records WHOSE portrait it is (self, gift or memorial) and
//     when the customer made that promise
//   - the finished picture is checked for brand marks and stray lettering
//
// Called from page code as:
//   import { startLegendDesign, getLegendDesignStatus, getLegendPersonas } from 'backend/legendDesign.web';
// and from the app through backend/appBackend.js.
//
// BEFORE THIS WORKS, the PetDesigns collection needs three new fields. Wix
// Data silently drops fields a collection doesn't have, so without them the
// promise would not be recorded. startLegendDesign checks, and refuses to
// make a design until they exist:
//   subject        Text
//   subjectMode    Text
//   whoConsentAt   Date and Time

import { Permissions, webMethod } from 'wix-web-module';
import { getSecret } from 'wix-secrets-backend';
import { mediaManager } from 'wix-media-backend';
import { fetch } from 'wix-fetch';
import {
  createDesignRecord,
  updateDesignRecord,
  countRecentDesignsForVisitor,
  countGoodDesignsForVisitor,
  countRecentDesignsSiteWide,
  getDesignRecord,
  toPublicImageUrl
} from 'backend/petDesigns';
import { toCheckJpeg, toWebPng, clearOuterWhite } from 'backend/imageTools';
import { watermarkPreview } from 'backend/watermark';
import { files as mediaFiles } from '@wix/media';
import { auth as mediaAuth } from '@wix/essentials';

// ── SETTINGS ────────────────────────────────────────────────────────────────
const IMAGE_MODEL = 'gemini-3-pro-image';       // makes the artwork
const CHECK_MODEL = 'gemini-3.5-flash-lite';    // cheap text model for the checks
const geminiUrl = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// The same limits as Design Your Pet, counted in the same collection.
const MAX_DESIGNS_PER_VISITOR_PER_DAY = 5;
const MAX_ATTEMPTS_PER_VISITOR_PER_DAY = 12;
const MAX_DESIGNS_SITE_WIDE_PER_HOUR = 180;

// A second, silent attempt when the first comes out wrong.
const RETRY_ONCE = true;

// The shape of the artwork. Square for now, because the product previews, the
// print placement and the app all assume square art. Portrait formats (3:4)
// are a later step and need product work as well as this setting.
const ART_ASPECT = '1:1';

// The youngest a person in a Legend Maker photo may be.
const MIN_AGE = 18;

const MAX_TEXT_LENGTH = 18;

// Whose portrait it is. The customer ticks a promise for the one they pick.
const WHO = ['self', 'gift', 'memorial'];

// The notes that name a specific refusal, so the page and the app can each
// say the right sentence. appBackend.js reads these exact strings.
export const NO_PERSON_NOTE = 'No clear face in the photo.';
export const MINOR_NOTE = 'Photo rejected: someone under 18 in the photo.';
export const CROWD_NOTE = 'Photo rejected: more than one person in the photo.';
export const FAMOUS_NOTE = 'Photo rejected: a well-known person in the photo.';
export const HARM_NOTE = 'Photo rejected: injury, death or violence in the photo.';
// ────────────────────────────────────────────────────────────────────────────

// ============================================================================
// THE PROMPT, IN PARTS
// ============================================================================
// Written in the positive throughout, like aiDesign.web.js: an image model
// tends to draw whatever nouns it is shown, so these describe what IS there.

const FRESH = `Use the attached photograph only as a likeness reference for
    one person. Draw a completely new, original illustration of that person
    from scratch: a new pose, a new costume, a new setting, new light. The
    photograph gives the face, the hair and the build, and that is all it
    gives. Every garment, every colour of clothing, the headwear, the
    background and the framing come only from the description below.`;

const LIKENESS = `THE LIKENESS. The person in this picture is unmistakably the
    person in the photograph, so that their own family would know them at a
    glance: the same face shape, the same eyes and brows, the same nose, mouth
    and jaw, the same skin tone, the same hair colour, hairline and hairstyle,
    the same beard or moustache if they have one, the same glasses if they
    wear them, the same apparent age and the same build. Draw them at their
    best on a good day: rested, well lit, at ease, with a warm, confident
    expression, and still exactly themselves. {NOTES}

    There is exactly one person in the picture, an adult, fully and modestly
    dressed in the costume described here, shown from about the waist up with
    the face large, clear and turned toward the viewer.`;

const INVENTED_WORLD = `EVERYTHING HERE IS INVENTED FOR THIS ONE CUSTOMER. The
    costume, the colours, the emblem, the setting and every object are made up
    fresh for this picture and belong to no team, league, film, show, game,
    band, company or famous person. Every garment and every object is its own
    plain material and honest construction: cloth and stitching, leather and
    buckles, polished metal, wood grain. Where a costume carries an emblem it
    is one simple original shape: a star, a laurel wreath, a crown, a flame, a
    mountain. Every surface that could carry a mark is smooth and clear.`;

const ALIVE_AND_WELL = `The person is alive, healthy, whole and at ease:
    bright clear eyes, healthy skin, relaxed and content. The whole picture is
    good-natured and dignified, made with affection, suitable for any age.`;

const HOUSE = `THE HOUSE STYLE. A finished, hand-crafted illustration, drawn
    the way a skilled illustrator would: real depth from foreground to
    background, considered light and shadow, skin, hair and fabric that hold
    up close, and a fine vintage print grain over the whole thing. Colour is
    deep, saturated and confident. The frame and any flat graphic furniture
    use the brand colours: ink navy (#16202A), warm cream (#EFE3C6), aged
    cream (#D9C8A2), antique gold (#C79A3E), rust (#A85433) and slate
    (#31404C). The person keeps their own true colouring.

    Composition: one finished square design. {EDGE} The person is centred,
    in the upper two thirds.`;

// THE OUTER EDGE (pinned 16 Nov 2026, after the first live designs). Left to
// itself the model sometimes set the design on a cream mat, which would print
// as a cream box on a shirt. A persona may give its own `edge` instead.
const NAVY_TO_THE_EDGE = `The design fills the whole canvas. Its frame is a
    band of solid ink navy that runs right out to all four edges of the
    canvas, so the outermost strip on every side is ink navy, with a slim
    antique gold keyline set just inside it.`;

function textClause(text) {
  if (text) {
    return `

    THE NAME. Across the lower part of the design runs one wide, clean banner
    in ink navy with an antique gold edge. On it, in large, evenly spaced,
    antique gold capital letters, is exactly this and nothing else: "${text}".
    Spell it exactly as given, every character, once. That banner is the only
    lettering anywhere in the picture; every other surface is pictorial.`;
  }
  return `

    The design is entirely pictorial. The lower border carries one small
    ornamental flourish in antique gold, and every surface in the picture is
    image, pattern or plain material.`;
}

// ============================================================================
// THE PERSONAS
// ============================================================================
// key      what the page sends and what is stored as styleChoice
// appKey   what the app sends (src/data/catalog.ts in the legendmaker repo)
// scene    who they are drawn as. One paragraph, costume fully described,
//          because the costume replaces the clothes in the photograph.

export const LEGEND_PERSONAS = {
  legendMonarch: {
    appKey: 'monarch', label: 'The Monarch', allowsText: true,
    scene: `THE MONARCH. A grand old-master oil portrait of the person as a
      beloved king or queen. They wear a golden crown set with coloured
      stones, a deep crimson velvet robe with a wide white fur collar, and a
      gold chain of office over a crimson tunic or gown heavily embroidered
      in gold. One hand
      rests on the pommel of a ceremonial sceptre. Behind them hang heavy
      draped curtains and a carved stone column, lit by warm window light.`
  },
  legendRockStar: {
    appKey: 'rockstar', label: 'Rock Star', allowsText: true,
    scene: `THE ROCK STAR. A bold concert-poster illustration of the person on
      stage in full flight. They wear a fitted black leather jacket over a
      plain dark shirt and hold a plain solid-coloured electric guitar with a
      smooth, clear headstock, one arm raised. Behind them beams of stage
      light in gold and rust cut through haze, with the dark shapes of a
      cheering crowd below.`
  },
  legendMovieStar: {
    appKey: 'moviestar', label: 'Movie Star', allowsText: true,
    scene: `THE MOVIE STAR. A classic painted film-poster portrait of the
      person as the star of a grand adventure picture. They wear elegant
      evening dress: a sharply tailored dinner jacket or a flowing gown, as
      suits them. Golden premiere searchlights sweep a deep blue night sky
      behind them, above the glow of a city skyline, and they look out with
      the calm of someone used to the lights.`
  },
  legendChampion: {
    appKey: 'champion', label: 'The Champion', allowsText: true,
    scene: `THE CHAMPION. A vintage sports-card illustration of the person as
      the hometown hero. They wear a classic athletic uniform in ink navy and
      antique gold: a plain jersey with a single gold star on the chest and
      plain striped trim, and hold a gleaming gold trophy cup against one
      shoulder. Behind them a sunburst of cream and gold rays spreads over
      the soft shapes of a packed stadium.`
  },
  legendAstronaut: {
    appKey: 'astronaut', label: 'Astronaut', allowsText: true,
    scene: `THE ASTRONAUT. A mission-poster illustration of the person as a
      space commander ready for launch. They wear a white and slate space
      suit with plain gold trim and a single original star emblem on the
      shoulder, and carry the helmet under one arm so the face is fully
      seen. Behind them a tall rocket stands on its pad at dawn, under a sky
      turning from navy to gold with the first stars still showing.`
  },
  legendActionHero: {
    appKey: 'hero', label: 'Action Hero', allowsText: true,
    scene: `THE ACTION HERO. A bold comic-cover illustration of the person as
      an original caped hero. They wear a fitted suit in ink navy with rust
      and gold panels, a flowing rust cape, and one simple gold flame emblem
      on the chest. Face uncovered, fists on hips, they stand on a rooftop
      above a city at sunset, the cape lifting in the wind.`
  },
  legendOutlaw: {
    appKey: 'outlaw', label: 'Western Legend', allowsText: true,
    scene: `THE WESTERN LEGEND. A weathered frontier poster on aged cream
      paper with worn edges, printed in ink navy and rust like an old
      woodcut. The person is the legend of the territory: a wide-brimmed
      hat pushed back so the face is clear, a plain bandana at the neck, a
      canvas duster coat over a waistcoat. Behind them a desert mesa and a
      low sun. The paper around the portrait carries ornamental woodcut
      corners and rules.`,
    // The paper is the design. Pure white around it is cleared afterwards,
    // so the sheet prints with its own ragged edge.
    edge: `The design is one sheet of aged cream paper with worn, ragged
      edges, lying flat and square to the viewer on a plain, pure white
      background, with a thin even strip of that white showing on all four
      sides.`
  },
  legendChef: {
    appKey: 'chef', label: 'Head Chef', allowsText: true,
    scene: `THE HEAD CHEF. A warm, painterly portrait of the person as the
      head chef of the finest kitchen in town. They wear a crisp white
      double-breasted chef's jacket with plain buttons and a tall white
      toque, arms folded with easy authority. Behind them a line of
      gleaming copper pans hangs above a busy stove, with steam rising in
      warm golden light.`
  },
  legendExplorer: {
    appKey: 'explorer', label: 'Explorer', allowsText: true,
    scene: `THE EXPLORER. A vintage expedition-poster illustration of the
      person at the summit. They wear a waxed canvas jacket, a wool scarf
      and a canvas rucksack with leather straps, one hand on a wooden
      walking staff. Behind and below them, ranges of blue mountains roll
      away under a huge golden sunrise, with a river winding through the
      valley far below.`
  },
  legendNoble: {
    appKey: 'noble', label: 'Renaissance Noble', allowsText: false,
    scene: `THE RENAISSANCE NOBLE. A candlelit old-master portrait of the
      person as a noble patron. They wear a deep green velvet doublet or
      gown with a white lace collar and cuffs, and a single pearl or a
      simple gold chain. One hand rests on a closed leather-bound book. The
      background is a dark, warm interior with a glimpse of an arched
      window and a distant painted landscape.`
  }
};

// 'monarch' (app), 'legendMonarch' (page) or 'The Monarch' → 'legendMonarch'.
// NOT exported, on purpose (found in the first live test, 16 Nov 2026): Wix
// turns every function a .web.js file exports into a remote call that answers
// with a Promise, even for another backend file. appBackend.js got a Promise
// where it expected a key, and crashed. Only webMethods and plain data
// (objects, strings) are exported from this file; appBackend.js has its own
// copy of this lookup.
function legendPersonaKey(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return null;
  for (const [key, p] of Object.entries(LEGEND_PERSONAS)) {
    if (key.toLowerCase() === v || p.appKey === v || p.label.toLowerCase() === v) return key;
  }
  return null;
}

function buildPrompt(personaKey, text, notes) {
  const p = LEGEND_PERSONAS[personaKey];
  const noteLine = notes ? `What can be seen of them in the photograph: ${notes}` : '';
  return [
    FRESH,
    p.scene,
    LIKENESS.replace('{NOTES}', noteLine),
    INVENTED_WORLD,
    ALIVE_AND_WELL,
    HOUSE.replace('{EDGE}', p.edge || NAVY_TO_THE_EDGE)
  ].join('\n\n    ') + textClause(p.allowsText ? text : '');
}

// The personas, for the page's picker. No prompts leave the server.
export const getLegendPersonas = webMethod(Permissions.Anyone, async () => {
  return Object.entries(LEGEND_PERSONAS).map(([key, p]) => ({
    key, appKey: p.appKey, label: p.label, allowsText: p.allowsText
  }));
});

// ============================================================================
// STEP 1: START A DESIGN
// ============================================================================
// Returns at once; the work carries on in the background (Wix stops waiting on
// a backend call after about 14 seconds). Every failure comes back as data,
// { ok: false, step, reason }, never a throw.
//
//   who         'self' | 'gift' | 'memorial'
//   whoConsent  true only when the customer ticked that answer's promise

export const startLegendDesign = webMethod(
  Permissions.Anyone,
  async (photoUrl, personaValue, visitorId, customText, who, whoConsent) => {
    try {
      const personaKey = legendPersonaKey(personaValue);
      if (!personaKey) {
        return { ok: false, step: 'style', reason: `Unknown persona "${personaValue}". Use one of: ${Object.keys(LEGEND_PERSONAS).join(', ')}.` };
      }

      // THE PROMISE COMES FIRST. No answer, or no tick, and nothing is made.
      if (!WHO.includes(who) || whoConsent !== true) {
        return {
          ok: false, step: 'consent', customerSafe: true,
          reason: 'Please tell us who is in the photo and tick the box that goes with it.'
        };
      }

      if (!visitorId) {
        return {
          ok: false, step: 'visitor', customerSafe: true,
          reason: 'Your browser isn\'t letting this page remember your designs. Please allow site data for goodwookie.com, or try a regular (non-private) window.'
        };
      }

      const good = await countGoodDesignsForVisitor(visitorId, 24);
      if (good >= MAX_DESIGNS_PER_VISITOR_PER_DAY) {
        return {
          ok: false, step: 'daily limit', customerSafe: true,
          reason: `You've made ${MAX_DESIGNS_PER_VISITOR_PER_DAY} designs in the last 24 hours, which is the limit. Designs refresh on a rolling 24 hours, so a new one opens up a day after your earliest one.`
        };
      }
      const attempts = await countRecentDesignsForVisitor(visitorId, 24);
      if (attempts >= MAX_ATTEMPTS_PER_VISITOR_PER_DAY) {
        return {
          ok: false, step: 'attempt ceiling', customerSafe: true,
          reason: `That's ${attempts} tries in the last 24 hours, which is the limit. Tries refresh on a rolling 24 hours, so a new one opens up a day after your earliest one.`
        };
      }
      const siteWide = await countRecentDesignsSiteWide(1);
      if (siteWide >= MAX_DESIGNS_SITE_WIDE_PER_HOUR) {
        return { ok: false, step: 'site busy', customerSafe: true, reason: 'Our design studio is very busy right now. Please try again in a little while.' };
      }

      // The name, narrowed and then read by the safety model, before a penny
      // of generation is spent.
      const persona = LEGEND_PERSONAS[personaKey];
      const text = persona.allowsText ? cleanCustomText(customText) : '';
      if (text) {
        const apiKey = String(await getSecret('GEMINI_API_KEY')).trim();
        const verdict = await checkLegendText(apiKey, text);
        if (verdict.reject) {
          return {
            ok: false,
            step: verdict.transient ? 'text checker' : 'text',
            customerSafe: true,
            reason: verdict.transient ? verdict.reason : 'That wording can\'t go on a printed product. Try a first name or a nickname.'
          };
        }
      }

      const publicPhotoUrl = toPublicImageUrl(photoUrl);
      const consentAt = new Date();
      const designRecordId = await createDesignRecord({
        originalPhotoUrl: publicPhotoUrl,
        styleChoice: personaKey,
        visitorId,
        customText: text,
        subject: 'person',
        subjectMode: who,
        whoConsentAt: consentAt,
        status: 'pending'
      });

      // DID THE PROMISE ACTUALLY SAVE? Wix Data drops fields the collection
      // doesn't have and reports success. A portrait with no record of whose
      // it is and when they agreed must not be made, so this fails closed.
      const saved = await getDesignRecord(designRecordId);
      if (!saved || saved.subjectMode !== who || !saved.whoConsentAt) {
        await updateDesignRecord(designRecordId, {
          status: 'error',
          moderationNote: 'Not made: the PetDesigns collection is missing the subject / subjectMode / whoConsentAt fields.'
        });
        console.error('Legend Maker: the PetDesigns collection needs the fields "subject" (Text), "subjectMode" (Text) and "whoConsentAt" (Date and Time). No design was made.');
        return { ok: false, step: 'setup', reason: 'Legend Maker isn\'t fully set up yet: the PetDesigns collection is missing its consent fields.' };
      }

      // Deliberately NOT awaited: it keeps running after this call returns.
      runLegendGeneration(designRecordId, publicPhotoUrl, personaKey, photoUrl, text).catch(async (err) => {
        console.error(`Legend design ${designRecordId} failed: ${err.message}`);
        try {
          await updateDesignRecord(designRecordId, { status: 'error', moderationNote: err.message });
        } catch (e) { /* nothing more we can do */ }
      });

      return { ok: true, designRecordId };
    } catch (e) {
      console.error(`startLegendDesign failed: ${e.message}`);
      return { ok: false, step: 'starting the design', reason: e.message };
    }
  }
);

// ============================================================================
// STEP 2: IS IT READY?  (for the web page; the app asks appBackend.js)
// ============================================================================

const STUCK_AFTER_MS = 5 * 60 * 1000;
const LOST_AFTER_MS = 12 * 60 * 1000;
const STUCK_NOTE = 'Finished; the job stopped early, so the safety checks ran afterwards and passed.';
const LOST_NOTE = 'The job stopped before any picture was saved.';

export const getLegendDesignStatus = webMethod(
  Permissions.Anyone,
  async (designRecordId) => {
    const d = await rescueStuckLegend(await getDesignRecord(designRecordId));
    if (!d || !LEGEND_PERSONAS[d.styleChoice]) {
      return { status: 'error', message: 'Design not found. Please try again.', customerSafe: true };
    }
    const note = String(d.moderationNote || '');
    const messages = {
      blocked: note === NO_PERSON_NOTE
        ? 'We couldn\'t find a clear face in that photo. Try one person, head and shoulders, in good light.'
        : note === MINOR_NOTE
          ? `It looks like the person in that photo may be younger than ${MIN_AGE}. We only make portraits of adults.`
          : note === CROWD_NOTE
            ? 'There is more than one person in that photo. Please use a photo of just the one person.'
            : note === FAMOUS_NOTE
              ? 'We can only draw you, or someone you know who has agreed, not well-known faces. Please try a different photo.'
              : 'That photo couldn\'t be used for a design. Please try a different photo.',
      unclean: 'That one didn\'t come out right, so we didn\'t keep it. Try another look, or a different photo.',
      error: 'The design studio hit a snag. Please try again in a few minutes.'
    };
    // The print file never leaves the backend: only the watermarked preview.
    const done = d.status === 'ready' || d.status === 'flagged';
    const safeUrl = done ? (d.previewArtUrl || null) : null;
    return {
      status: d.status,                // pending | ready | flagged | blocked | unclean | error
      customText: d.customText || '',
      previewArtUrl: safeUrl,
      message: messages[d.status] || null,
      customerSafe: messages[d.status] ? true : undefined
    };
  }
);

// A job Wix stopped before the end. Files saved: run the checks now and show
// it, flagged for Don. Nothing saved after 12 minutes: mark it lost.
async function rescueStuckLegend(d) {
  if (!d || d.status !== 'pending' || !LEGEND_PERSONAS[d.styleChoice]) return d;
  const age = Date.now() - new Date(d._createdDate).getTime();
  try {
    if (!d.previewArtUrl || !d.generatedArtUrl) {
      if (age <= LOST_AFTER_MS) return d;
      await updateDesignRecord(d._id, { status: 'error', moderationNote: LOST_NOTE });
      return { ...d, status: 'error', moderationNote: LOST_NOTE };
    }
    if (age <= STUCK_AFTER_MS) return d;
    const apiKey = String(await getSecret('GEMINI_API_KEY')).trim();
    const resp = await globalThis.fetch(toPublicImageUrl(d.previewArtUrl));
    if (!resp.ok) return d;
    const buf = Buffer.from(await resp.arrayBuffer());
    const small = toCheckJpeg(buf) || buf;
    const inline = { mimeType: small === buf ? (resp.headers.get('content-type') || 'image/png') : 'image/jpeg', data: small.toString('base64') };
    const [harm, figure] = await Promise.all([harmCheck(apiKey, inline), figureCheck(apiKey, inline, d.customText || '')]);
    if (harm || figure) {
      const why = `Rescued, then refused: ${harm || figure}`;
      await updateDesignRecord(d._id, { status: 'unclean', moderationNote: why });
      return { ...d, status: 'unclean', moderationNote: why };
    }
    await updateDesignRecord(d._id, { status: 'flagged', moderationNote: STUCK_NOTE });
    return { ...d, status: 'flagged', moderationNote: STUCK_NOTE };
  } catch (e) {
    console.warn(`Legend design ${d._id}: couldn't rescue it: ${e.message}`);
    return d;
  }
}

// ============================================================================
// THE JOB
// ============================================================================

async function runLegendGeneration(designRecordId, publicPhotoUrl, personaKey, rawPhotoUrl, text) {
  const startedAt = Date.now();
  const apiKey = String(await getSecret('GEMINI_API_KEY')).trim();

  // A smaller copy of the photo (max 1024px): faster to send, and enough.
  let photo;
  try {
    photo = await downloadImage(`${publicPhotoUrl}/v1/fit/w_1024,h_1024,q_85/photo.jpg`);
  } catch (e) {
    photo = await downloadImage(publicPhotoUrl);
  }

  // 0. Look at the PHOTO before drawing anything.
  const photoCheck = await checkPersonPhoto(apiKey, photo);
  if (photoCheck.reject) {
    if (photoCheck.transient) {
      // The checker was down. Not the customer's fault: keep the upload.
      await updateDesignRecord(designRecordId, { status: 'error', moderationNote: photoCheck.reason });
      return;
    }
    await updateDesignRecord(designRecordId, {
      status: 'blocked',
      moderationNote: photoCheck.note || `Photo rejected: ${photoCheck.reason}`
    });
    // A refused photo is deleted at once, for good.
    await deleteUpload(rawPhotoUrl, designRecordId);
    console.warn(`Legend design ${designRecordId} blocked at upload: ${photoCheck.reason}`);
    return;
  }

  const prompt = buildPrompt(personaKey, text, photoCheck.describe);
  const maxTries = RETRY_ONCE ? 2 : 1;
  let art = null, problem = null, drawings = 0;

  // 1. Draw it, then check it. A picture that fails a check is drawn again
  //    from the photo, once, silently. The customer never sees the bad one.
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    drawings = attempt;
    problem = null;
    art = await generateImage(apiKey, prompt, photo.photoMimeType, photo.photoBuffer);
    if (!art) {
      await updateDesignRecord(designRecordId, { status: 'blocked', moderationNote: 'Gemini returned no image.' });
      return;
    }

    const small = toCheckJpeg(art.buffer) || art.buffer;
    const inline = { mimeType: small === art.buffer ? art.mimeType : 'image/jpeg', data: small.toString('base64') };

    // 1a. The name, read back. A misspelled name on a print is a refund.
    if (text) {
      try {
        if (await textCameOutWrong(apiKey, inline, text)) problem = `The banner didn't come out reading "${text}".`;
      } catch (e) {
        console.error(`Legend design ${designRecordId}: name read-back couldn't run: ${e.message}. Accepting the design.`);
      }
    }

    // 1b. Alive and well (fails CLOSED), and the right figure with no brand
    //     marks or stray lettering (fails open). Asked at the same time.
    if (!problem) {
      const [harm, figure] = await Promise.all([harmCheck(apiKey, inline), figureCheck(apiKey, inline, text)]);
      if (harm) problem = `The design showed injury, death or violence (${harm}).`;
      else if (figure) problem = `The portrait didn't come out right (${figure}).`;
    }

    if (!problem) break;
    console.warn(`Legend design ${designRecordId}: attempt ${attempt}: ${problem}`);
  }

  const genSeconds = Math.round((Date.now() - startedAt) / 1000);

  // 2. Both tries failed. Not shown, and it doesn't count toward the 5.
  if (problem) {
    await updateDesignRecord(designRecordId, { status: 'unclean', moderationNote: `${problem} [${drawings} drawn, ${genSeconds}s]` });
    return;
  }

  // 3. Full bleed, so nothing is cut out. Only plain white touching the outer
  //    edge is cleared, because white is real ink on a coloured shirt.
  let artBuffer = art.buffer;
  let cleanNote = '';
  try {
    const outer = clearOuterWhite(art.buffer);
    if (outer && outer.buffer) { artBuffer = outer.buffer; cleanNote = outer.note || ''; }
  } catch (e) {
    console.warn(`Legend design ${designRecordId}: edge clean-up skipped: ${e.message}`);
  }

  // Saved in the same folder as pet designs, so the nightly 7-day clean-up in
  // petDesigns.js covers these files without being changed.
  const uploadResult = await mediaManager.upload(
    '/pet-designs',
    artBuffer,
    `legend-design-${designRecordId}.png`,
    { mediaOptions: { mimeType: 'image/png', mediaType: 'image' } }
  );
  const generatedArtWixUrl = uploadResult.fileUrl;
  const generatedArtUrl = toPublicImageUrl(generatedArtWixUrl);

  // The watermarked web copy: the only file a customer ever receives before
  // they have paid.
  let previewArtUrl = '';
  let previewArtWixUrl = '';
  try {
    let webCopy = toWebPng(artBuffer);
    if (webCopy) {
      try { webCopy = await watermarkPreview(webCopy); }
      catch (e) { console.error(`Legend design ${designRecordId}: WATERMARK FAILED: ${e.message}. Preview saved without it.`); }
      const previewUpload = await mediaManager.upload(
        '/pet-designs',
        webCopy,
        `legend-preview-${designRecordId}.png`,
        { mediaOptions: { mimeType: 'image/png', mediaType: 'image' } }
      );
      previewArtWixUrl = previewUpload.fileUrl;
      previewArtUrl = toPublicImageUrl(previewArtWixUrl);
    }
  } catch (e) {
    console.error(`Legend design ${designRecordId}: couldn't make a web copy: ${e.message}. Design saved, but it has no preview to show.`);
  }

  // Save the addresses now, still 'pending', so a job stopped after this line
  // leaves a design that rescueStuckLegend() can finish.
  try {
    await updateDesignRecord(designRecordId, { generatedArtUrl, previewArtUrl });
  } catch (e) {
    console.warn(`Legend design ${designRecordId}: couldn't save the file addresses early: ${e.message}`);
  }

  await waitForMedia(previewArtWixUrl || generatedArtWixUrl, designRecordId);

  // 4. The second opinion. Best effort: a design is never lost because this
  //    couldn't run; it is shown, and flagged for Don.
  let verdict = { flagged: false, note: '' };
  try {
    const small = toCheckJpeg(artBuffer) || art.buffer;
    verdict = await selfCheckPortrait(apiKey, {
      mimeType: small === art.buffer ? art.mimeType : 'image/jpeg',
      data: small.toString('base64')
    });
  } catch (e) {
    verdict = { flagged: true, note: `Self-check did not run: ${e.message}` };
  }

  await updateDesignRecord(designRecordId, {
    generatedArtUrl,
    previewArtUrl,
    status: verdict.flagged ? 'flagged' : 'ready',
    moderationNote: [verdict.note, cleanNote, `[${drawings} drawn, ${Math.round((Date.now() - startedAt) / 1000)}s]`].filter(Boolean).join(' | ')
  });

  console.log(`Legend design ${designRecordId} finished in ${Math.round((Date.now() - startedAt) / 1000)}s (Gemini ${genSeconds}s).`);
}

async function generateImage(apiKey, promptText, inputMimeType, inputBuffer) {
  const body = {
    contents: [{
      parts: [
        { inlineData: { mimeType: inputMimeType, data: inputBuffer.toString('base64') } },
        { text: promptText }
      ]
    }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: ART_ASPECT, imageSize: '4K' }
    }
  };
  const resp = await callGemini(IMAGE_MODEL, apiKey, body);
  const json = await resp.json();
  if (!resp.ok) throw new Error(`Gemini error ${resp.status}: ${json.error?.message || ''}`);
  const candidate = json.candidates && json.candidates[0];
  const imagePart = (candidate?.content?.parts || []).find(p => p.inlineData);
  if (!candidate || !imagePart) return null;
  return {
    buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
    mimeType: imagePart.inlineData.mimeType || 'image/png'
  };
}

// ============================================================================
// THE CHECKS
// ============================================================================

async function askChecker(apiKey, promptText, inline) {
  const parts = [{ text: promptText }];
  if (inline) parts.push({ inlineData: { mimeType: inline.mimeType || 'image/jpeg', data: inline.data } });
  const resp = await callGemini(CHECK_MODEL, apiKey, {
    contents: [{ parts }],
    generationConfig: { responseMimeType: 'application/json' }
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(`checker answered ${resp.status}`);
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// THE GATE ON THE PHOTO. A hard gate that fails CLOSED: if it can't run, or
// it forgets a field, nothing is drawn. One adult, nobody famous, nothing
// that has no business on a family storefront.
async function checkPersonPhoto(apiKey, photo) {
  const unavailable = { reject: true, transient: true, reason: 'The photo checker is busy. Please try again in a minute.' };
  let v;
  try {
    v = await askChecker(apiKey, `A customer uploaded this photo to a
      family-friendly print shop to have ONE adult in it drawn as an
      illustrated portrait. Reply with strict JSON only:
      {"reject": true|false, "reason": "short reason or empty string",
      "people": <number>, "faceClear": true|false, "minor": true|false,
      "famous": true|false, "harm": true|false, "describe": "one short line"}.

      "people" is how many real people are visible anywhere in the photo,
      counting anyone whose face or body is clearly part of the picture,
      including people in the background. A person in a poster, on a screen or
      printed on a shirt is not counted. A drawing, a doll, a statue or an
      animal is not a person.

      "faceClear" is true only if that person's face is clearly visible:
      facing the camera or nearly so, in focus, reasonably lit, both eyes
      visible, not hidden by a mask, a hand or dark sunglasses.

      "minor" is true if ANY person in the photo could be younger than
      ${MIN_AGE}: a baby, a child or a teenager. When you are unsure whether
      someone is at least ${MIN_AGE}, answer true.

      "famous" is true if any person in the photo appears to be a
      recognisable celebrity, politician, athlete or other public figure, or
      if the picture is a still from a film, a show, a broadcast or a
      professional publicity photograph.

      "harm" is true if the photo shows blood, wounds, injury, a dead person
      or animal, fighting, any act of violence, or a weapon aimed at a person
      or an animal. A person in a hospital bed, visibly unwell or not
      conscious is also true. When you are unsure, answer true.

      "describe" is a plain note of what can be seen, to help an illustrator
      keep the likeness: hair colour and style, hairline, beard or moustache,
      glasses, and anything distinctive such as freckles or a dimple. Only
      what is visible. No name, and no guesses about who they are, their age,
      their background or anything else about them.

      Set reject to true for: nudity, underwear, swimwear or any sexual
      content; anyone in a state of undress; graphic violence or gore; hate
      symbols; or anything showing a person in a degrading or humiliating
      way. Set reject to false for everything else.`,
      { mimeType: photo.photoMimeType, data: photo.photoBuffer.toString('base64') });
  } catch (e) {
    console.warn(`Legend photo check couldn't run: ${e.message}`);
    return unavailable;
  }

  if (v.reject === true) return { reject: true, reason: v.reason || 'unsuitable photo' };
  // Missing or odd answers count against the photo from here down.
  if (v.harm !== false) return { reject: true, reason: 'injury, death or violence', note: HARM_NOTE };

  const n = Number(v.people);
  const people = Number.isFinite(n) ? Math.max(Math.round(n), 0) : 0;
  if (people < 1 || v.faceClear !== true) return { reject: true, reason: 'no clear face', note: NO_PERSON_NOTE };
  if (v.minor !== false) return { reject: true, reason: `someone under ${MIN_AGE}`, note: MINOR_NOTE };
  if (people > 1) return { reject: true, reason: 'more than one person', note: CROWD_NOTE };
  if (v.famous !== false) return { reject: true, reason: 'well-known person', note: FAMOUS_NOTE };

  // Our own checker's words, but they go into a prompt, so they are cleaned
  // the way a customer's text is.
  const describe = String(v.describe || '').replace(/[^A-Za-z0-9 ,.;:'()\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
  return { reject: false, reason: '', describe };
}

// Is this a name somebody could wear in public? Fails CLOSED.
async function checkLegendText(apiKey, text) {
  const busy = { reject: true, transient: true, reason: 'The text checker is busy. Please try again in a minute.' };
  try {
    const v = await askChecker(apiKey, `A customer typed this text to be
      printed in large capital letters under an illustrated portrait of
      themselves or someone they know, on a poster or t-shirt from a
      family-friendly shop. It is meant to be a first name, a nickname or a
      short proud title such as "KING DON", "CHEF MARIA" or "THE CLOSER".
      Reply with strict JSON only:
      {"reject": true|false, "reason": "short reason or empty string"}.

      Reject it for: profanity or crude language in any language, including
      disguised spellings; sexual references; slurs or hate terms; insults or
      anything meant to mock or humiliate the person pictured; drug
      references; threats or violence; anything that is an instruction or a
      command rather than a name; and any web address, phone number or handle.

      Also reject protected names: the name of a celebrity, athlete,
      musician, politician or other well-known real person; the name of a
      character owned by a comic, film, television, game or toy company; and
      the name of a brand, band, sports team, league, film, show or game.
      This shop prints and sells the design, so a protected name cannot go
      on it.

      Accept ordinary first names and surnames, nicknames, and titles built
      from ordinary words (KING, QUEEN, CAPTAIN, CHEF, COACH, DOC, THE
      LEGEND, GRANDPA JOE). An ordinary name that a famous person also
      happens to have (MICHAEL, TAYLOR, JORDAN, ELVIS as a first name alone)
      is a name: accept it. When in doubt about a plain unusual name, accept
      it.

      The text is: "${text}"`);
    return { reject: v.reject === true, reason: v.reason || 'unsuitable text' };
  } catch (e) {
    console.warn(`Legend text check couldn't run: ${e.message}`);
    return busy;
  }
}

// ALIVE AND WELL: the finished picture. Returns null when fine, or a short
// reason. Fails CLOSED: a check that can't run returns a reason.
async function harmCheck(apiKey, inline) {
  try {
    const v = await askChecker(apiKey, `This illustration will be printed on
      posters and clothing for a family-friendly shop. Reply with strict JSON
      only: {"harm": true|false, "reason": "short reason or empty string"}.
      "harm" is true if ANY part of the picture shows: a dead, injured,
      bleeding, wounded or suffering person or animal; blood or gore;
      fighting, attacking or any violence; a weapon being used or aimed;
      nudity or anything sexual; or a person shown in a degrading way. A
      ceremonial sceptre, a trophy, a guitar or a walking staff is not a
      weapon. Otherwise "harm" is false.`, inline);
    if (v.harm === false) return null;
    return String(v.reason || 'unsafe content').slice(0, 120);
  } catch (e) {
    console.warn(`Legend harm check couldn't run: ${e.message}`);
    return 'the safety check could not run';
  }
}

// THE RIGHT FIGURE, AND NOTHING BORROWED. One adult; no brand marks, team or
// league marks; no lettering except the name asked for. Returns a short
// reason, or null when it's fine or the check can't run (fails open: the
// second opinion below still flags anything doubtful for Don).
async function figureCheck(apiKey, inline, expectedText) {
  try {
    const v = await askChecker(apiKey, `This illustration is a portrait of
      one adult, made to be printed and sold. Reply with strict JSON only:
      {"people": <number>, "looksUnder18": true|false, "brandMark": true|false,
      "otherText": "<any readable words or letters, or empty string>",
      "reason": "short reason or empty string"}.
      "people" is how many people are drawn as subjects (a distant crowd of
      tiny background figures is not counted).
      "looksUnder18" is true if the main person looks like a child or a
      teenager.
      "brandMark" is true if the picture shows the logo, wordmark, crest or
      uniform of any real company, product, sports team, league, band, film,
      show, game or character. A simple generic shape such as a plain star,
      crown, flame, laurel or mountain is not a brand mark.
      "otherText" is every readable word, letter or number in the picture
      ${expectedText ? `EXCEPT the banner text "${expectedText}"` : ''}. Decorative
      flourishes and unreadable squiggles are not text.`, inline);
    if (v.looksUnder18 === true) return 'the person looks under 18';
    const n = Number(v.people);
    if (Number.isFinite(n) && n !== 1) return `${n} people drawn instead of one`;
    if (v.brandMark === true) return `a brand or team mark: ${String(v.reason || '').slice(0, 80)}`;
    const other = String(v.otherText || '').trim();
    if (other) return `stray lettering: ${other.slice(0, 60)}`;
    return null;
  } catch (e) {
    console.warn(`Legend figure check couldn't run: ${e.message}`);
    return null;
  }
}

// The second opinion. Not a hard gate: a flagged design is still shown, and
// is marked "flagged" in PetDesigns for Don to look at before it prints.
async function selfCheckPortrait(apiKey, inline) {
  try {
    const v = await askChecker(apiKey, `Look at this illustrated portrait,
      which will be printed and sold publicly by a family-friendly shop.
      Reply with strict JSON only: {"flagged": true|false, "reason": "short
      reason or empty string"}. Flag it if it contains anything sexual,
      violent, hateful, mocking or otherwise inappropriate for a general
      audience; if the person looks younger than ${MIN_AGE}; if the person
      appears to be a recognisable celebrity or public figure; or if it
      shows a character, costume, logo or uniform that belongs to a real
      company, team, film, show, game or band. Otherwise flagged is false.`, inline);
    return { flagged: !!v.flagged, note: v.reason || '' };
  } catch (err) {
    return { flagged: true, note: `Self-check failed: ${err.message}` };
  }
}

// ============================================================================
// COPIED FROM aiDesign.web.js (16 Nov 2026), unchanged.
// If one of these is fixed there, fix it here too.
// ============================================================================

const IMAGE_CALL_LIMIT_MS = 150000;
const CHECK_CALL_LIMIT_MS = 30000;

async function waitForMedia(wixMediaUrl, designRecordId, timeoutMs = 20000) {
  if (!wixMediaUrl) return false;

  // ELEVATED INSIDE THE FUNCTION, NEVER AT MODULE LOAD.
  //
  // We have been bitten by this twice. Elevating at module load looks fine,
  // throws nothing, and quietly returns a thinner result — the fulfilment
  // sweep once reported one order instead of five that way. Do it here.
  const readDescriptor = mediaAuth.elevate(mediaFiles.getFileDescriptor);

  const startedAt = Date.now();
  let delay = 400;
  let warnedAboutShape = false;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const descriptor = await readDescriptor(wixMediaUrl);
      const status = descriptor?.operationStatus;

      if (status === 'READY') {
        console.log(`Design ${designRecordId}: file READY after ${Date.now() - startedAt}ms.`);
        return true;
      }
      if (status === 'FAILED') {
        console.error(`Design ${designRecordId}: Wix reports the upload FAILED.`);
        return false;
      }
      if (!status && !warnedAboutShape) {
        // We got an answer but no operationStatus on it. Rather than looping
        // silently until the timeout, say so once — a changed response shape
        // should be a line in the log, not a mysterious 20-second wait.
        warnedAboutShape = true;
        console.warn(
          `Design ${designRecordId}: file descriptor came back without an ` +
          `operationStatus. Keys: ${Object.keys(descriptor || {}).join(', ') || '(none)'}`
        );
      }
      // PENDING, or nothing recognisable — keep waiting.
    } catch (e) {
      // RESOURCE_NOT_FOUND is expected for a second or two after uploading:
      // the descriptor itself hasn't landed yet. Anything else we also ride
      // out, because a readiness check must never sink a finished design.
    }
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(Math.round(delay * 1.4), 2500);   // back off, stay responsive
  }

  console.warn(`Design ${designRecordId}: file still not READY after ${timeoutMs}ms — saving anyway.`);
  return false;
}

async function deleteUpload(rawPhotoUrl, designRecordId) {
  if (!rawPhotoUrl) return;
  try {
    // Elevated in here, not at module load. Same rule as waitForMedia.
    const deleteFiles = mediaAuth.elevate(mediaFiles.bulkDeleteFiles);

    // permanent: true, deliberately. The default moves files to the Media
    // Manager's trash bin, where a refused photo would still be sitting in
    // Don's account — which defeats the entire point of deleting it. This is
    // irreversible, and that is what we want here: these are photos a safety
    // gate has already refused, and nobody should have to look at them twice.
    await deleteFiles([rawPhotoUrl], { permanent: true });

    console.log(`Design ${designRecordId}: refused photo permanently deleted from the Media Manager.`);
  } catch (e) {
    console.warn(`Design ${designRecordId}: couldn't delete the refused photo — ${e.message}`);
  }
}

function cleanCustomText(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[^A-Za-z0-9 '.\-!?$@&+#%,:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_LENGTH)
    .toUpperCase();
}

async function textCameOutWrong(apiKey, inlineImage, expected) {
  if (!expected) return false;
  const body = {
    contents: [{
      parts: [
        { text: `This artwork has a banner with one line of text in it. Read
          that text and reply with strict JSON only:
          {"reads": "<exactly what the banner says>", "matches": true|false}.
          "matches" is true only if the banner reads exactly "${expected}",
          character for character, ignoring differences in letter case,
          letter-spacing and font. Any missing letter, extra letter, wrong
          letter or misspelling means false. If you cannot find any banner text
          at all, "reads" is an empty string and "matches" is false.` },
        { inlineData: { mimeType: inlineImage.mimeType || 'image/png', data: inlineImage.data } }
      ]
    }],
    generationConfig: { responseMimeType: 'application/json' }
  };
  try {
    const resp = await callGemini(CHECK_MODEL, apiKey, body);
    const json = await resp.json();
    if (!resp.ok) return false;                 // don't fail a good design over a flaky check
    const v = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
    if (v.matches === true) return false;
    console.warn(`Banner reads "${v.reads}" but should read "${expected}".`);
    return true;
  } catch (e) {
    console.warn(`Text read-back couldn't run: ${e.message}`);
    return false;                               // same reasoning
  }
}

async function downloadImage(url) {
  const resp = await globalThis.fetch(url);
  if (!resp.ok) {
    throw new Error('We couldn\'t read that photo — please try uploading it again.');
  }
  const photoBuffer = Buffer.from(await resp.arrayBuffer());
  const photoMimeType = resp.headers.get('content-type') || 'image/jpeg';
  return { photoBuffer, photoMimeType };
}

function withTimeLimit(promise, ms, what) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} took longer than ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

async function callGemini(model, apiKey, body) {
  const ms = model === IMAGE_MODEL ? IMAGE_CALL_LIMIT_MS : CHECK_CALL_LIMIT_MS;
  return withTimeLimit(callGeminiOnce(model, apiKey, body), ms, `Gemini (${model})`);
}

async function callGeminiOnce(model, apiKey, body) {
  const first = await fetch(geminiUrl(model), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body)
  });
  if (first.status !== 401) return first;

  console.warn(`Gemini rejected the key in the header (401) — retrying with ?key= for ${model}`);
  return await fetch(`${geminiUrl(model)}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}
