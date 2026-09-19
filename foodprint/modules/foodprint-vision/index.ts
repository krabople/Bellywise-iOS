import { requireOptionalNativeModule } from 'expo-modules-core';

export interface RecognizedTextBlock {
  text: string;
  confidence: number;
  /** Normalized Vision coordinates; origin is bottom-left. */
  bounds: { x: number; y: number; width: number; height: number };
}

export interface IngredientOcrResult {
  text: string;
  /** Character-count-weighted OCR confidence, NOT a medical or ingredient confidence. */
  confidence: number;
  blocks: RecognizedTextBlock[];
}

interface FoodprintVisionNativeModule {
  recognizeText(uri: string): Promise<IngredientOcrResult>;
}

export default requireOptionalNativeModule<FoodprintVisionNativeModule>('FoodprintVision');
