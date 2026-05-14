import requests, json, time

BASE = 'https://shr-backend-prod.onrender.com'

# Login
r = requests.post(f'{BASE}/token',
    data={'username': 'admin@shr.com', 'password': 'admin123', 'grant_type': 'password'}, timeout=60)
token = r.json()['access_token']
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
API = f'{BASE}/api/v1'

def api_post(path, data):
    r = requests.post(f'{API}{path}', json=data, headers=headers, timeout=60)
    return r.json() if r.ok else None

def api_get(path):
    r = requests.get(f'{API}{path}', headers=headers, timeout=60)
    return r.json() if r.ok else None

# ========== 3 GRUPOS DIVERSOS ==========
grupos = [
    {
        'nombre': 'TEST - Grupo Tecnologia',
        'descripcion': 'Grupo empresarial del sector tecnologico creado para pruebas del sistema',
        'sector_principal': 'Tecnologia',
        'tamano': 'Grande',
        'pais_principal': 'Colombia',
        'empresas': [
            {
                'nombre': 'TEST - TechSolutions Colombia SAS',
                'nit': 'TEST-900-100-001',
                'razon_social': 'TechSolutions Colombia SAS',
                'sector_economico': 'Software y TI',
                'macroproceso': 'Gestion de Tecnologia',
                'proceso': 'Desarrollo de Software',
                'area': 'Ingenieria',
                'cargos': [
                    {'nombre': 'TEST - Director de Tecnologia (CTO)', 'mision': 'Liderar la vision tecnologica de la empresa', 'formacion': 'Ingenieria de Sistemas, Maestria', 'experiencia': '12 anos'},
                    {'nombre': 'TEST - Lider de Desarrollo', 'mision': 'Coordinar equipos de desarrollo de software', 'formacion': 'Ingenieria de Sistemas', 'experiencia': '7 anos'},
                    {'nombre': 'TEST - Ingeniero QA', 'mision': 'Asegurar la calidad del software mediante pruebas automatizadas', 'formacion': 'Ingenieria de Sistemas o afines', 'experiencia': '4 anos'},
                    {'nombre': 'TEST - Disenador UX/UI', 'mision': 'Disenar experiencias de usuario intuitivas y accesibles', 'formacion': 'Diseno Grafico o afines', 'experiencia': '3 anos'},
                    {'nombre': 'TEST - Ingeniero DevOps', 'mision': 'Automatizar despliegues y mantener infraestructura cloud', 'formacion': 'Ingenieria de Sistemas', 'experiencia': '5 anos'},
                ]
            },
        ]
    },
    {
        'nombre': 'TEST - Grupo Salud',
        'descripcion': 'Grupo del sector salud creado para pruebas del sistema',
        'sector_principal': 'Salud',
        'tamano': 'Mediana',
        'pais_principal': 'Colombia',
        'empresas': [
            {
                'nombre': 'TEST - Clinica SaludTotal SAS',
                'nit': 'TEST-900-200-001',
                'razon_social': 'Clinica SaludTotal SAS',
                'sector_economico': 'Servicios de Salud',
                'macroproceso': 'Gestion Asistencial',
                'proceso': 'Atencion al Paciente',
                'area': 'Servicios Medicos',
                'cargos': [
                    {'nombre': 'TEST - Director Medico', 'mision': 'Dirigir la estrategia clinica y asistencial', 'formacion': 'Medicina, Especializacion', 'experiencia': '15 anos'},
                    {'nombre': 'TEST - Enfermera Jefe', 'mision': 'Coordinar el equipo de enfermeria y garantizar calidad de cuidado', 'formacion': 'Enfermeria, Especializacion', 'experiencia': '8 anos'},
                    {'nombre': 'TEST - Administrador Hospitalario', 'mision': 'Gestionar recursos y presupuesto del centro medico', 'formacion': 'Administracion en Salud', 'experiencia': '6 anos'},
                    {'nombre': 'TEST - Farmaceutico', 'mision': 'Garantizar el suministro y control de medicamentos', 'formacion': 'Farmacia', 'experiencia': '4 anos'},
                    {'nombre': 'TEST - Auxiliar Clinico', 'mision': 'Apoyar procedimientos clinicos y atencion al paciente', 'formacion': 'Auxiliar de Enfermeria', 'experiencia': '2 anos'},
                ]
            },
        ]
    },
    {
        'nombre': 'TEST - Grupo Industrial',
        'descripcion': 'Grupo del sector manufacturero creado para pruebas del sistema',
        'sector_principal': 'Manufactura',
        'tamano': 'Grande',
        'pais_principal': 'Colombia',
        'empresas': [
            {
                'nombre': 'TEST - Industrias del Sur SA',
                'nit': 'TEST-900-300-001',
                'razon_social': 'Industrias del Sur SA',
                'sector_economico': 'Manufactura Industrial',
                'macroproceso': 'Gestion de Produccion',
                'proceso': 'Manufactura',
                'area': 'Planta de Produccion',
                'cargos': [
                    {'nombre': 'TEST - Gerente de Planta', 'mision': 'Dirigir las operaciones de la planta de produccion', 'formacion': 'Ingenieria Industrial', 'experiencia': '12 anos'},
                    {'nombre': 'TEST - Ingeniero de Produccion', 'mision': 'Optimizar procesos productivos y mejorar eficiencia', 'formacion': 'Ingenieria de Produccion', 'experiencia': '5 anos'},
                    {'nombre': 'TEST - Supervisor de Calidad', 'mision': 'Supervisar el cumplimiento de estandares de calidad', 'formacion': 'Ingenieria de Calidad', 'experiencia': '4 anos'},
                    {'nombre': 'TEST - Operario de Maquina CNC', 'mision': 'Operar maquinaria CNC para produccion de piezas', 'formacion': 'Tecnico en Mecanica', 'experiencia': '3 anos'},
                    {'nombre': 'TEST - Coordinador de Logistica', 'mision': 'Coordinar cadena de suministro y distribucion', 'formacion': 'Logistica y Transporte', 'experiencia': '5 anos'},
                ]
            },
        ]
    },
]

