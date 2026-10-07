'use strict';
/**
 * The station in three languages: German, English, French — switched from
 * the DE · EN · FR control beside the theme switch, kept in the `mcs_lang`
 * cookie like the theme. Nothing is fetched and no third-party script is
 * involved: the whole dictionary is this file, so it works offline.
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
 *
 * To add or change a word: find (or add) the English string as it appears
 * in the view, as the key, and give it `['German', 'French']`. The key must
 * match the English exactly — punctuation, case and typographic apostrophes
 * included — because the views look it up verbatim. Strings built from
 * parts (a number and a unit, a count and a noun) are listed as their parts.
 */

const LANGS = ['de', 'en', 'fr'];

/* en → [de, fr] */
const D = {
  // ---- navigation, rail, footer
  'Mission': ['Mission', 'Mission'],
  'Messages': ['Nachrichten', 'Messages'],
  'At a Glance': ['Auf einen Blick', 'Vue d’ensemble'],
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
  'Light': ['Hell', 'Clair'],
  'Switch to light mode': ['Zum hellen Modus wechseln', 'Passer en mode clair'],
  'Switch to dark mode': ['Zum dunklen Modus wechseln', 'Passer en mode sombre'],
  'Back to the station': ['Zurück zur Station', 'Retour à la station'],
  'Language': ['Sprache', 'Langue'],

  // ---- masthead
  'the only way to reach the crew': ['der einzige Weg, die Crew zu erreichen', 'le seul moyen de joindre l’équipage'],
  'the only way to reach the crew, once they are inside':
    ['der einzige Weg, die Crew zu erreichen, sobald sie drinnen ist', 'le seul moyen de joindre l’équipage, une fois à l’intérieur'],
  'sols in the habitat': ['Sols im Habitat', 'sols dans l’habitat'],
  // "opens in 13 days": German counts the days after a dash — "öffnet — noch
  // 13 Tage" — so `days` can stay the plain plural the counts elsewhere need.
  'opens in': ['öffnet — noch', 'ouvre dans'],
  'day': ['Tag', 'jour'],
  'days': ['Tage', 'jours'],
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
  'Tags · choose up to 3': ['Tags · bis zu 3', 'Étiquettes · jusqu’à 3'],
  'Your callsign': ['Dein Rufzeichen', 'Votre indicatif'],
  'CHOOSE UP TO 3 TAGS': ['BIS ZU 3 TAGS WÄHLEN', 'JUSQU’À 3 ÉTIQUETTES'],
  'Transmit': ['Senden', 'Transmettre'],
  'Write to the crew.': ['Schreib der Crew.', 'Écrivez à l’équipage.'],

  // ---- the board
  'Message Board': ['Nachrichtenboard', 'Tableau des messages'],
  'LIVE': ['LIVE', 'EN DIRECT'],
  // the two instruments without a reading among the habitat's tiles (public.js vizTile)
  'Karlsruhe': ['Karlsruhe', 'Karlsruhe'],
  'Schloss': ['Schloss', 'Schloss'],
  'Marktplatz': ['Marktplatz', 'Marktplatz'],
  'Ground station': ['Bodenstation', 'Station au sol'],
  'ZKM': ['ZKM', 'ZKM'],
  'Astronauts tracked': ['Astronauten erfasst', 'Astronautes suivis'],
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
  'AWAITING REPLY': ['WARTET AUF ANTWORT', 'EN ATTENTE DE RÉPONSE'],       // on Mars, not yet answered (public.js, cardStatus)
  // ---- the card's line into space (public.js spaceLine, board.js): how far the message has got since it left Earth
  'This message is currently {km} km from Earth!':
    ['Diese Nachricht ist jetzt {km} km von der Erde entfernt!', 'Ce message est maintenant à {km} km de la Terre !'],
  'Launched': ['Gestartet', 'Lancé'],
  'Follow its journey': ['Seine Reise verfolgen', 'Suivre son voyage'],
  // the big figures' words (fmtBig in public.js / board.js): the English billion is the German Milliarde, the French milliard —
  // and the English trillion the German Billion, the French billion
  'million': ['Million', 'million'], 'millions': ['Millionen', 'millions'],
  'billion': ['Milliarde', 'milliard'], 'billions': ['Milliarden', 'milliards'],
  'trillion': ['Billion', 'billion'], 'trillions': ['Billionen', 'billions'],
  'quadrillion': ['Billiarde', 'billiard'], 'quadrillions': ['Billiarden', 'billiards'],
  // ---- where the message is (board.js, /api/celestial): a tap on a card — the last object it has passed, in two lines.
  // The second line's sentence follows the object's kind of distance (content/celestial.json, how); {name} comes with its
  // article, in the singular, and the sentence is capitalised by the page.
  'Your message is {r} times farther away than {name}.': ['Deine Nachricht ist {r}-mal weiter entfernt als {name}.', 'Votre message est {r} fois plus loin que {name}.'],
  'Your message is just about as far as {name}.': ['Deine Nachricht ist gerade so weit wie {name}.', 'Votre message est à peu près aussi loin que {name}.'],
  '{name} is on average about {km} km from Earth': ['{name} ist im Mittel etwa {km} km von der Erde entfernt', '{name} est en moyenne à environ {km} km de la Terre'],                  // avg
  '{name} is {ly} light-years from Earth': ['{name} ist {ly} Lichtjahre von der Erde entfernt', '{name} est à {ly} années-lumière de la Terre'],                                        // ly
  '{name} orbits about {km} km above Earth': ['{name} kreist etwa {km} km über der Erde', '{name} orbite à environ {km} km au-dessus de la Terre'],                                       // orbit
  '{name} flew about {km} km above Earth': ['{name} flog etwa {km} km über der Erde', '{name} volait à environ {km} km au-dessus de la Terre'],                                           // flew
  '{name} reached {km} km from Earth': ['{name} erreichte {km} km Entfernung von der Erde', '{name} a atteint {km} km de la Terre'],                                                      // reached
  '{name} passed about {km} km from Earth': ['{name} zog in etwa {km} km Entfernung an der Erde vorbei', '{name} a frôlé la Terre à environ {km} km'],                                   // flyby
  '{name} will pass about {km} km from Earth': ['{name} wird in etwa {km} km Entfernung an der Erde vorbeiziehen', '{name} passera à environ {km} km de la Terre'],                      // will
  '{name} is now about {km} km from Earth': ['{name} ist jetzt etwa {km} km von der Erde entfernt', '{name} est aujourd’hui à environ {km} km de la Terre'],                            // now
  '{name} is {km} km from Earth': ['{name} ist {km} km von der Erde entfernt', '{name} est à {km} km de la Terre'],                                                                      // mark, closest, farthest
  '{name} is about {km} km above the ground': ['{name} ist etwa {km} km über dem Boden', '{name} est à environ {km} km au-dessus du sol'],                                                // height
  'just now': ['gerade eben', 'à l’instant'],
  'a minute ago': ['vor einer Minute', 'il y a une minute'],
  '{n} minutes ago': ['vor {n} Minuten', 'il y a {n} minutes'],
  'an hour ago': ['vor einer Stunde', 'il y a une heure'],
  '{n} hours ago': ['vor {n} Stunden', 'il y a {n} heures'],
  'a day ago': ['vor einem Tag', 'il y a un jour'],
  '{n} days ago': ['vor {n} Tagen', 'il y a {n} jours'],
  'Every message is also beamed into space by radio.':
    ['Jede Nachricht wird außerdem per Funk ins All gesendet.', 'Chaque message est aussi envoyé dans l’espace par radio.'],
  'Sent': ['Gesendet', 'Envoyé'],
  'replied': ['beantwortet', 'répondu'],

  // ---- dashboard
  'Mission dashboard': ['Missions-Dashboard', 'Suivi de mission'],
  'Trends': ['Trends', 'Tendances'],
  'Every channel, store and count over the run': ['Jeder Kanal, jeder Vorrat und jede Zählung über den Lauf', 'Chaque canal, chaque réserve et chaque compte sur toute la période'],
  'Meal': ['Mahlzeit', 'Repas'],
  'Today’s Meal': ['Mahlzeit heute', 'Repas du jour'],
  'Crew Moods': ['Stimmung der Crew', 'Humeur de l’équipage'],
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
  // ---- the recipe book's figures on a meal
  'water footprint': ['Wasser-Fußabdruck', 'empreinte eau'],
  'Water footprint': ['Wasser-Fußabdruck', 'Empreinte eau'],
  'per serving': ['pro Portion', 'par portion'],
  'Protein': ['Eiweiß', 'Protéines'],
  'Fat': ['Fett', 'Lipides'],
  'Carbohydrate': ['Kohlenhydrate', 'Glucides'],
  'Fibre': ['Ballaststoffe', 'Fibres'],
  'Sugar': ['Zucker', 'Sucres'],
  'Sodium': ['Natrium', 'Sodium'],
  'No schedule filed for this day': ['Für diesen Tag kein Plan erfasst', 'Aucun programme saisi pour ce jour'],
  'Filed by mission control · never quoted as numbers': ['Von der Missionskontrolle erfasst · nie als Zahlen zitiert', 'Saisi par le contrôle de mission · jamais cité en chiffres'],
  'Sensor node · measured live · figures and stores counted by the crew':
    ['Sensorknoten · live gemessen · Zahlen und Vorräte von der Crew gezählt', 'Capteur · mesuré en direct · chiffres et réserves comptés par l’équipage'],
  'Everything, day by day': ['Alles, Tag für Tag', 'Tout, jour par jour'],
  'The whole mission': ['Die ganze Mission', 'Toute la mission'],

  'Today’s Schedule': ['Heutiger Tagesplan', 'Programme du jour'],
  // the day's scientific mission at the head of the dashboard (public.js, missionPanel; content/missions.json)
  'Today’s Mission': ['Heutige Mission', 'Mission du jour'],
  'Mission No.': ['Mission Nr.', 'Mission n°'],
  'Central question': ['Zentrale Frage', 'Question centrale'],
  'Morning': ['Vormittag', 'Matin'],
  'Afternoon': ['Nachmittag', 'Après-midi'],
  'Question for the community hour': ['Frage für die Community-Stunde', 'Question pour l’heure de la communauté'],
  // the day's question over the composer (public.js, composerPrompt)
  'The crew’s question today': ['Die Frage der Crew heute', 'La question de l’équipage aujourd’hui'],
  'Answer it below — or ask the crew something of your own.': ['Antworte unten — oder frag die Crew etwas Eigenes.', 'Répondez ci-dessous — ou posez votre propre question à l’équipage.'],
  'No mission filed for': ['Keine Mission eingetragen für', 'Aucune mission inscrite pour'],
  'Answered by the crew': ['Von der Crew beantwortet', 'Répondu par l’équipage'],
  'Click to see how far it has travelled': ['Klicken und sehen, wie weit sie schon gereist ist', 'Cliquez pour voir jusqu’où il a voyagé'],
  'The sheet for this mission is still to come.': ['Das Blatt zu dieser Mission kommt noch.', 'La fiche de cette mission est encore à venir.'],
  'No schedule filed for today': ['Für heute kein Plan erfasst', 'Aucun programme saisi pour aujourd’hui'],
  'Photographs and video — the gallery, and everything the crew send out of the habitat':
    ['Fotografien und Video — die Galerie und alles, was die Crew aus dem Habitat sendet', 'Photographies et vidéo — la galerie, et tout ce que l’équipage envoie depuis l’habitat'],
  'The whole mission, day by day — blogs, meals, consumption, habitat, crew condition and every exchange':
    ['Die ganze Mission, Tag für Tag — Blogs, Mahlzeiten, Verbrauch, Habitat, Verfassung der Crew und jeder Austausch',
     'Toute la mission, jour par jour — blogs, repas, consommation, habitat, état de l’équipage et chaque échange'],
  'under strain': ['unter Belastung', 'sous tension'],
  'all nominal': ['alles nominal', 'tout nominal'],
  'Opens': ['Öffnet', 'Ouvre'],
  'sol remaining': ['Sol verbleibend', 'sol restant'],
  'sols remaining': ['Sols verbleibend', 'sols restants'],
  // ---- About / info
  'Who we are': ['Wer wir sind', 'Qui sommes-nous ?'],
  'The habitat': ['Das Habitat', 'L’habitat'],
  'From Earth to the habitat': ['Von der Erde zum Habitat', 'De la Terre à l’habitat'],
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

  // ---- page chrome
  'Mars Communication Station': ['Mars-Kommunikationsstation', 'Station de communication Mars'],
  'MARS!platz – Ground Station': ['MARS!platz – Ground Station', 'MARS!platz – Ground Station'],   // the browser tab, as the text sheet has it
  'A live communication interface between an Earth-based audience and the crew of the MARS habitat.':
    ['Eine Live-Kommunikationsschnittstelle zwischen einem Publikum auf der Erde und der Crew des MARS-Habitats.',
     'Une interface de communication en direct entre un public sur Terre et l’équipage de l’habitat MARS.'],
  'Dark': ['Dunkel', 'Sombre'],
  'Display': ['Anzeige', 'Affichage'],
  'Pages': ['Seiten', 'Pages'],
  'EARTH–MARS': ['ERDE–MARS', 'TERRE–MARS'],
  'CLOSING': ['NÄHERND', 'EN RAPPROCHEMENT'],
  'SEPARATING': ['ENTFERNEND', 'EN ÉLOIGNEMENT'],
  'Media': ['Medien', 'Médias'],
  'Channel group': ['Kanalgruppe', 'Groupe de canaux'],
  'No such channel': ['Kein solcher Kanal', 'Aucun canal de ce nom'],
  'Nothing is transmitting on this address.': ['Auf dieser Adresse sendet nichts.', 'Rien n’émet à cette adresse.'],
  'Return to mission': ['Zurück zur Mission', 'Retour à la mission'],
  'Back to the mission': ['Zurück zur Mission', 'Retour à la mission'],
  'Day': ['Tag', 'Jour'],
  'today': ['heute', 'aujourd’hui'],
  'at': ['um', 'à'],
  'now': ['jetzt', 'maintenant'],
  'of the crossing': ['der Strecke', 'de la traversée'],

  // ---- the orbital plot
  'Plot of Earth and Mars in their orbits around the Sun. Current separation':
    ['Erde und Mars auf ihren Bahnen um die Sonne. Aktueller Abstand', 'La Terre et Mars sur leurs orbites autour du Soleil. Séparation actuelle'],
  'astronomical units': ['astronomische Einheiten', 'unités astronomiques'],
  'EARTH': ['ERDE', 'TERRE'],
  'MARS · HABITAT': ['MARS · HABITAT', 'MARS · HABITAT'],
  'Separation': ['Abstand', 'Séparation'],
  'Distance': ['Entfernung', 'Distance'],
  'Geometry': ['Geometrie', 'Géométrie'],
  'Nominal': ['Nominal', 'Nominal'],
  'Caution': ['Vorsicht', 'Attention'],
  'Out of range': ['Außerhalb des Bereichs', 'Hors plage'],
  'No signal': ['Kein Signal', 'Pas de signal'],

  // ---- the message pipeline
  'DRAFT': ['ENTWURF', 'BROUILLON'],
  'TRANSMITTED': ['GESENDET', 'TRANSMIS'],
  'ARRIVED': ['ANGEKOMMEN', 'ARRIVÉ'],
  'PENDING APPROVAL': ['WARTET AUF FREIGABE', 'EN ATTENTE D’APPROBATION'],
  'APPROVED': ['FREIGEGEBEN', 'APPROUVÉ'],
  'RESPONSE': ['ANTWORT', 'RÉPONSE'],
  'Draft': ['Entwurf', 'Brouillon'],
  'Transmitted': ['Gesendet', 'Transmis'],
  'In transit': ['Unterwegs', 'En transit'],
  'Arrived': ['Angekommen', 'Arrivé'],
  'Pending approval': ['Wartet auf Freigabe', 'En attente d’approbation'],
  'Approved': ['Freigegeben', 'Approuvé'],
  'Response': ['Antwort', 'Réponse'],
  'Published': ['Veröffentlicht', 'Publié'],
  // the path of a message, in six steps (the About page, What this is — info.js)

  // ---- after the run
  'mission complete': ['Mission abgeschlossen', 'mission accomplie'],
  'The habitat is empty.': ['Das Habitat ist leer.', 'L’habitat est vide.'],
  'What was said is still here.': ['Was gesagt wurde, ist noch da.', 'Ce qui a été dit est toujours là.'],
  'The crew went in on': ['Die Crew ging hinein am', 'L’équipage est entré le'],
  'and came out on': ['und kam heraus am', 'et ressorti le'],
  'Over the course of': ['Im Verlauf von', 'Au cours de'],
  'exchanges crossed the distance between an audience on Earth and three people who could not be reached any other way.':
    ['Nachrichtenwechsel haben die Distanz zwischen einem Publikum auf der Erde und drei Menschen überbrückt, die auf keinem anderen Weg erreichbar waren.',
     'échanges ont franchi la distance entre un public sur Terre et trois personnes que l’on ne pouvait joindre d’aucune autre manière.'],
  'Read the archive': ['Das Archiv lesen', 'Lire l’archive'],
  'About the project': ['Über das Projekt', 'À propos du projet'],
  'On this page': ['Auf dieser Seite', 'Sur cette page'],
  'There is no screen called': ['Es gibt keinen Screen namens', 'Il n’y a pas d’écran nommé'],
  'These are the screens:': ['Das sind die Screens:', 'Voici les écrans :'],
  'What the station carried': ['Was die Station getragen hat', 'Ce que la station a porté'],
  'MISSION': ['MISSION', 'MISSION'],
  'DURATION': ['DAUER', 'DURÉE'],
  'EXCHANGES': ['NACHRICHTENWECHSEL', 'ÉCHANGES'],
  'published': ['veröffentlicht', 'publiés'],
  'MESSAGES SENT': ['GESENDETE NACHRICHTEN', 'MESSAGES ENVOYÉS'],
  'CALLSIGNS ISSUED': ['VERGEBENE RUFZEICHEN', 'INDICATIFS ATTRIBUÉS'],
  'The communication channel is closed. The archive is not — it stays readable, and it stays part of the work.':
    ['Der Kommunikationskanal ist geschlossen. Das Archiv nicht — es bleibt lesbar, und es bleibt Teil des Werks.',
     'Le canal de communication est fermé. L’archive, non — elle reste lisible, et elle reste partie de l’œuvre.'],
  'Full archive': ['Ganzes Archiv', 'Archive complète'],
  'NOTHING WAS PUBLISHED DURING THIS MISSION': ['WÄHREND DIESER MISSION WURDE NICHTS VERÖFFENTLICHT', 'RIEN N’A ÉTÉ PUBLIÉ PENDANT CETTE MISSION'],

  // ---- the portal
  'Communication Portal': ['Kommunikationsportal', 'Portail de communication'],
  'Composer': ['Schreibgerät', 'Composeur'],
  'Message': ['Nachricht', 'Message'],
  'QUESTION': ['FRAGE', 'QUESTION'],
  'PERSONAL': ['PERSÖNLICH', 'PERSONNEL'],
  'HUMOUR': ['HUMOR', 'HUMOUR'],
  'SCIENCE': ['WISSENSCHAFT', 'SCIENCE'],
  'HABITAT': ['HABITAT', 'HABITAT'],
  'CHANNEL CLOSED': ['KANAL GESCHLOSSEN', 'CANAL FERMÉ'],
  'There is nobody in the habitat to read this yet.': ['Noch ist niemand im Habitat, der das lesen könnte.', 'Il n’y a encore personne dans l’habitat pour lire ceci.'],
  'The channel opens on': ['Der Kanal öffnet am', 'Le canal ouvre le'],
  'and stays open for': ['und bleibt offen für', 'et reste ouvert pendant'],
  'The crew left the habitat on': ['Die Crew hat das Habitat verlassen am', 'L’équipage a quitté l’habitat le'],
  'the channel closed at the end of': ['der Kanal wurde geschlossen am Ende des', 'le canal a été fermé à la fin du'],
  'Nothing sent now would reach anyone.': ['Was jetzt gesendet würde, erreichte niemanden mehr.', 'Rien de ce qui serait envoyé maintenant n’atteindrait personne.'],
  'Read what was sent': ['Lesen, was gesendet wurde', 'Lire ce qui a été envoyé'],
  'YOUR CALLSIGN': ['DEIN RUFZEICHEN', 'VOTRE INDICATIF'],
  'IS STILL RESERVED.': ['IST WEITERHIN RESERVIERT.', 'EST TOUJOURS RÉSERVÉ.'],
  'IT WILL BE WAITING IF YOU COME BACK.': ['ES WARTET AUF DICH, WENN DU WIEDERKOMMST.', 'IL VOUS ATTENDRA SI VOUS REVENEZ.'],
  'The message crossing from Earth to Mars': ['Die Nachricht auf dem Weg von der Erde zum Mars', 'Le message en route de la Terre vers Mars'],
  'Mars': ['Mars', 'Mars'],
  'Earth': ['Erde', 'Terre'],
  'Sending': ['Sendet', 'Envoi'],
  'Message in transit': ['Nachricht unterwegs', 'Message en transit'],
  'Real crossing': ['Echte Laufzeit', 'Traversée réelle'],
  'Mars Habitat': ['Mars-Habitat', 'Habitat martien'],
  'The real message would take': ['Die echte Nachricht bräuchte', 'Le vrai message mettrait'],
  'at a distance of': ['bei', 'à'],
  'this dial compresses it.': ['diese Anzeige verkürzt sie.', 'ce cadran la comprime.'],
  'The wait you are having is shorter than the one the crew have.': ['Dein Warten ist kürzer als das der Crew.', 'Votre attente est plus courte que celle de l’équipage.'],
  'Arrives': ['Kommt an', 'Arrive'],
  'Delivered · awaiting review': ['Zugestellt · wartet auf Durchsicht', 'Livré · en attente de lecture'],
  'Write something before transmitting.': ['Schreib etwas, bevor du sendest.', 'Écrivez quelque chose avant de transmettre.'],
  'Messages are limited to': ['Nachrichten sind begrenzt auf', 'Les messages sont limités à'],
  'characters.': ['Zeichen.', 'caractères.'],
  'The uplink is saturated from your position. Try again later.': ['Der Uplink ist von deiner Position aus gesättigt. Versuch es später noch einmal.', 'La liaison montante est saturée depuis votre position. Réessayez plus tard.'],
  'Waiting to be read in the habitat': ['Wartet darauf, im Habitat gelesen zu werden', 'En attente de lecture dans l’habitat'],
  'Read and cleared for the board': ['Gelesen und für das Board freigegeben', 'Lu et autorisé pour le tableau'],
  'Not carried forward': ['Nicht weitergetragen', 'Non retenu'],
  'Published with a reply': ['Mit Antwort veröffentlicht', 'Publié avec une réponse'],
  'Arrived at Mars': ['Auf dem Mars angekommen', 'Arrivé sur Mars'],

  // ---- the board's cards
  'New': ['Neu', 'Nouveau'],
  'Mars habitat': ['Mars-Habitat', 'Habitat martien'],
  'All': ['Alle', 'Tous les'],

  // ---- dashboard
  'Countdown': ['Countdown', 'Compte à rebours'],
  'Elapsed': ['Verstrichen', 'Écoulé'],
  'officers': ['Offiziere', 'officiers'],
  'The sols of the run': ['Die Sols des Laufs', 'Les sols de la période'],
  'done': ['erledigt', 'faits'],
  'tasks': ['Aufgaben', 'tâches'],
  'meals': ['Mahlzeiten', 'repas'],
  'Breakfast': ['Frühstück', 'Petit-déjeuner'],
  'Lunch': ['Mittagessen', 'Déjeuner'],
  'Dinner': ['Abendessen', 'Dîner'],
  'Ration': ['Ration', 'Ration'],
  'Extra meal': ['Zusätzliche Mahlzeit', 'Repas supplémentaire'],
  'with': ['mit', 'avec'],
  'an added meal counts with the meal whose hours cover the time it is served at': ['eine zusätzliche Mahlzeit zählt zu der Mahlzeit, in deren Stunden sie serviert wird', 'un repas supplémentaire compte avec le repas dont les heures couvrent l’heure où il est servi'],
  'Power: the food meter, read': ['Strom: der Energiezähler Food, gelesen', 'Électricité : le compteur d’énergie Food, lu'],
  'an added meal between its own hours': ['eine zusätzliche Mahlzeit zwischen ihren eigenen Uhrzeiten', 'un repas supplémentaire entre ses propres horaires'],
  'No state filed yet': ['Noch kein Zustand erfasst', 'Aucun état saisi pour l’instant'],
  'Condition as reported · never as numbers': ['Verfassung wie berichtet · nie als Zahlen', 'État tel que rapporté · jamais en chiffres'],
  'Scale': ['Skala', 'Échelle'],
  'Last recorded': ['Zuletzt erfasst', 'Dernier relevé'],
  'crew total': ['Crew gesamt', 'total équipage'],
  'COMMUNICATION': ['KOMMUNIKATION', 'COMMUNICATION'],
  'Counted by the crew': ['Von der Crew gezählt', 'Compté par l’équipage'],
  'a day on average': ['pro Tag im Schnitt', 'par jour en moyenne'],
  'Nothing recorded yet': ['Noch nichts erfasst', 'Rien d’enregistré pour l’instant'],
  'nothing recorded': ['nichts erfasst', 'rien d’enregistré'],
  'steps': ['Schritte', 'pas'],
  'No inventory filed for today': ['Für heute kein Bestand erfasst', 'Aucun inventaire saisi pour aujourd’hui'],
  'days left': ['Tage übrig', 'jours restants'],
  'ample': ['reichlich', 'ample'],
  'no draw': ['kein Verbrauch', 'pas de consommation'],
  'Habitat hardware': ['Habitat-Hardware', 'Matériel de l’habitat'],
  'device': ['Gerät', 'appareil'],
  'devices': ['Geräte', 'appareils'],
  'read by the station every': ['von der Station gelesen alle', 'lu par la station toutes les'],
  'one point per hour': ['ein Punkt pro Stunde', 'un point par heure'],
  'nothing leaves the venue': ['nichts verlässt den Ort', 'rien ne quitte le lieu'],
  'Home Assistant could not be reached on the last poll': ['Home Assistant war beim letzten Abruf nicht erreichbar', 'Home Assistant n’a pas pu être joint lors de la dernière lecture'],
  'these are the last readings stored.': ['dies sind die letzten gespeicherten Messwerte.', 'voici les dernières mesures enregistrées.'],
  'The record is closed — the hardware was last read before the end of 27 October 2026.':
    ['Die Aufzeichnung ist geschlossen — die Hardware wurde zuletzt vor Ende des 27. Oktober 2026 gelesen.', 'L’archive est close — le matériel a été lu pour la dernière fois avant la fin du 27 octobre 2026.'],
  'Not in the feed:': ['Nicht im Feed:', 'Absent du flux :'],
  'check the id in content/home-assistant.json.': ['prüfe die ID in content/home-assistant.json.', 'vérifiez l’identifiant dans content/home-assistant.json.'],
  'WAITING FOR THE FIRST READINGS FROM THE HARDWARE': ['WARTE AUF DIE ERSTEN MESSWERTE DER HARDWARE', 'EN ATTENTE DES PREMIÈRES MESURES DU MATÉRIEL'],
  'NO DEVICES CONFIGURED IN CONTENT/HOME-ASSISTANT.JSON': ['KEINE GERÄTE IN CONTENT/HOME-ASSISTANT.JSON KONFIGURIERT', 'AUCUN APPAREIL CONFIGURÉ DANS CONTENT/HOME-ASSISTANT.JSON'],
  'Every hardware device today, midnight to midnight venue time, one line each, each on its own scale.':
    ['Jedes Hardware-Gerät heute, von Mitternacht bis Mitternacht Ortszeit, je eine Linie, jede auf eigener Skala.',
     'Chaque appareil aujourd’hui, de minuit à minuit heure du lieu, une ligne chacun, chacune sur sa propre échelle.'],
  'The whole day, midnight to midnight, venue time — the axis numbered in hours, 00 to 24 — one point per hour (a gauge’s hour is its mean, a meter’s its last value), the dashed orange mark is now, and the running hour’s point moves with each read until the hour is done. Each line rides its own scale — its lowest to highest today — so a meter in watt-hours and a sensor in degrees share the day without sharing an axis. The label at the end of each line carries the current reading.':
    ['Der ganze Tag, von Mitternacht bis Mitternacht Ortszeit — die Achse in Stunden nummeriert, 00 bis 24 — ein Punkt pro Stunde (bei einem Messfühler der Stundenmittelwert, bei einem Zähler der letzte Wert), die gestrichelte orange Marke ist jetzt, und der Punkt der laufenden Stunde wandert mit jedem Abruf, bis die Stunde vorbei ist. Jede Linie hat ihre eigene Skala — ihr heutiges Minimum bis Maximum —, sodass ein Zähler in Wattstunden und ein Sensor in Grad denselben Tag teilen, ohne eine Achse zu teilen. Die Beschriftung am Ende jeder Linie trägt den aktuellen Wert.',
     'La journée entière, de minuit à minuit heure du lieu — l’axe numéroté en heures, de 00 à 24 — un point par heure (pour une sonde, la moyenne de l’heure ; pour un compteur, sa dernière valeur), le trait orange en pointillé marque maintenant, et le point de l’heure en cours bouge à chaque lecture jusqu’à la fin de l’heure. Chaque ligne suit sa propre échelle — de son minimum à son maximum du jour —, si bien qu’un compteur en wattheures et un capteur en degrés partagent la journée sans partager d’axe. L’étiquette au bout de chaque ligne porte la valeur actuelle.'],
  'Hardware': ['Hardware', 'Matériel'],
  'Energy': ['Energie', 'Énergie'],
  'Other': ['Sonstiges', 'Autre'],
  'one chart per quantity': ['ein Diagramm pro Messgröße', 'un graphique par grandeur'],
  'added since midnight': ['seit Mitternacht hinzugekommen', 'ajouté depuis minuit'],
  'today, midnight to midnight venue time, one line per device, on one scale in':
    ['heute, von Mitternacht bis Mitternacht Ortszeit, eine Linie pro Gerät, auf einer Skala in',
     'aujourd’hui, de minuit à minuit heure du lieu, une ligne par appareil, sur une même échelle en'],
  'use': ['Verbrauch', 'consommation'],
  'Daily use': ['Tagesverbrauch', 'Consommation journalière'],
  'Power': ['Energie', 'Énergie'],
  'Power · all categories': ['Energie · alle Kategorien', 'Énergie · toutes catégories'],
  'Meals energy': ['Mahlzeiten Energie', 'Repas énergie'],
  'Meals water': ['Mahlzeiten Wasser', 'Repas eau'],
  'Meals power': ['Mahlzeiten Strom', 'Repas électricité'],
  'Activity': ['Aktivität', 'Activité'],
  'Tasks done': ['Erledigte Aufgaben', 'Tâches faites'],
  'Messages from Earth': ['Nachrichten von der Erde', 'Messages de la Terre'],
  'Exchanges published': ['Veröffentlichte Nachrichtenwechsel', 'Échanges publiés'],
  'Crew log entries': ['Logbucheinträge', 'Entrées du journal de bord'],
  'Media sent out': ['Gesendete Medien', 'Médias envoyés'],
  'Air pressure': ['Luftdruck', 'Pression atmosphérique'],
  'Node battery': ['Knoten-Batterie', 'Batterie du capteur'],
  'Node signal': ['Knoten-Signal', 'Signal du capteur'],
  'entries written': ['Einträge geschrieben', 'entrées écrites'],
  'written from inside': ['von innen geschrieben', 'écrit de l’intérieur'],
  'Written from inside': ['Von innen geschrieben', 'Écrit de l’intérieur'],
  'written': ['geschrieben', 'écrites'],
  'placeholder': ['Platzhalter', 'espace réservé'],
  'Filter the crew log': ['Das Logbuch filtern', 'Filtrer le journal de bord'],
  'ALL CREW': ['GANZE CREW', 'TOUT L’ÉQUIPAGE'],
  'Nothing written by them yet': ['Noch nichts von ihnen geschrieben', 'Rien d’écrit par eux pour l’instant'],
  'Open the full crew log — every entry, day by day': ['Das ganze Logbuch öffnen — jeder Eintrag, Tag für Tag', 'Ouvrir le journal de bord complet — chaque entrée, jour par jour'],
  'No entries have been filed yet': ['Noch keine Einträge erfasst', 'Aucune entrée saisie pour l’instant'],
  'item': ['Element', 'élément'],
  'items': ['Elemente', 'éléments'],
  'originals, every one downloadable': ['Originale, jedes davon herunterladbar', 'des originaux, chacun téléchargeable'],
  'photographs, video and sound out of the habitat': ['Fotografien, Video und Ton aus dem Habitat', 'photographies, vidéo et son sortis de l’habitat'],
  'See everything': ['Alles sehen', 'Tout voir'],
  'All media, day by day': ['Alle Medien, Tag für Tag', 'Tous les médias, jour par jour'],
  'Download everything': ['Alles herunterladen', 'Tout télécharger'],
  'Nothing has been sent out of the habitat yet': ['Aus dem Habitat wurde noch nichts gesendet', 'Rien n’est encore sorti de l’habitat'],
  'occupied from': ['bewohnt ab', 'occupé à partir du'],
  // the three daily blogs under the trend graph (src/views/pages/public.js)
  'Daily Mission Report': ['Täglicher Missionsbericht', 'Rapport de mission quotidien'],
  'Health Report': ['Gesundheitsbericht', 'Rapport de santé'],
  'Commander Blog': ['Commander-Blog', 'Blog du commandement'],
  'ALL BLOGS': ['ALLE BLOGS', 'TOUS LES BLOGS'],
  'blog posts': ['Blogbeiträge', 'billets de blog'],
  'Nothing written in this blog yet': ['In diesem Blog steht noch nichts', 'Rien d’écrit dans ce blog pour l’instant'],
  'Three blogs come out of the habitat each day: the Commander Blog, the Daily Mission Report and the Health Report. Nobody edits them on the way out.': ['Jeden Tag kommen drei Blogs aus dem Habitat: der Commander-Blog, der tägliche Missionsbericht und der Gesundheitsbericht. Niemand bearbeitet sie auf dem Weg nach draußen.', 'Chaque jour, trois blogs sortent de l’habitat : le blog du commandement, le rapport de mission quotidien et le rapport de santé. Personne ne les retouche en chemin.'],
  // each is followed by the day it speaks of: "… for SOL 005"
  'No mission report yet for': ['Noch kein Missionsbericht für', 'Pas encore de rapport de mission pour'],
  'No health report yet for': ['Noch kein Gesundheitsbericht für', 'Pas encore de rapport de santé pour'],
  'No commander blog yet for': ['Noch kein Commander-Blog für', 'Pas encore de blog du commandement pour'],
  'No schedule filed yet': ['Noch kein Plan erfasst', 'Aucun programme saisi pour l’instant'],

  // ---- the landing page's aura layout: the composer's heading, the blogs' heading, the menu, the lead
  'Write to the crew': ['Schreib der Crew', 'Écrivez à l’équipage'],
  'Live Mission Dashboard': ['Missions-Dashboard live', 'Suivi de mission en temps réel'],
  'Dashboard': ['Dashboard', 'Tableau de bord'],
  'More': ['Mehr', 'Plus'],
  'Everything else on the station': ['Alles Weitere auf der Station', 'Tout le reste de la station'],
  'Show more': ['Mehr anzeigen', 'Afficher plus'],
  // the wall of notes (the Write page's board, public.js noteCard, boardWall)
  'you': ['du', 'vous'],
  'In': ['In', 'Dans'],
  'No tag': ['Ohne Schlagwort', 'Sans mot-clé'],
  'Loading older exchanges…': ['Ältere Antworten werden geladen …', 'Chargement des échanges plus anciens…'],
  'The beginning of the correspondence': ['Der Anfang der Korrespondenz', 'Le début de la correspondance'],
  'Crew answer': ['Antwort der Crew', 'Réponse de l’équipage'],
  // the sky over the dome names each part of an exchange (sky.js)
  'Question': ['Frage', 'Question'],
  'Answer': ['Antwort', 'Réponse'],
  // the notes a touch on the sky brings (sky.js, skyNotes; public/sky.js), and the LIVE mark on the sheet (sky.js, habitatSheet)
  'LIVE FEED': ['LIVE-FEED', 'FLUX EN DIRECT'],
  'Live feed from the habitat': ['Live-Feed aus dem Habitat', 'Le flux en direct de l’habitat'],
  'Media Gallery': ['Mediengalerie', 'Galerie médias'],
  'LATEST COMMUNICATION': ['NEUESTE KOMMUNIKATION', 'DERNIÈRE COMMUNICATION'],
  'The latest communication from the habitat': ['Die neueste Kommunikation aus dem Habitat', 'La dernière communication de l’habitat'],
  'Live — the habitat as it is now: its readings, the newest pictures and the latest exchanges':
    ['Live — das Habitat, wie es jetzt ist: seine Messwerte, die neuesten Bilder und die letzten Austausche', 'En direct — l’habitat tel qu’il est maintenant : ses mesures, les dernières images et les derniers échanges'],
  'Home': ['Start', 'Accueil'],
  'Cookies': ['Cookies', 'Cookies'],
  'One cookie: your callsign (e.g. BASALT-625), so you find your messages when you come back. Theme and language are kept the same way. No account, no tracking, nothing passed on.':
    ['Ein Cookie: dein Rufzeichen (z. B. BASALT-625), damit du deine Nachrichten wiederfindest, wenn du zurückkommst. Thema und Sprache werden genauso gemerkt. Kein Konto, kein Tracking, nichts wird weitergegeben.',
     'Un cookie : votre indicatif (p. ex. BASALT-625), pour retrouver vos messages à votre retour. Thème et langue sont gardés de la même manière. Pas de compte, pas de pistage, rien n’est transmis.'],
  'Learn more': ['Mehr erfahren', 'En savoir plus'],
  'Welcome': ['Willkommen', 'Bienvenue'],
  'Incoming transmission': ['Eingehende Übertragung', 'Transmission entrante'],
  'To make sure you talk to the Mars habitat under the same call sign every time, please accept. If you do not, you will be given a new name on each visit and cannot see your own messages. We do not track anything.':
    ['Damit du immer unter demselben Rufzeichen mit dem Mars-Habitat sprichst, stimme bitte zu. Sonst bekommst du bei jedem Besuch einen neuen Namen und kannst deine eigenen Nachrichten nicht sehen. Wir verfolgen nichts.',
     'Pour parler à l’habitat martien toujours sous le même indicatif, merci d’accepter. Sinon, vous recevrez un nouveau nom à chaque visite et ne pourrez pas voir vos propres messages. Nous ne suivons rien.'],
  'Agree and close': ['Zustimmen und schließen', 'Accepter et fermer'],
  'Accept': ['Akzeptieren', 'Accepter'],
  'Privacy policy': ['Datenschutz', 'Politique de confidentialité'],
  'Imprint': ['Impressum', 'Mentions légales'],
  'hourly average': ['Stundenmittel', 'moyenne horaire'],
  'low': ['Tief', 'min'],
  'Today · before the run': ['Heute · vor dem Start', 'Aujourd’hui · avant le départ'],
  'from the meter and the crew': ['vom Zähler und von der Crew', 'du compteur et de l’équipage'],
  'energy used, from the meters': ['verbrauchte Energie, von den Zählern', 'énergie consommée, relevée aux compteurs'],
  'No reading from the meter yet today, and nothing filed by the crew': ['Heute noch kein Zählerwert und nichts von der Crew eingetragen', 'Pas encore de relevé du compteur aujourd’hui, rien de noté par l’équipage'],
  'No reading from the meters yet today, and nothing filed by the crew': ['Heute noch keine Zählerwerte und nichts von der Crew eingetragen', 'Pas encore de relevé des compteurs aujourd’hui, rien de noté par l’équipage'],
  'high': ['Hoch', 'max'],
  'Reject': ['Ablehnen', 'Refuser'],
  'Callsign on sending': ['Rufzeichen beim Senden', 'Indicatif à l’envoi'],
  'Your message went under the callsign': ['Deine Nachricht ging unter dem Rufzeichen', 'Votre message est parti sous l’indicatif'],
  'look for it on the Message Board once the crew have answered.': ['such es auf dem Nachrichtenboard, sobald die Crew geantwortet hat.', 'cherchez-le sur le tableau des messages une fois que l’équipage aura répondu.'],
  'Latest from the crew': ['Das Neueste von der Crew', 'Le dernier mot de l’équipage'],
  'At a glance': ['Auf einen Blick', 'Vue d’ensemble'],
  'The station, page by page': ['Die Station, Seite für Seite', 'La station, page par page'],
  'Send a message to the Crew': ['Schick der Crew eine Nachricht', 'Envoyez un message à l’équipage'],
  'Daily Blog': ['Tagesblog', 'Blog du jour'],
  'Collapse': ['Einklappen', 'Replier'],
  'Expand': ['Ausklappen', 'Déplier'],
  'Commander · Health · Science': ['Commander · Gesundheit · Wissenschaft', 'Commandement · Santé · Science'],

  // ---- crew condition (src/lib/mood.js)
  'THRILLED': ['BEGEISTERT', 'RAVI'],
  'HAPPY': ['GLÜCKLICH', 'HEUREUX'],
  'NEUTRAL': ['NEUTRAL', 'NEUTRE'],
  'UPSET': ['BEDRÜCKT', 'CONTRARIÉ'],
  'ANGRY': ['WÜTEND', 'EN COLÈRE'],
  'NO DATA': ['KEINE DATEN', 'PAS DE DONNÉES'],
  'thrilled — on top of the world': ['begeistert — ganz oben auf', 'ravi — aux anges'],
  'happy, in good spirits': ['glücklich, gut gelaunt', 'heureux, de bonne humeur'],
  'neutral — neither up nor down': ['neutral — weder oben noch unten', 'neutre — ni haut ni bas'],
  'upset, not having a good day': ['bedrückt, kein guter Tag', 'contrarié, une journée difficile'],
  'angry, needing distance': ['wütend, braucht Abstand', 'en colère, a besoin de distance'],
  'No report has been received from this crew member.': ['Von diesem Crewmitglied ist kein Bericht eingegangen.', 'Aucun rapport n’a été reçu de ce membre de l’équipage.'],

  // ---- About / info
  'MARS! – Mobilizing Awareness for Resilient Societies!': ['MARS! – Mobilizing Awareness for Resilient Societies!', 'MARS! – Mobilizing Awareness for Resilient Societies!'],
  'The crew, the producer, the partners': ['Die Crew, der Produzent, die Partner', 'L’équipage, le producteur, les partenaires'],
  'Close': ['Schließen', 'Fermer'],
  'In the project MARS! – Mobilizing Awareness for Resilient Societies!, we want to challenge the signifier the planet Mars has become as a refuge planet for the richest of us, and to use it instead to address very pressing Earth matters. We will imagine for a moment that we, the global society, have decided to make Mars settlements a democratic Commons project. Rather than being left behind on a burning planet and looking on as the wealthy leave towards redder pastures, we will make Mars a democratic project for the rest of us, designing practical and utopian aspects of the question “What would we do if we could start over?”':
    ['Im Projekt MARS! – Mobilizing Awareness for Resilient Societies! wollen wir das Zeichen infrage stellen, zu dem der Planet Mars geworden ist – ein Zufluchtsplanet für die Reichsten unter uns – und es stattdessen nutzen, um sehr drängende Fragen der Erde anzugehen. Wir stellen uns für einen Moment vor, wir, die Weltgesellschaft, hätten beschlossen, Marssiedlungen zu einem demokratischen Gemeingut-Projekt zu machen. Statt auf einem brennenden Planeten zurückzubleiben und zuzusehen, wie die Wohlhabenden zu röteren Weiden aufbrechen, machen wir den Mars zu einem demokratischen Projekt für uns alle – und entwerfen die praktischen und die utopischen Seiten der Frage „Was würden wir tun, wenn wir noch einmal von vorn anfangen könnten?“',
     'Dans le cadre du projet MARS! – Mobilizing Awareness for Resilient Societies!, nous souhaitons remettre en question ce que la planète Mars en est venue à symboliser : une planète refuge réservée aux plus riches d’entre nous. Nous voulons au contraire nous en servir pour aborder des enjeux très concrets et urgents auxquels nous sommes confrontés sur Terre.\n\nImaginons un instant que nous, en tant que société mondiale, ayons décidé de faire de l’installation humaine sur Mars un projet démocratique fondé sur les communs. Plutôt que de rester sur une planète en feu en regardant les plus fortunés partir vers des horizons plus rouges, nous ferions de Mars un projet démocratique accessible à toutes et tous, en explorant les dimensions pratiques et utopiques d’une question : « Que ferions-nous si nous pouvions tout recommencer ? »'],
  'To this end, we invited scientists and citizen scientists to come together at ZKM | Karlsruhe to design and prototype key features of what a Mars settlement would look like: a habitat able to withstand adverse weather conditions; a recycling system that makes the best use of valuable resources; a social order that is able to work under crisis and duress; a care system for a planet that did not ask for human presence.':
    ['Dafür haben wir Wissenschaftlerinnen, Wissenschaftler und Citizen Scientists eingeladen, im ZKM | Karlsruhe gemeinsam die Kernstücke einer Marssiedlung zu entwerfen und als Prototypen zu bauen: ein Habitat, das widrigem Wetter standhält; ein Recyclingsystem, das wertvolle Ressourcen bestmöglich nutzt; eine Gesellschaftsordnung, die unter Krise und Druck funktioniert; ein System der Sorge für einen Planeten, der nicht um menschliche Anwesenheit gebeten hat.',
     'Dans cette perspective, nous avons invité des scientifiques et des scientifiques citoyens à se réunir au ZKM | Karlsruhe afin de concevoir et de prototyper les éléments essentiels d’une installation humaine sur Mars : un habitat capable de résister à des conditions environnementales hostiles ; un système de recyclage permettant d’utiliser au mieux des ressources précieuses ; une organisation sociale capable de fonctionner en situation de crise et sous forte contrainte ; et un système de soin pour une planète qui n’a jamais demandé la présence humaine.'],
  'During the project that began in January 2026, we noticed that all the skills needed for a democratic Mars settlement were also needed to adjust to a climate-changed Earth, giving us the necessary competence to start building a better society today. Going to Mars slowly became MARS!, and we became aware of what we need to do in order to become a resilient society right here, where we are.':
    ['Im Laufe des Projekts, das im Januar 2026 begann, fiel uns auf, dass alle Fähigkeiten, die eine demokratische Marssiedlung braucht, auch gebraucht werden, um sich auf eine vom Klimawandel veränderte Erde einzustellen – und dass sie uns die Kompetenz geben, schon heute mit dem Bau einer besseren Gesellschaft zu beginnen. Aus dem Flug zum Mars wurde nach und nach MARS!, und uns wurde bewusst, was wir tun müssen, um genau hier, wo wir sind, eine resiliente Gesellschaft zu werden.',
     'Au cours du projet, qui a débuté en janvier 2026, nous avons constaté que toutes les compétences nécessaires à la création d’une installation martienne démocratique étaient également indispensables pour nous adapter à une Terre transformée par le changement climatique. Elles nous donnent ainsi les moyens de commencer, dès aujourd’hui, à construire une société meilleure. Peu à peu, aller sur Mars est devenu MARS!, et nous avons pris conscience de ce que nous devons faire pour devenir une société résiliente ici même, là où nous sommes.'],
  'The five prototype workshops {habitat}, {mental}, {food}, {governance}, and {resources} turned into a {exhibition} that ran at ZKM from June to September 2026. This, the MARS!platz performance, is the third part of the project: a field test where ideas, concepts and prototypes gathered in the workshop and exhibition phase are now tested under analogue conditions, by us, directly in the heart of the city, the Karlsruhe Marktplatz. Turned into MARS!platz for two weeks, we live, eat and sleep under the stars of Karlsruhe, testing out how we, as ordinary citizens and artistic researchers, would cope with a new beginning that is never quite remote from what we’re bringing with us.':
    ['Aus den fünf Prototypen-Workshops {habitat}, {mental}, {food}, {governance} und {resources} wurde eine {exhibition}, die von Juni bis September 2026 im ZKM zu sehen war. Dies, die MARS!platz-Performance, ist der dritte Teil des Projekts: ein Feldversuch, in dem die Ideen, Konzepte und Prototypen aus der Workshop- und Ausstellungsphase nun unter analogen Bedingungen getestet werden – von uns, mitten im Herzen der Stadt, auf dem Karlsruher Marktplatz. Zwei Wochen lang zum MARS!platz geworden, leben, essen und schlafen wir unter den Sternen von Karlsruhe und probieren aus, wie wir, als gewöhnliche Bürgerinnen und Bürger und als künstlerisch Forschende, mit einem Neuanfang zurechtkämen, der nie ganz fern von dem ist, was wir mitbringen.',
     'Les cinq ateliers de prototypage consacrés à l’{habitat}, à la {mental}, à l’{food}, à la {governance} et à la {resources} ont donné naissance à une {exhibition}, présentée au ZKM de juin à septembre 2026.\n\nLa performance MARS!platz constitue la troisième partie du projet : un test grandeur nature au cours duquel les idées, concepts et prototypes développés durant les ateliers et l’exposition sont désormais mis à l’épreuve dans des conditions analogues, directement par nous, au cœur de la ville, sur la Marktplatz de Karlsruhe.\n\nTransformée en MARS!platz pendant deux semaines, la place devient notre lieu de vie : nous y vivons, mangeons et dormons sous le ciel de Karlsruhe. En tant que citoyens ordinaires et chercheurs artistiques, nous expérimentons ainsi la manière dont nous pourrions faire face à un nouveau départ, qui n’est finalement jamais totalement détaché de tout ce que nous emportons avec nous.'],
  'Habitat': ['Habitat', 'Habitat'],
  'Mental Health': ['Mentale Gesundheit', 'Santé mentale'],
  'Food': ['Ernährung', 'Alimentation'],
  'Governance': ['Governance', 'Gouvernance'],
  'Resource Management': ['Ressourcenmanagement', 'Gestion des ressources'],
  'concept exhibition': ['Konzeptausstellung', 'exposition conceptuelle'],
  'Why are we doing this?': ['Warum tun wir das?', 'Pourquoi faisons-nous cela ?'],
  'Playacting Mars in the middle of the city': ['Mars spielen, mitten in der Stadt', 'Jouer à vivre sur Mars au cœur de la ville'],
  'When the three artistic research astronauts of ZKM move into their habitat on Marktplatz in October 2026, the actual planet Mars will be {million} million kilometres away from Earth. It is, as yet, unsure if we would ever be able to get there, or if this is a desirable goal. What we do know is that space travel is a catalyst, a motor of dreams and imaginations and problem solving. Since January 2026, we have seen again and again that the imagination of being a spacefaring society is sparking innovation and solutions that could also be applied here on Earth, to aid in the transformation and change needed to cope with Earth’s changing climate and social parameters.':
    ['Wenn die drei künstlerisch forschenden Astronautinnen und Astronauten des ZKM im Oktober 2026 ihr Habitat auf dem Marktplatz beziehen, ist der wirkliche Planet Mars {million} Millionen Kilometer von der Erde entfernt. Ob wir je dorthin gelangen könnten – und ob das überhaupt ein erstrebenswertes Ziel ist –, steht noch dahin. Was wir wissen: Raumfahrt ist ein Katalysator, ein Motor für Träume, Vorstellungen und das Lösen von Problemen. Seit Januar 2026 haben wir immer wieder gesehen, dass die Vorstellung, eine raumfahrende Gesellschaft zu sein, Innovationen und Lösungen anstößt, die sich auch hier auf der Erde anwenden ließen – als Hilfe für den Wandel, den das sich verändernde Klima und die veränderten gesellschaftlichen Bedingungen der Erde verlangen.',
     'Lorsque les trois astronautes-chercheurs artistiques du ZKM emménagent dans leur habitat sur la Marktplatz en octobre 2026, la véritable planète Mars se trouve à {million} millions de kilomètres de la Terre. Nous ne savons toujours pas avec certitude si nous pourrons un jour nous y rendre, ni même si cela constitue un objectif souhaitable.\n\nCe que nous savons en revanche, c’est que le voyage spatial agit comme un catalyseur : il nourrit les rêves et l’imaginaire et stimule la recherche de solutions. Depuis janvier 2026, nous constatons encore et encore que le simple fait d’imaginer une société capable de voyager dans l’espace suscite des innovations et des solutions qui pourraient également être appliquées ici, sur Terre, afin d’accompagner les transformations nécessaires face aux évolutions climatiques et sociales de notre planète.'],
  'Because ZKM is so much more than a museum, ideas born in it cannot be contained by its walls. We needed to go out, to seek new interactions and come into contact with new ideas and new people. Instead of imitating space agencies who host “analogue missions” in remote areas, we decided that the middle of a densely populated city is just the right environment to simulate life on the loneliest planet in our solar system.':
    ['Weil das ZKM so viel mehr ist als ein Museum, lassen sich die Ideen, die darin entstehen, nicht von seinen Wänden halten. Wir mussten hinaus – neue Begegnungen suchen, mit neuen Ideen und neuen Menschen in Berührung kommen. Statt Raumfahrtagenturen nachzuahmen, die „Analogmissionen“ in abgelegenen Gegenden veranstalten, haben wir entschieden, dass die Mitte einer dicht besiedelten Stadt genau die richtige Umgebung ist, um das Leben auf dem einsamsten Planeten unseres Sonnensystems zu simulieren.',
     'Parce que le ZKM est bien plus qu’un musée, les idées qui y naissent ne peuvent rester enfermées entre ses murs. Nous devions sortir, provoquer de nouvelles interactions et aller à la rencontre de nouvelles idées et de nouvelles personnes.\n\nPlutôt que d’imiter les agences spatiales, qui organisent généralement leurs « missions analogues » dans des régions isolées, nous avons décidé que le centre d’une ville densément peuplée était précisément l’endroit idéal pour simuler la vie sur la planète la plus solitaire de notre système solaire.'],
  'The Habitat – Red Dust City': ['Das Habitat – Red Dust City', 'L’Habitat – Red Dust City'],
  'The dome (lent to us by Staatstheater Karlsruhe) has a diameter of just under 10 m, making it a 75 square metre habitat for three astronauts from ZKM | Hertzlab, the artistic research department at ZKM. In three roles – Commander, Health Officer, Science Officer – we will simulate a Martian settlement, cooking, working and sleeping in the Habitat. The city society is invited to act as our ground station, to write us messages, to look into our daily activities, to meet us while we’re out on walks in our space suits or to communicate with us directly each day. Every day, 11 days in total, we tackle one big question that was raised during the project: How do people collaborate, if communication is disrupted by distance? Does human survival on Mars depend on art and beauty being present? How much is the cost (in terms of energy expenditure) of keeping a human alive? And how do we, from our anthropocentric perspective, perceive the more-than-human spacefaring existences of our “Spaceship Earth”?':
    ['Die Kuppel (eine Leihgabe des Staatstheaters Karlsruhe) hat einen Durchmesser von knapp 10 m und bietet damit ein 75 Quadratmeter großes Habitat für drei Astronautinnen und Astronauten des ZKM | Hertzlab, der Abteilung für künstlerische Forschung am ZKM. In drei Rollen – Commander, Health Officer, Science Officer – simulieren wir eine Marssiedlung: Wir kochen, arbeiten und schlafen im Habitat. Die Stadtgesellschaft ist eingeladen, unsere Bodenstation zu sein – uns Nachrichten zu schreiben, in unseren Alltag hineinzuschauen, uns zu treffen, wenn wir in unseren Raumanzügen unterwegs sind, oder jeden Tag direkt mit uns zu sprechen. Jeden Tag, elf Tage lang, nehmen wir uns eine große Frage vor, die im Projekt aufgekommen ist: Wie arbeiten Menschen zusammen, wenn die Entfernung die Kommunikation stört? Hängt das Überleben der Menschen auf dem Mars davon ab, dass Kunst und Schönheit da sind? Was kostet es (an Energie), einen Menschen am Leben zu halten? Und wie nehmen wir, aus unserer anthropozentrischen Sicht, die mehr-als-menschlichen Raumfahrenden unseres „Raumschiffs Erde“ wahr?',
     'Le dôme, mis à notre disposition par le Staatstheater Karlsruhe, mesure un peu moins de 10 mètres de diamètre et offre ainsi un habitat de 75 mètres carrés à trois astronautes du ZKM | Hertzlab, le département de recherche artistique du ZKM.\n\nRépartis en trois fonctions – Commandant, Responsable de la santé et Responsable scientifique – nous simulons une installation martienne en cuisinant, travaillant et dormant dans l’Habitat.\n\nLa population de Karlsruhe est invitée à jouer le rôle de notre centre de contrôle terrestre : elle peut nous envoyer des messages, observer nos activités quotidiennes, nous rencontrer lors de nos sorties en combinaison spatiale ou communiquer directement avec nous chaque jour.\n\nPendant onze jours, nous abordons quotidiennement une grande question soulevée au cours du projet : comment les êtres humains peuvent-ils collaborer lorsque la communication est perturbée par la distance ? La survie humaine sur Mars dépend-elle également de la présence de l’art et de la beauté ? Quel est le coût énergétique nécessaire pour maintenir un être humain en vie ? Et comment, depuis notre perspective anthropocentrique, percevons-nous les formes d’existence spatiales plus-qu’humaines présentes à bord de notre « vaisseau spatial Terre » ?'],
  'The Insight': ['Die Einsicht', 'Le changement de perspective'],
  'What we are offering through this project is an invitation that we’re extending to the city society of Karlsruhe, to engage not only with the real possibility of space flight, but also to imagine themselves as beings in space already, on a spaceship called Earth. In order to remain viable for a broad range of living things, Earth needs care and stewardship as much as a space station would. Through the interaction with us – discussing, writing, receiving messages – we hope to encourage a change of perspective that leads us in turn closer to home.':
    ['Was wir mit diesem Projekt anbieten, ist eine Einladung an die Stadtgesellschaft von Karlsruhe: sich nicht nur mit der realen Möglichkeit der Raumfahrt zu befassen, sondern sich auch vorzustellen, schon jetzt Wesen im Weltraum zu sein – auf einem Raumschiff namens Erde. Um für eine große Vielfalt von Lebewesen bewohnbar zu bleiben, braucht die Erde Fürsorge und Verantwortung, so sehr wie eine Raumstation. Durch den Austausch mit uns – im Gespräch, im Schreiben, im Empfangen von Nachrichten – hoffen wir, einen Perspektivwechsel anzustoßen, der uns wiederum näher nach Hause führt.',
     'À travers ce projet, nous adressons une invitation à la population de Karlsruhe : non seulement réfléchir à la possibilité réelle du voyage spatial, mais aussi s’imaginer comme des êtres vivant déjà dans l’espace, à bord d’un vaisseau appelé Terre.\n\nPour rester habitable par une grande diversité d’êtres vivants, la Terre a besoin d’attention et de soin tout autant qu’une station spatiale.\n\nÀ travers les interactions avec nous – discuter, écrire, envoyer et recevoir des messages – nous espérons encourager un changement de perspective qui, paradoxalement, nous ramène finalement plus près de chez nous.'],
  'Messages sent to space': ['Nachrichten ins All', 'Messages envoyés dans l’espace'],
  'Every message the crew answer is also beamed into space, by radio, through SpaceSpeak — a small network of transmitters around the world that sends short messages out of the atmosphere on request. The station hands the message over the moment its reply is published; SpaceSpeak encodes it and transmits it on a frequency between 2.4 and 5 gigahertz, a band chosen because it passes through the air and its water vapour almost untouched, from a directional antenna that gathers the transmitter’s power into a narrow cone pointed at the sky. Radio waves are light: they leave at the speed of light, 299,792 km every second.':
    ['Jede Nachricht, die die Crew beantwortet, wird außerdem per Funk ins All gesendet — über SpaceSpeak, ein kleines Netz von Sendern rund um die Welt, das kurze Nachrichten auf Bestellung aus der Atmosphäre hinausschickt. Die Station übergibt die Nachricht in dem Moment, in dem ihre Antwort veröffentlicht wird; SpaceSpeak kodiert sie und sendet sie auf einer Frequenz zwischen 2,4 und 5 Gigahertz — einem Band, das gewählt ist, weil es Luft und Wasserdampf fast ungehindert durchdringt — über eine Richtantenne, die die Leistung des Senders zu einem schmalen, gen Himmel gerichteten Kegel bündelt. Radiowellen sind Licht: Sie brechen mit Lichtgeschwindigkeit auf, 299.792 km in jeder Sekunde.',
     'Chaque message auquel répond l’équipage est également envoyé dans l’espace par radio grâce à SpaceSpeak, un petit réseau d’émetteurs répartis à travers le monde qui transmet, sur demande, de courts messages au-delà de l’atmosphère terrestre.\n\nDès que notre réponse est publiée, le centre de contrôle transmet le message à SpaceSpeak. Celui-ci l’encode puis l’émet sur une fréquence comprise entre 2,4 et 5 gigahertz. Cette bande de fréquences a été choisie parce qu’elle traverse l’air et la vapeur d’eau avec très peu d’atténuation. Le signal est envoyé à l’aide d’une antenne directionnelle, qui concentre la puissance de l’émetteur dans un faisceau étroit orienté vers le ciel.\n\nLes ondes radio sont une forme de lumière : elles se propagent à la vitesse de la lumière, soit 299 792 kilomètres par seconde.'],
  'From then on the message is on its way for good. It passes the Moon’s orbit within two seconds, the orbit of Mars within minutes and Jupiter’s within the hour, leaves the planets behind in a matter of hours, and after two years is nearly halfway to Proxima Centauri, the nearest star. The signal grows fainter with every kilometre, spreading out as it goes — but there is no distance at which it stops: what leaves Earth by radio keeps travelling outwards, long after everyone who wrote or read it. The Message Board counts each message’s distance from the moment it was sent, and a tap on it names the object in the sky it has just passed.':
    ['Von da an ist die Nachricht für immer unterwegs. Nach knapp zwei Sekunden hat sie die Mondbahn hinter sich, nach Minuten die Bahn des Mars, innerhalb einer Stunde die des Jupiter; nach einigen Stunden lässt sie die Planeten hinter sich, und nach zwei Jahren ist sie fast auf halbem Weg zu Proxima Centauri, dem nächsten Stern. Mit jedem Kilometer wird das Signal schwächer, weil es sich unterwegs ausbreitet — aber es gibt keine Entfernung, in der es aufhört: Was die Erde per Funk verlässt, reist weiter nach außen, lange nachdem alle, die es geschrieben oder gelesen haben, nicht mehr sind. Das Nachrichtenboard zählt die Entfernung jeder Nachricht von dem Moment an, in dem sie gesendet wurde, und ein Tippen auf sie nennt das Objekt am Himmel, das sie gerade hinter sich gelassen hat.',
     'À partir de cet instant, le message poursuit définitivement son voyage. Il franchit l’orbite de la Lune en moins de deux secondes, celle de Mars en quelques minutes et celle de Jupiter en moins d’une heure. En quelques heures, il a dépassé les planètes et, deux ans plus tard, il se trouve presque à mi-chemin de Proxima du Centaure, l’étoile la plus proche du Soleil.\n\nLe signal s’affaiblit à chaque kilomètre parcouru en se dispersant toujours davantage, mais il n’existe aucune distance à laquelle il s’arrête. Ce qui quitte la Terre sous forme d’ondes radio continue de voyager vers l’extérieur, bien après la disparition de toutes les personnes qui l’ont écrit ou lu.\n\nLe tableau des messages indique en permanence la distance parcourue par chaque message depuis son émission. Il suffit de toucher un message pour découvrir l’objet céleste qu’il vient de dépasser.'],
  'DESIGNATION': ['BEZEICHNUNG', 'DÉSIGNATION'],
  'RUN': ['LAUF', 'PÉRIODE'],
  'START': ['BEGINN', 'DÉBUT'],
  'END': ['ENDE', 'FIN'],
  'CREW': ['CREW', 'ÉQUIPAGE'],
  'SCIENTIFIC MISSIONS': ['WISSENSCHAFTLICHE MISSIONEN', 'MISSIONS SCIENTIFIQUES'],
  'DISTANCE': ['ENTFERNUNG', 'DISTANCE'],
  'ROUND TRIP': ['HIN UND ZURÜCK', 'ALLER-RETOUR'],
  'Inside the habitat': ['Im Habitat', 'Dans l’habitat'],
  'currently': ['gerade', 'actuellement'],
  'unlogged': ['nicht erfasst', 'non consigné'],
  'Produced by': ['Produziert von', 'Produit par'],
  // the partners' logos under Produced by (info.js, PARTNERS): 1 and 2 in cooperation with, 3 to 5 supporters
  'In cooperation with': ['In Kooperation mit', 'En coopération avec'],
  'Supporters': ['Förderer', 'Soutiens'],
  'Department for Artistic Research & Development': ['Abteilung für künstlerische Forschung & Entwicklung', 'Département de recherche & développement artistiques'],
  'Order & Communications': ['Ordnung & Kommunikation', 'Ordre & communications'],
  'Health & Life Support': ['Gesundheit & Lebenserhaltung', 'Santé & support de vie'],
  'Research & Systems': ['Forschung & Systeme', 'Recherche & systèmes'],
  'Center for Art and Media Karlsruhe': ['Zentrum für Kunst und Medien Karlsruhe', 'Centre d’art et de médias de Karlsruhe'],
  'Germany': ['Deutschland', 'Allemagne'],
  'REHEARSAL': ['PROBE', 'RÉPÉTITION'],
  'REHEARSAL · NOT THE RECORD': ['PROBE · NICHT DIE AUFZEICHNUNG', 'RÉPÉTITION · PAS L’ARCHIVE'],
  'REHEARSAL · TODAY, BEFORE THE RUN': ['PROBE · HEUTE, VOR DEM LAUF', 'RÉPÉTITION · AUJOURD’HUI, AVANT LA PÉRIODE'],
  'Rehearsal · today, before the run': ['Probe · heute, vor dem Lauf', 'Répétition · aujourd’hui, avant la période'],
  'Today, before the run — a rehearsal preview': ['Heute, vor dem Lauf — eine Probe-Vorschau', 'Aujourd’hui, avant la période — un aperçu de répétition'],
  'NOW': ['JETZT', 'MAINTENANT'],
  'A preview, not the record: a run day’s page as it will look, filled with what there is':
    ['Eine Vorschau, nicht die Aufzeichnung: die Seite eines Lauftags, wie sie aussehen wird, gefüllt mit dem Stand von', 'Un aperçu, pas l’archive : la page d’un jour de la période telle qu’elle apparaîtra, remplie de ce qu’il y a'],
  'the habitat’s readings as the sensors are sending them now, and everything mission control has filed under NOW, the rehearsal day — its schedule, meals, counts and power, the blogs and the media — with any states filed today. Nothing of it touches the run’s days. This page disappears on 15 October, when SOL 001 takes its place.':
    ['die Messwerte des Habitats, wie die Sensoren sie gerade senden, und alles, was die Missionskontrolle unter JETZT, dem Probetag, abgelegt hat — Tagesplan, Mahlzeiten, Zählungen und Energie, die Blogs und die Medien — samt allen heute erfassten Zuständen. Nichts davon berührt die Tage des Laufs. Diese Seite verschwindet am 15. Oktober, wenn SOL 001 ihren Platz einnimmt.',
     'les mesures de l’habitat telles que les capteurs les envoient maintenant, et tout ce que le contrôle de mission a consigné sous MAINTENANT, le jour de répétition — programme, repas, comptages et énergie, les blogs et les médias — avec les états saisis aujourd’hui. Rien de tout cela ne touche aux jours de la période. Cette page disparaît le 15 octobre, quand le SOL 001 prend sa place.'],
  'The whole mission, day by day': ['Die ganze Mission, Tag für Tag', 'Toute la mission, jour par jour'],
  'Previous day': ['Vorheriger Tag', 'Jour précédent'],
  'Next day': ['Nächster Tag', 'Jour suivant'],
  'The days of the run': ['Die Tage des Laufs', 'Les jours de la période'],
  'page': ['Seite', 'page'],
  'No blog written by the crew on this day': ['An diesem Tag hat die Crew keinen Blog geschrieben', 'Aucun blog écrit par l’équipage ce jour-là'],
  'water': ['Wasser', 'eau'],
  'Water': ['Wasser', 'Eau'],
  'Slot': ['Zeit', 'Créneau'],
  'Store': ['Vorrat', 'Réserve'],
  'Remaining': ['Verbleibend', 'Restant'],
  'Used that day': ['An dem Tag verbraucht', 'Utilisé ce jour-là'],
  'Days left': ['Tage übrig', 'Jours restants'],
  'Not counted for this day': ['Für diesen Tag nicht gezählt', 'Non compté pour ce jour'],
  'reading': ['Messwert', 'mesure'],
  'crew total · counted that day': ['Crew gesamt · an dem Tag gezählt', 'total équipage · compté ce jour-là'],
  'every reading of the day': ['jeder Messwert des Tages', 'chaque mesure du jour'],
  'Every reading the station pulled or received that day, point by point, across the day (habitat time).':
    ['Jeder Messwert, den die Station an diesem Tag abgerufen oder empfangen hat, Punkt für Punkt über den Tag (Habitatzeit).',
     'Chaque mesure que la station a relevée ou reçue ce jour-là, point par point, au fil du jour (heure de l’habitat).'],
  'No readings on this day': ['Keine Messwerte an diesem Tag', 'Aucune mesure ce jour-là'],
  'DONE': ['ERLEDIGT', 'FAIT'],
  'ACTIVE': ['LÄUFT', 'EN COURS'],
  'SKIPPED': ['ÜBERSPRUNGEN', 'SAUTÉ'],
  'PLANNED': ['GEPLANT', 'PRÉVU'],
  'LOG': ['LOG', 'JOURNAL'],
  'ANOMALY': ['ANOMALIE', 'ANOMALIE'],
  'HEALTH': ['GESUNDHEIT', 'SANTÉ'],
  'NOTE': ['NOTIZ', 'NOTE'],

  // ---- the crew log page
  'At the end of each day the three officers each write an entry from inside the habitat. Nobody edits them on the way out.':
    ['Am Ende jedes Tages schreiben die drei Offiziere je einen Eintrag aus dem Inneren des Habitats. Niemand redigiert sie auf dem Weg nach draußen.',
     'À la fin de chaque journée, les trois officiers écrivent chacun une entrée depuis l’intérieur de l’habitat. Personne ne les retouche à la sortie.'],
  'the habitat is occupied from': ['das Habitat ist bewohnt ab', 'l’habitat est occupé à partir du'],
  'the grey slots show where each day’s entries will go': ['die grauen Felder zeigen, wohin die Einträge jedes Tages kommen', 'les cases grises montrent où iront les entrées de chaque jour'],
  'From the habitat that day': ['Aus dem Habitat an dem Tag', 'Sorti de l’habitat ce jour-là'],
  'all media': ['alle Medien', 'tous les médias'],
  'download the day': ['den Tag herunterladen', 'télécharger le jour'],

  // ---- the media pages
  'Out of the habitat': ['Aus dem Habitat', 'Sorti de l’habitat'],
  'What the crew send out: photographs and video. Every file is the original as it left the habitat — nothing re-encoded, nothing resized — kept under its own checksum, and every one of them can be downloaded, singly or all at once.':
    ['Was die Crew hinausschickt: Fotografien und Video. Jede Datei ist das Original, wie es das Habitat verlassen hat — nichts neu kodiert, nichts verkleinert —, unter eigener Prüfsumme aufbewahrt, und jede davon lässt sich herunterladen, einzeln oder alle auf einmal.',
     'Ce que l’équipage envoie : photographies et vidéo. Chaque fichier est l’original tel qu’il a quitté l’habitat — rien de réencodé, rien de redimensionné —, conservé sous sa propre somme de contrôle, et chacun peut être téléchargé, seul ou tous à la fois.'],
  'photograph': ['Fotografie', 'photographie'],
  'Gallery': ['Galerie', 'Galerie'],
  'The gallery is not connected yet': ['Die Galerie ist noch nicht verbunden', 'La galerie n’est pas encore connectée'],
  'no photographs yet': ['noch keine Fotografien', 'pas encore de photographies'],
  'as of': ['Stand', 'au'],
  'checked every': ['geprüft alle', 'vérifié toutes les'],
  'last at': ['zuletzt um', 'dernière fois à'],
  // the night: no image is pulled from the cloud between 22:00 and 08:00 (src/lib/cloud.js, QUIET)
  'not between': ['nicht zwischen', 'pas entre'],
  'and': ['und', 'et'],
  'next read at': ['nächste Prüfung um', 'prochaine vérification à'],
  'The readings refresh by themselves as the sensors report': ['Die Messwerte aktualisieren sich von selbst, sobald die Sensoren melden', 'Les mesures se rafraîchissent d’elles-mêmes au fil des relevés'],
  'Updates by itself as pictures arrive': ['Aktualisiert sich von selbst, sobald Bilder ankommen', 'Se met à jour tout seul à l’arrivée des images'],
  'Live images from the Habitat': ['Live-Bilder aus dem Habitat', 'Images en direct de l’habitat'],
  'all photographs': ['alle Fotografien', 'toutes les photographies'],
  'the cloud could not be reached': ['die Cloud war nicht erreichbar', 'le cloud n’a pas pu être joint'],
  'Nothing in the folder yet': ['Noch nichts im Ordner', 'Rien dans le dossier pour l’instant'],
  'photographs': ['Fotografien', 'photographies'],
  'video': ['Video', 'vidéo'],
  'videos': ['Videos', 'vidéos'],
  'recording': ['Aufnahme', 'enregistrement'],
  'recordings': ['Aufnahmen', 'enregistrements'],
  'image': ['Bild', 'image'],
  'audio': ['Audio', 'audio'],
  'document': ['Dokument', 'document'],
  'file': ['Datei', 'fichier'],
  'Manifest · every file with its SHA-256': ['Manifest · jede Datei mit ihrem SHA-256', 'Manifeste · chaque fichier avec son SHA-256'],
  'Filter the media': ['Die Medien filtern', 'Filtrer les médias'],
  'PHOTOGRAPHS': ['FOTOGRAFIEN', 'PHOTOGRAPHIES'],
  'VIDEO': ['VIDEO', 'VIDÉO'],
  'SOUND': ['TON', 'SON'],
  'DOCUMENTS': ['DOKUMENTE', 'DOCUMENTS'],
  'Nothing has been sent out yet': ['Noch wurde nichts hinausgeschickt', 'Rien n’a encore été envoyé'],
  'This browser cannot play this file in the page': ['Dieser Browser kann die Datei nicht auf der Seite abspielen', 'Ce navigateur ne peut pas lire ce fichier dans la page'],
  'download it': ['lade sie herunter', 'téléchargez-le'],
  'and open it locally.': ['und öffne sie lokal.', 'et ouvrez-le localement.'],
  'If it will not play here, the file is still whole: download it and open it in any player.':
    ['Wenn sie hier nicht abspielt, ist die Datei trotzdem vollständig: herunterladen und in einem beliebigen Player öffnen.',
     'Si la lecture échoue ici, le fichier est néanmoins intact : téléchargez-le et ouvrez-le dans n’importe quel lecteur.'],
  'download': ['herunterladen', 'télécharger'],
  'that day': ['an dem Tag', 'ce jour-là'],
  'made': ['aufgenommen', 'réalisé'],
  'Download the original': ['Das Original herunterladen', 'Télécharger l’original'],
  'All media': ['Alle Medien', 'Tous les médias'],
  'That day’s log': ['Das Logbuch des Tages', 'Le journal de ce jour'],
  'Previous': ['Zurück', 'Précédent'],
  'Next': ['Weiter', 'Suivant'],
  'FILE': ['DATEI', 'FICHIER'],
  'SIZE': ['GRÖSSE', 'TAILLE'],
  'bytes': ['Bytes', 'octets'],
  'SENT': ['GESENDET', 'ENVOYÉ'],
  'CAPTION': ['BILDUNTERSCHRIFT', 'LÉGENDE'],
  'Mission day': ['Missionstag', 'Jour de mission'],

  // ---- the habitat dome (src/views/pages/dome.js)
  'what is inside, and what it is doing now': ['was drinnen ist, und was es gerade tut', 'ce qu’il y a dedans, et ce que cela fait maintenant'],
  'The figures refresh by themselves': ['Die Zahlen aktualisieren sich von selbst', 'Les chiffres se rafraîchissent d’eux-mêmes'],
  'The habitat as a dome, with what is inside it': ['Das Habitat als Kuppel, mit dem, was darin ist', 'L’habitat en dôme, avec ce qu’il contient'],
  'RED DUST CITY': ['RED DUST CITY', 'RED DUST CITY'],
  'press a hexagon to open its panel': ['ein Sechseck drücken, um sein Feld zu öffnen', 'appuyer sur un hexagone pour ouvrir son panneau'],
  'Science lab': ['Wissenschaftslabor', 'Laboratoire scientifique'],
  'Plants': ['Pflanzen', 'Plantes'],
  'Uplink': ['Uplink', 'Liaison montante'],
  // ---- the two calls on the landing page (landing.js, calls)
  'Two ways in': ['Zwei Wege hinein', 'Deux voies d’entrée'],
  'Send a message to the crew': ['Schick der Crew eine Nachricht', 'Envoyez un message à l’équipage'],
  'Approved messages are beamed into space': ['Freigegebene Nachrichten werden ins All gefunkt', 'Les messages approuvés sont émis dans l’espace'],
  'Mission control reads every message. The ones it approves are beamed into space by radio.':
    ['Die Missionskontrolle liest jede Nachricht. Was sie freigibt, wird per Funk ins All gesendet.',
     'Le contrôle de mission lit chaque message. Ceux qu’il approuve sont émis dans l’espace par radio.'],
  'Commander': ['Kommandantin', 'Commandant'],
  'Written': ['Geschrieben', 'Écrit'],
  'Into space': ['Ins All', 'Dans l’espace'],
  'message sent into space so far': ['Nachricht bisher ins All gesendet', 'message envoyé dans l’espace jusqu’ici'],
  'messages sent into space so far': ['Nachrichten bisher ins All gesendet', 'messages envoyés dans l’espace jusqu’ici'],
  'Live feed': ['Live-Feed', 'Flux en direct'],
  'Follow what the crew is doing — live': ['Verfolge live, was die Crew gerade tut', 'Suivez ce que fait l’équipage — en direct'],
  'Thirteen sols, as they happen.': ['Dreizehn Sols, während sie geschehen.', 'Treize sols, en temps réel.'],
  'The habitat’s sensors, today’s mission and schedule, the galley, the crew’s reports and moods — live from Red Dust City, every day of the run.':
    ['Die Sensoren des Habitats, Mission und Zeitplan des Tages, die Kombüse, die Berichte und Stimmungen der Crew — live aus Red Dust City, an jedem Tag des Laufs.',
     'Les capteurs de l’habitat, la mission et l’horaire du jour, la cuisine, les rapports et les humeurs de l’équipage — en direct de Red Dust City, chaque jour de la mission.'],
  'Stores': ['Vorräte', 'Réserves'],
  'Up next': ['Als Nächstes', 'Ensuite'],
  'Day 01 opens with': ['Tag 01 beginnt mit', 'Le jour 01 s’ouvre sur'],
  'Off the schedule': ['Ausserhalb des Plans', 'Hors programme'],
  'AS REPORTED': ['WIE GEMELDET', 'TEL QUE RAPPORTÉ'],
  'no state': ['kein Zustand', 'aucun état'],
  'exchanges published': ['Austausche veröffentlicht', 'échanges publiés'],
  'messages sent': ['Nachrichten gesendet', 'messages envoyés'],
  'so far': ['bisher', 'jusqu’ici'],
  'not yet counted': ['noch nicht gezählt', 'pas encore compté'],

  'Water recycling': ['Wasserrecycling', 'Recyclage de l’eau'],
  'The uplink. Every message written on this station crosses the distance to the habitat and waits for the commanding officer, who reads it and answers from inside; the reply comes back to the board on every open phone. The real light-time between Earth and Mars is shown beside the composer.': [
    'Der Uplink. Jede auf dieser Station geschriebene Nachricht überquert die Distanz zum Habitat und wartet auf die Kommandantin, die sie von innen liest und beantwortet; die Antwort kommt auf jedem geöffneten Telefon zurück aufs Board. Die reale Lichtlaufzeit zwischen Erde und Mars steht neben dem Composer.',
    'La liaison. Chaque message écrit sur cette station traverse la distance jusqu’à l’habitat et attend le commandant, qui le lit et y répond depuis l’intérieur ; la réponse revient sur le tableau de chaque téléphone ouvert. Le vrai temps-lumière entre la Terre et Mars est affiché à côté du composeur.'],
  'Hydroponics': ['Hydroponik', 'Hydroponie'],
  'Read More than Human on the About page': ['Mehr als menschlich auf der Über-Seite lesen', 'Lire Plus qu’humain sur la page À propos'],
  'Open the Daily Schedule': ['Den Tagesplan öffnen', 'Ouvrir le programme du jour'],
  'Ground Station': ['Bodenstation', 'Centre de contrôle terrestre'],
  'Communication': ['Kommunikation', 'Communication'],
  'Power generator': ['Stromgenerator', 'Générateur électrique'],
  'press a part of the habitat to see what is happening in it': ['einen Teil des Habitats drücken, um zu sehen, was darin geschieht', 'appuyer sur une partie de l’habitat pour voir ce qui s’y passe'],
  // the nudge under the dome (landing.js)
  'Scroll down': ['Nach unten scrollen', 'Faire défiler'],
  'The parts of the habitat': ['Die Teile des Habitats', 'Les parties de l’habitat'],
  // a store with no figure yet (public.js, inventoryGauges; dome.js)
  'Placeholder': ['Platzhalter', 'Espace réservé'],
  'no figure filed yet': ['noch keine Zahl erfasst', 'aucun chiffre saisi pour l’instant'],
  'Open its panel on the dashboard': ['Sein Feld auf dem Dashboard öffnen', 'Ouvrir son panneau sur le tableau de bord'],
  // the habitat — the dome with its keys, the hint in its head (src/views/pages/dome.js, habitatDome)
  'Click a key to know what is inside.': ['Klicke auf eine Taste, um zu erfahren, was drinnen ist.', 'Cliquez sur une touche pour savoir ce qu’il y a à l’intérieur.'],
  'Tap a key to know what is inside.': ['Tippe auf eine Taste, um zu erfahren, was drinnen ist.', 'Touchez une touche pour savoir ce qu’il y a à l’intérieur.'],
  // the habitat in section — the cutaway drawing, every room a key, the hint in its head (src/views/pages/inside.js, habitatInside)
  'Point at a room to know what is inside.': ['Zeige auf einen Raum, um zu erfahren, was drinnen ist.', 'Pointez une pièce pour savoir ce qu’il y a à l’intérieur.'],
  'What’s inside the habitat': ['Was im Habitat ist', 'Ce qu’il y a dans l’habitat'],
  'AI generated image': ['KI-generiertes Bild', 'Image générée par IA'],
  'Daily Life': ['Alltag', 'Vie quotidienne'],
  'Science Mission': ['Wissenschaftsmission', 'Mission scientifique'],
  'Resource Management': ['Ressourcenmanagement', 'Gestion des ressources'],
  'Sensors': ['Sensoren', 'Capteurs'],
  // the modules of the habitat, named as the picture's layers name them (public/Svg_File/mars-habitat-lineart-modules.svg; inside.js, ROOMS)
  'Hydroponic Plants': ['Hydroponik-Pflanzen', 'Plantes hydroponiques'],
  // ---- the habitat in section after October's text sheet: the rooms' names and their words (explanation first, NOW after)
  'What’s inside the habitat?': ['Was ist im Habitat?', 'Qu’y a-t-il dans l’habitat ?'],
  'More-than-Human': ['More-than-Human', 'More-than-Human'],
  'Science Mission': ['Wissenschaftsmission', 'Mission scientifique'],
  'Living Quarters': ['Wohnquartier', 'Quartiers d’habitation'],
  'Water Recycling': ['Wasserrecycling', 'Recyclage de l’eau'],
  'Electricity': ['Elektrizität', 'Électricité'],
  'Going Outside': ['Nach draußen', 'Sortir dehors'],
  'Open the Message Board': ['Das Nachrichtenboard öffnen', 'Ouvrir le tableau des messages'],
  'Open Today’s Mission': ['Die heutige Mission öffnen', 'Ouvrir la mission du jour'],
  'Open Crew Moods': ['Die Stimmung der Crew öffnen', 'Ouvrir les humeurs de l’équipage'],
  'Open the Resources': ['Die Vorräte öffnen', 'Ouvrir les ressources'],
  'Open the Power Balance': ['Die Energiebilanz öffnen', 'Ouvrir le bilan énergétique'],
  'The habitat’s other astronauts: live crickets performing as our alternate protein source, a robot dog as an astronaut’s best friend and helper for space walks and an emotional support robot assisting in our mental health — and the gardens and hydroponic shelves, where fresh food can grow without soil.':
    ['Die anderen Astronauten des Habitats: lebende Grillen als unsere alternative Proteinquelle, ein Roboterhund als bester Freund der Astronauten und Helfer bei Außeneinsätzen und ein Roboter zur emotionalen Unterstützung unserer psychischen Gesundheit — dazu die Gärten und Hydroponikregale, in denen frische Nahrung ohne Erde wächst.',
     'Les autres astronautes de l’habitat : des grillons vivants, notre source de protéines alternative, un chien robot, meilleur ami de l’astronaute et aide pour les sorties, et un robot de soutien émotionnel pour notre santé mentale — ainsi que les jardins et les étagères hydroponiques, où la nourriture fraîche pousse sans terre.'],
  'The crew is reachable by online message through this ground station website, by postcard and by direct communication each day at 19:00. All messages written here are also literally sent into space!':
    ['Die Crew ist per Online-Nachricht über diese Bodenstations-Website, per Postkarte und täglich um 19:00 im direkten Gespräch erreichbar. Alle hier geschriebenen Nachrichten werden außerdem buchstäblich ins All gesendet!',
     'L’équipage est joignable par message en ligne via ce site du centre de contrôle terrestre, par carte postale et en communication directe chaque jour à 19:00. Tous les messages écrits ici sont aussi, littéralement, envoyés dans l’espace !'],
  'Each of our days has a specific research mission, centered around one of the five topics MARS! is composed of: Habitat, Mental Health, Food, Governance or Resource Management. We take a hard look at our society from the red planet looking down on Earth.':
    ['Jeder unserer Tage hat eine eigene Forschungsmission, rund um eines der fünf Themen, aus denen MARS! besteht: Habitat, psychische Gesundheit, Ernährung, Governance oder Ressourcenmanagement. Wir werfen vom roten Planeten aus einen genauen Blick auf unsere Gesellschaft auf der Erde.',
     'Chacune de nos journées a une mission de recherche précise, autour de l’un des cinq thèmes qui composent MARS! : habitat, santé mentale, alimentation, gouvernance ou gestion des ressources. Depuis la planète rouge, nous portons un regard sans concession sur notre société, là-bas sur Terre.'],
  'Sensors: everything is tracked inside the Red Dust City Habitat — CO₂, temperature, humidity, food rations, crew happiness. Keep in the loop and alert us if something seems amiss.':
    ['Sensoren: Im Habitat Red Dust City wird alles erfasst — CO₂, Temperatur, Luftfeuchtigkeit, Essensrationen, die Zufriedenheit der Crew. Bleib auf dem Laufenden und schlag Alarm, wenn etwas nicht stimmt.',
     'Capteurs : tout est suivi dans l’habitat Red Dust City — CO₂, température, humidité, rations alimentaires, moral de l’équipage. Restez informés et alertez-nous si quelque chose cloche.'],
  'Going outside on Mars requires space suits and passing through an air lock. An EVA — extra-vehicular activity — is the crew’s daily walk on the Mars landscape of Karlsruhe’s Marktplatz at 16:00. Its mission is connected to the science mission of the day.':
    ['Nach draußen gehen heißt auf dem Mars: Raumanzug anziehen und durch die Luftschleuse. Ein EVA — extra-vehicular activity, Außeneinsatz — ist der tägliche Gang der Crew um 16:00 durch die Marslandschaft des Karlsruher Marktplatzes. Sein Auftrag hängt mit der Wissenschaftsmission des Tages zusammen.',
     'Sortir sur Mars exige une combinaison spatiale et le passage d’un sas. Une EVA — activité extravéhiculaire — est la marche quotidienne de l’équipage, à 16:00, dans le paysage martien de la Marktplatz de Karlsruhe. Sa mission est liée à la mission scientifique du jour.'],
  'Three astronauts from ZKM — Commander/Comms, Health Officer, and Science Officer — have volunteered to lead this experiment and are now stationed in the Red Dust City Habitat, each with their own role and responsibilities. You can check what they’re doing in the livestream gallery, see their moods and find out more about their daily duties.':
    ['Drei Astronautinnen und Astronauten des ZKM — Commander/Comms, Health Officer und Science Officer — haben sich freiwillig gemeldet, dieses Experiment zu leiten, und sind nun im Habitat Red Dust City stationiert, jede und jeder mit eigener Rolle und Verantwortung. In der Livestream-Galerie siehst du, was sie gerade tun, du siehst ihre Stimmung und erfährst mehr über ihre täglichen Aufgaben.',
     'Trois astronautes du ZKM — Commander/Comms, Health Officer et Science Officer — se sont portés volontaires pour mener cette expérience et sont maintenant en poste dans l’habitat Red Dust City, chacun avec son rôle et ses responsabilités. Vous pouvez voir ce qu’ils font dans la galerie en direct, suivre leurs humeurs et en savoir plus sur leurs tâches quotidiennes.'],
  'Each day has a strict schedule the astronauts adhere to and the Habitat is divided into specific zones for working, cooking, playing and sleeping — because going out for a stroll requires serious effort. Have a look in the media gallery or look inside our windows on the MARS!platz to see how we are using the space.':
    ['Jeder Tag folgt einem strengen Zeitplan, an den sich die Astronauten halten, und das Habitat ist in Zonen zum Arbeiten, Kochen, Spielen und Schlafen eingeteilt — denn ein Spaziergang nach draußen ist ein ernsthafter Aufwand. Schau in die Mediengalerie oder durch unsere Fenster auf dem MARS!platz, um zu sehen, wie wir den Raum nutzen.',
     'Chaque jour suit un programme strict que les astronautes respectent, et l’habitat est divisé en zones pour travailler, cuisiner, jouer et dormir — car sortir faire un tour demande un sérieux effort. Jetez un œil à la galerie médias ou regardez par nos fenêtres sur la MARS!platz pour voir comment nous utilisons l’espace.'],
  'When every liter of water has to be carried up by space rocket, we become more mindful of our usage. Our water recycling system is one of the things we brought to reflect on resources and how we are currently treating them on Earth.':
    ['Wenn jeder Liter Wasser mit der Rakete hochgebracht werden muss, gehen wir bewusster damit um. Unser Wasserrecycling-System ist eines der Dinge, die wir mitgebracht haben, um über Ressourcen nachzudenken — und darüber, wie wir derzeit auf der Erde mit ihnen umgehen.',
     'Quand chaque litre d’eau doit être monté par fusée, on devient plus attentif à sa consommation. Notre système de recyclage de l’eau est l’une des choses que nous avons apportées pour réfléchir aux ressources et à la manière dont nous les traitons aujourd’hui sur Terre.'],
  'We measure our energy expenditure: how much comes in, how much goes out: from calorie intake to taken steps, from power produced by muscle to electricity consumption. Check out our power balance in the dashboard!':
    ['Wir messen unseren Energiehaushalt: wie viel hereinkommt, wie viel hinausgeht — von der Kalorienzufuhr bis zu den gegangenen Schritten, von der Muskelkraft bis zum Stromverbrauch. Schau dir unsere Energiebilanz im Dashboard an!',
     'Nous mesurons notre dépense énergétique : ce qui entre, ce qui sort — des calories ingérées aux pas effectués, de l’énergie produite par les muscles à la consommation d’électricité. Consultez notre bilan énergétique dans le tableau de bord !'],
  'Communication Station': ['Kommunikationsstation', 'Station de communication'],
  'Science Station': ['Wissenschaftsstation', 'Station scientifique'],
  'Airlock': ['Luftschleuse', 'Sas'],
  'Storage': ['Lager', 'Stockage'],
  'Relaxing Area (Round Sofa)': ['Ruhebereich (Rundsofa)', 'Espace détente (canapé rond)'],
  'Crew Quarters': ['Crew-Quartiere', 'Quartiers de l’équipage'],
  'Health Station': ['Gesundheitsstation', 'Station de santé'],
  'Equipment Lockers': ['Ausrüstungsschränke', 'Casiers d’équipement'],
  'Water Recycling System': ['Wasserrecycling-System', 'Système de recyclage de l’eau'],
  'Cycle (Power Generation)': ['Fahrrad (Stromerzeugung)', 'Vélo (production d’électricité)'],
  'Power Systems': ['Energiesysteme', 'Systèmes énergétiques'],
  'Open the Media Gallery': ['Die Mediengalerie öffnen', 'Ouvrir la galerie médias'],
  // what each part of the habitat is — two lines each (src/views/pages/inside.js, ROOMS and KEYS)
  'The habitat’s other inhabitants: three live crickets, a robot dog and an emotional support robot — and the hydroponic shelves, where the fresh food grows without soil.':
    ['Die anderen Bewohner des Habitats: drei lebende Grillen, ein Roboterhund und ein emotionaler Unterstützungsroboter — und die Hydroponik-Regale, in denen das frische Essen ohne Erde wächst.',
     'Les autres habitants de l’habitat : trois grillons vivants, un chien robot et un robot de soutien émotionnel — et les étagères hydroponiques, où pousse la nourriture fraîche sans terre.'],
  'Three shelves of plants grown without soil, their roots in nutrient water — the habitat’s fresh food and part of its air; what grows here is counted with the rations.':
    ['Drei Regale mit Pflanzen ohne Erde, die Wurzeln in Nährwasser — die frische Nahrung des Habitats und ein Teil seiner Luft; was hier wächst, zählt zu den Rationen.',
     'Trois étagères de plantes sans terre, les racines dans l’eau nutritive — la nourriture fraîche de l’habitat et une part de son air ; ce qui pousse ici compte avec les rations.'],
  'The uplink: every message written here crosses to the habitat and waits for the commanding officer, whose answer comes back to the board on every open phone.':
    ['Der Uplink: Jede hier geschriebene Nachricht geht hinüber ins Habitat und wartet auf die Kommandantin, deren Antwort auf jedem offenen Handy zurück aufs Board kommt.',
     'La liaison montante : chaque message écrit ici traverse jusqu’à l’habitat et attend le commandant, dont la réponse revient sur le tableau de chaque téléphone ouvert.'],
  'Each day has a scientific mission — a sheet with its central question, the work of the morning, the afternoon and the EVA, and a question for the community hour.':
    ['Jeder Tag hat eine wissenschaftliche Mission — ein Blatt mit seiner zentralen Frage, der Arbeit des Vormittags, des Nachmittags und der EVA und einer Frage für die Community-Stunde.',
     'Chaque jour a sa mission scientifique — une fiche avec sa question centrale, le travail du matin, de l’après-midi et de l’EVA, et une question pour l’heure communautaire.'],
  'An environment sensor inside the habitat reads CO₂, temperature, humidity, pressure, VOCs and the air quality every minute, a light sensor beside it the light — all kept in the record.':
    ['Ein Umweltsensor im Habitat misst jede Minute CO₂, Temperatur, Luftfeuchte, Luftdruck, VOCs und die Luftqualität, ein Lichtsensor daneben das Licht — alles bleibt in der Aufzeichnung.',
     'Un capteur d’environnement dans l’habitat lit chaque minute le CO₂, la température, l’humidité, la pression, les COV et la qualité de l’air, un capteur de lumière à côté la lumière — tout est gardé dans le registre.'],
  'The round room under the crown, nobody’s station — where the three meet, eat and plan the day. Each files their condition from inside; what they send out is on the Media page.':
    ['Der runde Raum unter der Kuppelspitze, niemandes Station — wo die drei sich treffen, essen und den Tag planen. Jede und jeder meldet von innen das eigene Befinden; was sie nach draußen schicken, ist auf der Medienseite.',
     'La pièce ronde sous le sommet, le poste de personne — où les trois se retrouvent, mangent et planifient la journée. Chacun y note son état de l’intérieur ; ce qu’ils envoient est sur la page Médias.'],
  'Two sleeping pods, each a bunk closed off from the light and the sound of the habitat. Rest is on the schedule like everything else, and the crew keep to it.':
    ['Zwei Schlafkapseln, jede eine Koje, abgeschirmt vom Licht und den Geräuschen des Habitats. Die Ruhe steht wie alles andere im Zeitplan, und die Crew hält sich daran.',
     'Deux capsules de repos, chacune une couchette fermée à la lumière et au bruit de l’habitat. Le repos est à l’horaire comme tout le reste, et l’équipage s’y tient.'],
  'Everything was carried in and nothing is resupplied: water, rations, medical kits, extinguishers. Used water passes through the recycling loop; the crew count the stores each evening.':
    ['Alles wurde hineingetragen, nichts wird nachgeliefert: Wasser, Rationen, Medizinkits, Feuerlöscher. Gebrauchtes Wasser geht durch den Recyclingkreislauf; die Crew zählt die Vorräte jeden Abend.',
     'Tout a été apporté et rien n’est réapprovisionné : eau, rations, trousses médicales, extincteurs. L’eau usée passe par la boucle de recyclage ; l’équipage compte les réserves chaque soir.'],
  'Everything runs on what the crew can make and store: the bicycle generator charges the one battery. Heating, food, lighting and electronics draw on it, counted in kilowatt-hours every day.':
    ['Alles läuft mit dem, was die Crew erzeugen und speichern kann: Der Fahrradgenerator lädt die eine Batterie. Heizung, Essen, Licht und Elektronik zehren davon, jeden Tag in Kilowattstunden gezählt.',
     'Tout fonctionne avec ce que l’équipage peut produire et stocker : le générateur à vélo charge l’unique batterie. Chauffage, cuisine, lumière et électronique y puisent, comptés en kilowattheures chaque jour.'],
  'The Mission Dashboard is the station’s instrument panel: the live readings, today’s schedule and meal, the crew’s condition, the trends and the three daily blogs, on one page.':
    ['Das Missions-Dashboard ist das Instrumentenbrett der Station: die Live-Messwerte, der heutige Zeitplan und die Mahlzeit, das Befinden der Crew, die Trends und die drei täglichen Blogs, auf einer Seite.',
     'Le tableau de bord de mission est le panneau d’instruments de la station : les mesures en direct, l’horaire et le repas du jour, l’état de l’équipage, les tendances et les trois blogs quotidiens, sur une page.'],
  'An EVA — extra-vehicular activity — is the crew’s daily walk outside in their suits, on the Mars landscape of Karlsruhe’s Marktplatz; its hour is on the schedule, its pictures on the Media page.':
    ['Eine EVA — extra-vehicular activity — ist der tägliche Gang der Crew nach draußen in ihren Anzügen, auf der Marslandschaft des Karlsruher Marktplatzes; ihre Stunde steht im Zeitplan, ihre Bilder auf der Medienseite.',
     'Une EVA — activité extravéhiculaire — est la sortie quotidienne de l’équipage en combinaison, sur le paysage martien de la Marktplatz de Karlsruhe ; son heure est à l’horaire, ses images sur la page Médias.'],
  // the rooms' sentences after Now (dome.js figures: sensors, mission)
  'No reading yet.': ['Noch kein Messwert.', 'Pas encore de mesure.'],
  'No current reading': ['Kein aktueller Messwert', 'Aucune mesure actuelle'],
  'Read at': ['Gelesen um', 'Lu à'],
  'The last was at': ['Der letzte war um', 'La dernière était à'],
  'Day 01’s mission': ['Die Mission von Tag 01', 'La mission du jour 01'],
  'Today’s mission': ['Die heutige Mission', 'La mission du jour'],
  'The communication hour is daily at': ['Die Kommunikationsstunde ist täglich um', 'L’heure de communication a lieu chaque jour à'],
  'Communication hour today at': ['Kommunikationsstunde heute um', 'Heure de communication aujourd’hui à'],
  'in': ['in', 'dans'],
  'The communication hour is on now': ['Die Kommunikationsstunde läuft gerade', 'L’heure de communication est en cours'],
  'The next communication hour is tomorrow at': ['Die nächste Kommunikationsstunde ist morgen um', 'La prochaine heure de communication est demain à'],
  'Today’s question': ['Die Frage des Tages', 'La question du jour'],
  'Meals today': ['Mahlzeiten heute', 'Repas aujourd’hui'],
  'Cricket box': ['Grillenbox', 'Boîte à grillons'],
  // the key under Today's Mission on the dashboard (public.js, missionPanel)
  'Mission Report': ['Missionsbericht', 'Rapport de mission'],
  // the call on the Earth, the first page of the landing page (landing.js, call)
  'Tap a room to know what is inside.': ['Tippe auf einen Raum, um zu erfahren, was drinnen ist.', 'Touchez une pièce pour savoir ce qu’il y a à l’intérieur.'],
  'The habitat in section: its rooms under the dome, on the Mars plain': ['Das Habitat im Schnitt: seine Räume unter der Kuppel, auf der Marsebene', 'L’habitat en coupe : ses pièces sous le dôme, sur la plaine martienne'],

  // inside the habitat — the cutaway page (src/views/pages/cutaway.js)
  'Inside the habitat': ['Im Habitat', 'À l’intérieur de l’habitat'],
  'Click to know what is inside.': ['Klicke, um zu erfahren, was drinnen ist.', 'Cliquez pour savoir ce qu’il y a à l’intérieur.'],
  'Tap to know what is inside.': ['Tippe, um zu erfahren, was drinnen ist.', 'Touchez pour savoir ce qu’il y a à l’intérieur.'],
  'Every part of the habitat is on the drawing:': ['Jeder Teil des Habitats ist auf der Zeichnung:', 'Chaque partie de l’habitat est sur le dessin :'],
  'The habitat in section: its three floors under the dome': ['Das Habitat im Schnitt: seine drei Ebenen unter der Kuppel', 'L’habitat en coupe : ses trois niveaux sous le dôme'],
  'Hydroponic plants': ['Hydroponische Pflanzen', 'Plantes hydroponiques'],
  'Communication station': ['Kommunikationsstation', 'Station de communication'],
  'Science station': ['Wissenschaftsstation', 'Station scientifique'],
  'Kitchen': ['Küche', 'Cuisine'],
  'Relaxing area': ['Aufenthaltsbereich', 'Espace de détente'],
  'Nap pod': ['Schlafkapsel', 'Capsule de repos'],
  'Health station': ['Gesundheitsstation', 'Station de santé'],
  'Water recycling system': ['Wasseraufbereitung', 'Système de recyclage de l’eau'],
  'Power generation': ['Stromerzeugung', 'Production d’énergie'],
  'The galley: where the crew cook and eat what the stores and the growing shelves give — three meals a day, each planned in calories, water and energy. What is eaten is counted with the rations, and today’s meal stands on the dashboard.':
    ['Die Küche: wo die Crew kocht und isst, was die Vorräte und die Pflanzregale hergeben — drei Mahlzeiten am Tag, jede in Kalorien, Wasser und Energie geplant. Was gegessen wird, zählt zu den Rationen, und die heutige Mahlzeit steht auf dem Dashboard.',
     'La cuisine : là où l’équipage prépare et mange ce que donnent les réserves et les étagères de culture — trois repas par jour, chacun planifié en calories, en eau et en énergie. Ce qui est mangé est compté avec les rations, et le repas du jour figure sur le tableau de bord.'],
  'The lounge, under the crown: the one room in the habitat that is nobody’s station — the round sofa where the three meet, eat, plan the day and end it. Each of them files their condition from inside, in words, and it stands on the dashboard.':
    ['Der Aufenthaltsbereich unter der Krone: der einzige Raum im Habitat, der niemandes Station ist — das runde Sofa, auf dem die drei sich treffen, essen, den Tag planen und ihn beschließen. Jeder von ihnen meldet seinen Zustand von innen, in Worten, und er steht auf dem Dashboard.',
     'L’espace de détente, sous le sommet : la seule pièce de l’habitat qui n’est le poste de personne — le canapé rond où les trois se retrouvent, mangent, planifient la journée et la terminent. Chacun d’eux déclare son état depuis l’intérieur, en mots, et il figure sur le tableau de bord.'],
  'Two sleeping pods, each a bunk closed off from the light and the sound of the habitat. Rest is on the schedule like everything else: the hours are written on the day’s plan, and the crew keep to them as they keep to the rest.':
    ['Zwei Schlafkapseln, jede eine Koje, abgeschlossen vom Licht und den Geräuschen des Habitats. Die Ruhe steht wie alles andere im Zeitplan: die Stunden sind im Tagesplan eingetragen, und die Crew hält sie ein wie alles Übrige.',
     'Deux capsules de repos, chacune une couchette close, à l’abri de la lumière et des bruits de l’habitat. Le repos est au programme comme tout le reste : les heures sont inscrites au plan du jour, et l’équipage s’y tient comme au reste.'],
  'The health station: a bed, the monitors and the medicine cabinet, where the health officer looks after the crew — their condition, their steps, what they have eaten — and the life support with them, and where the Daily Health Blog is written each day.':
    ['Die Gesundheitsstation: ein Bett, die Monitore und der Medizinschrank, wo die Gesundheitsoffizierin oder der Gesundheitsoffizier sich um die Crew kümmert — ihren Zustand, ihre Schritte, was sie gegessen hat — und mit ihr um die Lebenserhaltung, und wo jeden Tag der Daily Health Blog geschrieben wird.',
     'La station de santé : un lit, les moniteurs et l’armoire à pharmacie, où l’officier de santé veille sur l’équipage — son état, ses pas, ce qu’il a mangé — et sur le support de vie avec lui, et où le Daily Health Blog est écrit chaque jour.'],
  'No rest is written on today’s schedule.': ['Im heutigen Zeitplan ist keine Ruhezeit eingetragen.', 'Aucun repos n’est inscrit au programme d’aujourd’hui.'],
  'On today’s schedule': ['Im heutigen Zeitplan', 'Au programme d’aujourd’hui'],
  'On day 01’s schedule': ['Im Zeitplan von Tag 01', 'Au programme du jour 01'],
  'Now': ['Jetzt', 'Maintenant'],
  'The run has not begun yet.': ['Der Lauf hat noch nicht begonnen.', 'La mission n’a pas encore commencé.'],
  'Off the schedule.': ['Ausserhalb des Plans.', 'Hors programme.'],
  'no state filed': ['kein Zustand erfasst', 'aucun état saisi'],
  'under a day at this draw': ['weniger als ein Tag bei diesem Verbrauch', 'moins d’un jour à ce rythme'],
  'day left at this draw': ['Tag übrig bei diesem Verbrauch', 'jour restant à ce rythme'],
  'days left at this draw': ['Tage übrig bei diesem Verbrauch', 'jours restants à ce rythme'],
  'No inventory filed for today.': ['Für heute kein Bestand erfasst.', 'Aucun inventaire saisi pour aujourd’hui.'],
  'Today’s power has not been counted yet.': ['Der heutige Stromverbrauch ist noch nicht gezählt.', 'L’énergie d’aujourd’hui n’a pas encore été comptée.'],
  'steps today': ['Schritte heute', 'pas aujourd’hui'],
  'steps not yet counted': ['Schritte noch nicht gezählt', 'pas non encore comptés'],
  'Latest exchange': ['Letzter Austausch', 'Dernier échange'],
  'The loop runs whenever there is grey water to pass; the crew count the tank at the end of the day.': ['Der Kreislauf läuft, sobald Grauwasser anfällt; die Crew zählt den Tank am Ende des Tages.', 'La boucle tourne dès qu’il y a des eaux grises à traiter ; l’équipage compte le réservoir en fin de journée.'],
  'First harvest planned for SOL 10.': ['Erste Ernte geplant für SOL 10.', 'Première récolte prévue pour SOL 10.'],
  'Three crew members are always in the habitat for the thirteen days of the run: a commanding officer who relays every message from Earth, a science officer who runs the experiments and watches the habitat’s systems, and a health officer who keeps the crew fit and the life support in order. Between them they write three blogs a day — the Commander Blog, the Daily Science Findings and the Daily Health Blog — and file their condition from inside.': [
    'Drei Crewmitglieder sind die dreizehn Tage des Laufs immer im Habitat: eine Kommandantin, die jede Nachricht von der Erde weiterleitet, ein Wissenschaftsoffizier, der die Experimente durchführt und die Systeme des Habitats beobachtet, und ein Gesundheitsoffizier, der die Crew fit und die Lebenserhaltung in Ordnung hält. Zusammen schreiben sie jeden Tag drei Blogs — den Commander-Blog, die täglichen wissenschaftlichen Befunde und den täglichen Gesundheitsblog — und melden ihren Zustand von innen.',
    'Trois membres d’équipage sont toujours dans l’habitat pendant les treize jours de la mission : un commandant qui relaie chaque message de la Terre, un officier scientifique qui mène les expériences et surveille les systèmes de l’habitat, et un officier de santé qui garde l’équipage en forme et le support de vie en ordre. Ensemble, ils écrivent trois blogs par jour — le blog du commandement, les observations scientifiques quotidiennes et le blog santé quotidien — et déclarent leur état depuis l’intérieur.'],
  'The science bench: the habitat’s own experiments — samples, cultures, readings — and the daily science findings the science officer writes up. The sensor node beside it measures temperature, humidity, carbon dioxide and more every twenty minutes.': [
    'Der Laborplatz: die Experimente des Habitats – Proben, Kulturen, Messungen – und die täglichen wissenschaftlichen Befunde, die der Wissenschaftsoffizier festhält. Der Sensorknoten daneben misst alle zwanzig Minuten Temperatur, Luftfeuchte, Kohlendioxid und mehr.',
    'La paillasse scientifique : les expériences de l’habitat – échantillons, cultures, mesures – et les résultats scientifiques quotidiens que rédige l’officier scientifique. Le nœud de capteurs à côté mesure toutes les vingt minutes la température, l’humidité, le dioxyde de carbone et plus.'],
  'Nothing is thrown away. Used water passes through a planted filter bed, a screw press and a settling funnel and comes back as water for the plants and the crew. This loop decides how long the stores last.': [
    'Nichts wird weggeworfen. Gebrauchtes Wasser durchläuft ein bepflanztes Filterbeet, eine Schneckenpresse und einen Absetztrichter und kommt als Wasser für die Pflanzen und die Crew zurück. Dieser Kreislauf entscheidet, wie lange die Vorräte reichen.',
    'Rien n’est jeté. L’eau usée traverse un lit filtrant planté, une presse à vis et un entonnoir de décantation, puis revient comme eau pour les plantes et l’équipage. Cette boucle décide de la durée des réserves.'],
  'Three shelves of plants grown without soil, their roots in nutrient-rich water — the habitat’s fresh food and part of its air. What grows here is counted with the food rations.': [
    'Drei Regale mit Pflanzen, die ohne Erde wachsen, die Wurzeln in nährstoffreichem Wasser – die frische Nahrung des Habitats und ein Teil seiner Luft. Was hier wächst, wird mit den Essensrationen gezählt.',
    'Trois étagères de plantes cultivées sans sol, les racines dans une eau riche en nutriments – la nourriture fraîche de l’habitat et une part de son air. Ce qui pousse ici est compté avec les rations.'],
  'Everything in the habitat runs on what the crew can make and store. Heating, the galley, lighting and electronics draw on one battery, and the crew count the kilowatt-hours by category every day.': [
    'Alles im Habitat läuft mit dem, was die Crew erzeugen und speichern kann. Heizung, Küche, Licht und Elektronik hängen an einer Batterie, und die Crew zählt die Kilowattstunden täglich nach Kategorie.',
    'Tout dans l’habitat fonctionne avec ce que l’équipage peut produire et stocker. Chauffage, cuisine, éclairage et électronique puisent dans une seule batterie, et l’équipage compte chaque jour les kilowattheures par catégorie.'],
  'A bicycle generator: pedalling charges the battery. The health officer’s workout is also the habitat’s power plant — the steps and the kilowatt-hours are the same effort.': [
    'Ein Fahrradgenerator: Treten lädt die Batterie. Das Training des Gesundheitsoffiziers ist zugleich das Kraftwerk des Habitats – die Schritte und die Kilowattstunden sind dieselbe Anstrengung.',
    'Un générateur à vélo : pédaler charge la batterie. L’entraînement de l’officier de santé est aussi la centrale de l’habitat – les pas et les kilowattheures sont le même effort.'],
  // the EVA key: the crew's daily walk outside (dome.js, ABOUT.eva and figures)
  'An EVA — an extra-vehicular activity — is the walk outside, in the suit, on the square. Its hour is on the day’s schedule, and the pictures of it are on the Media page.':
    ['Ein EVA — eine Extravehicular Activity, ein Außeneinsatz — ist der Gang nach draußen, im Anzug, auf dem Platz. Seine Stunde steht im Tagesplan, und die Bilder davon sind auf der Medienseite.',
     'Une EVA — une activité extravéhiculaire — est la sortie dehors, en combinaison, sur la place. Son heure figure au programme du jour, et les images en sont sur la page Médias.'],
  'Day 01’s EVA is at': ['Der Außeneinsatz an Tag 01 ist um', 'L’EVA du jour 01 est à'],
  'Today’s EVA is at': ['Der heutige Außeneinsatz ist um', 'L’EVA d’aujourd’hui est à'],
  'Today’s EVA was at': ['Der heutige Außeneinsatz war um', 'L’EVA d’aujourd’hui était à'],
  'No EVA on today’s schedule.': ['Kein Außeneinsatz im heutigen Plan.', 'Pas d’EVA au programme d’aujourd’hui.'],
  // the Dashboard key: what the mission dashboard is, and the key to it (dome.js, ABOUT.dashboard and figures)
  'The Mission Dashboard is the station’s instrument panel: the habitat’s live readings, today’s schedule and meal, the crew’s condition, the trends over the run and the three daily blogs — everything the sensors measure and the crew report, on one page, refreshed as it comes in.':
    ['Das Missions-Dashboard ist die Instrumententafel der Station: die Live-Messwerte des Habitats, der heutige Plan und die Mahlzeit, der Zustand der Crew, die Verläufe über den Lauf und die drei täglichen Blogs — alles, was die Sensoren messen und die Crew berichtet, auf einer Seite, aktualisiert, sobald es eintrifft.',
     'Le tableau de bord de mission est le panneau d’instruments de la station : les mesures en direct de l’habitat, le programme et le repas du jour, l’état de l’équipage, les tendances sur la durée de la mission et les trois blogs quotidiens — tout ce que les capteurs mesurent et ce que l’équipage rapporte, sur une page, actualisée au fur et à mesure.'],
  'Open the Mission Dashboard': ['Das Missions-Dashboard öffnen', 'Ouvrir le tableau de bord de mission'],
  'tasks done today': ['Aufgaben heute erledigt', 'tâches faites aujourd’hui'],

  // ---- the habitat sensor (src/lib/habitat-feed.js, public/habitat.js)
  'Live sensors and Habitat measurements': ['Live-Sensoren und Habitat-Messwerte', 'Capteurs en direct et mesures de l’habitat'],
  'Air quality': ['Luftqualität', 'Qualité de l’air'],
  'IAQ index': ['IAQ-Index', 'Indice IAQ'],
  'as the sensor classifies it': ['wie der Sensor sie einstuft', 'telle que le capteur la classe'],
  'Volatile organic compounds': ['Flüchtige organische Verbindungen', 'Composés organiques volatils'],
  'Breath-VOC equivalent': ['Atem-VOC-Äquivalent', 'Équivalent COV respiratoire'],
  'Illuminance': ['Beleuchtungsstärke', 'Éclairement'],
  'Excellent': ['Ausgezeichnet', 'Excellente'],
  'Good': ['Gut', 'Bonne'],
  'Lightly polluted': ['Leicht belastet', 'Légèrement polluée'],
  'Moderately polluted': ['Mässig belastet', 'Modérément polluée'],
  'Heavily polluted': ['Stark belastet', 'Fortement polluée'],
  'Severely polluted': ['Sehr stark belastet', 'Sévèrement polluée'],
  'Extremely polluted': ['Extrem belastet', 'Extrêmement polluée'],
  'Unknown': ['Unbekannt', 'Inconnue'],
  'Waiting for the station’s first read of the habitat sensor.': ['Warte auf den ersten Abruf des Habitatsensors durch die Station.', 'En attente de la première lecture du capteur de l’habitat par la station.'],
  'No current reading from the habitat sensor.': ['Kein aktueller Messwert vom Habitatsensor.', 'Aucune mesure actuelle du capteur de l’habitat.'],
  'No reading has arrived in the last': ['Kein Messwert eingetroffen in den letzten', 'Aucune mesure reçue au cours des dernières'],
  'Home Assistant has no reading for': ['Home Assistant hat keinen Messwert für', 'Home Assistant n’a aucune mesure pour'],
  'Check the entity ids in content/home-assistant.json, and that the habitat sensor is on.': ['Prüfe die Entity-IDs in content/home-assistant.json und ob der Habitatsensor eingeschaltet ist.', 'Vérifiez les identifiants d’entité dans content/home-assistant.json et que le capteur de l’habitat est allumé.'],

  // ---- the habitat tiles (public/habitat.js)
  'No current reading': ['Kein aktueller Messwert', 'Aucune mesure actuelle'],
  'Within limit': ['Innerhalb des Grenzwerts', 'Dans la limite'],
  'Over': ['Über', 'Au-dessus de'],
  'in view': ['im Blick', 'dans la vue'],
  'limit': ['Grenzwert', 'limite'],
  'TODAY': ['HEUTE', 'AUJOURD’HUI'],
  'ago': ['her', 'plus tôt'],
  'The record closed on': ['Die Aufzeichnung wurde geschlossen am', 'L’archive a été close le'],
  'Last reading': ['Letzter Messwert', 'Dernière mesure'],
  'Nothing is updated after that.': ['Danach wird nichts mehr aktualisiert.', 'Rien n’est mis à jour après cela.'],
  'Could not reach the sensor feed.': ['Der Sensor-Feed war nicht erreichbar.', 'Impossible de joindre le flux des capteurs.'],
  'Showing the last good data, read': ['Zeigt die letzten guten Daten, gelesen', 'Affiche les dernières bonnes données, lues'],
  'Nothing has been read yet.': ['Noch nichts gelesen.', 'Rien n’a encore été lu.'],
  'Waiting for the station’s first read of the sensor node.': ['Warte auf den ersten Abruf des Sensorknotens durch die Station.', 'En attente de la première lecture du capteur par la station.'],
  'It polls on start and every': ['Sie fragt beim Start ab und alle', 'Elle interroge au démarrage et toutes les'],
  'minutes': ['Minuten', 'minutes'],
  'No readings yet.': ['Noch keine Messwerte.', 'Pas encore de mesures.'],
  'The station’s readings start': ['Die Messwerte der Station beginnen', 'Les mesures de la station commencent'],
  'the node’s next transmission will appear here.': ['die nächste Übertragung des Knotens erscheint hier.', 'la prochaine transmission du capteur apparaîtra ici.'],
  'No reading has arrived today.': ['Heute ist kein Messwert eingegangen.', 'Aucune mesure n’est arrivée aujourd’hui.'],
  'No reading has arrived in the last 30 minutes.': ['In den letzten 30 Minuten ist kein Messwert eingegangen.', 'Aucune mesure n’est arrivée depuis 30 minutes.'],
  'No current reading from the sensor node.': ['Kein aktueller Messwert vom Sensorknoten.', 'Aucune mesure actuelle du capteur.'],
  'Its last reading was': ['Sein letzter Messwert war', 'Sa dernière mesure date de'],
  'The tiles stay empty until it transmits again — earlier readings are on the trend graph.':
    ['Die Kacheln bleiben leer, bis er wieder sendet — frühere Messwerte stehen im Trenddiagramm.', 'Les tuiles restent vides jusqu’à sa prochaine transmission — les mesures antérieures sont sur le graphique des tendances.'],

  // ---- the landing page on a phone: the world's slowest chat (src/views/pages/slowchat.js).
  // {range}, {now} and {time} are put in by the page — keep them in the translation, wherever the language wants them.
  'Wait, what is this?': ['Moment, was ist das?', 'Attendez, qu’est-ce que c’est ?'],
  'The world’s slowest chat.': ['Der langsamste Chat der Welt.', 'Le chat le plus lent du monde.'],
  'Communicate with the crew.': ['Kommuniziere mit der Crew.', 'Communiquez avec l’équipage.'],
  'How a message reaches the crew': ['Wie eine Nachricht die Crew erreicht', 'Comment un message parvient à l’équipage'],
  'Habitat entry': ['Einzug ins Habitat', 'Entrée dans l’habitat'],
  'Three crew members enter the Mars habitat at Marktplatz.': ['Drei Crewmitglieder ziehen in das Mars-Habitat auf dem Marktplatz ein.', 'Trois membres d’équipage entrent dans l’habitat martien, sur la Marktplatz.'],
  'Uplink received': ['Uplink empfangen', 'Liaison montante reçue'],
  'What does it smell like in there?': ['Wie riecht es da drin?', 'Ça sent quoi, là-dedans ?'],
  // ---- the slowest chat after October's text sheet
  'Welcome to the World’s Slowest Chat (that also zips into space!)': ['Willkommen im langsamsten Chat der Welt (der auch ins All saust!)', 'Bienvenue dans le chat le plus lent du monde (qui file aussi dans l’espace !)'],
  'As our ground station personnel, you can discuss the question of the day with us, send us messages about things we should know or find out for you or send a message to space via our habitat. The Comms Officer will answer your messages personally. You can also drop us a postcard on MARS!platz or come to our daily Communication Hour at {time} to speak to us directly.':
    ['Als unser Bodenstationspersonal kannst du die Frage des Tages mit uns diskutieren, uns Nachrichten über Dinge schicken, die wir wissen oder für dich herausfinden sollten, oder über unser Habitat eine Nachricht ins All senden. Der Comms Officer beantwortet deine Nachrichten persönlich. Du kannst uns auch eine Postkarte auf dem MARS!platz hinterlassen oder täglich um {time} zu unserer Kommunikationsstunde kommen, um direkt mit uns zu sprechen.',
     'En tant que membre du personnel de notre centre de contrôle terrestre, vous pouvez discuter avec nous de la question du jour, nous envoyer des messages sur ce que nous devrions savoir ou chercher pour vous, ou envoyer un message dans l’espace via notre habitat. L’officier de communication répondra personnellement à vos messages. Vous pouvez aussi nous laisser une carte postale sur la MARS!platz ou venir lors de notre heure de communication quotidienne à {time} pour nous parler directement.'],
  'How it works:': ['So funktioniert es:', 'Comment ça marche :'],
  'Have you checked your CO₂ sensors lately? They seem to be running dangerously high': ['Habt ihr eure CO₂-Sensoren in letzter Zeit geprüft? Sie scheinen gefährlich hoch zu stehen', 'Avez-vous vérifié vos capteurs de CO₂ récemment ? Ils semblent dangereusement élevés'],
  'Your message from Earth will travel to Mars to reach the crew on MARS!platz, where it will be seen and answered accordingly.':
    ['Deine Nachricht von der Erde reist zum Mars und erreicht die Crew auf dem MARS!platz, wo sie gelesen und entsprechend beantwortet wird.', 'Votre message de la Terre voyagera vers Mars pour atteindre l’équipage sur la MARS!platz, où il sera lu et recevra une réponse.'],
  'At the same time, your message will also travel into space. Click on the Message Board to see how far your message has gone. Keep it family friendly.':
    ['Gleichzeitig reist deine Nachricht auch ins All. Klick auf das Nachrichtenboard, um zu sehen, wie weit deine Nachricht schon gekommen ist. Bitte familienfreundlich bleiben.', 'En même temps, votre message voyagera aussi dans l’espace. Cliquez sur le tableau des messages pour voir jusqu’où il est allé. Restez bon enfant.'],
  'Yes, CO₂ levels were elevated. We took countermeasures and sensors indicate we are back at normal parameters. Thanks for the heads up!':
    ['Ja, die CO₂-Werte waren erhöht. Wir haben Gegenmaßnahmen ergriffen, und die Sensoren zeigen, dass wir wieder im Normalbereich sind. Danke für den Hinweis!', 'Oui, les niveaux de CO₂ étaient élevés. Nous avons pris des contre-mesures et les capteurs indiquent que nous sommes revenus aux paramètres normaux. Merci de nous avoir prévenus !'],
  'Messages will be answered during the day and can be viewed on the {board}. Also, at {time}, the daily communication window opens where people on MARS!platz can communicate directly with the crew.':
    ['Nachrichten werden im Laufe des Tages beantwortet und sind auf dem {board} zu sehen. Außerdem öffnet sich um {time} das tägliche Kommunikationsfenster, in dem die Menschen auf dem MARS!platz direkt mit der Crew sprechen können.', 'Les messages reçoivent une réponse dans la journée et peuvent être consultés sur le {board}. De plus, à {time}, la fenêtre de communication quotidienne s’ouvre : les gens sur la MARS!platz peuvent alors parler directement avec l’équipage.'],
  'message board': ['Nachrichtenboard', 'tableau des messages'],
  'A message from Earth enters the communications queue. It will take time to reach the crew.':
    ['Eine Nachricht von der Erde reiht sich in die Warteschlange ein. Es dauert, bis sie die Crew erreicht.', 'Un message de la Terre entre dans la file d’attente des communications. Il lui faudra du temps pour atteindre l’équipage.'],
  'Every message goes two ways: to the crew in the Mars habitat — and, by radio, out into space, where it travels on at the speed of light. Tap it on the Message Board to see how far it has come.':
    ['Jede Nachricht geht zwei Wege: zur Crew im Mars-Habitat — und per Funk hinaus ins All, wo sie mit Lichtgeschwindigkeit weiterreist. Tippe sie auf dem Nachrichtenboard an, um zu sehen, wie weit sie schon gekommen ist.',
      'Chaque message suit deux chemins : vers l’équipage dans l’habitat martien — et, par radio, vers l’espace, où il poursuit sa route à la vitesse de la lumière. Touchez-le sur le tableau des messages pour voir jusqu’où il est arrivé.'],
  'Signal in transit': ['Signal unterwegs', 'Signal en transit'],
  'M km': ['Mio. km', 'M km'],
  'The signal is on its way.': ['Das Signal ist unterwegs.', 'Le signal est en route.'],
  'Under real conditions, a message can take {range} to reach Mars — today it takes {now}.':
    ['Unter realen Bedingungen braucht eine Nachricht {range} bis zum Mars — heute sind es {now}.', 'Dans des conditions réelles, un message met {range} pour atteindre Mars — aujourd’hui, {now}.'],
  '4 to 22 minutes': ['4 bis 22 Minuten', '4 à 22 minutes'],
  'Each chat response will require {range}.': ['Jede Antwort im Chat braucht {range}.', 'Chaque réponse demandera {range}.'],
  '8 to 44 minutes': ['8 bis 44 Minuten', '8 à 44 minutes'],
  'For this simulation, the transmission takes {time}.': ['In dieser Simulation dauert die Übertragung {time}.', 'Dans cette simulation, la transmission prend {time}.'],
  'second': ['Sekunde', 'seconde'],
  'seconds': ['Sekunden', 'secondes'],
  'Crew response': ['Die Crew antwortet', 'L’équipage répond'],
  'Downlink received': ['Downlink empfangen', 'Liaison descendante reçue'],
  'Lentils. Mostly lentils.': ['Linsen. Vor allem Linsen.', 'Des lentilles. Surtout des lentilles.'],
  'At {time}, the communications window opens. Messages from Earth are answered by the crew; answered questions can be seen on the Message Board.':
    ['Um {time} öffnet sich das Kommunikationsfenster. Dann beantwortet die Crew die Nachrichten von der Erde; die beantworteten Fragen sind auf dem Nachrichtenboard zu sehen.', 'À {time}, la fenêtre de communication s’ouvre. L’équipage répond alors aux messages de la Terre ; les questions ayant reçu une réponse sont visibles sur le tableau des messages.'],
  'When the communications window opens, messages from Earth are answered by the crew.':
    ['Wenn sich das Kommunikationsfenster öffnet, beantwortet die Crew die Nachrichten von der Erde.', 'Quand la fenêtre de communication s’ouvre, l’équipage répond aux messages de la Terre.'],
  // ---- the reference sheet: the landing page after the design handoff (src/views/pages/landing.js, dome.js, sky.js),
  // the header's running line (public.js) and the theme key (layout.js). {date} and {time} are put in by the page.
  'Durational performance': ['Langzeitperformance', 'Performance de longue durée'],
  'Know more': ['Mehr erfahren', 'En savoir plus'],                        // the note's key to the About page
  'MARS! turns the Karlsruhe Marktplatz into MARS!platz. Can we go to Mars to save the Earth? Three astronauts are finding out, and you can help! Write them a message, have a look on the mission dashboard to find out if their food supply is running low or see what they’re currently researching.':
    ['MARS! macht den Karlsruher Marktplatz zum MARS!platz. Können wir zum Mars fliegen, um die Erde zu retten? Drei Astronautinnen und Astronauten finden es heraus – und du kannst helfen! Schreib ihnen eine Nachricht, wirf einen Blick auf das Missions-Dashboard, um zu sehen, ob ihre Lebensmittelvorräte knapp werden, oder schau, was sie gerade erforschen.',
     'MARS! transforme la Marktplatz de Karlsruhe en MARS!platz. Peut-on aller sur Mars pour sauver la Terre ? Trois astronautes cherchent la réponse, et vous pouvez les aider ! Écrivez-leur un message, jetez un œil au tableau de bord de la mission pour savoir si leurs réserves de nourriture s’épuisent ou voyez ce qu’ils étudient en ce moment.'],
  'Write to the crew, or follow them': ['Schreib der Crew oder folge ihr', 'Écrivez à l’équipage, ou suivez-le'],
  // ---- A sol on MARS!platz (src/views/pages/sol.js): the About page's day on a rail
  'A sol on MARS!platz': ['Ein Sol auf dem MARS!platz', 'Un sol sur la MARS!platz'],
  'The day in the habitat, activity by activity — from breakfast to lights out': ['Der Tag im Habitat, Aktivität für Aktivität — vom Frühstück bis Lights-out', 'La journée dans l’habitat, activité par activité — du petit-déjeuner à l’extinction des feux'],
  'The typical sol, as every day of the run is planned': ['Der typische Sol, wie jeder Tag des Laufs geplant ist', 'Le sol type, tel que chaque journée de la mission est prévue'],
  'The last sol, as it was planned': ['Der letzte Sol, wie er geplant war', 'Le dernier sol, tel qu’il était prévu'],
  'Today’s crew': ['Die Crew heute', 'L’équipage aujourd’hui'],
  'The three roles': ['Die drei Rollen', 'Les trois rôles'],
  'to be named': ['noch offen', 'à désigner'],
  'Science': ['Wissenschaft', 'Science'],
  'EVA': ['EVA', 'EVA'],
  'Health': ['Gesundheit', 'Santé'],
  'Social': ['Soziales', 'Temps social'],
  'Key': ['Legende', 'Légende'],
  'Fixed hours': ['Feste Zeiten', 'Heures fixes'],
  'Communication hour': ['Kommunikationsstunde', 'Heure de communication'],
  'Lights out': ['Lights-out', 'Extinction des feux'],
  'Times are habitat-local. Every sol follows the typical schedule; mission control changes a day on the Habitat tab.':
    ['Zeiten in Habitat-Ortszeit. Jeder Sol folgt dem typischen Tagesplan; die Missionskontrolle ändert einen Tag auf dem Habitat-Tab.', 'Heures locales de l’habitat. Chaque sol suit le programme type ; le centre de contrôle modifie une journée dans l’onglet Habitat.'],
  'Latest message:': ['Neueste Nachricht:', 'Dernier message :'],
  'Latest image': ['Neuestes Bild', 'Dernière image'],
  'MARS is a durational performance in which three crew members are always in the habitat for the thirteen days of the run.':
    ['MARS ist eine Langzeitperformance, bei der während der dreizehn Tage des Laufs immer drei Crewmitglieder im Habitat sind.',
      'MARS est une performance de longue durée : pendant les treize jours de la mission, trois membres d’équipage sont toujours dans l’habitat.'],
  'This website is your portal into the mission: a space to communicate with the astronauts, follow their activities, and observe life inside the habitat throughout the duration of the performance.':
    ['Diese Website ist dein Portal zur Mission: ein Ort, um mit den Astronautinnen und Astronauten zu kommunizieren, ihren Tätigkeiten zu folgen und das Leben im Habitat während der ganzen Performance zu beobachten.',
      'Ce site est votre portail vers la mission : un espace pour communiquer avec les astronautes, suivre leurs activités et observer la vie dans l’habitat pendant toute la durée de la performance.'],
  'The mission': ['Die Mission', 'La mission'],
  'Commanding officer': ['Kommandantin', 'Commandant'],
  'Science officer': ['Wissenschaftsoffizier', 'Officier scientifique'],
  'Health officer': ['Gesundheitsoffizier', 'Officier de santé'],
  'Every day, the astronauts also leave the Habitat in their spacesuits for an EVA on the Mars landscape of Karlsruhe’s Marktplatz.':
    ['Jeden Tag verlassen die Astronauten das Habitat außerdem in ihren Raumanzügen für einen Außeneinsatz (EVA) in der Marslandschaft des Karlsruher Marktplatzes.',
      'Chaque jour, les astronautes quittent aussi l’habitat en combinaison spatiale pour une sortie extravéhiculaire (EVA) dans le paysage martien de la Marktplatz de Karlsruhe.'],
  'Welcome to the World’s Slowest Chat': ['Willkommen im langsamsten Chat der Welt', 'Bienvenue dans le chat le plus lent du monde'],
  'Communicate': ['Kommunizieren', 'Communiquer'],
  'Every day at {time}, the Habitat opens its communication window. Come to MARS!platz at Karlsruhe’s Marktplatz or connect through the online portal to speak with the astronauts and discover what is happening inside the Habitat.':
    ['Jeden Tag um {time} öffnet das Habitat sein Kommunikationsfenster. Komm auf den MARS!platz am Karlsruher Marktplatz oder verbinde dich über das Online-Portal, um mit den Astronauten zu sprechen und zu erfahren, was im Habitat geschieht.',
      'Chaque jour à {time}, l’habitat ouvre sa fenêtre de communication. Venez à la MARS!platz sur la Marktplatz de Karlsruhe ou connectez-vous au portail en ligne pour parler avec les astronautes et découvrir ce qui se passe dans l’habitat.'],
  'Transit': ['Transit', 'Transit'],
  'Downlink': ['Downlink', 'Liaison descendante'],
  'Send a message': ['Eine Nachricht senden', 'Envoyer un message'],
  'Now in the habitat': ['Jetzt im Habitat', 'En ce moment dans l’habitat'],
  'Earth–Mars distance': ['Distanz Erde–Mars', 'Distance Terre–Mars'],
  'million km': ['Mio. km', 'millions de km'],
  'at the speed of light': ['mit Lichtgeschwindigkeit', 'à la vitesse de la lumière'],
  'Habitat reading': ['Messwert im Habitat', 'Mesure dans l’habitat'],
  'Sol': ['Sol', 'Sol'],
  'sol to go': ['Sol verbleibt', 'sol restant'],
  'sols to go': ['Sols verbleiben', 'sols restants'],
  'the last day': ['der letzte Tag', 'le dernier jour'],
  'Communication window daily': ['Kommunikationsfenster täglich', 'Fenêtre de communication tous les jours à'],
  'Switch between light and dark': ['Zwischen hell und dunkel wechseln', 'Basculer entre clair et sombre'],
  // the screens' door (screens.js, login; server.js, /screens/login)
  'The screens': ['Die Screens', 'Les écrans'],
  'Sign in': ['Anmelden', 'Se connecter'],
  'The installation’s screens are for the venue: sign in once on this browser and it stays signed in.': ['Die Screens der Installation sind für den Ort: einmal in diesem Browser anmelden, und er bleibt angemeldet.', 'Les écrans de l’installation sont pour le lieu : connectez-vous une fois sur ce navigateur et il reste connecté.'],
  'User': ['Benutzer', 'Utilisateur'],
  'Password': ['Passwort', 'Mot de passe'],
  'Those credentials were not accepted.': ['Diese Zugangsdaten wurden nicht akzeptiert.', 'Ces identifiants n’ont pas été acceptés.'],
  'Too many tries. Wait ten minutes, then sign in again.': ['Zu viele Versuche. Warte zehn Minuten und melde dich dann erneut an.', 'Trop de tentatives. Attendez dix minutes, puis reconnectez-vous.'],
  'Sign out of the screens': ['Von den Screens abmelden', 'Se déconnecter des écrans'],
};

