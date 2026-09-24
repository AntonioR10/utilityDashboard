export default async function handler(req, res) {
    // Gestione CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Se è una richiesta preflight OPTIONS, interrompiamo qui
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { numeroTreno } = req.query;

    if (!numeroTreno) {
        return res.status(400).json({ error: 'Specificare il numero del treno.' });
    }

    try {
        // 1. Ricerca del treno per ottenere gli identificativi (ID e Stazione Origine)
        const cercaRes = await fetch(`http://www.viaggiatreno.it/viaggiatrenonew/resteval/cercaNumeroTreno/${numeroTreno}`);
        if (!cercaRes.ok) {
            throw new Error('Impossibile contattare il servizio ViaggiaTreno');
        }

        const cercaData = await cercaRes.json();

        // ViaggiaTreno a volte restituisce un array o un oggetto diretto
        const trenoInfo = Array.isArray(cercaData) ? cercaData[0] : cercaData;

        if (!trenoInfo || !trenoInfo.codLocOrig || !trenoInfo.id) {
            return res.status(404).json({ error: 'Treno non trovato o dati incompleti.' });
        }

        const idStazioneOrigine = trenoInfo.codLocOrig;
        const idTreno = trenoInfo.id;

        // 2. Chiamata all'andamento reale del treno
        const andamentoRes = await fetch(`http://www.viaggiatreno.it/viaggiatrenonew/resteval/andamentoTreno/${idStazioneOrigine}/${idTreno}`);
        if (!andamentoRes.ok) {
            throw new Error("Errore nel recupero dell'andamento del treno");
        }

        const andamentoData = await andamentoRes.json();

        // Restituiamo i dati ripuliti al client
        return res.status(200).json(andamentoData);

    } catch (error) {
        console.error('Errore API Treno:', error);
        return res.status(500).json({ error: 'Errore interno del server durante il recupero del treno.' });
    }
}