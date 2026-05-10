<script lang="ts">
  import { page } from '$app/stores';
  import QuizEditor from '$lib/components/QuizEditor.svelte';
  import type { Question } from '@kahoot/shared';

  // Safely access templateData from state if it exists
  const initialData = ($page.state as any).templateData as { title: string, questions: Question[] } | undefined;
</script>

<QuizEditor 
  {initialData}
  templateId={$page.url.searchParams.get('templateId')} 
/>
