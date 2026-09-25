import React, { useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, Switch, View } from 'react-native';
import { Camera, Check, CheckCheck, FileText, Plus, Search, Trash2, X, Image as ImageIcon, ScanLine } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { File } from 'expo-file-system';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { T, C, F, Row, Button, Field, Notice, Chip, Pill, Sheet, IconButton, Card } from './ui';
import { DateField } from './DateField';
import { resolveFood, ingredientsFromNames, localDateKey, getIngredientInfo, findIngredientRecord, suggestIngredientRecords, normalizeIngredientText } from '../domain';
import type { CustomIngredientDefinition, IngredientExposure, Level, Meal, SymptomDefinition, SymptomLog } from '../domain/types';
import { expandIngredientNames, parseIngredientLabel } from '../services/labelParser';
import { isIngredientOcrAvailable, recognizeIngredientImage } from '../services/ocr';
import { lookupBarcode, searchProducts, type CatalogProduct } from '../services/products';

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
function defaultEntryDate(selectedDay?: string): Date {
  const now = new Date();
  if (!selectedDay || selectedDay === localDateKey(now)) return now;
  const noon = new Date(`${selectedDay}T12:00:00`);
  return Number.isFinite(noon.getTime()) ? noon : now;
}

type MealEntryMode = 'barcode' | 'type' | 'scan' | 'product';

