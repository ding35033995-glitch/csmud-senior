function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method Not Allowed' });

  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return json(res, 500, { error: '撠𡁏𧊋摰峕��脩垢鞈��摨怨身摰�' });

  const name = String(req.body?.name || '').trim();
  const scores = req.body?.scores;
  if (!name || !Array.isArray(scores) || scores.length !== 8) {
    return json(res, 400, { error: '鞈���澆��航炊' });
  }

  try {
    const response = await fetch(`${base}/rest/v1/rpc/submit_planet_test`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_name: name, p_scores: scores })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.message || data?.hint || data?.details || data?.error || '隡箸��冽麱���瘜訫��𣂼�蝯�';
      if (String(message).includes('�漤�撌脣��券�皛�')) return json(res, 409, { error: message });
      console.error('Supabase submit error:', data);
      return json(res, 500, { error: '隡箸��冽麱���瘜訫��𣂼�蝯�' });
    }

    const row = Array.isArray(data) ? data[0] : data;
    return json(res, 200, {
      id: row.public_id,
      groupIndex: Number(row.group_index)
    });
  } catch (error) {
    console.error('Submit error:', error);
    return json(res, 500, { error: '隡箸��冽麱���瘜訫��𣂼�蝯�' });
  }
};
