# Correcciones solicitadas

## 1. Requerimientos

Observación recibida: "Los requerimientos presentan un desarrollo importante. Sin embargo, se solicita completar las reglas de negocio vinculadas con los niveles de acreditación, el cálculo de prioridades y la reasignación automática de donaciones."

### 1.1 Correcciones al texto vigente

RF11 – Modalidades de donación y asignación (corregido)
Descripción: El sistema debe admitir donaciones directas, donde el donante elige la necesidad, y donaciones al fondo común, donde una ronda de asignación define el destino. La ronda debe resolverse con una aplicación del algoritmo húngaro, ponderando déficit de cobertura territorial, urgencia, proximidad, tiempo de espera e historial de cumplimiento de la organización, excluyendo las categorías no habilitadas por el nivel de acreditación, y debe registrar el puntaje desglosado y el costo de oportunidad de cada asignación.

RNF06 – Motor de asignación desacoplado (reemplaza a "Motor de asignación por lotes")
Descripción: El motor de asignación debe ejecutarse como un servicio interno sin estado, separado del microservicio y sin puerto expuesto al exterior, invocado sólo al ejecutar una ronda. Si no está disponible, la ronda debe responder 503 y el resto del sistema debe seguir operando.

### 1.2 Reglas de negocio

#### Niveles de acreditación

RN01 – Escalera de niveles
Descripción: Los niveles son acumulativos. N0 Registrada no exige requisitos. N1 Identificada exige servicio regular gratuito, no discriminación y sede inscripta individualmente. N2 Operativa exige lo de N1 más condiciones sanitarias adecuadas, ausencia de kiosco en el mismo domicilio y ubicación dentro de 50 km del Banco de Alimentos. N3 Acreditada exige lo de N2 más personería jurídica o aval y aceptación de auditorías sin aviso. Toda organización nueva inicia en N0.

RN02 – Requisito cumplido
Descripción: Un requisito se considera cumplido sólo si tiene una evidencia en estado APROBADA cuya fecha de fin de validez no haya pasado. Una evidencia sin fecha de fin no vence. Las evidencias PENDIENTE, OBSERVADA, REEMPLAZADA o vencidas no cumplen el requisito.

RN03 – Ciclo de la evidencia
Descripción: Toda evidencia se crea en estado PENDIENTE. Sólo un administrador puede pasarla a APROBADA u OBSERVADA; la observación queda registrada y se notifica a la organización. Cargar una nueva evidencia para el mismo requisito marca la anterior como REEMPLAZADA. El referente nunca puede aprobar su propia evidencia.

RN04 – Personería jurídica o aval
Descripción: El requisito se satisface con cualquiera de ocho figuras: Asociación Simple, Asociación Civil, Fichero de Culto, Fundación, Cooperativa, Centro de Jubilados, Centro Vecinal o aval de otra personería jurídica.

RN05 – Transiciones de nivel
Descripción: El nivel cambia de a un escalón por vez y sólo por acción de un administrador. Subir exige que todos los requisitos del nivel destino y de los inferiores cumplan RN02. Bajar exige un motivo obligatorio que queda registrado.

RN06 – El vencimiento no degrada
Descripción: El vencimiento de una evidencia aprobada no baja el nivel automáticamente. Se señala en la cola de auditoría y bloquea el próximo ascenso hasta su renovación.

RN07 – Estado público derivado
Descripción: Una organización figura como aprobada en el sitio público si y sólo si su nivel es N1 o superior. Una organización rechazada permanece en N0.

RN08 – Organizaciones importadas
Descripción: Una organización importada que todavía no fue reclamada no admite cambios de nivel. La aprobación del reclamo no modifica el nivel: la organización recorre la escalera desde N0.

RN09 – Habilitaciones por nivel
Descripción: El nivel determina las categorías de alimento habilitadas y la cantidad de necesidades abiertas simultáneas (estados ABIERTA o EN_PROGRESO):

