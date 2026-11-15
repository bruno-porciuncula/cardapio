import { useEffect, useState } from 'preact/hooks';
import { db } from '../db/db';
import { dishEmoji } from '../lib/emoji';

/** Gradientes quentes para pratos sem foto: a cor vem do nome, sempre a mesma. */
const GRADIENTS = [
  'linear-gradient(135deg, #FFD9A8, #FF9F6E)',
  'linear-gradient(135deg, #FFE7A3, #F7B538)',
  'linear-gradient(135deg, #D7F0B8, #8FCB6B)',
  'linear-gradient(135deg, #FFC9C0, #F2706B)',
  'linear-gradient(135deg, #F9D3E9, #D97AB3)',
  'linear-gradient(135deg, #FFE0C2, #F28C5B)',
];

function gradientFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

/** Foto do prato quando existir; senão o ícone do prato sobre um gradiente quente. */
export function Thumb({ name, emoji, imageId, size = 'md' }: {
  name: string;
  emoji?: string;
  imageId?: string;
  size?: 'xxs' | 'xs' | 'fill' | 'sm' | 'md' | 'lg' | 'hero';
}) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    setUrl(undefined);
    if (!imageId) return;
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

  if (url) return <img class={`thumb thumb-${size}`} src={url} alt="" loading="lazy" />;
  return (
    <span class={`thumb thumb-${size} thumb-empty`} style={{ background: gradientFor(name) }} aria-hidden="true">
      {dishEmoji(name, emoji)}
    </span>
  );
}
