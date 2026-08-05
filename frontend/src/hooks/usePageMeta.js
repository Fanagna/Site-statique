import { useEffect } from 'react';

/* SEO par page : titre, description, Open Graph et Twitter Cards.
   Appelé dans chaque page publique — garde le site référençable et
   partageable (Facebook, LinkedIn, WhatsApp…). */
export default function usePageMeta(title, description) {
  useEffect(() => {
    const SITE = 'ARINA — Association de réinsertion des jeunes vulnérables à Madagascar';
    const finalTitle = title ? `${title} · ARINA` : SITE;
    const finalDesc = description || "L'Association ARINA accompagne la réinsertion sociale et professionnelle des jeunes vulnérables à Madagascar : hébergement, soutien psychosocial, formation professionnelle et insertion.";

    document.title = finalTitle;
    const setMeta = (selector, attr, value) => {
      const el = document.head.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };
    setMeta('meta[name="description"]', 'content', finalDesc);
    setMeta('meta[property="og:title"]', 'content', finalTitle);
    setMeta('meta[property="og:description"]', 'content', finalDesc);
    setMeta('meta[property="og:url"]', 'content', window.location.href);
    setMeta('meta[property="og:type"]', 'content', 'website');
    setMeta('meta[name="twitter:title"]', 'content', finalTitle);
    setMeta('meta[name="twitter:description"]', 'content', finalDesc);
  }, [title, description]);
}
