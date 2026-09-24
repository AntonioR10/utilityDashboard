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
            return res.status(200).json({ attivo: false, messaggio: "Treno non trovato o non attivo" });
        }

        // Funzione helper per ripulire i tag HTML ed estrarre i testi
        const extractField = (regex) => {
            const match = html.match(regex);
            return match ? match[1].replace(/<[^>]*>/g, '').trim() : null;
        };

        // Estrazione dati dalla pagina mobile di ViaggiaTreno
        const partProg = extractField(/Partenza programmata\s*:\s*<\/strong><br\s*\/?>\s*([0-9:]+)/i) || extractField(/Partenza programmata\s*:\s*([0-9:]+)/i);
        const partEff = extractField(/Partenza effettiva\s*:\s*<\/strong><br\s*\/?>\s*([0-9:]+)/i) || extractField(/Partenza effettiva\s*:\s*([0-9:]+)/i);
        const binPrev = extractField(/Binario Previsto\s*:\s*<\/strong><br\s*\/?>\s*([0-9A-Za-z-]+)/i) || extractField(/Binario Previsto\s*:\s*([0-9A-Za-z-]+)/i);
        const binReale = extractField(/Binario Reale\s*:\s*<\/strong><br\s*\/?>\s*([0-9A-Za-z-]+)/i) || extractField(/Binario Reale\s*:\s*([0-9A-Za-z-]+)/i);

        const arrProg = extractField(/Arrivo Programmato\s*:\s*<\/strong><br\s*\/?>\s*([0-9:]+)/i) || extractField(/Arrivo Programmato\s*:\s*([0-9:]+)/i);
        const arrEff = extractField(/Arrivo effettivo\s*:\s*<\/strong><br\s*\/?>\s*([0-9:]+)/i) || extractField(/Arrivo effettivo\s*:\s*([0-9:]+)/i);

        // Stato del treno o eventuale ritardo scritto in fondo
        const matchRitardo = html.match(/(Il treno e' arrivato con[^<]+|Il treno risulta[^<]+|In orario[^<]*|Il treno viaggia[^<]*)/i);
        let statoTreno = matchRitardo ? matchRitardo[0].replace(/<[^>]*>/g, '').trim() : "In viaggio";

        return res.status(200).json({
            attivo: true,
            compStatoTreno: statoTreno,
            orarioPartenza: partEff || partProg || "--:--",
            orarioArrivo: arrEff || arrProg || "--:--",
            binarioRealPartenzaDescrizione: binReale || binPrev || "-",
            stazioneUltimoRilevamento: "Aggiornato"
        });

    } catch (error) {
        console.error('Errore:', error);
        return res.status(500).json({ error: error.message });
    }
}