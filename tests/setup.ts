import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Without vitest globals, Testing Library does not clean up by itself.
afterEach(() => cleanup());
