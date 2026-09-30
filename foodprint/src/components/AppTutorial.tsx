import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Bell, BookOpen, Camera, Check, ChevronLeft, Clock, Leaf, ScanBarcode, Search, ShieldCheck, Smile, Sparkles, TrendingUp, Utensils, X, type LucideIcon } from 'lucide-react-native';
import { Botanical, Button, C, Chip, F, Heading, IconButton, Notice, Pill, Row, T } from './ui';

export type TutorialDestination = 'journal' | 'meal' | 'symptom' | 'notifications' | 'example';
const chapters = [
  { title: 'Log food & drinks', location: 'Journal → Scan a barcode', icon: ScanBarcode },
  { title: 'Check what’s inside', location: 'Food entry → Review each ingredient', icon: Leaf },
  { title: 'Log how you feel', location: 'Journal → Log a feeling', icon: Smile },
  { title: 'Remember the good days', location: 'Journal → How was your day?', icon: Check },
  { title: 'Explore a pattern', location: 'Patterns → Tap a pattern', icon: TrendingUp },
  { title: 'Make it work for you', location: 'My space & Discover', icon: Sparkles },
];
const foodMethods = [
  { label: 'Scan barcode', icon: ScanBarcode, title: 'Start with the packet', text: 'Point the camera at its barcode. Bellywise looks up the product’s published ingredients. If they aren’t available, photograph the ingredients list or enter them manually.' },
  { label: 'Scan ingredients', icon: Camera, title: 'Photograph the ingredients', text: 'Take or choose a photo, then draw a box around just the ingredients list. Review the separate ingredients Bellywise finds before saving.' },
  { label: 'Log manually', icon: Utensils, title: 'Type what you had', text: 'Enter a food or drink, such as “gluten-free bread” or “oat latte”. Answer any follow-up choices, then review the suggested ingredients. Recipe suggestions are estimates.' },
  { label: 'Search by name', icon: Search, title: 'Find a brand or product', text: 'Type a brand or product name and choose the right result. Check that the variety matches your packet, then review its ingredients.' },
];

function Tip({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return <Row style={{ alignItems: 'flex-start', gap: 12 }}><View style={styles.tipIcon}><Icon size={19} color={C.green} /></View><View style={{ flex: 1, gap: 4 }}><T style={{ fontFamily: F.semi }}>{title}</T><T muted style={{ fontSize: 13 }}>{children}</T></View></Row>;
}

function Practice({ prompt, children }: { prompt: string; children: React.ReactNode }) {
  return <View style={styles.practice}><Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 5 }}><Pill label="TRY AN EXAMPLE" /><T muted style={{ fontSize: 11 }}>Nothing is added to your diary</T></Row><T style={{ fontFamily: F.medium, fontSize: 13 }}>{prompt}</T>{children}</View>;
}

