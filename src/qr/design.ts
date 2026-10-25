import type { DesignConfig } from '../shared/types';

// Only advertise styles with distinct geometry. Legacy names remain accepted
// below so existing saved designs and API clients keep the same appearance.
export const bodyShapes = ['square', 'dot', 'edge-cut', 'round', 'diamond'] as const;
export const eyeFrames = ['frame0', 'frame1', 'frame5'] as const;
export const eyeBalls = ['ball0', 'ball5'] as const;

type BodyShape = typeof bodyShapes[number];
type EyeFrame = typeof eyeFrames[number];
type EyeBall = typeof eyeBalls[number];

const bodyAliases: Record<string, BodyShape> = {
  square: 'square', japnese: 'square',
  dot: 'dot', circle: 'dot', circular: 'dot', 'circle-zebra': 'dot', 'circle-zebra-vertical': 'dot',
  'edge-cut': 'edge-cut', 'edge-cut-smooth': 'edge-cut', 'pointed-in': 'edge-cut', 'pointed-in-smooth': 'edge-cut',
  round: 'round', 'rounded-in': 'round', 'rounded-in-smooth': 'round', 'rounded-pointed': 'round', mosaic: 'round', leaf: 'round',
  diamond: 'diamond', star: 'diamond', pointed: 'diamond', 'pointed-smooth': 'diamond', 'pointed-edge-cut': 'diamond'
};

const frameAliases: Record<string, EyeFrame> = {
  frame0: 'frame0', frame4: 'frame0', frame10: 'frame0', frame11: 'frame0', frame12: 'frame0',
  frame1: 'frame1', frame2: 'frame1', frame3: 'frame1',
  frame5: 'frame5', frame6: 'frame5', frame7: 'frame5', frame8: 'frame5', frame13: 'frame5', frame14: 'frame5', frame16: 'frame5'
};

const ballAliases: Record<string, EyeBall> = {
  ball0: 'ball0', ball1: 'ball0', ball2: 'ball0', ball3: 'ball0', ball12: 'ball0', ball13: 'ball0',
  ball5: 'ball5', ball6: 'ball5', ball7: 'ball5', ball8: 'ball5', ball10: 'ball5', ball11: 'ball5', ball14: 'ball5', ball15: 'ball5', ball16: 'ball5', ball17: 'ball5', ball18: 'ball5', ball19: 'ball5'
};

function canonicalStyle<T extends string>(aliases: Record<string, T>, value: string, fallback: T): T {
  return Object.hasOwn(aliases, value) ? aliases[value] : fallback;
}

export const logoGallery = [
  'ctech-mark',
  'qrcodemonkey',
  'facebook',
  'facebook-circle',
  'twitter-circle',
  'youtube',
  'youtube-circle',
  'googleplus-circle',
  'instagram-circle',
  'linkedin-circle',
  'xing-circle',
  'pinterest-circle',
  'vimeo-circle',
  'soundcloud-circle',
  'vk-circle',
  'whatsapp-circle',
  'appstore',
  'google-play',
  'gmail',
  'calendar-circle',
  'document-circle',
  'phone-circle',
  'share-circle',
  'wifi-circle',
  'bitcoin'
] as const;

export const defaultDesignConfig: DesignConfig = {
  body: 'square',
  eye: 'frame0',
  eyeBall: 'ball0',
  erf1: [],
  erf2: [],
  erf3: [],
  brf1: [],
  brf2: [],
  brf3: [],
  bodyColor: '#000000',
  bgColor: '#ffffff',
  eye1Color: '#000000',
  eye2Color: '#000000',
  eye3Color: '#000000',
  eyeBall1Color: '#000000',
  eyeBall2Color: '#000000',
  eyeBall3Color: '#000000',
  gradientColor1: null,
  gradientColor2: null,
  gradientType: 'linear',
  gradientOnEyes: false,
  logo: null,
  logoMode: 'default'
};

