// Ajustes pós `readme-aura build`:
//
// 1. Alt text: readme-aura gera as imagens sem alt descritivo (blocos) ou sem alt
//    nenhum (inline). Lemos o `alt="..."` declarado em cada bloco ```aura do source
//    e aplicamos no README gerado, casando pelo índice do componente.
//
// 2. SVGs aninhados: readme-aura transforma cada <svg> do JSX em
//    <svg x y width height clip-path mask>, mas clip-path/mask num <svg> com x/y
//    são resolvidos no sistema de coordenadas já deslocado, e o conteúdo some.
//    Movemos clip-path/mask para um <g> em volta, onde valem as coordenadas do pai.
//
// Uso: node scripts/postbuild.mjs [source] [output] [assetsDir]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const source = process.argv[2] ?? 'readme.source.md';
const output = process.argv[3] ?? 'README.md';
const assetsDir = process.argv[4] ?? '.github/assets';

const alts = [...readFileSync(source, 'utf8').matchAll(/^```aura\b(.*)$/gm)].map(
  ([, meta]) => meta.match(/\balt="([^"]*)"/)?.[1] ?? null,
);

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escapeMd = (s) => s.replace(/[\\[\]]/g, '\\$&');

let readme = readFileSync(output, 'utf8');

// Blocos: ![readme-aura-component-N](src "title")
readme = readme.replace(
  /!\[readme-aura-component-(\d+)\]\(([^ )]+) "[^"]*"\)/g,
  (match, i, src) => (alts[i] ? `![${escapeMd(alts[i])}](${src})` : match),
);

// Inline: <img src=".../readme-aura-component-N-hash.svg" ... />
readme = readme.replace(
  /<img src="([^"]*readme-aura-component-(\d+)-\w+\.svg)"/g,
  (match, src, i) => (alts[i] ? `<img src="${src}" alt="${escapeHtml(alts[i])}"` : match),
);

writeFileSync(output, readme);

for (const name of readdirSync(assetsDir)) {
  if (!/^readme-aura-component-\d+-\w+\.svg$/.test(name)) continue;
  const path = join(assetsDir, name);
  const svg = readFileSync(path, 'utf8').replace(
    /<svg (x="[^"]*" y="[^"]*"[^>]*?) clip-path="([^"]*)" mask="([^"]*)">([\s\S]*?)<\/svg>/g,
    (_, attrs, clip, mask, body) => `<g clip-path="${clip}" mask="${mask}"><svg ${attrs}>${body}</svg></g>`,
  );
  writeFileSync(path, svg);
}