export function MealForm({ initial, selectedDay, customIngredients = [], onAddCustomIngredient, onClose, onSave, onDelete, initialMode = 'barcode' }: { initial?: Meal; selectedDay?: string; customIngredients?: CustomIngredientDefinition[]; onAddCustomIngredient?: (ingredient: CustomIngredientDefinition) => Promise<void>; onClose: () => void; onSave: (meal: Meal) => Promise<void>; onDelete?: () => Promise<void>; initialMode?: MealEntryMode }) {
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
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newIngredient, setNewIngredient] = useState('');
  const [source, setSource] = useState<Meal['source']>(initial?.source || 'typed');
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [searched, setSearched] = useState(false);
  const [confirmed, setConfirmed] = useState(!!initial);
  const [deleteCheck, setDeleteCheck] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [barcodeNeedsLabel, setBarcodeNeedsLabel] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [ingredientInfoId, setIngredientInfoId] = useState<string | null>(null);
  const [pendingIngredient, setPendingIngredient] = useState('');
  const [ingredientSuggestions, setIngredientSuggestions] = useState<{ id: string; name: string }[]>([]);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const resolution = useMemo(() => resolveFood(name, variant || undefined), [name, variant]);
  const personalCatalog = useMemo(() => customIngredients.map(item => ({ ...item })), [customIngredients]);
  const currentOperation = useRef(0);
  const scanLock = useRef(false);
  const resetReview = () => { setReview(false); setConfirmed(false); setError(''); setWarnings([]); setScannerOpen(false); setCatalogProduct(false); setBarcodeNeedsLabel(false); scanLock.current = false; };
  const showTyped = () => { setIngredients(resolution.ingredients); setReview(true); setWarnings(resolution.matched ? [] : ['This food or drink is not in the offline recipe guide. Add its ingredients, or save the entry without ingredient assumptions.']); setSource('typed'); setConfirmed(false); };
  const parseLabel = (text = label, confidence?: number, product?: CatalogProduct) => {
    const parsed = parseIngredientLabel(text, { source: product ? 'catalog' : 'ocr', ocrConfidence: confidence, customIngredients: personalCatalog });
    const allergens = [...new Set([...parsed.allergens, ...(product?.allergens ?? [])])];
    const traces = [...new Set([...parsed.mayContain, ...(product?.traces ?? [])])];
    setWarnings([...parsed.warnings, ...(product?.warnings ?? []), ...(allergens.length ? [`Allergen statement (separate from ingredients): ${allergens.join(', ')}.`] : []), ...(traces.length ? [`May contain: ${traces.join(', ')}. This is a trace warning, not confirmed consumption.`] : [])]);
    if (!parsed.ingredients.length) {
      if (product) { setMode('barcode'); setCatalogProduct(false); setBarcodeNeedsLabel(true); setError(''); }
      else setError('No clear run of catalogue ingredients was found. Retake the photo closer to the list, or review and add the ingredients manually.');
      setReview(false); return;
    }
    setError(''); setIngredients(ingredientsFromNames(expandIngredientNames(parsed.ingredients), 'inferred', personalCatalog)); setSource('label'); setReview(true); setConfirmed(false);
  };
  const scan = async (camera: boolean) => {
    if (!isIngredientOcrAvailable()) { setError('Camera text recognition runs in the iPhone or iPad build. In this browser preview, paste a label below to try the ingredient parser.'); return; }
    setBusy(true); setError(''); let imageUri: string | undefined;
    try {
      if (camera) { const permission = await ImagePicker.requestCameraPermissionsAsync(); if (!permission.granted) throw new Error('Camera access is off. You can enable it in Settings, choose a photo, or paste a label.'); }
      const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true });
      if (result.canceled) return;
      imageUri = result.assets[0].uri;
      const recognition = await recognizeIngredientImage(imageUri);
      setCatalogProduct(false);
      setLabel(recognition.text); parseLabel(recognition.text, recognition.confidence);
    } catch (e) { setError(e instanceof Error ? e.message : 'The label could not be read. Try better lighting or paste the text.'); }
    finally { if (imageUri) { try { const photo = new File(imageUri); if (photo.exists) photo.delete(); } catch { /* OS may already have removed the picker cache. */ } } setBusy(false); }
  };
  const search = async () => {
    const operation = ++currentOperation.current; setBusy(true); setError(''); setSearched(false);
    try {
      const q = query.trim();
      const result = /^\d{8,14}$/.test(q) ? await lookupBarcode(q).then(p => p ? [p] : []) : await searchProducts(q);
      if (operation === currentOperation.current) { setProducts(result); setSearched(true); }
    } catch (e) { if (operation === currentOperation.current) setError(e instanceof Error ? e.message : 'Product search is unavailable.'); }
    finally { if (operation === currentOperation.current) setBusy(false); }
  };
  const chooseProduct = (p: CatalogProduct) => {
    setName(p.name); setNotes([p.brands, `Product data: ${p.sourceUrl}`, 'Open Food Facts · ODbL'].filter(Boolean).join('\n'));
    setLabel(p.ingredientsText || ''); setCatalogProduct(true); setBarcodeNeedsLabel(false); setProducts([]); setScannerOpen(false);
    if (p.ingredients.length) {
      setMode('scan');
      const allergens = [...new Set(p.allergens)];
      const traces = [...new Set(p.traces)];
      setIngredients(ingredientsFromNames(p.ingredients.map(item => item.name), 'inferred', personalCatalog));
      setWarnings([...p.warnings, ...(allergens.length ? [`Allergen statement (separate from ingredients): ${allergens.join(', ')}.`] : []), ...(traces.length ? [`May contain: ${traces.join(', ')}. This is a trace warning, not confirmed consumption.`] : [])]);
      setSource('label'); setReview(true); setConfirmed(false); setError('');
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
    setBusy(true); setError(''); setWarnings([]); setBarcodeNeedsLabel(false);
    try {
      const product = await lookupBarcode(code);
      if (operation !== currentOperation.current) return;
      if (!product) { setScannerOpen(false); setBarcodeNeedsLabel(true); setError(''); scanLock.current = false; return; }
      chooseProduct(product);
    } catch (e) {
      if (operation === currentOperation.current) setError(e instanceof Error ? e.message : 'The barcode could not be looked up.');
      scanLock.current = false;
    } finally { if (operation === currentOperation.current) setBusy(false); }
  };
  const openBarcodeScanner = async () => {
    setError(''); scanLock.current = false;
    if (Platform.OS === 'web') { setError('Live barcode scanning is available in the iPhone and iPad app. Enter the barcode number below in this browser preview.'); return; }
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission.granted) { setError('Camera access is off. Enable it in Settings, enter the barcode number, or log the product manually.'); return; }
    setScannerOpen(true);
  };
  const onBarcodeScanned = (result: BarcodeScanningResult) => { void findBarcode(result.data, true); };
  const photographMissingBarcodeLabel = () => { setMode('scan'); setCatalogProduct(false); setBarcodeNeedsLabel(false); setError(''); void scan(true); };
  const enterMissingBarcodeIngredients = () => { setMode('type'); setCatalogProduct(false); setBarcodeNeedsLabel(false); setIngredients([]); setSource('typed'); setReview(true); setConfirmed(false); setError(''); };
  const addIngredientRecord = (record: { id: string; name: string }) => {
    setIngredients(items => [...items.filter(item => item.id !== record.id), { id: record.id, name: record.name, confidence: 'confirmed' }]);
    setNewIngredient(''); setPendingIngredient(''); setIngredientSuggestions([]); setError('');
  };
  const proposeIngredient = () => {
    const value = newIngredient.trim();
    if (!value) return;
    const exact = findIngredientRecord(value, personalCatalog);
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
    catch { setError('The personal ingredient could not be saved.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setError('');
    if (!name.trim()) { setError('Give this food or drink a name.'); return; }
    if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now()) { setError('Choose a valid time in the past.'); return; }
    if (!review || !confirmed) { setError('Review the ingredients and confirm before saving.'); return; }
    setBusy(true);
    try { await onSave({ id: initial?.id || uid(), name: name.trim(), kind, eatenAt: date.toISOString(), ingredients, source, notes: notes.trim(), labelText: source === 'label' ? label.trim() || undefined : undefined }); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Your entry could not be saved. Please try again.'); }
    finally { setBusy(false); }
  };
  return <Sheet title={initial ? `Edit ${kind}` : 'What did you eat or drink?'} subtitle="A little detail now makes your patterns more useful." onClose={onClose}>
    <Row style={{ gap: 8 }}><Chip label="Food" selected={kind === 'food'} onPress={() => setKind('food')} /><Chip label="Drink" selected={kind === 'drink'} onPress={() => setKind('drink')} /></Row>
    {!initial && <Row style={{ flexWrap: 'wrap', gap: 8 }}>{(['barcode', 'type', 'scan', 'product'] as const).map(m => <Chip key={m} label={m === 'barcode' ? 'Scan barcode' : m === 'type' ? 'Log manually' : m === 'scan' ? 'Scan ingredients' : 'Search by name'} selected={mode === m} onPress={() => { setMode(m); resetReview(); }} />)}</Row>}
    {mode === 'barcode' && !review && <>
      <Notice>Scan the barcode on a packet. Bellywise retrieves that product’s published ingredient list from Open Food Facts, then separates compound ingredients for individual review and pattern checks. It never guesses ingredients from the product name.</Notice>
      {scannerOpen ? <View style={{ height: 270, borderRadius: 20, overflow: 'hidden', backgroundColor: '#17251E' }}>
        <CameraView active style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'itf14'] }} onBarcodeScanned={busy ? undefined : onBarcodeScanned} onMountError={() => { setScannerOpen(false); setError('The camera could not start. Enter the barcode number below instead.'); }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 30, right: 30, top: 72, height: 112, borderWidth: 2, borderColor: '#F4F4E9', borderRadius: 16 }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 17, alignItems: 'center' }}><T style={{ color: '#fff', fontSize: 12, backgroundColor: '#10281BCC', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 }}>{busy ? 'Finding this product…' : 'Hold the barcode inside the frame'}</T></View>
      </View> : <Button label="Open barcode scanner" icon={ScanLine} onPress={openBarcodeScanner} busy={busy} />}
      <T muted style={{ textAlign: 'center', fontSize: 11 }}>or enter the digits printed beneath it</T>
      <Field label="Barcode number" value={barcode} onChangeText={value => { setBarcode(value.replace(/[^0-9]/g, '')); setBarcodeNeedsLabel(false); setError(''); scanLock.current = false; }} placeholder="8, 12, 13 or 14 digits" keyboardType="number-pad" returnKeyType="search" onSubmitEditing={() => void findBarcode(barcode)} maxLength={14} />
      <Button label="Look up this barcode" icon={Search} variant="secondary" onPress={() => void findBarcode(barcode)} busy={busy} disabled={!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(barcode)} />
      {barcodeNeedsLabel && <Card style={{ backgroundColor: '#FBEEE4' }}><T style={{ fontFamily: F.semi }}>The ingredients couldn’t be confirmed from this barcode.</T><T muted style={{ fontSize: 12 }}>Photograph the ingredients list on the packet, or enter the ingredients manually.</T><Button label="Photograph ingredients list" icon={Camera} onPress={photographMissingBarcodeLabel} /><Button label="Enter ingredients manually" icon={FileText} variant="secondary" onPress={enterMissingBarcodeIngredients} /></Card>}
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://world.openfoodfacts.org')}><T muted style={{ fontSize: 11 }}>Product data: Open Food Facts contributors · Open Database License (ODbL)</T></Pressable>
    </>}
    {mode === 'product' && <><Notice>Search the Open Food Facts catalogue by product name. Only the search is sent to Open Food Facts; your diary stays on your device.</Notice><Field label="Product name" value={query} onChangeText={setQuery} placeholder="e.g. Alpro oat milk" returnKeyType="search" onSubmitEditing={search} /><Button label="Search products" icon={Search} onPress={search} busy={busy} disabled={query.trim().length < 2} />{products.map(p => <Pressable key={p.barcode} accessibilityRole="button" onPress={() => chooseProduct(p)} style={{ padding: 16, borderWidth: 1, borderColor: C.line, borderRadius: 14 }}><T style={{ fontFamily: F.semi }}>{p.name}</T><T muted style={{ fontSize: 12 }}>{p.brands || p.barcode} · {p.ingredientsText ? 'Ingredients available' : 'Label needed'}</T></Pressable>)}{searched && products.length === 0 && <T muted>No matching products. Try scanning its barcode or ingredient label.</T>}<Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://world.openfoodfacts.org')}><T muted style={{ fontSize: 11 }}>Product data: Open Food Facts contributors · Open Database License (ODbL)</T></Pressable></>}
    {mode !== 'product' && <>
      {(mode !== 'barcode' || review) && <Field label={kind === 'drink' ? 'Drink' : 'Food or meal'} value={name} onChangeText={v => { setName(v); if (mode === 'type') { setVariant(''); resetReview(); } }} placeholder={kind === 'drink' ? 'e.g. oat latte, beer, orange juice' : 'e.g. bread, spaghetti bolognese'} maxLength={300} />}
      {mode === 'type' && !review && <>{resolution.questions.map(q => <View key={q.id} style={{ gap: 9 }}><T style={{ fontFamily: F.medium }}>{q.prompt}</T><Row style={{ flexWrap: 'wrap', gap: 8 }}>{q.options.map(o => <Chip key={o.id} label={o.label} selected={variant === o.id} onPress={() => setVariant(o.id)} />)}</Row></View>)}{name.length > 1 && <T muted style={{ fontSize: 12 }}>{resolution.description}</T>}<Button label="Review ingredients" icon={CheckCheck} disabled={!name.trim()} onPress={showTyped} /></>}
      {mode === 'scan' && <>{!catalogProduct && <><Row><Button label="Take photo" icon={Camera} onPress={() => scan(true)} busy={busy} style={{ flex: 1 }} /><Button label="Choose photo" icon={ImageIcon} variant="secondary" onPress={() => scan(false)} disabled={busy} style={{ flex: 1 }} /></Row><T muted style={{ fontSize: 12 }}>Photograph the ingredient panel closely. A heading helps, but is no longer required: Bellywise matches whole phrases against its ingredient catalogue and respects “free from” and “may contain” context.</T></>}<Field label={catalogProduct ? 'Published ingredient label' : 'Label text'} value={label} editable={!catalogProduct} onChangeText={v => { setLabel(v); if (!catalogProduct) resetReview(); }} placeholder="Ingredients: wheat flour, water, yeast, salt…" multiline />{!catalogProduct && <Button label="Find ingredients in text" icon={ScanLine} variant="secondary" onPress={() => parseLabel()} disabled={!label.trim() || busy} />}{catalogProduct && <Notice>The ingredients below come from this product’s structured Open Food Facts record. The label text is shown for comparison; no “ingredients only” toggle is needed.</Notice>}</>}
      {warnings.map((w, i) => <Notice warm key={i}>{w}</Notice>)}
      {review && <><Row style={{ justifyContent: 'space-between' }}><T style={{ fontFamily: F.semi }}>Review each ingredient</T><Pill label={`${ingredients.length} ingredients`} /></Row><T muted style={{ fontSize: 12 }}>Compound ingredients have been separated so Bellywise can check each one independently. Remove anything you didn’t consume. Confirm only after checking the current packet or recipe.</T>
        {ingredients.length === 0 && <Notice>No ingredients yet. You can add them below, or save this entry by name. Unknown ingredients cannot contribute to ingredient patterns.</Notice>}
        <View style={{ gap: 4 }}>{ingredients.map((ingredient, i) => <Row key={`${ingredient.id}-${i}`} style={{ paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.line }}><Pressable accessibilityRole="button" accessibilityLabel={`About ${ingredient.name}`} onPress={() => setIngredientInfoId(ingredient.id)} style={{ flex: 1 }}><T style={{ fontSize: 13, color: C.green, textDecorationLine: 'underline' }}>{ingredient.name}</T><T muted style={{ fontSize: 10 }}>{ingredient.confidence === 'confirmed' ? 'Confirmed by you' : 'Suggested · not yet confirmed'} · Tap for details</T></Pressable><Pressable accessibilityRole="button" onPress={() => setIngredients(xs => xs.map((x, j) => j === i ? { ...x, confidence: x.confidence === 'confirmed' ? 'inferred' : 'confirmed' } : x))} style={{ padding: 9 }}><T style={{ fontSize: 11, color: C.green }}>{ingredient.confidence === 'confirmed' ? 'Unconfirm' : 'Confirm'}</T></Pressable><IconButton icon={X} label={`Remove ${ingredient.name}`} onPress={() => setIngredients(xs => xs.filter((_, j) => j !== i))} /></Row>)}</View>
        {ingredientInfoId && (() => { const info = getIngredientInfo(ingredientInfoId, ingredients.find(item => item.id === ingredientInfoId)?.name); return <Card style={{ backgroundColor: C.pale }}><Row style={{ justifyContent: 'space-between' }}><T style={{ fontFamily: F.semi, fontSize: 16 }}>{info.name}</T><IconButton icon={X} label="Close ingredient details" onPress={() => setIngredientInfoId(null)} /></Row><T>{info.whatItIs}</T><T style={{ fontFamily: F.semi, marginTop: 8 }}>Where it is found</T><T>{info.whereFound}</T><T style={{ fontFamily: F.semi, marginTop: 8 }}>Symptoms and context</T><T style={{ fontFamily: F.semi }}>{info.triggerSummary}</T>{info.commonSymptoms.length > 0 && <T>Commonly reported: {info.commonSymptoms.join(' · ')}</T>}<T>{info.symptomContext}</T>{info.sourceUrl && <Pressable accessibilityRole="link" onPress={() => Linking.openURL(info.sourceUrl!)}><T style={{ color: C.green, textDecorationLine: 'underline', marginTop: 8 }}>{info.sourceTitle || 'Read source'}</T></Pressable>}</Card>; })()}
        <Row><View style={{ flex: 1 }}><Field value={newIngredient} onChangeText={value => { setNewIngredient(value); setPendingIngredient(''); setIngredientSuggestions([]); }} placeholder="Add an ingredient you know" maxLength={160} /></View><IconButton icon={Plus} label="Check and add ingredient" onPress={proposeIngredient} /></Row>
        {!!pendingIngredient && <Card style={{ backgroundColor: '#FBEEE4' }}><T style={{ fontFamily: F.semi }}>“{pendingIngredient}” was not found in the ingredient catalogue.</T>{ingredientSuggestions.length > 0 ? <><T muted style={{ fontSize: 12 }}>Did you mean one of these?</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{ingredientSuggestions.map(item => <Chip key={item.id} label={item.name} onPress={() => addIngredientRecord(item)} />)}</View></> : <T muted style={{ fontSize: 12 }}>No close catalogue matches were found.</T>}<Button label={`Add “${pendingIngredient}” anyway`} variant="secondary" onPress={() => void addPersonalIngredient()} busy={busy} /><T muted style={{ fontSize: 10 }}>This creates a personal catalogue ingredient on this device. Check spelling first; personal entries do not provide medical evidence.</T></Card>}
        {source === 'label' && <Button label="Confirm all" variant="secondary" icon={CheckCheck} onPress={() => { setIngredients(xs => xs.map(x => ({ ...x, confidence: 'confirmed' }))); setConfirmed(true); }} />}
        <DateField value={date} onChange={setDate} label="Had at" /><Field label={kind === 'drink' ? 'Amount & notes (optional)' : 'Portion & notes (optional)'} value={notes} onChangeText={setNotes} placeholder={kind === 'drink' ? 'e.g. 250 ml, decaf; with oat milk or a mixer' : 'e.g. two slices, with butter; homemade'} multiline maxLength={10000} />
        <Row><Switch accessibilityLabel="I have reviewed these ingredients" value={confirmed} onValueChange={setConfirmed} trackColor={{ true: C.green }} /><T style={{ flex: 1, fontSize: 12 }}>I’ve reviewed this entry. Unconfirmed suggestions will stay marked as estimates.</T></Row>
        <Button label={initial ? 'Save changes' : 'Add to my journal'} icon={Check} onPress={save} busy={busy} disabled={!confirmed} />
      </>}
    </>}
    {!!error && <Notice warm>{error}</Notice>}
    {initial && onDelete && <><Button label={deleteCheck ? `Yes, delete this ${kind} entry` : `Delete ${kind} entry`} icon={Trash2} variant="danger" onPress={async () => { if (!deleteCheck) { setDeleteCheck(true); return; } try { await onDelete(); onClose(); } catch { setError('Could not delete the entry.'); } }} />{deleteCheck && <T muted style={{ fontSize: 12 }}>This removes the entry from your journal and recalculates patterns.</T>}</>}
  </Sheet>;
}

