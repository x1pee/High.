import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const repository = 'x1pee/High.';

export function createUpdateManifest({ version, displayVersion, notes, signature, publishedAt }) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('Release version must be SemVer');
  }
  if (!displayVersion || !signature?.trim()) {
    throw new Error('Display version and signed EXE signature are required');
  }
  const encodedSignature = signature.trim();
  const signatureText = Buffer.from(encodedSignature, 'base64').toString('utf8');
  if (Buffer.from(signatureText, 'utf8').toString('base64') !== encodedSignature) {
    throw new Error('EXE signature is not valid base64');
  }
  const signerVersion = signatureText
    .split(/\r?\n/)
    .find(line => line.startsWith('trusted comment: '))
    ?.split('\t')
    .find(field => field.startsWith('version:'))
    ?.slice('version:'.length);
  if (!signatureText.startsWith('untrusted comment: ') || signerVersion !== version) {
    throw new Error('EXE signature is missing the matching signed release version');
  }
  return {
    version,
    display_version: displayVersion,
    notes: notes.trim(),
    pub_date: publishedAt,
    platforms: {
      'windows-x86_64': {
        signature: encodedSignature,
        url: `https://github.com/${repository}/releases/download/v${version}/High_${version}_x64.exe`,
      },
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const [signaturePath, outputPath] = process.argv.slice(2);
  if (!signaturePath || !outputPath) {
    throw new Error('Usage: node scripts/create-update-manifest.mjs <exe.sig> <latest.json>');
  }
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const changelog = await fs.readFile(path.join(root, 'CHANGELOG.md'), 'utf8');
  const signature = await fs.readFile(signaturePath, 'utf8');
  const notes = changelog.split(/^# Версия /m).slice(1, 2)[0] ?? '';
  const manifest = createUpdateManifest({
    version: pkg.version,
    displayVersion: pkg.appVersion,
    notes: `Версия ${notes.trim()}`,
    signature,
    publishedAt: new Date().toISOString(),
  });
  await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Created portable Windows update manifest for ${manifest.version}`);
}
