import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, Design, PhotoInput } from '../api';
import { applyServerPrices, type StyleId, type WhoFor } from '../data/catalog';
import type { CartItem, NewCartItem } from '../lib/cart';

const KEYS = { deviceId: 'lm.deviceId', cart: 'lm.cart', photo: 'lm.photo' };

// THE LAST PHOTO IS REMEMBERED FOR A DAY (31 Oct 2026).
//
// It used to live only in memory. A phone often closes an app sitting in the
// background, and making a design takes a minute, so by the time the customer
// came back to the result, the photo was gone and "Try another style" sent them
// to step one to pick it again. Now the photo (a file on this phone) and its
// upload ID are saved, and forgotten after 24 hours or when they choose a new
// photo. The website keeps the uploaded photo for a day too.
const PHOTO_KEEP_MS = 24 * 60 * 60 * 1000;
type SavedPhoto = { photo: PhotoInput; photoId: string | null; savedAt: number; who?: WhoFor | null; whoConsent?: boolean };

type AppState = {
  ready: boolean;
  /** Random ID for this install; not linked to a name. See the privacy policy. */
  deviceId: string | null;
  photo: PhotoInput | null;
  styleId: StyleId;
  text: string;
  /** Whose portrait this is: the customer, a gift, or a memorial. Null until chosen. Resets with a new photo. */
  who: WhoFor | null;
  /** The customer ticked the promise that goes with `who`. Resets when `who` or the photo changes. */
  whoConsent: boolean;
  /** The design shown on the result and product screens. */
  activeDesign: Design | null;
  cart: CartItem[];
  /** Goes up each time the website's prices are applied, so price labels redraw. */
  pricesVersion: number;
  setPhoto: (photo: PhotoInput | null) => void;
  setStyleId: (id: StyleId) => void;
  setText: (text: string) => void;
  /** Changing the answer also unticks the promise. */
  setWho: (who: WhoFor | null) => void;
  setWhoConsent: (on: boolean) => void;
  setActiveDesign: (design: Design | null) => void;
  /** Uploads the chosen photo (once). Throws ApiError UPLOAD_FAILED. */
  uploadPhoto: () => Promise<void>;
  /** Uploads the photo if needed and starts a design. Throws ApiError. */
  startDesign: () => Promise<string>;
  addToCart: (item: NewCartItem) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
};

const Ctx = createContext<AppState | null>(null);

async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [photo, setPhotoState] = useState<PhotoInput | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [styleId, setStyleId] = useState<StyleId>('monarch');
  const [text, setText] = useState('');
  const [who, setWhoState] = useState<WhoFor | null>(null);
  const [whoConsent, setWhoConsent] = useState(false);
  const [activeDesign, setActiveDesign] = useState<Design | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pricesVersion, setPricesVersion] = useState(0);

  useEffect(() => {
    (async () => {
      let id = await AsyncStorage.getItem(KEYS.deviceId).catch(() => null);
      if (!id) {
        id = Crypto.randomUUID();
        await AsyncStorage.setItem(KEYS.deviceId, id).catch(() => undefined);
      }
      setDeviceId(id);
      setCart(await loadJson<CartItem[]>(KEYS.cart, []));
      const saved = await loadJson<SavedPhoto | null>(KEYS.photo, null);
      if (saved?.photo?.uri && Date.now() - saved.savedAt < PHOTO_KEEP_MS) {
        setPhotoState(saved.photo);
        setPhotoId(saved.photoId);
        // The promise was given for this photo, so it is remembered with it.
        setWhoState(saved.who ?? null);
        setWhoConsent(!!saved.who && !!saved.whoConsent);
      }
      setReady(true);
    })();
  }, []);

  // Prices come from the website at launch (16 Nov 2026), so a Wix price change
  // needs no app update. Offline or slow, the built-in prices stand; checkout
  // always charges the real Wix price either way.
  useEffect(() => {
    if (!deviceId) return;
    let live = true;
    api
      .getProducts(deviceId)
      .then((list) => {
        if (live && applyServerPrices(list) > 0) setPricesVersion((v) => v + 1);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [deviceId]);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEYS.cart, JSON.stringify(cart)).catch(() => undefined);
  }, [cart, ready]);

  useEffect(() => {
    if (!ready) return;
    if (!photo) {
      AsyncStorage.removeItem(KEYS.photo).catch(() => undefined);
      return;
    }
    const saved: SavedPhoto = { photo, photoId, savedAt: Date.now(), who, whoConsent };
    AsyncStorage.setItem(KEYS.photo, JSON.stringify(saved)).catch(() => undefined);
  }, [photo, photoId, who, whoConsent, ready]);

  const setPhoto = useCallback((p: PhotoInput | null) => {
    setPhotoState(p);
    setPhotoId(null);
    setWhoState(null);
    setWhoConsent(false);
  }, []);

  const ensureUploaded = useCallback(async () => {
    if (!deviceId || !photo) throw new Error('No photo');
    if (photoId) return photoId;
    const id = (await api.uploadPhoto(deviceId, photo)).photoId;
    setPhotoId(id);
    return id;
  }, [deviceId, photo, photoId]);

  const setWho = useCallback((next: WhoFor | null) => {
    setWhoState(next);
    setWhoConsent(false);
  }, []);

  const startDesign = useCallback(async () => {
    if (!deviceId) throw new Error('No device ID');
    const id = await ensureUploaded();
    // The promise is ticked on the photo screen; without it nothing is sent.
    if (!who || !whoConsent) throw new ApiError('CONSENT_NEEDED');
    const trimmed = text.trim();
    const { designId } = await api.createDesign(deviceId, {
      photoId: id,
      styleId,
      text: trimmed || undefined,
      who,
    });
    return designId;
  }, [deviceId, ensureUploaded, styleId, text, who, whoConsent]);

  const value = useMemo<AppState>(
    () => ({
      ready,
      deviceId,
      photo,
      styleId,
      text,
      who,
      whoConsent,
      activeDesign,
      cart,
      pricesVersion,
      setPhoto,
      setStyleId,
      setText,
      setWho,
      setWhoConsent,
      setActiveDesign,
      uploadPhoto: async () => {
        await ensureUploaded();
      },
      startDesign,
      addToCart: (item) => setCart((c) => [...c, { ...item, id: Crypto.randomUUID() } as CartItem]),
      updateQuantity: (id, quantity) =>
        setCart((c) => c.map((i) => (i.id === id && i.kind === 'single' ? { ...i, quantity: Math.max(1, Math.min(10, quantity)) } : i))),
      removeFromCart: (id) => setCart((c) => c.filter((i) => i.id !== id)),
      clearCart: () => setCart([]),
    }),
    [ready, deviceId, photo, styleId, text, who, whoConsent, activeDesign, cart, pricesVersion, setPhoto, setWho, ensureUploaded, startDesign],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
