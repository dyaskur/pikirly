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
    const sdk = await import('@googleworkspace/meet-addons');
    const meet = sdk.meet || sdk; // Handle both named and default/direct exports

    if (!meetClient) {
      // The SDK can be on meet.addon or meet directly depending on version/export
      const addon = meet.addon || meet;
      
      console.log('Initializing Meet Add-on SDK...', { meet, addon });

      if (typeof addon.createAddonSession !== 'function') {
        throw new Error('createAddonSession not found on SDK object');
      }

      // 1. Establish the session
      // Using project number from GOOGLE_CLIENT_ID (798042367810)
      const session = await addon.createAddonSession({
        cloudProjectNumber: '798042367810'
      });
      
      // 2. Create the appropriate client based on the surface
      if (surface === 'stage') {
        meetClient = await session.createMainStageClient();
      } else {
        meetClient = await session.createSidePanelClient();
      }
    }

    const meetingInfo = await meetClient.getMeetingInfo();

    // Generate a stable visitorId for this user in this meeting if no identity provided by Meet
    let visitorId = '';
    if (typeof localStorage !== 'undefined') {
      visitorId = localStorage.getItem('pikirly.visitorId') || '';
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem('pikirly.visitorId', visitorId);
      }
    }

    return {
      meetingCode: meetingInfo.meetingCode || meetingInfo.meetingId,
      participantId: visitorId, 
      displayName: '',   // Will be populated from auth store if available
      surface: surface || 'side'
    };
  } catch (err) {
    console.error('Failed to initialize Meet Add-on SDK:', err);
    return null;
  }
}
