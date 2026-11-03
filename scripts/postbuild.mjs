// Ajustes pós `readme-aura build`:
//
// 1. Imagens: todas as fatias são blocos `inline`, e o readme-aura as junta numa única
//    linha HTML. Aqui cada <img> recebe:
//    - o `alt="..."` declarado no bloco ```aura do source (o readme-aura não gera alt);
//    - largura em % de 800px e nenhuma altura, para escalar junto com o container;
//    - align="top", que elimina a fresta da linha de base entre as linhas de imagens.
//    A última peça de cada linha com várias peças perde 0.05% para a soma nunca passar
//    de 100% por arredondamento (o que jogaria a peça para a linha de baixo).
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
const CANVAS = 800;

const alts = [...readFileSync(source, 'utf8').matchAll(/^```aura\b(.*)$/gm)].map(
  ([, meta]) => meta.match(/\balt="([^"]*)"/)?.[1] ?? null,
);

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

let readme = readFileSync(output, 'utf8');

const imgRe = /<img src="([^"]*readme-aura-component-(\d+)-\w+\.svg)" width="(\d+)" height="\d+" \/>/g;
const images = [...readme.matchAll(imgRe)].map(([tag, src, i, width]) => ({ tag, src, i, width: +width }));

let rowWidth = 0;
let rowStart = 0;
images.forEach((img, n) => {
  rowWidth += img.width;
  img.pct = (img.width / CANVAS) * 100;
  if (rowWidth >= CANVAS) {
    if (n > rowStart) img.pct -= 0.05;
    rowWidth = 0;
    rowStart = n + 1;
  }
});

for (const { tag, src, i, pct } of images) {
  const alt = alts[i] ?? '';
  const width = `${+pct.toFixed(4)}%`;
  const img = `<img src="${src}" alt="${escapeHtml(alt)}" align="top" width="${width}" />`;
  // O GitHub envolve toda imagem sem <a> num link para o próprio arquivo. Uma âncora
  // sem href (<a name>) evita isso, e só os botões com link= ficam clicáveis.
  const linked = readme.includes(`">${tag}</a>`);
  readme = readme.replace(tag, linked ? img : `<a name="aura-${i}">${img}</a>`);
}

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
