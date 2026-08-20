// One-off image pipeline: source photos -> responsive WebP sets in src/assets.
// Run manually with `node scripts/optimize-images.mjs` whenever source images change.
import sharp from 'sharp'
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const WORK_SRC = path.join(ROOT, 'imgs/Projetos')
const PROFILE_SRC = path.join(ROOT, 'imgs/perfil')
const WORK_OUT = path.join(ROOT, 'src/assets/work')
const PROFILE_OUT = path.join(ROOT, 'src/assets/profile')

const WORK_WIDTHS = [640, 1080, 1600, 2200]
const PROFILE_WIDTHS = [480, 900, 1400]

// Maps source filenames to the semantic slugs used throughout the app/content data.
const WORK_SLUGS = {
  'alice-qu-Bzsl_5n6UU0-unsplash.jpg': 'low-tide',
  'anjith-paul-LwiUpgPUVug-unsplash.jpg': 'canal-light',
  'fumiaki-hayashi-uMUN5n_7qG0-unsplash.jpg': 'ameyoko',
  'kristaps-ungurs-Otfon_ktcvA-unsplash.jpg': 'bloom',
  'kristaps-ungurs-xRkLHDRWPac-unsplash.jpg': 'gold-fields',
  'pascal-debrunner-li5A0vC8Z3o-unsplash.jpg': 'aare',
  'pietro-de-grandi-T7K4aEPoGGk-unsplash.jpg': 'braies-boats',
  'luca-bravo-zAjdgNXsMeg-unsplash.jpg': 'braies-boathouse',
  'jack-anstey-XVoyX7l9ocY-unsplash.jpg': 'glenfinnan',
  'dan-freeman-wAn4RfmXtxU-unsplash.jpg': 'palm-mirror',
}

const PROFILE_SLUGS = {
  'Foto2.jpg': 'andre',
  'Foto1.jpg': 'andre-detail',
}

async function processFile(srcPath, outDir, slug, widths) {
  await mkdir(outDir, { recursive: true })
  const image = sharp(srcPath).rotate()
  const meta = await image.metadata()

  for (const width of widths) {
    if (meta.width && width > meta.width) continue
    await image
      .clone()
      .resize({ width })
      .webp({ quality: 78 })
      .toFile(path.join(outDir, `${slug}-${width}.webp`))
  }

  // Fallback largest size as jpeg for <img> without WebP support (negligible today, kept cheap)
  await image
    .clone()
    .resize({ width: Math.min(widths[widths.length - 1], meta.width ?? widths[widths.length - 1]) })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(path.join(outDir, `${slug}.jpg`))

  console.log(`✔ ${slug}`)
}

async function run() {
  const workFiles = (await readdir(WORK_SRC)).filter((f) => /\.(jpe?g|png)$/i.test(f))
  for (const file of workFiles) {
    const slug = WORK_SLUGS[file] ?? file.replace(/\.[^.]+$/, '').toLowerCase()
    await processFile(path.join(WORK_SRC, file), WORK_OUT, slug, WORK_WIDTHS)
  }

  const profileFiles = (await readdir(PROFILE_SRC)).filter((f) => /\.(jpe?g|png)$/i.test(f))
  for (const file of profileFiles) {
    const slug = PROFILE_SLUGS[file]
    if (!slug) continue
    await processFile(path.join(PROFILE_SRC, file), PROFILE_OUT, slug, PROFILE_WIDTHS)
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
