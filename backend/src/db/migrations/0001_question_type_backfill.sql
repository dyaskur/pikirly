-- Phase 6: backfill `type: 'multiple_choice'` on every existing question that
-- was stored before the QuestionType union landed. JSONB column already accepts
-- the new field; this just ensures legacy rows match the new schema shape.

UPDATE "quizzes"
SET "questions" = (
  SELECT jsonb_agg(
    CASE
      WHEN q ? 'type' THEN q
      ELSE jsonb_set(q, '{type}', '"multiple_choice"'::jsonb, true)
    END
  )
  FROM jsonb_array_elements("questions") AS q
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements("questions") AS q
  WHERE NOT (q ? 'type')
);
