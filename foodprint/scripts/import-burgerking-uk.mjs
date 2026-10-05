// Public content service used by burgerking.co.uk. No account or authentication.
import fs from 'node:fs/promises';
const query = '*[_type in ["menu","section","picker","item","combo"]]{_id,_type,name,showInStaticMenu,options,ingredients}';
const source = 'https://czqk28jt.apicdn.sanity.io/v2023-08-01/data/query/prod_bk_gb?query=' + encodeURIComponent(query);
const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Official public menu returned ${response.status}`);
const nodes = (await response.json()).result;
const byId = new Map(nodes.map(row => [row._id, row]));
const menu = nodes.find(row => row._type === 'menu' && row.name?.en === 'BK Menu');
if (!menu) throw new Error('Current UK menu not found.');
const seen = new Set(), records = new Map();
function visit(id) {
  if (seen.has(id)) return; seen.add(id);
  const node = byId.get(id); if (!node || node.showInStaticMenu === false) return;
  const name = node.name?.en?.trim().replace(/\s+/g, ' ');
  if (name && ['picker', 'item', 'combo'].includes(node._type)) {
    const key = name.toLowerCase();
    if (!records.has(key)) records.set(key, { id: `burgerking-uk-${id}`, name, brands: 'Burger King', country: 'United Kingdom', sourceUrl: 'https://www.burgerking.co.uk/menu', fetchedAt: '2026-10-05' });
  }
  // Item options are toppings/modifications, not distinct menu products.
  if (node._type === 'item') return;
  for (const option of node.options ?? []) { const ref = option._ref ?? option.option?._ref; if (ref) visit(ref); }
}
visit(menu._id);
if (![...records.values()].some(row => /whopper/i.test(row.name))) throw new Error('Whopper not found; refusing menu import.');
await fs.writeFile('src/data/burgerkingUkProducts.json', JSON.stringify({ source: 'Burger King UK official menu, public Sanity content service', sourceApiUrl: source, generatedAt: '2026-10-05', records: [...records.values()] }) + '\n');
console.log(`Imported ${records.size} distinct current UK menu names, without inventing ingredient lists.`);
