<script lang="ts">
  import { page } from '$app/stores';
  import QuizEditor from '$lib/components/QuizEditor.svelte';
</script>

<QuizEditor 
  initialData={$page.state.templateData} 
  templateId={$page.url.searchParams.get('templateId')} 
/>
