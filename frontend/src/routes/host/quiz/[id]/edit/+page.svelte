<script lang="ts">
  import { page } from '$app/stores';
  import QuizEditor from '$lib/components/QuizEditor.svelte';

  let quizId = $derived($page.params.id);
</script>

<QuizEditor {quizId} />
