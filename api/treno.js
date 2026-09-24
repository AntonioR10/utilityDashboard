export default async function handler(req, res) {
    // Gestione CORS
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

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Referer': 'https://www.viaggiatreno.it/'
    };

    try {
        const cercaRes = await fetch(`https://www.viaggiatreno.it/viaggiatrenonew/resteval/cercaNumeroTreno/${numeroTreno}`, { headers });

        if (!cercaRes.ok) {
            throw new Error(`Errore di rete ViaggiaTreno (Stato: ${cercaRes.status})`);
        }

        const textData = await cercaRes.text();

        // Controlliamo se ViaggiaTreno ha risposto con dell'HTML anziché JSON (es. blocco o manutenzione)
        if (textData.trim().startsWith('<!DOCTYPE') || textData.trim().startsWith('<html')) {
            console.error('Risposta HTML ricevuta da ViaggiaTreno:', textData.substring(0, 150));
            return res.status(502).json({
                error: 'Il servizio ViaggiaTreno ha bloccato la richiesta o restituito una pagina di errore.',
                raw: textData.substring(0, 100)
            });
        }

        const cercaData = JSON.parse(textData);
        const trenoInfo = Array.isArray(cercaData) ? cercaData[0] : cercaData;

        if (!trenoInfo || !trenoInfo.codLocOrig || !trenoInfo.id) {
            return res.status(404).json({ error: 'Treno non trovato o dati incompleti per questo numero.' });
        }

        const idStazioneOrigine = trenoInfo.codLocOrig;
        const idTreno = trenoInfo.id;

        const andamentoRes = await fetch(`https://www.viaggiatreno.it/viaggiatrenonew/resteval/andamentoTreno/${idStazioneOrigine}/${idTreno}`, { headers });

        if (!andamentoRes.ok) {
            throw new Error("Errore nel recupero dell'andamento del treno");
        }

        const andamentoText = await andamentoRes.text();
        if (andamentoText.trim().startsWith('<!DOCTYPE') || andamentoText.trim().startsWith('<html')) {
            return res.status(502).json({ error: "L'andamento del treno ha restituito una pagina HTML non valida." });
        }

        const andamentoData = JSON.parse(andamentoText);
        return res.status(200).json(andamentoData);

    } catch (error) {
        console.error('Errore API Treno:', error);
        return res.status(500).json({ error: error.message || 'Errore interno del server.' });
    }
}