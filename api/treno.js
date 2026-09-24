export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { numeroTreno } = req.query;

    if (!numeroTreno) {
        return res.status(400).json({ error: 'Specificare il numero del treno.' });
    }

    try {
        const url = `http://www.viaggiatreno.it/vt_pax_internet/mobile/numero?numeroTreno=${numeroTreno}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error('Impossibile contattare ViaggiaTreno');
        }

        const html = await response.text();

        if (html.includes("non trovato") || html.includes("Errore")) {
            return res.status(200).json({ attivo: false, compStatoTreno: "Treno non trovato" });
        }

        // Funzione di utilità per estrarre il testo dentro un blocco specifico dell'HTML
        const extractSection = (htmlString, startComment, endComment) => {
            const startIndex = htmlString.indexOf(startComment);
            if (startIndex === -1) return "";
            const subStr = htmlString.substring(startIndex);
            const endIndex = endComment ? subStr.indexOf(endComment) : subStr.length;
            return endIndex !== -1 ? subStr.substring(0, endIndex) : subStr;
        };

        // Estraiamo le sezioni chiave delimitate dai commenti HTML originali
        const sezioneOrigine = extractSection(html, "<!-- ORIGINE -->", "<!-- ULTIMA FERMATA -->");
        const sezioneUltimaFermata = extractSection(html, "<!-- ULTIMA FERMATA -->", "<!-- LINK DETTAGLIO FERMATE -->");
        const sezioneDestinazione = extractSection(html, "<!-- DESTINAZIONE -->", "<!-- SITUAZIONE -->");

        // Helper per trovare l'h2 e i valori all'interno di una sezione
        const getH2 = (section) => {
            const match = section.match(/<h2>(.*?)<\/h2>/i);
            return match ? match[1].replace(/<[^>]*>/g, '').trim() : null;
        };

        const matchValoreInSezione = (section, pattern) => {
            const regex = new RegExp(pattern, 'i');
            const match = section.match(regex);
            return match ? match[1].replace(/<[^>]*>/g, '').trim() : null;
        };

        // 1. Origine
        const stazionePartenzaTreno = getH2(sezioneOrigine) || "ROMA TERMINI";
        const partProg = matchValoreInSezione(sezioneOrigine, 'Partenza programmata\\s*:\\s*<br\\s*/?>\\s*<strong>\\s*([0-9:]+)');
        const partEff = matchValoreInSezione(sezioneOrigine, 'Partenza effettiva\\s*:<br\\s*/?>\\s*<strong>([0-9:]+)');
        const binRealePart = matchValoreInSezione(sezioneOrigine, 'Binario\\s*Reale\\s*:<br\\s*[^>]*>\\s*<strong>([0-9A-Za-z-]+)</strong>');
        const binPrevPart = matchValoreInSezione(sezioneOrigine, 'Binario\\s*Previsto\\s*:<br\\s*[^>]*>\\s*([0-9A-Za-z-]+)');

        // 2. Ultima Fermata (se presente nell'HTML)
        let ultimaFermataDescrizione = "In partenza";
        if (sezioneUltimaFermata.includes("corpocentrale")) {
            const h2Fermata = getH2(sezioneUltimaFermata);
            if (h2Fermata) {
                ultimaFermataDescrizione = h2Fermata;
            }
        }

        // 3. Destinazione Finale
        const stazioneArrivoTreno = getH2(sezioneDestinazione) || "MINTURNO-SCAURI";
        const arrProg = matchValoreInSezione(sezioneDestinazione, 'Arrivo Programmato\\s*:<br\\s*/?>\\s*<strong>\\s*([0-9:]+)');
        const arrPrev = matchValoreInSezione(sezioneDestinazione, 'Arrivo previsto\\s*:<br\\s*/?>\\s*<strong>([0-9:]+)');

        // 4. Stato del treno
        const matchStato = html.match(/<div\s+class="evidenziato"><strong>([\s\S]*?)<\/strong>/i);
        let statoTreno = matchStato ? matchStato[1].replace(/<[^>]*>/g, '').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim() : "In viaggio";

        const oggiStringa = new Date().toISOString().split('T')[0];
        const oraP = partEff || partProg || "00:00";
        const oraA = arrPrev || arrProg || "00:00";

        return res.status(200).json({
            attivo: true,
            compStatoTreno: statoTreno,
            orarioPartenza: oraP !== "--:--" ? `${oggiStringa}T${oraP}:00` : null,
            orarioArrivo: oraA !== "--:--" ? `${oggiStringa}T${oraA}:00` : null,
            binarioRealPartenzaDescrizione: binRealePart !== '--' ? binRealePart : (binPrevPart || "-"),
            binarioRealArrivoDescrizione: "-",
            stazionePartenza: stazionePartenzaTreno,
            stazioneArrivo: stazioneArrivoTreno,
            ultimaFermata: ultimaFermataDescrizione
        });

    } catch (error) {
        console.error('Errore durante il parsing:', error);
        return res.status(500).json({ error: error.message });
    }
}