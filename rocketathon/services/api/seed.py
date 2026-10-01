"""Seed the knowledge base, pharmacy formulary and lab reference ranges with embeddings.

    python seed.py
    python seed.py --skip-formulary     # only top up the knowledge base
"""

from __future__ import annotations

import argparse
import sys
import time

from db import vector
from db.supabase import get_supabase, maybe_one, match_where

# ================================================================ formulary
FORMULARY = [
    ("Glucophage", "metformin", "500 mg", "tablet", 12.0),
    ("Glucophage", "metformin", "1 g", "tablet", 22.0),
    ("Meto", "metformin", "850 mg", "tablet", 15.0),
    ("Daonil", "glibenclamide", "5 mg", "tablet", 6.0),
    ("Amaryl", "glimepiride", "1 mg", "tablet", 9.0),
    ("Lantus", "insulin glargine", "100 IU/ml", "injection", 2650.0),
    ("NovoMix", "insulin aspart", "100 IU/ml", "injection", 3180.0),
    ("Insulin Mixtard", "insulin human 30/70", "100 IU/ml", "injection", 1420.0),
    ("Accupril", "quinapril", "10 mg", "tablet", 14.0),
    ("Zestril", "lisinopril", "5 mg", "tablet", 8.0),
    ("Capoten", "captopril", "25 mg", "tablet", 5.0),
    ("Norvasc", "amlodipine", "5 mg", "tablet", 11.0),
    ("Cozaar", "losartan", "50 mg", "tablet", 18.0),
    ("Lopressor", "metoprolol", "25 mg", "tablet", 7.0),
    ("Cordilol", "atenolol", "50 mg", "tablet", 5.0),
    ("Lipitor", "atorvastatin", "20 mg", "tablet", 26.0),
    ("Atorva", "atorvastatin", "40 mg", "tablet", 34.0),
    ("Zocor", "simvastatin", "20 mg", "tablet", 19.0),
    ("Aspirin", "acetylsalicylic acid", "75 mg", "tablet", 2.0),
    ("Plavix", "clopidogrel", "75 mg", "tablet", 42.0),
    ("Lovenox", "enoxaparin", "40 mg", "injection", 1980.0),
    ("Calpol", "paracetamol", "500 mg", "tablet", 3.0),
    ("Panadol", "paracetamol", "500 mg", "tablet", 3.0),
    ("Brufen", "ibuprofen", "400 mg", "tablet", 8.0),
    ("Ponstan", "mefenamic acid", "250 mg", "tablet", 7.0),
    ("Augmentin", "amoxicillin + clavulanic acid", "625 mg", "tablet", 96.0),
    ("Amoxil", "amoxicillin", "500 mg", "capsule", 24.0),
    ("Zithromax", "azithromycin", "500 mg", "tablet", 88.0),
    ("Ciprorex", "ciprofloxacin", "500 mg", "tablet", 52.0),
    ("Flagyl", "metronidazole", "400 mg", "tablet", 6.0),
    ("Lasix", "furosemide", "40 mg", "tablet", 9.0),
    ("Aldactone", "spironolactone", "25 mg", "tablet", 16.0),
    ("Ventolin", "salbutamol", "100 mcg", "inhaler", 640.0),
    ("Seretide", "salmeterol + fluticasone", "25/250 mcg", "inhaler", 1980.0),
    ("Eltroxin", "levothyroxine", "50 mcg", "tablet", 10.0),
    ("Gabapentin", "gabapentin", "300 mg", "capsule", 31.0),
    ("Lyrica", "pregabalin", "75 mg", "capsule", 88.0),
    ("Zoloft", "sertraline", "50 mg", "tablet", 64.0),
    ("Tramadol", "tramadol", "50 mg", "capsule", 14.0),
    ("Dulcolax", "senna", "5 mg", "tablet", 11.0),
    ("Onset", "ondansetron", "4 mg", "tablet", 18.0),
    ("Comfortex", "domperidone", "10 mg", "tablet", 12.0),
]

