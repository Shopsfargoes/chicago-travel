import { loadData, loadBrand, upcoming } from './_lib/data.js';

export default function handler(req, res) {
  const d = loadData();
  const brand = loadBrand();
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  res.json({
    brand,
    whatsapp: process.env.WHATSAPP_NUMBER || '',
    destinations: d.destinations,
    trips: upcoming(d.trips),
    contact: d.contact
  });
}
