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



// Add a route for order placing 
app.post('/api/place-order', express.urlencoded({ extended: true }), (req, res) => {
  const { caller_name, caller_phone, part_id, part_name, order_quantity } = req.body;

  if (!caller_name || !caller_phone || !part_id || !part_name || !order_quantity) {
    return res.status(400).send('Missing required order fields.');
  }

  const query = `
    INSERT INTO orders (caller_name, caller_phone, part_id, part_name, order_quantity)
    VALUES (?, ?, ?, ?, ?)
  `;

  pool.query(query, [caller_name, caller_phone, part_id, part_name, order_quantity], (err, result) => {
    if (err) {
      console.error('Error inserting order:', err);
      return res.status(500).send('Order failed.');
    }

    res.redirect('/orders');
  });
});



//Add a page to view all orders
app.get('/orders', (req, res) => {
	const query = `
	  SELECT o.id, o.part_id, o.caller_name, o.caller_phone, o.part_name, o.order_quantity, o.order_date,
			 p.car_make, p.car_model, p.make_year
	  FROM orders o
	  LEFT JOIN parts p ON o.part_id = p.id
	  ORDER BY o.order_date DESC
	`;

  pool.query(query, (err, rows) => {
    if (err) {
      console.error('Failed to fetch orders:', err);
      return res.status(500).send('Database error');
    }

    res.render('orders', { orders: rows });
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

  const query = `
    SELECT id, quantity, price_cad
    FROM parts
    WHERE car_make = ? AND car_model = ? AND make_year = ? AND part_name = ?
    LIMIT 1
  `;

  pool.query(query, [car_make, car_model, make_year, part_name], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (results.length === 0) {
      return res.json({ available: false });
    }

    const part = results[0];
    return res.json({
      available: true,
      id: part.id,
      quantity: part.quantity,
      price_cad: part.price_cad
    });
  });
});


app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
