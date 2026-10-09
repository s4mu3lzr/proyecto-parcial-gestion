const net = require('net');
const client = new net.Socket();

client.connect(6061, 'localhost', function() {
    console.log('Conectado al contenedor por TCP...');
    
    // 1. Enviar el comando insert
    console.log('Enviando insert...');
    client.write('{insert:{"name":"Prueba TCP", "description":"Funciona localmente"}}');

    // 2. Esperar 1 segundo y enviar el comando get
    setTimeout(() => {
        console.log('Enviando get...');
        client.write('{get:1}');
    }, 1000);
});

client.on('data', function(data) {
    console.log('Respuesta del servidor TCP: ' + data.toString());
});

client.on('error', function(err) {
    console.log('Error TCP: ' + err.message);
});