# Legend Maker icon ("You Are the Star", sunburst version)

Chosen by Don on 22 Nov 2026: a gold star with a person cut out of it, on a
navy sunburst. Goodwookie colours: navy #16202A, gold #C79A3E, cream
#EFE3C6, slate #31404C.

The `.svg` files are the masters. `final.py` draws every app asset from
them (it reuses the shapes in `gen.py`) and renders the PNGs with headless
Chrome. The fonts come from `node_modules/@expo-google-fonts`.

| File | Used for |
|---|---|
| icon | App Store / Play icon, 1024 px, full bleed, no transparency |
| android-icon-background / -foreground / -monochrome | Android adaptive icon layers |
| splash-icon | Splash screen, on navy |
| star-navy-icon, star-gold-icon | In-app marks on cream screens |
| logo-stacked, logo-horizontal | Logo for cream or white backgrounds |
| logo-stacked-on-navy, logo-horizontal-on-navy | Logo for navy backgrounds (Welcome screen) |
