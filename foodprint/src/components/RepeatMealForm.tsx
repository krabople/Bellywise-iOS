import React, { useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ArrowLeft, Check, ChevronRight, Copy, Pencil, Search } from 'lucide-react-native';
import { copyMealItems, previousMeals } from '../domain/mealReuse';
import type { CustomIngredientDefinition, Meal } from '../domain/types';
import { DateField } from './DateField';
import { defaultEntryDate, MealForm, uid } from './EntryForms';
import { Button, C, Card, Chip, F, Field, Notice, Pill, Row, Sheet, T } from './ui';

type Props = {
  meals: Meal[];
  initialIds?: string[];
  selectedDay: string;
  customIngredients: CustomIngredientDefinition[];
  onAddCustomIngredient: (ingredient: CustomIngredientDefinition) => Promise<void>;
  onClose: () => void;
  onSave: (items: Meal[]) => Promise<void>;
};

const cloneDrafts = (items: Meal[]) => items.map(item => ({
  ...item,
  excludedComponents: item.excludedComponents?.slice(),
  ingredients: item.ingredients.map(ingredient => ({ ...ingredient, excludedComponents: ingredient.excludedComponents?.slice() })),
}));
const dateLabel = (date: string) => new Date(date).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const defaultGroup = (date: Date) => date.getHours() < 11 ? 'Breakfast' : date.getHours() < 16 ? 'Lunch' : date.getHours() < 21 ? 'Dinner' : 'Snack';

