export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { numeroTreno } = req.query;

    if (!numeroTreno) {
        return res.status(400).json({ error: 'Manca il parametro numeroTreno' });
    }

    // Intestazioni per simulare una richiesta da browser ed evitare blocchi HTML
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    };

    try {
        // 1. Cerca il treno
        const urlCerca = `https://www.viaggiatreno.it/vt_pax_internet/rest/viaggiatreno/cercaNumeroTreno/${numeroTreno}`;
        const resCerca = await fetch(urlCerca, { headers });

        const testoCerca = await resCerca.text();

        // Controlla se ViaggiaTreno ha risposto con dell'HTML anziché JSON
        if (!testoCerca || testoCerca.startsWith('<') || testoCerca === "-1") {
            return res.status(200).json({ attivo: false, messaggio: "Non attivo o bloccato" });
        }

        const contenutoCerca = JSON.parse(testoCerca);

        if (!contenutoCerca || contenutoCerca === -1 || (Array.isArray(contenutoCerca) && contenutoCerca.length === 0)) {
            return res.status(200).json({ attivo: false, messaggio: "Non attivo" });
        }

        const trenoInfo = Array.isArray(contenutoCerca) ? contenutoCerca[0] : contenutoCerca;
        const idTreno = trenoInfo.id || trenoInfo;
        const idStazione = trenoInfo.idStazioneOrigine || '';

        if (!idTreno || !idStazione) {
            return res.status(200).json({ attivo: false, messaggio: "Non attivo" });
        }

        // 2. Prendi i dettagli del treno
        const urlDettaglio = `https://www.viaggiatreno.it/vt_pax_internet/rest/viaggiatreno/andamentoTreno/${idStazione}/${numeroTreno}/${idTreno}`;
        const resDettaglio = await fetch(urlDettaglio, { headers });
        const testoDettaglio = await resDettaglio.text();

        if (!testoDettaglio || testoDettaglio.startsWith('<')) {
            throw new Error("Risposta non valida da ViaggiaTreno (dettaglio)");
        }

        const treno = JSON.parse(testoDettaglio);

        return res.status(200).json({
            attivo: true,
            compStatoTreno: treno.compStatoTreno || "",
            itinerario: treno.itinerario || false,
            orarioPartenza: treno.orarioPartenza || null,
            orarioArrivo: treno.orarioArrivo || null,
            binarioRealPartenzaDescrizione: treno.binarioRealPartenzaDescrizione || null,
            binarioPrevistoPartenzaDescrizione: treno.binarioPrevistoPartenzaDescrizione || null,
            stazioneUltimoRilevamento: treno.stazioneUltimoRilevamento || "In partenza",
            provvedimento: treno.provvedimento || 0
        });

    } catch (error) {
        console.error("Errore serverless:", error);
        return res.status(500).json({ error: error.message });
    }
}