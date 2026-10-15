import process from 'node:process';
import { defineConfig } from 'vite';

const [repositoryOwner, repositoryName] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
const isUserOrOrgSite = repositoryName === `${repositoryOwner}.github.io`;
const base = process.env.GITHUB_ACTIONS && repositoryName && !isUserOrOrgSite
  ? `/${repositoryName}/`
  : '/';

export default defineConfig({
  base,
  resolve: { preserveSymlinks: true },
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});