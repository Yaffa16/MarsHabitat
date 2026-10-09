'use strict';
/**
 * The night sky (8 October): four hundred stars, every one a dot, a fifth of them twinkling — the same scatter wherever
 * it is drawn and on every load (seeded) — and five comets, each crossing now and then on a round of its own. No planets
 * ("remove all the planets from the background, only have dots as stars").
 *
 * The installation's screens draw the stars into the page (views/pages/screens.js, screenSky; public/screen.css). The
 * site's pages carry the same sky by night ("keep the dots and comets on all pages that are in dark mode"): the stars as
 * a picture of their own, /sky.svg (server.js) — fetched once and kept by the browser, never sent with a page, and not
 * fetched at all by day — the five comets over it (views/layout.js; public/neu.css, *the night sky*).
 */
function circles() {
  let seed = 20261015;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  return Array.from({ length: 400 }, (_, i) => {
    const x = Math.round(rnd() * 1920), y = Math.round(rnd() * 1080), r = (0.45 + rnd() * rnd() * 1.6).toFixed(2), o = (0.2 + rnd() * 0.65).toFixed(2);
    const tw = i % 5 === 0 ? ` class="tw" style="animation-delay:-${(rnd() * 6).toFixed(1)}s"` : '';
    return `<circle cx="${x}" cy="${y}" r="${r}" opacity="${o}"${tw}/>`;
  }).join('');
}

const COMETS = '<i class="comet c1"></i><i class="comet c2"></i><i class="comet c3"></i><i class="comet c4"></i><i class="comet c5"></i>';

/** The stars as a picture of their own, for the site's pages by night: the same dots, twinkling the same way (still where
    less motion is asked for), laid over the page's ground like the screens' — cover, centred. */
function svg() {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">' +
    '<style>circle{fill:#fff}.tw{animation:tw 5.5s ease-in-out infinite}@keyframes tw{0%,100%{opacity:.9}50%{opacity:.12}}' +
    '@media (prefers-reduced-motion:reduce){.tw{animation:none}}</style>' + circles() + '</svg>';
}

/** The site's sky, right inside the body of every public page: shown by night only (neu.css). */
const nightSky = () => `<div class="night-sky" aria-hidden="true">${COMETS}</div>`;

module.exports = { circles, COMETS, svg, nightSky };