created_ids = {}

for gi, grupo in enumerate(grupos):
    print(f'\n{"="*60}')
    print(f'GRUPO {gi+1}: {grupo["nombre"]}')
    print(f'{"="*60}')

    # Create group
    g = api_post('/grupos-empresariales', {
        'nombre': grupo['nombre'], 'descripcion': grupo['descripcion'],
        'sector_principal': grupo['sector_principal'], 'tamano': grupo['tamano'],
        'pais_principal': grupo['pais_principal'],
    })
    gid = g['id']
    print(f'  Grupo creado: id={gid}')

    for ei, empresa_data in enumerate(grupo['empresas']):
        # Create empresa
        e = api_post('/empresas', {
            'nombre': empresa_data['nombre'], 'nit': empresa_data['nit'],
            'razon_social': empresa_data['razon_social'],
            'sector_economico': empresa_data['sector_economico'],
            'grupo_empresarial_id': gid,
        })
        eid = e['id']
        print(f'  Empresa creada: id={eid} ({empresa_data["nombre"]})')

        # Create macroproceso
        mp = api_post('/macroprocesos', {
            'empresa_id': eid, 'nombre': f'TEST - {empresa_data["macroproceso"]}',
            'descripcion': f'Macroproceso de prueba para {empresa_data["nombre"]}',
            'tipo': 'Misional', 'criticidad': 'Alta',
        })
        mpid = mp['id']

        # Create proceso
        pr = api_post('/procesos', {
            'macroproceso_id': mpid, 'nombre': f'TEST - {empresa_data["proceso"]}',
            'descripcion': f'Proceso de prueba para {empresa_data["nombre"]}',
            'lider_proceso': f'Lider TEST {gi+1}-{ei+1}', 'criticidad': 'Media',
        })
        prid = pr['id']

        # Create area
        ar = api_post('/areas', {
            'proceso_id': prid, 'nombre': f'TEST - {empresa_data["area"]}',
            'nombre_corto': f'AREA-{gi+1}{ei+1}', 'tipo_area': 'Operativa',
        })
        arid = ar['id']

        # Create cargos
        cargo_ids = []
        for ci, cargo_data in enumerate(empresa_data['cargos']):
            c = api_post('/cargos-organizacionales', {
                'nombre': cargo_data['nombre'], 'empresa_id': eid, 'area_id': arid,
                'mision': cargo_data['mision'],
                'formacion_requerida': cargo_data['formacion'],
                'experiencia_requerida': cargo_data['experiencia'],
            })
            cid = c['id']
            cargo_ids.append(cid)
            print(f'    Cargo creado: id={cid} ({cargo_data["nombre"]})')

        created_ids[f'grupo_{gi+1}'] = {'grupo_id': gid, 'empresa_id': eid, 'cargo_ids': cargo_ids}

# ========== FULL FLOW FOR GRUPO 1 (Tecnologia) ==========
print(f'\n{"="*60}')
print('FLUJO COMPLETO: Grupo Tecnologia')
print(f'{"="*60}')

eid = created_ids['grupo_1']['empresa_id']
cargo_ids = created_ids['grupo_1']['cargo_ids']

# Create sesion
s = api_post('/sesiones-valoracion', {
    'empresa_id': eid, 'nombre': 'TEST - Sesion Valoracion Tecnologia',
    'descripcion': 'Sesion de valoracion de prueba para TechSolutions',
    'metodologia': 'Puntos por Factor',
})
sid = s['id']
print(f'Sesion creada: id={sid}')

# Add all cargos
version_ids = []
for cid in cargo_ids:
    r = requests.post(f'{API}/sesiones-valoracion/{sid}/cargos',
        json={'cargo_id': cid}, headers=headers, timeout=60)
    if r.ok:
        vid = r.json()['id']
        version_ids.append(vid)
        print(f'  Cargo {cid} -> version {vid}')
    else:
        print(f'  Cargo {cid} error: {r.text[:100]}')

# Update scores (varied per cargo role)
scores_config = [
    {'conocimientos': '5 - Experto', 'experiencia': '5 - Master', 'habilidad_gerencial': '5 - Estrategico',
     'complejidad_conceptual': '5 - Abstracto', 'impacto': '5 - Critico', 'autonomia': '5 - Total',
     'rol_cargo': '4 - Tactic', 'contacto': '4 - Frecuente', 'frecuencia': '4 - Diario',
     'contenido_relaciones': '4 - Negociacion', 'tendencia_cc': '5', 'guias_apoyo': '2 - Detalladas',
     'tendencia_ga': '2', 'magnitud': '5 - Grupo Empresarial',
     'criterio_1': 280, 'criterio_2': 240, 'criterio_3': 200},
    {'conocimientos': '4 - Experto Tecnico', 'experiencia': '4 - Senior', 'habilidad_gerencial': '4 - Gerencial',
     'complejidad_conceptual': '4 - Creativo', 'impacto': '4 - Muy Importante', 'autonomia': '4 - Amplia',
     'rol_cargo': '3 - Tactic/Oper', 'contacto': '3 - Periodico', 'frecuencia': '3 - Semanal',
     'contenido_relaciones': '3 - Coordinacion', 'tendencia_cc': '4', 'guias_apoyo': '3 - Generales',
     'tendencia_ga': '3', 'magnitud': '3 - Division',
     'criterio_1': 200, 'criterio_2': 170, 'criterio_3': 150},
    {'conocimientos': '3 - Avanzado', 'experiencia': '3 - Senior', 'habilidad_gerencial': '2 - Tactico',
     'complejidad_conceptual': '3 - Analitico', 'impacto': '3 - Importante', 'autonomia': '3 - Guiado',
     'rol_cargo': '2 - Operational', 'contacto': '3 - Periodico', 'frecuencia': '3 - Semanal',
     'contenido_relaciones': '2 - Informativo', 'tendencia_cc': '3', 'guias_apoyo': '3 - Generales',
     'tendencia_ga': '3', 'magnitud': '2 - Area',
     'criterio_1': 140, 'criterio_2': 120, 'criterio_3': 100},
    {'conocimientos': '3 - Avanzado', 'experiencia': '2 - Semi-Senior', 'habilidad_gerencial': '2 - Tactico',
     'complejidad_conceptual': '3 - Analitico', 'impacto': '2 - Moderado', 'autonomia': '3 - Guiado',
     'rol_cargo': '2 - Operational', 'contacto': '2 - Ocasional', 'frecuencia': '2 - Mensual',
     'contenido_relaciones': '2 - Informativo', 'tendencia_cc': '3', 'guias_apoyo': '3 - Generales',
     'tendencia_ga': '3', 'magnitud': '2 - Area',
     'criterio_1': 120, 'criterio_2': 100, 'criterio_3': 90},
    {'conocimientos': '4 - Experto Tecnico', 'experiencia': '4 - Senior', 'habilidad_gerencial': '3 - Tactico',
     'complejidad_conceptual': '4 - Creativo', 'impacto': '3 - Importante', 'autonomia': '4 - Amplia',
     'rol_cargo': '3 - Tactic/Oper', 'contacto': '3 - Periodico', 'frecuencia': '3 - Semanal',
     'contenido_relaciones': '3 - Coordinacion', 'tendencia_cc': '4', 'guias_apoyo': '3 - Generales',
     'tendencia_ga': '3', 'magnitud': '3 - Division',
     'criterio_1': 180, 'criterio_2': 150, 'criterio_3': 130},
]

