import { Platform } from 'react-native';
import FoodprintVision, { type IngredientOcrResult } from '../../modules/foodprint-vision';

export type { IngredientOcrResult, RecognizedTextBlock } from '../../modules/foodprint-vision';

export function isIngredientOcrAvailable(): boolean {
  return Platform.OS === 'ios' && FoodprintVision !== null;
}

/** Recognizes locally using Apple Vision; never sends the photo to a server. */
export async function recognizeIngredientImage(uri: string): Promise<IngredientOcrResult> {
  if (!isIngredientOcrAvailable() || !FoodprintVision) {
    throw new Error('Camera text recognition is available in the Bellywise iOS app. For this preview, paste or type the ingredient list.');
  }
  if (!uri.startsWith('file://')) throw new Error('Select a local camera or photo-library image.');
  return FoodprintVision.recognizeText(uri);
}
