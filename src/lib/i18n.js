'use strict';
/**
 * The station in three languages: German, English, French — switched from
 * the DE EN FR control at the top right, kept in a cookie like the theme.
 *
 * English is the source: every string in the views is written in English,
 * and this dictionary carries its German and French. `T(s)` returns the
 * string in the visitor's language, or the English unchanged when no
 * translation is listed — so a missing entry can never blank a page, it
 * just stays English.
 *
 * What is translated is the station's own interface: the ticker, the
 * composer, the board, the dashboard, the reading matter, the page chrome.
 * What the crew write, what visitors send, and the day content authored in
 * content/ (task names, meals, resource labels) appear as written — they
 * are the work, not the interface. Mission control and the archive record
 * stay in English, the mission's working language.
 */

const LANGS = ['de', 'en', 'fr'];

/* en → [de, fr] */
const D = {
  // ---- navigation, rail, footer
  'Mission': ['Mission', 'Mission'],
  'Messages': ['Nachrichten', 'Messages'],
  'At a Glance': ['Auf einen Blick', 'En un coup d’œil'],
  'Crew log': ['Logbuch der Crew', 'Journal de bord'],
  'About': ['Über', 'À propos'],
  'Write': ['Schreiben', 'Écrire'],
  'Daily mission': ['Tagesmission', 'Mission du jour'],
  'Habitat': ['Habitat', 'Habitat'],
  'Crew': ['Crew', 'Équipage'],
  'Mission control': ['Missionskontrolle', 'Contrôle de mission'],
  'LINK NOMINAL': ['VERBINDUNG NOMINAL', 'LIAISON NOMINALE'],
  'LINK DEGRADED': ['VERBINDUNG GESTÖRT', 'LIAISON DÉGRADÉE'],
  'ONE WAY': ['EINFACH', 'ALLER SIMPLE'],
  'YOU': ['DU', 'VOUS'],
  'DAY': ['TAG', 'JOUR'],
  'Light': ['Licht', 'Lumière'],
  'Switch to light mode': ['Zum hellen Modus wechseln', 'Passer en mode clair'],
  'Switch to dark mode': ['Zum dunklen Modus wechseln', 'Passer en mode sombre'],
  'SIGNAL DELAY': ['SIGNALLAUFZEIT', 'DÉLAI DU SIGNAL'],
  'Back to the station': ['Zurück zur Station', 'Retour à la station'],
  'Language': ['Sprache', 'Langue'],

  // ---- masthead
  'Communication Station': ['Kommunikationsstation', 'Station de communication'],
  'the only way to reach the crew': ['der einzige Weg, die Crew zu erreichen', 'le seul moyen de joindre l’équipage'],
  'the only way to reach the crew, once they are inside':
    ['der einzige Weg, die Crew zu erreichen, sobald sie drinnen ist', 'le seul moyen de joindre l’équipage, une fois à l’intérieur'],
  'sols in the habitat': ['Sols im Habitat', 'sols dans l’habitat'],
  'opens in': ['öffnet in', 'ouvre dans'],
  'day': ['Tag', 'jour'],
  'days': ['Tagen', 'jours'],
  'of': ['von', 'sur'],

  // ---- ticker
  'HABITAT TIME': ['HABITATZEIT', 'HEURE DE L’HABITAT'],
  'to occupation': ['bis zum Einzug', 'avant l’occupation'],
  'opens': ['öffnet', 'ouvre'],
  'Mission complete': ['Mission abgeschlossen', 'Mission accomplie'],
  'the record stays': ['die Aufzeichnung bleibt', 'l’archive demeure'],
  'The crew are currently:': ['Die Crew ist gerade bei:', 'L’équipage est en train de :'],
  'Next:': ['Danach:', 'Ensuite :'],
  'Habitat:': ['Habitat:', 'Habitat :'],
  'One-way signal': ['Signal einfach', 'Signal aller simple'],
  'off the schedule': ['außerhalb des Plans', 'hors programme'],
  'nothing more today': ['heute nichts mehr', 'plus rien aujourd’hui'],
  'awaiting reading': ['warte auf Messwert', 'en attente de mesure'],
  'no current reading': ['kein aktueller Messwert', 'aucune mesure actuelle'],
  'What is happening in the habitat': ['Was gerade im Habitat geschieht', 'Ce qui se passe dans l’habitat'],

  // ---- composer
  'Operator': ['Operator', 'Opérateur'],
  'Your callsign for this visit — no account, no name':
    ['Dein Rufzeichen für diesen Besuch — kein Konto, kein Name', 'Votre indicatif pour cette visite — sans compte, sans nom'],
  'Tags · choose 3': ['Tags · wähle 3', 'Étiquettes · choisir 3'],
  'CHOOSE UP TO 3 TAGS': ['BIS ZU 3 TAGS WÄHLEN', 'JUSQU’À 3 ÉTIQUETTES'],
  'Transmit': ['Senden', 'Transmettre'],
  'Messages are read by mission control before they reach the board. You will be able to send again once this one has arrived.':
    ['Nachrichten werden von der Missionskontrolle gelesen, bevor sie das Board erreichen. Du kannst wieder senden, sobald diese angekommen ist.',
     'Les messages sont lus par le contrôle de mission avant d’atteindre le tableau. Vous pourrez renvoyer dès que celui-ci sera arrivé.'],
  'Write to the crew. They will read this': ['Schreib der Crew. Sie liest das in', 'Écrivez à l’équipage. Il lira ceci dans'],
  'from now, if the relay holds.': ['ab jetzt, wenn das Relais hält.', 'à partir de maintenant, si le relais tient.'],

  // ---- the board
  'Message Board': ['Nachrichtenboard', 'Tableau des messages'],
  'LIVE': ['LIVE', 'EN DIRECT'],
  'The board refreshes itself every few seconds': ['Das Board aktualisiert sich alle paar Sekunden', 'Le tableau se rafraîchit toutes les quelques secondes'],
  'ALL': ['ALLE', 'TOUT'],
  'MY MESSAGES': ['MEINE NACHRICHTEN', 'MES MESSAGES'],
  'My messages': ['Meine Nachrichten', 'Mes messages'],
  'All messages': ['Alle Nachrichten', 'Tous les messages'],
  'Nothing transmitted yet — the first message could be yours':
    ['Noch nichts gesendet — die erste Nachricht könnte deine sein', 'Rien n’a encore été transmis — le premier message pourrait être le vôtre'],
  'No messages match this filter': ['Keine Nachrichten zu diesem Filter', 'Aucun message ne correspond à ce filtre'],
  'exchanges': ['Antworten', 'échanges'],
  'sent': ['gesendet', 'envoyés'],
  'Scroll ↓': ['Scrollen ↓', 'Faire défiler ↓'],
  'Filter the board': ['Das Board filtern', 'Filtrer le tableau'],

  'REPLIED': ['BEANTWORTET', 'RÉPONDU'],
  'PUBLISHED': ['VERÖFFENTLICHT', 'PUBLIÉ'],
  'REJECTED': ['ABGELEHNT', 'REJETÉ'],
  'IN TRANSIT': ['UNTERWEGS', 'EN TRANSIT'],
  'REACHED MARS': ['MARS ERREICHT', 'MARS ATTEINT'],
  'Sent': ['Gesendet', 'Envoyé'],
  'replied': ['beantwortet', 'répondu'],

  // ---- dashboard
  'Mission dashboard': ['Missions-Dashboard', 'Tableau de bord de mission'],
  'Trends': ['Trends', 'Tendances'],
  'Meal': ['Mahlzeit', 'Repas'],
  'Mood': ['Stimmung', 'Humeur'],
  'Schedule': ['Tagesplan', 'Programme'],
  'Resources': ['Ressourcen', 'Ressources'],
  'Power consumed': ['Verbrauchte Energie', 'Énergie consommée'],
  'Carried in · never resupplied': ['Mitgebracht · nie nachgeliefert', 'Emporté · jamais réapprovisionné'],
  'Day total': ['Tagessumme', 'Total du jour'],
  'counted by the crew': ['von der Crew gezählt', 'compté par l’équipage'],
  'Planned for day 01': ['Geplant für Tag 01', 'Prévu pour le jour 01'],
  'Today': ['Heute', 'Aujourd’hui'],
  'Nothing filed for this day — the crew count the day’s power as it ends':
    ['Für diesen Tag nichts erfasst — die Crew zählt die Energie am Tagesende', 'Rien de saisi pour ce jour — l’équipage compte l’énergie en fin de journée'],
  'Carbon dioxide': ['Kohlendioxid', 'Dioxyde de carbone'],
  'Temperature': ['Temperatur', 'Température'],
  'Humidity': ['Luftfeuchte', 'Humidité'],
  'Calories consumed': ['Verbrauchte Kalorien', 'Calories consommées'],
  'Steps taken': ['Gegangene Schritte', 'Pas effectués'],
  'No meals filed for today': ['Heute keine Mahlzeiten erfasst', 'Aucun repas saisi pour aujourd’hui'],
  'No schedule filed for this day': ['Für diesen Tag kein Plan erfasst', 'Aucun programme saisi pour ce jour'],
  'Filed by mission control · never quoted as numbers': ['Von der Missionskontrolle erfasst · nie als Zahlen zitiert', 'Saisi par le contrôle de mission · jamais cité en chiffres'],
  'Sensor node · measured live · figures and stores counted by the crew':
    ['Sensorknoten · live gemessen · Zahlen und Vorräte von der Crew gezählt', 'Capteur · mesuré en direct · chiffres et réserves comptés par l’équipage'],
  'Everything, day by day': ['Alles, Tag für Tag', 'Tout, jour par jour'],
  'The whole mission': ['Die ganze Mission', 'Toute la mission'],

  'Today’s Schedule': ['Heutiger Tagesplan', 'Programme du jour'],
  'No schedule filed for today': ['Für heute kein Plan erfasst', 'Aucun programme saisi pour aujourd’hui'],
  'The whole mission, day by day — blogs, meals, consumption, habitat, crew condition and every exchange':
    ['Die ganze Mission, Tag für Tag — Blogs, Mahlzeiten, Verbrauch, Habitat, Verfassung der Crew und jeder Austausch',
     'Toute la mission, jour par jour — blogs, repas, consommation, habitat, état de l’équipage et chaque échange'],
  'under strain': ['unter Belastung', 'sous tension'],
  'all nominal': ['alles nominal', 'tout nominal'],
  'Opens': ['Öffnet', 'Ouvre'],
  'sol remaining': ['Sol verbleibend', 'sol restant'],
  'sols remaining': ['Sols verbleibend', 'sols restants'],
  // ---- About / info
  'What this is': ['Worum es geht', 'De quoi il s’agit'],
  'Who we are': ['Wer wir sind', 'Qui nous sommes'],
  'The habitat': ['Das Habitat', 'L’habitat'],
  'Distance as the material': ['Distanz als Material', 'La distance comme matériau'],
  'The archive as the work': ['Das Archiv als Werk', 'L’archive comme œuvre'],
  'This mission': ['Diese Mission', 'Cette mission'],

  // ---- At a Glance chrome
  'at the close of the day · what is left of what was carried in':
    ['am Ende des Tages · was von dem übrig ist, was mitgebracht wurde', 'à la fin du jour · ce qui reste de ce qui a été emporté'],
  'Habitat · today, as the sensors are seeing it': ['Habitat · heute, wie die Sensoren es gerade sehen', 'Habitat · aujourd’hui, tel que les capteurs le voient'],
  'Habitat · the day as the sensors saw it, and as the crew counted it':
    ['Habitat · der Tag, wie die Sensoren ihn sahen und die Crew ihn zählte', 'Habitat · le jour tel que les capteurs l’ont vu, et tel que l’équipage l’a compté'],
  'Crew condition · as reported, never as numbers': ['Verfassung der Crew · als Bericht, nie als Zahlen', 'État de l’équipage · tel que rapporté, jamais en chiffres'],
  "A booklet of the run: one day per page. Scroll or swipe sideways — or use the arrows — to turn to the next day. Each page holds everything its day held: the crew's blog, the exchanges with Earth, the schedule, the meals, the consumption, the habitat and the crew's condition. Days ahead show the plan.":
    ['Ein Heft des Laufs: ein Tag pro Seite. Seitwärts scrollen oder wischen — oder die Pfeile nehmen — und weiterblättern. Jede Seite hält, was ihr Tag hielt: den Blog der Crew, den Austausch mit der Erde, den Tagesplan, die Mahlzeiten, den Verbrauch, das Habitat und die Verfassung der Crew. Kommende Tage zeigen den Plan.',
     'Un carnet de la période : un jour par page. Faites défiler ou glissez latéralement — ou prenez les flèches — pour tourner au jour suivant. Chaque page tient tout ce que son jour a tenu : le blog de l’équipage, les échanges avec la Terre, le programme, les repas, la consommation, l’habitat et l’état de l’équipage. Les jours à venir montrent le plan.'],

  'Jump to a day': ['Zu einem Tag springen', 'Aller à un jour'],
  'Blogs': ['Blogs', 'Blogs'],
  'Meals': ['Mahlzeiten', 'Repas'],
  'Consumption': ['Verbrauch', 'Consommation'],
  'planned': ['geplant', 'prévu'],
  'Planned': ['Geplant', 'Prévu'],
  'Complete': ['Abgeschlossen', 'Terminé'],
  'Before the run': ['Vor dem Lauf', 'Avant la période'],
  'crew entries': ['Crew-Einträge', 'entrées d’équipage'],
  'messages from Earth': ['Nachrichten von der Erde', 'messages de la Terre'],
  'media sent out': ['gesendete Medien', 'médias envoyés'],
  'Exchanges with Earth': ['Austausch mit der Erde', 'Échanges avec la Terre'],
  'Science findings': ['Wissenschaftliche Befunde', 'Observations scientifiques'],
  'Health activities': ['Gesundheitsaktivitäten', 'Activités de santé'],
  'Mission notes': ['Missionsnotizen', 'Notes de mission'],
  'Also sent out': ['Ebenfalls gesendet', 'Également envoyé'],
  'readings': ['Messwerte', 'mesures'],
  'habitat time': ['Habitatzeit', 'heure de l’habitat'],
  'first': ['erste', 'première'],
  'last': ['letzte', 'dernière'],
};

/** T for one language: exact English in, that language out; unknown stays English. */
function of(lang) {
  const i = lang === 'de' ? 0 : lang === 'fr' ? 1 : -1;
  if (i < 0) return (s) => s;
  return (s) => {
    const row = D[s];
    return row && row[i] ? row[i] : s;
  };
}

/** The visitor's language, from the cookie; anything unknown is English. */
function pick(req) {
  const v = req.cookies ? req.cookies.mcs_lang : null;
  return LANGS.includes(v) ? v : 'en';
}

module.exports = { LANGS, of, pick, D };
