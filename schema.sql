-- 學長姐專用行星分組系統
-- 水星排除；金星～海王星共 7 組，每組最多 12 人。

CREATE TABLE IF NOT EXISTS group_counts (
  group_index INTEGER PRIMARY KEY CHECK (group_index BETWEEN 1 AND 7),
  count INTEGER NOT NULL DEFAULT 0 CHECK (count BETWEEN 0 AND 12)
);

INSERT INTO group_counts (group_index, count)
VALUES (1,0),(2,0),(3,0),(4,0),(5,0),(6,0),(7,0)
ON CONFLICT (group_index) DO NOTHING;

CREATE TABLE IF NOT EXISTS submissions (
  id BIGSERIAL PRIMARY KEY,
  public_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL,
  scores JSONB NOT NULL,
  group_index INTEGER NOT NULL CHECK (group_index BETWEEN 1 AND 7)
);

CREATE INDEX IF NOT EXISTS submissions_created_at_idx ON submissions(created_at DESC);
ALTER TABLE group_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.submit_planet_test(TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.submit_planet_test(p_name TEXT, p_scores JSONB)
RETURNS TABLE(public_id TEXT, group_index INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  chosen_group INTEGER;
  new_id TEXT;
BEGIN
  IF NULLIF(trim(p_name), '') IS NULL THEN
    RAISE EXCEPTION '姓名不可為空';
  END IF;

  IF jsonb_typeof(p_scores) <> 'array' OR jsonb_array_length(p_scores) <> 8 THEN
    RAISE EXCEPTION '分數格式錯誤';
  END IF;

  -- 水星 index=0 永遠不參與分組；只從金星～海王星 index=1..7 選擇。
  -- 先看分數高低；若最高順位已滿 12 人，就自動往下一順位。
  SELECT gc.group_index
  INTO chosen_group
  FROM group_counts gc
  WHERE gc.count < 12
  ORDER BY
    COALESCE((p_scores ->> gc.group_index)::INTEGER, 0) DESC,
    gc.count ASC,
    gc.group_index ASC
  FOR UPDATE
  LIMIT 1;

  IF chosen_group IS NULL THEN
    RAISE EXCEPTION '本次學長姐分組名額已全部額滿';
  END IF;

  UPDATE group_counts
  SET count = count + 1
  WHERE group_index = chosen_group;

  new_id := 'S' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));

  INSERT INTO submissions(public_id, name, scores, group_index)
  VALUES(new_id, trim(p_name), p_scores, chosen_group);

  RETURN QUERY SELECT new_id, chosen_group;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_snapshot()
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'counts', (SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY g.group_index),'[]'::jsonb) FROM group_counts g),
    'users', (SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC),'[]'::jsonb) FROM submissions s)
  );
$$;
