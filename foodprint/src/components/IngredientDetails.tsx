import React from 'react';
import { Linking, Pressable } from 'react-native';
import { t } from '../i18n';
import { ingredientDisplayName, getIngredientInfo } from '../domain/ingredients';
import { C, F, Sheet, T } from './ui';
export function IngredientDetails({ id, name, onClose }: { id: string; name?: string; onClose: () => void }) {
 const info = getIngredientInfo(id, name);
 return <Sheet title={ingredientDisplayName(info.id, info.name)} onClose={onClose}><T>{info.whatItIs}</T><T style={{ fontFamily: F.semi, marginTop: 8 }}>{t("Where it is found")}</T><T>{info.whereFound}</T><T style={{ fontFamily: F.semi, marginTop: 8 }}>{t("Symptoms and context")}</T><T style={{ fontFamily: F.semi }}>{info.triggerSummary}</T>{info.commonSymptoms.length > 0 && <T>{t("Commonly reported: {0}", [info.commonSymptoms.map(text => t(text)).join(' · ')])}</T>}<T>{info.symptomContext}</T>{info.sourceUrl && <Pressable accessibilityRole="link" onPress={() => Linking.openURL(info.sourceUrl!)}><T style={{ color: C.green, textDecorationLine: 'underline', marginTop: 8 }}>{info.sourceTitle || 'Read source'}</T></Pressable>}</Sheet>;
}
