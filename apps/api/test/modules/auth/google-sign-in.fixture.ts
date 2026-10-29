import { integrationTest } from '../../support/integration-test.js';
import { googleSignInWith, useLocalGoogleSigningKeys } from '../../support/google-sign-in.js';
import { ProbeAuthSubscriberModule } from '../../support/probe-events/auth/probe-auth-subscriber.module.js';
import { ProbeEventRecorder } from '../../support/probe-events/subscriber/probe-event-recorder.js';

export const googleSignInTest = integrationTest({
  imports: [ProbeAuthSubscriberModule],
  configure: useLocalGoogleSigningKeys,
})
  .extend('recorder', ({ app }) => {
    const recorder = app.get(ProbeEventRecorder);
    recorder.clear();

    return recorder;
  })
  .extend('google', ({ http }) => googleSignInWith(http));
