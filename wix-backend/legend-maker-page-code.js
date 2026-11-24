// Page code for the "Legend Maker" page (www.goodwookie.com/legend-maker).
// Paste into THIS PAGE's code panel at the bottom of the editor, replacing
// everything there. Not in backend/.
//
// Written 24 Nov 2026 from the Design Your Pet page code (round 5), with the
// pet parts taken out and the parts for faces added:
//   - "Who is in this photo?" (It's me / It's a gift / In memory of someone)
//     and the promise that goes with the answer. The website refuses a design
//     without both.
//   - Ten legends in a repeater, each with its sample portrait.
//   - The Legend Maker products: poster, canvas, tee, hoodie. No bundle, no
//     back print.
//   - Designs and the daily limit come from legendDesign.web.js, by this
//     browser's ID, like the phone app. No site login is needed.
//
// The page is four boxes. This code shows one at a time:
//   #photoStep   Step 1      photo, who is in it, the promise, the AI consent
//   #styleStep   Steps 2-3   the legends, the name, Generate
//   #makingStep  Step 4      the navy "making" panel
//   #resultStep  Step 5      the preview, product choices, Add to cart
//
// When Preview opens, the browser console (F12 → Console) prints a line that
// starts with "PAGE SETUP". It lists any element name the code can't find.
// That is the first thing to check when something doesn't respond.

import { local, session } from 'wix-storage-frontend';
import { currentCart } from '@wix/ecom';
import wixEcomFrontend from 'wix-ecom-frontend';
import {
  startLegendDesign, getLegendDesignStatus,
  getLegendProductChoices, listMyLegendDesigns, getMyLegendAllowance
} from 'backend/legendDesign.web';
import { createMockupTask, checkMockupTask, getCartVariant } from 'backend/printfulMockup.web';

const WIX_STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e'; // constant, don't change

// ============================================================ SETTINGS

// TESTING AID. Set to false before customers use the page.
// true  = problems show the real technical reason.
// false = customers see the plain message instead.
const SHOW_ERROR_DETAIL = true;

// Flip to true once the app is in the stores and the badges are in #appBadges.
const SHOW_APP_BADGES = false;

// Shown in the preview frame before the customer's design loads. Leave empty
// to skip it.
const PLACEHOLDER_IMAGE_URL = '';

// How long the page waits for a design before it says the design will turn up
// in Your designs. Then it keeps checking quietly for 10 more minutes.
const MAX_WAIT_MS = 240000;     // 4 minutes
const LATE_POLL_MS = 10000;     // every 10 seconds
const LATE_WATCH_MS = 600000;   // for up to 10 more minutes
const TYPICAL_DESIGN_MS = 60000;   // only moves the progress bar

let designsPerDay = 5;   // replaced by the real number from the website

const NAVY = '#16202A';
const GOLD = '#C79A3E';
const CHOSEN_FILL = '#F3DFA8';

const PREVIEW_FAILED_MESSAGE =
  'Your portrait is finished and saved. We just couldn\'t show it on the product ' +
  'this time. Press Update preview, or pick it from Your designs below.';

// ============================================================ THE LEGENDS

// Value = the website's key (legendDesign.web.js); it must be exact. The
// sample pictures are Don's own test portraits, copied into the Media Manager
// on 24 Nov 2026 so the 7-day clean-up never deletes them.
const LEGENDS = [
  { key: 'legendMonarch', name: 'The Monarch', allowsText: true,
    blurb: 'Crowned and robed in a grand old-master oil portrait.',
    sample: 'https://static.wixstatic.com/media/94607f_aecc51e4a8db48f59febfbd77c5f9d4e~mv2.jpg' },
  { key: 'legendRockStar', name: 'Rock Star', allowsText: true,
    blurb: 'Centre stage under the lights, on your own tour poster.',
    sample: 'https://static.wixstatic.com/media/94607f_055c164caf834244a7160c1b78a4bc4d~mv2.jpg' },
  { key: 'legendMovieStar', name: 'Movie Star', allowsText: true,
    blurb: 'Your name above the title on a film that was never made.',
    sample: 'https://static.wixstatic.com/media/94607f_29f0e37b45884bbe95cdea5a13e75fb1~mv2.jpg' },
  { key: 'legendChampion', name: 'The Champion', allowsText: true,
    blurb: 'The hometown hero on a classic sports card.',
    sample: 'https://static.wixstatic.com/media/94607f_b7a6635f818c4423a6be2017d840cf99~mv2.jpg' },
  { key: 'legendAstronaut', name: 'Astronaut', allowsText: true,
    blurb: 'Suited up for launch on a mission poster.',
    sample: 'https://static.wixstatic.com/media/94607f_30f473b525d144d4ad906110f01707a7~mv2.jpg' },
  { key: 'legendActionHero', name: 'Action Hero', allowsText: true,
    blurb: 'The caped hero of your own comic cover.',
    sample: 'https://static.wixstatic.com/media/94607f_e7f8675331f04ade9d079308beb03178~mv2.jpg' },
  { key: 'legendOutlaw', name: 'Western Legend', allowsText: true,
    blurb: 'A weathered frontier poster with your face on it.',
    sample: 'https://static.wixstatic.com/media/94607f_309c7ea46e8e4563b2c594b099f66990~mv2.jpg' },
  { key: 'legendChef', name: 'Head Chef', allowsText: true,
    blurb: 'Whites on, arms folded, at the pass of the finest kitchen in town.',
    sample: 'https://static.wixstatic.com/media/94607f_ed07f61fe13240bdb57c25c52c5a8c76~mv2.jpg' },
  { key: 'legendExplorer', name: 'Explorer', allowsText: true,
    blurb: 'On a vintage expedition poster, at the top of the world.',
    sample: 'https://static.wixstatic.com/media/94607f_c4d974479fd0417bbcd49e6c8f82c79e~mv2.jpg' },
  { key: 'legendNoble', name: 'Renaissance Noble', allowsText: false,
    blurb: 'Velvet, lace and candlelight, painted like the masters\' patrons.',
    sample: 'https://static.wixstatic.com/media/94607f_6587c2cb4bfa488cbf39e73c2f1dd843~mv2.jpg' }
];
const DEFAULT_LEGEND = 'legendMonarch';
const MAX_TEXT = 18;

const TEXT_HELP = 'Optional. Up to 18 characters: a name, a year, a place or a short phrase. Profanity and trademarked names won\'t print.';
const NO_TEXT_HELP = 'The Renaissance Noble has no lettering. The portrait does the talking.';

