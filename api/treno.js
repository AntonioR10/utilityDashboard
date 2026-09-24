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

    const { numeroTreno } = req.query || '12734';

    try {
        const url = `http://www.viaggiatreno.it/vt_pax_internet/mobile/numero?numeroTreno=${numeroTreno}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const html = await response.text();

        // STAMPA NEI LOG DI VERCEL
        console.log("HTML RICEVUTO DA VIAGGIATRENO:", html);

        // RESTITUISCE L'HTML DIRETTAMENTE AL BROWSER (o puoi vederlo aprendo l'API da browser)
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);

    } catch (error) {
        console.error('Errore:', error);
        return res.status(500).json({ error: error.message });
    }
}