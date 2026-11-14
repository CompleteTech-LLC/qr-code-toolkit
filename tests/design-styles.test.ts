import { describe, expect, it } from 'vitest';
import { bodyShapes, defaultDesignConfig, eyeBalls, eyeFrames, normalizeDesignConfig, templates } from '../src/qr/design';
import { renderQr } from '../src/qr/renderer';
import type { DesignConfig } from '../src/shared/types';

const svgFor = async (config: Partial<DesignConfig>) => String((await renderQr({
  data: 'https://example.com', size: 300, file: 'svg', config
})).body);

// The public picker must never offer two names that produce the same design.
describe('advertised design styles', () => {
  it.each([
    ['body', bodyShapes], ['eye', eyeFrames], ['eyeBall', eyeBalls]
  ] as const)('renders distinct SVG geometry for every %s choice', async (field, styles) => {
    const rendered = await Promise.all(styles.map((style) => svgFor({ [field]: style })));
    expect(new Set(rendered).size).toBe(styles.length);
  });

  it('keeps all preset values selectable', () => {
    for (const { config } of templates) {
      expect(bodyShapes).toContain(config.body);
      expect(eyeFrames).toContain(config.eye);
      expect(eyeBalls).toContain(config.eyeBall);
    }
  });
});

const legacyGroups = [
  ['body', 'square', ['square', 'japnese']],
  ['body', 'dot', ['dot', 'circle', 'circular', 'circle-zebra', 'circle-zebra-vertical']],
  ['body', 'edge-cut', ['edge-cut', 'edge-cut-smooth', 'pointed-in', 'pointed-in-smooth']],
  ['body', 'round', ['round', 'rounded-in', 'rounded-in-smooth', 'rounded-pointed', 'mosaic', 'leaf']],
  ['body', 'diamond', ['diamond', 'star', 'pointed', 'pointed-smooth', 'pointed-edge-cut']],
  ['eye', 'frame0', ['frame0', 'frame4', 'frame10', 'frame11', 'frame12']],
  ['eye', 'frame1', ['frame1', 'frame2', 'frame3']],
  ['eye', 'frame5', ['frame5', 'frame6', 'frame7', 'frame8', 'frame13', 'frame14', 'frame16']],
  ['eyeBall', 'ball0', ['ball0', 'ball1', 'ball2', 'ball3', 'ball12', 'ball13']],
  ['eyeBall', 'ball5', ['ball5', 'ball6', 'ball7', 'ball8', 'ball10', 'ball11', 'ball14', 'ball15', 'ball16', 'ball17', 'ball18', 'ball19']]
] as const;

describe('saved design compatibility', () => {
  it.each(legacyGroups)('preserves %s aliases for %s', async (field, canonical, aliases) => {
    const expectedSvg = await svgFor({ [field]: canonical });
    for (const alias of aliases) {
      const input = { [field]: alias };
      expect(normalizeDesignConfig(input)[field]).toBe(canonical);
      expect(await svgFor(input)).toBe(expectedSvg);
      expect(input[field]).toBe(alias);
    }
  });

  it.each(['unknown', '__proto__', 'constructor', 'toString', null, 42, ['dot'], { toString: 7 }])('uses defaults for unrecognized style %j', (invalid) => {
    // API input is untrusted JSON even though TypeScript callers use strings.
    const value = invalid as unknown as string;
    const config = normalizeDesignConfig({ body: value, eye: value, eyeBall: value });
    expect(config.body).toBe(defaultDesignConfig.body);
    expect(config.eye).toBe(defaultDesignConfig.eye);
    expect(config.eyeBall).toBe(defaultDesignConfig.eyeBall);
  });
});

it('keeps PNG limited to standard modules and foreground/background colors', async () => {
  const renderPng = (config: Partial<DesignConfig>) => renderQr({ data: 'https://example.com', size: 300, file: 'png', config });
  const plain = await renderPng({});
  const styled = await renderPng({
    body: 'diamond', eye: 'frame5', eyeBall: 'ball5', eye1Color: '#ff0000',
    gradientColor1: '#0000ff', gradientColor2: '#ff0000', logo: '#ctech-mark'
  });
  expect(styled.body).toEqual(plain.body);
  expect((await renderPng({ bodyColor: '#003a70', bgColor: '#f7fafe' })).body).not.toEqual(plain.body);
});