function legendByKey(key) {
  return LEGENDS.find(l => l.key === key) || null;
}

// ============================================================ WHO IS IN THE PHOTO

// The radio group's values must be exactly self, gift and memorial. The
// promise box's words change with the answer. The website refuses a design
// unless one answer is picked AND its promise is ticked.
const WHO_PROMISES = {
  self: 'This is a photo of me, and I am 18 or older.',
  gift: 'The person in this photo is 18 or older and has agreed to me using it for this.',
  memorial: 'I am a member of this person\'s family, or have the family\'s blessing to use this photo.'
};
const WHO_HINTS = {
  self: 'A portrait of you.',
  gift: 'A portrait of someone you know.',
  memorial: 'A portrait of someone who has passed.'
};
const NO_WHO_YET = 'Choose who is in the photo above. We only make portraits of adults, and only with their say-so.';

// ============================================================ ELEMENT NAMES

// Two names are accepted for the elements copied from the Design Your Pet
// page, so the page works whether or not they've been renamed.
let PHOTO_UPLOAD = '#photoUpload';
let PROMISE_BOX = '#promiseCheckbox';
let NAME_INPUT = '#nameInput';

const WHO_RADIO = '#whoRadio';
const PROMISE_TEXT = '#promiseText';   // optional: the promise as a text element
const WHO_HINT = '#whoHint';           // optional: one line under the answers
const PERSONA_REPEATER = '#personaRepeater';
const ALLOWANCE_TEXT = '#allowanceText';
const SEE_STYLES_BUTTON = '#seeStylesButton';
let UPDATE_BTN = '#updatePreviewButton';
let COLOR_LABEL = '#colorLabel';
let APP_BADGES = '#appBadges';

function pickName(primary, fallback) {
  return elementExists(primary) ? primary : (elementExists(fallback) ? fallback : primary);
}

const ELEMENTS_REQUIRED = [
  '#photoStep', '#styleStep', '#makingStep', '#resultStep',
  '#stepLabel', '#stepBar1', '#stepBar2', '#stepBar3', '#stepBar4', '#stepBar5',
  '#photoUpload', '#whoRadio', '#promiseCheckbox', '#aiConsentCheckbox', '#continueButton',
  '#photoThumb', '#changePhotoButton',
  '#personaRepeater', '#nameInput', '#textCounter', '#textHelp', '#generateButton',
  '#makingProgress', '#makingPercent', '#makingTitle', '#makingText', '#makingPill',
  '#previewImage', '#tryStyleButton', '#newPhotoButton',
  '#productDropdown', '#colorDropdown', '#sizeDropdown', '#addToCartButton',
  '#statusText', '#myDesignsTitle', '#designsRepeater'
];
const ELEMENTS_OPTIONAL = [
  '#promiseText', '#whoHint', '#makingRing', '#updatePreviewButton', '#colorLabel', '#appBadges',
  '#seeStylesButton', '#allowanceText', '#pillBox', '#photoPreview',
  '#photoSection', '#styleSection', '#makingSection', '#resultSection'
];
// Inside the legend repeater item: #personaCard (the item's box), #personaImage,
// #personaName, and optionally #personaBlurb.
// Inside the Your designs repeater item: #designThumb, #designLabel, and
// optionally #designCard.

// Old names from the Design Your Pet page that still work in place of a new one.
const OLD_NAMES = { '#photoUpload': '#petPhotoUpload', '#promiseCheckbox': '#ownPhotoCheckbox', '#nameInput': '#petNameInput' };

function auditElements() {
  const missing = ELEMENTS_REQUIRED.filter(id => !elementExists(id) && !(OLD_NAMES[id] && elementExists(OLD_NAMES[id])));
  const optionalMissing = ELEMENTS_OPTIONAL.filter(id => !elementExists(id));
  if (missing.length) {
    console.error(`PAGE SETUP - MISSING, the page needs these: ${missing.join(', ')}`);
  } else {
    console.log('PAGE SETUP - all required elements found.');
  }
  if (optionalMissing.length) {
    console.log(`PAGE SETUP - optional, fine to ignore: ${optionalMissing.join(', ')}`);
  }
  const leftovers = ['#styleStamp', '#stylePoster', '#includePeopleSwitch', '#jobDropdown', '#portraitDropdown', '#petNotesInput', '#bundleText', '#printDropdown']
    .filter(elementExists);
  if (leftovers.length) {
    console.log(`PAGE SETUP - pet-page elements this page doesn't use, safe to delete: ${leftovers.join(', ')}`);
  }
}

// ============================================================ PAGE STATE

let products = [];
let defaultProductKey = 'legendPoster';
let currentProductKey = 'legendPoster';
let selectedLegend = DEFAULT_LEGEND;
let photoUrl = null;
let currentDesign = null;        // { designRecordId, previewArtUrl, styleName }
let previewShows = null;
let generating = false;
let mockupRun = 0;
let statusTimer = null;
let makingTimers = [];
const original = {};

// ============================================================ START

