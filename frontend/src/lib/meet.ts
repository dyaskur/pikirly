import { page } from '$app/state';

export interface MeetContext {
  meetingCode: string;
  participantId: string;
  displayName: string;
  surface: 'side' | 'stage';
}

let meetClient: any = null;
let meetSession: any = null;

export async function getMeetClient() {
  if (!meetClient) {
    await getMeetContext();
  }
  return meetClient;
}

/**
 * Navigate while preserving Google Meet query parameters (especially meet_sdk)
 */
export async function navigateMeet(path: string) {
  const currentUrl = new URL(window.location.href);
  const targetUrl = new URL(path, window.location.origin);
  
  // Copy all existing parameters
  currentUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const { goto } = await import('$app/navigation');
  return goto(targetUrl.pathname + targetUrl.search);
}

export async function getMeetContext(): Promise<MeetContext | null> {
  const mode = page.url.searchParams.get('mode');
  const surface = page.url.searchParams.get('surface') as 'side' | 'stage';
  
  if (mode !== 'meet') return null;

  try {
    const sdk = await import('@googleworkspace/meet-addons');
    const meet = (sdk as any).meet || sdk;
    const addon = (meet as any).addon || meet;

    if (!meetSession) {
      console.log('Initializing Meet Add-on SDK session...');
      meetSession = await addon.createAddonSession({
        cloudProjectNumber: '798042367810'
      });
    }

    if (!meetClient) {
      if (surface === 'stage') {
        meetClient = await meetSession.createMainStageClient();
      } else {
        meetClient = await meetSession.createSidePanelClient();
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
