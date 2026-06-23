-- Keep the active empty session when cleaning up (prevents redirect loops)

CREATE OR REPLACE FUNCTION cleanup_empty_chat_sessions(
  p_user_id UUID,
  p_keep_session_id UUID DEFAULT NULL
)
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
      AND (p_keep_session_id IS NULL OR cs.id <> p_keep_session_id)
      AND NOT EXISTS (
        SELECT 1 FROM chat_messages cm WHERE cm.session_id = cs.id
      )
    RETURNING cs.id
  )
  SELECT COUNT(*)::INTEGER INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_empty_chat_sessions(UUID, UUID) TO authenticated;