# ================================================================ lab reference ranges
# test_name, unit, sex, age_low, age_high, low, high, crit_low, crit_high, note
REFERENCE_RANGES = [
    ("Fasting Blood Glucose", "mmol/L", None, None, None, 3.9, 5.5, 3.0, 25.0, "Above 7.0 suggests diabetes; 11.1 mmol/L is the diagnostic threshold"),
    ("Random Blood Glucose", "mmol/L", None, None, None, 3.9, 7.8, 3.0, 25.0, "11.1 mmol/L or above with symptoms is diagnostic of diabetes"),
    ("HbA1c", "%", None, None, None, 4.0, 5.6, None, 14.0, "6.5% or above is diagnostic of diabetes"),
    ("Haemoglobin", "g/dL", "male", 15, None, 13.0, 17.0, 7.0, 20.0, "Below 8 is moderate anaemia needing treatment"),
    ("Haemoglobin", "g/dL", "female", 15, None, 12.0, 15.0, 7.0, 20.0, "Below 8 is moderate anaemia needing treatment"),
    ("Haemoglobin", "g/dL", None, 0, 14, 11.0, 16.0, 7.0, 20.0, "Paediatric range"),
    ("Serum Potassium", "mmol/L", None, None, None, 3.5, 5.1, 2.8, 6.2, "Above 6.2 or below 2.8 is a medical emergency, risk of arrhythmia"),
    ("Serum Sodium", "mmol/L", None, None, None, 135.0, 145.0, 125.0, 155.0, "Below 125 or above 155 needs urgent assessment"),
    ("Serum Creatinine", "mg/dL", "male", None, None, 0.7, 1.3, None, 4.0, "eGFR is more useful than creatinine alone"),
    ("Serum Creatinine", "mg/dL", "female", None, None, 0.6, 1.1, None, 4.0, "eGFR is more useful than creatinine alone"),
    ("eGFR", "mL/min/1.73m2", None, None, None, 90.0, 120.0, 15.0, None, "Below 60 means chronic kidney disease, below 30 needs specialist referral"),
    ("Urine Albumin Creatinine Ratio", "mg/g", None, None, None, 0.0, 30.0, None, None, "Above 30 indicates kidney damage, above 300 severe"),
    ("Platelet Count", "x10^9/L", None, None, None, 150.0, 450.0, 50.0, 1000.0, "Below 20 is a bleeding emergency"),
    ("Total Leucocyte Count", "x10^9/L", None, None, None, 4.0, 11.0, 1.0, 30.0, "Below 1 means the patient cannot fight infection"),
    ("Neutrophil Count", "x10^9/L", None, None, None, 2.0, 7.5, 0.5, None, "Below 0.5 is neutropenic and an emergency if febrile"),
    ("Hematocrit", "%", None, None, None, 40.0, 52.0, 20.0, 60.0, "Adult male range"),
    ("White Blood Cell Count", "x10^9/L", None, None, None, 4.0, 11.0, 1.0, 30.0, "Leucocytosis suggests infection or inflammation"),
    ("Serum Urea", "mg/dL", None, None, None, 15.0, 40.0, None, 150.0, "Rises in dehydration and kidney impairment"),
    ("Serum Creatinine Ratio UCR", None, None, None, None, None, None, None, None, "Placeholder removed"),
    ("Serum Bilirubin", "mg/dL", None, None, None, 0.2, 1.2, None, 15.0, "Marked jaundice needs assessment"),
    ("SGPT ALT", "U/L", None, None, None, 7.0, 45.0, None, 500.0, "Hepatitis and drug induced liver injury"),
    ("SGOT AST", "U/L", None, None, None, 8.0, 40.0, None, 500.0, "Hepatitis and muscle injury"),
    ("Serum Albumin", "g/dL", None, None, None, 3.5, 5.2, None, None, "Low albumin suggests liver disease, malnutrition or kidney loss"),
    ("Serum Ferritin", "ng/mL", None, None, None, 20.0, 250.0, None, None, "Above 1000 suggests iron overload in thalassemia"),
    ("HbF", "%", None, None, None, 0.0, 1.5, None, None, "Raised in thalassemia and sickle cell disease"),
    ("TSH", "mIU/L", None, None, None, 0.4, 4.0, 0.01, 50.0, "Above 10 means overt hypothyroidism"),
    ("Vitamin D", "ng/mL", None, None, None, 30.0, 100.0, None, None, "Below 20 is deficiency, common in Pakistan"),
    ("Vitamin B12", "pg/mL", None, None, None, 200.0, 900.0, 100.0, None, "Low causes megaloblastic anaemia and neuropathy"),
    ("Dengue NS1", None, None, None, None, None, None, None, None, "Positive confirms dengue; negative does not exclude it after day five"),
    ("Dengue IgM", None, None, None, None, None, None, None, None, "Appears around day 5 of illness"),
    ("Malaria Parasite", None, None, None, None, None, None, None, None, "Report the species and the parasite density"),
    ("HBsAg", None, None, None, None, None, None, None, None, "Positive means current hepatitis B infection"),
    ("Anti HCV", None, None, None, None, None, None, None, None, "Reactive needs a confirmatory test"),
    ("Urine Protein", None, None, None, None, None, None, None, None, "Report as trace, 1+, 2+ or 3+"),
]

