export interface StudyGuideTopicItem {
  id: string;
  slug: string;
  subjectSlug: string;
  subjectTitle: string;
  title: string;
  pathway: 'RN' | 'PN_LPN' | 'Both';
  readingMinutes: number;
  nclexYield: 'High' | 'Very High' | 'Essential';
  summary: string;
  keyConcepts: string[];
  clinicalPriorities: string[];
  nclexAlerts: string[];
  comparisonTable?: {
    title: string;
    headers: string[];
    rows: string[][];
  };
  notes: {
    heading: string;
    points: string[];
  }[];
}

export interface StudyGuideSubjectItem {
  slug: string;
  title: string;
  description: string;
  iconName: string;
  topicCount: number;
  topics: StudyGuideTopicItem[];
}

export const STUDY_GUIDE_CATALOGUE: StudyGuideSubjectItem[] = [
  {
    slug: 'pharmacology',
    title: 'Pharmacology & Parenteral Therapies',
    description: 'High-yield drug classifications, therapeutic ranges, critical adverse reactions, toxicities, and antidotes.',
    iconName: 'Pill',
    topicCount: 12,
    topics: [
      {
        id: 'pharm-digoxin',
        slug: 'cardiac-glycosides-digoxin',
        subjectSlug: 'pharmacology',
        subjectTitle: 'Pharmacology',
        title: 'Cardiac Glycosides: Digoxin & Antiarrhythmics',
        pathway: 'Both',
        readingMinutes: 8,
        nclexYield: 'Very High',
        summary: 'Inotropic agent used for heart failure and atrial fibrillation. Requires apical pulse check and serum level monitoring.',
        keyConcepts: ['Positive inotrope (increases contractility)', 'Negative chronotrope (slows heart rate)', 'Therapeutic window: 0.5 - 2.0 ng/mL', 'Hypokalemia increases digoxin toxicity risk'],
        clinicalPriorities: ['Always assess apical pulse for 60 full seconds prior to administration; hold if < 60 bpm in adults (< 90 in infants)', 'Monitor serum potassium (K+) closely; low potassium potentiates digitalis toxicity', 'Recognize early toxicity: anorexia, nausea/vomiting, abdominal pain, visual halos/yellow-green vision, bradycardia', 'Administer Digoxin Immune Fab (DigiFab) for life-threatening toxicity'],
        nclexAlerts: ['NCLEX Alert: Hypokalemia does NOT cause toxicity itself, but makes the cardiac muscle dramatically more sensitive to digoxin.'],
        comparisonTable: {
          title: 'Digoxin Toxicity Signs vs Therapeutic State',
          headers: ['Feature', 'Therapeutic Level', 'Toxic Manifestation'],
          rows: [
            ['Serum Level', '0.5 – 2.0 ng/mL', '> 2.0 ng/mL (Life-threatening)'],
            ['GI Symptoms', 'None', 'Anorexia, Nausea, Vomiting (Earliest sign)'],
            ['Visual Disturbances', 'Normal vision', 'Yellow/green halos, blurred vision, photophobia'],
            ['Cardiac Rhythm', 'Controlled ventricular rate', 'Bradycardia, heart block, premature ventricular contractions (PVCs)'],
          ],
        },
        notes: [
          { heading: 'Mechanism of Action', points: ['Inhibits sodium-potassium ATPase pump in myocardial cell membrane.', 'Increases intracellular calcium concentration, resulting in stronger myocardial contractions.', 'Stimulates vagal tone, decreasing conduction velocity through the AV node.'] },
          { heading: 'Patient Teaching', points: ['Teach client how to take their radial pulse for 1 full minute at home.', 'Advise client never to double up on missed doses.', 'Report visual changes or sudden loss of appetite immediately.'] },
        ],
      },
      {
        id: 'pharm-ace-arb',
        slug: 'antihypertensives-ace-arbs',
        subjectSlug: 'pharmacology',
        subjectTitle: 'Pharmacology',
        title: 'Antihypertensives: ACE Inhibitors & ARBs',
        pathway: 'Both',
        readingMinutes: 7,
        nclexYield: 'Essential',
        summary: 'Renin-angiotensin-aldosterone system blockers for hypertension, heart failure, and diabetic nephropathy protection.',
        keyConcepts: ['ACE inhibitors end in -pril (e.g., Lisinopril, Enalapril)', 'ARBs end in -sartan (e.g., Losartan, Valsartan)', 'Block conversion of Angiotensin I to II or block AT1 receptors', 'Risk of hyperkalemia and angioedema'],
        clinicalPriorities: ['Monitor blood pressure before administration; hold for systolic BP < 90 or symptomatic hypotension', 'Check baseline serum potassium and creatinine; both drug classes spare potassium and can cause hyperkalemia', 'Angioedema (swelling of tongue/lips/airway) is a medical emergency requiring immediate airway protection', 'ACE inhibitor cough is caused by bradykinin accumulation; switch to ARB if intolerable'],
        nclexAlerts: ['NCLEX Alert: Teratogenic in pregnancy (Category D/X). Women of childbearing age must use reliable contraception.'],
        notes: [
          { heading: 'First-Dose Phenomenon', points: ['Severe orthostatic hypotension can occur with first dose.', 'Instruct patient to change positions slowly and take first dose at bedtime.'] },
        ],
      },
      {
        id: 'pharm-anticoagulants',
        slug: 'anticoagulants-heparin-warfarin',
        subjectSlug: 'pharmacology',
        subjectTitle: 'Pharmacology',
        title: 'Anticoagulants: Heparin, Warfarin & DOACs',
        pathway: 'Both',
        readingMinutes: 10,
        nclexYield: 'Very High',
        summary: 'Parenteral and oral anticoagulants used for DVT, PE, and stroke prevention in atrial fibrillation.',
        keyConcepts: ['Heparin acts immediately via antithrombin III; monitored with aPTT', 'Warfarin blocks Vitamin K clotting factors; monitored with PT/INR', 'Heparin antidote: Protamine Sulfate', 'Warfarin antidote: Vitamin K (Phytonadione) and Kcentra'],
        clinicalPriorities: ['Normal aPTT is 30-40 sec; therapeutic on Heparin is 1.5 - 2.5x baseline (60-80 seconds)', 'Normal INR is 0.8-1.2; therapeutic on Warfarin is 2.0 - 3.0 (2.5 - 3.5 for mechanical heart valves)', 'Watch for Heparin-Induced Thrombocytopenia (HIT): platelet drop > 50% from baseline requires immediate cessation', 'Maintain consistent dietary intake of green leafy vegetables (Vitamin K) on Warfarin; do not abruptly increase or eliminate'],
        nclexAlerts: ['NCLEX Alert: Never administer Warfarin to pregnant patients (teratogenic); Heparin is the anticoagulant of choice in pregnancy.'],
        comparisonTable: {
          title: 'Heparin vs Warfarin Comparison',
          headers: ['Parameter', 'Heparin (Unfractionated)', 'Warfarin (Coumadin)'],
          rows: [
            ['Route', 'IV or Subcutaneous only', 'Oral (PO) only'],
            ['Onset', 'Immediate (minutes)', 'Slow (3 - 5 days for full effect)'],
            ['Lab Monitoring', 'aPTT (therapeutic 60 - 80s)', 'PT / INR (therapeutic 2.0 - 3.0)'],
            ['Reversal Antidote', 'Protamine Sulfate', 'Vitamin K (Phytonadione)'],
            ['Pregnancy Safety', 'Safe (does not cross placenta)', 'Contraindicated (teratogenic)'],
          ],
        },
        notes: [
          { heading: 'Bleeding Precautions (RANDI)', points: ['Razor: Electric razors only', 'Aspirin: Avoid unless prescribed', 'Needles: Small gauge, avoid unnecessary venipunctures', 'Decreased needle sticks', 'Injury prevention: Soft toothbrush, avoid contact sports'] },
        ],
      },
      {
        id: 'pharm-insulin',
        slug: 'insulins-and-antidiabetics',
        subjectSlug: 'pharmacology',
        subjectTitle: 'Pharmacology',
        title: 'Insulins & Oral Antidiabetic Regimens',
        pathway: 'Both',
        readingMinutes: 9,
        nclexYield: 'Essential',
        summary: 'Rapid, short, intermediate, and long-acting insulins. Mixing technique, hypoglycemia protocols, and oral hypoglycemics.',
        keyConcepts: ['Rapid-acting (Lispro, Aspart): onset 15 min; give with food in front of patient', 'Regular insulin (Short-acting): only insulin given IV; onset 30-60 min', 'NPH (Intermediate): cloudy, onset 1-2 hr, peak 4-12 hr', 'Glargine/Detemir (Long-acting): no peak, do not mix with other insulins in same syringe'],
        clinicalPriorities: ['Hypoglycemia is blood glucose < 70 mg/dL: signs include shakiness, diaphoresis, tachycardia, confusion', 'Rule of 15: Give 15g fast-acting carbs (4 oz juice), wait 15 min, recheck. If unconscious, give IV Dextrose 50% or IM Glucagon', 'Drawing up mixed insulins: Clear before Cloudy (Air into NPH, Air into Regular, Draw Regular, Draw NPH)', 'Metformin (Glucophage): Hold 48 hours prior to and after contrast dye procedures to prevent lactic acidosis and renal failure'],
        nclexAlerts: ['NCLEX Alert: Peak is when hypoglycemia is most likely to occur! NPH peaks in 4 - 12 hours (mid-afternoon snack is mandatory).'],
        notes: [
          { heading: 'Insulin Mixing Mnemonic', points: ['RN: Regular before NPH.', 'Inject air into NPH (cloudy), inject air into Regular (clear), withdraw Regular, withdraw NPH.'] },
        ],
      },
    ],
  },
  {
    slug: 'med-surg',
    title: 'Medical-Surgical Nursing',
    description: 'Pathophysiology, multi-system disorders, ABG interpretation, cardiac, respiratory, renal, and oncology management.',
    iconName: 'Activity',
    topicCount: 15,
    topics: [
      {
        id: 'ms-abg',
        slug: 'abg-interpretation-and-acid-base',
        subjectSlug: 'med-surg',
        subjectTitle: 'Medical-Surgical',
        title: 'Arterial Blood Gas (ABG) & Acid-Base Disorders',
        pathway: 'Both',
        readingMinutes: 8,
        nclexYield: 'Essential',
        summary: 'ROME method for respiratory vs metabolic acidosis and alkalosis, compensation states, and clinical causes.',
        keyConcepts: ['Normal pH: 7.35 - 7.45', 'Normal PaCO2: 35 - 45 mmHg (respiratory component)', 'Normal HCO3: 22 - 26 mEq/L (metabolic component)', 'ROME: Respiratory Opposite, Metabolic Equal'],
        clinicalPriorities: ['Uncompensated: pH abnormal, one parameter abnormal, other parameter normal', 'Partially Compensated: pH abnormal, BOTH PaCO2 and HCO3 are abnormal', 'Fully Compensated: pH is in normal range (7.35-7.45), but both PaCO2 and HCO3 are abnormal', 'Respiratory Acidosis causes: COPD, hypoventilation, opioid overdose, atelectasis', 'Respiratory Alkalosis causes: hyperventilation, panic attack, fever, mechanical overventilation', 'Metabolic Acidosis causes: DKA, renal failure, severe diarrhea (base out the butt)', 'Metabolic Alkalosis causes: prolonged vomiting, NG suctioning (acid out the mouth), antacid overuse'],
        nclexAlerts: ['NCLEX Alert: Remember potassium shifts! Acidosis causes Hyperkalemia (K+ moves out of cells as H+ enters). Alkalosis causes Hypokalemia.'],
        comparisonTable: {
          title: 'Acid-Base Disorders Quick Matrix',
          headers: ['Disorder', 'pH', 'PaCO2', 'HCO3', 'Common Etiologies'],
          rows: [
            ['Respiratory Acidosis', '< 7.35', '> 45', 'Normal or > 26 (compensating)', 'COPD, Opioid overdose, Pneumothorax'],
            ['Respiratory Alkalosis', '> 7.45', '< 35', 'Normal or < 22 (compensating)', 'Hyperventilation, Severe anxiety, High altitude'],
            ['Metabolic Acidosis', '< 7.35', 'Normal or < 35', '< 22', 'DKA, Renal failure, Diarrhea, Lactic acidosis'],
            ['Metabolic Alkalosis', '> 7.45', 'Normal or > 45', '> 26', 'Vomiting, Nasogastric suction, Thiazide diuretics'],
          ],
        },
        notes: [
          { heading: 'Allen Test Before Radial Puncture', points: ['Compress both radial and ulnar arteries until palm blanches.', 'Release ulnar artery; hand should re-pink within 5-7 seconds (positive test indicates collateral circulation).'] },
        ],
      },
      {
        id: 'ms-heart-failure',
        slug: 'heart-failure-and-cardiogenic-shock',
        subjectSlug: 'med-surg',
        subjectTitle: 'Medical-Surgical',
        title: 'Heart Failure: Left vs. Right Sided Pathophysiology',
        pathway: 'Both',
        readingMinutes: 9,
        nclexYield: 'Very High',
        summary: 'Clinical differences between left-sided pulmonary congestion and right-sided systemic venous congestion. BNP diagnostic biomarker.',
        keyConcepts: ['Left-sided HF affects Lungs (pulmonary edema, crackles, orthopnea, pink frothy sputum)', 'Right-sided HF affects Rest of Body (JVD, peripheral edema, ascites, hepatomegaly)', 'BNP > 100 pg/mL differentiates cardiac from respiratory dyspnea'],
        clinicalPriorities: ['Daily morning weights after voiding before breakfast; notify provider for 2-3 lb gain in 24 hrs or 5 lb in a week', 'Low-sodium diet (typically 2,000 mg/day) and fluid restriction as prescribed', 'Positioning: High-Fowler position decreases preload and facilitates lung expansion', 'Administer loop diuretics (Furosemide) and monitor urine output and potassium levels'],
        nclexAlerts: ['NCLEX Alert: Frothy pink-tinged sputum indicates acute pulmonary edema — a life-threatening emergency requiring immediate high-flow oxygen, IV furosemide, and morphine.'],
        notes: [
          { heading: 'Pharmacologic Pillars for HF', points: ['ACE Inhibitors / ARBs: Decrease afterload and prevent ventricular remodeling.', 'Beta Blockers (Carvedilol, Metoprolol succinate): Decrease myocardial workload and sympathetic drive.', 'Loop Diuretics (Furosemide): Reduce volume overload.', 'Aldosterone Antagonists (Spironolactone): Prevent myocardial fibrosis.'] },
        ],
      },
    ],
  },
  {
    slug: 'fundamentals',
    title: 'Fundamentals of Nursing',
    description: 'Infection control, transmission precautions, sterile technique, wound staging, vital signs, and safety protocols.',
    iconName: 'Shield',
    topicCount: 10,
    topics: [
      {
        id: 'fund-precautions',
        slug: 'infection-control-and-isolation-precautions',
        subjectSlug: 'fundamentals',
        subjectTitle: 'Fundamentals',
        title: 'Transmission-Based Isolation Precautions & PPE Donning/Doffing',
        pathway: 'Both',
        readingMinutes: 7,
        nclexYield: 'Essential',
        summary: 'Contact, Droplet, and Airborne precautions. Exact PPE sequences and negative pressure room criteria.',
        keyConcepts: ['Airborne (MTV): Measles, TB, Varicella (N95 mask, negative pressure room, private room)', 'Droplet (SPIDERMAN): Sepsis, Pertussis, Influenza, Diphtheria, Epiglottitis, Rubella, Mumps, Adenovirus, Neisseria meningitidis (Surgical mask within 3-6 feet)', 'Contact (MRS WEE): MRSA, RSV, Skin infections, Wound infections, Enteric (C. diff), Eye infections (Gown and Gloves)', 'C. diff requires soap and water; alcohol-based hand rub does NOT kill spores!'],
        clinicalPriorities: ['Donning PPE Order: Gown → Mask/Respirator → Goggles/Face Shield → Gloves (Up the body, hands last)', 'Doffing PPE Order: Gloves → Goggles/Face Shield → Gown → Mask/Respirator (Alphabetical order: G-L-O-V-E-S first, Mask outside room)', 'For Airborne transport: Place a standard surgical mask on the PATIENT when leaving the room', 'C. diff, Norovirus, and Bacillus anthracis require dedicated equipment (single patient use) and bleach-based disinfection'],
        nclexAlerts: ['NCLEX Alert: Hand hygiene with soap and water for minimum 20 seconds is mandatory for C. difficile — sanitizers are ineffective against spores.'],
        comparisonTable: {
          title: 'Isolation Precautions Quick Guide',
          headers: ['Precaution', 'Required PPE', 'Room Setup', 'Classic Pathogens'],
          rows: [
            ['Airborne', 'N95 respirator (fitted)', 'Negative airflow room (AIIR), door closed', 'Tuberculosis, Rubeola (Measles), Varicella (Chickenpox), Disseminated Shingles'],
            ['Droplet', 'Surgical mask within 3-6 ft', 'Private room (or cohort with same organism)', 'Influenza, Meningococcal meningitis, Pertussis (Whooping cough), Rubella'],
            ['Contact', 'Gown + Gloves upon entry', 'Private room (or cohort)', 'C. diff, MRSA, VRE, Scabies, RSV'],
          ],
        },
        notes: [
          { heading: 'Sterile Technique Essentials', points: ['The 1-inch border around sterile field is considered unsterile.', 'Never turn your back on a sterile field or drop hands below waist level.', 'Moisture permeating sterile drape contaminates the field via capillary action (strike-through).'] },
        ],
      },
    ],
  },
  {
    slug: 'pediatrics',
    title: 'Pediatric Nursing',
    description: 'Developmental milestones, congenital cardiac defects, pediatric respiratory emergencies, and immunization schedules.',
    iconName: 'Baby',
    topicCount: 10,
    topics: [
      {
        id: 'ped-chd',
        slug: 'congenital-heart-defects-pediatrics',
        subjectSlug: 'pediatrics',
        subjectTitle: 'Pediatrics',
        title: 'Congenital Heart Defects: Acyanotic vs Cyanotic',
        pathway: 'Both',
        readingMinutes: 8,
        nclexYield: 'Very High',
        summary: 'Left-to-right shunts (acyanotic) vs Right-to-left shunts (cyanotic). Tetralogy of Fallot Tet spells management.',
        keyConcepts: ['Acyanotic (Left-to-right): VSD, ASD, PDA, Coarctation (increased pulmonary blood flow, fatigue with feeding, normal O2 saturation)', 'Cyanotic (Right-to-left): Tetralogy of Fallot, Transposition of Great Arteries (starts with "T" = Trouble, deoxygenated blood to body, cyanosis, polycythemia)', 'Tetralogy of Fallot 4 Defects (DROP): Defect (VSD), Right ventricular hypertrophy, Overriding aorta, Pulmonary stenosis'],
        clinicalPriorities: ['Hypercyanotic "Tet" spell: Place infant immediately in knee-to-chest position to increase systemic vascular resistance and shunt blood into lungs', 'Administer 100% blow-by oxygen and IV Morphine to relax infundibular spasm during Tet spell', 'Polycythemia (elevated hematocrit > 65%) occurs from chronic hypoxemia; keep infant well-hydrated to prevent thromboembolism', 'Coarctation of Aorta sign: High BP and bounding pulses in upper extremities, low BP and diminished/absent femoral pulses in lower extremities'],
        nclexAlerts: ['NCLEX Alert: Priority action for a crying infant with Tetralogy of Fallot turning blue is Knee-to-Chest position FIRST before administering oxygen or medications.'],
        notes: [
          { heading: 'Feeding Strategies for Infants with Congenital Heart Failure', points: ['Use enlarged nipple opening to reduce infant energy expenditure.', 'Feed on demand or every 3 hours; limit feeding time to 30 minutes to prevent exhaustion.', 'Fortify breast milk or formula with supplemental calories.'] },
        ],
      },
    ],
  },
  {
    slug: 'maternity',
    title: 'Maternal & Newborn Nursing (OB)',
    description: 'Antenatal care, stages of labor, FHR tracing interpretation (VEAL CHOP), preeclampsia, and postpartum complications.',
    iconName: 'HeartHandshake',
    topicCount: 10,
    topics: [
      {
        id: 'mat-fhr',
        slug: 'fetal-heart-rate-monitoring-veal-chop',
        subjectSlug: 'maternity',
        subjectTitle: 'Maternity',
        title: 'Fetal Heart Rate Monitoring & VEAL CHOP Mnemonics',
        pathway: 'Both',
        readingMinutes: 8,
        nclexYield: 'Essential',
        summary: 'Baseline FHR, accelerations, variable, early, and late decelerations. Intrauterine resuscitation protocols.',
        keyConcepts: ['Normal baseline FHR: 110 - 160 bpm', 'VEAL CHOP Mnemonic: Variable = Cord compression, Early = Head compression, Acceleration = Okay, Late = Placental insufficiency', 'Early decelerations mirror contractions; benign, no intervention required', 'Late and Variable decelerations are non-reassuring and require immediate intervention'],
        clinicalPriorities: ['Intrauterine Resuscitation Protocol (LION): Left lateral position, Increase IV fluids, Oxygen at 8-10 L/min via non-rebreather mask, Notify provider', 'Turn off Pitocin (Oxytocin) infusion immediately if tachysystole (> 5 contractions in 10 minutes) or non-reassuring FHR occurs', 'Variable decelerations: Reposition mother to side or hands-and-knees to relieve cord compression; consider amnioinfusion if severe', 'Magnesium Sulfate for Preeclampsia: Monitor for toxicity (absent deep tendon reflexes, RR < 12, urine output < 30 mL/hr). Antidote: Calcium Gluconate'],
        nclexAlerts: ['NCLEX Alert: Late decelerations indicate uteroplacental insufficiency. The absolute FIRST nursing intervention is to TURN OFF Oxytocin (Pitocin) and turn the patient to their left side.'],
        comparisonTable: {
          title: 'VEAL CHOP Decoding Chart',
          headers: ['Pattern', 'Cause', 'Clinical Significance', 'Nursing Priority'],
          rows: [
            ['Variable Decels', 'Cord compression', 'Abrupt drop & return to baseline (V or W shape)', 'Change maternal position; administer O2; stop oxytocin'],
            ['Early Decels', 'Head compression', 'Gradual dip mirroring contraction curve', 'Benign finding; continue to monitor; prepare for delivery'],
            ['Accelerations', 'Oxygenation / movement', '15 bpm increase lasting 15 seconds', 'Reassuring finding; normal fetal autonomic control'],
            ['Late Decels', 'Placental insufficiency', 'Deceleration begins after contraction peak', 'LION protocol; emergency C-section if uncorrected'],
          ],
        },
        notes: [
          { heading: 'APGAR Scoring (At 1 and 5 minutes)', points: ['Appearance (Color): 0 = blue/pale, 1 = acrocyanotic, 2 = completely pink', 'Pulse: 0 = absent, 1 = < 100 bpm, 2 = > 100 bpm', 'Grimace: 0 = none, 1 = grimace/weak cry, 2 = vigorous cry/pulls away', 'Activity (Muscle Tone): 0 = flaccid, 1 = some flexion, 2 = active motion', 'Respiration: 0 = absent, 1 = slow/irregular, 2 = strong vigorous cry'] },
        ],
      },
    ],
  },
  {
    slug: 'mental-health',
    title: 'Mental Health & Psychiatric Nursing',
    description: 'Therapeutic communication, schizophrenia, bipolar mania, major depression, crisis de-escalation, and psychiatric medications.',
    iconName: 'Brain',
    topicCount: 10,
    topics: [
      {
        id: 'mh-communication',
        slug: 'therapeutic-communication-and-defense-mechanisms',
        subjectSlug: 'mental-health',
        subjectTitle: 'Mental Health',
        title: 'Therapeutic Communication & Board Exam Traps',
        pathway: 'Both',
        readingMinutes: 7,
        nclexYield: 'Essential',
        summary: 'Open-ended questioning, acknowledging feelings, silence, and avoiding false reassurance or "Why" questions.',
        keyConcepts: ['Focus on feelings rather than facts', 'Never ask "Why?" questions (causes defensiveness)', 'Never offer false reassurance ("Everything is going to be fine")', 'Never agree with or argue with delusions or hallucinations; acknowledge feelings and state reality'],
        clinicalPriorities: ['Hallucinating client: "I do not see the spiders on the wall, but I understand that they are frightening to you."', 'Suicidal ideation assessment: Always ask directly: "Are you thinking about hurting or killing yourself? Do you have a specific plan?"', 'Delusional client: Do not debate or reinforce delusion; gently present reality and redirect to neutral activity', 'Restraints are absolute last resort: Must have active provider order within 1 hour; assess skin integrity, pulses, and neurovascular status every 15-30 minutes'],
        nclexAlerts: ['NCLEX Alert: Select the answer that acknowledges emotion and keeps communication open. Avoid answers that pass responsibility ("I\'ll call your doctor") or minimize feelings.'],
        notes: [
          { heading: 'Lithium Toxicity Protocols', points: ['Therapeutic range: 0.6 - 1.2 mEq/L (Acute mania: up to 1.5 mEq/L).', 'Toxicity occurs at > 1.5 mEq/L: coarse hand tremors, persistent GI upset, confusion, ataxia, seizures.', 'Ensure adequate fluid (2-3 L/day) and stable sodium intake; low sodium causes toxic lithium retention!'] },
        ],
      },
    ],
  },
  {
    slug: 'critical-care',
    title: 'Critical Care & Emergency Nursing',
    description: 'Shock states, hemodynamic monitoring, ACLS algorithms, mechanical ventilation, and Glasgow Coma Scale.',
    iconName: 'Flame',
    topicCount: 10,
    topics: [
      {
        id: 'cc-shock',
        slug: 'shock-pathophysiology-and-hemodynamics',
        subjectSlug: 'critical-care',
        subjectTitle: 'Critical Care',
        title: 'Shock Syndromes: Hypovolemic, Septic, Cardiogenic & Anaphylactic',
        pathway: 'RN',
        readingMinutes: 9,
        nclexYield: 'Very High',
        summary: 'Stages of shock, compensatory mechanisms, Mean Arterial Pressure (MAP), fluid resuscitation, and vasopressor selection.',
        keyConcepts: ['MAP = (SBP + 2*DBP) / 3; MAP > 65 mmHg is mandatory for vital organ perfusion', 'Hypovolemic Shock: Low CVP, low BP, high HR, cold clammy skin (give isotonic crystalloids: 0.9% NS or LR)', 'Septic Shock: Systemic vasodilation; warm flushed skin early, then cold; lactate > 2 mmol/L (give 30 mL/kg fluid bolus + broad-spectrum antibiotics within 1 hour)', 'Cardiogenic Shock: Pump failure; high CVP, low CO, pulmonary crackles (DO NOT give massive fluids; use inotropes like Dobutamine)', 'Anaphylactic Shock: Immediate IM Epinephrine 1:1,000 (0.3 - 0.5 mg) in anterolateral thigh'],
        clinicalPriorities: ['Sepsis Hour-1 Bundle: Measure lactate level, obtain blood cultures PRIOR to antibiotics, administer broad-spectrum antibiotics, administer 30 mL/kg crystalloids for hypotension/lactate >= 4, apply vasopressors (Norepinephrine) if hypotensive during/after resuscitation to maintain MAP >= 65', 'Anaphylaxis sequence: Stop causative infusion → Administer IM Epinephrine → High-flow O2 → IV fluids → Diphenhydramine & Corticosteroids', 'Arterial line zeroing: Phlebostatic axis is at 4th intercostal space, mid-axillary line (level of right atrium)'],
        nclexAlerts: ['NCLEX Alert: Epinephrine IM is the single first-line treatment for anaphylaxis. Antihistamines and steroids are secondary adjuncts and do not reverse bronchospasm or laryngeal edema.'],
        comparisonTable: {
          title: 'Hemodynamic Profiles in Different Shock Types',
          headers: ['Shock Type', 'Preload (CVP)', 'Cardiac Output (CO)', 'Afterload (SVR)', 'Skin Exam'],
          rows: [
            ['Hypovolemic', 'Decreased (< 2 mmHg)', 'Decreased', 'Increased (compensatory)', 'Pale, cool, clammy'],
            ['Cardiogenic', 'Increased (> 8 mmHg)', 'Severely decreased', 'Increased', 'Cool, mottled, crackles'],
            ['Septic (Early distributive)', 'Decreased or normal', 'Increased (hyperdynamic)', 'Decreased (massive vasodilation)', 'Warm, flushed, bounding pulse'],
            ['Neurogenic', 'Decreased', 'Decreased', 'Severely decreased', 'Warm, dry; Bradycardia (unique!)'],
          ],
        },
        notes: [
          { heading: 'Ventilator Alarms', points: ['High Pressure Alarm: Secretions, patient biting tube, kinking, pneumothorax, fighting ventilator.', 'Low Pressure Alarm: Disconnection of tubing, cuff leak, extubation.'] },
        ],
      },
    ],
  },
  {
    slug: 'leadership',
    title: 'Leadership, Delegation & Priority Setting',
    description: 'NCSBN delegation tree, RN vs LPN vs UAP assignments, ABCs, Maslow hierarchy, and triage prioritization.',
    iconName: 'Compass',
    topicCount: 10,
    topics: [
      {
        id: 'lead-delegation',
        slug: 'ncsbn-delegation-principles-rn-lpn-uap',
        subjectSlug: 'leadership',
        subjectTitle: 'Leadership',
        title: 'NCSBN Five Rights of Delegation (RN vs LPN vs UAP)',
        pathway: 'Both',
        readingMinutes: 8,
        nclexYield: 'Essential',
        summary: 'Absolute legal rules for what cannot be delegated (EAT: Evaluate, Assess, Teach) and exact LPN/UAP scope.',
        keyConcepts: ['RN cannot delegate EAT: Evaluate, Assess, Teach', 'RN handles: unstable patients, initial assessments, post-op receiving, discharge instructions, blood transfusions, IV push drugs', 'LPN handles: stable patients with predictable outcomes, sterile dressing changes, Foley catheter insertion, enteral feedings, PO/SubQ/IM meds', 'UAP handles: ADLs, ambulation of stable clients, vitals on stable clients, intake & output, hygiene'],
        clinicalPriorities: ['Five Rights of Delegation: Right Task, Right Circumstance, Right Person, Right Direction/Communication, Right Supervision/Evaluation', 'Never delegate tasks to UAP that involve clinical judgment, assessment, or interpretation of findings', 'LPN cannot administer IV chemotherapy or blood products', 'If a client is experiencing an acute status change (e.g., sudden chest pain, drop in oxygen saturation), the RN must personally assess immediately'],
        nclexAlerts: ['NCLEX Alert: Priority Question Strategy: 1) Systemic over local, 2) Acute over chronic, 3) Actual problem over potential risk, 4) Unexpected findings over expected disease findings.'],
        comparisonTable: {
          title: 'Delegation Matrix: RN vs LPN vs UAP',
          headers: ['Clinical Activity', 'RN', 'LPN / LVN', 'UAP / CNA'],
          rows: [
            ['Initial Patient Admission Assessment', 'Yes (Mandatory)', 'No (Collects data only)', 'No'],
            ['Administer Oral / SubQ Medications', 'Yes', 'Yes (Stable patients)', 'No'],
            ['Administer IV Push Cardiac Drugs', 'Yes', 'No (In most state practice acts)', 'No'],
            ['Teach Newly Diagnosed Diabetics', 'Yes', 'Can reinforce teaching only', 'No'],
            ['Perform Vital Signs on Stable Client', 'Yes', 'Yes', 'Yes (Reports abnormal to nurse)'],
            ['Reposition Bedbound Patient / Hygiene', 'Yes', 'Yes', 'Yes'],
          ],
        },
        notes: [
          { heading: 'Disaster Triage Colors (START)', points: ['Red (Immediate): Life-threatening but salvageable (e.g., airway obstruction, tension pneumothorax).', 'Yellow (Delayed): Serious, non-life-threatening within 2 hours (e.g., open fracture with pulse).', 'Green (Minimal / Walking Wounded): Minor cuts, abrasions, can wait several hours.', 'Black (Expectant): Deceased or catastrophic injuries incompatible with life given current resources.'] },
        ],
      },
    ],
  },
  {
    slug: 'dosage-calc',
    title: 'Dosage Calculations & Pharmacology Math',
    description: 'Dimensional analysis, IV drip rates (gtt/min), infusion pumps (mL/hr), weight-based pediatric dosing, and heparin titration.',
    iconName: 'Calculator',
    topicCount: 8,
    topics: [
      {
        id: 'calc-iv-drips',
        slug: 'iv-flow-rates-and-weight-based-math',
        subjectSlug: 'dosage-calc',
        subjectTitle: 'Dosage Calculation',
        title: 'IV Flow Rates (gtt/min & mL/hr) & Safe Weight-Based Math',
        pathway: 'Both',
        readingMinutes: 7,
        nclexYield: 'Essential',
        summary: 'Drop factor formula, IV pump setting, kg conversions, and rounding rules for clinical safety.',
        keyConcepts: ['Formula for IV Pump: (Total Volume in mL) / (Time in Hours) = mL/hr', 'Formula for Gravity Drips: (Volume in mL / Time in Minutes) * Drop Factor (gtt/mL) = gtt/min', 'Round gtt/min to the nearest whole drop (cannot count fractional drops)', '1 kg = 2.2 lbs (always convert weight before calculating mg/kg dose)'],
        clinicalPriorities: ['Always verify whether question asks for mL/hr (infusion pump) or gtt/min (gravity tubing)', 'Microdrip tubing drop factor is ALWAYS 60 gtt/mL (mL/hr equals gtt/min!)', 'Leading and trailing zeros: ALWAYS use leading zero (0.5 mg), NEVER use trailing zero (5.0 mg is dangerous)', 'Pediatric safe dose range: Always calculate minimum and maximum safe daily dose; if prescribed dose exceeds max, hold medication and call provider'],
        nclexAlerts: ['NCLEX Alert: Remember to check units carefully! If an infusion is ordered in mcg/kg/min, convert patient weight to kg, multiply by minutes (60), convert mcg to mg, and solve for mL/hr.'],
        comparisonTable: {
          title: 'Essential Clinical Conversion Reference',
          headers: ['Metric Unit', 'Clinical Equivalent', 'Household Equivalent'],
          rows: [
            ['1 Kilogram (kg)', '1,000 Grams (g)', '2.2 Pounds (lb)'],
            ['1 Gram (g)', '1,000 Milligrams (mg)', '—'],
            ['1 Milligram (mg)', '1,000 Micrograms (mcg)', '—'],
            ['1 Liter (L)', '1,000 Milliliters (mL)', '1 Quart (approx)'],
            ['1 Teaspoon (tsp)', '5 Milliliters (mL)', '1 tsp'],
            ['1 Tablespoon (tbsp)', '15 Milliliters (mL)', '3 teaspoons'],
            ['1 Fluid Ounce (oz)', '30 Milliliters (mL)', '2 tablespoons'],
          ],
        },
        notes: [
          { heading: 'Step-by-Step Sample Problem', points: ['Order: 1,000 mL 0.9% NS IV over 8 hours. Tubing drop factor: 15 gtt/mL.', 'Step 1: Calculate total minutes: 8 hours * 60 = 480 minutes.', 'Step 2: Apply formula: (1,000 mL / 480 min) * 15 gtt/mL = 31.25.', 'Step 3: Round to whole number: 31 gtt/min.'] },
        ],
      },
    ],
  },
];

export function getAllStudyGuideTopics(): StudyGuideTopicItem[] {
  return STUDY_GUIDE_CATALOGUE.flatMap((s) => s.topics);
}

export function getStudyGuideSubjectBySlug(slug: string): StudyGuideSubjectItem | undefined {
  return STUDY_GUIDE_CATALOGUE.find((s) => s.slug === slug);
}

export function getStudyGuideTopicBySlug(subjectSlug: string, topicSlug: string): StudyGuideTopicItem | undefined {
  const subject = getStudyGuideSubjectBySlug(subjectSlug);
  if (!subject) return undefined;
  return subject.topics.find((t) => t.slug === topicSlug);
}
