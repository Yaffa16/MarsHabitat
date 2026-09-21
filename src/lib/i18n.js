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
  'SIGNAL DELAY': ['SIGNALLAUFZEIT', 'DÉLAI DU SIGNAL'],
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
  'REACHED MARS': ['MARS ERREICHT', 'MARS ATTEINT'],
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
  'No schedule filed for this day': ['Für diesen Tag kein Plan erfasst', 'Aucun programme saisi pour ce jour'],
  'Filed by mission control · never quoted as numbers': ['Von der Missionskontrolle erfasst · nie als Zahlen zitiert', 'Saisi par le contrôle de mission · jamais cité en chiffres'],
  'Sensor node · measured live · figures and stores counted by the crew':
    ['Sensorknoten · live gemessen · Zahlen und Vorräte von der Crew gezählt', 'Capteur · mesuré en direct · chiffres et réserves comptés par l’équipage'],
  'Everything, day by day': ['Alles, Tag für Tag', 'Tout, jour par jour'],
  'The whole mission': ['Die ganze Mission', 'Toute la mission'],

  'Today’s Schedule': ['Heutiger Tagesplan', 'Programme du jour'],
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
  'RECONNECTING': ['VERBINDE NEU', 'RECONNEXION'],

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
  // each is followed by the day it speaks of: "… for SOL 005"
  'No science findings yet for': ['Noch keine wissenschaftlichen Befunde für', 'Pas encore d’observations scientifiques pour'],
  'No health blog yet for': ['Noch kein Gesundheitsblog für', 'Pas encore de blog santé pour'],
  'No commander blog yet for': ['Noch kein Commander-Blog für', 'Pas encore de blog du commandement pour'],
  'No schedule filed yet': ['Noch kein Plan erfasst', 'Aucun programme saisi pour l’instant'],

  // ---- the landing page's aura layout: the composer's heading, the blogs' heading, the menu, the lead
  'Write to the crew': ['Schreib der Crew', 'Écrivez à l’équipage'],
  'Live Mission Dashboard': ['Missions-Dashboard live', 'Tableau de bord de mission en direct'],
  'Send a message to the Crew': ['Schick der Crew eine Nachricht', 'Envoyez un message à l’équipage'],
  'Daily Blog': ['Tagesblog', 'Blog du jour'],
  'Collapse': ['Einklappen', 'Replier'],
  'Expand': ['Ausklappen', 'Déplier'],
  'Commander · Health · Science': ['Commander · Gesundheit · Wissenschaft', 'Commandement · Santé · Science'],
  'About, What this is, Who we are': ['Über, Worum es geht, Wer wir sind', 'À propos, De quoi il s’agit, Qui nous sommes'],
  'MARS is a durational performance. Three officers live sealed inside the habitat for the thirteen days of the run; visitors to the exhibition can see the habitat from outside. What they cannot do is walk in and talk to the people inside it. Here a message has to travel. You watch it go. You wait.':
    ['MARS ist eine Durational Performance. Drei Offiziere leben die dreizehn Tage des Laufs abgeschlossen im Habitat; die Besucher der Ausstellung können das Habitat von außen sehen. Was sie nicht können, ist hineingehen und mit den Menschen darin sprechen. Hier muss eine Nachricht reisen. Man sieht sie gehen. Man wartet.',
     'MARS est une performance de longue durée. Trois officiers vivent enfermés dans l’habitat pendant les treize jours de la mission ; les visiteurs de l’exposition peuvent voir l’habitat de l’extérieur. Ce qu’ils ne peuvent pas faire, c’est y entrer et parler aux personnes qui s’y trouvent. Ici, un message doit voyager. On le regarde partir. On attend.'],

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
  'The habitat, the distance, the archive': ['Das Habitat, die Distanz, das Archiv', 'L’habitat, la distance, l’archive'],
  'How the station behaves, in plain terms': ['Wie die Station sich verhält, in einfachen Worten', 'Comment la station se comporte, en termes simples'],
  'Crew, company, production credits': ['Crew, Kompanie, Produktionscredits', 'Équipage, compagnie, crédits de production'],
  'Close': ['Schließen', 'Fermer'],
  'MARS is a durational performance. For the length of the mission the crew do not leave the habitat. They follow a schedule, eat what has been planned for them, work through a set of tasks, and draw down a finite inventory. Visitors to the exhibition can see the habitat from outside. What they cannot do is walk in and talk to the people inside it.':
    ['MARS ist eine Langzeitperformance. Für die Dauer der Mission verlässt die Crew das Habitat nicht. Sie folgt einem Tagesplan, isst, was für sie geplant wurde, arbeitet eine Reihe von Aufgaben ab und zehrt von einem endlichen Vorrat. Besucherinnen und Besucher der Ausstellung können das Habitat von außen sehen. Was sie nicht können: hineingehen und mit den Menschen darin sprechen.',
     'MARS est une performance de longue durée. Pendant toute la mission, l’équipage ne quitte pas l’habitat. Il suit un programme, mange ce qui a été prévu pour lui, accomplit une série de tâches et puise dans des réserves finies. Les visiteurs de l’exposition peuvent voir l’habitat de l’extérieur. Ce qu’ils ne peuvent pas faire, c’est y entrer et parler aux personnes qui s’y trouvent.'],
  'The sensors that produce the readings on this page are mounted in that structure. When the habitat warms up because a room full of people is standing around it, the number moves. The data is not a simulation of a Mars habitat; it is a measurement of a real enclosed space with three people in it.':
    ['Die Sensoren, die die Messwerte auf dieser Seite liefern, sind in dieser Struktur montiert. Wenn sich das Habitat erwärmt, weil ein Raum voller Menschen darum herumsteht, bewegt sich die Zahl. Die Daten sind keine Simulation eines Mars-Habitats; sie sind die Messung eines realen, geschlossenen Raums mit drei Menschen darin.',
     'Les capteurs qui produisent les mesures de cette page sont montés dans cette structure. Quand l’habitat se réchauffe parce qu’une salle pleine de monde se tient autour, le chiffre bouge. Les données ne sont pas la simulation d’un habitat martien ; elles sont la mesure d’un espace clos réel avec trois personnes à l’intérieur.'],
  'Networked communication is built to remove distance. A message is written and delivered in the same breath, and the gap between two people becomes invisible. That invisibility is the thing this piece takes apart.':
    ['Vernetzte Kommunikation ist gebaut, um Distanz aufzuheben. Eine Nachricht wird im selben Atemzug geschrieben und zugestellt, und der Abstand zwischen zwei Menschen wird unsichtbar. Diese Unsichtbarkeit ist es, die dieses Werk auseinandernimmt.',
     'La communication en réseau est faite pour abolir la distance. Un message s’écrit et se livre dans le même souffle, et l’écart entre deux personnes devient invisible. C’est cette invisibilité que cette œuvre démonte.'],
  'Here a message has to travel. You watch it go. You wait. It is read by someone who decides whether it goes further. A reply is written and comes back the other way. The exchange that a messaging app would have completed in under a second is stretched out until you can feel its shape — and the number in the rail above reminds you that the real crossing is longer still.':
    ['Hier muss eine Nachricht reisen. Du siehst sie gehen. Du wartest. Jemand liest sie und entscheidet, ob sie weitergeht. Eine Antwort wird geschrieben und kommt den anderen Weg zurück. Der Austausch, den eine Messenger-App in unter einer Sekunde erledigt hätte, wird gedehnt, bis du seine Form spüren kannst — und die Zahl in der Leiste oben erinnert dich daran, dass die echte Strecke noch länger ist.',
     'Ici, un message doit voyager. Vous le regardez partir. Vous attendez. Quelqu’un le lit et décide s’il va plus loin. Une réponse s’écrit et revient par l’autre chemin. L’échange qu’une messagerie aurait bouclé en moins d’une seconde s’étire jusqu’à ce que vous en sentiez la forme — et le chiffre dans la barre au-dessus vous rappelle que la vraie traversée est plus longue encore.'],
  'The delay is not friction added for effect. It is the subject.':
    ['Die Verzögerung ist keine Reibung, die des Effekts wegen hinzugefügt wurde. Sie ist das Thema.', 'Le délai n’est pas une friction ajoutée pour l’effet. C’est le sujet.'],
  'Every published exchange stays here. Over the run the archive accumulates into something neither the artists nor the audience wrote alone: a record of what people on Earth wanted to ask three strangers in a sealed room, and how those questions shifted as the mission went on.':
    ['Jeder veröffentlichte Nachrichtenwechsel bleibt hier. Über den Lauf hinweg wächst das Archiv zu etwas, das weder die Künstlerinnen und Künstler noch das Publikum allein geschrieben haben: eine Aufzeichnung dessen, was Menschen auf der Erde drei Fremde in einem versiegelten Raum fragen wollten, und wie sich diese Fragen im Verlauf der Mission verschoben.',
     'Chaque échange publié reste ici. Au fil de la période, l’archive s’accumule en quelque chose que ni les artistes ni le public n’ont écrit seuls : la trace de ce que des gens sur Terre ont voulu demander à trois inconnus dans une pièce scellée, et de la façon dont ces questions ont changé au cours de la mission.'],
  'Hertzlab is the research and production laboratory of the ZKM | Center for Art and Media Karlsruhe, working across performance, sound, media technology and installation. MARS is produced within that context, and this station was built as part of the production rather than as documentation of it.':
    ['Das Hertzlab ist das Forschungs- und Produktionslabor des ZKM | Zentrum für Kunst und Medien Karlsruhe und arbeitet über Performance, Klang, Medientechnologie und Installation hinweg. MARS entsteht in diesem Kontext, und diese Station wurde als Teil der Produktion gebaut, nicht als deren Dokumentation.',
     'Le Hertzlab est le laboratoire de recherche et de production du ZKM | Centre d’art et de médias de Karlsruhe, à la croisée de la performance, du son, des technologies des médias et de l’installation. MARS est produit dans ce contexte, et cette station a été construite comme partie de la production plutôt que comme sa documentation.'],
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
  'to reach Mars, and the same again to come back. The station shows you that figure constantly — it is in the rail at the top. But the animated crossing you watch after pressing transmit runs in about ten seconds. Pretending otherwise would make the piece a lie about physics rather than a piece about distance. The real number is stored with your message and travels with it into the archive.':
    ['bis zum Mars, und noch einmal so lang zurück. Die Station zeigt dir diese Zahl ständig — sie steht in der Leiste oben. Aber die animierte Strecke, die du nach dem Senden siehst, läuft in etwa zehn Sekunden ab. So zu tun, als wäre es anders, machte aus dem Werk eine Lüge über Physik statt eines Werks über Distanz. Die echte Zahl wird mit deiner Nachricht gespeichert und reist mit ihr ins Archiv.',
     'pour atteindre Mars, et autant pour revenir. La station vous montre ce chiffre en permanence — il est dans la barre en haut. Mais la traversée animée que vous regardez après avoir appuyé sur transmettre dure une dizaine de secondes. Prétendre le contraire ferait de l’œuvre un mensonge sur la physique plutôt qu’une œuvre sur la distance. Le vrai chiffre est enregistré avec votre message et voyage avec lui jusque dans l’archive.'],
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
  'The crew are addressed by designation for the length of the mission. That is a condition of the piece, not an administrative convenience — the audience meets them as a role, and the names are published only once the habitat opens.':
    ['Die Crew wird für die Dauer der Mission mit ihrer Bezeichnung angesprochen. Das ist eine Bedingung des Werks, keine Verwaltungsbequemlichkeit — das Publikum begegnet ihnen als Rolle, und die Namen werden erst veröffentlicht, wenn das Habitat sich öffnet.',
     'L’équipage est désigné par sa fonction pendant toute la mission. C’est une condition de l’œuvre, pas une commodité administrative — le public les rencontre comme un rôle, et les noms ne sont publiés qu’à l’ouverture de l’habitat.'],
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
  'the habitat’s readings as the sensors are sending them now, the plan for SOL 001 (schedule, meals, consumption, power), whatever the crew have already written into the opening day, and any states filed today. This page disappears on 15 October, when SOL 001 takes its place.':
    ['die Messwerte des Habitats, wie die Sensoren sie gerade senden, der Plan für SOL 001 (Tagesplan, Mahlzeiten, Verbrauch, Energie), was die Crew bereits in den Eröffnungstag geschrieben hat, und alle heute erfassten Zustände. Diese Seite verschwindet am 15. Oktober, wenn SOL 001 ihren Platz einnimmt.',
     'les mesures de l’habitat telles que les capteurs les envoient maintenant, le plan du SOL 001 (programme, repas, consommation, énergie), ce que l’équipage a déjà écrit pour le jour d’ouverture, et les états saisis aujourd’hui. Cette page disparaît le 15 octobre, quand le SOL 001 prend sa place.'],
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
  'Hatch not yet sealed': ['Luke noch nicht verschlossen', 'Écoutille pas encore scellée'],
  'Off the schedule': ['Ausserhalb des Plans', 'Hors programme'],
  'AS REPORTED': ['WIE GEMELDET', 'TEL QUE RAPPORTÉ'],
  'no state': ['kein Zustand', 'aucun état'],
  'exchanges published': ['Austausche veröffentlicht', 'échanges publiés'],
  'messages sent': ['Nachrichten gesendet', 'messages envoyés'],
  'so far': ['bisher', 'jusqu’ici'],
  'not yet counted': ['noch nicht gezählt', 'pas encore compté'],

  'Water recycling': ['Wasserrecycling', 'Recyclage de l’eau'],
  'The uplink. Every message written on this station crosses the distance to the habitat and waits for the communication officer, who reads it and answers from inside; the reply comes back to the board on every open phone. The real light-time between Earth and Mars is shown beside the composer.': [
    'Der Uplink. Jede auf dieser Station geschriebene Nachricht überquert die Distanz zum Habitat und wartet auf die Kommunikationsoffizierin, die sie von innen liest und beantwortet; die Antwort kommt auf jedem geöffneten Telefon zurück aufs Board. Die reale Lichtlaufzeit zwischen Erde und Mars steht neben dem Composer.',
    'La liaison. Chaque message écrit sur cette station traverse la distance jusqu’à l’habitat et attend l’officier de communication, qui le lit et y répond depuis l’intérieur ; la réponse revient sur le tableau de chaque téléphone ouvert. Le vrai temps-lumière entre la Terre et Mars est affiché à côté du composeur.'],
  'Hydroponics': ['Hydroponik', 'Hydroponie'],
  'Communication': ['Kommunikation', 'Communication'],
  'Nap pod': ['Schlafkapsel', 'Capsule de repos'],
  'Power generator': ['Stromgenerator', 'Générateur électrique'],
  'press a part of the habitat to see what is happening in it': ['einen Teil des Habitats drücken, um zu sehen, was darin geschieht', 'appuyer sur une partie de l’habitat pour voir ce qui s’y passe'],
  'The parts of the habitat': ['Die Teile des Habitats', 'Les parties de l’habitat'],
  'Open its panel on the dashboard': ['Sein Feld auf dem Dashboard öffnen', 'Ouvrir son panneau sur le tableau de bord'],
  'Now': ['Jetzt', 'Maintenant'],
  'Hatch not yet sealed.': ['Luke noch nicht verschlossen.', 'Écoutille pas encore scellée.'],
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
  'Three officers live sealed inside the habitat for the thirteen days of the run: a communication officer who relays every message from Earth, a science officer who runs the experiments and watches the habitat’s systems, and a health officer who keeps the crew fit and the life support in order. They write a daily blog and file their condition from inside.': [
    'Drei Offiziere leben die dreizehn Tage des Laufs abgeschlossen im Habitat: eine Kommunikationsoffizierin, die jede Nachricht von der Erde weiterleitet, ein Wissenschaftsoffizier, der die Experimente durchführt und die Systeme des Habitats beobachtet, und ein Gesundheitsoffizier, der die Crew fit und die Lebenserhaltung in Ordnung hält. Sie schreiben täglich einen Blog und melden ihren Zustand von innen.',
    'Trois officiers vivent enfermés dans l’habitat pendant les treize jours de la mission : un officier de communication qui relaie chaque message de la Terre, un officier scientifique qui mène les expériences et surveille les systèmes de l’habitat, et un officier de santé qui garde l’équipage en forme et le support de vie en ordre. Ils écrivent un blog quotidien et déclarent leur état depuis l’intérieur.'],
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
  'One enclosed pod for rest. The crew sleep in shifts so that someone is always awake for a communication window, and the air in the pod during the sleep period is the reading watched most closely.': [
    'Eine geschlossene Kapsel zum Ausruhen. Die Crew schläft in Schichten, damit immer jemand für ein Kommunikationsfenster wach ist, und die Luft in der Kapsel während der Schlafphase ist der am genauesten beobachtete Messwert.',
    'Une capsule fermée pour le repos. L’équipage dort par roulement pour que quelqu’un soit toujours éveillé pour une fenêtre de communication, et l’air de la capsule pendant le sommeil est la mesure la plus surveillée.'],
  'A bicycle generator: pedalling charges the battery. The health officer’s workout is also the habitat’s power plant — the steps and the kilowatt-hours are the same effort.': [
    'Ein Fahrradgenerator: Treten lädt die Batterie. Das Training des Gesundheitsoffiziers ist zugleich das Kraftwerk des Habitats – die Schritte und die Kilowattstunden sind dieselbe Anstrengung.',
    'Un générateur à vélo : pédaler charge la batterie. L’entraînement de l’officier de santé est aussi la centrale de l’habitat – les pas et les kilowattheures sont le même effort.'],

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
