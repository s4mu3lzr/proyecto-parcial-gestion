
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const net = require('net');

const app = express();
app.use(express.json());

const PORT = 80;
const DB_FILE = path.join(__dirname, 'database.sqlite');
const BACKUP_FILE = path.join(__dirname, 'backup.sqlite');
const TCP_PORT = 6061;

const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('Error conectando a SQLite:', err.message);
  }
});

const normalizeResponse = (data = []) => ({
  statusCode: 200,
  data: Array.isArray(data) ? data : [data],
});

const runDb = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const getDb = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const allDb = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

const ensureSchema = () => {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL
      )
    `);
  });
};

ensureSchema();

app.get('/items', async (req, res) => {
  try {
    const rows = await allDb('SELECT * FROM items ORDER BY id ASC');
    return res.json(normalizeResponse(rows));
  } catch (error) {
    return res.status(500).json({ statusCode: 500, data: [{ message: error.message }] });
  }
});

app.get('/items/:id', async (req, res) => {
  try {
    const item = await getDb('SELECT * FROM items WHERE id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ statusCode: 404, data: [{ message: 'Item no encontrado', id: req.params.id }] });
    }

    return res.json(normalizeResponse([item]));
  } catch (error) {
    return res.status(500).json({ statusCode: 500, data: [{ message: error.message }] });
  }
});

app.get('/items/count', async (req, res) => {
  try {
    const row = await getDb('SELECT COUNT(*) AS total FROM items');
    return res.json(normalizeResponse([{ total: row.total }]));
  } catch (error) {
    return res.status(500).json({ statusCode: 500, data: [{ message: error.message }] });
  }
});

app.post('/items', async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name || !description) {
      return res.status(400).json({ statusCode: 400, data: [{ message: 'name and description are required' }] });
    }

    const result = await runDb('INSERT INTO items (name, description) VALUES (?, ?)', [name, description]);
    const insertedItem = { id: result.lastID, name, description };
    return res.json(normalizeResponse([insertedItem]));
  } catch (error) {
    return res.status(500).json({ statusCode: 500, data: [{ message: error.message }] });
  }
});

app.put('/items/:id', async (req, res) => {
  try {
    const item = await getDb('SELECT * FROM items WHERE id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ statusCode: 404, data: [{ message: 'Item no encontrado', id: req.params.id }] });
    }

    const body = req.body || {};
    const hasName = Object.prototype.hasOwnProperty.call(body, 'name');
    const hasDescription = Object.prototype.hasOwnProperty.call(body, 'description');
    if (!hasName && !hasDescription) {
      return res.status(400).json({ statusCode: 400, data: [{ message: 'At least one field is required' }] });
    }
    if (hasName && (typeof body.name !== 'string' || !body.name.trim())) {
      return res.status(400).json({ statusCode: 400, data: [{ message: 'name must not be empty' }] });
    }
    if (hasDescription && (typeof body.description !== 'string' || !body.description.trim())) {
      return res.status(400).json({ statusCode: 400, data: [{ message: 'description must not be empty' }] });
    }

    const name = hasName ? body.name : item.name;
    const description = hasDescription ? body.description : item.description;
    await runDb('UPDATE items SET name = ?, description = ? WHERE id = ?', [name, description, req.params.id]);
    return res.json(normalizeResponse([{ id: Number(req.params.id), name, description }]));
  } catch (error) {
    return res.status(500).json({ statusCode: 500, data: [{ message: error.message }] });
  }
});

app.post('/items/bulk', async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [];
    const inserted = [];

    for (const item of items) {
      const { name, description } = item || {};
      if (!name || !description) continue;
      const result = await runDb('INSERT INTO items (name, description) VALUES (?, ?)', [name, description]);
      inserted.push({ id: result.lastID, name, description });
    }

    return res.json(normalizeResponse(inserted));
  } catch (error) {
    return res.status(500).json({ statusCode: 500, data: [{ message: error.message }] });
  }
});

app.post('/backup', async (req, res) => {
  try {
    await fs.promises.copyFile(DB_FILE, BACKUP_FILE);
    return res.json(normalizeResponse([{ message: 'Backup creado correctamente', file: 'backup.sqlite' }]));
  } catch (error) {
    return res.status(500).json({ statusCode: 500, data: [{ message: error.message }] });
  }
});

app.delete('/items/:id', async (req, res) => {
  try {
    const item = await getDb('SELECT * FROM items WHERE id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ statusCode: 404, data: [{ message: 'Item no encontrado', id: req.params.id }] });
    }

    await runDb('DELETE FROM items WHERE id = ?', [req.params.id]);
    return res.json(normalizeResponse([{ message: 'Item eliminado', deleted: item }]));
  } catch (error) {
    return res.status(500).json({ statusCode: 500, data: [{ message: error.message }] });
  }
});

app.delete('/items/truncate', async (req, res) => {
  try {
    await runDb('DELETE FROM items');
    await runDb("DELETE FROM sqlite_sequence WHERE name = 'items'");
    return res.json(normalizeResponse([{ message: 'Tabla items vaciada' }]));
  } catch (error) {
    return res.status(500).json({ statusCode: 500, data: [{ message: error.message }] });
  }
});

app.delete('/items/clear', async (req, res) => {
  try {
    await runDb('DELETE FROM items');
    return res.json(normalizeResponse([{ message: 'Items eliminados' }]));
  } catch (error) {
    return res.status(500).json({ statusCode: 500, data: [{ message: error.message }] });
  }
});

app.get('/items/last', async (req, res) => {
  try {
    const row = await getDb('SELECT * FROM items ORDER BY id DESC LIMIT 1');
    return res.json(normalizeResponse(row ? [row] : []));
  } catch (error) {
    return res.status(500).json({ statusCode: 500, data: [{ message: error.message }] });
  }
});

const sendTcpResponse = (socket, payload) => {
  socket.write(`${JSON.stringify(payload)}\n`);
};

const handleTcpMessage = (socket, raw) => {
  try {
    const content = raw.toString().trim();
    if (!content.startsWith('{') || !content.endsWith('}')) {
      return sendTcpResponse(socket, { statusCode: 400, data: [{ message: 'Formato TCP inválido' }] });
    }

    const inside = content.slice(1, -1);
    const separator = inside.indexOf(':');
    if (separator === -1) {
      return sendTcpResponse(socket, { statusCode: 400, data: [{ message: 'Formato TCP inválido' }] });
    }

    const action = inside.slice(0, separator).trim();
    const payload = inside.slice(separator + 1).trim();

    if (action === 'insert') {
      const item = JSON.parse(payload);
      if (!item || typeof item.name !== 'string' || typeof item.description !== 'string') {
        throw new Error('JSON inválido para insert');
      }

      db.run('INSERT INTO items (name, description) VALUES (?, ?)', [item.name, item.description], function (err) {
        if (err) {
          return sendTcpResponse(socket, { statusCode: 500, data: [{ message: err.message }] });
        }

        return sendTcpResponse(socket, {
          statusCode: 200,
          data: [{ id: this.lastID, name: item.name, description: item.description, inserted: true }],
        });
      });
      return;
    }

    if (action === 'get') {
      const id = Number(payload);
      db.get('SELECT * FROM items WHERE id = ?', [id], (err, row) => {
        if (err) {
          return sendTcpResponse(socket, { statusCode: 500, data: [{ message: err.message }] });
        }

        return sendTcpResponse(socket, {
          statusCode: 200,
          data: row ? [row] : [],
        });
      });
      return;
    }

    return sendTcpResponse(socket, { statusCode: 400, data: [{ message: 'Acción TCP no soportada' }] });
  } catch (error) {
    return sendTcpResponse(socket, { statusCode: 400, data: [{ message: error.message }] });
  }
};

const tcpServer = net.createServer((socket) => {
  socket.setEncoding('utf8');
  socket.on('data', (chunk) => handleTcpMessage(socket, chunk));
  socket.on('error', (err) => {
    console.error('Error en socket TCP:', err.message);
  });
});

tcpServer.on('error', (err) => {
  console.error('Servidor TCP falló:', err.message);
});

const startServers = () => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API Express escuchando en el puerto ${PORT}`);
  });

  tcpServer.listen(TCP_PORT, '0.0.0.0', () => {
    console.log(`Servidor TCP escuchando en el puerto ${TCP_PORT}`);
  });
};

if (require.main === module) {
  startServers();
}

module.exports = {
  app,
  db,
  startServers,
};