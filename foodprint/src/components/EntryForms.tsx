import { ingredientDisplayName } from '../domain/ingredients';
import {t, getRegion, tx } from '../i18n';
import { countryForRegion } from '../i18n/regions';
import { MarketPicker } from './MarketPicker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, Switch, View } from 'react-native';
import { Camera, Check, CheckCheck, FileText, Plus, Search, Trash2, X, Image as ImageIcon, ScanLine } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { File } from 'expo-file-system';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { T, C, F, Row, Button, Field, Notice, Chip, Pill, Sheet, IconButton, Card } from './ui';
import { PhotoRegion, type Region } from './PhotoRegion';
import { selectRecognizedRegion } from '../services/ocrRegion';
import type { IngredientOcrResult } from '../../modules/foodprint-vision';
import { expandIngredientExposuresForAnalysis } from '../domain/ingredients';
import { resolveIngredientEntry } from '../domain/ingredientEntry';
import { ingredientsForMealEntry } from '../domain/mealEntry';
import { DateField } from './DateField';
import { resolveFood, suggestFoodNames, ingredientsFromNames, localDateKey, getIngredientInfo, findIngredientRecord, suggestIngredientRecords, normalizeIngredientText } from '../domain';
import type { CustomIngredientDefinition, IngredientExposure, Level, Meal, SymptomDefinition, SymptomLog } from '../domain/types';
import { expandIngredientNames, parseIngredientLabel } from '../services/labelParser';
import { isIngredientOcrAvailable, recognizeIngredientImage } from '../services/ocr';
import { lookupBarcode, searchProducts, type CatalogProduct } from '../services/products';
import { searchLocalProducts } from '../services/localProducts';
import { suggestBrands } from '../domain/brands';

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
export function defaultEntryDate(selectedDay?: string): Date {
  const now = new Date();
  if (!selectedDay || selectedDay === localDateKey(now)) return now;
  const noon = new Date(`${selectedDay}T12:00:00`);
  return Number.isFinite(noon.getTime()) ? noon : now;
}

type MealEntryMode = 'barcode' | 'type' | 'scan' | 'product';

