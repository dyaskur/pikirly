import { page } from '$app/state';
import type { AddonSession, MeetSidePanelClient, MeetMainStageClient } from '@googleworkspace/meet-addons';

export interface MeetContext {
  meetingCode: string;
  participantId: string;
  displayName: string;
  surface: 'side' | 'stage';
}

let meetClient: MeetSidePanelClient | MeetMainStageClient | null = null;
let meetSession: AddonSession | null = null;
let mainStageListenerInstalled = false;

export async function getMeetClient(): Promise<MeetSidePanelClient | MeetMainStageClient | null> {
  if (!meetClient) {
    await getMeetContext();
  }
  return meetClient;
}

/**
 * Side-panel → main-stage signal: host has created a new game and the main
 * stage should re-bootstrap to find it. Idempotent — calling twice does
 * not register two listeners.
 */
export async function listenForHostNewGame(handler: () => void): Promise<void> {
  if (mainStageListenerInstalled) return;
  const client = await getMeetClient();
  if (!client || typeof client.on !== 'function') return;
  client.on('frameToFrameMessage', (m) => {
    try {
      const data = JSON.parse(m.payload);
      if (data?.type === 'pikirly.host_new_game') handler();
    } catch { /* not our message */ }
  });
  mainStageListenerInstalled = true;
}

/**
 * Navigate while preserving Google Meet query parameters (especially meet_sdk)
 */
export async function navigateMeet(path: string): Promise<void> {
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
  const rawSurface = page.url.searchParams.get('surface');
  
  // Validate surface parameter strictly
  const surface: 'side' | 'stage' = (rawSurface === 'stage') ? 'stage' : 'side';
  
  if (mode !== 'meet') return null;
try {
  const { meet } = await import('@googleworkspace/meet-addons');

  if (!meetSession) {
    console.log('Initializing Meet Add-on SDK session...');
    const projectNumber = import.meta.env.VITE_GOOGLE_PROJECT_NUMBER;

    if (!projectNumber) {
      console.warn('VITE_GOOGLE_PROJECT_NUMBER is not defined. Meet SDK may fail to initialize.');
    }

    meetSession = await meet.addon.createAddonSession({
      cloudProjectNumber: projectNumber
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
    // Stable per-client visitorId. localStorage access can throw in partitioned/disabled-storage contexts.
    let visitorId = '';
    try {
      visitorId = localStorage.getItem('pikirly.visitorId') || '';
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem('pikirly.visitorId', visitorId);
      }
    } catch {
      // Storage blocked (e.g. third-party iframe partitioning) — fall back to a fresh per-load id
      visitorId = crypto.randomUUID();
    }

    return {
      meetingCode: meetingInfo.meetingCode || meetingInfo.meetingId,
      participantId: visitorId || crypto.randomUUID() || 'unknown',
      displayName: '',   // Will be populated from auth store if available
      surface
    };
  } catch (err) {
    console.error('Failed to initialize Meet Add-on SDK:', err);
    return null;
  }
}