/** T for one language: exact English in, that language out; unknown stays English. */
function of(lang) {
  const i = lang === 'de' ? 0 : lang === 'fr' ? 1 : -1;
  // the function carries its language (T.lang), for the few places that format a number or a date for it
  if (i < 0) return Object.assign((s) => s, { lang: 'en' });
  return Object.assign((s) => {
    const row = D[s];
    return row && row[i] ? row[i] : s;
  }, { lang });
}

/** The language the site opens in before a visitor chooses one: German (October: the site opens in German, and dark —
    server.js keeps the theme dark until the switch is pressed), unless the environment names another (DEFAULT_LANG=en —
    the test suite runs so). */
const DEFAULT_LANG = LANGS.includes(process.env.DEFAULT_LANG) ? process.env.DEFAULT_LANG : 'de';
/** The visitor's language, from the cookie; without one, the site's default. */
function pick(req) {
  const v = req.cookies ? req.cookies.mcs_lang : null;
  return LANGS.includes(v) ? v : DEFAULT_LANG;
}

/**
 * The dictionary for one language as a flat object, English in → that
 * language out, for the browser: the page scripts read it through `t()`.
 * English gets an empty table — there is nothing to look up.
 */
function table(lang) {
  const i = lang === 'de' ? 0 : lang === 'fr' ? 1 : -1;
  if (i < 0) return {};
  const out = {};
  for (const [en, row] of Object.entries(D)) if (row[i]) out[en] = row[i];
  return out;
}

module.exports = { LANGS, DEFAULT_LANG, of, pick, table, D };
