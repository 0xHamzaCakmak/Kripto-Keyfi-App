import { createSeoServer } from './seo/render.mjs';

const port = Number(process.env.PORT || 4173);
const app = await createSeoServer();
app.listen(port, process.env.HOST || '127.0.0.1', () => console.info(`KriptoKeyfi SEO server http://localhost:${port}`));
