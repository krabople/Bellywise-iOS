import type { IngredientOcrResult } from '../../modules/foodprint-vision';
export function selectRecognizedRegion(result: IngredientOcrResult, region: { x: number; y: number; width: number; height: number }): IngredientOcrResult {
  // Vision bounds are bottom-left; the image selector is top-left. Require most of the line inside the box.
  const blocks = result.blocks.filter(block => {
    const b = block.bounds, top = 1 - b.y - b.height;
    const overlapWidth = Math.max(0, Math.min(b.x + b.width, region.x + region.width) - Math.max(b.x, region.x));
    const overlapHeight = Math.max(0, Math.min(top + b.height, region.y + region.height) - Math.max(top, region.y));
    return overlapWidth * overlapHeight >= b.width * b.height * .6;
  });
  const chars = blocks.reduce((n, b) => n + b.text.length, 0);
  return { text: blocks.map(b => b.text).join('\n'), blocks, confidence: chars ? blocks.reduce((n, b) => n + b.confidence * b.text.length, 0) / chars : 0 };
}