export function RepeatMealForm({ meals, initialIds, selectedDay, customIngredients, onAddCustomIngredient, onClose, onSave }: Props) {
  const [date, setDate] = useState(() => defaultEntryDate(selectedDay));
  const [group, setGroup] = useState(() => defaultGroup(defaultEntryDate(selectedDay)));
  const [items, setItems] = useState<Meal[] | null>(() => initialIds ? cloneDrafts(meals.filter(meal => initialIds.includes(meal.id))) : null);
  const [included, setIncluded] = useState<string[]>(() => initialIds ?? []);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(20);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState('');
  const choices = useMemo(() => previousMeals(meals), [meals]);
  const matching = choices.filter(choice => [choice.name, ...choice.items.map(item => item.name)].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const selected = items?.filter(item => included.includes(item.id)) ?? [];
  const choose = (next: Meal[]) => { setItems(cloneDrafts(next)); setIncluded(next.map(item => item.id)); setError(''); };
  const back = () => { setItems(null); setError(''); };
  const save = async () => {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try { await onSave(copyMealItems(selected, date, group, uid)); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'This meal could not be saved. Please try again.'); }
    finally { saving.current = false; setBusy(false); }
  };
  const editing = items?.find(item => item.id === editingId);
  if (editing) return <MealForm initial={editing} contextLocked customIngredients={customIngredients} onAddCustomIngredient={onAddCustomIngredient} onClose={() => setEditingId(null)} onSave={async updated => { setItems(current => current!.map(item => item.id === updated.id ? updated : item)); setEditingId(null); }} />;

  return <Sheet title={items ? 'Log this again' : 'Use a previous meal'} subtitle={items ? 'Same recipe, a new entry in your journal.' : 'Leftovers or a favourite you have had before? Reuse what you already recorded.'} onClose={busy ? () => {} : onClose}>
    {!items ? <>
      <Field label="Find a previous food, drink or meal" value={search} onChangeText={value => { setSearch(value); setLimit(20); }} placeholder="e.g. bolognese, dinner, coffee" maxLength={300} />
      <T muted style={{ fontSize: 12 }}>A meal group includes its recorded items. You can leave out anything you didn’t have again.</T>
      {matching.length === 0 && <Notice>{meals.length ? 'No matching entries. Try a different name.' : 'Once you have logged some food or drinks, they will appear here ready to use again.'}</Notice>}
      {matching.slice(0, limit).map(choice => <Pressable key={choice.id} accessibilityRole="button" accessibilityLabel={`Reuse ${choice.name}, ${dateLabel(choice.eatenAt)}`} onPress={() => choose(choice.items)} style={({ pressed }) => ({ padding: 17, borderRadius: 16, borderWidth: 1, borderColor: C.line, opacity: pressed ? .65 : 1 })}>
        <Row style={{ alignItems: 'flex-start' }}><View style={{ flex: 1, gap: 5 }}><T style={{ fontFamily: F.semi }}>{choice.name}</T>{(choice.items.length > 1 || choice.name !== choice.items[0].name) && <T muted style={{ fontSize: 12 }}>{choice.items.map(item => item.name).join(' · ')}</T>}<T muted style={{ fontSize: 11 }}>{dateLabel(choice.eatenAt)} · {choice.items.length === 1 ? `${choice.items[0].ingredients.length} recorded ingredients` : `${choice.items.length} items`}</T></View><ChevronRight size={18} color={C.green} /></Row>
      </Pressable>)}
      {matching.length > limit && <Button label="Show more previous meals" icon={Search} variant="secondary" onPress={() => setLimit(value => value + 20)} />}
    </> : <>
      <Button label="Choose a different previous meal" icon={ArrowLeft} variant="ghost" disabled={busy} onPress={back} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
      <Notice>These are the ingredients and products you recorded before. Check the portion and leave out any sides or drinks you didn’t have this time.</Notice>
      <View pointerEvents={busy ? 'none' : 'auto'} accessibilityElementsHidden={busy} importantForAccessibility={busy ? 'no-hide-descendants' : 'auto'} style={{ gap: 20 }}>
        <DateField value={date} onChange={setDate} label="Had again at" />
        <T style={{ fontFamily: F.semi }}>Add to a meal</T><Row style={{ flexWrap: 'wrap', gap: 7 }}>{['Ungrouped', 'Breakfast', 'Lunch', 'Dinner', 'Snack'].map(name => <Chip key={name} label={name} selected={group === name} onPress={() => setGroup(name)} />)}</Row>
      </View>
      <Row style={{ justifyContent: 'space-between' }}><T style={{ fontFamily: F.semi }}>What did you have again?</T><Pill label={`${selected.length} of ${items.length}`} /></Row>
      {items.map(item => { const checked = included.includes(item.id); return <Card key={item.id} style={{ padding: 16, gap: 12, backgroundColor: checked ? C.paper : C.bg }}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={`Include ${item.name}`} accessibilityState={{ checked, disabled: busy }} disabled={busy} onPress={() => setIncluded(current => checked ? current.filter(id => id !== item.id) : [...current, item.id])}>
          <Row style={{ alignItems: 'flex-start' }}><View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: checked ? C.green : C.muted, backgroundColor: checked ? C.green : C.paper, alignItems: 'center', justifyContent: 'center' }}>{checked && <Check size={16} color="#fff" />}</View><View style={{ flex: 1 }}><T style={{ fontFamily: F.semi }}>{item.name}</T><T muted style={{ fontSize: 11 }}>{item.kind === 'drink' ? 'Drink' : 'Food'} · {item.ingredients.length} ingredients{item.productCode ? ' · scanned product' : ''}</T></View></Row>
        </Pressable>
        {checked && <><T muted style={{ fontSize: 12 }}>{item.ingredients.map(ingredient => ingredient.name).join(' · ') || 'No ingredients recorded'}</T>{item.notes && <T muted numberOfLines={2} style={{ fontSize: 11 }}>Notes: {item.notes}</T>}<Button label={`Edit ${item.name}`} icon={Pencil} variant="secondary" disabled={busy} onPress={() => setEditingId(item.id)} /></>}
      </Card>; })}
      {!!error && <Notice warm>{error}</Notice>}
      <Button label={group === 'Ungrouped' ? 'Add again to my journal' : `Add again to ${group.toLowerCase()}`} icon={Copy} busy={busy} disabled={selected.length === 0} onPress={() => void save()} />
      <T muted style={{ fontSize: 11 }}>This creates new entries at the time above. Your original meal stays in your journal.</T>
    </>}
  </Sheet>;
}
