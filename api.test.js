const request = require('supertest');

const API_URL = process.env.API_URL || 'http://localhost:80';

describe('Pruebas Unitarias de la API REST', () => {
  let idCreado;

  // 1. GET - Caso de éxito
  it('1. GET /items - Debe obtener una lista y código 200', async () => {
    const res = await request(API_URL).get('/items');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.data || res.body)).toBeTruthy();
  });

  // 2. POST - Caso de éxito
  it('2. POST /items - Debe crear un registro correctamente (200 o 201)', async () => {
    const nuevoRegistro = { name: 'Prueba Jest', description: 'Test automatizado' };
    const res = await request(API_URL).post('/items').send(nuevoRegistro);
    expect([200, 201]).toContain(res.statusCode);
    idCreado = res.body.data?.[0]?.id || res.body.id;
  });

  // 3. POST - Escenario de fallo (el usuario no envía datos)
  it('3. POST /items - Debe fallar si el cuerpo de la petición está vacío', async () => {
    const res = await request(API_URL).post('/items').send({});
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  // 4. GET por ID - Caso de éxito
  it('4. GET /items/:id - Debe devolver el registro recién creado', async () => {
    const res = await request(API_URL).get(`/items/${idCreado}`);
    expect(res.statusCode).toEqual(200);
  });

  // 5. GET por ID - Escenario de fallo (el usuario busca algo inexistente)
  it('5. GET /items/99999 - Debe devolver 404 al buscar un ID que no existe', async () => {
    const res = await request(API_URL).get('/items/99999');
    expect(res.statusCode).toEqual(404);
  });

  // 6. PUT - Caso de éxito
  it('6. PUT /items/:id - Debe actualizar el registro correctamente', async () => {
    const actualizacion = { name: 'Nombre Actualizado' };
    const res = await request(API_URL).put(`/items/${idCreado}`).send(actualizacion);
    expect(res.statusCode).toEqual(200);
  });

  // 7. PUT - Escenario de fallo (el usuario envía datos inválidos)
  it('7. PUT /items/:id - Debe fallar al enviar datos inválidos para actualizar', async () => {
    const res = await request(API_URL).put(`/items/${idCreado}`).send({ name: '' });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  // 8. DELETE - Caso de éxito
  it('8. DELETE /items/:id - Debe eliminar el registro correctamente', async () => {
    const res = await request(API_URL).delete(`/items/${idCreado}`);
    expect([200, 204]).toContain(res.statusCode);
  });

  // 9. DELETE - Escenario de fallo (el usuario intenta borrar algo ya borrado)
  it('9. DELETE /items/:id - Debe devolver error 404 porque ya fue eliminado', async () => {
    const res = await request(API_URL).delete(`/items/${idCreado}`);
    expect(res.statusCode).toEqual(404);
  });

  // 10. GET - Escenario de fallo (el usuario consume un endpoint mal escrito)
  it('10. GET /rutainventada - Debe devolver 404 Not Found', async () => {
    const res = await request(API_URL).get('/rutainventada');
    expect(res.statusCode).toEqual(404);
  });
});