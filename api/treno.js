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

    try {
        // 1. Cerca il treno
        const urlCerca = `https://www.viaggiatreno.it/vt_pax_internet/rest/viaggiatreno/cercaNumeroTreno/${numeroTreno}`;
        const resCerca = await fetch(urlCerca);

        if (!resCerca.ok) {
            throw new Error("Errore nella richiesta a ViaggiaTreno (cerca)");
        }

        const testoCerca = await resCerca.text();
        if (!testoCerca || testoCerca.trim() === "" || testoCerca === "-1") {
            return res.status(200).json({ attivo: false, messaggio: "Non attivo" });
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
        const resDettaglio = await fetch(urlDettaglio);

        if (!resDettaglio.ok) {
            throw new Error("Errore nel recupero dettagli treno");
        }

        const treno = await resDettaglio.json();

        if (!treno || !treno.codiceStazionePartenza) {
            return res.status(200).json({ attivo: false, messaggio: "Non attivo" });
        }

        // Restituisce l'oggetto pulito
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