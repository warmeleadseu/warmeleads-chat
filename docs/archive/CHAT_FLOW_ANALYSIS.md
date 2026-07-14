# CHAT FLOW ANALYSIS - GEBROKEN VERBINDINGEN

## ONTBREKENDE CHAT STEPS

### 🚨 KRITIEKE ONTBREKENDE STEPS:

1. **`custom_proposal`** - Gerefereerd in `pricing_presentation` maar bestaat niet
2. **`more_details`** - Gerefereerd in `payment_ready` maar bestaat niet  
3. **`roi_info`** - Gerefereerd in `custom_question` maar bestaat niet
4. **`demo_request`** - Gerefereerd in `speed_info` maar bestaat niet
5. **`crm_integration`** - Gerefereerd in `delivery_explanation` maar bestaat niet
6. **`branch_details`** - Gerefereerd in `branches_explanation` maar bestaat niet
7. **`demo_setup`** - Gerefereerd in `demo_setup` (zelf-referentie probleem) maar bestaat niet
8. **`crm_setup`** - Gerefereerd in `crm_setup` (zelf-referentie probleem) maar bestaat niet
9. **`custom_branches_info`** - Gerefereerd in `custom_branches` maar bestaat niet

### 🚨 GEBROKEN FLOW VERBINDINGEN:

#### FAQ FOLLOWUP FLOWS:
- **`faq_followup`** step bestaat niet! Dit is een kritiek probleem omdat alle FAQ buttons naar deze context leiden.

#### CONTEXT-SPECIFIC FLOWS:
Veel context-specific flows zoals `quality_explanation`, `pricing_explanation`, `delivery_explanation` bestaan wel, maar sommige opties leiden naar niet-bestaande steps.

#### EXPRESS FLOW VERBINDINGEN:
- Express flow verwijst naar steps die niet in de chatLogic zitten maar in expressFlow.ts
- Dit veroorzaakt problemen wanneer gebruikers tussen flows switchen

## FLOW INCONSISTENTIES

### 1. **DUBBELE QUANTITY_SELECTION**
- Er zijn twee quantity_selection steps (een is hernoemd naar quantity_selection_alt)
- Maar de referenties zijn niet allemaal geüpdatet

### 2. **CONTEXT MISMATCH**
- Sommige contexts leiden naar verkeerde initial steps
- `faq` context leidt naar `faq_followup` die niet bestaat

### 3. **FLOW SWITCHING PROBLEMEN**
- Express flow en educational flow hebben verschillende step naming
- Wanneer gebruikers switchen tussen flows, kunnen ze in een lege staat terechtkomen

## SPECIFIEKE PROBLEMEN PER CONTEXT

### FAQ CONTEXT (`faq`):
- **Initial Step**: `faq_followup` - BESTAAT NIET ❌
- **Gevolg**: Alle FAQ chat buttons leiden tot broken flow

### QUALITY CONTEXT (`quality`):
- **Initial Step**: `quality_explanation` - Bestaat ✅
- **Probleem**: Sommige opties leiden naar niet-bestaande steps

### PRICING CONTEXT (`pricing`):
- **Initial Step**: `pricing_explanation` - Bestaat ✅  
- **Probleem**: `custom_proposal` step ontbreekt

### DELIVERY CONTEXT (`delivery`):
- **Initial Step**: `delivery_explanation` - Bestaat ✅
- **Probleem**: `crm_integration` step ontbreekt

### EXAMPLES CONTEXT (`examples`):
- **Initial Step**: `lead_examples` - Bestaat ✅
- **Flow**: Werkt correct ✅

### ROI CONTEXT (`roi`):
- **Initial Step**: `roi_calculator` - Bestaat ✅
- **Flow**: Recent toegevoegd, werkt correct ✅

### BRANCHES CONTEXT (`branches`):
- **Initial Step**: `branches_explanation` - Bestaat ✅
- **Probleem**: `branch_details` step ontbreekt

## ACTIEPUNTEN

### HOGE PRIORITEIT:
1. ✅ Maak `faq_followup` step (kritiek)
2. ✅ Maak `custom_proposal` step
3. ✅ Maak `more_details` step
4. ✅ Maak `roi_info` step

### GEMIDDELDE PRIORITEIT:
5. ✅ Maak `demo_request` step
6. ✅ Maak `crm_integration` step  
7. ✅ Maak `branch_details` step
8. ✅ Fix self-referencing steps

### LAGE PRIORITEIT:
9. ✅ Optimaliseer flow transitions
10. ✅ Voeg missing support steps toe
11. ✅ Test alle end-to-end flows






