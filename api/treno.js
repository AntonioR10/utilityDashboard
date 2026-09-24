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

        const matchValore = (pattern) => {
            const regex = new RegExp(pattern, 'i');
            const match = html.match(regex);
            return match ? match[1].replace(/<[^>]*>/g, '').trim() : null;
        };

        // Estrazione delle stazioni tramite i tag <h2> all'interno dei corpocentrale
        const h2Matches = [...html.matchAll(/<div class="corpocentrale">\s*<h2[^>]*>(.*?)<\/h2>/gi)].map(m => m[1].replace(/<[^>]*>/g, '').trim());
        const stazionePartenzaTreno = h2Matches[0] || "Minturno-Scauri";
        const stazioneArrivoTreno = h2Matches[1] || "Roma Termini";

        // Estrazione degli orari di partenza e arrivo (effettivi o programmati)
        const partProg = matchValore('Partenza programmata\\s*:\\s*<br\\s*/?>\\s*<strong>\\s*([0-9:]+)');
        const partEff = matchValore('Partenza effettiva\\s*:\\s*<br\\s*/?>\\s*<strong>([0-9:]+)');
        const arrProg = matchValore('Arrivo Programmato\\s*:\\s*<br\\s*/?>\\s*<strong>\\s*([0-9:]+)');
        const arrEff = matchValore('Arrivo effettivo\\s*:\\s*<br\\s*/?>\\s*<strong>([0-9:]+)');

        // Binari
        const binPrevPart = matchValore('Binario\\s*Previsto\\s*:\\s*<br[^>]*>\\s*([0-9A-Za-z-]+)');
        const binRealePart = matchValore('Binario\\s*Reale\\s*:\\s*<br[^>]*>\\s*<strong>([0-9A-Za-z-]+)</strong>');

        // Estrazione dello stato del treno dal blocco evidenziato in fondo
        const matchStato = html.match(/<div\s+class="evidenziato"><strong>([\s\S]*?)<\/strong>/i);
        let statoTreno = matchStato ? matchStato[1].replace(/<[^>]*>/g, '').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim() : "In viaggio";

        const oggiStringa = new Date().toISOString().split('T')[0];
        const oraP = partEff || partProg || "00:00";
        const oraA = arrEff || arrProg || "00:00";

        return res.status(200).json({
            attivo: true,
            compStatoTreno: statoTreno,
            orarioPartenza: oraP !== "--:--" ? `${oggiStringa}T${oraP}:00` : null,
            orarioArrivo: oraA !== "--:--" ? `${oggiStringa}T${oraA}:00` : null,
            binarioRealPartenzaDescrizione: binRealePart !== '-' ? binRealePart : (binPrevPart !== '-' ? binPrevPart : "-"),
            binarioRealArrivoDescrizione: "-",
            stazionePartenza: stazionePartenzaTreno,
            stazioneArrivo: stazioneArrivoTreno
        });

    } catch (error) {
        console.error('Errore durante il parsing:', error);
        return res.status(500).json({ error: error.message });
    }
}