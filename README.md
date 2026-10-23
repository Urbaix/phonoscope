# PHONOSCOPE

Retro-Audio-Visualizer als Web-App (PWA) für das iPad. 31 Terzbänder, Peak-Hold, Look eines PC-Musikplayers der späten 90er.

## Modi

- **BALKEN:** 31 Terzbänder mit Peak-Hold
- **WELLE:** symmetrisch von der Mitte nach oben und unten
- **PUNKTE:** nur Spitze und gehaltener Peak je Band
- **WASSERFALL:** Spektrum läuft als Farbverlauf von oben nach unten durch (ca. 6 Sekunden sichtbar)
- **OSZILLOSKOP:** Wellenform (L+R) als Leuchtspur mit Nachleuchten, getriggert
- **GONIOMETER:** L/R als XY-Darstellung, um 45° gedreht (Mono = senkrechte Linie), mit Nachleuchten
- **VU ANALOG:** zwei Zeigerinstrumente L/R, Skala -20 bis +3 VU, Zeigerträgheit nach VU-Norm (99 % nach ca. 300 ms)
- **VU LED:** zwei horizontale Segmentbalken L/R mit Peak-Hold
- **KOMBI:** ein VU-Instrument mit Doppelzeiger (L schwarz, R rot) links, Spektrum rechts
- **UHR:** 7-Segment-Ziffern mit Sekunden

## Skins

- **90ER PC:** dunkelgraues Gehäuse mit Fase, grünes LCD (Standard)
- **TECHNICS SILBER:** gebürstetes Alu, schwarze Displayfläche, Receiver-Tasten mit Kontrollleuchte (eigenes Design, kein Markenlogo)
- **HOLZ 70ER:** Walnuss-Seitenteile, Bernstein-Beleuchtung, VU-Skalen bernsteinfarben. Beim Wechsel auf diesen Skin wird die Farbe auf Bernstein gestellt, falls noch Türkis gewählt war.

Die App ist für das Querformat gestaltet.

## 1. GitHub Pages einschalten (einmalig, vom iPad oder iPhone)

Die GitHub-App kann Pages nicht einstellen. Alles läuft in Safari.

1. **Pull Request mergen**
   1. Safari öffnen: `https://github.com/Urbaix/phonoscope/pulls`
   2. Den PR von `claude/phonoscope-audio-visualizer-m9swxk` antippen.
   3. Nach unten scrollen, **Merge pull request** antippen, dann **Confirm merge**.
   (Das geht auch in der GitHub-App: PR öffnen, unten **Merge**.)
2. **Pages aktivieren**
   1. In Safari direkt öffnen: `https://github.com/Urbaix/phonoscope/settings/pages`
      (Wenn nur die Mobilansicht ohne Einstellungen erscheint: in der Adressleiste auf das Symbol links tippen und **Desktop-Website anfordern** wählen.)
   2. Unter **Build and deployment** bei **Source** die Option **Deploy from a branch** wählen.
   3. Bei **Branch** auf **None** tippen, **main** wählen. Daneben den Ordner **/ (root)** lassen.
   4. **Save** antippen.
3. **Warten**
   1. Ein bis zwei Minuten warten, dann die Seite neu laden.
   2. Oben erscheint **Your site is live at** `https://urbaix.github.io/phonoscope/`.
   3. Fortschritt sieht man unter `https://github.com/Urbaix/phonoscope/actions` (Eintrag *pages build and deployment*, grüner Haken = fertig).

Jeder weitere Merge nach `main` veröffentlicht automatisch neu.

## 2. Auf den Home-Bildschirm legen (iPad)

1. In Safari `https://urbaix.github.io/phonoscope/` öffnen.
2. Teilen-Symbol antippen (Quadrat mit Pfeil nach oben). Bei neueren iPadOS-Versionen steckt es ggf. im Menü **•••** neben der Adressleiste.
3. **Zum Home-Bildschirm** wählen. Prüfen, dass **Als Web-App öffnen** eingeschaltet ist (falls angezeigt).
4. Name PHONOSCOPE lassen, **Hinzufügen** antippen.
5. App über das neue Icon starten, auf **TIPPEN ZUM STARTEN** tippen und den Mikrofonzugriff erlauben.

## 3. iPad einrichten

- **Display anlassen:** Einstellungen > Anzeige & Helligkeit > Automatische Sperre > **Nie**. Die App fordert zusätzlich einen Wake Lock an.
- **Querformat:** Eine Web-App kann die Ausrichtung auf dem iPad nicht sperren. Ausrichtungssperre im Kontrollzentrum im Querformat aktivieren.
- **Mikrofon dauerhaft erlauben:** Fragt iOS bei jedem Start erneut, hilft meist: Einstellungen > Apps > Safari > Mikrofon > **Erlauben**. Ganz abschalten lässt sich die Nachfrage bei Web-Apps nicht immer.
- **USB-Audio-Interface:** Einstecken, iOS nimmt es automatisch als Eingang. In der App unter EINST. > EINGANG prüfen. Unten links zeigt die App den Eingangsnamen und MONO oder STEREO.

## Bedienung

- Tippen holt das Bedienfeld zurück, nach 5 Sekunden blendet es aus. `_` in der Titelleiste blendet es sofort aus.
- Wischen nach links: nächster Modus, nach rechts: vorheriger Modus.
- **EINST.:** Skin, Auto-Pegel, Empfindlichkeit, Helligkeit, Glätte (Abfallzeit der Balken), Eingang, Nachtmodus.
- **Auto-Pegel** (Standard: ein): passt die Anzeige gleitend an die Lautstärke der letzten Sekunden an, für alle Modi. Rechts daneben steht die aktuelle Anhebung. Die **Empfindlichkeit** (±40 dB) wirkt zusätzlich, bei ausgeschaltetem Auto-Pegel allein.
- Alle Einstellungen bleiben auf dem Gerät gespeichert.

## Updates

Die App startet aus dem Offline-Speicher und lädt Neuerungen im Hintergrund. Nach einem Update die App einmal schließen (vom App-Umschalter wegwischen) und neu öffnen, ggf. zweimal.

## Technik

- Reines HTML/CSS/JS, keine Abhängigkeiten. Web Audio API (`AnalyserNode`, FFT 8192) und Canvas.
- Terzbänder: Leistung der FFT-Bins je Band (ISO-Mitten 20 Hz bis 20 kHz) aufsummiert. Unter ca. 40 Hz ist die Auflösung grob, benachbarte Bänder ähneln sich dort.
- VU-Bezug: 0 VU entspricht -20 dBFS RMS bei Empfindlichkeit 0 ohne Auto-Pegel. Der Auto-Pegel zielt auf -23 dBFS RMS (Nadel um -3 VU), regelt in 1,5 s herunter und in 5 s herauf, bei Stille (unter -80 dBFS) gar nicht. Liefert der Eingang nur Mono, zeigen L und R dasselbe.
- Schrift VT323 (SIL Open Font License, `fonts/OFL.txt`), lokal eingebunden.
- Icons neu erzeugen: `python3 tools/make_icons.py` (braucht Pillow).
- Lokal testen: `python3 -m http.server` im Repo, dann `http://localhost:8000`.
- Bei Änderungen an Dateien die Versionsnummer `CACHE` in `sw.js` erhöhen.
- `phonoscope-mockup.html` ist die Design-Vorlage mit simulierten Daten.
