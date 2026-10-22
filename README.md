# Neon Well / 3D

**[Im Browser spielen](https://schmidt-software.github.io/neon-well/)**

Echtes räumliches Tetris mit **Three.js**: ein Schacht aus **5 × 5 × 12**
Zellen, perspektivische Würfel, dynamische Beleuchtung, Schatten und physikalisch
animierte Trümmer. Die 2D-Phaser-Version wurde nach Auswahl der echten
3D-Variante durch Three.js ersetzt.

## Start

Mit Node.js im Projektverzeichnis `npm start` ausführen und
**http://localhost:8123** öffnen. Für einen anderen Port: `PORT=8080 npm start`.
Alle Bibliotheken sind lokal unter `lib/` enthalten. Keine CDN-Verbindungen,
externen Fonts oder Audiodownloads. Ein aktueller Browser mit WebGL ist erforderlich.

## Spielregeln

Die sieben klassischen Tetrominos bestehen aus je vier Würfeln. Sie fallen von
oben in den Schacht und lassen sich auf X und Z verschieben sowie um alle drei
Achsen drehen. Eine **vollständig gefüllte horizontale Ebene aus 25 Zellen**
wird gelöscht; alle darüberliegenden Ebenen rücken nach. Eine bloße Reihe
genügt nicht. Vier gleichzeitig gelöschte Ebenen ergeben einen Tetris.

Ghost-Würfel zeigen die Landeposition. Die Draufsicht zeigt belegte Säulen,
die aktuelle Position (weiße Punkte) und den Ghost (türkiser Rahmen).
Die Achsen am Schacht markieren die festen Welt-Richtungen: Die Steuerung
bleibt beim Kameraschwenken unverändert. Wenn der nächste Stein nicht mehr
in den Schacht passt, ist das Spiel verloren.

| Taste | Aktion |
| --- | --- |
| Enter | Start / Neustart / Pause fortsetzen |
| A / D oder Links / Rechts | X-Richtung: links / rechts |
| W / S oder Oben / Unten | Z-Richtung: hinten / vorne |
| Q / E / R | Um X / Y / Z drehen |
| Shift + Q / E / R | In Gegenrichtung drehen |
| F (halten) | Soft Drop |
| Leertaste | Hard Drop |
| C | Hold, einmal pro abgesetztem Stein |
| P | Pause / Fortsetzen |
| M | Musik ein / aus |
| K | KI übernimmt / Kontrolle zurückgeben |
| Maus oder Finger ziehen | Kamera schwenken |
| Mausrad / Zwei-Finger-Geste | Zoom |
| Kreispfeil am Spielfeld | Kamera zurücksetzen |

Die Schaltflächen unterstützen Maus, Touch und Tastatur. Bewegung und Soft Drop
wiederholen sich beim Halten der Touch-Schaltflächen. Bei Fokusverlust pausiert
das Spiel automatisch. Hold und drei kommende Steine bleiben erhalten.

Eine / zwei / drei / vier Ebenen geben 100 / 300 / 500 / 800 Punkte, multipliziert
mit dem Level. Soft Drop gibt einen Punkt, Hard Drop zwei Punkte pro Zelle.
Nach jeweils zehn Ebenen steigen Level und Fallgeschwindigkeit.

## Attraktion-Modus

Nach 15 Sekunden ohne Eingabe im Startmenü läuft eine lautlose Arcade-Demo.
Vorbereitete Beispielschächte zeigen automatisch das Absetzen von Steinen und
das Löschen von einer bis vier Ebenen inklusive Trümmereffekten. Die Kamera
schwenkt langsam; bei `prefers-reduced-motion` bleibt sie stehen.
Tastatur, Mausbewegung, Klick, Touch oder Scrollen beenden die Demo und bringen
das unveränderte Startmenü zurück. Erst eine weitere Eingabe startet ein Spiel.
Die Demo läuft nie während eines Spiels, einer Pause oder im Game-Over-Bildschirm
und wird bei Fokusverlust beendet. Musik und Soundeffekte bleiben dabei aus.

## KI-Modus

**K** oder **KI: An / Aus** schaltet den Autopiloten um. Im Menü oder nach
Game Over startet K ein neues KI-Spiel. Im laufenden Spiel übernimmt die KI
den aktuellen Stein, Schacht und Punktestand ohne Neustart. Nochmal K gibt
dieselbe Partie an dich zurück. Während einer Pause lässt sich die KI ebenfalls
umschalten, ohne die Pause zu beenden. Ein normaler Neustart beginnt manuell.
Im Attraktion-Modus beendet K die Demo und startet direkt ein echtes KI-Spiel.

Die lokale, heuristische KI sucht über legale Bewegungen und Drehungen erreichbare
Landepositionen. Sie bevorzugt volle Ebenen und niedrige, gleichmäßige Stapel
ohne Hohlräume. Bewegungen und Drehungen werden sichtbar ausgeführt, danach folgt
der Hard Drop. Im KI-Modus ersetzt dieser Zugtakt den normalen Falltimer.
Die KI verändert weder Steine noch Zufallsauswahl und kann auch verlieren;
sie nutzt keine vorbereiteten Demo-Schächte. Manuelle Steinsteuerung ist während
der Übernahme gesperrt. Kamera, Musik und Pause bleiben bedienbar.

## Audio

Die eigene Chiptune-Musik mit Bass und Beat startet erst nach einer
Benutzeraktion. Sie pausiert mit dem Spiel. Ebenen-Effekte werden mit der
Anzahl gleichzeitig gelöschter Ebenen kräftiger; vier Ebenen erhalten eine
eigene Fanfare. Bei Game Over erklingt eine absteigende Melodie.
Effekte bleiben bei ausgeschalteter Musik hörbar, beim Neustart werden laufende
Effekte beendet. Alles wird lokal mit Web Audio synthetisiert.

## Entwicklung

`npm test` prüft räumliche Kollisionen, Rotation, Ebenenlöschung, Punkte, Hold,
Game Over und Audiosynthese. `engine.js` enthält die vom Rendering unabhängigen
Regeln, `game.js` die Three.js-Darstellung und Eingaben, `audio.js` die Musik
und Soundeffekte. Three.js: MIT-Lizenz, siehe `lib/THREE-LICENSE.txt`.
