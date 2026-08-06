import { createSeoServer } from './seo/render.mjs';

const port = Number(process.env.PORT || 4173);
const app = await createSeoServer();
app.listen(port, '0.0.0.0', () => console.info(`KriptoKeyfi SEO server http://localhost:${port}`));
