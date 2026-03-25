// ─────────────────────────────────────────────────────────────────────────────
// api/data.js — Serves the stored KV data to the frontend.
// GET /api/data
// ─────────────────────────────────────────────────────────────────────────────

async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  
  if (!url || !token) {
    throw new Error('KV Environment Variables (URL/TOKEN) are missing');
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['GET', key]),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`KV GET failed (${resp.status}): ${text}`);
  }

  const json = await resp.json();
  if (json && json.result) {
    return JSON.parse(json.result);
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = await kvGet('hrbp_vacancies_data');
    if (!data) {
      return res.status(404).json({ error: 'No data found. Webhook might not have run yet.' });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('[data] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
