import { defineConfig } from 'vite';

const stripShebangPlugin = () => ({
  name: 'strip-shebang',
  transform(code: string) {
    if (code.startsWith('#!')) {
      return code.replace(/^#!.*/, '');
    }
  }
});

export default defineConfig({
  plugins: [stripShebangPlugin()],
  worker: {
    format: 'es',
    plugins: () => [stripShebangPlugin()]
  },
  build: {
    target: 'esnext'
  }
});
