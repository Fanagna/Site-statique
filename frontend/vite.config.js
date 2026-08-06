import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/* Domaine de production : défini via VITE_SITE_URL (voir .env.example), puis
   saisi dans Vercel → Settings → Environment Variables.
   Tant qu'il n'est pas défini, on utilise https://example.com — domaine réservé
   (RFC 2606) n'appartenant à personne : aucune collision avec un site réel.
   Le placeholder __SITE_URL__ est remplacé À LA FIN du build dans index.html,
   sitemap.xml et robots.txt. (Hook closeBundle : les fichiers de public/ sont
   copiés tels quels, pas dans le bundle — il faut les réécrire sur disque.) */
function siteUrlReplacement(siteUrl) {
  return {
    name: 'site-url-replacement',
    closeBundle() {
      const distDir = resolve(process.cwd(), 'dist');
      for (const fileName of ['index.html', 'sitemap.xml', 'robots.txt']) {
        const file = resolve(distDir, fileName);
        if (!existsSync(file)) continue;
        const content = readFileSync(file, 'utf8');
        writeFileSync(file, content.split('__SITE_URL__').join(siteUrl));
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = (env.VITE_SITE_URL || 'https://example.com').replace(/\/+$/, '');
  if (!env.VITE_SITE_URL) {
    // Le placeholder ne doit JAMAIS être déployé sans être remplacé par le vrai domaine.
    console.warn('⚠️  VITE_SITE_URL non définie — SEO généré avec le placeholder https://example.com. Définissez-la dans Vercel → Settings → Environment Variables (voir frontend/.env.example).');
  }
  return {
    plugins: [siteUrlReplacement(siteUrl), react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          /* Chunks vendor séparés : React et le routeur restent en cache navigateur
             longtemps (ils ne changent presque jamais) — le site public se charge
             plus vite au retour. (Fonction : requise par rolldown, le moteur de
             build de Vite 8.) Le pattern est volontairement STRICT : seul le cœur
             react/react-dom/scheduler entre dans le chunk « react » — pas les
             paquets dont le chemin contient « react » (react-qr-scanner, lucide-react)
             qui doivent rester dans les chunks lazy de leurs pages. */
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('react-router')) return 'router';
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
            return undefined;
          },
        },
      },
    },
  };
});