| Nivel | Categorías habilitadas | Necesidades abiertas simultáneas |
|---|---|---|
| N0 | Ninguna | 0 |
| N1 | No perecederos | 3 |
| N2 | No perecederos, refrigerados y congelados | 6 |
| N3 | Todas | 12 |

La categoría de una necesidad se deriva como la más exigente de los artículos seleccionados y debe estar habilitada por el nivel vigente; en caso contrario, la necesidad se rechaza indicando el nivel requerido.

RN10 – Elegibilidad para el fondo común
Descripción: Quedan fuera de la ronda las necesidades vencidas o sin artículos, y las de organizaciones en N0, sin referente o sin coordenadas.

#### Cálculo de prioridades

RN11 – Unidad de asignación
Descripción: El candidato de una ronda es la necesidad, no la organización. Cada donación es indivisible y se asigna entera a una sola necesidad. Cada necesidad recibe como máximo una donación por ronda.

RN12 – Puntaje
Descripción: Cada par donación–necesidad recibe un puntaje entre 0 y 1: puntaje = 0,30 × déficit + 0,25 × urgencia + 0,17 × proximidad + 0,13 × espera + 0,15 × cumplimiento. Cada término se normaliza a [0, 1] antes de ponderarse. Los pesos son configurables por ronda y se normalizan para sumar 1.

RN13 – Déficit de cobertura
Descripción: Para el radio censal de la organización se calcula v = (habitantes / comedores) / mediana(habitantes / comedores) × (1 + necesidades abiertas / comedores). El término es min(v, 3) / 3. Si la organización no tiene radio censal o el radio no tiene datos de población, se usa v = 1 (la mediana), sin favorecerla ni penalizarla.

RN14 – Urgencia
Descripción: Es el máximo entre una base según la prioridad declarada (URGENTE 1,0; MEDIA 0,6; NORMAL 0,3) y un término de vencimiento que crece linealmente durante los últimos 30 días hasta 1,0.

RN15 – Proximidad
Descripción: Es exp(−km / 8), donde km es la distancia geodésica entre la donación y la organización. Un par a más de 30 km no es asignable.

RN16 – Espera
Descripción: Es min(días desde la última donación recibida / 90, 1). Se cuentan las donaciones directas y las del fondo común, salvo las canceladas y las rechazadas. Una organización sin historial recibe la espera máxima.

RN17 – Cumplimiento
Descripción: Es (E + 5 × p0) / (E + F + 5), donde E son las donaciones entregadas, F las rechazadas y p0 la tasa global de entregas de los candidatos de la ronda (0,5 si ninguno tiene historial). Una organización nueva toma el promedio de la ronda. Este término nunca excluye a una organización.

RN18 – Restricciones excluyentes
Descripción: Un par no es asignable si la categoría de la donación no está entre las pedidas por la necesidad, si la categoría no está habilitada por el nivel de acreditación, si los artículos declarados por ambas partes no coinciden, si la distancia supera los 30 km o si la organización ya rechazó esa donación.

RN19 – Optimización global
Descripción: La ronda maximiza la suma de los puntajes de todas las asignaciones, no el puntaje de cada donación por separado. Dejar una donación sin asignar tiene un costo de 0,10 × min(días en el fondo / 90, 1), de modo que, ante competencia por una misma necesidad, se prioriza la donación que más esperó. Un par con puntaje nulo no se asigna.

RN20 – Explicabilidad
Descripción: Cada asignación registra su puntaje, el desglose de los cinco términos, la distancia, la fuente del déficit y el costo de oportunidad (el mejor puntaje que la donación habría obtenido de forma aislada menos el obtenido). Cada ronda registra los pesos y parámetros aplicados.

#### Reasignación de donaciones

RN21 – Propuesta
Descripción: Toda asignación surgida de una ronda nace en estado PROPUESTA. El referente de la organización la acepta, con lo que la donación pasa a ACEPTADA, o la rechaza.

