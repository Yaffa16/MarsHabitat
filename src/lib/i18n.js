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
  'Back to the station': ['Zurück zur Station', 'Retour à la station'],
  'Language': ['Sprache', 'Langue'],

  // ---- masthead
  'Communication Station': ['Kommunikationsstation', 'Station de communication'],
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
  'CHOOSE UP TO 3 TAGS': ['BIS ZU 3 TAGS WÄHLEN', 'JUSQU’À 3 ÉTIQUETTES'],
  'Transmit': ['Senden', 'Transmettre'],
  'Write to the crew.': ['Schreib der Crew.', 'Écrivez à l’équipage.'],

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
  'Mission dashboard': ['Missions-Dashboard', 'Tableau de bord de mission'],
  'Trends': ['Trends', 'Tendances'],
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
  'What this is': ['Worum es geht', 'De quoi il s’agit'],
  'Who we are': ['Wer wir sind', 'Qui nous sommes'],
  'The habitat': ['Das Habitat', 'L’habitat'],
  'From Earth to the habitat': ['Von der Erde zum Habitat', 'De la Terre à l’habitat'],
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

  // ---- page chrome
  'Mars Communication Station': ['Mars-Kommunikationsstation', 'Station de communication Mars'],
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
  'You are writing. Nothing has left Earth.': ['Du schreibst. Nichts hat die Erde verlassen.', 'Vous écrivez. Rien n’a quitté la Terre.'],
  'You pressed send. The station timestamps it.': ['Du hast auf Senden gedrückt. Die Station stempelt die Zeit.', 'Vous avez appuyé sur envoyer. La station l’horodate.'],
  'Crossing the gap. You cannot send again.': ['Auf dem Weg über die Distanz. Du kannst nicht erneut senden.', 'En train de franchir la distance. Vous ne pouvez pas renvoyer.'],
  'It has reached the Mars endpoint.': ['Sie hat den Mars-Endpunkt erreicht.', 'Il a atteint le point d’arrivée sur Mars.'],
  'A human at mission control reads it.': ['Ein Mensch in der Missionskontrolle liest sie.', 'Une personne au contrôle de mission le lit.'],
  'Cleared to be answered.': ['Zur Beantwortung freigegeben.', 'Autorisé à recevoir une réponse.'],
  'The crew write back.': ['Die Crew schreibt zurück.', 'L’équipage répond.'],
  'Both halves enter the archive.': ['Beide Hälften gehen ins Archiv.', 'Les deux moitiés entrent dans l’archive.'],

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
  'How it will work': ['So wird es funktionieren', 'Comment cela fonctionnera'],
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
  'Daily Science Findings': ['Tägliche wissenschaftliche Befunde', 'Observations scientifiques quotidiennes'],
  'Daily Health Blog': ['Täglicher Gesundheitsblog', 'Blog santé quotidien'],
  'Commander Blog': ['Commander-Blog', 'Blog du commandement'],
  'ALL BLOGS': ['ALLE BLOGS', 'TOUS LES BLOGS'],
  'blog posts': ['Blogbeiträge', 'billets de blog'],
  'Nothing written in this blog yet': ['In diesem Blog steht noch nichts', 'Rien d’écrit dans ce blog pour l’instant'],
  'Three blogs come out of the habitat each day: the Commander Blog, the Daily Science Findings and the Daily Health Blog. Nobody edits them on the way out.': ['Jeden Tag kommen drei Blogs aus dem Habitat: der Commander-Blog, die täglichen wissenschaftlichen Befunde und der tägliche Gesundheitsblog. Niemand bearbeitet sie auf dem Weg nach draußen.', 'Chaque jour, trois blogs sortent de l’habitat : le blog du commandement, les observations scientifiques quotidiennes et le blog santé quotidien. Personne ne les modifie en chemin.'],
  // each is followed by the day it speaks of: "… for SOL 005"
  'No science findings yet for': ['Noch keine wissenschaftlichen Befunde für', 'Pas encore d’observations scientifiques pour'],
  'No health blog yet for': ['Noch kein Gesundheitsblog für', 'Pas encore de blog santé pour'],
  'No commander blog yet for': ['Noch kein Commander-Blog für', 'Pas encore de blog du commandement pour'],
  'No schedule filed yet': ['Noch kein Plan erfasst', 'Aucun programme saisi pour l’instant'],

  // ---- the landing page's aura layout: the composer's heading, the blogs' heading, the menu, the lead
  'Write to the crew': ['Schreib der Crew', 'Écrivez à l’équipage'],
  'Live Mission Dashboard': ['Missions-Dashboard live', 'Tableau de bord de mission en direct'],
  'Dashboard': ['Dashboard', 'Tableau de bord'],
  'More': ['Mehr', 'Plus'],
  'Everything else on the station': ['Alles Weitere auf der Station', 'Tout le reste de la station'],
  'Show more': ['Mehr anzeigen', 'Afficher plus'],
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
  'No reading from the meter yet today, and nothing filed by the crew': ['Heute noch kein Zählerwert und nichts von der Crew eingetragen', 'Pas encore de relevé du compteur aujourd’hui, rien de noté par l’équipage'],
  'high': ['Hoch', 'max'],
  'Reject': ['Ablehnen', 'Refuser'],
  'Callsign on sending': ['Rufzeichen beim Senden', 'Indicatif à l’envoi'],
  'Your message went under the callsign': ['Deine Nachricht ging unter dem Rufzeichen', 'Votre message est parti sous l’indicatif'],
  'look for it on the Message Board once the crew have answered.': ['such es auf dem Nachrichtenboard, sobald die Crew geantwortet hat.', 'cherchez-le sur le tableau des messages une fois que l’équipage aura répondu.'],
  'You will get a callsign': ['Du bekommst ein Rufzeichen', 'Vous recevrez un indicatif'],
  'The station assigns you one — a word and a number, such as BASALT-625 — the moment you accept its cookie, or the moment you first send.':
    ['Die Station weist dir eines zu — ein Wort und eine Zahl, etwa BASALT-625 —, sobald du ihren Cookie akzeptierst oder zum ersten Mal sendest.',
     'La station vous en attribue un — un mot et un nombre, comme BASALT-625 — dès que vous acceptez son cookie ou que vous envoyez pour la première fois.'],
  'Latest from the crew': ['Das Neueste von der Crew', 'Le dernier mot de l’équipage'],
  'At a glance': ['Auf einen Blick', 'En un coup d’œil'],
  'The station, page by page': ['Die Station, Seite für Seite', 'La station, page par page'],
  'Send a message to the Crew': ['Schick der Crew eine Nachricht', 'Envoyez un message à l’équipage'],
  'Daily Blog': ['Tagesblog', 'Blog du jour'],
  'Collapse': ['Einklappen', 'Replier'],
  'Expand': ['Ausklappen', 'Déplier'],
  'Commander · Health · Science': ['Commander · Gesundheit · Wissenschaft', 'Commandement · Santé · Science'],
  'About, What this is, Who we are': ['Über, Worum es geht, Wer wir sind', 'À propos, De quoi il s’agit, Qui nous sommes'],

  // ---- crew condition (src/lib/mood.js)
  'CALM': ['RUHIG', 'CALME'],
  'SETTLED': ['GEFASST', 'POSÉ'],
  'LEVEL': ['AUSGEGLICHEN', 'NEUTRE'],
  'TENSE': ['ANGESPANNT', 'TENDU'],
  'ANGRY': ['WÜTEND', 'EN COLÈRE'],
  'NO DATA': ['KEINE DATEN', 'PAS DE DONNÉES'],
  'calm, at ease with the day': ['ruhig, im Reinen mit dem Tag', 'calme, en paix avec la journée'],
  'settled, working steadily': ['gefasst, arbeitet gleichmäßig', 'posé, travaille régulièrement'],
  'level — neither calm nor cross': ['ausgeglichen — weder ruhig noch gereizt', 'neutre — ni calme ni contrarié'],
  'tense, short with the others': ['angespannt, kurz angebunden mit den anderen', 'tendu, sec avec les autres'],
  'angry, needing distance': ['wütend, braucht Abstand', 'en colère, a besoin de distance'],
  'No report has been received from this crew member.': ['Von diesem Crewmitglied ist kein Bericht eingegangen.', 'Aucun rapport n’a été reçu de ce membre de l’équipage.'],

  // ---- About / info
  'The project, the distance, the archive': ['Das Projekt, die Distanz, das Archiv', 'Le projet, la distance, l’archive'],
  'How the station behaves, in plain terms': ['Wie die Station sich verhält, in einfachen Worten', 'Comment la station se comporte, en termes simples'],
  'Crew, company, production credits': ['Crew, Kompanie, Produktionscredits', 'Équipage, compagnie, crédits de production'],
  'Close': ['Schließen', 'Fermer'],
  'A durational performance on Karlsruhe’s Marktplatz, Thursday 15 to Tuesday 27 October 2026. Admission is free.':
    ['Eine Dauerperformance auf dem Karlsruher Marktplatz, Donnerstag, 15. bis Dienstag, 27. Oktober 2026. Der Eintritt ist frei.',
     'Une performance de longue durée sur la Marktplatz de Karlsruhe, du jeudi 15 au mardi 27 octobre 2026. L’entrée est libre.'],
  'Large space agencies and private companies are hard at work on a future for people on Mars. What would that future look like — and shouldn’t the people be part of designing it? MARS!platz asks exactly that.':
    ['Große Raumfahrtagenturen und private Unternehmen arbeiten mit Hochdruck an einer Zukunft der Menschen auf dem Mars. Wie sähe diese Zukunft aus — und sollten die Menschen sie nicht selbst mitgestalten? Genau das fragt der MARS!platz.',
     'Les grandes agences spatiales et des entreprises privées travaillent d’arrache-pied à un avenir des humains sur Mars. À quoi ressemblerait cet avenir — et les gens ne devraient-ils pas participer à le concevoir ? C’est exactement la question que pose MARS!platz.'],
  'For six months Hertzlab, the artistic research and development department of the ZKM, worked with artists, experts and the citizen scientists of the open group Red Dust Society on how people could live on Mars: how to build and use a habitat, how to keep a crew mentally well, how to feed it and grow food, how to organise living together, and how to keep track of and save resources. What came out of it now goes into an analogue simulation — a large public experiment that tests which of the ideas hold up.':
    ['Sechs Monate lang hat das Hertzlab, die Abteilung für künstlerische Forschung und Entwicklung des ZKM, mit Künstlerinnen und Künstlern, Expertinnen und Experten und den Citizen Scientists der offenen Gruppe Red Dust Society daran gearbeitet, wie Menschen auf dem Mars leben könnten: wie man ein Habitat baut und nutzt, wie eine Crew psychisch gesund bleibt, wie man sie ernährt und Nahrung anbaut, wie man das Zusammenleben organisiert und wie man Ressourcen dokumentiert und schont. Was dabei entstanden ist, geht jetzt in eine analoge Simulation — ein großes öffentliches Experiment, das prüft, welche der Ideen sich bewähren.',
     'Pendant six mois, le Hertzlab, le département de recherche et de développement artistiques du ZKM, a travaillé avec des artistes, des experts et les citoyens scientifiques du groupe ouvert Red Dust Society sur la façon dont des humains pourraient vivre sur Mars : comment construire et utiliser un habitat, comment garder un équipage en bonne santé mentale, comment le nourrir et cultiver de la nourriture, comment organiser la vie commune et comment tenir le compte des ressources et les économiser. Ce qui en est sorti entre maintenant dans une simulation analogique — une grande expérience publique qui teste lesquelles de ces idées tiennent.'],
  'A white dome on the Marktplatz marks the outpost of the first people to land: Red Dust City. For the thirteen days of the run three crew members are always in the habitat — a Commanding Officer, a Science Officer and a Health Officer — living and working under the conditions of a long-duration mission and testing what visitors of the ZKM and citizens of Karlsruhe have developed: the design and use of the habitat, strategies for the crew’s mental health, a balanced plan for food and growing, rules for organising a community, and the documenting and saving of resources.':
    ['Eine weiße Kuppel auf dem Marktplatz markiert den Außenposten der ersten Gelandeten: Red Dust City. Während der dreizehn Tage des Laufs sind immer drei Crewmitglieder im Habitat — eine Kommandantin, ein Wissenschaftsoffizier und ein Gesundheitsoffizier —, die unter den Bedingungen einer Langzeitmission leben und arbeiten und erproben, was Besucherinnen und Besucher des ZKM und Karlsruher Bürgerinnen und Bürger entwickelt haben: die Gestaltung und Nutzung des Habitats, Strategien für die psychische Gesundheit der Crew, einen ausgewogenen Ernährungs- und Anbauplan, Regeln für das Zusammenleben und die Dokumentation und Schonung von Ressourcen.',
     'Un dôme blanc sur la Marktplatz marque l’avant-poste des premiers arrivants : Red Dust City. Pendant les treize jours de la mission, trois membres d’équipage sont toujours dans l’habitat — un commandant, un officier scientifique et un officier de santé — ; ils y vivent et y travaillent dans les conditions d’une mission de longue durée et testent ce que les visiteurs du ZKM et les habitants de Karlsruhe ont développé : la conception et l’usage de l’habitat, des stratégies pour la santé mentale de l’équipage, un plan équilibré d’alimentation et de culture, des règles pour organiser une communauté, et la documentation et l’économie des ressources.'],
  'Every day the crew go out in their spacesuits on an EVA — an extra-vehicular activity — to run experiments on the Marktplatz. A detailed hourly programme says what is being tested when, and what came of it.':
    ['Jeden Tag geht die Crew in ihren Raumanzügen zu einem Außeneinsatz (EVA — Extra Vehicular Activity) hinaus, um Experimente auf dem Marktplatz durchzuführen. Ein detailliertes Stundenprogramm sagt, was wann erprobt wird und was dabei herausgekommen ist.',
     'Chaque jour, l’équipage sort en combinaison spatiale pour une EVA — une sortie extravéhiculaire — afin de mener des expériences sur la Marktplatz. Un programme horaire détaillé dit ce qui est testé à quel moment, et ce qu’il en est ressorti.'],
  'You can talk to the crew: online, right here, through the world’s slowest chat; over the radio; at the ZKM; or on the Marktplatz itself. How would you live on Mars? Help design a possible future — solutions for Mars are also solutions for life on Earth.':
    ['Ihr könnt mit der Crew sprechen: online, hier, im langsamsten Chat der Welt; über Funk; im ZKM; oder direkt auf dem Marktplatz. Wie würdet ihr auf dem Mars leben? Helft mit, diese mögliche Zukunft zu gestalten — Lösungen für den Mars sind auch Lösungen für das Leben auf der Erde.',
     'Vous pouvez parler à l’équipage : en ligne, ici même, par le chat le plus lent du monde ; par radio ; au ZKM ; ou sur la Marktplatz elle-même. Comment vivriez-vous sur Mars ? Aidez à concevoir cet avenir possible — les solutions pour Mars sont aussi des solutions pour la vie sur Terre.'],
  'MARS!platz: Red Dust City is part of MARS! Mobilizing Awareness for Resilient Societies!, the ZKM’s programme for 2026, which the exhibition MARS! opened at the ZKM from 6 June to 13 September 2026. The opening on the Marktplatz is on Thursday 15 October 2026 from 16:00 to 17:00.':
    ['MARS!platz: Red Dust City ist Teil von MARS! Mobilizing Awareness for Resilient Societies!, dem Programm des ZKM für 2026, das die Ausstellung MARS! vom 6. Juni bis 13. September 2026 im ZKM eröffnet hat. Die Eröffnung auf dem Marktplatz ist am Donnerstag, 15. Oktober 2026, von 16:00 bis 17:00 Uhr.',
     'MARS!platz: Red Dust City fait partie de MARS! Mobilizing Awareness for Resilient Societies!, le programme du ZKM pour 2026, ouvert par l’exposition MARS! au ZKM du 6 juin au 13 septembre 2026. L’ouverture sur la Marktplatz a lieu le jeudi 15 octobre 2026 de 16h00 à 17h00.'],
  'Networked communication is built to remove distance. A message is written and delivered in the same breath, and the gap between two people becomes invisible. That invisibility is the thing this piece takes apart.':
    ['Vernetzte Kommunikation ist gebaut, um Distanz aufzuheben. Eine Nachricht wird im selben Atemzug geschrieben und zugestellt, und der Abstand zwischen zwei Menschen wird unsichtbar. Diese Unsichtbarkeit ist es, die dieses Werk auseinandernimmt.',
     'La communication en réseau est faite pour abolir la distance. Un message s’écrit et se livre dans le même souffle, et l’écart entre deux personnes devient invisible. C’est cette invisibilité que cette œuvre démonte.'],
  'Here a message has to travel. You watch it go. You wait. It is read by someone who decides whether it goes further. A reply is written and comes back the other way. The exchange that a messaging app would have completed in under a second is stretched out until you can feel its shape — and the number in the rail above reminds you that the real crossing is longer still.':
    ['Hier muss eine Nachricht reisen. Du siehst sie gehen. Du wartest. Jemand liest sie und entscheidet, ob sie weitergeht. Eine Antwort wird geschrieben und kommt den anderen Weg zurück. Der Austausch, den eine Messenger-App in unter einer Sekunde erledigt hätte, wird gedehnt, bis du seine Form spüren kannst — und die Zahl in der Leiste oben erinnert dich daran, dass die echte Strecke noch länger ist.',
     'Ici, un message doit voyager. Vous le regardez partir. Vous attendez. Quelqu’un le lit et décide s’il va plus loin. Une réponse s’écrit et revient par l’autre chemin. L’échange qu’une messagerie aurait bouclé en moins d’une seconde s’étire jusqu’à ce que vous en sentiez la forme — et le chiffre dans la barre au-dessus vous rappelle que la vraie traversée est plus longue encore.'],
  'The delay is not friction added for effect. It is the subject.':
    ['Die Verzögerung ist keine Reibung, die des Effekts wegen hinzugefügt wurde. Sie ist das Thema.', 'Le délai n’est pas une friction ajoutée pour l’effet. C’est le sujet.'],
  'Every published exchange stays here. Over the run the archive accumulates into something neither the artists nor the audience wrote alone: a record of what people on Earth wanted to ask the three crew members in the habitat, and how those questions shifted as the mission went on.':
    ['Jeder veröffentlichte Nachrichtenwechsel bleibt hier. Über den Lauf hinweg wächst das Archiv zu etwas, das weder die Künstlerinnen und Künstler noch das Publikum allein geschrieben haben: eine Aufzeichnung dessen, was Menschen auf der Erde die drei Crewmitglieder im Habitat fragen wollten, und wie sich diese Fragen im Verlauf der Mission verschoben.',
     'Chaque échange publié reste ici. Au fil de la période, l’archive s’accumule en quelque chose que ni les artistes ni le public n’ont écrit seuls : la trace de ce que des gens sur Terre ont voulu demander aux trois membres d’équipage dans l’habitat, et de la façon dont ces questions ont changé au cours de la mission.'],
  'The readings': ['Die Messwerte', 'Les mesures'],
  'Messages sent to space': ['Nachrichten ins All', 'Des messages envoyés dans l’espace'],
  'Every message the crew answer is also beamed into space, by radio, through SpaceSpeak — a small network of transmitters around the world that sends short messages out of the atmosphere on request. The station hands the message over the moment its reply is published; SpaceSpeak encodes it and transmits it on a frequency between 2.4 and 5 gigahertz, a band chosen because it passes through the air and its water vapour almost untouched, from a directional antenna that gathers the transmitter’s power into a narrow cone pointed at the sky. Radio waves are light: they leave at the speed of light, 299,792 km every second.':
    ['Jede Nachricht, die die Crew beantwortet, wird außerdem per Funk ins All gesendet — über SpaceSpeak, ein kleines Netz von Sendern rund um die Welt, das kurze Nachrichten auf Bestellung aus der Atmosphäre hinausschickt. Die Station übergibt die Nachricht in dem Moment, in dem ihre Antwort veröffentlicht wird; SpaceSpeak kodiert sie und sendet sie auf einer Frequenz zwischen 2,4 und 5 Gigahertz — einem Band, das gewählt ist, weil es Luft und Wasserdampf fast ungehindert durchdringt — über eine Richtantenne, die die Leistung des Senders zu einem schmalen, gen Himmel gerichteten Kegel bündelt. Radiowellen sind Licht: Sie brechen mit Lichtgeschwindigkeit auf, 299.792 km in jeder Sekunde.',
     'Chaque message auquel l’équipage répond est aussi envoyé dans l’espace, par radio, via SpaceSpeak — un petit réseau d’émetteurs répartis dans le monde, qui expédie de courts messages hors de l’atmosphère à la demande. La station lui remet le message à l’instant où sa réponse est publiée ; SpaceSpeak le code et l’émet sur une fréquence comprise entre 2,4 et 5 gigahertz, une bande choisie parce qu’elle traverse l’air et sa vapeur d’eau presque sans perte, depuis une antenne directive qui concentre la puissance de l’émetteur en un cône étroit pointé vers le ciel. Les ondes radio sont de la lumière : elles partent à la vitesse de la lumière, 299 792 km chaque seconde.'],
  'From then on the message is on its way for good. It passes the Moon’s orbit within two seconds, the orbit of Mars within minutes and Jupiter’s within the hour, leaves the planets behind in a matter of hours, and after two years is nearly halfway to Proxima Centauri, the nearest star. The signal grows fainter with every kilometre, spreading out as it goes — but there is no distance at which it stops: what leaves Earth by radio keeps travelling outwards, long after everyone who wrote or read it. The Message Board counts each message’s distance from the moment it was sent, and a tap on it names the object in the sky it has just passed.':
    ['Von da an ist die Nachricht für immer unterwegs. Nach knapp zwei Sekunden hat sie die Mondbahn hinter sich, nach Minuten die Bahn des Mars, innerhalb einer Stunde die des Jupiter; nach einigen Stunden lässt sie die Planeten hinter sich, und nach zwei Jahren ist sie fast auf halbem Weg zu Proxima Centauri, dem nächsten Stern. Mit jedem Kilometer wird das Signal schwächer, weil es sich unterwegs ausbreitet — aber es gibt keine Entfernung, in der es aufhört: Was die Erde per Funk verlässt, reist weiter nach außen, lange nachdem alle, die es geschrieben oder gelesen haben, nicht mehr sind. Das Nachrichtenboard zählt die Entfernung jeder Nachricht von dem Moment an, in dem sie gesendet wurde, und ein Tippen auf sie nennt das Objekt am Himmel, das sie gerade hinter sich gelassen hat.',
     'Dès lors, le message est en route pour toujours. Il dépasse l’orbite de la Lune en moins de deux secondes, celle de Mars en quelques minutes, celle de Jupiter en moins d’une heure, laisse les planètes derrière lui en quelques heures, et au bout de deux ans il est presque à mi-chemin de Proxima du Centaure, l’étoile la plus proche. Le signal s’affaiblit à chaque kilomètre, parce qu’il s’étale en chemin — mais il n’existe aucune distance où il s’arrête : ce qui quitte la Terre par radio continue vers l’extérieur, longtemps après tous ceux qui l’ont écrit ou lu. Le tableau des messages compte la distance de chaque message depuis l’instant de son envoi, et une pression sur lui nomme l’objet du ciel qu’il vient de dépasser.'],
  'The sensors that produce the readings on this page are mounted in the habitat on the Marktplatz. When the habitat warms up because a crowd is standing around it, the number moves. The data is not a simulation of a Mars habitat; it is a measurement of the real one, with the crew in it.':
    ['Die Sensoren, die die Messwerte auf dieser Seite liefern, sind im Habitat auf dem Marktplatz montiert. Wenn sich das Habitat erwärmt, weil eine Menschenmenge darum herumsteht, bewegt sich die Zahl. Die Daten sind keine Simulation eines Mars-Habitats; sie sind die Messung des echten, mit der Crew darin.',
     'Les capteurs qui produisent les mesures de cette page sont montés dans l’habitat sur la Marktplatz. Quand l’habitat se réchauffe parce qu’une foule se tient autour, le chiffre bouge. Les données ne sont pas la simulation d’un habitat martien ; elles sont la mesure du vrai, avec l’équipage à l’intérieur.'],
  'Supported by the Innovationsfonds Kunst of the Ministry of Science, Research and the Arts Baden-Württemberg, the E.ON Stiftung and the LBBW Stiftung.':
    ['Gefördert durch den Innovationsfonds Kunst des Ministeriums für Wissenschaft, Forschung und Kunst Baden-Württemberg, die E.ON Stiftung und die LBBW Stiftung.',
     'Avec le soutien de l’Innovationsfonds Kunst du ministère des Sciences, de la Recherche et des Arts du Bade-Wurtemberg, de la E.ON Stiftung et de la LBBW Stiftung.'],
  'DESIGNATION': ['BEZEICHNUNG', 'DÉSIGNATION'],
  'RUN': ['LAUF', 'PÉRIODE'],
  'START': ['BEGINN', 'DÉBUT'],
  'END': ['ENDE', 'FIN'],
  'CREW': ['CREW', 'ÉQUIPAGE'],
  'TIMEZONE': ['ZEITZONE', 'FUSEAU HORAIRE'],
  'At this moment': ['In diesem Moment', 'En ce moment'],
  'SEPARATION': ['ABSTAND', 'SÉPARATION'],
  'DISTANCE': ['ENTFERNUNG', 'DISTANCE'],
  'ROUND TRIP': ['HIN UND ZURÜCK', 'ALLER-RETOUR'],
  'TREND': ['TENDENZ', 'TENDANCE'],
  'Positions are computed from Keplerian elements, not fetched from a service. The station keeps working if the venue loses its connection.':
    ['Die Positionen werden aus Kepler-Elementen berechnet, nicht von einem Dienst abgerufen. Die Station arbeitet weiter, wenn der Ort seine Verbindung verliert.',
     'Les positions sont calculées à partir d’éléments képlériens, pas récupérées auprès d’un service. La station continue de fonctionner si le lieu perd sa connexion.'],
  'You already have a callsign': ['Du hast bereits ein Rufzeichen', 'Vous avez déjà un indicatif'],
  'The moment you opened this page the station assigned you one — yours is':
    ['In dem Moment, in dem du diese Seite geöffnet hast, hat die Station dir eines zugewiesen — deines ist', 'À l’instant où vous avez ouvert cette page, la station vous en a attribué un — le vôtre est'],
  'It is stored in a cookie on your device and nowhere else. There is no account, no email, no name. If you clear your browser you will be issued a new one and lose the thread of your earlier messages.':
    ['Es ist in einem Cookie auf deinem Gerät gespeichert und nirgendwo sonst. Es gibt kein Konto, keine E-Mail, keinen Namen. Wenn du deinen Browser leerst, bekommst du ein neues und verlierst den Faden zu deinen früheren Nachrichten.',
     'Il est stocké dans un cookie sur votre appareil et nulle part ailleurs. Pas de compte, pas d’e-mail, pas de nom. Si vous videz votre navigateur, on vous en attribuera un nouveau et vous perdrez le fil de vos messages précédents.'],
  'What happens when you send something': ['Was passiert, wenn du etwas sendest', 'Ce qui se passe quand vous envoyez quelque chose'],
  'You write a message and choose up to three tags. When you transmit it, the composer is replaced by a transit display and you cannot send again until that message has arrived. The station computes the arrival time on the server, so closing the tab, reloading, or switching devices will not shorten the wait.':
    ['Du schreibst eine Nachricht und wählst bis zu drei Tags. Wenn du sie sendest, weicht das Schreibgerät einer Transit-Anzeige, und du kannst nicht erneut senden, bis diese Nachricht angekommen ist. Die Station berechnet die Ankunftszeit auf dem Server — den Tab schließen, neu laden oder das Gerät wechseln verkürzt das Warten nicht.',
     'Vous écrivez un message et choisissez jusqu’à trois étiquettes. Quand vous le transmettez, le composeur laisse place à un affichage de transit et vous ne pouvez pas renvoyer avant que ce message soit arrivé. La station calcule l’heure d’arrivée sur le serveur : fermer l’onglet, recharger ou changer d’appareil ne raccourcira pas l’attente.'],
  'The message then joins a queue that a human reads. Mission control decides whether it goes to the crew and whether it is published. Until it is answered it is visible only to you, under':
    ['Die Nachricht reiht sich dann in eine Warteschlange ein, die ein Mensch liest. Die Missionskontrolle entscheidet, ob sie zur Crew geht und ob sie veröffentlicht wird. Bis sie beantwortet ist, siehst nur du sie, unter',
     'Le message rejoint ensuite une file qu’une personne lit. Le contrôle de mission décide s’il va à l’équipage et s’il est publié. Tant qu’il n’a pas de réponse, vous seul le voyez, sous'],
  'on the board. Not every message is carried forward, and that is a real editorial decision rather than a spam filter.':
    ['auf dem Board. Nicht jede Nachricht wird weitergetragen, und das ist eine echte redaktionelle Entscheidung, kein Spamfilter.',
     'sur le tableau. Tous les messages ne sont pas retenus, et c’est une vraie décision éditoriale, pas un filtre anti-spam.'],
  'The delay is compressed, and we say so': ['Die Verzögerung ist verkürzt, und wir sagen es', 'Le délai est comprimé, et nous le disons'],
  'At this moment a radio signal takes': ['In diesem Moment braucht ein Funksignal', 'En ce moment, un signal radio met'],
  'to reach Mars, and the same again to come back. The station shows you that figure where you write. But the animated crossing you watch after pressing transmit runs in about ten seconds. Pretending otherwise would make the piece a lie about physics rather than a piece about distance. The real number is stored with your message and travels with it into the archive.':
    ['bis zum Mars, und noch einmal so lang zurück. Die Station zeigt dir diese Zahl dort, wo du schreibst. Aber die animierte Strecke, die du nach dem Senden siehst, läuft in etwa zehn Sekunden ab. So zu tun, als wäre es anders, machte aus dem Werk eine Lüge über Physik statt eines Werks über Distanz. Die echte Zahl wird mit deiner Nachricht gespeichert und reist mit ihr ins Archiv.',
     'pour atteindre Mars, et autant pour revenir. La station vous montre ce chiffre là où vous écrivez. Mais la traversée animée que vous regardez après avoir appuyé sur transmettre dure une dizaine de secondes. Prétendre le contraire ferait de l’œuvre un mensonge sur la physique plutôt qu’une œuvre sur la distance. Le vrai chiffre est enregistré avec votre message et voyage avec lui jusque dans l’archive.'],
  'Where the habitat readings come from': ['Woher die Habitat-Messwerte kommen', 'D’où viennent les mesures de l’habitat'],
  'Temperature, humidity and the other channels in the Habitat section are measured by a sensor node in the physical performance space. When the node stops reporting, the dashboard says so rather than freezing on its last value.':
    ['Temperatur, Luftfeuchte und die anderen Kanäle im Abschnitt Habitat werden von einem Sensorknoten im physischen Aufführungsraum gemessen. Wenn der Knoten nicht mehr meldet, sagt das Dashboard das, statt auf seinem letzten Wert einzufrieren.',
     'La température, l’humidité et les autres canaux de la section Habitat sont mesurés par un capteur dans l’espace physique de la performance. Quand le capteur cesse d’émettre, le tableau de bord le dit plutôt que de se figer sur sa dernière valeur.'],
  'What the crew readings are not': ['Was die Crew-Werte nicht sind', 'Ce que les relevés de l’équipage ne sont pas'],
  'The crew readings are filed by mission control on two axes and translated into sentences. They are a report about three people, written by people, transmitted deliberately. They are not sentiment analysis and they are not automated.':
    ['Die Crew-Werte werden von der Missionskontrolle auf zwei Achsen erfasst und in Sätze übersetzt. Sie sind ein Bericht über drei Menschen, von Menschen geschrieben, bewusst übermittelt. Sie sind keine Stimmungsanalyse und nicht automatisiert.',
     'Les relevés de l’équipage sont saisis par le contrôle de mission sur deux axes et traduits en phrases. C’est un rapport sur trois personnes, écrit par des personnes, transmis délibérément. Ce n’est pas une analyse de sentiment et ce n’est pas automatisé.'],
  'The path of a message': ['Der Weg einer Nachricht', 'Le chemin d’un message'],
  'What is kept': ['Was gespeichert wird', 'Ce qui est conservé'],
  'Your callsign, your message text, your tags, and the time you sent it. A one-way hash of your IP address is stored for rate limiting and is never displayed. No analytics, no third-party scripts, no tracking of any kind. Published exchanges stay on this page as part of the work; the complete day-by-day record is held by mission control and is not public.':
    ['Dein Rufzeichen, dein Nachrichtentext, deine Tags und der Zeitpunkt des Sendens. Ein Einweg-Hash deiner IP-Adresse wird zur Begrenzung der Senderate gespeichert und nie angezeigt. Keine Analytik, keine Skripte Dritter, kein Tracking irgendeiner Art. Veröffentlichte Nachrichtenwechsel bleiben als Teil des Werks auf dieser Seite; die vollständige Tag-für-Tag-Aufzeichnung liegt bei der Missionskontrolle und ist nicht öffentlich.',
     'Votre indicatif, le texte de votre message, vos étiquettes et l’heure d’envoi. Un hachage à sens unique de votre adresse IP est conservé pour limiter le débit et n’est jamais affiché. Pas d’analytique, pas de scripts tiers, aucun pistage d’aucune sorte. Les échanges publiés restent sur cette page comme partie de l’œuvre ; l’archive complète, jour par jour, est détenue par le contrôle de mission et n’est pas publique.'],
  'Message states as shown in the interface': ['Nachrichtenzustände, wie die Oberfläche sie zeigt', 'Les états d’un message, tels qu’affichés dans l’interface'],
  'Inside the habitat': ['Im Habitat', 'Dans l’habitat'],
  'The crew are addressed by designation for the length of the mission. That is a condition of the piece, not an administrative convenience — the audience meets them as a role, and the names are published after the run.':
    ['Die Crew wird für die Dauer der Mission mit ihrer Bezeichnung angesprochen. Das ist eine Bedingung des Werks, keine Verwaltungsbequemlichkeit — das Publikum begegnet ihnen als Rolle, und die Namen werden nach dem Lauf veröffentlicht.',
     'L’équipage est désigné par sa fonction pendant toute la mission. C’est une condition de l’œuvre, pas une commodité administrative — le public les rencontre comme un rôle, et les noms sont publiés après la mission.'],
  'currently': ['gerade', 'actuellement'],
  'unlogged': ['nicht erfasst', 'non consigné'],
  'Outside the habitat': ['Außerhalb des Habitats', 'Hors de l’habitat'],
  'Concept and direction': ['Konzept und Leitung', 'Concept et direction'],
  'Performance': ['Performance', 'Performance'],
  'Scenography and habitat': ['Szenografie und Habitat', 'Scénographie et habitat'],
  'Sound': ['Klang', 'Son'],
  'Sensor systems and software': ['Sensorsysteme und Software', 'Systèmes de capteurs et logiciel'],
  'Production': ['Produktion', 'Production'],
  'Technical direction': ['Technische Leitung', 'Direction technique'],
  'To be credited': ['Wird noch genannt', 'À créditer'],
  'to be credited': ['wird noch genannt', 'à créditer'],
  'Three performers, credited after the run': ['Drei Performende, genannt nach dem Lauf', 'Trois interprètes, crédités après la période'],
  'Replace these entries in': ['Ersetze diese Einträge in', 'Remplacez ces entrées dans'],
  'before the run opens.': ['bevor der Lauf beginnt.', 'avant l’ouverture de la période.'],
  'Produced by': ['Produziert von', 'Produit par'],
  'Center for Art and Media Karlsruhe': ['Zentrum für Kunst und Medien Karlsruhe', 'Centre d’art et de médias de Karlsruhe'],
  'Germany': ['Deutschland', 'Allemagne'],
  'Supported by': ['Gefördert von', 'Avec le soutien de'],
  'Partners': ['Partner', 'Partenaires'],
  'Reach the production': ['Die Produktion erreichen', 'Joindre la production'],
  'Press and production enquiries reach a person, not this station. Messages sent through the communication channel reach the habitat and are answered there. The two do not mix.':
    ['Presse- und Produktionsanfragen erreichen einen Menschen, nicht diese Station. Nachrichten über den Kommunikationskanal erreichen das Habitat und werden dort beantwortet. Beides vermischt sich nicht.',
     'Les demandes de presse et de production atteignent une personne, pas cette station. Les messages envoyés par le canal de communication atteignent l’habitat et y reçoivent leur réponse. Les deux ne se mélangent pas.'],
  'Write to the habitat instead': ['Stattdessen dem Habitat schreiben', 'Écrire plutôt à l’habitat'],

  // ---- At a Glance
  'REHEARSAL': ['PROBE', 'RÉPÉTITION'],
  'REHEARSAL · NOT THE RECORD': ['PROBE · NICHT DIE AUFZEICHNUNG', 'RÉPÉTITION · PAS L’ARCHIVE'],
  'REHEARSAL · TODAY, BEFORE THE RUN': ['PROBE · HEUTE, VOR DEM LAUF', 'RÉPÉTITION · AUJOURD’HUI, AVANT LA PÉRIODE'],
  'Rehearsal · today, before the run': ['Probe · heute, vor dem Lauf', 'Répétition · aujourd’hui, avant la période'],
  'Today, before the run — a rehearsal preview': ['Heute, vor dem Lauf — eine Probe-Vorschau', 'Aujourd’hui, avant la période — un aperçu de répétition'],
  'NOW': ['JETZT', 'MAINTENANT'],
  'A preview, not the record: a run day’s page as it will look, filled with what there is':
    ['Eine Vorschau, nicht die Aufzeichnung: die Seite eines Lauftags, wie sie aussehen wird, gefüllt mit dem Stand von', 'Un aperçu, pas l’archive : la page d’un jour de la période telle qu’elle apparaîtra, remplie de ce qu’il y a'],
  'the habitat’s readings as the sensors are sending them now, and everything mission control has filed under NOW, the rehearsal day — its schedule, meals, counts and power, the blogs, the exchanges and the media — with any states filed today. Nothing of it touches the run’s days. This page disappears on 15 October, when SOL 001 takes its place.':
    ['die Messwerte des Habitats, wie die Sensoren sie gerade senden, und alles, was die Missionskontrolle unter JETZT, dem Probetag, abgelegt hat — Tagesplan, Mahlzeiten, Zählungen und Energie, die Blogs, die Nachrichten und die Medien — samt allen heute erfassten Zuständen. Nichts davon berührt die Tage des Laufs. Diese Seite verschwindet am 15. Oktober, wenn SOL 001 ihren Platz einnimmt.',
     'les mesures de l’habitat telles que les capteurs les envoient maintenant, et tout ce que le contrôle de mission a consigné sous MAINTENANT, le jour de répétition — programme, repas, comptages et énergie, les blogs, les échanges et les médias — avec les états saisis aujourd’hui. Rien de tout cela ne touche aux jours de la période. Cette page disparaît le 15 octobre, quand le SOL 001 prend sa place.'],
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
  'HABITAT ONE': ['HABITAT EINS', 'HABITAT UN'],
  'press a hexagon to open its panel': ['ein Sechseck drücken, um sein Feld zu öffnen', 'appuyer sur un hexagone pour ouvrir son panneau'],
  'Science lab': ['Wissenschaftslabor', 'Laboratoire scientifique'],
  'Plants': ['Pflanzen', 'Plantes'],
  'Uplink': ['Uplink', 'Liaison montante'],
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
  'The ring is the day, midnight at the top': ['Der Ring ist der Tag, Mitternacht oben', 'L’anneau est le jour, minuit en haut'],
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
      'Chaque jour à {time}, l’habitat ouvre sa fenêtre de communication. Venez au MARS!platz sur la Marktplatz de Karlsruhe ou connectez-vous au portail en ligne pour parler avec les astronautes et découvrir ce qui se passe dans l’habitat.'],
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
  // whose clock the window's hour is in, after the hour and its zone: "16:00 CEST (Berlin time)" (landing.js, windowWhen)
  'Berlin time': ['Berliner Zeit', 'heure de Berlin'],
  'Switch between light and dark': ['Zwischen hell und dunkel wechseln', 'Basculer entre clair et sombre'],
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

/** The visitor's language, from the cookie; anything unknown is English. */
function pick(req) {
  const v = req.cookies ? req.cookies.mcs_lang : null;
  return LANGS.includes(v) ? v : 'en';
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

module.exports = { LANGS, of, pick, table, D };