# ================================================================ knowledge base
KNOWLEDGE = [
    # ------------------------------------------------------------------ emergency
    {
        "title": "Emergency red flags: chest pain and breathing difficulty",
        "category": "emergency",
        "source": "WHO Emergency Care Guidelines",
        "body": (
            "Chest pain or pressure, especially with sweating, nausea, or pain spreading to the arm, jaw, neck or back, "
            "is a heart attack until proven otherwise and requires immediate emergency care. Call an ambulance rather "
            "than travelling by private car if the patient is faint, pale, or short of breath. Difficulty breathing at "
            "rest, blue lips, or breathlessness with inability to speak full sentences is a respiratory emergency. "
            "Give no food, no drink and no medication. Keep the patient sitting upright and still."
        ),
    },
    {
        "title": "Emergency red flags: stroke - BE FAST",
        "category": "emergency",
        "source": "WHO Stroke Guidelines",
        "body": (
            "Sudden facial droop, arm weakness or numbness on one side, slurred speech, sudden confusion, sudden vision "
            "loss in one or both eyes, sudden severe headache unlike any previous headache, and sudden loss of balance "
            "are all stroke. Onset time decides whether clot treatment is possible, so the single most important question "
            "is when exactly the symptom started. Get the patient to a hospital with a CT scanner immediately. Give "
            "nothing to eat or drink because swallowing may be unsafe."
        ),
    },
    {
        "title": "Emergency red flags: anaphylaxis and severe allergic reaction",
        "category": "emergency",
        "source": "Alkhidmat Allergy Protocol",
        "body": (
            "Swelling of the lips, tongue or throat with difficulty breathing or speaking, a widespread rash with vomiting "
            "or collapse, and wheeze after a new medicine, a sting, or a food are anaphylaxis. Call an ambulance "
            "immediately. If the patient has been prescribed adrenaline auto-injector, help them use it into the outer "
            "thigh straight away. Lie them flat with legs raised unless they are having trouble breathing, in which case "
            "sit them up. Do not let them get up and walk."
        ),
    },
    {
        "title": "Emergency red flags: diabetic ketoacidosis",
        "category": "emergency",
        "source": "Alkhidmat Diabetes Programme",
        "body": (
            "A diabetic who is vomiting, confused or drowsy, breathing deeply and quickly, with abdominal pain, fruity "
            "breath and a very high blood glucose, has ketoacidosis. This is an emergency. Test the blood glucose if "
            "possible but never delay going to hospital to do it. Check for ketones. Go to hospital now, and make sure "
            "the doctor knows the diabetes history and which insulin they take."
        ),
    },
    {
        "title": "Emergency red flags: severe dehydration and gastroenteritis",
        "category": "emergency",
        "source": "WHO Diarrhoea Management",
        "body": (
            "Dangerous dehydration: the patient cannot drink or keeps vomiting everything, has sunken eyes, no urine "
            "for 8 hours or more, skin that stays pinched when pinched, drowsiness or confusion, blood in the stool, or "
            "severe abdominal pain. Start oral rehydration solution immediately while arranging care, and continue "
            "breastfeeding a baby. Rice water with a pinch of salt and sugar, or diluted ORS, helps. An infant who is "
            "floppy, refusing feeds, or breathing fast needs care urgently."
        ),
    },
    {
        "title": "Emergency red flags: meningitis",
        "category": "emergency",
        "source": "WHO Meningitis Guidelines",
        "body": (
            "Fever with a stiff neck that cannot be bent forward, a rash that does not fade when pressed with a glass, "
            "severe headache with light sensitivity, vomiting, confusion or drowsiness, and a bulging fontanelle in an "
            "infant all suggest meningitis. Go to hospital immediately, do not wait for a rash. Do not give paracetamol "
            "alone and assume the headache is viral."
        ),
    },
    {
        "title": "Emergency red flags: bleeding and overdose",
        "category": "emergency",
        "source": "Alkhidmat Emergency Protocol",
        "body": (
            "Bleeding that will not stop with firm pressure, vomiting blood or coffee-ground material, black tarry "
            "stool, sudden severe headache after a head injury, and any suspected overdose of paracetamol or iron "
            "require emergency care. Keep the medicine packet or bottle, because the hospital needs to know the exact "
            "drug, the strength and the amount taken and when. Do not induce vomiting."
        ),
    },
    {
        "title": "Critical laboratory values needing same day care",
        "category": "emergency",
        "source": "Alkhidmat Laboratory Policy",
        "body": (
            "Potassium above 6.2 or below 2.8 mmol/L, sodium above 155 or below 125 mmol/L, glucose above 25 mmol/L "
            "with symptoms, haemoglobin below 7 g/dL, platelets below 20, neutrophils below 0.5 with fever, creatinine "
            "above 4 mg/dL, or a positive dengue NS1 with warning signs. Any of these means the patient should be told "
            "to go to an emergency department the same day regardless of how well they feel."
        ),
    },
    # ------------------------------------------------------------------ guidelines
    {
        "title": "Type 2 diabetes - diagnosis, control, and complications",
        "category": "guideline",
        "source": "WHO / Pakistan Endocrine Society",
        "body": (
            "Fasting glucose 7.0 mmol/L or above, random glucose 11.1 mmol/L with symptoms, or HbA1c 6.5 percent or "
            "above is diagnostic. First line medicine is metformin, titrated gradually because starting at full dose causes "
            "vomiting and diarrhoea. Metformin must be stopped before iodinated contrast dye in kidney impairment. "
            "Every diabetic should have an ACE inhibitor or ARB if there is albumin in the urine, and a statin if over "
            "40. Check HbA1c every three months until controlled, then every six months. Screen yearly for kidney "
            "damage, retinopathy and foot ulcers. Uncontrolled diabetes causes weight loss, thirst, frequent urination, "
            "blurred vision, and slow-healing infections."
        ),
    },
    {
        "title": "Hypertension - home measurement and treatment",
        "category": "guideline",
        "source": "Pakistan Society of Hypertension",
        "body": (
            "Blood pressure 140/90 or above on two separate readings is hypertension. Home measurement is more "
            "reliable than clinic measurement: sit quietly for five minutes, back supported, arm at heart level, feet "
            "flat, correct cuff size, no caffeine or smoking for 30 minutes beforehand, take two readings a minute apart. "
            "Reduce salt, ideally to under 5 g a day, which matters as much as the medicine. Lost in the urine from "
            "pakistani diets is a major cause of resistant hypertension. First line medicines are ACE inhibitors, ARBs, "
            "calcium channel blockers and thiazide-like diuretics. Never take an ACE inhibitor and an ARB together. "
            "Avoid ibuprofen and other painkillers for pain; they raise blood pressure and harm the kidneys."
        ),
    },
    {
        "title": "Dengue fever - what the patient should do at home",
        "category": "guideline",
        "source": "WHO Dengue Guidelines",
        "body": (
            "Dengue needs fluids, not painkillers. Drink oral rehydration solution frequently. Never take aspirin, "
            "ibuprofen, diclofenac or any injection, because they worsen bleeding risk. Paracetamol is the only safe "
            "painkiller. Avoid intramuscular injections and unnecessary blood tests or procedures during the low "
            "platelet phase. Go to hospital immediately for severe abdominal pain, persistent vomiting, bleeding from "
            "anywhere, bleeding gums, cold clammy skin with a weak fast pulse, restlessness, drowsiness, or repeated "
            "vomiting with a very small pulse pressure. Do not use a mosquito net only as a substitute for care."
        ),
    },
    {
        "title": "Drug interaction - high risk pairs a patient must be warned about",
        "category": "guideline",
        "source": "Alkhidmat Formulary Policy",
        "body": (
            "Warfarin with any anti-inflammatory painkiller or aspirin causes major internal bleeding. Metformin with "
            "iodinated contrast dye risks lactic acidosis. Two drugs that prolong the QT interval, such as macrolide "
            "antibiotics or some antiemetics, can cause a dangerous heart rhythm. Sulfonylurea diabetes tablets with "
            "rifampicin, used for tuberculosis, cause severe hypoglycaemia. SSRI antidepressants with tramadol cause "
            "serotonin syndrome with agitation, tremor and fever. An ACE inhibitor or ARB with an anti-inflammatory plus "
            "a diuretic, the triple whammy, can cause acute kidney injury. Always tell a doctor every medicine taken, "
            "including those bought without a prescription and herbal remedies."
        ),
    },
    {
        "title": "Safety in pregnancy and breastfeeding",
        "category": "guideline",
        "source": "WHO Medicines for Pregnancy",
        "body": (
            "Paracetamol is the safe first choice for pain and fever in pregnancy. Avoid ibuprofen, diclofenac and other "
            "anti-inflammatories, especially after the first trimester. Avoid all ACE inhibitors and ARBs. Avoid "
            "warfarin; use heparin instead. Avoid tetracyclines. Do not start any new medicine in pregnancy or "
            "breastfeeding without a doctor or pharmacist checking it first, because safety data for many medicines in "
            "pregnancy is limited. Bleeding, severe headache, or abdominal pain in pregnancy needs urgent assessment."
        ),
    },
    {
        "title": "Paediatric dosing and when a child needs hospital",
        "category": "protocol",
        "source": "Alkhidmat Health Foundation",
        "body": (
            "All doses for a child are based on measured weight, never on age alone, and weight must be asked for. "
            "Paracetamol 15 mg/kg per dose every four to six hours, maximum 60 mg/kg a day. Ibuprofen is not safe under "
            "six months and not safe in a child who is dehydrated. Amoxicillin 25-50 mg/kg/day in three doses. Oral "
            "rehydration solution 75 mL/kg over four hours for dehydration. Keep breastfeeding. A child needs urgent care "
            "for fast or laboured breathing, a fast pulse, refusing feeds, drowsiness or floppiness, a convulsion, a rash "
            "that does not fade, or signs of dehydration. Childhood diarrhoea and pneumonia together kill more children "
            "than anything else in Pakistan, and both are preventable and treatable."
        ),
    },
    {
        "title": "Thalassemia and anaemia - what families need to know",
        "category": "protocol",
        "source": "Alkhidmat Health Foundation",
        "body": (
            "Beta thalassemia major needs blood transfusion every two to four weeks for life. Missing a transfusion is "
            "more dangerous than most people expect. Chelation therapy removes the iron that builds up from transfusions "
            "and protects the heart and liver; it must be started and continued as prescribed. Regular blood tests for "
            "ferritin, liver function and hearing are needed. Infections are the main cause of death, so immunisation "
            "and prompt treatment of fever matter greatly. Parents should be offered genetic counselling before having "
            "another child. Alkhidmat sponsors thalassemia treatment, and blood donation is often the fastest way to help."
        ),
    },
    {
        "title": "Chronic kidney disease - what the patient must avoid",
        "category": "protocol",
        "source": "Alkhidmat Dialysis Programme",
        "body": (
            "Kidney disease is silent for years. Avoid all anti-inflammatory painkillers such as ibuprofen, diclofenac "
            "and combinations, which accelerate damage. Avoid herbal and ayurvedic remedies of unknown composition. "
            "Avoid contrast dye imaging unless a doctor has checked kidney function. Control blood pressure and sugar "
            "tightly. Reduce salt, and check whether food is high in potassium, such as bananas, oranges, dates, "
            "coconut water and tomato. Refer to a nephrologist if kidney function is falling, potassium is high, or "
            "dialysis is being considered. Alkhidmat provides free dialysis to patients who cannot pay."
        ),
    },
    {
        "title": "Chest pain, acidity and heart attack in the community",
        "category": "health_education",
        "source": "Alkhidmat Community Health Programme",
        "body": (
            "Many patients assume chest pain is indigestion. In Pakistan this leads to people staying home while a heart "
            "attack develops. Treat central chest pain, pressure, or pain spreading to the arm, jaw, neck or back as a "
            "medical emergency until proven otherwise, especially with sweating, nausea, or breathlessness, and in anyone "
            "with diabetes, high blood pressure, high cholesterol, or a family history of heart disease. Sugar in "
            "diabetes can mask the pain. Call an ambulance. Do not take aspirin unless a doctor has told the patient to "
            "keep it at home for emergencies, and do not let the patient walk to hospital."
        ),
    },
    {
        "title": "Explaining results to a patient in plain language",
        "category": "health_education",
        "source": "Alkhidmat Patient Education",
        "body": (
            "Use the words the patient uses for their own body. Say what the test measures in one sentence. Say what the "
            "number was, whether it is inside or outside the normal range, and what that means for them today. Then say "
            "what happens next and how long until they will know more. Give a name for anything they must watch for. "
            "Ask them to repeat it back in their own words, in their own language. Avoid the word disease unless the "
            "patient uses it first. Do not give a number without saying what a normal number is."
        ),
    },
    {
        "title": "Reading a lab report when you only have the paper",
        "category": "health_education",
        "source": "Alkhidmat Laboratory",
        "body": (
            "Every report lists a reference range next to each test, because normal depends on age, sex and the "
            "laboratory's method. A value outside the range is not automatically a disease, it is a reason to ask a "
            "doctor. Critical values are marked and require same-day care. Bring the original paper, not a photograph, "
            "and bring every previous report so change over time can be seen. Keep reports in one folder. Write down "
            "the date and the lab name on each one."
        ),
    },
    {
        "title": "Medication adherence and cost - subsidised essential medicines",
        "category": "formulary_policy",
        "source": "Alkhidmat Pharmacy",
        "body": (
            "Insulin, oral diabetes medicines, blood pressure medicines, statins, blood thinners, anti-epileptics, "
            "thyroxine, inhalers and chronic kidney medicines are on the Alkhidmat essential-medicine list and are "
            "provided free or at cost to patients who cannot afford them, funded by zakat and sadaqah. Patients "
            "frequently stop or skip these medicines because they assume the price is fixed. A pharmacist can supply the "
            "generic molecule instead of a brand at a fraction of the cost, and it is the same medicine. Never stop a "
            "blood pressure, diabetes, or blood thinning medicine because the patient feels well. The danger is silent. "
            "A missed dose of insulin or a blood thinner is far more dangerous than the cost of taking it."
        ),
    },
    {
        "title": "Fever in an adult - what to watch for",
        "category": "health_education",
        "source": "Alkhidmat Community Health Programme",
        "body": (
            "Fever with a rash, a stiff neck, severe headache, confusion, or breathing difficulty is an emergency. Fever "
            "with a stiff neck, or a rash that does not fade when pressed with a glass, means go to hospital "
            "immediately. In Pakistan, malaria and dengue must be excluded by a blood test rather than assumed. Take "
            "paracetamol for the fever, not ibuprofen if dengue is possible. Keep the patient hydrated. Return "
            "immediately if the fever lasts beyond three days, if the patient becomes confused or unusually sleepy, if "
            "the breathing becomes fast, or if a rash appears."
        ),
    },
    {
        "title": "Urinary and reproductive health in women",
        "category": "health_education",
        "source": "Alkhidmat Maternal and Child Health",
        "body": (
            "Burning on passing urine, passing urine often, and blood in the urine can mean a urinary infection, and "
            "need a urine test, not self-treatment. Painful periods, heavy bleeding with clots, bleeding between "
            "periods, or periods that stop suddenly all need assessment. A missed period with abdominal pain, or "
            "bleeding in pregnancy, is urgent. During pregnancy attend antenatal visits; do not take any new medicine "
            "without checking first. Postnatal bleeding, foul-smelling discharge, or fever after a delivery needs same "
            "day care. Family planning can be discussed with any qualified doctor without shame."
        ),
    },
]