/** All practice state is local to the guide. Only finishing/skipping calls the app. */
export function AppTutorial({ replay = false, onFinish }: { replay?: boolean; onFinish: (destination: TutorialDestination) => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [foodMethod, setFoodMethod] = useState(0);
  const [ingredientOpen, setIngredientOpen] = useState(false);
  const [garlicConfirmed, setGarlicConfirmed] = useState(false);
  const [garlicRemoved, setGarlicRemoved] = useState(false);
  const [positive, setPositive] = useState(false);
  const [feeling, setFeeling] = useState('');
  const [noSymptoms, setNoSymptoms] = useState(false);
  const [patternOpen, setPatternOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const finishing = useRef(false);
  const chapter = chapters[step - 1];
  const title = chapter?.title ?? 'Welcome to Bellywise';

  useEffect(() => {
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(step ? `Step ${step} of ${chapters.length}. ${title}` : title);
  }, [step, title]);

  const finish = async (destination: TutorialDestination = 'journal') => {
    if (finishing.current) return;
    finishing.current = true; setBusy(true); setError('');
    try { await onFinish(destination); }
    catch { setError('Your choice could not be saved. Please try again.'); }
    finally { finishing.current = false; setBusy(false); }
  };

  return <Modal transparent animationType="fade" onRequestClose={() => void finish()}>
    <View style={[styles.backdrop, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View accessibilityViewIsModal style={styles.panel}>
        <View style={styles.header}>
          <Row style={{ justifyContent: 'space-between', gap: 5 }}>
            <Row style={{ gap: 8, flex: 1 }}><Leaf size={20} color={C.green} /><T style={{ fontFamily: F.semi, fontSize: 12 }}>{step ? `QUICK TOUR · ${step} OF ${chapters.length}` : 'A LITTLE GUIDANCE TO GET STARTED'}</T></Row>
            <Button label={replay ? 'Close tour' : 'Skip tour'} variant="ghost" disabled={busy} onPress={() => void finish()} style={{ paddingHorizontal: 8 }} />
          </Row>
          {step > 0 && <View accessibilityRole="progressbar" accessibilityLabel="Tutorial progress" accessibilityValue={{ min: 1, max: chapters.length, now: step }} style={{ flexDirection: 'row', gap: 5 }}>{chapters.map((item, index) => <View key={item.title} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: index < step ? C.green : C.line }} />)}</View>}
        </View>

        <ScrollView key={step} style={{ flex: 1 }} contentContainerStyle={styles.body} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
          <View style={{ gap: 8 }}><Heading size={29}>{title}</Heading>{chapter && <T style={{ color: C.green, fontSize: 12, fontFamily: F.medium }}>{chapter.location}</T>}</View>

          {step === 0 && <>
            <View style={{ alignItems: 'center' }}><Botanical size={130} /></View>
            <Heading size={25}>Small notes. A clearer picture.</Heading>
            <T muted>Learn the essentials in a few minutes. Try the examples as you go, or skip straight to your journal.</T>
            <View style={{ gap: 16 }}>
              <Tip icon={Utensils} title="What you ate and drank">Scan a packet, check ingredients and group items into meals.</Tip>
              <Tip icon={Smile} title="How you felt">Record symptoms, positive feelings and symptom-free days.</Tip>
              <Tip icon={TrendingUp} title="What your diary can reveal">Explore possible connections and the entries behind them.</Tip>
            </View>
            <T muted style={{ fontSize: 12 }}>Bellywise helps you explore possible connections. It cannot diagnose an intolerance or allergy.</T>
            {Platform.OS === 'web' && <Notice warm>This is the browser preview. Use fictional entries; camera scanning and encrypted storage are available in the iOS app.</Notice>}
          </>}

          {step === 1 && <>
            <T>From Journal, choose “Scan a barcode” for a packet or “Log food or drink manually” for something you’ve made. You can switch methods inside the food entry.</T>
            <Practice prompt="Tap a method to see when to use it.">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{foodMethods.map((method, index) => <Chip key={method.label} label={method.label} selected={foodMethod === index} onPress={() => setFoodMethod(index)} />)}</View>
              <View style={styles.inset}><Tip icon={foodMethods[foodMethod].icon} title={foodMethods[foodMethod].title}>{foodMethods[foodMethod].text}</Tip></View>
            </Practice>
            <Tip icon={Utensils} title="Build a whole meal">Choose Breakfast, Lunch, Dinner or Snack under “Add to a meal”. Use “Save & add another” to keep scanning items into that meal. Use the Drink option for drinks.</Tip>
            <Tip icon={Utensils} title="Having it again?">Choose “Use a previous meal” in Journal, or “Log again” on an entry. Reuse the ingredients you recorded, choose the new time and meal, and leave out anything you didn’t have again.</Tip>
            <Tip icon={Clock} title="Set the time you actually had it">Check “Had at”, especially when logging later. Tap an entry in your journal whenever you need to edit it.</Tip>
          </>}

          {step === 2 && <>
            <T>Each ingredient can contribute to a pattern. Check the list before saving: remove anything you didn’t have and add anything missing.</T>
            <Practice prompt="Tap an ingredient name, then try confirming or removing garlic.">
              <View style={{ borderBottomWidth: 1, borderColor: C.line, paddingBottom: 8 }}><Pressable accessibilityRole="button" accessibilityLabel="About tomato in this example" accessibilityState={{ expanded: ingredientOpen }} onPress={() => setIngredientOpen(!ingredientOpen)} style={{ minHeight: 44, justifyContent: 'center' }}><T style={styles.ingredient}>Tomato</T><T muted style={{ fontSize: 11 }}>Confirmed · Tap for details</T></Pressable></View>
              {ingredientOpen && <Notice>Ingredient details explain what it is, where it’s found, and known symptoms and context, with sources where available. You can open these details from ingredient names in your journal.</Notice>}
              {!garlicRemoved ? <Row style={{ gap: 4 }}><View style={{ flex: 1 }}><T>Garlic</T><T muted style={{ fontSize: 11 }}>{garlicConfirmed ? 'Confirmed ingredient' : 'Suggested · not yet confirmed'}</T></View><Button label={garlicConfirmed ? 'Unconfirm' : 'Confirm'} variant="ghost" onPress={() => setGarlicConfirmed(!garlicConfirmed)} style={{ paddingHorizontal: 10 }} /><IconButton icon={X} label="Remove garlic from example" onPress={() => setGarlicRemoved(true)} /></Row> : <Row style={{ justifyContent: 'space-between' }}><T muted style={{ fontSize: 12 }}>Garlic removed from the example.</T><Button label="Undo" variant="ghost" onPress={() => setGarlicRemoved(false)} /></Row>}
            </Practice>
            <Notice>Ingredients from a label or product lookup start confirmed. Recipe suggestions are estimates: only confirm the ones you know you ate. You can unconfirm an uncertain item.</Notice>
            <Tip icon={Search} title="Be specific when you type">Use details such as “gluten-free” or “lactose-free”. If an ingredient isn’t recognised, check the close matches before adding your own.</Tip>
          </>}

          {step === 3 && <>
            <T>Tap “Log a feeling” in Journal. Choose a symptom or something positive, then record how strong it was and when it started.</T>
            <Practice prompt="Try a symptom, then switch to something positive.">
              <Row style={{ flexWrap: 'wrap', gap: 8 }}><Chip label="A symptom" selected={!positive} onPress={() => { setPositive(false); setFeeling(''); }} /><Chip label="Something positive" selected={positive} onPress={() => { setPositive(true); setFeeling(''); }} /></Row>
              <Row style={{ flexWrap: 'wrap', gap: 8 }}>{(positive ? ['Comfortable digestion', 'Good energy'] : ['Bloating', 'Low energy']).map(name => <Chip key={name} label={name} selected={feeling === name} onPress={() => setFeeling(name)} />)}</Row>
              <View style={styles.inset}><T accessibilityLiveRegion="polite" style={{ fontSize: 13 }}>{feeling ? `${feeling} selected. In your journal, choose its intensity and check “Felt at” before saving.` : 'Choose a feeling to try it. These examples won’t be saved.'}</T></View>
            </Practice>
            <Tip icon={Clock} title="Use the time it happened">A symptom at 7 pm should be logged as 7 pm, even if you enter it after an 8 pm meal. Timing helps Bellywise put the events in the right order.</Tip>
            <Tip icon={Smile} title="Choose what matters to you">Use “Choose symptoms or add your own” in the feeling form, or “Personalise my symptoms” in My space. You can track positive feelings too.</Tip>
          </>}

          {step === 4 && <>
            <T>At the end of the day, open “How was your day?” in Journal and tap “Add daily context”. Check your entries, then confirm your day is complete.</T>
            <Practice prompt="Imagine you had no symptoms yesterday. Try confirming that.">
              <Row style={{ justifyContent: 'space-between' }}><View style={{ flex: 1, gap: 4 }}><T style={{ fontFamily: F.semi }}>No symptoms on this day</T><T muted style={{ fontSize: 12 }}>Example day · yesterday</T></View><Switch accessibilityLabel="Confirm no symptoms on the example day" value={noSymptoms} onValueChange={setNoSymptoms} trackColor={{ false: C.line, true: C.green }} /></Row>
              <Notice>{noSymptoms ? 'Now the example has a symptom-free day to compare with days when symptoms occurred.' : 'No logged symptoms could mean you felt well, or simply haven’t logged them. Your confirmation tells Bellywise which it was.'}</Notice>
            </Practice>
            <Tip icon={Check} title="A symptom-free day is useful information">Confirm no symptoms only when that is true, and mark the day complete once your food, drinks and feelings are logged. Your entries still contribute before the review.</Tip>
            <Tip icon={Clock} title="Fill in the bigger picture">Add stress and sleep for context. A small “!” on a past calendar date flags a day with entries but no symptoms or completed review. Tap it to check that day.</Tip>
          </>}

          {step === 5 && <>
            <T>Patterns compares days with and without an ingredient. It needs repeated observations and completed comparison days, so an empty Patterns screen at first is normal.</T>
            <Practice prompt="Tap this fictional pattern to look behind the headline.">
              <Pressable accessibilityRole="button" accessibilityLabel="Explore example milk and bloating pattern" accessibilityState={{ expanded: patternOpen }} onPress={() => setPatternOpen(!patternOpen)} style={styles.inset}><Row style={{ justifyContent: 'space-between' }}><View style={{ flex: 1 }}><T style={{ fontFamily: F.semi }}>Milk & bloating</T><T muted style={{ fontSize: 12 }}>Fictional example · later the same day</T></View><ArrowRight size={20} color={C.green} /></Row></Pressable>
              {patternOpen && <View style={{ gap: 14 }}>
                {[{ label: 'Days with milk', count: '6 of 8', width: '75%' as const, color: C.green }, { label: 'Days without milk', count: '2 of 8', width: '25%' as const, color: '#A7BC95' }].map(row => <View key={row.label} accessible accessibilityLabel={`${row.label}: bloating on ${row.count} days`} style={{ gap: 6 }}><Row style={{ justifyContent: 'space-between' }}><T style={{ fontSize: 12 }}>{row.label}</T><T style={{ fontSize: 12, fontFamily: F.semi }}>{row.count}</T></Row><View style={{ height: 8, borderRadius: 4, backgroundColor: C.line }}><View style={{ height: 8, borderRadius: 4, backgroundColor: row.color, width: row.width }} /></View></View>)}
                <T muted style={{ fontSize: 12 }}>Here, bloating was recorded more often after milk. This alone doesn’t prove milk caused it.</T>
                <T style={{ fontSize: 12 }}>In a real pattern, explore the dated chart and matching meals, then read what could make the finding less certain, such as foods eaten together, stress or sleep.</T>
              </View>}
            </Practice>
            <Tip icon={Clock} title="Check the timing shown">Patterns can look at symptoms later the same day or the following day. The dated chart pairs the food day with the symptom day so you can see which is being compared.</Tip>
            <Notice>A pattern is a clue, not a diagnosis. Keep logging your usual diet and use the evidence to discuss persistent symptoms with a healthcare professional.</Notice>
          </>}

          {step === 6 && <>
            <T>Start with one entry, then build a routine you can keep. You can revisit this tour from My space at any time.</T>
            <Tip icon={Bell} title="Set reminders that suit your day">In My space → Choose notifications, set up to three food reminders, a daily-review time, and optional alerts when a new stronger pattern is found.</Tip>
            <Tip icon={BookOpen} title="Learn as you go">Discover has guides to food intolerances and what to do next. My space lets you export a report for a healthcare appointment.</Tip>
            <Tip icon={ShieldCheck} title="Keep a backup">The iOS diary stays on this device and doesn’t automatically sync with another one. Use My space → Save backup to keep a copy or move your diary. Exports contain private diary information.</Tip>
            <View style={styles.practice}><T style={{ fontFamily: F.semi }}>Where would you like to start?</T><Button label="Log food or drink" icon={Utensils} variant="secondary" disabled={busy} onPress={() => void finish('meal')} /><Button label="Log a feeling" icon={Smile} variant="secondary" disabled={busy} onPress={() => void finish('symptom')} /><Button label="Choose reminders" icon={Bell} variant="ghost" disabled={busy} onPress={() => void finish('notifications')} /></View>
            <Button label="Explore an example diary first" icon={Sparkles} variant="ghost" disabled={busy} onPress={() => void finish('example')} /><T muted style={{ fontSize: 12 }}>The example diary contains fictional entries and stays separate from your own.</T>
          </>}
        </ScrollView>

        <View style={styles.footer}>
          {!!error && <View accessibilityRole="alert"><Notice warm>{error}</Notice></View>}
          {step === 0 ? <><Button label="Show me around" icon={ArrowRight} disabled={busy} onPress={() => setStep(1)} /><Button label="Start my journal" variant="ghost" busy={busy} onPress={() => void finish()} /><T muted style={{ fontSize: 11, textAlign: 'center' }}>Skip for now. Replay later in My space.</T></> : <Row><Button label="Back" icon={ChevronLeft} variant="ghost" disabled={busy} onPress={() => setStep(step - 1)} /><Button label={step === chapters.length ? replay ? 'Done' : 'Start my journal' : 'Next'} icon={step === chapters.length ? Check : ArrowRight} busy={busy} style={{ flex: 1 }} onPress={() => step === chapters.length ? void finish() : setStep(step + 1)} /></Row>}
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#10281B80', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },
  panel: { flex: 1, maxHeight: 860, width: '100%', maxWidth: 640, backgroundColor: C.paper, borderRadius: 24, overflow: 'hidden' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, gap: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  body: { padding: 22, gap: 22 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 6, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.paper },
  practice: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, gap: 16 },
  inset: { padding: 15, borderRadius: 12, backgroundColor: C.paper, gap: 12 },
  tipIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center' },
  ingredient: { color: C.green, textDecorationLine: 'underline', fontFamily: F.medium },
});
