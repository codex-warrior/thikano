import { setGlobalOptions } from 'firebase-functions/v2';

// Must run before any function is defined — index.ts imports this module first.
// Mumbai: closest region to THIKANO's users.
// Fractional CPU (gcf_gen1 ≈ 0.17 vCPU at 256 MiB): these are light request handlers, and a new
// project's Cloud Run quota (20 vCPU/region) can't start ~60 one-vCPU containers at deploy time.
setGlobalOptions({ region: 'asia-south1', maxInstances: 20, cpu: 'gcf_gen1' });
