import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
// Original vector mark: a bowl, a leaf, and three small observations.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#284B37"/><circle cx="512" cy="508" r="348" fill="#315B43"/><path d="M246 476H778C761 660 662 764 512 764S263 660 246 476Z" fill="#E7EDCE"/><ellipse cx="512" cy="476" rx="266" ry="63" fill="#C2D1A5"/><path d="M503 484C435 403 403 290 475 208C557 247 596 348 544 449L519 482" fill="#E7EDCE"/><path d="M529 462C553 340 639 278 734 290C735 394 650 463 529 462Z" fill="#A9C486"/><path d="M518 488L489 286M531 467L671 334" stroke="#284B37" stroke-width="17" stroke-linecap="round"/><circle cx="360" cy="371" r="22" fill="#E2AC7B"/><circle cx="662" cy="210" r="16" fill="#E2AC7B"/><circle cx="794" cy="388" r="13" fill="#E2AC7B"/></svg>`;
await writeFile(new URL('../assets/icon.svg', import.meta.url), svg);
await sharp(Buffer.from(svg)).resize(1024, 1024).png().toFile(fileURLToPath(new URL('../assets/icon.png', import.meta.url)));
await sharp(Buffer.from(svg)).resize(64, 64).png().toFile(fileURLToPath(new URL('../assets/favicon.png', import.meta.url)));
