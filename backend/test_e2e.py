"""
E2E test for new organizational endpoints.
Tests the full CRUD + serialization pipeline.
"""
import subprocess, time, requests, sys, os

proc = subprocess.Popen(
    [sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8775'],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
)
time.sleep(4)

BASE = 'http://127.0.0.1:8775'
errors = []

def test(name, func):
    try:
        func()
        print(f'  PASS: {name}')
    except Exception as e:
        print(f'  FAIL: {name}: {e}')
        errors.append(name)

try:
    # Login
    r = requests.post(BASE + '/token', data={'username': 'admin@shr.com', 'password': 'admin123'})
    assert r.status_code == 200, f'Login failed: {r.text}'
    token = r.json()['access_token']
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    print('LOGIN OK')

    # Test 1: Create grupo
    def t1():
        r = requests.post(BASE + '/api/v1/grupos-empresariales',
            json={'nombre': 'Grupo E2E', 'sector_principal': 'Servicios'},
            headers=headers)
        assert r.status_code == 200, f'Status {r.status_code}: {r.text[:200]}'
        data = r.json()
        assert isinstance(data, dict), f'Expected dict, got {type(data)}: {r.text[:200]}'
        assert data.get('id'), f'No id in response: {data}'
        assert data.get('nombre') == 'Grupo E2E', f'Wrong nombre: {data}'
        globals()['grupo_id'] = data['id']
    test('Create Grupo', t1)

    # Test 2: List grupos
    def t2():
        r = requests.get(BASE + '/api/v1/grupos-empresariales', headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list), f'Expected list, got {type(data)}: {r.text[:200]}'
        assert len(data) > 0
        assert data[0].get('id')
    test('List Grupos', t2)

    # Test 3: Create empresa
    def t3():
        r = requests.post(BASE + '/api/v1/empresas',
            json={'nombre': 'Empresa E2E', 'grupo_empresarial_id': globals()['grupo_id']},
            headers=headers)
        assert r.status_code == 200, f'Status {r.status_code}: {r.text[:200]}'
        data = r.json()
        assert data.get('id')
        globals()['empresa_id'] = data['id']
    test('Create Empresa', t3)

    # Test 4: Get empresa
    def t4():
        r = requests.get(BASE + f'/api/v1/empresas/{globals()["empresa_id"]}', headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data.get('nombre_empresa') == 'Empresa E2E'
    test('Get Empresa', t4)

    # Test 5: Create macroproceso
    def t5():
        r = requests.post(BASE + '/api/v1/macroprocesos',
            json={'nombre': 'Operaciones', 'empresa_id': globals()['empresa_id'], 'tipo': 'Misional'},
            headers=headers)
        assert r.status_code == 200, f'{r.text[:200]}'
        data = r.json()
        assert data.get('id')
        globals()['macro_id'] = data['id']
    test('Create Macroproceso', t5)

    # Test 6: Create proceso
    def t6():
        r = requests.post(BASE + '/api/v1/procesos',
            json={'nombre': 'Produccion', 'macroproceso_id': globals()['macro_id']},
            headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data.get('id')
        globals()['proceso_id'] = data['id']
    test('Create Proceso', t6)

    # Test 7: Create area
    def t7():
        r = requests.post(BASE + '/api/v1/areas',
            json={'nombre': 'RH', 'proceso_id': globals()['proceso_id']},
            headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data.get('id')
        globals()['area_id'] = data['id']
    test('Create Area', t7)

    # Test 8: Create cargo organizacional
    def t8():
        r = requests.post(BASE + '/api/v1/cargos-organizacionales',
            json={'nombre': 'Analista Senior', 'empresa_id': globals()['empresa_id'],
                  'area_id': globals()['area_id'], 'nivel_organizacional': 'Profesional'},
            headers=headers)
        assert r.status_code == 200, f'{r.text[:200]}'
        data = r.json()
        assert data.get('id')
        globals()['cargo_id'] = data['id']
    test('Create Cargo Org', t8)

    # Test 9: Update cargo
    def t9():
        r = requests.put(BASE + f'/api/v1/cargos-organizacionales/{globals()["cargo_id"]}',
            json={'mision': 'Gestionar procesos de RH'}, headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data.get('mision') == 'Gestionar procesos de RH'
    test('Update Cargo', t9)

    # Test 10: Create sesion
    def t10():
        r = requests.post(BASE + '/api/v1/sesiones-valoracion',
            json={'empresa_id': globals()['empresa_id'], 'nombre': 'Val 2026'},
            headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data.get('id')
        assert data.get('estado') == 'PENDIENTE'
        globals()['sesion_id'] = data['id']
    test('Create Sesion', t10)

    # Test 11: Transicion sesion PENDIENTE -> EN_PROCESO
    def t11():
        r = requests.post(BASE + f'/api/v1/sesiones-valoracion/{globals()["sesion_id"]}/transicion',
            json={'estado': 'EN_PROCESO'}, headers=headers)
        assert r.status_code == 200, f'{r.text[:200]}'
        data = r.json()
        assert data.get('estado') == 'EN_PROCESO'
    test('Transicion Sesion', t11)

    # Test 12: Create version
    def t12():
        r = requests.post(BASE + f'/api/v1/sesiones-valoracion/{globals()["sesion_id"]}/versiones',
            json={'cargo_id': globals()['cargo_id'], 'conocimientos': 'Avanzado'},
            headers=headers)
        assert r.status_code == 200, f'{r.text[:200]}'
        data = r.json()
        assert data.get('id')
        assert data.get('estado') == 'BORRADOR'
        globals()['version_id'] = data['id']
    test('Create Version', t12)

    # Test 13: Audit logs
    def t13():
        r = requests.get(BASE + '/api/v1/audit-logs', headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
    test('Audit Logs', t13)

    print()
    if errors:
        print(f'RESULT: {len(errors)} tests FAILED: {errors}')
        sys.exit(1)
    else:
        print('=== TODAS LAS PRUEBAS PASARON EXITOSAMENTE ===')
        sys.exit(0)
except Exception as e:
    print(f'FATAL: {e}')
    import traceback
    traceback.print_exc()
    sys.exit(1)
finally:
    proc.terminate()
    proc.wait()
