import { open } from 'node:fs/promises';

const file = await open(new URL('../src/assets/libro.webp', import.meta.url), 'r');
try {
  const header = Buffer.alloc(150);
  await file.read(header, 0, header.length, 0);
  if (header.toString('utf8').startsWith('version https://git-lfs.github.com/spec/v1')) {
    throw new Error('La portada es un puntero Git LFS. En Vercel activa Project Settings > Git > Git Large File Storage (LFS) y vuelve a desplegar. En local ejecuta git lfs pull.');
  }
  if (header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('src/assets/libro.webp no contiene una imagen WebP válida.');
  }
  console.log('Recursos Git LFS verificados. Iniciando astro build…');
} finally {
  await file.close();
}