$w.onReady(async function () {
  PHOTO_UPLOAD = pickName('#photoUpload', '#petPhotoUpload');
  PROMISE_BOX = pickName('#promiseCheckbox', '#ownPhotoCheckbox');
  NAME_INPUT = pickName('#nameInput', '#petNameInput');
  auditElements();

  safely('remember the editor look', rememberOriginals);

  safely('set the opening state', () => {
    setStatus('');
    if (elementExists(APP_BADGES)) {
      if (SHOW_APP_BADGES) $w(APP_BADGES).expand(); else $w(APP_BADGES).collapse();
    }
    try { $w('#previewImage').fitMode = 'fit'; } catch (e) { /* older editors */ }
    showStep('photo', { scroll: false });
  });

  // ---- Step 1
  safely('wire step 1', () => {
    $w(PHOTO_UPLOAD).onChange(() => {
      if (generating) return;
      photoUrl = null;
      refreshContinue();
      setStatus('');
      if (elementExists('#photoPreview') && ($w(PHOTO_UPLOAD).value || []).length > 0) uploadForPreview();
    });
    if (elementExists('#photoPreview')) $w('#photoPreview').hide();
    $w(WHO_RADIO).options = [
      { label: 'It\'s me', value: 'self' },
      { label: 'It\'s a gift', value: 'gift' },
      { label: 'In memory of someone', value: 'memorial' }
    ];
    try { $w(WHO_RADIO).selectedIndex = undefined; } catch (e) { /* starts with no answer anyway */ }
    $w(WHO_RADIO).onChange(() => {
      // A new answer needs its own promise, so the tick is cleared.
      safely('untick the promise', () => { $w(PROMISE_BOX).checked = false; });
      refreshWho();
    });
    $w(PROMISE_BOX).onChange(refreshContinue);
    $w('#aiConsentCheckbox').onChange(refreshContinue);
    $w('#continueButton').onClick(onContinueClicked);
    refreshWho();
  });
  safely('wire See the legends', () => {
    if (!elementExists(SEE_STYLES_BUTTON)) return;
    $w(SEE_STYLES_BUTTON).onClick(async () => {
      if (generating) return;
      setStatus('');
      await showStep('style');
    });
  });

  // ---- Steps 2-3
  safely('fill the legends', () => {
    $w(PERSONA_REPEATER).onItemReady(($item, itemData) => {
      safely(`fill ${itemData.key}`, () => {
        if (itemHas($item, '#personaImage')) {
          $item('#personaImage').src = itemData.sample;
          $item('#personaImage').alt = `${itemData.name} sample portrait`;
          $item('#personaImage').onClick(() => selectLegend(itemData.key));
        }
        if (itemHas($item, '#personaName')) {
          $item('#personaName').text = itemData.name;
          $item('#personaName').onClick(() => selectLegend(itemData.key));
        }
        if (itemHas($item, '#personaBlurb')) $item('#personaBlurb').text = itemData.blurb;
        if (itemHas($item, '#personaCard')) {
          $item('#personaCard').onClick(() => selectLegend(itemData.key));
          paintCard($item, '#personaCard', itemData.key === selectedLegend, 'persona');
        }
      });
    });
    $w(PERSONA_REPEATER).data = LEGENDS.map(l => ({ _id: l.key, ...l }));
    selectLegend(selectedLegend);
  });
  safely('cap the name length', () => { $w(NAME_INPUT).maxLength = MAX_TEXT; });
  safely('wire the name box', () => {
    $w(NAME_INPUT).placeholder = 'A name, a year or a place';
    $w(NAME_INPUT).onInput(updateCounter);
    updateCounter();
  });
  safely('wire Change and Generate', () => {
    $w('#changePhotoButton').onClick(() => {
      if (generating) return;
      startOverPhoto({ keepConsent: true });
    });
    $w('#generateButton').onClick(onGenerateClicked);
  });

  // ---- Step 5
  safely('wire step 5', () => {
    $w('#tryStyleButton').onClick(onTryAnotherStyle);
    $w('#newPhotoButton').onClick(() => {
      if (generating) return;
      startOverPhoto({ keepConsent: false });
    });
    $w('#addToCartButton').onClick(onAddToCartClicked);
    $w('#addToCartButton').disable();
    $w('#colorDropdown').onChange(onChoiceChanged);
    $w('#sizeDropdown').onChange(onChoiceChanged);
    if (elementExists(UPDATE_BTN)) {
      $w(UPDATE_BTN).disable();
      $w(UPDATE_BTN).onClick(onUpdatePreviewClicked);
    }
  });

  // ---- Your designs tray
  safely('wire the tray', () => {
    $w('#designsRepeater').onItemReady(($item, itemData) => {
      trayItemsBuilt++;
      try {
        $item('#designThumb').src = itemData.previewArtUrl;
        $item('#designThumb').alt = `${itemData.styleName} portrait`;
        $item('#designLabel').text = itemData.styleName || 'Portrait';
        $item('#designThumb').onClick(() => selectSavedDesign(itemData));
        $item('#designLabel').onClick(() => selectSavedDesign(itemData));
        if (itemHas($item, '#designCard')) {
          $item('#designCard').onClick(() => selectSavedDesign(itemData));
          paintCard($item, '#designCard', currentDesign && currentDesign.designRecordId === itemData._id, 'tray');
        }
      } catch (e) {
        if (trayItemsBuilt <= 3) console.warn(`TRAY ITEM - item ${trayItemsBuilt} failed: ${e && e.message}`);
      }
    });
  });

  // ---- Product, color and size lists
  try {
    const choices = await getLegendProductChoices();
    if (!choices || choices.ok === false) throw new Error(choices ? `${choices.step}: ${choices.reason}` : 'no answer');
    products = choices.products || [];
    $w('#productDropdown').options = products.map(p => ({ label: p.label, value: p.value }));
    defaultProductKey = choices.defaultProduct || (products[0] && products[0].value) || 'legendPoster';
    currentProductKey = defaultProductKey;
    $w('#productDropdown').value = currentProductKey;
    applyProductChoices();
    $w('#productDropdown').onChange(onProductChanged);
    console.log(`STARTUP - products: ${products.map(p => p.value).join(', ')}`);
  } catch (e) {
    console.error('STARTUP - could not load products:', e && e.message);
  }

  try { await refreshTray(); } catch (e) { console.error('STARTUP - refreshTray threw:', e && e.message); }
  console.log('STARTUP - complete.');
});

// ============================================================ STEPS

const STEP_BOXES = { photo: '#photoStep', style: '#styleStep', making: '#makingStep', result: '#resultStep' };
const STEP_SECTIONS = { photo: '#photoSection', style: '#styleSection', making: '#makingSection', result: '#resultSection' };
const STEP_EXTRAS = { making: ['#pillBox'] };
const STEP_SCROLL_DELAY_MS = 150;
const STEP_PROGRESS = {
  photo:  { label: 'STEP 1 OF 5', filled: 1 },
  style:  { label: 'STEP 2 OF 5', filled: 2 },
  making: { label: 'STEP 3 OF 5', filled: 3 },
  result: { label: 'STEP 4 OF 5', filled: 4 }
};

function stepSectionSelector(which) {
  const named = STEP_SECTIONS[which];
  if (named && elementExists(named)) return named;
  const box = STEP_BOXES[which];
  if (!box || !elementExists(box)) return null;
  try {
    const p = $w(box).parent;
    if (!p || typeof p.id !== 'string') return null;
    const isSection = p.type === '$w.Section' || p.type === '$w.ColumnStrip' || p.type === '$w.Strip';
    const kids = Array.isArray(p.children) ? p.children : [];
    if (isSection && kids.length === 1 && kids[0].id === box.slice(1)) return `#${p.id}`;
  } catch (e) { /* fall through */ }
  return null;
}

