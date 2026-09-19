export type LearnArticle = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  readMinutes: number;
  body: string[];
  takeaway: string;
  sources: { title: string; url: string }[];
};

// Date the linked sources were checked, not a claim of clinical validation.
export const CONTENT_REVIEWED_AT = '2026-09-19';

export const SAFETY_NOTICES = {
  general:
    'Bellywise helps you record and explore patterns. It cannot diagnose an intolerance, allergy or other condition. Discuss persistent symptoms and dietary changes with a qualified clinician.',
  urgentAllergy:
    'Trouble breathing, sudden swelling of the mouth or throat, or fainting after food may be an emergency. Call your local emergency number now (999 in the UK). Use your prescribed adrenaline auto-injector as directed. Do not wait for this app.',
  gastrointestinalRedFlags:
    'Seek urgent medical advice for blood in your stool, unexplained weight loss or a new hard swelling in your abdomen. Sudden severe abdominal pain or vomiting blood needs emergency care.',
  glutenTesting:
    'Speak to a clinician about coeliac testing before starting a gluten-free diet; avoiding gluten can affect results. If you already avoid it, ask for advice before changing your diet.',
  restriction:
    'A diary pattern is a reason to ask questions, not a food ban. Avoid cutting out several food groups without a dietitian. Never test a known or suspected food allergy by eating the food.',
  positiveCheckIns:
    'Comfortable days are useful context. Feeling well after a food does not prove that it is safe for an allergy or coeliac disease, or that it cannot contribute to symptoms later.',
} as const;

