require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');
const https = require('https');

// Sertifika doğrulamasını atlamak için HTTPS Agent oluşturma
const agent = new https.Agent({
    rejectUnauthorized: false
});

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function fetchData() {
    try {
        // Token alma
        const tokenResponse = await axios.post(process.env.TOKEN_URL, {}, {
            auth: {
                username: process.env.API_USER,
                password: process.env.API_PASS
            },
            headers: {
                'Content-Type': 'application/json'
            },
            httpsAgent: agent // HTTPS Agent ekleme
        });

        const token = tokenResponse.data.response.token;

        // Veri çekme
        const dataResponse = await axios.patch(process.env.DATA_URL, {
            fieldData: {},
            script: 'getData'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            httpsAgent: agent // HTTPS Agent ekleme
        });

        const data = JSON.parse(dataResponse.data.response.scriptResult);
        
        // Gelen verileri kontrol etmek için konsola yazdırma
        console.log('API Response Data:', data);

        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            for (const item of data) {
                const { hesap_kodu, borc, alacak } = item;

                // Boş değerleri kontrol ederek null olarak ayarlama
                const borcValue = borc !== '' ? borc : null;
                const alacakValue = alacak !== '' ? alacak : null;

                await client.query(
                    'INSERT INTO hesaplar (hesap_kodu, borc, alacak) VALUES ($1, $2, $3) ON CONFLICT (hesap_kodu) DO UPDATE SET borc = EXCLUDED.borc, alacak = EXCLUDED.alacak',
                    [hesap_kodu, borcValue, alacakValue]
                );
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

fetchData();