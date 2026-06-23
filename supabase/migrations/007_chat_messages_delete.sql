-- Allow users to delete messages in their own sessions (needed for session delete + cascade)

CREATE POLICY chat_messages_delete ON chat_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );
