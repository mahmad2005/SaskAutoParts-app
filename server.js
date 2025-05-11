require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(express.json()); // ✅ Enable JSON body parsing for API requests

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Main webpage route with dropdown filters and pagination
app.get('/', (req, res) => {
  const { make, model, year, page = 1 } = req.query;
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (make) {
    conditions.push('car_make = ?');
    params.push(make);
  }
  if (model) {
    conditions.push('car_model = ?');
    params.push(model);
  }
  if (year) {
    conditions.push('make_year = ?');
    params.push(year);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const mainQuery = `
    SELECT * FROM parts
    ${whereClause}
    LIMIT ? OFFSET ?
  `;

  const countQuery = `SELECT COUNT(*) as count FROM parts ${whereClause}`;

  const makeQuery = 'SELECT DISTINCT car_make FROM parts';
  const modelQuery = 'SELECT DISTINCT car_model FROM parts';
  const yearQuery = 'SELECT DISTINCT make_year FROM parts ORDER BY make_year';

  // Sequentially fetch dropdown values and results
  pool.query(makeQuery, (err, makes) => {
    if (err) return res.send(err);

    pool.query(modelQuery, (err, models) => {
      if (err) return res.send(err);

      pool.query(yearQuery, (err, years) => {
        if (err) return res.send(err);

        pool.query(countQuery, params, (err, countResult) => {
          if (err) return res.send(err);

          const total = countResult[0].count;
          const totalPages = Math.ceil(total / limit);

          pool.query(mainQuery, [...params, limit, offset], (err, rows) => {
            if (err) return res.send(err);

            res.render('index', {
              parts: rows,
              makes,
              models,
              years,
              selected: { make, model, year },
              page: Number(page),
              totalPages
            });
          });
        });
      });
    });
  });
});

// Health and test routes
app.get('/ping', (req, res) => {
  res.send('✅ Server is running!');
});

app.get('/test-db', (req, res) => {
  pool.query('SELECT 1', (err, results) => {
    if (err) {
      return res.status(500).send('❌ DB connection failed: ' + err.message);
    }
    res.send('✅ DB connection successful!');
  });
});

// ✅ Gemini / Twilio: Secure API endpoint for part lookup
app.post('/api/parts-query', (req, res) => {
  const { car_make, car_model, make_year, part_name } = req.body;

  if (!car_make || !car_model || !make_year || !part_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  pool.query(
    `SELECT quantity, price_cad FROM parts 
     WHERE car_make = ? AND car_model = ? AND make_year = ? AND part_name = ?`,
    [car_make, car_model, make_year, part_name],
    (err, results) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        return res.json({ available: false, message: 'Not found' });
      }

      const { quantity, price_cad } = results[0];
      return res.json({ available: true, quantity, price_cad });
    }
  );
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
