const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const ejs = require('ejs');
const fetchData = require('./fetchData'); // fetchData fonksiyonunu içeri aktar

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const createTableQuery = `
CREATE TABLE IF NOT EXISTS hesaplar (
    hesap_kodu VARCHAR(255) PRIMARY KEY,
    borc NUMERIC,
    alacak NUMERIC
);
`;

async function createTable() {
    try {
        await pool.query(createTableQuery);
        console.log('Table created successfully');
    } catch (err) {
        console.error('Error creating table:', err);
    }
}

createTable();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json());

function renderTable(data, prefix) {
    let html = '';
    for (const key in data) {
        html += `
            <tr>
                <td>
                    <button onclick="toggleVisibility('${prefix}${key}')">+</button> ${prefix}${key}
                </td>
                <td>${data[key].borc}</td>
            </tr>
        `;
        if (Object.keys(data[key].children).length > 0) {
            html += `
                <tr class="${prefix}${key} hidden">
                    <td colspan="2">
                        <table>
                            <tbody>
                                ${renderTable(data[key].children, `${prefix}${key}.`)}
                            </tbody>
                        </table>
                    </td>
                </tr>
            `;
        }
    }
    return html;
}

app.get('/', async (req, res) => {
    try {
        await fetchData(); // Verileri çek ve veritabanına ekle

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

        res.render('index', { data: data, renderTable: renderTable });
    } catch (err) {
        console.error(err);
        res.send('Error fetching data');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});