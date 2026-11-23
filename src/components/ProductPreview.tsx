import { Image } from 'expo-image';
import { ImageSourcePropType, StyleSheet, View } from 'react-native';
import { colorFor, PRODUCTS, ProductChoice } from '../data/catalog';
import { colors } from '../theme';

// Places the watermarked design on the product, like the canvas previews.
// Positions are fractions of the square Printful flat mockups (the photos are
// square; the art is 3:4): center chest,
// between the neckline and the pocket.
const PLACEMENT = {
  // Matches Don's Printful tee layout (26 Sep): 10.7" wide, 3.2" down.
  tee: { top: 0.26, size: 0.29 },
  // Measured on the eight "ghost mannequin" hoodie photos (every color but
  // Bone): the neckline ends about 21% down and the pocket starts about 60%
  // down, so the design sits in between with a small gap under the collar.
  // Sized to match the print itself (Don's Printful layout, 26 Sep: about
  // 9.9" wide, 2.1" below the top of the front area, ending just above the
  // pocket). Before that it was 0.25 / 0.25, and before that 0.33 / 0.27.
  hoodie: { top: 0.27, size: 0.3 },
} as const;

// The Bone hoodie photo is a different shot (laid flat, hood standing up), so
// its chest sits lower in the frame than the other colors.
const COLOR_PLACEMENT: Record<string, { top: number; size: number }> = {
  'hoodie:Bone': { top: 0.38, size: 0.26 },
};

export function ProductPreview({ choice, design, size = 220 }: { choice: ProductChoice; design: ImageSourcePropType | null; size?: number }) {
  const name = PRODUCTS[choice.product].name;
  if (choice.product === 'tee' || choice.product === 'hoodie') {
    const color = colorFor(choice.product, choice.color);
    const p = COLOR_PLACEMENT[`${choice.product}:${choice.color}`] ?? PLACEMENT[choice.product];
    const d = size * p.size;
    // Legend Maker art is 3:4 portrait. On the tee it prints 3:4, so the box
    // is taller than wide; the hoodie front is square, so the art is fitted
    // inside a square, as its print file is.
    const w = choice.product === 'tee' ? d * 0.86 : d;
    const h = choice.product === 'tee' ? w * (4 / 3) : d;
    return (
      <View style={{ width: size, height: size }} accessibilityLabel={`Your design on a ${color.name} ${name.toLowerCase()}`}>
        <Image source={color.mockup} style={StyleSheet.absoluteFill} contentFit="contain" />
        {design ? <Image source={design} style={{ position: 'absolute', width: w, height: h, left: (size - w) / 2, top: size * p.top }} contentFit="contain" /> : null}
      </View>
    );
  }
  // Poster and canvas: a 3:4 portrait sheet, scaled with the chosen size.
  // The canvas sits a little deeper (its white wrapped sides show as an edge).
  const sizes = (PRODUCTS[choice.product] as { sizes: { id: string }[] }).sizes;
  const index = Math.max(0, sizes.findIndex((s) => s.id === choice.size));
  const scale = sizes.length > 1 ? [0.74, 0.94][index] ?? 0.84 : 0.84;
  const h = size * scale;
  const w = h * 0.75;
  const isCanvas = choice.product === 'canvas';
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Your design as a ${name.toLowerCase()}`}>
      <View style={[styles.sheet, { width: w, height: h, padding: isCanvas ? 0 : 0, borderRightWidth: isCanvas ? 5 : 0, borderBottomWidth: isCanvas ? 5 : 0, borderColor: '#E9E6DF' }]}>
        {design ? <Image source={design} style={{ flex: 1 }} contentFit="cover" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.white,
    shadowColor: colors.navy,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
});
