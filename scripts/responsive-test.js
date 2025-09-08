const widths = [768, 1024, 1440, 1920];

function clamp(min, val, max) {
  return Math.min(Math.max(val, min), max);
}

widths.forEach(w => {
  const vw = w / 100;
  const spaceMd = 16 + 0.5 * vw;
  const spaceLg = 24 + 0.8 * vw;
  const spaceXl = 32 + 1 * vw;
  const heroTitle = clamp(28, 4 * vw, 44);
  const heroSub = clamp(16, 1.5 * vw, 20);
  console.log(`\nViewport: ${w}px`);
  console.log(`  space-md: ${spaceMd.toFixed(2)}px`);
  console.log(`  space-lg: ${spaceLg.toFixed(2)}px`);
  console.log(`  space-xl: ${spaceXl.toFixed(2)}px`);
  console.log(`  hero-title font: ${heroTitle.toFixed(2)}px`);
  console.log(`  hero-sub font: ${heroSub.toFixed(2)}px`);
});
