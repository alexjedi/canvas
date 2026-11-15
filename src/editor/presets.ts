export interface FramePreset {
  name: string;
  width: number;
  height: number;
  reel?: string;
}

export interface PresetGroup {
  title: string;
  presets: FramePreset[];
}

export const FRAME_PRESETS: PresetGroup[] = [
  {
    title: "Phone",
    presets: [
      { name: "iPhone 17", width: 402, height: 874, reel: "mockup=iphone&size=iphone-17" },
      { name: "iPhone 17 Pro Max", width: 440, height: 956, reel: "mockup=iphone&size=iphone-17-pro-max" },
      { name: "iPhone Air", width: 420, height: 912, reel: "mockup=iphone&size=iphone-air" },
      { name: "Android", width: 412, height: 917 },
    ],
  },
  {
    title: "Tablet",
    presets: [
      { name: "iPad mini", width: 744, height: 1133, reel: "mockup=ipad&size=ipad-mini" },
      { name: "iPad Pro 11″", width: 834, height: 1210, reel: "mockup=ipad&size=ipad-pro-11" },
      { name: "iPad Pro 13″", width: 1032, height: 1376, reel: "mockup=ipad&size=ipad-pro-13" },
    ],
  },
  {
    title: "Desktop",
    presets: [
      { name: "MacBook Air 13″", width: 1280, height: 832, reel: "mockup=mac&size=macbook-air-13" },
      { name: "MacBook Pro 14″", width: 1512, height: 982, reel: "mockup=mac&size=macbook-pro-14" },
      { name: "MacBook Pro 16″", width: 1728, height: 1117, reel: "mockup=mac&size=macbook-pro-16" },
      { name: "Desktop", width: 1440, height: 1024 },
      { name: "Full HD", width: 1920, height: 1080 },
    ],
  },
  {
    title: "Watch",
    presets: [
      { name: "Watch Series 11 46mm", width: 208, height: 248, reel: "mockup=watch&size=watch-s11-46" },
      { name: "Watch Ultra 3", width: 211, height: 257, reel: "mockup=watch&size=watch-ultra-3" },
    ],
  },
];

export function reelQuery(width: number, height: number): string {
  for (const group of FRAME_PRESETS) {
    for (const preset of group.presets) {
      if (preset.reel && Math.round(width) === preset.width && Math.round(height) === preset.height) return preset.reel;
    }
  }
  return "";
}