const templatePresets: Array<{ name: string; config: DesignConfig }> = [
  { name: 'Classic', config: { ...defaultDesignConfig } },
  {
    name: 'CompleteTech',
    config: {
      ...defaultDesignConfig,
      body: 'round',
      eye: 'frame13',
      eyeBall: 'ball15',
      bodyColor: '#003A70',
      eye1Color: '#003A70',
      eye2Color: '#003A70',
      eye3Color: '#003A70',
      eyeBall1Color: '#FDB913',
      eyeBall2Color: '#FDB913',
      eyeBall3Color: '#FDB913',
      bgColor: '#F7FAFE',
      logo: '#ctech-mark'
    }
  },
  {
    name: 'Easy',
    config: {
      ...defaultDesignConfig,
      body: 'dot',
      eye: 'frame13',
      eyeBall: 'ball15',
      bodyColor: '#102A43',
      eye1Color: '#102A43',
      eye2Color: '#102A43',
      eye3Color: '#102A43'
    }
  },
  {
    name: 'Facebook',
    config: {
      ...defaultDesignConfig,
      body: 'round',
      eye: 'frame2',
      eyeBall: 'ball2',
      bodyColor: '#1877F2',
      eye1Color: '#1877F2',
      eye2Color: '#1877F2',
      eye3Color: '#1877F2',
      logo: '#facebook'
    }
  },
  {
    name: 'Twitter',
    config: {
      ...defaultDesignConfig,
      body: 'circular',
      eye: 'frame5',
      eyeBall: 'ball11',
      bodyColor: '#111111',
      eye1Color: '#111111',
      eye2Color: '#111111',
      eye3Color: '#111111',
      logo: '#twitter-circle'
    }
  },
  {
    name: 'Youtube',
    config: {
      ...defaultDesignConfig,
      body: 'circle',
      eye: 'frame13',
      eyeBall: 'ball14',
      bodyColor: '#E62117',
      eye1Color: '#E62117',
      eye2Color: '#E62117',
      eye3Color: '#E62117',
      logo: '#youtube'
    }
  },
  {
    name: 'Monkey',
    config: {
      ...defaultDesignConfig,
      body: 'mosaic',
      eye: 'frame13',
      eyeBall: 'ball15',
      bodyColor: '#6B3F1F',
      bgColor: '#FFF7ED',
      eye1Color: '#5A351C',
      eye2Color: '#5A351C',
      eye3Color: '#5A351C',
      eyeBall1Color: '#F6C57A',
      eyeBall2Color: '#F6C57A',
      eyeBall3Color: '#F6C57A',
      logo: '#qrcodemonkey'
    }
  },
  {
    name: 'Rain',
    config: {
      ...defaultDesignConfig,
      body: 'circle-zebra-vertical',
      eye: 'frame13',
      eyeBall: 'ball15',
      bodyColor: '#0B6FA4',
      gradientColor1: '#083D77',
      gradientColor2: '#2BB3F3',
      eye1Color: '#083D77',
      eye2Color: '#083D77',
      eye3Color: '#083D77',
      eyeBall1Color: '#2BB3F3',
      eyeBall2Color: '#2BB3F3',
      eyeBall3Color: '#2BB3F3'
    }
  },
  {
    name: 'Jungle',
    config: {
      ...defaultDesignConfig,
      body: 'rounded-pointed',
      eye: 'frame14',
      eyeBall: 'ball16',
      bodyColor: '#2F6B2F',
      gradientColor1: '#6FAF3A',
      gradientColor2: '#123D2A',
      gradientType: 'radial',
      eye1Color: '#123D2A',
      eye2Color: '#123D2A',
      eye3Color: '#123D2A',
      eyeBall1Color: '#6FAF3A',
      eyeBall2Color: '#6FAF3A',
      eyeBall3Color: '#6FAF3A'
    }
  },
  {
    name: 'Mosaic',
    config: {
      ...defaultDesignConfig,
      body: 'mosaic',
      eye: 'frame16',
      eyeBall: 'ball8',
      bodyColor: '#0B7285',
      gradientColor1: '#7B2CBF',
      gradientColor2: '#00A8E8',
      eye1Color: '#2F184B',
      eye2Color: '#2F184B',
      eye3Color: '#2F184B',
      eyeBall1Color: '#00A8E8',
      eyeBall2Color: '#00A8E8',
      eyeBall3Color: '#00A8E8'
    }
  },
  {
    name: 'Dot',
    config: {
      ...defaultDesignConfig,
      body: 'dot',
      eye: 'frame0',
      eyeBall: 'ball14',
      bodyColor: '#0077B6',
      eye1Color: '#023E8A',
      eye2Color: '#023E8A',
      eye3Color: '#023E8A',
      eyeBall1Color: '#0077B6',
      eyeBall2Color: '#0077B6',
      eyeBall3Color: '#0077B6'
    }
  },
  {
    name: 'Coffee',
    config: {
      ...defaultDesignConfig,
      body: 'round',
      eye: 'frame8',
      eyeBall: 'ball19',
      bgColor: '#FAEDE7',
      bodyColor: '#5B3924',
      gradientColor1: '#8A5A3C',
      gradientColor2: '#3B2A20',
      eye1Color: '#3B2A20',
      eye2Color: '#3B2A20',
      eye3Color: '#3B2A20',
      eyeBall1Color: '#B17800',
      eyeBall2Color: '#B17800',
      eyeBall3Color: '#B17800'
    }
  },
  {
    name: 'Ninja',
    config: {
      ...defaultDesignConfig,
      body: 'japnese',
      eye: 'frame12',
      eyeBall: 'ball14',
      bodyColor: '#111827',
      gradientColor1: '#111827',
      gradientColor2: '#B91C1C',
      eye1Color: '#111827',
      eye2Color: '#111827',
      eye3Color: '#111827',
      eyeBall1Color: '#B91C1C',
      eyeBall2Color: '#B91C1C',
      eyeBall3Color: '#B91C1C'
    }
  },
  {
    name: 'Bitcoin',
    config: {
      ...defaultDesignConfig,
      body: 'circle',
      eye: 'frame1',
      eyeBall: 'ball1',
      bodyColor: '#2B2B2B',
      bgColor: '#FFF8E6',
      eye1Color: '#2B2B2B',
      eye2Color: '#2B2B2B',
      eye3Color: '#2B2B2B',
      eyeBall1Color: '#F7931A',
      eyeBall2Color: '#F7931A',
      eyeBall3Color: '#F7931A',
      logo: '#bitcoin'
    }
  }
];

