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
        return res.status(200).end();
    }

    const { numeroTreno } = req.query;

    if (!numeroTreno) {
        return res.status(400).json({ error: 'Specificare il numero del treno.' });
    }

    // Header per simulare una richiesta da browser ed evitare blocchi
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
    };

    try {
        // 1. Ricerca del treno (usando HTTPS)
        const cercaRes = await fetch(`https://www.viaggiatreno.it/viaggiatrenonew/resteval/cercaNumeroTreno/${numeroTreno}`, { headers });

        if (!cercaRes.ok) {
            throw new Error(`Errore di rete ViaggiaTreno (Stato: ${cercaRes.status})`);
        }

        const textData = await cercaRes.text();
        if (!textData) {
            return res.status(404).json({ error: 'Nessuna risposta ricevuta da ViaggiaTreno.' });
        }

        const cercaData = JSON.parse(textData);
        const trenoInfo = Array.isArray(cercaData) ? cercaData[0] : cercaData;

        if (!trenoInfo || !trenoInfo.codLocOrig || !trenoInfo.id) {
            return res.status(404).json({ error: 'Treno non trovato o dati incompleti.' });
        }

        const idStazioneOrigine = trenoInfo.codLocOrig;
        const idTreno = trenoInfo.id;

        // 2. Chiamata all'andamento reale del treno (usando HTTPS)
        const andamentoRes = await fetch(`https://www.viaggiatreno.it/viaggiatrenonew/resteval/andamentoTreno/${idStazioneOrigine}/${idTreno}`, { headers });

        if (!andamentoRes.ok) {
            throw new Error("Errore nel recupero dell'andamento del treno");
        }

        const andamentoData = await andamentoRes.json();

        return res.status(200).json(andamentoData);

    } catch (error) {
        console.error('Errore API Treno:', error);
        return res.status(500).json({ error: error.message || 'Errore interno del server.' });
    }
}