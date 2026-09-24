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

        const partProg = matchValore('Partenza programmata\\s*:\\s*<br\\s*/?>\\s*<strong>\\s*([0-9:]+)');
        const partEff = matchValore('Partenza effettiva\\s*:\\s*<br\\s*/?>\\s*<strong>([0-9:]+)');

        const binPrevPart = matchValore('Binario\\s*Previsto\\s*:\\s*<br[^>]*>\\s*([0-9A-Za-z-]+)');
        const binRealePart = matchValore('Binario\\s*Reale\\s*:\\s*<br[^>]*>\\s*<strong>([0-9A-Za-z-]+)</strong>');

        const arrProg = matchValore('Arrivo Programmato\\s*:\\s*<br\\s*/?>\\s*<strong>\\s*([0-9:]+)');
        const arrEff = matchValore('Arrivo effettivo\\s*:\\s*<br\\s*/?>\\s*<strong>([0-9:]+)');

        const binPrevArr = matchValore('DESTINAZIONE.*?Binario\\s*Previsto\\s*:\\s*<br[^>]*>\\s*([0-9A-Za-z-]+)');
        const binRealeArr = matchValore('DESTINAZIONE.*?Binario\\s*Reale\\s*:\\s*<br[^>]*>\\s*<strong>([0-9A-Za-z-]+)</strong>');

        const matchStato = html.match(/<div\s+class="evidenziato"><strong>([\s\S]*?)<\/strong>/i);
        let statoTreno = matchStato ? matchStato[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : "In viaggio";

        // Otteniamo la data odierna in formato YYYY-MM-DD per renderla compatibile con new Date() nel frontend
        const oggiStringa = new Date().toISOString().split('T')[0];

        const oraP = partEff || partProg || "00:00";
        const oraA = arrEff || arrProg || "00:00";

        return res.status(200).json({
            attivo: true,
            compStatoTreno: statoTreno,
            // Passiamo una stringa di data completa (es. "2026-06-06T10:38:00") per evitare l'errore "Invalid Date"
            orarioPartenza: oraP !== "--:--" ? `${oggiStringa}T${oraP}:00` : null,
            orarioArrivo: oraA !== "--:--" ? `${oggiStringa}T${oraA}:00` : null,
            binarioRealPartenzaDescrizione: binRealePart !== '-' ? binRealePart : (binPrevPart !== '-' ? binPrevPart : "-"),
            binarioRealArrivoDescrizione: binRealeArr !== '-' ? binRealeArr : (binPrevArr !== '-' ? binPrevArr : "-")
        });

    } catch (error) {
        console.error('Errore durante il parsing:', error);
        return res.status(500).json({ error: error.message });
    }
}