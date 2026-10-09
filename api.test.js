const request = require('supertest');
const net = require('net');
const { app, db, tcpServer } = require('./server');

describe('Pruebas Unitarias de la API REST', () => {
  let idCreado;

  beforeAll(async () => {
    await new Promise((resolve) => tcpServer.listen(0, '127.0.0.1', resolve));
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      tcpServer.close((error) => (error ? reject(error) : resolve()));
    });
  });

  const requestTcp = (message) =>
    new Promise((resolve, reject) => {
      const address = tcpServer.address();
      const socket = net.createConnection(address.port, '127.0.0.1', () => socket.write(message));
      let response = '';

      socket.on('data', (chunk) => {
        response += chunk;
        if (response.includes('\n')) {
          socket.end();
          resolve(JSON.parse(response.trim()));
        }
      });
      socket.on('error', reject);
    });

  // 1. GET - Caso de éxito
  it('1. GET /items - Debe obtener una lista y código 200', async () => {
    const res = await request(app).get('/items');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.data || res.body)).toBeTruthy();
  });

  // 2. POST - Caso de éxito
  it('2. POST /items - Debe crear un registro correctamente (200 o 201)', async () => {
    const nuevoRegistro = { name: 'Prueba Jest', description: 'Test automatizado' };
    const res = await request(app).post('/items').send(nuevoRegistro);
    expect([200, 201]).toContain(res.statusCode);
    idCreado = res.body.data?.[0]?.id || res.body.id;
  });

  // 3. POST - Escenario de fallo (el usuario no envía datos)
  it('3. POST /items - Debe fallar si el cuerpo de la petición está vacío', async () => {
    const res = await request(app).post('/items').send({});
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  // 4. GET por ID - Caso de éxito
  it('4. GET /items/:id - Debe devolver el registro recién creado', async () => {
    const res = await request(app).get(`/items/${idCreado}`);
    expect(res.statusCode).toEqual(200);
  });

  // 5. GET por ID - Escenario de fallo (el usuario busca algo inexistente)
  it('5. GET /items/99999 - Debe devolver 404 al buscar un ID que no existe', async () => {
    const res = await request(app).get('/items/99999');
    expect(res.statusCode).toEqual(404);
  });

  // 6. PUT - Caso de éxito
  it('6. PUT /items/:id - Debe actualizar el registro correctamente', async () => {
    const actualizacion = { name: 'Nombre Actualizado' };
    const res = await request(app).put(`/items/${idCreado}`).send(actualizacion);
    expect(res.statusCode).toEqual(200);
  });

  it('6a. PUT /items/:id - Debe actualizar solo la descripción', async () => {
    const res = await request(app).put(`/items/${idCreado}`).send({ description: 'Descripción actualizada' });
    expect(res.statusCode).toBe(200);
  });

  it('6b. PUT /items/:id - Debe rechazar una actualización sin campos', async () => {
    const res = await request(app).put(`/items/${idCreado}`).send({});
    expect(res.statusCode).toBe(400);
  });

  it('6c. PUT /items/:id - Debe rechazar una descripción vacía', async () => {
    const res = await request(app).put(`/items/${idCreado}`).send({ description: '' });
    expect(res.statusCode).toBe(400);
  });

  // 7. PUT - Escenario de fallo (el usuario envía datos inválidos)
  it('7. PUT /items/:id - Debe fallar al enviar datos inválidos para actualizar', async () => {
    const res = await request(app).put(`/items/${idCreado}`).send({ name: '' });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('7a. PUT /items/99999 - Debe devolver 404 para un registro inexistente', async () => {
    const res = await request(app).put('/items/99999').send({ name: 'No existe' });
    expect(res.statusCode).toBe(404);
  });

  // 8. DELETE - Caso de éxito
  it('8. DELETE /items/:id - Debe eliminar el registro correctamente', async () => {
    const res = await request(app).delete(`/items/${idCreado}`);
    expect([200, 204]).toContain(res.statusCode);
  });

  // 9. DELETE - Escenario de fallo (el usuario intenta borrar algo ya borrado)
  it('9. DELETE /items/:id - Debe devolver error 404 porque ya fue eliminado', async () => {
    const res = await request(app).delete(`/items/${idCreado}`);
    expect(res.statusCode).toEqual(404);
  });

  // 10. GET - Escenario de fallo (el usuario consume un endpoint mal escrito)
  it('10. GET /rutainventada - Debe devolver 404 Not Found', async () => {
    const res = await request(app).get('/rutainventada');
    expect(res.statusCode).toEqual(404);
  });

  it('11. GET /items/count - Debe devolver la cantidad de registros', async () => {
    const res = await request(app).get('/items/count');
    expect(res.statusCode).toBe(200);
  });

  it('12. GET /items/last - Debe devolver el último registro', async () => {
    const res = await request(app).get('/items/last');
    expect(res.statusCode).toBe(200);
  });

  it('13. POST /items/bulk - Debe crear varios registros', async () => {
    const items = [
      { name: 'Prueba bulk 1', description: 'Primer registro de prueba' },
      { name: 'Prueba bulk 2', description: 'Segundo registro de prueba' },
    ];
    const res = await request(app).post('/items/bulk').send(items);
    expect(res.statusCode).toBe(200);
  });

  it('13a. POST /items/bulk - Debe ignorar registros inválidos', async () => {
    const res = await request(app).post('/items/bulk').send([
      null,
      { name: 'Sin descripción' },
    ]);
    expect(res.statusCode).toBe(200);
  });

  it('13b. POST /items/bulk - Debe aceptar un cuerpo que no sea un arreglo', async () => {
    const res = await request(app).post('/items/bulk').send({ name: 'No se inserta' });
    expect(res.statusCode).toBe(200);
  });

  it('13c. POST /items - Debe rechazar un registro sin descripción', async () => {
    const res = await request(app).post('/items').send({ name: 'Sin descripción' });
    expect(res.statusCode).toBe(400);
  });

  it('14a. TCP - Debe rechazar un formato inválido', async () => {
    const res = await requestTcp('mensaje inválido');
    expect(res.statusCode).toBe(400);
  });

  it('14b. TCP - Debe rechazar un mensaje sin separador', async () => {
    const res = await requestTcp('{sin-separador}');
    expect(res.statusCode).toBe(400);
  });

  it('14c. TCP - Debe rechazar una acción no soportada', async () => {
    const res = await requestTcp('{acción:}');
    expect(res.statusCode).toBe(400);
  });

  it('14d. TCP - Debe rechazar datos inválidos para insertar', async () => {
    const res = await requestTcp('{insert:{}}');
    expect(res.statusCode).toBe(400);
  });

  it('14e. TCP - Debe reportar un error si falla la inserción', async () => {
    jest.spyOn(db, 'run').mockImplementation(function (_sql, _params, callback) {
      callback(new Error('Error de prueba'));
      return db;
    });
    let res;
    try {
      res = await requestTcp('{insert:{"name":"TCP","description":"Prueba"}}');
    } finally {
      jest.restoreAllMocks();
    }
    expect(res.statusCode).toBe(500);
  });

  it('14f. TCP - Debe insertar un registro correctamente', async () => {
    const res = await requestTcp('{insert:{"name":"TCP","description":"Prueba"}}');
    expect(res.statusCode).toBe(200);
  });

  it('14g. TCP - Debe obtener un registro existente', async () => {
    const res = await requestTcp(`{get:${idCreado}}`);
    expect(res.statusCode).toBe(200);
  });

  it('14h. TCP - Debe responder con una lista vacía para un ID inexistente', async () => {
    const res = await requestTcp('{get:999999}');
    expect(res.statusCode).toBe(200);
  });

  it('14i. TCP - Debe reportar un error si falla la consulta', async () => {
    jest.spyOn(db, 'get').mockImplementation(function (_sql, _params, callback) {
      callback(new Error('Error de prueba'));
      return db;
    });
    let res;
    try {
      res = await requestTcp('{get:1}');
    } finally {
      jest.restoreAllMocks();
    }
    expect(res.statusCode).toBe(500);
  });

  it('14. POST /backup - Debe crear una copia de seguridad', async () => {
    const res = await request(app).post('/backup');
    expect(res.statusCode).toBe(200);
  });

  it('15. DELETE /items/clear - Debe eliminar todos los registros', async () => {
    const res = await request(app).delete('/items/clear');
    expect(res.statusCode).toBe(200);
  });

  it('15a. GET /items/last - Debe responder correctamente cuando no hay registros', async () => {
    const res = await request(app).get('/items/last');
    expect(res.statusCode).toBe(200);
  });

  it('16. DELETE /items/truncate - Debe vaciar la tabla y reiniciar su secuencia', async () => {
    const res = await request(app).delete('/items/truncate');
    expect(res.statusCode).toBe(200);
  });
});