RN22 – Devolución al fondo
Descripción: Ante el rechazo de una propuesta, la donación vuelve al fondo común en estado OFRECIDA y sin necesidad asignada, y la asignación queda RECHAZADA. Esa organización queda excluida para esa donación en todas las rondas futuras.

RN23 – Propuesta sin respuesta
Descripción: Una propuesta sin respuesta durante 3 días se trata igual que un rechazo, según RN22.

RN24 – Oferta directa sin respuesta
Descripción: Una donación directa sin respuesta del referente durante 7 días se cancela automáticamente y no se redirige al fondo común.

RN25 – Donaciones estancadas
Descripción: Una donación aceptada o en camino durante más de 14 días, o pendiente de confirmación durante más de 7, no se cancela ni se reasigna: se marca como estancada para revisión de un administrador.

RN26 – Momento de la reasignación
Descripción: Una donación devuelta al fondo común se reasigna en la próxima ronda, ejecutada por un administrador o, si la ronda automática está habilitada, en la ejecución diaria programada (06:00).

RN27 – Concurrencia
Descripción: Sólo puede ejecutarse una ronda a la vez. Si al registrar los resultados una donación o necesidad cambió de estado, ese par se descarta y no se reasigna dentro de la misma ronda.

RN28 – Retiro de donaciones del fondo común
Descripción: Una donación del fondo común no se elimina, sólo se cancela, para preservar el historial de asignaciones.

### 1.3 Requerimientos funcionales nuevos

RF13 – Auditoría de evidencia
Descripción: El sistema debe ofrecer al administrador una cola global de evidencia pendiente, filtrable por nivel, requisito y tipo de evidencia, con una pestaña de evidencia vencida, desde la cual pueda aprobar u observar cada evidencia.

RF14 – Respuesta a propuestas de asignación
Descripción: El sistema debe permitir que el referente acepte o rechace cada propuesta de asignación de una ronda, y devolver al fondo común las donaciones rechazadas según RN22.

RF15 – Resolución automática de donaciones sin respuesta
Descripción: El sistema debe ejecutar diariamente, y también al iniciar, un proceso que aplique RN23, RN24 y RN25.

RF16 – Ronda automática programada
Descripción: El sistema debe permitir habilitar por configuración una ronda diaria programada, con la misma lógica que la ronda manual.

### 1.4 Requerimientos no funcionales nuevos

RNF15 – Parámetros configurables
Descripción: Los cupos por nivel, las ventanas de días de RN23 a RN25, los pesos y los parámetros del puntaje deben poder modificarse por configuración, sin cambios de código.

RNF16 – Determinismo
Descripción: Con los mismos datos de entrada, una ronda debe producir siempre la misma asignación, sin componentes aleatorios.

RNF17 – Recuperación tras apagado
Descripción: Los procesos diarios de vencimiento de necesidades y de resolución de donaciones sin respuesta deben ejecutarse también al iniciar el microservicio, para recuperar las corridas perdidas si el equipo estuvo apagado.

RNF18 – Límites de la ronda
Descripción: Una ronda debe admitir hasta 500 donaciones y 500 necesidades, y resolverse dentro de los 30 segundos de espera de la llamada al motor de asignación.

## 2. Diagrama de clases y DER

Observación recibida: "Se presentan las estructuras de datos solicitadas. Se recomienda verificar que las entidades, relaciones y atributos permitan representar adecuadamente la acreditación progresiva, la asignación priorizada, la reasignación y la trazabilidad completa de las donaciones."

Resultado de la verificación contra el modelo implementado: los diagramas actuales (diagramas/estructura/der.puml, clases-dominio.puml y clases-enumeraciones.puml) omiten tablas y atributos que el sistema ya utiliza para esos cuatro aspectos. Se detallan a continuación.

### 2.1 Acreditación progresiva

