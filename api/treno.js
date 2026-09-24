export default async function handler(req, res) {
    // Abilita CORS per permettere al tuo front-end di chiamare l'API
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
        // 1. Cerca il treno per ottenere ID e stazione di origine
        const resCerca = await fetch(`https://www.viaggiatreno.it/vt_pax_internet/rest/viaggiatreno/cercaNumeroTreno/${numeroTreno}`);
        const contenutoCerca = await resCerca.json();

        if (!contenutoCerca || contenutoCerca === -1 || (Array.isArray(contenutoCerca) && contenutoCerca.length === 0)) {
            return res.status(404).json({ attivo: false, messaggio: "Treno non attivo" });
        }

        const trenoInfo = Array.isArray(contenutoCerca) ? contenutoCerca[0] : contenutoCerca;
        const idTreno = trenoInfo.id || trenoInfo;
        const idStazione = trenoInfo.idStazioneOrigine || '';

        // 2. Ottiene i dettagli completi del treno
        const resDettaglio = await fetch(`https://www.viaggiatreno.it/vt_pax_internet/rest/viaggiatreno/andamentoTreno/${idStazione}/${numeroTreno}/${idTreno}`);
        const treno = await resDettaglio.json();

        return res.status(200).json(treno);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Errore nel recupero dati da ViaggiaTreno' });
    }
}