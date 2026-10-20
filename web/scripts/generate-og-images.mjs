// Run from web/: node scripts/generate-og-images.mjs
// Committed PNGs are generated offline; CI does not need to run this script.
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { socialImageSections } from './social-images.mjs';

// Bundled Inter from https://github.com/google/fonts/tree/main/ofl/inter
// (Inter[opsz,wght].ttf), SIL Open Font License 1.1; see src/assets/fonts/OFL.txt.
// Explicit fontfile avoids depending on fonts installed on the build machine.
const fontfile = fileURLToPath(new URL('../src/assets/fonts/Inter.ttf', import.meta.url));
const output = new URL('../public/og/', import.meta.url);
const escapeMarkup = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function text(value, size, color, height) {
    return sharp({ text: {
        text: `<span foreground="${color}">${escapeMarkup(value)}</span>`,
        font: `Inter Bold ${size}`, fontfile, width: 1056, dpi: 72,
        rgba: true, wrap: 'word-char',
    } }).resize({ width: 1056, height, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
}

await mkdir(output, { recursive: true });
const logo = await sharp(await readFile(new URL('../src/assets/cratis-mark-dark.svg', import.meta.url))).resize(72, 72).png().toBuffer();
for (const [section, label] of Object.entries(socialImageSections)) {
    await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0d1325"/><rect width="1200" height="12" fill="#3b6fed"/><path d="M880 630L1200 310V630Z" fill="#14224a"/></svg>'))
        .composite([
            { input: logo, left: 64, top: 48 },
            { input: await text('Cratis', 30, '#ffffff', 48), left: 152, top: 70 },
            { input: await text(label, 84, '#ffffff', 210), left: 64, top: 230 },
            { input: await text('Documentation', 36, '#c3d4fb', 60), left: 64, top: 390 },
            { input: await text('www.cratis.io', 23, '#c3d4fb', 36), left: 64, top: 552 },
        ]).png().toFile(fileURLToPath(new URL(`${section}.png`, output)));
}
