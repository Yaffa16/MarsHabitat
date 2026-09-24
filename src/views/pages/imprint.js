'use strict';
const L = require('../layout');
const { esc } = L;

/**
 * The imprint (Impressum), on the station itself rather than on zkm.de:
 * the provider's legal details as ZKM gives them, in German and in English.
 * The text is the legal text and is not translated by the station's
 * dictionary — both versions stand on the page whatever the language.
 */
const ADDRESS_DE = ['ZKM | Zentrum für Kunst und Medien', 'Lorenzstraße 19', '76135 Karlsruhe', 'Deutschland'];
const ADDRESS_EN = ['ZKM | Center for Art and Media', 'Lorenzstraße 19', '76135 Karlsruhe', 'Germany'];
const contact = (tel, fax) => `
  <p>${tel} <a href="tel:+4972181001200">+49 (0) 721/8100-1200</a><br>
  ${fax} +49 (0) 721/8100-1139<br>
  E-Mail: <a href="mailto:info@zkm.de">info@zkm.de</a></p>`;
const lines = (a) => `<p>${a.map(esc).join('<br>')}</p>`;

function imprintPage(ctx) {
  const T = ctx.T;
  const body = `
  <div class="logpage-top imprint" lang="de">
    <div class="eyebrow">${T('Imprint')}</div>
    <h1>Impressum</h1>
    ${lines(ADDRESS_DE)}
    ${contact('Telefon:', 'Fax:')}
    <p>Das ZKM | Zentrum für Kunst und Medien Karlsruhe ist eine Stiftung des öffentlichen Rechts und ist im Gemeinsamen Amtsblatt (GABl.) des Landes Baden-Württemberg unter dem Aktenzeichen 53-7958.50/193/1 eingetragen.</p>
    <p>Wissenschaftlich-künstlerischer Vorstand: Alistair Hudson</p>
    <p>Zuständige Aufsichtsbehörde: Ministerium für Wissenschaft, Forschung und Kunst Baden-Württemberg<br>
    Umsatzsteuer-Identifikationsnummer (UID) gemäß §27a Umsatzsteuergesetz: DE 143588970</p>
    <p>Kennzeichnung i.S.d. § 5 TMG:</p>
    <p>Anbieter dieser Internetpräsenz ist das ZKM.</p>
  </div>

  <div class="logpage-top imprint" lang="en">
    <div class="eyebrow">Imprint</div>
    <h1>Imprint</h1>
    ${lines(ADDRESS_EN)}
    ${contact('Tel:', 'Fax:')}
    <p>The ZKM | Center for Art and Media Karlsruhe is a foundation under public law, and is registered in the Official Journal (GABl.) of the state of Baden-Württemberg under file number 53-7958.50/193/1.</p>
    <p>Scientific-Artistic Chairman | CEO: Alistair Hudson</p>
    <p>Regulatory authority: Ministry for Science, Research and Art Baden-Württemberg<br>
    Value Added Tax Identification Number (UID) according to §27a, Value Added Tax Act: DE 143588970</p>
  </div>`;
  return L.page({ title: 'Imprint', ctx, body, current: '/imprint',
    hero: L.masthead(ctx) + L.pageNav('/imprint', T), hideRail: true, hideNav: true, bodyClass: 'landing inner' });
}

module.exports = { imprintPage };
