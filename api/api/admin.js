function json(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, {
      error: 'Method Not Allowed'
    });
  }

  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!base || !key) {
    return json(res, 500, {
      error: '系統尚未完成資料庫設定'
    });
  }

  const name = String(req.body?.name || '').trim();
  const scores = req.body?.scores;

  if (!name) {
    return json(res, 400, {
      error: '請留下年級與本名'
    });
  }

  if (!Array.isArray(scores) || scores.length !== 8) {
    return json(res, 400, {
      error: '測驗資料格式錯誤'
    });
  }

  try {
    const response = await fetch(
      `${base}/rest/v1/rpc/submit_planet_test`,
      {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          p_name: name,
          p_scores: scores
        })
      }
    );

    const raw = await response.text();

    let data = null;

    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    if (!response.ok) {
      console.error('Supabase status:', response.status);
      console.error('Supabase response:', raw);

      // 名額全部額滿
      if (
        raw.includes('名額') ||
        raw.includes('額滿') ||
        raw.includes('full')
      ) {
        return json(res, 409, {
          error: '目前所有學長姐組別都已額滿'
        });
      }

      return json(res, 500, {
        error: '分組系統發生錯誤，請稍後再試',
        code: `DB_${response.status}`
      });
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (
      !row ||
      row.public_id === undefined ||
      row.group_index === undefined
    ) {
      console.error('Invalid RPC result:', data);

      return json(res, 500, {
        error: '分組結果格式異常'
      });
    }

    return json(res, 200, {
      id: row.public_id,
      groupIndex: Number(row.group_index)
    });

  } catch (error) {
    console.error('Submit error:', error);

    return json(res, 500, {
      error: '目前無法連線至分組系統'
    });
  }
};
