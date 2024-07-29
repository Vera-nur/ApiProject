
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const port = 3000;

const pool = new Pool({
    user: 'admin',
    host: 'localhost',
    database: 'rahat_db',
    password: '1234',
    port: 5432,
});


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json());

app.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT hesap_kodu, borc FROM hesaplar');
        const data = {};

        result.rows.forEach(row => {
            const keys = row.hesap_kodu.split('.');
            let currentLevel = data;
            keys.forEach((key, index) => {
                if (!currentLevel[key]) {
                    currentLevel[key] = { borc: 0, children: {} };
                }
                if (index === keys.length - 1) {
                    currentLevel[key].borc = parseFloat(row.borc) || 0;
                }
                currentLevel = currentLevel[key].children;
            });
        });

        // Borçları üst seviyeye taşıma
        function assignParentDebt(data) {
            Object.keys(data).forEach(key => {
                if (Object.keys(data[key].children).length > 0) {
                    assignParentDebt(data[key].children);
                    data[key].borc = Object.keys(data[key].children).reduce((total, childKey) => {
                        return total + (data[key].children[childKey].borc || 0);
                    }, 0);
                }
            });
        }

        assignParentDebt(data);

        res.render('index', { data: data });
    } catch (err) {
        console.error(err);
        res.send('Error fetching data');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});