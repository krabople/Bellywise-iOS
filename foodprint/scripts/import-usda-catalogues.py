"""Import real USDA food/brand records. Build dependency: pip install ijson.

Run against the three official ZIP files in .build/catalog-sources. No diary data.
Descriptions are foods, not new OCR ingredient vocabulary; recipes remain estimates.
"""
import collections
import hashlib
import json
import re
import unicodedata
import zipfile
from pathlib import Path
import ijson

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.build/catalog-sources'
OUT = ROOT / 'src/data'
COUNTRIES = {'US': 'United States', 'USA': 'United States', 'United States of America': 'United States', 'UK': 'United Kingdom', 'GB': 'United Kingdom', 'NZ': 'New Zealand'}

def norm(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', text.replace("'", '')).strip()

def rows(file, key):
    with zipfile.ZipFile(SOURCE / file) as archive:
        with archive.open(next(n for n in archive.namelist() if n.endswith('.json'))) as stream:
            yield from ijson.items(stream, key + '.item')

def write(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), default=str) + '\n', encoding='utf-8')

generic = {}
survey = list(rows('survey.zip', 'SurveyFoods'))
legacy = list(rows('sr.zip', 'SRLegacyFoods'))
by_code = {str(f.get('foodCode', f.get('ndbNumber', ''))): f for f in legacy + survey}

def components(food, visited=None):
    visited = set(visited or [])
    code = str(food.get('foodCode', food.get('ndbNumber', '')))
    if code in visited or len(visited) > 8:
        return [food['description']]
    visited.add(code)
    inputs = food.get('inputFoods') or []
    if not inputs:
        return [food['description']]
    result = []
    for item in inputs:
        desc = item.get('ingredientDescription') or item.get('foodDescription')
        child = by_code.get(str(item.get('ingredientCode', '')))
        if child and child.get('inputFoods') and str(item.get('ingredientCode')) != code:
            result.extend(components(child, visited))
        elif desc:
            result.append(desc)
    return list(dict.fromkeys(result))

for food in survey + legacy:
    desc = food['description'].strip()
    if len(desc) > 280 or re.search(r'\b(?:human milk|infant formula|babyfood|baby food|toddler formula)\b', desc, re.I):
        continue
    key = norm(desc)
    if key in generic:
        continue
    generic[key] = {'fdcId': food['fdcId'], 'name': desc, 'components': components(food), 'sourceType': food['dataType']}
write('usdaFoodDescriptions.json', {'source': 'USDA FoodData Central: FNDDS 2021–2023 (October 2024) and SR Legacy (April 2018)', 'license': 'Public domain / CC0', 'records': list(generic.values())})
print('Generic source food records:', len(generic), flush=True)

brands = {}
pools = collections.defaultdict(dict)
seen = 0
rejected = 0
def usable_brand(value):
    return isinstance(value, str) and 2 <= len(value.strip()) <= 120 and not re.search(r'(?:https?://|www\.|@)|^(?:unknown|not applicable|not specified|none|n/?a|private label|unbranded|unbranded product|various|other|generic|brand)\.?$', value.strip(), re.I)

for food in rows('branded.zip', 'BrandedFoods'):
    seen += 1
    brand = food.get('brandName') or food.get('brandOwner')
    if not usable_brand(brand):
        rejected += 1
        continue
    brand = re.sub(r'\s+', ' ', brand).strip()
    key = norm(brand)
    if not key:
        continue
    entry = brands.setdefault(key, {'name': brand, 'aliases': [], 'productsInSource': 0})
    entry['productsInSource'] += 1
    if brand != entry['name'] and brand not in entry['aliases'] and len(entry['aliases']) < 8:
        entry['aliases'].append(brand)
    desc = food.get('description', '').strip()
    ingredients = food.get('ingredients', '').strip()
    barcode = str(food.get('gtinUpc', ''))
    if not desc or len(desc) > 280 or not ingredients or len(ingredients) > 20000 or not re.fullmatch(r'\d{8,14}', barcode):
        continue
    if re.search(r'^(?:n/?a|none|unknown|not available|see (?:label|package))\.?$', ingredients, re.I):
        continue
    pool = pools[key]
    country = COUNTRIES.get(food.get('marketCountry'), food.get('marketCountry', 'Unspecified market'))
    product_key = norm(desc) + '|' + norm(country)
    cap = 30 if country != 'United States' else 12
    prior = pool.get(product_key)
    if (prior and int(food['fdcId']) > prior['fdcId']) or (not prior and len(pool) < cap):
        pool[product_key] = {'fdcId': food['fdcId'], 'barcode': barcode, 'name': desc, 'brandKey': key,
                             'brands': brand, 'ingredientsText': ingredients,
                             'country': country,
                             'updatedAt': food.get('modifiedDate', food.get('publicationDate', ''))}
    if seen % 100000 == 0:
        print('Processed', seen, 'branded source rows;', len(brands), 'distinct brands', flush=True)

# Spread storage across real brands; don't fill the app with variants of one manufacturer.
products = []
ordered = sorted(pools.items(), key=lambda item: (-brands[item[0]]['productsInSource'], item[0]))
for rank in range(12):
    for key, pool in ordered:
        candidates = sorted(pool.values(), key=lambda p: (p['country'] == 'United States', -p['fdcId']))
        if len(candidates) > rank and len(products) < 60000:
            products.append(candidates[rank])
metadata = {'source': 'USDA FoodData Central branded foods, April 2026 release', 'license': 'Public domain / CC0', 'sourceUrl': 'https://fdc.nal.usda.gov/download-datasets/', 'sourceRows': seen, 'excludedBrandRows': rejected}
write('brandCatalog.json', {**metadata, 'records': [{'key': k, **v} for k, v in sorted(brands.items())]})
write('brandedProducts.json', {**metadata, 'records': products})
audit = {**metadata, 'genericFoodRecords': len(generic), 'brandRecords': len(brands), 'brandedProductsWithPublishedIngredients': len(products),
         'archives': {name: hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() for name in ['survey.zip', 'sr.zip', 'branded.zip']}}
write('catalogImportAudit.json', audit)
print(json.dumps(audit), flush=True)
