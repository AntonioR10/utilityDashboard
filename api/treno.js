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
        // Chiamata alla versione mobile che funziona sempre
        const url = `http://www.viaggiatreno.it/vt_pax_internet/mobile/numero?numeroTreno=${numeroTreno}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error('Impossibile contattare ViaggiaTreno mobile');
        }

        const html = await response.text();

        // Funzione di supporto per estrarre i dati testuali dall'HTML tramite regex
        const extract = (regex) => {
            const match = html.match(regex);
            return match ? match[1].trim() : '-';
        };

        // Estrazione dei dati principali visibili nella pagina
        const datiTreno = {
            numero: numeroTreno,
            origine: extract(/Partenza programmata\s*:\s*<\/strong><br\s*\/?>\s*([^<]+)/i) || extract(/Partenza programmata\s*:\s*([0-9:]+)/i),
            // Puliamo e strutturiamo i campi chiave
            partenzaProgrammata: extract(/Partenza programmata\s*:\s*<\/span>([0-9:]+)/i),
            partenzaEffettiva: extract(/Partenza effettiva\s*:\s*<\/span>([0-9:]+)/i),
            binarioPrevistoPartenza: extract(/Binario Previsto\s*:\s*<\/span>([0-9-]+)/i),
            binarioRealePartenza: extract(/Binario Reale\s*:\s*<\/span>([0-9-]+)/i),

            arrivoProgrammato: extract(/Arrivo Programmato\s*:\s*<\/span>([0-9:]+)/i),
            arrivoEffettivo: extract(/Arrivo effettivo\s*:\s*<\/span>([0-9:]+)/i),
            binarioPrevistoArrivo: extract(/Binario Previsto\s*:\s*<\/span>([0-9-]+)/i) ?? extract(/Arrivo.*?Binario Previsto\s*:\s*([0-9-]+)/s),
            binarioRealeArrivo: extract(/Binario Reale\s*:\s*<\/span>([0-9-]+)/i),

            messaggioRitardo: extract(/(Il treno e' arrivato con[^<]+|Il treno risulta[^<]+|In orario[^<]*)/i)
        };

        // Se la pagina contiene un errore classico di treno inesistente
        if (html.includes("non trovato") || html.includes("Errore")) {
            return res.status(404).json({ error: 'Treno non trovato o non disponibile.' });
        }

        return res.status(200).json(html); // Per ora puoi anche restituire l'html o testare l'estrazione

    } catch (error) {
        console.error('Errore:', error);
        return res.status(500).json({ error: 'Errore interno del server.' });
    }
}