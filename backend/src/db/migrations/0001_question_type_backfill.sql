-- Phase 6: backfill `type: 'multiple_choice'` on every existing question that
-- was stored before the QuestionType union landed. JSONB column already accepts
-- the new field; this just ensures legacy rows match the new schema shape.

UPDATE "quizzes"
SET "questions" = (
  SELECT jsonb_agg(
    CASE
      WHEN q.item ? 'type' THEN q.item
      ELSE jsonb_set(q.item, '{type}', '"multiple_choice"'::jsonb, true)
    END
    ORDER BY q.ord
  )
  FROM jsonb_array_elements("questions") WITH ORDINALITY AS q(item, ord)
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements("questions") AS q
  WHERE NOT (q ? 'type')
);
