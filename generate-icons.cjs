const sharp = require('sharp');
const path = require('path');

const svgPath = path.join(__dirname, 'src-tauri', 'icons', 'logo.svg');
const outputDir = path.join(__dirname, 'src-tauri', 'icons');

// Icon sizes to generate
const sizes = [16, 32, 48, 64, 96, 128, 192, 256, 512, 1024];

async function generateIcons() {
  console.log('Generating icons from SVG...');
  console.log(`Source: ${svgPath}`);
  console.log('');

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `${size}x${size}.png`);
    try {
      await sharp(svgPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
          kernel: sharp.kernel.lanczos3, // High quality resampling
          withoutEnlargement: false,
        })
        .png({
          compressionLevel: 6, // Balance between size and speed
          adaptiveFiltering: true,
          quality: 100,
        })
        .toFile(outputPath);
      
      const stats = require('fs').statSync(outputPath);
      console.log(`✓ ${size}x${size}.png (${(stats.size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`✗ ${size}x${size}.png - ${err.message}`);
    }
  }

  console.log('');
  console.log('Done! Check the icons folder.');
}

generateIcons().catch(console.error);
