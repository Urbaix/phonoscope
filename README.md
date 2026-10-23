# PHONOSCOPE

Retro-Audio-Visualizer als Web-App (PWA) für das iPad. 31 Terzbänder, Peak-Hold, Look eines PC-Musikplayers der späten 90er.

Stand v1: Modus BALKEN, alle Farbthemen, Einstellungen, offline nutzbar. Die übrigen Modi folgen.

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
- **EINST.:** Empfindlichkeit (±20 dB), Helligkeit, Glätte (Abfallzeit der Balken), Eingang, Nachtmodus.
- Alle Einstellungen bleiben auf dem Gerät gespeichert.

## Updates

Die App startet aus dem Offline-Speicher und lädt Neuerungen im Hintergrund. Nach einem Update die App einmal schließen (vom App-Umschalter wegwischen) und neu öffnen, ggf. zweimal.

## Technik

- Reines HTML/CSS/JS, keine Abhängigkeiten. Web Audio API (`AnalyserNode`, FFT 8192) und Canvas.
- Terzbänder: Leistung der FFT-Bins je Band (ISO-Mitten 20 Hz bis 20 kHz) aufsummiert. Unter ca. 40 Hz ist die Auflösung grob, benachbarte Bänder ähneln sich dort.
- Schrift VT323 (SIL Open Font License, `fonts/OFL.txt`), lokal eingebunden.
- Icons neu erzeugen: `python3 tools/make_icons.py` (braucht Pillow).
- Lokal testen: `python3 -m http.server` im Repo, dann `http://localhost:8000`.
- Bei Änderungen an Dateien die Versionsnummer `CACHE` in `sw.js` erhöhen.
- `phonoscope-mockup.html` ist die Design-Vorlage mit simulierten Daten.
