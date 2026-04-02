// ─────────────────────────────────────────────────────────────────────────────
// api/webhook.js — Receives data from Power Automate and saves to Vercel KV.
// POST /api/webhook
// Header: x-webhook-secret: <your secret>
// Body:   { "rows": [ {...}, {...} ] }
// ─────────────────────────────────────────────────────────────────────────────

async function kvSet(key, value) {
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
    body: JSON.stringify(['SET', key, JSON.stringify(value)]),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`KV SET failed (${resp.status}): ${text}`);
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate secret
  const secret = req.headers['x-webhook-secret'];
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    console.error('[webhook] Unauthorized – missing or invalid x-webhook-secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { rows } = req.body || {};
  if (!rows || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'Invalid payload. Expected { "rows": [...] }' });
  }

  // Detect dynamic "Status [fecha]" column (e.g. "Status 23 marzo", "Status 15 abril")
  const firstRow = rows[0] || {};
  const statusColumnName = Object.keys(firstRow).find(k => k.startsWith('Status ')) || null;

  const payload = {
    rows,
    updatedAt: new Date().toISOString(),
    count: rows.length,
    statusColumnName, // e.g. "Status 23 marzo" — null if not found
  };

  try {
    await kvSet('hrbp_vacancies_data', payload);
    console.log(`[webhook] ${rows.length} rows saved to KV — ${payload.updatedAt}`);

    return res.status(200).json({
      ok: true,
      message: `${rows.length} vacancies saved.`,
      updatedAt: payload.updatedAt,
    });
  } catch (error) {
    console.error('[webhook] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