# ================================================================ upsert helpers
def upsert_formulary() -> int:
    supabase = get_supabase()
    count = 0
    for i in range(0, len(FORMULARY), 25):
        batch = FORMULARY[i : i + 25]
        embeddings = vector.embed_batch(
            [f"{g} {s} {f} brand {b} subsidised pharmacy price availability" for b, g, s, f, _ in batch]
        )
        for (brand, generic, strength, form, price), emb in zip(batch, embeddings, strict=True):
            match = {"brand_name": brand, "generic_name": generic, "strength": strength}
            found = match_where(supabase.table("formulary").select("id"), match)
            if found:
                supabase.table("formulary").update(
                    {"form": form, "unit_price_pkr": price, "in_stock": True, "embedding": emb}
                ).eq("id", found["id"]).execute()
            else:
                supabase.table("formulary").insert(
                    {
                        "brand_name": brand,
                        "generic_name": generic,
                        "strength": strength,
                        "form": form,
                        "unit_price_pkr": price,
                        "in_stock": True,
                        "embedding": emb,
                    }
                ).execute()
            count += 1
    return count


def upsert_reference_ranges() -> int:
    supabase = get_supabase()
    count = 0
    rows = [r for r in REFERENCE_RANGES if r[5] is not None or r[6] is not None]
    for i in range(0, len(rows), 25):
        batch = rows[i : i + 25]
        embeddings = vector.embed_batch(
            [f"normal reference range {r[0]} {r[1] or ''} {r[9] or ''}" for r in batch]
        )
        for row, emb in zip(batch, embeddings, strict=True):
            (name, unit, sex, a_low, a_high, low, high, c_low, c_high, note) = row
            match = {"test_name": name, "unit": unit, "sex": sex, "age_low": a_low, "age_high": a_high}
            found = match_where(supabase.table("reference_ranges").select("id"), match)
            payload = {
                "normal_low": low,
                "normal_high": high,
                "critical_low": c_low,
                "critical_high": c_high,
                "note": note,
                "embedding": emb,
            }
            if found:
                supabase.table("reference_ranges").update(payload).eq("id", found["id"]).execute()
            else:
                supabase.table("reference_ranges").insert({**match, **payload}).execute()
            count += 1
    return count