export function SymptomForm({ definitions, selectedIds, initial, selectedDay, onSave, onDelete, onClose, onManage }: { definitions: SymptomDefinition[]; selectedIds: string[]; initial?: SymptomLog; selectedDay?: string; onSave: (s: SymptomLog) => Promise<void>; onDelete?: () => Promise<void>; onClose: () => void; onManage: () => void }) {
  const [kind, setKind] = useState<'negative' | 'positive'>(definitions.find(d => d.id === initial?.symptomId)?.kind || 'negative');
  const [selected, setSelected] = useState(initial?.symptomId || '');
  const [severity, setSeverity] = useState<Level>(initial?.severity || 2);
  const [date, setDate] = useState(() => initial ? new Date(initial.occurredAt) : defaultEntryDate(selectedDay));
  const [notes, setNotes] = useState(initial?.notes || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const shown = definitions.filter(d => d.kind === kind && (selectedIds.includes(d.id) || d.id === selected));
  const save = async () => {
    if (!selected) { setError('Choose a symptom or positive feeling first.'); return; }
    if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now()) { setError('Choose a valid time in the past.'); return; }
    setBusy(true);
    try { await onSave({ id: initial?.id || uid(), symptomId: selected, severity, occurredAt: date.toISOString(), notes: notes.trim() }); onClose(); }
    catch { setError('This entry could not be saved. Please try again.'); }
    finally { setBusy(false); }
  };
  return <Sheet title={initial ? 'Edit how you felt' : 'How are you feeling?'} subtitle="The good days matter, too." onClose={onClose}>
    <Row><Chip label="A symptom" selected={kind === 'negative'} onPress={() => { setKind('negative'); setSelected(''); }} /><Chip label="Something positive" selected={kind === 'positive'} onPress={() => { setKind('positive'); setSelected(''); }} /></Row>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>{shown.map(d => <Chip key={d.id} label={d.name} selected={selected === d.id} onPress={() => setSelected(d.id)} />)}</View>
    {shown.length === 0 && <T muted>You haven’t selected any {kind === 'positive' ? 'positive feelings' : 'symptoms'} to track yet.</T>}
    <Button label="Choose symptoms or add your own" icon={Plus} variant="ghost" onPress={onManage} />
    <T style={{ fontFamily: F.semi }}>{kind === 'positive' ? 'How noticeable was it?' : 'How intense was it?'}</T>
    <Row style={{ justifyContent: 'space-between' }}>{([1, 2, 3, 4, 5] as Level[]).map(v => <Pressable key={v} accessibilityRole="button" accessibilityLabel={`${v} of 5`} accessibilityState={{ selected: severity === v }} onPress={() => setSeverity(v)} style={{ width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: severity === v ? (kind === 'positive' ? C.green : C.orange) : C.bg, borderWidth: 1, borderColor: severity === v ? 'transparent' : C.line }}><T style={{ color: severity === v ? '#fff' : C.muted, fontFamily: F.semi }}>{v}</T></Pressable>)}</Row>
    <Row style={{ justifyContent: 'space-between', marginTop: -12 }}><T muted style={{ fontSize: 11 }}>Slight</T><T muted style={{ fontSize: 11 }}>Very strong</T></Row>
    <DateField value={date} onChange={setDate} label="Felt at" /><Field label="Anything else? (optional)" value={notes} onChangeText={setNotes} placeholder="Duration, activity, medication, or anything unusual…" multiline />
    <Notice>{kind === 'positive' ? 'Positive feelings are analysed separately. A comfortable day does not prove a food is safe for an allergy or coeliac disease.' : 'If you have trouble breathing, sudden mouth or throat swelling, or feel faint after eating, seek emergency help now. Don’t wait for a pattern.'}</Notice>
    {!!error && <Notice warm>{error}</Notice>}<Button label={initial ? 'Save changes' : 'Save how I feel'} icon={Check} onPress={save} busy={busy} />
    {onDelete && <Button label={deleting ? 'Yes, delete this entry' : 'Delete entry'} icon={Trash2} variant="danger" onPress={async () => { if (!deleting) { setDeleting(true); return; } try { await onDelete(); onClose(); } catch { setError('Could not delete the entry.'); } }} />}
  </Sheet>;
}
