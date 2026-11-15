import { useEffect, useState } from 'preact/hooks';
import { db } from '../db/db';

/** Paleta suave para receitas sem foto: a cor vem do nome, sempre a mesma. */
const TINTS = ['#E7D9C4', '#D9E4D2', '#E9D3CB', '#D6DFE6', '#E6DDEA', '#E8E2C8'];

function tintFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

/** Miniatura da receita: foto quando existir; senão a inicial sobre cor suave. */
export function Thumb({ name, imageId, size = 'md' }: { name: string; imageId?: string; size?: 'sm' | 'md' | 'lg' }) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!imageId) return setUrl(undefined);
    let objectUrl: string | undefined;
    let cancelled = false;
    db.images.get(imageId).then((img) => {
      if (cancelled || !img || img.deleted) return;
      objectUrl = URL.createObjectURL(img.blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageId]);

  if (url) return <img class={`thumb thumb-${size}`} src={url} alt="" />;
  return (
    <span class={`thumb thumb-${size} thumb-empty`} style={{ background: tintFor(name) }} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