def upsert_knowledge() -> int:
    supabase = get_supabase()
    count = 0
    for i in range(0, len(KNOWLEDGE), 20):
        batch = KNOWLEDGE[i : i + 20]
        embeddings = vector.embed_batch([f"{d['title']}. {d['body']}" for d in batch])
        for doc, emb in zip(batch, embeddings, strict=True):
            found = maybe_one(supabase.table("clinical_kb").select("id").eq("title", doc["title"]))
            payload = {
                "title": doc["title"],
                "category": doc["category"],
                "body": doc["body"],
                "source": doc["source"],
                "embedding": emb,
            }
            if found:
                supabase.table("clinical_kb").update(payload).eq("id", found["id"]).execute()
            else:
                supabase.table("clinical_kb").insert(payload).execute()
            count += 1
    return count


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-formulary", action="store_true")
    args = parser.parse_args()

    started = time.perf_counter()
    print(f"embedding model: {get_settings().embedding_model} ({get_settings().embedding_dimensions}d)\n")

    print("clinical knowledge base ...")
    print(f"  {upsert_knowledge()} documents")

    print("lab reference ranges ...")
    print(f"  {upsert_reference_ranges()} ranges")

    if not args.skip_formulary:
        print("pharmacy formulary ...")
        print(f"  {upsert_formulary()} products")

    print(f"\ndone in {time.perf_counter() - started:.1f}s")
    return 0


if __name__ == "__main__":
    from aikti.config import get_settings

    sys.exit(main())