export const LEARN_ARTICLES: LearnArticle[] = [
  {
    id: 'intolerance-vs-allergy',
    title: 'Intolerance is not the same as allergy',
    subtitle: 'Similar meals. Very different explanations.',
    category: 'Start here',
    readMinutes: 2,
    body: [
      'Food intolerance describes difficulty handling certain foods or ingredients. Digestive symptoms such as bloating, pain or diarrhoea may appear hours later. Food allergy involves the immune system and can cause a dangerous reaction. Timing alone cannot tell them apart.',
      'Symptoms after a meal can also have causes unrelated to intolerance. A food diary gives a clinician a clearer history; it cannot establish a diagnosis or rule out allergy.',
      'Never deliberately eat a food to test a known or suspected allergy. For breathing difficulty, sudden mouth or throat swelling, or fainting, seek emergency help immediately. Follow an existing allergy action plan and use prescribed adrenaline as directed.',
    ],
    takeaway: 'Use patterns to start a conversation with a clinician. Do not use them as an allergy safety check.',
    sources: [
      { title: 'NHS: Food intolerance', url: 'https://www.nhs.uk/conditions/food-intolerance/' },
      { title: 'NHS: Anaphylaxis', url: 'https://www.nhs.uk/conditions/anaphylaxis/' },
    ],
  },
  {
    id: 'lactose',
    title: 'Lactose, milk and dairy',
    subtitle: 'Milk sugar and milk protein are different.',
    category: 'Ingredients explained',
    readMinutes: 2,
    body: [
      'Lactose is a sugar in milk. When the small intestine produces too little lactase, some lactose is not digested properly. This can lead to gas, bloating, abdominal pain or diarrhoea. A clinician can assess whether lactose is involved and whether another condition needs checking.',
      'The amount and type of dairy matter: many people with lactose intolerance can manage some lactose. A meal labelled “dairy” does not tell us its lactose dose. Lactose-free milk still contains milk proteins and is not a substitute for someone with milk allergy.',
      'If a clinician recommends reducing lactose, discuss suitable alternatives and sources of calcium and vitamin D. Some people find lactase products useful. Bellywise cannot tell you whether a supplement or a particular serving is appropriate for you.',
    ],
    takeaway: 'Record the actual product and amount. “Lactose-free” and “milk-free” mean different things.',
    sources: [
      { title: 'NIDDK: Lactose intolerance', url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance' },
      { title: 'Cambridge University Hospitals: Milk allergy', url: 'https://www.cuh.nhs.uk/patient-information/milk-allergy/' },
    ],
  },
  {
    id: 'wheat-gluten',
    title: 'Before you cut out gluten',
    subtitle: 'Testing first can protect your answers.',
    category: 'Ingredients explained',
    readMinutes: 2,
    body: [
      'A pattern after bread or pasta cannot identify gluten as the cause. Those foods may also contain fermentable carbohydrates, milk, sauces or other ingredients. Wheat allergy, coeliac disease and other explanations need different assessments.',
      'Coeliac disease is an immune-mediated condition associated with gluten. Tests can become less accurate after starting a gluten-free diet. Speak with a clinician about testing before making that change. If you already avoid gluten, ask how to investigate safely; do not start a gluten challenge yourself.',
      'Tell Bellywise when a food is gluten-free, and review suggested ingredients against the actual label or recipe. That improves your diary, but the app cannot certify a food as safe for coeliac disease or wheat allergy.',
    ],
    takeaway: 'A wheat-related pattern is a question to investigate, not a gluten diagnosis. Ask about coeliac testing before avoidance.',
    sources: [
      { title: 'NIDDK: Diagnosis of coeliac disease', url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/celiac-disease/diagnosis' },
      { title: 'NIDDK: Coeliac disease', url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/celiac-disease' },
      { title: 'Monash: The three steps of a low FODMAP diet', url: 'https://www.monashfodmap.com/blog/3-phases-low-fodmap-diet/' },
    ],
  },
  {
    id: 'fodmaps',
    title: 'FODMAPs, without the food fear',
    subtitle: 'A supported process, not a permanent ban.',
    category: 'Ingredients explained',
    readMinutes: 2,
    body: [
      'FODMAPs are groups of fermentable carbohydrates. They can contribute to digestive symptoms in some people with irritable bowel syndrome (IBS). They occur in many nutritious foods, and a response depends on the food, serving and individual.',
      'A low FODMAP diet is a structured treatment option for suitable people with IBS. Monash describes a short initial phase, usually two to six weeks, followed by planned reintroduction and then a personalised, more varied diet. A trained dietitian should guide the process.',
      'Bellywise does not measure a meal’s FODMAP content or prescribe elimination and reintroduction. Its ingredient hints cannot capture laboratory-tested serving thresholds. Bring your diary to a clinician or dietitian before making substantial restrictions.',
    ],
    takeaway: 'The aim is the widest varied diet you can manage, with professional support when needed.',
    sources: [
      { title: 'Monash: Starting the low FODMAP diet', url: 'https://monashfodmap.com/ibs-central/i-have-ibs/starting-the-low-fodmap-diet/' },
      { title: 'Monash: Practical tips for FODMAP reintroduction', url: 'https://www.monashfodmap.com/blog/practical-tips-fodmap-reintroduction/' },
    ],
  },
  {
    id: 'caffeine-alcohol',
    title: 'Remember what you drink',
    subtitle: 'Coffee is more than one ingredient.',
    category: 'Everyday habits',
    readMinutes: 1,
    body: [
      'Caffeine and alcohol can be associated with IBS symptom flares for some people. A drink may also include milk, fruit juice, sweeteners or carbonation. Recording only “coffee” can hide useful detail.',
      'Note the serving, caffeinated or decaffeinated version, milk or alternative, and any syrup or sweetener. A repeated pattern after a milky coffee cannot by itself separate caffeine from milk or the rest of breakfast.',
      'Add relevant context, such as an unusually stressful day or a change in routine. Bellywise does not recommend drinking alcohol or increasing caffeine to test a theory. Discuss persistent symptoms with a clinician.',
    ],
    takeaway: 'Log drinks with the same care as meals; keep the amount and additions visible.',
    sources: [
      { title: 'NHS: IBS symptoms and triggers', url: 'https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/symptoms/' },
      { title: 'NHS: Diet and lifestyle for IBS', url: 'https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/diet-lifestyle-and-medicines/' },
    ],
  },
  {
    id: 'reading-labels',
    title: 'Make a label scan worth trusting',
    subtitle: 'A helpful first draft that you review.',
    category: 'Better logging',
    readMinutes: 2,
    body: [
      'Photograph the complete ingredients panel in good light, keeping the text flat and in focus. Review the extracted text before saving. Glare, folds, small print and different languages can cause missed words or incorrect ingredients.',
      'An ingredients list describes what a product contains. A “may contain” statement warns about possible cross-contact and should not be treated as a confirmed ingredient. Neither should be discarded when you are checking a product for an allergy.',
      'Recipes and products change. Check the current packaging even when a database recognises the name or barcode. A generic dish suggestion is an estimate, not the recipe you ate. Follow label advice and your clinician’s guidance for an allergy or coeliac disease; Bellywise is not a food-safety scanner.',
    ],
    takeaway: 'Keep the actual label as your source of truth. Correct the scan and confirm ingredients before saving.',
    sources: [
      { title: 'Food Standards Agency: Food allergy and intolerance advice', url: 'https://www.gov.uk/government/publications/food-allergy-and-intolerance-advice-for-consumers/food-allergy-and-intolerance-advice-for-consumers' },
    ],
  },
  {
    id: 'patterns',
    title: 'What a pattern can tell you',
    subtitle: 'Clues need context, and enough observations.',
    category: 'How Bellywise works',
    readMinutes: 2,
    body: [
      'Bellywise compares what you have logged across meals and check-ins. An association means two things appeared together in your records more often; it does not establish that one caused the other. The analysis has not been clinically validated.',
      'Foods are often eaten together. If wheat, tomato and cheese always arrive as pizza, a diary may not separate them. Delayed symptoms can overlap several meals. Stress, illness, medicines, sleep, portion size and missing entries can all complicate interpretation.',
      'Repeated observations on different days are more useful than a single event. Log meals and check-ins when you feel well too. A missed check-in means “unknown”, not “no symptoms”. Suggested recipe ingredients add uncertainty until you confirm them.',
      'Treat every result as a discussion prompt. A stronger diary pattern is not a probability that you have an intolerance, and a lack of a pattern cannot rule one out.',
    ],
    takeaway: 'Consistent records can improve the question you bring to a clinician. They cannot replace the assessment.',
    sources: [
      { title: 'NHS: Keeping a diary as part of IBS care', url: 'https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/diet-lifestyle-and-medicines/' },
    ],
  },
  {
    id: 'positive-check-ins',
    title: 'Good days belong in your diary',
    subtitle: 'A fuller picture of how you feel.',
    category: 'Better logging',
    readMinutes: 1,
    body: [
      'It is easy to open a symptom diary only when something hurts. Recording a comfortable check-in gives your future self more context. Positive experiences, such as feeling energised, can be recorded in their own right.',
      'A positive feeling and a negative symptom can happen together. Being energised does not mean you had no bloating, and feeling comfortable now cannot rule out a later symptom. Use symptom-specific observations when you can.',
      'No symptoms after a food do not prove that it is safe for a known allergy or coeliac disease. Do not use a good day, an empty diary or a reassuring pattern to change prescribed avoidance advice.',
    ],
    takeaway: 'Record good days honestly, without treating them as a food-safety test.',
    sources: [
      { title: 'NHS: Diet and lifestyle for IBS', url: 'https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/diet-lifestyle-and-medicines/' },
      { title: 'NIDDK: Symptoms and causes of coeliac disease', url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/celiac-disease/symptoms-causes' },
    ],
  },
  {
    id: 'next-steps',
    title: 'A useful next step',
    subtitle: 'Turn your diary into a better appointment.',
    category: 'Care and support',
    readMinutes: 2,
    body: [
      'If symptoms keep returning, arrange a clinical assessment. Bring a short diary covering meals, ingredients you are sure about, symptom timing and severity, and relevant medicines or changes in routine. Mention any foods you already avoid.',
      'Ask whether another condition needs checking and whether a dietitian could help. Broad commercial food IgG panels are not recommended for diagnosing food allergies or intolerances. Do not let an app result or a test sold online become a long list of foods to remove.',
      'Seek urgent medical advice for blood in your stool, unexplained weight loss or a hard abdominal swelling. Sudden severe abdominal pain or vomiting blood needs emergency care. Breathing difficulty or sudden mouth or throat swelling after food also needs emergency help.',
    ],
    takeaway: 'Get help sooner for warning signs. For ongoing symptoms, share observations and decide next steps with a professional.',
    sources: [
      { title: 'NHS: When to get help for bowel symptoms', url: 'https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/symptoms/' },
      { title: 'NHS: Stomach ache', url: 'https://www.nhs.uk/symptoms/stomach-ache/' },
      { title: 'AAAAI: The myth of IgG food panel testing', url: 'https://www.aaaai.org/tools-for-the-public/conditions-library/allergies/igg-food-test' },
    ],
  },
];