async function refreshAllowance() {
  if (!elementExists(ALLOWANCE_TEXT)) return;
  try {
    const a = await getMyLegendAllowance(getVisitorId());
    if (!a || a.ok === false) return;
    if (Number(a.limit) > 0) designsPerDay = Number(a.limit);
    let line = `${a.left} of ${a.limit} free designs left`;
    if (a.left === 0 && a.nextFreeAt) {
      const at = new Date(a.nextFreeAt);
      const time = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const tomorrow = at.toDateString() !== new Date().toDateString();
      line = `You've used all ${a.limit} free designs. Your next one opens ${tomorrow ? 'tomorrow ' : ''}at ${time}.`;
    } else if (a.left < a.limit) {
      line += ' · each one opens up again 24 hours after you made it';
    }
    $w(ALLOWANCE_TEXT).text = line;
    $w(ALLOWANCE_TEXT).expand();
  } catch (e) {
    console.warn(`ALLOWANCE - couldn't read it: ${e && e.message}`);
  }
}

async function showStep(which, { scroll = true } = {}) {
  if (which === 'style' || which === 'result') refreshAllowance();
  const jobs = [];
  for (const name of Object.keys(STEP_BOXES)) {
    const sec = stepSectionSelector(name);
    if (!sec) continue;
    try { jobs.push(name === which ? $w(sec).expand() : $w(sec).collapse()); } catch (e) { /* carry on */ }
  }
  for (const [name, id] of Object.entries(STEP_BOXES)) {
    if (!elementExists(id)) continue;
    try { jobs.push(name === which ? $w(id).expand() : $w(id).collapse()); } catch (e) { /* carry on */ }
  }
  for (const [name, ids] of Object.entries(STEP_EXTRAS)) {
    for (const id of ids) {
      if (!elementExists(id)) continue;
      try { jobs.push(name === which ? $w(id).expand() : $w(id).collapse()); } catch (e) { /* carry on */ }
    }
  }
  try { await Promise.all(jobs); } catch (e) { /* carry on */ }

  for (const id of [stepSectionSelector(which), STEP_BOXES[which], ...(STEP_EXTRAS[which] || [])]) {
    if (!id || !elementExists(id)) continue;
    try { if ($w(id).hidden) await $w(id).show(); } catch (e) { /* carry on */ }
  }

  const p = STEP_PROGRESS[which] || STEP_PROGRESS.photo;
  let label = p.label;
  if (which === 'result' && currentDesign && currentDesign.styleName) {
    label = `${p.label} · ${currentDesign.styleName.toUpperCase()}`;
  }
  setProgress(label, p.filled);

  if (scroll) {
    await wait(STEP_SCROLL_DELAY_MS);
    const box = STEP_BOXES[which];
    try {
      if (box && elementExists(box)) await $w(box).scrollTo();
      else await $w('#stepLabel').scrollTo();
    } catch (e) { /* not important */ }
  }
}

function setProgress(label, filled) {
  safely('update the step label', () => { $w('#stepLabel').text = label; });
  for (let i = 1; i <= 5; i++) {
    safely(`color step bar ${i}`, () => {
      const bar = $w(`#stepBar${i}`);
      if (!bar.style) return;
      bar.style.backgroundColor = i <= filled ? NAVY : (original[`bar${i}`] || '#D9C8A2');
    });
  }
}

function rememberOriginals() {
  for (let i = 1; i <= 5; i++) {
    try { original[`bar${i}`] = $w(`#stepBar${i}`).style.backgroundColor; } catch (e) { /* not a box */ }
  }
  try { original.ring = $w('#makingRing').style.borderColor; } catch (e) { /* optional */ }
  try { original.uploadLabel = $w(PHOTO_UPLOAD).buttonLabel; } catch (e) { /* optional */ }
  try { original.makingTitle = $w('#makingTitle').text; } catch (e) { /* optional */ }
  try { original.makingText = $w('#makingText').text; } catch (e) { /* optional */ }
}

// ============================================================ STEP 1: PHOTO AND WHO

function whoAnswer() {
  try {
    const v = $w(WHO_RADIO).value;
    return WHO_PROMISES[v] ? v : '';
  } catch (e) {
    return '';
  }
}

// Shows the promise that goes with the answer, and switches the promise box
// on only once there is an answer to promise about.
function refreshWho() {
  const who = whoAnswer();
  safely('update the promise', () => {
    const words = who ? WHO_PROMISES[who] : NO_WHO_YET;
    if (elementExists(PROMISE_TEXT)) $w(PROMISE_TEXT).text = words;
    // A Wix checkbox may or may not let code change its label; the separate
    // #promiseText element always works.
    try { $w(PROMISE_BOX).label = who ? WHO_PROMISES[who] : 'Choose who is in the photo first'; } catch (e) { /* label is editor-only here */ }
    if (who) $w(PROMISE_BOX).enable(); else { $w(PROMISE_BOX).checked = false; $w(PROMISE_BOX).disable(); }
  });
  safely('update the hint', () => {
    if (elementExists(WHO_HINT)) $w(WHO_HINT).text = who ? WHO_HINTS[who] : '';
  });
  refreshContinue();
}

function refreshContinue() {
  safely('update Continue', () => {
    const hasFile = !!photoUrl || ($w(PHOTO_UPLOAD).value || []).length > 0;
    const ok = hasFile && !!whoAnswer() && $w(PROMISE_BOX).checked && $w('#aiConsentCheckbox').checked;
    if (ok) $w('#continueButton').enable(); else $w('#continueButton').disable();
  });
}

let previewUploading = false;
async function uploadForPreview() {
  if (previewUploading) return;
  previewUploading = true;
  safely('lock Continue', () => $w('#continueButton').disable());
  setStatus('Loading your photo…');
  try {
    const uploaded = await $w(PHOTO_UPLOAD).uploadFiles();
    const file = (uploaded || [])[0];
    const url = (file && (file.fileUrl || file.url)) || null;
    if (!url) throw new Error('the upload finished but returned no file address');
    photoUrl = url;
    safely('show the photo preview', () => {
      $w('#photoPreview').fitMode = 'fit';
      $w('#photoPreview').src = photoUrl;
      $w('#photoPreview').show();
    });
    safely('relabel the upload button', () => { $w(PHOTO_UPLOAD).buttonLabel = 'Change photo'; });
    setStatus('');
  } catch (err) {
    const why = (err && (err.errorDescription || err.message)) || 'unknown';
    console.error('UPLOAD (preview) - failed:', why, err);
    photoUrl = null;
    safely('hide the photo preview', () => $w('#photoPreview').hide());
    setStatus(SHOW_ERROR_DETAIL ? `The photo didn't upload - ${why}` : 'That photo didn\'t upload. Try again, or try a smaller photo (JPG or PNG).');
  } finally {
    previewUploading = false;
    refreshContinue();
  }
}

