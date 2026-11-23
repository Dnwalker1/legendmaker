import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { Body, Button, H1, Pill, Row, Screen } from '../components/ui';
import { PolicyLinks } from '../components/PolicyLinks';
import { APP_NAME } from '../brand';
import { STYLES } from '../data/catalog';
import { fonts } from '../theme';

const badge = require('../../assets/images/brand/logo-stacked-on-navy.webp');

export default function Welcome() {
  const [monarch, rockstar, moviestar] = STYLES;
  return (
    <Screen
      tone="dark"
      footer={
        <>
          <Button title="Get started" onPress={() => router.push('/upload')} />
          <Button variant="dark-secondary" title={`See all ${STYLES.length} legends`} onPress={() => router.push('/styles')} />
          <Button variant="dark-secondary" title="See your designs" onPress={() => router.push('/designs')} />
        </>
      }
    >
      <Image source={badge} style={styles.badge} contentFit="contain" accessibilityLabel={`${APP_NAME} by Goodwookie`} />
      <Pressable style={styles.collage} accessibilityRole="button" accessibilityLabel={`See all ${STYLES.length} legends`} onPress={() => router.push('/styles')}>
        <Image source={rockstar.sample} style={[styles.sample, styles.left]} contentFit="contain" accessibilityLabel={`${rockstar.name} sample`} />
        <Image source={monarch.sample} style={[styles.sample, styles.center]} contentFit="contain" accessibilityLabel={`${monarch.name} sample`} />
        <Image source={moviestar.sample} style={[styles.sample, styles.right]} contentFit="contain" accessibilityLabel={`${moviestar.name} sample`} />
      </Pressable>
      <H1 tone="dark" heavy>
        {APP_NAME}: See Yourself As The Legend You Are
      </H1>
      <Body tone="dark">Upload a photo. Pick who you were always meant to be: the monarch, the rock star, the movie star, the champion. We&apos;ll paint you as original Goodwookie artwork and put it on a poster, a canvas, a shirt or a hoodie. It makes a fine gift, too.</Body>
      <Body tone="dark" style={styles.shipping}>
        Free shipping on every US order.
      </Body>
      <Row style={{ flexWrap: 'wrap', gap: 8 }}>
        <Pill tone="dark">About 1 minute</Pill>
        <Pill tone="dark">5 free designs every 24 hours</Pill>
        <Pill tone="dark">No account. No password to forget.</Pill>
        <Pill tone="dark">Full-size artwork free with every order</Pill>
      </Row>
      <PolicyLinks tone="dark" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: { width: 220, height: 170, alignSelf: 'center' },
  shipping: { fontFamily: fonts.bodyBold, textTransform: 'uppercase', letterSpacing: 0.5 },
  collage: { height: 200, alignItems: 'center', justifyContent: 'center' },
  sample: { position: 'absolute' },
  // The samples are 3:4 portraits, like the art itself.
  left: { width: 99, height: 132, left: '8%', top: 8, transform: [{ rotate: '-6deg' }] },
  center: { width: 129, height: 172, transform: [{ rotate: '3deg' }] },
  right: { width: 87, height: 116, right: '8%', bottom: 0, transform: [{ rotate: '8deg' }] },
});