El modelo vigente la cubre con organizaciones.nivel, organizacion_evidencia y organizacion_evento. Falta agregar:

- organizaciones.origen y organizaciones.origen_id: distinguen una organización autoregistrada de una importada del registro nacional, necesario para RN08.
- La tabla reclamos_organizacion (organizacion_id, referente_id, rol, telefono, mensaje, estado, motivo_rechazo, resuelto_por_id, creado_en, resuelto_en) y su tabla de evidencias reclamo_organizacion_evidencias (reclamo_id, object_key): representan el reclamo de una organización importada.
- En clases-enumeraciones, EstadoOrganizacion debe incluir SIN_RECLAMAR e INACTIVA, y debe agregarse OrigenOrganizacion.

### 2.2 Asignación priorizada

El modelo vigente la cubre con rondas y asignaciones, incluido el desglose del puntaje. Falta agregar:

- organizaciones.codigo_radio: radio censal de la organización, base del término de déficit (RN13).
- organizaciones.asistentes_declarados.
- La tabla poblacion_radio (codigo_radio PK, habitantes): población por radio censal usada en RN13. Se relaciona lógicamente con organizaciones.codigo_radio, sin clave foránea.
- asignaciones.deficit_fuente y asignaciones.codigo_radio: registran de dónde salió el déficit de cada asignación (RN20).
- rondas.origen (MANUAL o AUTOMATICA) y la enumeración OrigenRonda (RF16).
- rondas.ejecutada_por debe figurar como opcional, porque una ronda automática no tiene usuario ejecutor.

### 2.3 Reasignación

El modelo vigente ya permite representarla sin tablas nuevas, pero conviene explicitarlo en el texto que acompaña al diagrama:

- Una donación puede tener varias asignaciones a lo largo del tiempo (relación 1 a N donaciones–asignaciones), una por cada ronda en que fue propuesta. Sólo una puede estar PROPUESTA a la vez.
- La exclusión de RN22 no se guarda en una tabla aparte: se deriva de las asignaciones de esa donación en estado RECHAZADA.
- asignaciones.resuelta_en registra cuándo se aceptó, rechazó o venció la propuesta.
- Falta agregar donaciones.estado_desde: fecha desde la que la donación está en su estado actual, sobre la que se calculan las ventanas de RN23 a RN25.

### 2.4 Trazabilidad completa de las donaciones

Es la omisión principal. El historial de cambios de estado de las donaciones no está en la tabla donaciones sino en la bitácora actividad, que no figura en ningún diagrama. Debe agregarse:

- La tabla actividad (id, ocurrido_en, actor_usuario_id, actor_tipo, accion, resultado, entidad_tipo, entidad_id, detalle, antes, despues, motivo, ip, email_intento). Es de sólo agregado, igual que organizacion_evento. Registra cada cambio de estado de una donación con su estado anterior y posterior, el actor (usuario o SISTEMA) y el motivo, incluidos los cambios automáticos de RN23 y RN24.
- Su relación con donaciones es polimórfica (entidad_tipo = 'DONACION', entidad_id = id de la donación), sin clave foránea, porque la misma bitácora registra acciones sobre otras entidades.
- Las enumeraciones TipoActor, TipoActividad y ResultadoActividad.

Junto con codigos_entrega (validación de la entrega), los campos de confirmación y de intervención administrativa de donaciones, y asignaciones (cada propuesta, con su puntaje y su resolución), la bitácora actividad completa la traza de una donación desde la oferta hasta la entrega.

### 2.5 Otras tablas presentes en el sistema y ausentes del DER

Son de menor relevancia para la observación, pero conviene incluirlas o mencionar que se omiten por pertenecer a otros módulos:

- reportes_organizacion: reportes de usuarios sobre una organización (por ejemplo, duplicados).
- refresh_tokens y password_reset_tokens: soporte de autenticación.
- La tabla de claves de idempotencia de operaciones.
