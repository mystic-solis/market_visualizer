const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const svgPath = path.join(__dirname, 'src-tauri', 'icons', 'logo.svg');
const icoPath = path.join(__dirname, 'src-tauri', 'icons', 'icon.ico');

async function generateIco() {
  console.log('Generating icon.ico...');
  
  const sizes = [16, 32, 48, 64, 128, 256];
  const images = [];
  
  for (const size of sizes) {
    const buffer = await sharp(svgPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: sharp.kernel.lanczos3,
      })
      .png()
      .toBuffer();
    images.push({ size, buffer });
    console.log(`  ${size}x${size}`);
  }
  
  // ICO header
  const numImages = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(numImages, 4); // number of images
  
  // Image directory
  const dirEntrySize = 16;
  const dirSize = numImages * dirEntrySize;
  const dir = Buffer.alloc(dirSize);
  
  // Calculate offsets
  let offset = 6 + dirSize; // header + directory
  
  const imageDataBuffers = [];
  
  images.forEach((img, i) => {
    const entryOffset = i * dirEntrySize;
    
    // Width, Height (0 means 256)
    dir.writeUInt8(img.size === 256 ? 0 : img.size, entryOffset);
    dir.writeUInt8(img.size === 256 ? 0 : img.size, entryOffset + 1);
    dir.writeUInt8(0, entryOffset + 2); // color palette
    dir.writeUInt8(0, entryOffset + 3); // reserved
    dir.writeUInt16LE(1, entryOffset + 4); // color planes
    dir.writeUInt16LE(32, entryOffset + 6); // bits per pixel
    dir.writeUInt32LE(img.buffer.length, entryOffset + 8); // size of image data
    dir.writeUInt32LE(offset, entryOffset + 12); // offset of image data
    
    imageDataBuffers.push(img.buffer);
    offset += img.buffer.length;
  });
  
  // Combine all parts
  const icoBuffer = Buffer.concat([header, dir, ...imageDataBuffers]);
  
  fs.writeFileSync(icoPath, icoBuffer);
  
  const stats = fs.statSync(icoPath);
  console.log(`✓ icon.ico (${(stats.size / 1024).toFixed(1)} KB)`);
}

generateIco().catch(console.error);