for i, (vid, score) in enumerate(zip(version_ids, scores_config)):
    r = requests.put(f'{API}/versiones-valoracion/{vid}', json=score, headers=headers, timeout=60)
    if r.ok:
        d = r.json()
        print(f'  Version {vid} actualizada: pts={d["puntos_totales"]}, nivel={d["nivel_shr"]}')
    else:
        print(f'  Version {vid} error: {r.text[:100]}')

# Add participants
for p in [
    {'rol': 'consultor', 'nombre': 'Carlos Consultor TEST', 'email': 'carlos@test.com'},
    {'rol': 'rh', 'nombre': 'Rosa RH TEST', 'email': 'rosa@test.com'},
    {'rol': 'gerente_area', 'nombre': 'Gabriel Gerente TEST', 'email': 'gabriel@test.com'},
    {'rol': 'lider_cargo', 'nombre': 'Laura Lider TEST', 'email': 'laura@test.com'},
]:
    r = requests.post(f'{API}/sesiones-valoracion/{sid}/participantes', json=p, headers=headers, timeout=60)
    print(f'  Participante {p["rol"]}: {"OK" if r.ok else "ERROR"}')

# Transition session PENDIENTE -> EN_PROCESO
r = requests.post(f'{API}/sesiones-valoracion/{sid}/transicion',
    json={'estado': 'EN_PROCESO'}, headers=headers, timeout=60)
print(f'  Sesion -> EN_PROCESO: {r.json().get("estado") if r.ok else "ERROR"}')

# Transition all versions to DEFINITIVA
for i, vid in enumerate(version_ids):
    for est in ['EN_REVISION', 'APROBADA', 'DEFINITIVA']:
        r = requests.post(f'{API}/versiones-valoracion/{vid}/transicion',
            json={'estado': est}, headers=headers, timeout=60)
        if r.ok:
            d = r.json()
            if est == 'DEFINITIVA':
                print(f'  Version {vid} -> DEFINITIVA: pts={d["puntos_totales"]}, nivel={d["nivel_shr"]}')
        else:
            print(f'  Version {vid} -> {est} error: {r.text[:100]}')

# Transition session to FINALIZADA -> APROBADA
for est in ['FINALIZADA', 'APROBADA']:
    r = requests.post(f'{API}/sesiones-valoracion/{sid}/transicion',
        json={'estado': est}, headers=headers, timeout=60)
    print(f'  Sesion -> {est}: {r.json().get("estado") if r.ok else r.text[:100]}')

# Get consolidado
r = requests.get(f'{API}/sesiones-valoracion/{sid}/consolidado', headers=headers, timeout=60)
if r.ok:
    d = r.json()
    print(f'\nCONSOLIDADO: {d["total"]} valoraciones')
    for v in d['valoraciones']:
        print(f'  {v["cargo"]["nombre"]}: {v["version"]["puntos_totales"]} pts - {v["version"]["nivel_shr"]}')

print(f'\n{"="*60}')
print('TODO COMPLETADO EXITOSAMENTE')
print(f'{"="*60}')
print(f'\nResumen:')
for k, v in created_ids.items():
    print(f'  {k}: grupo={v["grupo_id"]}, empresa={v["empresa_id"]}, {len(v["cargo_ids"])} cargos')
print(f'\nSesion Tecnologia: id={sid}, 5 cargos valorados y aprobados')