export function MealForm({ initial, selectedDay, customIngredients = [], onAddCustomIngredient, onClose, onSave, onDelete, contextLocked = false, initialMode = 'barcode' }: { initial?: Meal; selectedDay?: string; customIngredients?: CustomIngredientDefinition[]; onAddCustomIngredient?: (ingredient: CustomIngredientDefinition) => Promise<void>; onClose: () => void; onSave: (meal: Meal) => Promise<void>; onDelete?: () => Promise<void>; contextLocked?: boolean; initialMode?: MealEntryMode }) {
  const [mode, setMode] = useState<MealEntryMode>(initial ? initial.source === 'label' ? 'scan' : 'type' : initialMode);
  const [kind, setKind] = useState<'food' | 'drink'>(initial?.kind || 'food');
  const [name, setName] = useState(initial?.name || '');
  const [date, setDate] = useState(() => initial ? new Date(initial.eatenAt) : defaultEntryDate(selectedDay));
  const [notes, setNotes] = useState(initial?.notes || '');
  const [variant, setVariant] = useState('');
  const [ingredients, setIngredients] = useState<IngredientExposure[]>(initial?.ingredients || []);
  const [review, setReview] = useState(!!initial);
  const [label, setLabel] = useState(initial?.labelText || '');
  const [catalogProduct, setCatalogProduct] = useState(false);
  const [catalogSource, setCatalogSource] = useState<{ name: string; url: string; label: string }>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newIngredient, setNewIngredient] = useState('');
  const [source, setSource] = useState<Meal['source']>(initial?.source || 'typed');
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [searched, setSearched] = useState(false);
  const [onlinePage, setOnlinePage] = useState(0);
  const [localLimit, setLocalLimit] = useState(12);
  const [productCountry, setProductCountry] = useState(() => countryForRegion(getRegion()));
  const localMatches = useMemo(() => searchLocalProducts(query, { limit: localLimit, country: productCountry || undefined }), [query, localLimit, productCountry]);
  const brandSuggestions = useMemo(() => suggestBrands(query), [query]);
  const [groupName, setGroupName] = useState(initial?.groupName || 'Ungrouped');
  const [productCode, setProductCode] = useState(initial?.productCode);
  const [excludedComponents, setExcludedComponents] = useState<string[]>(initial?.excludedComponents || []);
  const [photo, setPhoto] = useState<{ uri: string; width: number; height: number; recognition: IngredientOcrResult } | null>(null);
  const [deleteCheck, setDeleteCheck] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [barcodeNeedsLabel, setBarcodeNeedsLabel] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [ingredientInfoId, setIngredientInfoId] = useState<string | null>(null);
  const [pendingIngredient, setPendingIngredient] = useState('');
  const [ingredientSuggestions, setIngredientSuggestions] = useState<{ id: string; name: string }[]>([]);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const resolution = useMemo(() => resolveFood(name, variant || undefined), [name, variant]);
  const foodSuggestions = useMemo(() => resolution.matched ? [] : suggestFoodNames(name), [name, resolution.matched]);
  const personalCatalog = useMemo(() => customIngredients.map(item => ({ ...item })), [customIngredients]);
  const currentOperation = useRef(0);
  const scanLock = useRef(false);
  useEffect(() => () => { ++currentOperation.current; }, []);
  useEffect(() => () => { if (photo) { try { const file = new File(photo.uri); if (file.exists) file.delete(); } catch {} } }, [photo]);
  const resetReview = () => { ++currentOperation.current; setBusy(false); setReview(false); setError(''); setWarnings([]); setScannerOpen(false); setCatalogProduct(false); setCatalogSource(undefined); setProductCode(undefined); setExcludedComponents([]); setBarcodeNeedsLabel(false); scanLock.current = false; };
  const showTyped = () => { setIngredients(ingredientsForMealEntry(resolution)); setReview(true); setWarnings(resolution.matched ? [] : ['This food or drink is not in the offline recipe guide. Add its ingredients, or save the entry without ingredient assumptions.']); setSource('typed');  };
  const parseLabel = (text = label, confidence?: number, product?: CatalogProduct) => {
    const parsed = parseIngredientLabel(text, { source: product ? 'catalog' : 'ocr', ocrConfidence: confidence, customIngredients: personalCatalog });
    const allergens = [...new Set([...parsed.allergens, ...(product?.allergens ?? [])])];
    const traces = [...new Set([...parsed.mayContain, ...(product?.traces ?? [])])];
    setWarnings([...parsed.warnings, ...(product?.warnings ?? []), ...(allergens.length ? [t("Allergen statement (separate from ingredients): {0}.", [allergens.join(', ')])] : []), ...(traces.length ? [t("May contain: {0}. This is a trace warning, not confirmed consumption.", [traces.join(', ')])] : [])]);
    if (!parsed.ingredients.length) {
      if (product) { setMode('barcode'); setCatalogProduct(false); setBarcodeNeedsLabel(true); setError(''); }
      else setError(t("No clear run of catalogue ingredients was found. Retake the photo closer to the list, or review and add the ingredients manually."));
      setReview(false); return;
    }
    setError(''); setIngredients(ingredientsFromNames(expandIngredientNames(parsed.ingredients), product?.ingredientConfidence ?? 'confirmed', personalCatalog)); setSource('label'); setReview(true);
  };
  const scan = async (camera: boolean) => {
    if (!isIngredientOcrAvailable()) { setError(t("Camera text recognition runs in the iPhone or iPad build. In this browser preview, use manual ingredient entry or product search.")); return; }
    const operation = ++currentOperation.current; setBusy(true); setError(''); let imageUri: string | undefined;
    try {
      if (camera) { const permission = await ImagePicker.requestCameraPermissionsAsync(); if (!permission.granted) throw new Error(t("Camera access is off. You can enable it in Settings, choose a photo, or enter ingredients manually.")); }
      const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true });
      if (result.canceled) return;
      imageUri = result.assets[0].uri;
      const recognition = await recognizeIngredientImage(imageUri);
      if (operation !== currentOperation.current) return;
      setCatalogProduct(false);
      setPhoto({ uri: imageUri, width: result.assets[0].width, height: result.assets[0].height, recognition }); imageUri = undefined;
    } catch (e) { setError(e instanceof Error ? e.message : 'The label could not be read. Try better lighting or enter ingredients manually.'); }
    finally { if (imageUri) { try { const photo = new File(imageUri); if (photo.exists) photo.delete(); } catch { /* OS may already have removed the picker cache. */ } } setBusy(false); }
  };
  const disposePhoto = () => { if (photo) { try { const file = new File(photo.uri); if (file.exists) file.delete(); } catch {} } setPhoto(null); };
  const usePhotoRegion = (region: Region) => { if (!photo) return; const selected = selectRecognizedRegion(photo.recognition, region); setLabel(selected.text); parseLabel(selected.text, selected.confidence); disposePhoto(); };
  const search = async (page = 1) => {
    const operation = ++currentOperation.current; setBusy(true); setError(''); setSearched(false);
    try {
      const q = query.trim();
      const result = /^\d{8,14}$/.test(q) ? await lookupBarcode(q).then(p => p ? [p] : []) : await searchProducts(q, { page, country: productCountry || undefined });
      if (operation === currentOperation.current) {
        setProducts(previous => {
          const candidates = [...(page === 1 ? localMatches.products : previous), ...result];
          const seen = new Set<string>();
          return candidates.filter(p => { const key = p.barcode || p.id || p.sourceUrl; if (seen.has(key)) return false; seen.add(key); return true; });
        });
        setOnlinePage(page); setSearched(true);
      }
    } catch (e) { if (operation === currentOperation.current) setError(e instanceof Error ? e.message : 'Product search is unavailable.'); }
    finally { if (operation === currentOperation.current) setBusy(false); }
  };
  useEffect(() => {
    if (mode !== 'product') { setProducts([]); return; }
    ++currentOperation.current; setBusy(false); setSearched(false); setOnlinePage(0); setLocalLimit(12); setError('');
    setProducts(mode === 'product' ? searchLocalProducts(query, { limit: 12, country: productCountry || undefined }).products : []);
    return () => { ++currentOperation.current; };
  }, [query, mode, productCountry]);
  const showMoreSavedProducts = () => {
    const limit = localLimit + 12; setLocalLimit(limit);
    setProducts(previous => [...searchLocalProducts(query, { limit, country: productCountry || undefined }).products, ...previous.filter(p => p.sourceLabel === 'Open Food Facts')]);
  };
  const chooseProduct = async (p: CatalogProduct) => {
    ++currentOperation.current; setError('');
    setCatalogSource({ name: p.name, url: p.sourceUrl, label: p.sourceLabel ?? 'Published product record' });
    setBusy(false);
    setProductCode(p.barcode || undefined); setExcludedComponents(p.labels.filter(label => /^(?:gluten|lactose)[ -]free$/i.test(label)).map(label => label.split(/[ -]/)[0].toLowerCase())); setName(p.name); setNotes([p.brands, t("Product data: {0}", [p.sourceUrl]), p.attribution, p.country ? t("Market: {0}", [p.country]) : ''].filter(Boolean).join('\n'));
    setLabel(p.ingredientsText || ''); setCatalogProduct(true); setBarcodeNeedsLabel(false); setProducts([]); setScannerOpen(false);
    if (p.ingredients.length) {
      setMode('scan');
      const allergens = [...new Set(p.allergens)];
      const traces = [...new Set(p.traces)];
      setIngredients(ingredientsFromNames(expandIngredientNames(p.ingredients.map(item => item.name)), p.ingredientConfidence ?? 'confirmed', personalCatalog));
      setWarnings([...p.warnings, ...(allergens.length ? [t("Allergen statement (separate from ingredients): {0}.", [allergens.join(', ')])] : []), ...(traces.length ? [t("May contain: {0}. This is a trace warning, not confirmed consumption.", [traces.join(', ')])] : [])]);
      setSource('label'); setReview(true);  setError('');
    } else if (p.ingredientsText) { setMode('scan'); parseLabel(p.ingredientsText, undefined, p); }
    else { scanLock.current = false; setMode('barcode'); setCatalogProduct(false); setBarcodeNeedsLabel(true); setWarnings(p.warnings); setError(''); setReview(false); }
  };
  const findBarcode = async (raw: string, fromCamera = false) => {
    const code = raw.replace(/[^0-9]/g, '');
    setBarcode(code);
    if (scanLock.current || busy) return;
    scanLock.current = true;
    if (fromCamera) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const operation = ++currentOperation.current;
    setBusy(true); setError(''); setWarnings([]); setBarcodeNeedsLabel(false); setCatalogSource(undefined);
    try {
      const product = await lookupBarcode(code);
      if (operation !== currentOperation.current) return;
      if (!product) { setScannerOpen(false); setBarcodeNeedsLabel(true); setError(''); scanLock.current = false; return; }
      await chooseProduct(product);
    } catch (e) {
      if (operation === currentOperation.current) { setScannerOpen(false); setBarcodeNeedsLabel(true); setError(e instanceof Error ? e.message : 'The barcode could not be looked up.'); }
      scanLock.current = false;
    } finally { if (operation === currentOperation.current) setBusy(false); }
  };
  const openBarcodeScanner = async () => {
    setError(''); scanLock.current = false;
    if (Platform.OS === 'web') { setError(t("Live barcode scanning is available in the iPhone and iPad app. Enter the barcode number below in this browser preview.")); return; }
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission.granted) { setError(t("Camera access is off. Enable it in Settings, enter the barcode number, or log the product manually.")); return; }
    setScannerOpen(true);
  };
  const onBarcodeScanned = (result: BarcodeScanningResult) => { void findBarcode(result.data, true); };
  const photographMissingBarcodeLabel = () => { setMode('scan'); setCatalogProduct(false); setBarcodeNeedsLabel(false); setError(''); void scan(true); };
  const enterMissingBarcodeIngredients = () => { setMode('type'); setCatalogProduct(false); setBarcodeNeedsLabel(false); setIngredients([]); setSource('typed'); setReview(true);  setError(''); };
  const addIngredientRecord = (record: { id: string; name: string }) => {
    setIngredients(items => [...items.filter(item => item.id !== record.id), { id: record.id, name: record.name, confidence: 'confirmed' }]);
    setNewIngredient(''); setPendingIngredient(''); setIngredientSuggestions([]); setError('');
  };
  const proposeIngredient = () => {
    const value = newIngredient.trim();
    if (!value) return;
    const exact = findIngredientRecord(value, personalCatalog);
    if (!personalCatalog.some(record => record.id === exact?.id)) {
      const entry = resolveIngredientEntry(value);
      if (entry.recognised && entry.ingredients.length) {
        setIngredients(items => [...items.filter(item => !entry.ingredients.some(candidate => candidate.id === item.id)), ...entry.ingredients.map(candidate => items.find(item => item.id === candidate.id && item.confidence === 'confirmed') ?? candidate)]);
        if (entry.explanation) setWarnings(items => [...items, entry.explanation!]);
        setNewIngredient(''); setPendingIngredient(''); setIngredientSuggestions([]); setError(''); return;
      }
    }
    if (exact) { addIngredientRecord(exact); return; }
    setPendingIngredient(value);
    setIngredientSuggestions(suggestIngredientRecords(value, 5, personalCatalog));
  };
  const addPersonalIngredient = async () => {
    const name = pendingIngredient.trim();
    if (!name) return;
    const id = `custom-${normalizeIngredientText(name).replace(/[^a-z0-9]+/g, '-')}`;
    const definition = { id, name, aliases: [normalizeIngredientText(name)] };
    setBusy(true);
    try { if (onAddCustomIngredient) await onAddCustomIngredient(definition); addIngredientRecord(definition); }
    catch { setError(t("The personal ingredient could not be saved.")); }
    finally { setBusy(false); }
  };
  const save = async (keepAdding = false) => {
    setError('');
    if (!name.trim()) { setError(t("Give this food or drink a name.")); return; }
    if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now()) { setError(t("Choose a valid time in the past.")); return; }
    if (!review) { setError(t("Review the ingredients before saving.")); return; }
    setBusy(true);
    try { await onSave({ id: initial?.id || uid(), name: name.trim(), kind, eatenAt: date.toISOString(), ingredients, source, groupName: groupName === 'Ungrouped' ? undefined : groupName, groupId: groupName === 'Ungrouped' ? undefined : `${localDateKey(date)}:${groupName}`, productCode, excludedComponents, notes: notes.trim(), labelText: source === 'label' ? label.trim() || undefined : undefined }); if (keepAdding) { setName(''); setIngredients([]); setLabel(''); setNotes(''); setBarcode(''); setMode('barcode'); setVariant(''); setQuery(''); resetReview(); } else onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Your entry could not be saved. Please try again.'); }
    finally { setBusy(false); }
  };
  return <Sheet title={tx(contextLocked ? 'Edit copied item' : initial ? t("Edit {0}", [kind]) : 'What did you eat or drink?')} subtitle={tx(contextLocked ? 'Check the ingredients and portion for this new serving.' : 'A little detail now makes your patterns more useful.')} onClose={onClose}>
    {!contextLocked && <><T style={{ fontFamily: F.semi }}>{t("Add to a meal")}</T><Row style={{ flexWrap: 'wrap', gap: 7 }}>{['Ungrouped', 'Breakfast', 'Lunch', 'Dinner', 'Snack'].map(group => <Chip key={group} label={tx(group)} selected={groupName === group} onPress={() => setGroupName(group)} />)}</Row></>}<Row style={{ gap: 8 }}><Chip label={t("Food")} selected={kind === 'food'} onPress={() => setKind('food')} /><Chip label={t("Drink")} selected={kind === 'drink'} onPress={() => setKind('drink')} /></Row>
    {!initial && <Row style={{ flexWrap: 'wrap', gap: 8 }}>{(['barcode', 'type', 'scan', 'product'] as const).map(m => <Chip key={m} label={tx(m === 'barcode' ? 'Scan barcode' : m === 'type' ? 'Log manually' : m === 'scan' ? 'Scan ingredients' : 'Search by brand')} selected={mode === m} onPress={() => { setMode(m); resetReview(); }} />)}</Row>}
    {mode === 'barcode' && !review && <>
      <Notice>{t("Scan the barcode on a packet. Bellywise retrieves that product’s published ingredient list from Open Food Facts, then separates compound ingredients for individual review and pattern checks. It never guesses ingredients from the product name.")}</Notice>
      {scannerOpen ? <View style={{ height: 270, borderRadius: 20, overflow: 'hidden', backgroundColor: '#17251E' }}>
        <CameraView active style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'itf14'] }} onBarcodeScanned={busy ? undefined : onBarcodeScanned} onMountError={() => { setScannerOpen(false); setError(t("The camera could not start. Enter the barcode number below instead.")); }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 30, right: 30, top: 72, height: 112, borderWidth: 2, borderColor: '#F4F4E9', borderRadius: 16 }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 17, alignItems: 'center' }}><T style={{ color: '#fff', fontSize: 12, backgroundColor: '#10281BCC', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 }}>{busy ? 'Finding this product…' : 'Hold the barcode inside the frame'}</T></View>
      </View> : <Button label={t("Open barcode scanner")} icon={ScanLine} onPress={openBarcodeScanner} busy={busy} />}
      <T muted style={{ textAlign: 'center', fontSize: 11 }}>{t("or enter the digits printed beneath it")}</T>
      <Field label={t("Barcode number")} value={barcode} onChangeText={value => { setBarcode(value.replace(/[^0-9]/g, '')); setBarcodeNeedsLabel(false); setError(''); scanLock.current = false; }} placeholder={t("8, 12, 13 or 14 digits")} keyboardType="number-pad" returnKeyType="search" onSubmitEditing={() => void findBarcode(barcode)} maxLength={14} />
      <Button label={t("Look up this barcode")} icon={Search} variant="secondary" onPress={() => void findBarcode(barcode)} busy={busy} disabled={!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(barcode)} />
      {barcodeNeedsLabel && <Card style={{ backgroundColor: '#FBEEE4' }}><T style={{ fontFamily: F.semi }}>{t("The ingredients couldn’t be confirmed for {0}.", [catalogSource?.name || 'this product'])}</T><T muted style={{ fontSize: 12 }}>{t("Photograph the ingredients list on the packet, or enter verified ingredients manually. A menu name or allergen warning alone is not a complete ingredients list.")}</T><Button label={t("Photograph ingredients list")} icon={Camera} onPress={photographMissingBarcodeLabel} /><Button label={t("Enter ingredients manually")} icon={FileText} variant="secondary" onPress={enterMissingBarcodeIngredients} /></Card>}
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://world.openfoodfacts.org')}><T muted style={{ fontSize: 11 }}>{t("Product data: Open Food Facts contributors · Open Database License (ODbL)")}</T></Pressable>
    </>}
    {mode === 'product' && <>
      <Notice>{t("Type a brand to see saved products straight away. Choose the right country and variety. For more results, search Open Food Facts; only your search is sent, and your diary stays on this device.")}</Notice>
      <Field label={t("Brand or product name")} value={query} onChangeText={setQuery} placeholder={t("e.g. Dolmio, McDonald's, KFC")} returnKeyType="search" onSubmitEditing={() => void search()} />
      {brandSuggestions.length > 0 && <Row style={{ flexWrap: 'wrap', gap: 7 }}>{brandSuggestions.map(brand => <Chip key={brand.key} label={tx(brand.name)} onPress={() => setQuery(brand.name)} />)}</Row>}
      <MarketPicker value={productCountry} onChange={setProductCountry} />
      <Button label={t("Search more products online")} icon={Search} onPress={() => void search()} busy={busy} disabled={query.trim().length < 2} />
      {localMatches.total > 0 && <T muted style={{ fontSize: 12 }}>{t("{0} matching saved products · showing up to {1}", [localMatches.total, localLimit])}</T>}
      {products.map(p => <Pressable key={p.id || p.barcode || p.sourceUrl} accessibilityRole="button" disabled={busy} onPress={() => void chooseProduct(p)} style={{ padding: 16, borderWidth: 1, borderColor: C.line, borderRadius: 14, gap: 5 }}><T style={{ fontFamily: F.semi }}>{p.name}</T><T muted style={{ fontSize: 12 }}>{p.brands || p.barcode} · {p.country || 'Market not provided'}</T><T muted style={{ fontSize: 11 }}>{p.sourceLabel} · {p.ingredientsText ? 'Published ingredients available' : 'Label needed'}</T></Pressable>)}
      {localMatches.total > localLimit && <Button label={t("Show more saved products")} variant="secondary" onPress={showMoreSavedProducts} disabled={busy} />}
      {onlinePage > 0 && <Button label={t("More online results")} variant="secondary" onPress={() => void search(onlinePage + 1)} busy={busy} />}
      {query.trim().length >= 2 && products.length === 0 && <T muted>{searched ? 'No matching products. Try another country, or scan the barcode or ingredients list.' : 'No saved products for this search and country. Search online, or scan the barcode or ingredients list.'}</T>}
      <T muted style={{ fontSize: 11 }}>{t("Saved products: USDA FoodData Central. Online results: Open Food Facts contributors · ODbL. Ingredient lists can change; check your exact product.")}</T>
    </>}
    {(mode !== 'product' || review) && <>
      {(mode !== 'barcode' || review) && <Field label={tx(kind === 'drink' ? 'Drink' : 'Food or meal')} value={name} onChangeText={v => { setName(v); if (mode === 'type' && !contextLocked) { setVariant(''); resetReview(); } }} placeholder={tx(kind === 'drink' ? 'e.g. oat latte, beer, orange juice' : 'e.g. bread, spaghetti bolognese')} maxLength={300} />}
      {mode === 'type' && !review && <>{foodSuggestions.length > 0 && <View style={{ gap: 8 }}><T muted>{t("Did you mean?")}</T><Row style={{ flexWrap: 'wrap' }}>{foodSuggestions.map(suggestion => <Chip key={suggestion} label={tx(suggestion)} onPress={() => { setName(suggestion); setVariant(''); }} />)}</Row></View>}{resolution.questions.map(q => <View key={q.id} style={{ gap: 9 }}><T style={{ fontFamily: F.medium }}>{q.prompt}</T><Row style={{ flexWrap: 'wrap', gap: 8 }}>{q.options.map(o => <Chip key={o.id} label={tx(o.label)} selected={variant === o.id} onPress={() => setVariant(o.id)} />)}</Row></View>)}{name.length > 1 && <T muted style={{ fontSize: 12 }}>{resolution.description}</T>}<Button label={t("Review ingredients")} icon={CheckCheck} disabled={!name.trim()} onPress={showTyped} /></>}
      {mode === 'scan' && !catalogProduct && <><Row><Button label={t("Take photo")} icon={Camera} onPress={() => scan(true)} busy={busy} style={{ flex: 1 }} /><Button label={t("Choose photo")} icon={ImageIcon} variant="secondary" onPress={() => scan(false)} disabled={busy} style={{ flex: 1 }} /></Row><T muted style={{ fontSize: 12 }}>{t("After taking a photo, draw a box around just the ingredients list.")}</T></>}
      {mode === 'scan' && !catalogProduct && <T muted style={{ fontSize: 11 }}>{t('Camera text recognition depends on the languages supported by your version of iOS. You can always scan a barcode or enter ingredients manually.')}</T>}
      {warnings.map((w, i) => <Notice warm key={i}>{w}</Notice>)}
      {catalogSource && <Pressable accessibilityRole="link" onPress={() => Linking.openURL(catalogSource.url)}><T style={{ color: C.green, fontSize: 12, textDecorationLine: 'underline' }}>{t("View source: {0} · {1}", [catalogSource.label, catalogSource.name])}</T></Pressable>}
      {review && <><Row style={{ justifyContent: 'space-between' }}><T style={{ fontFamily: F.semi }}>{t("Review each ingredient")}</T><Pill label={t("{0} ingredients", [ingredients.length])} /></Row><T muted style={{ fontSize: 12 }}>{t("Recognised meal ingredients and label ingredients start confirmed. Meal recipes can vary: remove anything you didn’t consume, add anything missing, or unconfirm any item you’re unsure about.")}</T>
        {ingredients.length === 0 && <Notice>{t("No ingredients yet. You can add them below, or save this entry by name. Unknown ingredients cannot contribute to ingredient patterns.")}</Notice>}
        <View style={{ gap: 4 }}>{ingredients.map((ingredient, i) => <Row key={`${ingredient.id}-${i}`} style={{ paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.line }}><Pressable accessibilityRole="button" accessibilityLabel={t("About {0}", [ingredient.name])} onPress={() => setIngredientInfoId(ingredient.id)} style={{ flex: 1 }}><T style={{ fontSize: 13, color: C.green, textDecorationLine: 'underline' }}>{ingredientDisplayName(ingredient.id, ingredient.name)}</T><T muted style={{ fontSize: 10 }}>{t("{0} · Tap for details", [ingredient.confidence === 'confirmed' ? 'Confirmed ingredient' : 'Suggested · not yet confirmed'])}</T></Pressable><Pressable accessibilityRole="button" onPress={() => setIngredients(xs => xs.map((x, j) => j === i ? { ...x, confidence: x.confidence === 'confirmed' ? 'inferred' : 'confirmed' } : x))} style={{ padding: 9 }}><T style={{ fontSize: 11, color: C.green }}>{ingredient.confidence === 'confirmed' ? 'Unconfirm' : 'Confirm'}</T></Pressable><IconButton icon={X} label={t("Remove {0}", [ingredient.name])} onPress={() => setIngredients(xs => xs.filter((_, j) => j !== i))} /></Row>)}</View>
        {ingredientInfoId && (() => { const info = getIngredientInfo(ingredientInfoId, ingredients.find(item => item.id === ingredientInfoId)?.name); return <Sheet title={ingredientDisplayName(info.id, info.name)} onClose={() => setIngredientInfoId(null)}><T>{info.whatItIs}</T><T style={{ fontFamily: F.semi, marginTop: 8 }}>{t("Where it is found")}</T><T>{info.whereFound}</T><T style={{ fontFamily: F.semi, marginTop: 8 }}>{t("Symptoms and context")}</T><T style={{ fontFamily: F.semi }}>{info.triggerSummary}</T>{info.commonSymptoms.length > 0 && <T>{t("Commonly reported: {0}", [info.commonSymptoms.map(text => t(text)).join(' · ')])}</T>}<T>{info.symptomContext}</T>{info.sourceUrl && <Pressable accessibilityRole="link" onPress={() => Linking.openURL(info.sourceUrl!)}><T style={{ color: C.green, textDecorationLine: 'underline', marginTop: 8 }}>{info.sourceTitle || 'Read source'}</T></Pressable>}</Sheet>; })()}
        <Row><View style={{ flex: 1 }}><Field value={newIngredient} onChangeText={value => { setNewIngredient(value); setPendingIngredient(''); setIngredientSuggestions([]); }} placeholder={t("Add an ingredient you know")} maxLength={160} /></View><IconButton icon={Plus} label={t("Check and add ingredient")} onPress={proposeIngredient} /></Row>
        {!!pendingIngredient && <Card style={{ backgroundColor: '#FBEEE4' }}><T style={{ fontFamily: F.semi }}>{t("“{0}” was not found in the ingredient catalogue.", [pendingIngredient])}</T>{ingredientSuggestions.length > 0 ? <><T muted style={{ fontSize: 12 }}>{t("Did you mean one of these?")}</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{ingredientSuggestions.map(item => <Chip key={item.id} label={ingredientDisplayName(item.id, item.name)} onPress={() => addIngredientRecord(item)} />)}</View></> : <T muted style={{ fontSize: 12 }}>{t("No close catalogue matches were found.")}</T>}<Button label={t("Add “{0}” anyway", [pendingIngredient])} variant="secondary" onPress={() => void addPersonalIngredient()} busy={busy} /><T muted style={{ fontSize: 10 }}>{t("This creates a personal catalogue ingredient on this device. Check spelling first; personal entries do not provide medical evidence.")}</T></Card>}
        {!contextLocked && <DateField value={date} onChange={setDate} label={t("Had at")} />}<Field label={tx(kind === 'drink' ? 'Amount & notes (optional)' : 'Portion & notes (optional)')} value={notes} onChangeText={setNotes} placeholder={tx(kind === 'drink' ? 'e.g. 250 ml, decaf; with oat milk or a mixer' : 'e.g. two slices, with butter; homemade')} multiline maxLength={10000} />
        <Button label={tx(contextLocked ? 'Save item changes' : initial ? 'Save changes' : groupName === 'Ungrouped' ? 'Add to my journal' : t("Save to {0}", [groupName.toLowerCase()]))} icon={Check} onPress={() => void save()} busy={busy} />
        {!initial && groupName !== 'Ungrouped' && <Button label={t("Save & add another to {0}", [groupName.toLowerCase()])} variant="secondary" onPress={() => void save(true)} busy={busy} />}
        {expandIngredientExposuresForAnalysis(ingredients, [name, ...excludedComponents.map(id => id + '-free')].join(' ')).filter(item => item.derivedFrom && !ingredients.some(i => i.id === item.id)).map(item => <Notice key={item.id}>{t("Also checked in patterns: {0} (derived from {1}). This is a component estimate, not an extra word from the label.", [item.name, ingredients.find(i => i.id === item.derivedFrom)?.name])}</Notice>)}
      </>}
    </>}
    {photo && <PhotoRegion uri={photo.uri} width={photo.width} height={photo.height} onCancel={disposePhoto} onConfirm={usePhotoRegion} />}
    {!!error && <Notice warm>{error}</Notice>}
    {initial && onDelete && <><Button label={tx(deleteCheck ? t("Yes, delete this {0} entry", [kind]) : t("Delete {0} entry", [kind]))} icon={Trash2} variant="danger" onPress={async () => { if (!deleteCheck) { setDeleteCheck(true); return; } try { await onDelete(); onClose(); } catch { setError(t("Could not delete the entry.")); } }} />{deleteCheck && <T muted style={{ fontSize: 12 }}>{t("This removes the entry from your journal and recalculates patterns.")}</T>}</>}
  </Sheet>;
}

