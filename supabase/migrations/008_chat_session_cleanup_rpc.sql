-- Reliable empty-session cleanup and lookup (avoids client-side row-limit bugs)

CREATE OR REPLACE FUNCTION cleanup_empty_chat_sessions(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH deleted AS (
    DELETE FROM chat_sessions cs
    WHERE cs.user_id = p_user_id
      AND NOT EXISTS (
        SELECT 1 FROM chat_messages cm WHERE cm.session_id = cs.id
      )
    RETURNING cs.id
  )
  SELECT COUNT(*)::INTEGER INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION find_empty_chat_session(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_id UUID;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT cs.id INTO session_id
  FROM chat_sessions cs
  WHERE cs.user_id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM chat_messages cm WHERE cm.session_id = cs.id
    )
  ORDER BY cs.created_at DESC
  LIMIT 1;

  RETURN session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_empty_chat_sessions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION find_empty_chat_session(UUID) TO authenticated;
