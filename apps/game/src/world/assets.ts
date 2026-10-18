// Resolves bundled asset URLs and fails loudly if anything in manifest.json is missing.
const files = import.meta.glob('../assets/*', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export interface Manifest {
  placeholder: boolean;
  tilesets: string[];
  maps: string[];
  atlases: { image: string; data: string }[];
  spritesheets: { key: string; frameWidth: number; frameHeight: number }[];
  images: string[];
}

export function assetUrl(name: string): string {
  const url = files[`../assets/${name}`];
  if (!url)
    throw new Error(`Missing asset: ${name}. Run "pnpm graybox" or add the file to src/assets.`);
  return url;
}

export async function loadManifest(): Promise<Manifest> {
  const res = await fetch(assetUrl('manifest.json'));
  if (!res.ok) throw new Error(`Could not load manifest.json (${res.status})`);
  const m = (await res.json()) as Manifest;
  const needed = [
    ...m.tilesets,
    ...m.maps,
    ...m.atlases.flatMap((a) => [a.image, a.data]),
    ...m.spritesheets.map((s) => `${s.key}.png`),
    ...m.images,
  ];
  const missing = needed.filter((n) => !files[`../assets/${n}`]);
  if (missing.length > 0) throw new Error(`Missing assets: ${missing.join(', ')}`);
  return m;
}

export const keyOf = (file: string): string => file.replace(/\.(png|json)$/, '');
