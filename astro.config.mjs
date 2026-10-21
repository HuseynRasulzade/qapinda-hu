import { defineConfig } from 'astro/config';

// Static output → /dist. Directory format gives clean URLs (/rolunk/index.html).
export default defineConfig({
  site: 'https://qapinda.hu',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  compressHTML: true,
  devToolbar: { enabled: false },
});
