function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return json(res, 405, {
      error: "Method Not Allowed"
    });
  }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!base || !key) {
    return json(res, 500, {
      error: "Supabase 環境變數尚未設定"
    });
  }

  const name = String(req.body?.name || "").trim();
  const scores = req.body?.scores;

  if (!name) {
    return json(res, 400, {
      error: "請留下年級與本名"
    });
  }

  if (!Array.isArray(scores) || scores.length !== 8) {
    return json(res, 400, {
      error: "測驗資料格式錯誤"
    });
  }

  try {
    const response = await fetch(
      `${base}/rest/v1/rpc/submit_planet_test`,
      {
        method: "POST",
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          p_name: name,
          p_scores: scores
        })
      }
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!response.ok) {
      console.error("Supabase error:", response.status, text);

      return json(res, 500, {
        error: "資料庫分組失敗",
        code: `DB_${response.status}`
      });
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return json(res, 500, {
        error: "沒有取得分組結果"
      });
    }

    return json(res, 200, {
      id: row.public_id,
      groupIndex: Number(row.group_index)
    });

  } catch (error) {
    console.error("Submit error:", error);

    return json(res, 500, {
      error: "伺服器連線失敗"
    });
  }
};
