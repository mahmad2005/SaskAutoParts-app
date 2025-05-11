require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.set('view engine', 'ejs');

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

// Main route
/* app.get('/', (req, res) => {
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

  // Execute the queries sequentially
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
}); */

// Simple ping to verify server is alive
app.get('/', (req, res) => {
  res.send('✅ Main Page is running!');
});


// Simple ping to verify server is alive
app.get('/ping', (req, res) => {
  res.send('✅ Server is running!');
});

// Optional: Test database connection too
app.get('/test-db', (req, res) => {
  pool.query('SELECT 1', (err, results) => {
    if (err) {
      return res.status(500).send('❌ DB connection failed: ' + err.message);
    }
    res.send('✅ DB connection successful!');
  });
});



app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