async function onContinueClicked() {
  if (generating) return;
  if (previewUploading) {
    setStatus('One moment, your photo is still loading.');
    return;
  }
  if (!whoAnswer()) {
    setStatus('Tell us who is in the photo first.');
    return;
  }
  if (!$w(PROMISE_BOX).checked || !$w('#aiConsentCheckbox').checked) {
    setStatus('Tick both boxes to carry on.');
    return;
  }
  const btn = $w('#continueButton');
  const label = btn.label;
  btn.disable();
  try {
    if (!photoUrl) {
      if (($w(PHOTO_UPLOAD).value || []).length === 0) {
        setStatus('Choose a photo first.');
        return;
      }
      btn.label = 'Uploading…';
      setStatus('');
      const uploaded = await $w(PHOTO_UPLOAD).uploadFiles();
      const file = (uploaded || [])[0];
      photoUrl = (file && (file.fileUrl || file.url)) || null;
      if (!photoUrl) throw new Error('the upload finished but returned no file address');
    }
    setStatus('');
    await showStep('style');
    safely('show the thumbnail', () => {
      $w('#photoThumb').fitMode = 'fit';
      $w('#photoThumb').src = photoUrl;
    });
  } catch (err) {
    const why = (err && (err.errorDescription || err.message)) || 'unknown';
    console.error('UPLOAD - failed:', why, err);
    setStatus(SHOW_ERROR_DETAIL ? `The photo didn't upload - ${why}` : 'That photo didn\'t upload. Try again, or try a smaller photo (JPG or PNG).');
  } finally {
    btn.label = label;
    refreshContinue();
  }
}

// "Change photo" (keepConsent: true) keeps the answers and ticks.
// "Use a new photo" (keepConsent: false) starts everything again.
function startOverPhoto({ keepConsent }) {
  photoUrl = null;
  mockupRun++;
  try { $w(PHOTO_UPLOAD).reset(); } catch (e) { /* older editors */ }
  safely('clear the photo preview', () => {
    if (elementExists('#photoPreview')) $w('#photoPreview').hide();
    if (original.uploadLabel) $w(PHOTO_UPLOAD).buttonLabel = original.uploadLabel;
  });
  if (!keepConsent) {
    currentDesign = null;
    safely('clear who', () => { $w(WHO_RADIO).selectedIndex = undefined; });
    safely('untick the promise', () => { $w(PROMISE_BOX).checked = false; });
    safely('untick the AI consent', () => { $w('#aiConsentCheckbox').checked = false; });
    safely('clear the name', () => { $w(NAME_INPUT).value = ''; });
    selectLegend(DEFAULT_LEGEND);
    updateCounter();
    resetCartSelections();
    refreshWho();
  }
  setStatus('');
  refreshContinue();
  showStep('photo');
}

// ============================================================ STEPS 2-3: THE LEGEND

function selectLegend(key) {
  if (generating || !legendByKey(key)) return;
  selectedLegend = key;
  safely('mark the chosen legend', () => {
    $w(PERSONA_REPEATER).forEachItem(($item, itemData) => {
      if (itemHas($item, '#personaCard')) paintCard($item, '#personaCard', itemData.key === key, 'persona');
    });
  });
  refreshTextBox();
}

const cardLook = {};
function paintCard($item, selector, chosen, group) {
  try {
    const s = $item(selector).style;
    if (!s) return;
    if (!cardLook[group]) cardLook[group] = { color: s.borderColor, width: s.borderWidth, fill: s.backgroundColor };
    const look = cardLook[group];
    if (chosen) {
      s.borderColor = NAVY;
      s.borderWidth = '4px';
      s.backgroundColor = CHOSEN_FILL;
    } else {
      s.borderColor = look.color;
      s.borderWidth = look.width;
      if (look.fill) s.backgroundColor = look.fill;
    }
  } catch (e) { /* no style on this element */ }
}

function refreshTextBox() {
  safely('update the name box', () => {
    const legend = legendByKey(selectedLegend);
    if (legend && legend.allowsText) {
      $w(NAME_INPUT).enable();
      $w('#textHelp').text = TEXT_HELP;
    } else {
      $w(NAME_INPUT).disable();
      $w('#textHelp').text = NO_TEXT_HELP;
    }
    updateCounter();
  });
}

function updateCounter() {
  safely('update the counter', () => {
    const box = $w(NAME_INPUT);
    let v = box.value || '';
    if (v.length > MAX_TEXT) { v = v.slice(0, MAX_TEXT); box.value = v; }
    $w('#textCounter').text = `${v.length} / ${MAX_TEXT}`;
  });
}

// ============================================================ STEP 4: MAKING

async function onGenerateClicked() {
  if (generating) return;
  if (!photoUrl) {
    setStatus('Add a photo first.');
    showStep('photo');
    return;
  }
  const who = whoAnswer();
  if (!who || !$w(PROMISE_BOX).checked) {
    setStatus('Tell us who is in the photo and tick the promise that goes with it.');
    showStep('photo');
    return;
  }
  const legendKey = selectedLegend;
  const legend = legendByKey(legendKey);
  let text = '';
  if (legend && legend.allowsText) {
    safely('read the name', () => { text = ($w(NAME_INPUT).value || '').trim().slice(0, MAX_TEXT); });
  }

  resetCartSelections();

  const btn = $w('#generateButton');
  const label = btn.label;
  btn.disable();
  btn.label = 'Starting…';
  setStatus('');
  generating = true;

  try {
    console.log(`GENERATE - legend ${legendKey}, who ${who}, text "${text}"`);
    const started = await startDesignWithRetry([photoUrl, legendKey, getVisitorId(), text, who, true]);
    if (!started || started.ok === false) {
      console.error('GENERATE - could not start:', started ? `${started.step}: ${started.reason}` : 'no answer from the server');
      setStatus(customerReason(started));
      return;
    }

    const designRecordId = started.designRecordId;
    await showStep('making');
    startMakingPanel(legend ? legend.name : 'Your legend');

    const result = await waitForDesign(designRecordId);
    stopMakingPanel();

    if (!result || result.status === 'pending') {
      showStep('style');
      setStatus('This one is taking longer than usual. It\'s still being made and will appear in Your designs below when it\'s ready. No need to start over.');
      watchLateDesign(designRecordId);
      return;
    }
    if (!result.previewArtUrl) {
      showStep('style');
      console.error('GENERATE - design failed:', result.status, result.message);
      setStatus(result.message || 'Something went wrong. Please try again.');
      return;
    }

    currentDesign = {
      designRecordId,
      previewArtUrl: result.previewArtUrl,
      styleName: legend ? legend.name : ''
    };
    safely('finish the bar', () => {
      $w('#makingProgress').value = 100;
      $w('#makingPercent').text = '100%';
      $w('#makingTitle').text = 'Your portrait is ready';
      $w('#makingText').text = 'Now pick what to print it on.';
    });
    await wait(900);

    refreshTray();
    await openResult();
  } catch (err) {
    stopMakingPanel();
    console.error('GENERATE - failed:', err);
    showStep('style');
    setStatus(SHOW_ERROR_DETAIL && err ? `Something went wrong - ${err.message}` : 'Something went wrong. Please try again.');
  } finally {
    generating = false;
    btn.label = label;
    safely('switch Generate back on', () => $w('#generateButton').enable());
  }
}

