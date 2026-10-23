import { setGlobalOptions } from 'firebase-functions/v2';

// Must run before any function is defined — index.ts imports this module first.
// Mumbai: closest region to THIKANO's users.
setGlobalOptions({ region: 'asia-south1', maxInstances: 20 });
