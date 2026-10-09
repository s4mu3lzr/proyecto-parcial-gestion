import json
import socket
import time
import urllib.request

AWS_IP = "3.149.253.191"

print("==================================")
print("PRUEBA HTTP - GET /users")
print("==================================")
url = f"http://{AWS_IP}:8080/users"
try:
    with urllib.request.urlopen(url, timeout=10) as response:
        status = response.getcode()
        body = response.read().decode('utf-8')
        print(f"Código HTTP: {status}")
        print("Respuesta JSON:")
        print(body)
except Exception as e:
    print(f"Error HTTP: {e}")

print("\n==================================")
print("PRUEBA TCP - INSERT + GET")
print("==================================")

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(10)

try:
    sock.connect((AWS_IP, 6061))

    payload_insert = '{insert:{"name":"Evidencia Python", "description":"Prueba final exitosa"}}'
    sock.sendall(payload_insert.encode('utf-8'))
    data_insert = sock.recv(4096).decode('utf-8', errors='replace')
    print("Respuesta al INSERT:")
    print(data_insert)

    time.sleep(1)

    payload_get = '{get:1}'
    sock.sendall(payload_get.encode('utf-8'))
    data_get = sock.recv(4096).decode('utf-8', errors='replace')
    print("\nRespuesta al GET:")
    print(data_get)
finally:
    sock.close()

print("\n==================================")
print("FIN DE PRUEBAS")
print("==================================")