// One quiet retry on a failed start, never on a refusal written for the
// customer (the daily limit, a refused name, a busy studio).
const START_RETRY_MS = 1000;
async function startDesignWithRetry(args) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const started = await startLegendDesign(...args);
      if (started && started.ok !== false) return started;
      const step = started ? started.step : 'no answer';
      console.warn(`GENERATE - attempt ${attempt} refused at step "${step}": ${started ? started.reason : ''}`);
      if (attempt === 2 || isCustomerSafe(started)) return started;
    } catch (e) {
      console.warn(`GENERATE - attempt ${attempt} threw: ${e && e.message}`);
      if (attempt === 2) throw e;
    }
    await wait(START_RETRY_MS);
  }
  return null;
}

const START_FAILED_MESSAGE = 'We couldn\'t start your portrait just now. Please try again in a minute.';
const INTERNAL_STEPS = ['style', 'starting the design', 'setup'];
const TECHNICAL_REASON = /\bWDE\d+|internal error|ECONN|ETIMEDOUT|timed?\s?out|timeout|\bundefined\b|\bnull\b|NaN|is not a function|cannot read|\w+Error\b|\bat\s+\S+\s+\(|\bstatus\s*(code)?\s*[45]\d\d\b|https?:\/\//i;

function isCustomerSafe(started) {
  if (!started) return false;
  if (started.customerSafe === true) return true;
  if (started.customerSafe === false) return false;
  const reason = String(started.reason || '').trim();
  if (!reason) return false;
  if (started.step && INTERNAL_STEPS.includes(String(started.step).trim().toLowerCase())) return false;
  if (TECHNICAL_REASON.test(reason)) return false;
  return reason.length <= 240;
}

function customerReason(started) {
  if (isCustomerSafe(started)) return String(started.reason).trim();
  if (!SHOW_ERROR_DETAIL) return START_FAILED_MESSAGE;
  if (!started) return 'no answer from the server';
  const reason = String(started.reason || 'no reason given');
  return started.step ? `${started.step}: ${reason}` : reason;
}

async function waitForDesign(designRecordId) {
  let result = null;
  let failures = 0;
  const since = Date.now();
  while (Date.now() - since < MAX_WAIT_MS) {
    await wait(2000);
    try {
      result = await getLegendDesignStatus(designRecordId);
      failures = 0;
      if (result.status !== 'pending') return result;
    } catch (e) {
      failures++;
      console.warn(`STATUS - poll failed (${failures} in a row): ${e && e.message}`);
      if (failures >= 8) break;
    }
  }
  return result;
}

let lateWatchRun = 0;
async function watchLateDesign(designRecordId) {
  const myRun = ++lateWatchRun;
  const since = Date.now();
  while (Date.now() - since < LATE_WATCH_MS) {
    await wait(LATE_POLL_MS);
    if (myRun !== lateWatchRun) return;
    let result = null;
    try {
      result = await getLegendDesignStatus(designRecordId);
    } catch (e) {
      continue;
    }
    if (!result || result.status === 'pending') continue;
    await refreshTray();
    if (generating) return;
    setStatus(result.previewArtUrl
      ? 'Your portrait is ready. Pick it from Your designs below to see it on a product.'
      : (result.message || 'Something went wrong with that portrait. Please try again.'));
    return;
  }
}

function startMakingPanel(legendName) {
  stopMakingPanel();
  safely('set up the making panel', () => {
    $w('#makingProgress').targetValue = 100;
    $w('#makingProgress').value = 0;
    $w('#makingPercent').text = '0%';
    if (original.makingTitle) $w('#makingTitle').text = original.makingTitle;
    if (original.makingText) $w('#makingText').text = original.makingText;
    $w('#makingPill').text = `${legendName} · uses 1 of your ${designsPerDay} designs if it works`;
  });
  const since = Date.now();
  makingTimers.push(setInterval(() => {
    const t = (Date.now() - since) / TYPICAL_DESIGN_MS;
    const pct = Math.min(95, Math.round(95 * (1 - Math.exp(-2.2 * t))));
    safely('move the bar', () => {
      $w('#makingProgress').value = pct;
      $w('#makingPercent').text = `${pct}%`;
    });
  }, 500));
  if (elementExists('#makingRing')) {
    let lit = false;
    makingTimers.push(setInterval(() => {
      lit = !lit;
      safely('pulse the ring', () => { $w('#makingRing').style.borderColor = lit ? GOLD : (original.ring || '#31404C'); });
    }, 1200));
  }
}

function stopMakingPanel() {
  for (const t of makingTimers) clearInterval(t);
  makingTimers = [];
  if (elementExists('#makingRing')) {
    safely('reset the ring', () => { $w('#makingRing').style.borderColor = original.ring || '#31404C'; });
  }
}

// ============================================================ STEP 5: RESULT

async function openResult() {
  previewShows = null;
  await showStep('result');
  $w('#addToCartButton').disable();
  if (elementExists(UPDATE_BTN)) $w(UPDATE_BTN).disable();
  highlightTray();
  renderMockup(currentDesign.previewArtUrl);
}

function onTryAnotherStyle() {
  if (generating) return;
  setStatus('');
  if (photoUrl) {
    showStep('style');
  } else {
    showStep('photo');
    setStatus('To try another legend, add the photo again.');
  }
}

function currentProduct() {
  return products.find(p => p.value === currentProductKey) || null;
}
function productHasColors() {
  const p = currentProduct();
  return !!(p && p.colors && p.colors.length);
}
function productNoun() {
  const p = currentProduct();
  if (!p) return 'product';
  return p.value === 'legendTee' ? 'shirt' : p.label.toLowerCase();
}

function applyProductChoices({ reset = false } = {}) {
  const p = currentProduct();
  if (!p) return;
  safely('fill the size list', () => {
    const keepSize = reset ? '' : $w('#sizeDropdown').value;
    $w('#sizeDropdown').options = p.sizes.map(sz => ({ label: sz, value: sz }));
    $w('#sizeDropdown').value = (!reset && p.sizes.includes(keepSize)) ? keepSize : p.defaultSize;
  });
  safely('fill the color list', () => {
    const keepColor = reset ? '' : $w('#colorDropdown').value;
    if (p.colors && p.colors.length) {
      $w('#colorDropdown').options = p.colors.map(c => ({ label: c, value: c }));
      $w('#colorDropdown').value = (!reset && p.colors.includes(keepColor)) ? keepColor : p.defaultColor;
      $w('#colorDropdown').show();
      if (elementExists(COLOR_LABEL)) $w(COLOR_LABEL).show();
    } else {
      $w('#colorDropdown').hide();
      if (elementExists(COLOR_LABEL)) $w(COLOR_LABEL).hide();
    }
  });
}

function resetCartSelections() {
  previewShows = null;
  mockupRun++;
  safely('reset the product dropdown', () => {
    if (!products.length) return;
    currentProductKey = defaultProductKey;
    $w('#productDropdown').value = currentProductKey;
  });
  applyProductChoices({ reset: true });
  safely('clear the preview', () => {
    if (PLACEHOLDER_IMAGE_URL) $w('#previewImage').src = PLACEHOLDER_IMAGE_URL;
  });
  safely('disable Add to cart', () => { $w('#addToCartButton').disable(); });
  safely('disable Update preview', () => { if (elementExists(UPDATE_BTN)) $w(UPDATE_BTN).disable(); });
}

function onProductChanged() {
  currentProductKey = $w('#productDropdown').value || defaultProductKey;
  applyProductChoices();
  onChoiceChanged();
}

function onChoiceChanged() {
  if (!currentDesign || generating) return;
  if (!elementExists(UPDATE_BTN)) {
    if (previewIsStale()) renderMockup(currentDesign.previewArtUrl);
    return;
  }
  if (previewIsStale()) {
    $w(UPDATE_BTN).enable();
    setStatus(`Press Update preview to see it on the ${describeSelection()}.`);
  } else {
    $w(UPDATE_BTN).disable();
    setStatus('');
  }
}

function currentSelection() {
  return {
    productKey: currentProductKey,
    color: productHasColors() ? ($w('#colorDropdown').value || '') : '',
    size: $w('#sizeDropdown').value || ''
  };
}

function previewIsStale() {
  if (!previewShows) return true;
  const now = currentSelection();
  if (now.productKey !== previewShows.productKey) return true;
  if (productHasColors()) return now.color !== previewShows.color;
  return now.size !== previewShows.size;
}

function describeSelection() {
  const now = currentSelection();
  const noun = productNoun();
  return productHasColors() ? `${noun} in ${now.color}` : `${noun} (${now.size})`;
}

async function onUpdatePreviewClicked() {
  if (!currentDesign || generating) return;
  $w(UPDATE_BTN).disable();
  await renderMockup(currentDesign.previewArtUrl);
}

async function renderMockup(artUrl) {
  const run = ++mockupRun;
  $w('#addToCartButton').disable();
  safely('show the portrait while the preview loads', () => {
    $w('#previewImage').src = artUrl || PLACEHOLDER_IMAGE_URL;
    $w('#previewImage').show();
  });
  const productKey = currentProductKey;
  setStatus(`Putting it on the ${productNoun()}…`);
  try {
    const p = currentProduct();
    const color = productHasColors() ? ($w('#colorDropdown').value || (p && p.defaultColor) || 'White') : '';
    const size = $w('#sizeDropdown').value || (p && p.defaultSize) || '';
    let started;
    try {
      started = await createMockupTask(artUrl, color, size, productKey, 'Front');
    } catch (first) {
      if (run !== mockupRun) return;
      await wait(3000);
      if (run !== mockupRun) return;
      started = await createMockupTask(artUrl, color, size, productKey, 'Front');
    }
    if (run !== mockupRun) return;
    if (!started || started.ok === false) {
      const why = started ? `${started.step}: ${started.reason}` : 'no answer from the server';
      console.error('PREVIEW - could not start:', why);
      setStatus(SHOW_ERROR_DETAIL ? `Preview failed - ${why}` : PREVIEW_FAILED_MESSAGE);
      if (elementExists(UPDATE_BTN)) $w(UPDATE_BTN).enable();
      $w('#addToCartButton').enable();
      return;
    }
    for (let attempt = 0; attempt < 30; attempt++) {
      await wait(2000);
      if (run !== mockupRun) return;
      const result = await checkMockupTask(started.taskKey);
      if (result.status === 'completed') {
        if (run !== mockupRun) return;
        const shown = result.mockups.find(m => m.placement === 'front') || result.mockups[0];
        $w('#previewImage').src = shown.mockup_url;
        previewShows = { productKey, color, size };
        if (elementExists(UPDATE_BTN)) $w(UPDATE_BTN).disable();
        setStatus('');
        $w('#addToCartButton').enable();
        return;
      }
      if (result.status === 'failed') break;
    }
    setStatus(PREVIEW_FAILED_MESSAGE);
    if (elementExists(UPDATE_BTN)) $w(UPDATE_BTN).enable();
    $w('#addToCartButton').enable();
  } catch (err) {
    if (run !== mockupRun) return;
    setStatus(SHOW_ERROR_DETAIL ? `Preview failed - ${err.message}` : PREVIEW_FAILED_MESSAGE);
    if (elementExists(UPDATE_BTN)) $w(UPDATE_BTN).enable();
    $w('#addToCartButton').enable();
  }
}

// ============================================================ CART

async function onAddToCartClicked() {
  if (!currentDesign) return;
  $w('#addToCartButton').disable();
  try {
    const productKey = currentProductKey;
    const hasColors = productHasColors();
    const color = hasColors ? $w('#colorDropdown').value : '';
    const size = $w('#sizeDropdown').value;
    if ((hasColors && !color) || !size) {
      setStatus(hasColors ? 'Pick a color and size first.' : 'Pick a size first.');
      $w('#addToCartButton').enable();
      return;
    }
    const variant = await getCartVariant(color, size, productKey, 'Front');
    if (!variant || variant.ok === false) {
      const why = variant ? `${variant.step}: ${variant.reason}` : 'no answer from the server';
      console.error('ADD TO CART - variant lookup failed:', why);
      setStatus(SHOW_ERROR_DETAIL ? `Couldn't add to cart - ${why}` : 'Couldn\'t add to cart. Please try again.');
      $w('#addToCartButton').enable();
      return;
    }
    const { productId, wixVariantId } = variant;
    await currentCart.addToCurrentCart({
      lineItems: [{
        catalogReference: {
          catalogItemId: productId,
          appId: WIX_STORES_APP_ID,
          options: {
            variantId: wixVariantId,
            // The design ID rides on the product's "Design ID" text box (a
            // free-text modifier). Each Legend Maker product needs one, titled
            // exactly Design ID, or the order can't be printed.
            customTextFields: { 'Design ID': currentDesign.designRecordId }
          }
        },
        quantity: 1
      }]
    });
    setStatus('Added to your cart. Add it to another product too, or head to checkout.', { autoHide: true });
    setProgress('STEP 5 OF 5 · IN YOUR CART', 5);
    $w('#addToCartButton').enable();
    try {
      await wixEcomFrontend.refreshCart();
      wixEcomFrontend.openSideCart();
    } catch (e) {
      console.warn('Cart refresh not available here:', e);
    }
  } catch (err) {
    const detail = err?.message || err?.details?.applicationError?.description
      || err?.details?.validationError?.description || JSON.stringify(err?.details || {});
    console.error('ADD TO CART FAILED:', detail, err);
    setStatus(SHOW_ERROR_DETAIL ? `Couldn't add to cart - ${detail}` : 'Couldn\'t add to cart. Please try again.');
    $w('#addToCartButton').enable();
  }
}

// ============================================================ YOUR DESIGNS TRAY

const NUDGE_TRAY_LAYOUT = true;
let trayNudged = false;
let trayFillToken = 0;
let trayItemsBuilt = 0;

async function nudgeTrayLayout(myTicket) {
  if (!NUDGE_TRAY_LAYOUT || trayNudged) return;
  await wait(1500);
  if (myTicket !== trayFillToken || trayItemsBuilt < 1) return;
  trayNudged = true;
  safely('collapse for the nudge', () => { $w('#designsRepeater').collapse(); });
  await wait(60);
  if (myTicket !== trayFillToken) return;
  safely('expand after the nudge', () => { $w('#designsRepeater').expand(); });
}

async function refreshTray() {
  const myTicket = ++trayFillToken;
  try {
    const designs = await listMyLegendDesigns(getVisitorId());
    console.log(`TRAY - ${designs.length} portrait(s) for this browser.`);
    if (!designs.length) {
      safely('empty the tray', () => { $w('#designsRepeater').data = []; });
      safely('collapse the repeater', () => setVisible('#designsRepeater', false));
      safely('hide the tray title', () => setVisible('#myDesignsTitle', false));
      return;
    }
    for (const id of ['#myDesignsTitle', '#designsRepeater']) safely(`show ${id}`, () => setVisible(id, true));
    trayItemsBuilt = 0;
    safely('fill the tray', () => { $w('#designsRepeater').data = designs; });
    nudgeTrayLayout(myTicket);
  } catch (e) {
    console.error('Could not load Your designs', e);
  }
}

function highlightTray() {
  safely('highlight the chosen design', () => {
    const chosenId = currentDesign && currentDesign.designRecordId;
    $w('#designsRepeater').forEachItem(($item, itemData) => {
      if (itemHas($item, '#designCard')) paintCard($item, '#designCard', itemData._id === chosenId, 'tray');
    });
  });
}

function selectSavedDesign(itemData) {
  if (generating) {
    setStatus('Hang on until the current portrait is finished.', { autoHide: true });
    return;
  }
  const sameDesign = currentDesign && currentDesign.designRecordId === itemData._id;
  if (!sameDesign) resetCartSelections();
  currentDesign = {
    designRecordId: itemData._id,
    previewArtUrl: itemData.previewArtUrl,
    styleName: itemData.styleName || ''
  };
  setStatus('');
  openResult();
}

// ============================================================ HELPERS

function setStatus(text, { autoHide = false } = {}) {
  clearTimeout(statusTimer);
  safely('update the status line', () => {
    if (!text) { $w('#statusText').text = ''; $w('#statusText').collapse(); return; }
    $w('#statusText').text = text;
    $w('#statusText').expand();
    $w('#statusText').show();
  });
  if (autoHide && text) statusTimer = setTimeout(() => setStatus(''), 5000);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function elementExists(selector) {
  try {
    const el = $w(selector);
    return !!el && typeof el.id === 'string';
  } catch (e) {
    return false;
  }
}

function itemHas($item, selector) {
  try {
    const el = $item(selector);
    return !!el && typeof el.id === 'string';
  } catch (e) {
    return false;
  }
}

function setVisible(selector, visible) {
  if (!elementExists(selector)) return false;
  const el = $w(selector);
  if (visible) {
    if (typeof el.expand === 'function') el.expand();
    if (typeof el.show === 'function') el.show();
  } else {
    if (typeof el.hide === 'function') el.hide();
    if (typeof el.collapse === 'function') el.collapse();
  }
  return true;
}

function safely(label, fn) {
  try { fn(); } catch (e) { console.warn(`Page: couldn't ${label} - ${e && e.message}`); }
}

// A random ID this browser keeps, for the daily limit and Your designs. Its
// own name, so it never mixes with the Design Your Pet page's.
const VISITOR_KEY = 'gwLegendVisitorId';
let inMemoryVisitorId = '';
function newVisitorId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function getVisitorId() {
  try {
    const existing = local.getItem(VISITOR_KEY);
    if (existing) return existing;
    const fresh = newVisitorId('lv');
    local.setItem(VISITOR_KEY, fresh);
    if (local.getItem(VISITOR_KEY) === fresh) return fresh;
  } catch (e) { /* storage blocked */ }
  try {
    let id = session.getItem(VISITOR_KEY);
    if (!id) {
      id = newVisitorId('ls');
      session.setItem(VISITOR_KEY, id);
    }
    if (session.getItem(VISITOR_KEY)) return id;
  } catch (e) { /* also blocked */ }
  if (!inMemoryVisitorId) inMemoryVisitorId = newVisitorId('lm');
  return inMemoryVisitorId;
}