export function SymptomForm({ definitions, selectedIds, initial, draft, selectedDay, onSave, onDelete, onClose, onManage }: { definitions: SymptomDefinition[]; selectedIds: string[]; initial?: SymptomLog; draft?: SymptomLog; selectedDay?: string; onSave: (s: SymptomLog) => Promise<void>; onDelete?: () => Promise<void>; onClose: () => void; onManage: (draft: SymptomLog) => void }) {
  const [kind, setKind] = useState<'negative' | 'positive'>(definitions.find(d => d.id === (draft ?? initial)?.symptomId)?.kind || 'negative');
  const [selected, setSelected] = useState((draft ?? initial)?.symptomId || '');
  const [severity, setSeverity] = useState<Level>((draft ?? initial)?.severity || 2);
  const [date, setDate] = useState(() => (draft ?? initial) ? new Date((draft ?? initial)!.occurredAt) : defaultEntryDate(selectedDay));
  const [notes, setNotes] = useState((draft ?? initial)?.notes || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const shown = definitions.filter(d => d.kind === kind && (selectedIds.includes(d.id) || d.id === selected));
  const save = async () => {
    if (!selected) { setError(t("Choose a symptom or positive feeling first.")); return; }
    if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now()) { setError(t("Choose a valid time in the past.")); return; }
    setBusy(true);
    try { await onSave({ id: initial?.id || uid(), symptomId: selected, severity, occurredAt: date.toISOString(), notes: notes.trim() }); onClose(); }
    catch { setError(t("This entry could not be saved. Please try again.")); }
    finally { setBusy(false); }
  };
  return <Sheet title={tx(initial ? 'Edit how you felt' : 'How are you feeling?')} subtitle={t("The good days matter, too.")} onClose={onClose}>
    <Row><Chip label={t("A symptom")} selected={kind === 'negative'} onPress={() => { setKind('negative'); setSelected(''); }} /><Chip label={t("Something positive")} selected={kind === 'positive'} onPress={() => { setKind('positive'); setSelected(''); }} /></Row>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>{shown.map(d => <Chip key={d.id} label={tx(d.name)} selected={selected === d.id} onPress={() => setSelected(d.id)} />)}</View>
    {shown.length === 0 && <T muted>{t("You haven’t selected any {0} to track yet.", [kind === 'positive' ? 'positive feelings' : 'symptoms'])}</T>}
    <Button label={t("Choose symptoms or add your own")} icon={Plus} variant="ghost" onPress={() => onManage({ id: initial?.id || uid(), symptomId: selected, severity, occurredAt: date.toISOString(), notes })} />
    <T style={{ fontFamily: F.semi }}>{kind === 'positive' ? 'How noticeable was it?' : 'How intense was it?'}</T>
    <Row style={{ justifyContent: 'space-between' }}>{([1, 2, 3, 4, 5] as Level[]).map(v => <Pressable key={v} accessibilityRole="button" accessibilityLabel={t("{0} of 5", [v])} accessibilityState={{ selected: severity === v }} onPress={() => setSeverity(v)} style={{ width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: severity === v ? (kind === 'positive' ? C.green : C.orange) : C.bg, borderWidth: 1, borderColor: severity === v ? 'transparent' : C.line }}><T style={{ color: severity === v ? '#fff' : C.muted, fontFamily: F.semi }}>{v}</T></Pressable>)}</Row>
    <Row style={{ justifyContent: 'space-between', marginTop: -12 }}><T muted style={{ fontSize: 11 }}>{t("Slight")}</T><T muted style={{ fontSize: 11 }}>{t("Very strong")}</T></Row>
    <DateField value={date} onChange={setDate} label={t("Felt at")} /><Field label={t("Anything else? (optional)")} value={notes} onChangeText={setNotes} placeholder={t("Duration, activity, medication, or anything unusual…")} multiline />
    <Notice>{kind === 'positive' ? 'Positive feelings are analysed separately. A comfortable day does not prove a food is safe for an allergy or coeliac disease.' : 'If you have trouble breathing, sudden mouth or throat swelling, or feel faint after eating, seek emergency help now. Don’t wait for a pattern.'}</Notice>
    {!!error && <Notice warm>{error}</Notice>}<Button label={tx(initial ? 'Save changes' : 'Save how I feel')} icon={Check} onPress={save} busy={busy} />
    {onDelete && <Button label={tx(deleting ? 'Yes, delete this entry' : 'Delete entry')} icon={Trash2} variant="danger" onPress={async () => { if (!deleting) { setDeleting(true); return; } try { await onDelete(); onClose(); } catch { setError(t("Could not delete the entry.")); } }} />}
  </Sheet>;
}
