import fs from 'node:fs';
import path from 'node:path';
const read = (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));
export const loadData = () => read('data/travel-data.json');
export const loadBrand = () => read('config/brand.json');
export const loadAI = () => read('config/ai.json');
export const upcoming = (trips) => {
  const today = new Date().toISOString().slice(0, 10);
  return trips.filter((t) => t.end_date >= today);
};
