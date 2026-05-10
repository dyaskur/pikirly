import { page } from '$app/state';

export interface MeetContext {
  meetingCode: string;
  participantId: string;
  displayName: string;
  surface: 'side' | 'stage';
}

let meetClient: any = null;

export async function getMeetContext(): Promise<MeetContext | null> {
  const mode = page.url.searchParams.get('mode');
  const surface = page.url.searchParams.get('surface') as 'side' | 'stage';
  
  if (mode !== 'meet') return null;

  try {
    // Dynamically import to avoid issues in non-Meet environments
    const { meet } = await import('@googleworkspace/meet-addons');
    if (!meetClient) {
      meetClient = await meet.createAddonClient();
    }

    const meetingContext = await meetClient.getMeetingContext();
    const participantContext = await meetClient.getParticipantContext();

    return {
      meetingCode: meetingContext.meetingCode,
      participantId: participantContext.participantId,
      displayName: participantContext.displayName,
      surface: surface || 'side'
    };
  } catch (err) {
    console.error('Failed to initialize Meet Add-on SDK:', err);
    return null;
  }
}
