import { on } from '@/core/events/emit';

export function registerEventHandlers(): void {
  on('scanCompleted', async (event) => {
    if (event.type !== 'scanCompleted') return;
    console.log('[Event] scanCompleted', event.payload);
  });

  on('scanCreated', async (event) => {
    if (event.type !== 'scanCreated') return;
    console.log('[Event] scanCreated', event.payload);
  });

  on('usageLimitReached', async (event) => {
    if (event.type !== 'usageLimitReached') return;
    console.log('[Event] usageLimitReached', event.payload);
  });
}