export const templates = templatePresets.map(({ name, config }) => ({ name, config: normalizeDesignConfig(config) }));

export function normalizeDesignConfig(input: Partial<DesignConfig> = {}): DesignConfig {
  const merged = { ...defaultDesignConfig, ...input };
  for (const key of ['bgColor', 'bodyColor', 'eye1Color', 'eye2Color', 'eye3Color', 'eyeBall1Color', 'eyeBall2Color', 'eyeBall3Color', 'gradientColor1', 'gradientColor2'] as const) {
    const color = merged[key];
    if (color && (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color))) throw new Error('Colors must be six-digit hex values');
  }
  if (merged.logo && (typeof merged.logo !== 'string' || !/^(#[a-z0-9-]+|\/uploads\/[a-z0-9-]+\.(png|jpg|gif|svg))$/i.test(merged.logo))) {
    throw new Error('Choose a built-in logo or an uploaded image');
  }
  return {
    ...merged,
    body: canonicalStyle(bodyAliases, merged.body, 'square'),
    eye: canonicalStyle(frameAliases, merged.eye, 'frame0'),
    eyeBall: canonicalStyle(ballAliases, merged.eyeBall, 'ball0'),
    gradientType: merged.gradientType === 'radial' ? 'radial' : 'linear',
    logoMode: merged.logoMode === 'clean' ? 'clean' : 'default'
  };
}
