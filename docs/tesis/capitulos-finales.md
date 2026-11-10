<!--
Borrador para pasar a Word. Las marcas [COMPLETAR] y [VERIFICAR] señalan datos que el repositorio
no tiene o que hay que confirmar antes de entregar. Numerar las tablas e ilustraciones según la
secuencia del documento final (aquí van como "Tabla X").
Precios y honorarios relevados el 15/10/2026.
-->

# Resumen

Hornero es un prototipo de plataforma web que busca resolver un problema de la asistencia alimentaria comunitaria en Córdoba: muchas organizaciones (comedores y merenderos) no tienen personería jurídica y no pueden acreditarse ante los canales formales. Por eso las donaciones se concentran en las organizaciones más visibles en redes sociales y dejan desatendidas otras zonas. El trabajo propone tres ejes. El primero es un modelo de acreditación progresiva en cuatro niveles acumulativos, basado en evidencias auditadas por un administrador y alineado con los requisitos de la Fundación Banco de Alimentos de Córdoba. El segundo es un motor de asignación que distribuye las donaciones del fondo común por rondas, con el algoritmo húngaro. Pondera la vulnerabilidad territorial, calculada con datos del ReNaCoM y del Censo 2022, junto con la urgencia y el tiempo de espera. El tercero es la trazabilidad de cada donación, con una bitácora de sólo agregado y entregas confirmadas con códigos de un solo uso. El sistema se construyó con una arquitectura de servicios: Spring Boot, NestJS como Backend For Frontend, React, Astro, Go y PostgreSQL. Está desplegado en producción sobre una Raspberry Pi 5 publicada mediante Cloudflare Tunnel, con un costo operativo cercano a cero. Se validó con unas 1.950 pruebas automatizadas y 95 pruebas de extremo a extremo. Como resultado, se cumplieron los objetivos de acreditación, asignación y trazabilidad. La reasignación automática de donaciones no retiradas quedó planteada como trabajo futuro.

**Palabras clave:** acreditación progresiva, trazabilidad, asignación de donaciones, seguridad alimentaria, vulnerabilidad territorial.

<!-- El resumen tiene unas 230 palabras, dentro del rango de 150 a 250. Si se edita, volver a contarlas. -->

---

# Abstract

Hornero is a prototype web platform that addresses a problem in community food assistance in Córdoba, Argentina: many organizations (soup kitchens and community kitchens) lack legal status and cannot be accredited through formal channels. As a result, donations concentrate on the organizations most visible on social media, while other areas remain underserved. The work proposes three pillars. The first is a progressive accreditation model with four cumulative levels, based on evidence audited by an administrator and aligned with the requirements of the Córdoba Food Bank Foundation. The second is an allocation engine that distributes pooled donations in rounds using the Hungarian algorithm. It weighs territorial vulnerability, computed from ReNaCoM and 2022 Census data, together with urgency and waiting time. The third is the traceability of each donation, through an append-only log and deliveries confirmed with single-use codes. The system was built on a service architecture: Spring Boot, NestJS as a Backend For Frontend, React, Astro, Go and PostgreSQL. It runs in production on a Raspberry Pi 5 exposed through Cloudflare Tunnel, at a near-zero operating cost. It was validated with about 1,950 automated tests and 95 end-to-end tests. As a result, the accreditation, allocation and traceability objectives were met. Automatic reassignment of uncollected donations remains future work.

**Keywords:** progressive accreditation, traceability, donation allocation, food security, territorial vulnerability.

---

# Seguridad

A continuación se describen dos componentes esenciales de la seguridad del sistema: el control de acceso a la aplicación y la política de respaldo de la información.

## Acceso a la aplicación

### Registro y validación de usuarios

Para operar en el sistema, el usuario debe registrarse con nombre, correo electrónico y contraseña, y elegir su rol: donante o referente de una organización. El sitio público funciona sin cuenta, ya que sólo muestra información anónima. Todas las funciones que modifican datos exigen una sesión iniciada.

Después del registro, el sistema verifica que el correo pertenezca al usuario. Para eso envía un código de un solo uso (OTP) de seis dígitos, con estas condiciones:

- El código vence a los 15 minutos.
- Se almacena con hash, nunca en texto plano.
- Se bloquea después de cinco intentos fallidos.
- Admite como máximo tres reenvíos cada 15 minutos, con una espera mínima de 60 segundos entre uno y otro.

Mientras el correo no esté verificado, el usuario no puede donar. El sistema rechaza la operación con el error `EMAIL_NO_VERIFICADO`. El estado de verificación se consulta en la base de datos en cada operación y no se toma del token de sesión. Así se evita que un token emitido antes de la verificación habilite acciones sensibles.

### Política de contraseñas

La política de contraseñas sigue las recomendaciones vigentes del NIST (SP 800-63B-4) y de OWASP (ASVS 5.0, sección V6.2). Esas recomendaciones priorizan la longitud y el rechazo de contraseñas conocidas por encima de las reglas de composición, porque esas reglas llevan a los usuarios a elegir contraseñas predecibles. Por eso el sistema exige:

- **Longitud:** entre 15 y 64 caracteres, sin superar 72 bytes, que es el límite de entrada del algoritmo BCrypt.
- **Composición:** no exige mayúsculas, números ni símbolos, siguiendo la recomendación del NIST.
- **Rechazo de contraseñas débiles:** el sistema rechaza las contraseñas que aparecen en una lista de contraseñas comunes, las derivadas del correo, del nombre del usuario o del nombre de la plataforma, y las cadenas repetitivas o secuenciales, como `aaaa…` o `1234…`.

Las contraseñas se almacenan con el algoritmo **BCrypt**, diseñado para el hash de contraseñas. BCrypt incorpora una sal aleatoria en cada hash, de modo que dos contraseñas iguales producen hashes distintos. Eso neutraliza los ataques con tablas *rainbow*. Además, su costo computacional configurable encarece los ataques de fuerza bruta. La contraseña nunca se devuelve en ninguna respuesta del sistema.

Para recuperar una contraseña olvidada, el usuario recibe un enlace con un token que vence a los 30 minutos.

### Sesiones y tokens

La autenticación usa tokens JWT firmados con HS256 por el microservicio de dominio. El token de acceso dura 15 minutos y el de renovación, 7 días. Las medidas principales son:

- Ambos tokens viajan en cookies `httpOnly` y `secure`. El código JavaScript del navegador no puede leerlas, lo que mitiga el robo de sesión mediante ataques XSS.
- El token de renovación **rota en cada uso**. Si se detecta que se reutiliza un token ya usado, se revoca toda la familia de sesiones. Los tokens también se revocan al cerrar sesión o al desactivar al usuario.
- El microservicio no arranca si la clave de firma (`JWT_SECRET`) no está configurada o mide menos de 32 bytes.
- Las peticiones que modifican datos verifican los encabezados `Origin` y `Referer` contra una lista de orígenes permitidos, como protección contra ataques CSRF.

### Protección contra fuerza bruta

El Backend For Frontend limita la cantidad de peticiones por dirección IP en los puntos sensibles:

| Operación | Límite por minuto |
|---|---|
| Inicio de sesión | 5 |
| Registro | 3 |
| Renovación de sesión | 20 |
| Verificación de OTP | 5 |
| Reenvío de OTP | 3 |
| Recuperación de contraseña | 3 |
| Restablecimiento de contraseña | 5 |

Tabla X: Límites de intentos por IP.
Fuente: Elaboración propia.

La dirección IP se toma del encabezado `cf-connecting-ip` que agrega Cloudflare. Como el servidor sólo es accesible a través del túnel de Cloudflare, ese encabezado no puede falsificarse desde afuera.

### Manejo de perfiles

El sistema define tres perfiles, implementados como una jerarquía de usuarios cuyo tipo viaja en el token de sesión:

| Perfil | Funciones habilitadas |
|---|---|
| **Administrador** | Audita las evidencias de acreditación y eleva o reduce el nivel de las organizaciones, siempre con un motivo registrado. Gestiona usuarios y organizaciones, dispara las rondas de asignación, consulta el registro de actividades y anonimiza usuarios a pedido. |
| **Referente** | Registra y gestiona su organización, adjunta evidencias de acreditación, publica necesidades, acepta o rechaza ofertas de donación, confirma entregas con el código de un solo uso y exporta el legajo de su organización. |
| **Donante** | Realiza donaciones directas a una necesidad o aportes al fondo común, sigue el estado de sus donaciones y valida la entrega. |
| **Visitante (sin cuenta)** | Consulta el sitio público: el mapa de organizaciones y necesidades, el mapa de vulnerabilidad y la información institucional. |

Tabla X: Perfiles del sistema.
Fuente: Elaboración propia.

El primer administrador se crea en el despliegue a partir de variables de entorno. El registro público no permite crear administradores.

El control de acceso se aplica en **tres capas independientes**:

1. **Microservicio de dominio (Spring Boot):** anotaciones `@PreAuthorize` por rol y controles de pertenencia, que verifican, por ejemplo, que un referente sólo modifique su propia organización. Es la autoridad final.
2. **Backend For Frontend (NestJS):** un guard global de roles y el decorador `@Roles(...)` en cada ruta. Una prueba automatizada fija la matriz de 62 rutas con los roles permitidos en cada una, de modo que cualquier cambio en los permisos hace fallar la prueba.
3. **Aplicación web (React):** rutas protegidas que redirigen según el rol. Su función es sólo de experiencia de usuario y no se considera una barrera de seguridad.

### Trazabilidad de la seguridad

El sistema mantiene un **registro de actividades inmutable** con los siguientes eventos:

- Los inicios de sesión exitosos y fallidos, y los cierres de sesión.
- La renovación y la reutilización de tokens.
- Los bloqueos de OTP y de códigos de entrega.
- Las acciones administrativas y los cambios de estado de donaciones y necesidades.

Un *trigger* de PostgreSQL rechaza cualquier modificación o borrado de este registro, salvo la purga automática por antigüedad, que ocurre a los 365 días. El registro sólo puede consultarlo el administrador.

En cuanto a los datos personales (Ley 25.326), se aplica el principio de minimización:

- La identidad del donante sólo la ven la organización receptora, el propio donante y los administradores.
- Las coordenadas de entrega se reducen a dos decimales a los 30 días de cerrada la donación.
- Los correos asociados a intentos de inicio de sesión fallidos se borran a los 90 días.
- El administrador puede anonimizar a un usuario a pedido del titular.

## Política de respaldo de información

La base de datos PostgreSQL concentra toda la información del sistema y es el objeto principal del respaldo. Las imágenes institucionales y las evidencias de acreditación se almacenan fuera del servidor, en el servicio de almacenamiento de objetos Cloudflare R2. El código fuente se versiona con Git en un repositorio de GitHub, que actúa como respaldo del software.

### Inicio del proceso

El respaldo se inicia de tres maneras:

- **Programado y automático:** un temporizador de systemd ejecuta el respaldo todos los días a las 03:15, con un retardo aleatorio de hasta 5 minutos. El temporizador es *persistente*: si el servidor estuvo apagado a esa hora, el respaldo se ejecuta al volver a encenderse.
- **Previo a cambios de esquema:** las tareas de migración de base de datos (`make migrate`) y de importación de datos (`make importar-renacom`) ejecutan un respaldo antes de modificar la base.
- **Manual:** un operador puede ejecutar `make backup` en cualquier momento, por ejemplo antes de una actualización del sistema.

### Software interviniente

El proceso tiene cuatro pasos:

1. **Volcado:** `pg_dump` genera un volcado de la base en formato comprimido (`-Fc`).
2. **Verificación:** el script comprueba que el archivo generado sea válido y legible antes de darlo por bueno.
3. **Cifrado:** la copia externa se cifra con AES-256, con la clave derivada mediante PBKDF2 (600.000 iteraciones). La frase de cifrado se guarda fuera del servidor, de modo que robar la copia no alcanza para leerla.
4. **Envío y poda:** la copia cifrada se sube al almacenamiento externo y se eliminan las copias que superan el plazo de retención.

Un segundo script, `restore-check.sh`, realiza el **simulacro de restauración**. Restaura la última copia en una base temporal y verifica su contenido.

### Hardware y lugar de almacenamiento

| Ubicación | Hardware o servicio | Retención | Protege contra |
|---|---|---|---|
| Copia local | Raspberry Pi 5, carpeta `backups/` | 14 días | Errores humanos y corrupción lógica, con restauración rápida |
| Copia externa | Bucket privado de Cloudflare R2, distinto del de imágenes, con credenciales propias | 30 días | Falla o robo del servidor, o falla de la tarjeta microSD |
| Código fuente | Repositorio en GitHub | Historial completo | Pérdida del equipo de desarrollo |

Tabla X: Ubicaciones de respaldo.
Fuente: Elaboración propia.

El script de respaldo se niega a ejecutarse si el bucket de respaldo coincide con el de imágenes. Así se evita mezclar datos públicos con copias de la base.

### Objetivos de recuperación

- **RPO (pérdida máxima tolerable de datos):** 24 horas, que es la frecuencia del respaldo diario.
- **RTO (tiempo máximo de restauración):** 4 horas, siguiendo el procedimiento documentado en el manual de despliegue.

### Factor humano

El respaldo diario no requiere intervención. Sí requieren personas las siguientes tareas:

| Rol | Responsabilidad | Responsable |
|---|---|---|
| Responsable de respaldos | Revisar periódicamente que el temporizador se haya ejecutado (`journalctl`) | [COMPLETAR] |
| Custodio de la frase de cifrado | Guardar `BACKUP_PASSPHRASE` fuera del servidor, en un gestor de contraseñas | [COMPLETAR] |
| Operador de restauración | Ejecutar el procedimiento de restauración ante un incidente | [COMPLETAR] |
| Responsable del simulacro | Ejecutar el simulacro de restauración una vez por cuatrimestre y registrar el resultado | [COMPLETAR] |

Tabla X: Roles del proceso de respaldo.
Fuente: Elaboración propia.

<!-- [VERIFICAR] antes de entregar:
  1. Que el timer hornero-backup.timer esté instalado y activo en la Pi y que el bucket R2 de respaldos exista
     (docs/acciones-pendientes-equipo.md, sección 4). Si no lo está, redactar este apartado en futuro ("se realizará").
  2. Que se haya corrido al menos un `make restore-check` exitoso.
  3. Los responsables (hoy "A designar" en docs/politica-datos-y-respaldo.md).
  Riesgo residual a declarar si se quiere ser exhaustivo: las imágenes y evidencias en R2 no tienen copia propia. -->

---

# Análisis de costos

A continuación se presentan los costos de desarrollo y los costos operativos del proyecto.

Los honorarios se tomaron de la tabla de honorarios recomendados del Consejo Profesional de Ciencias Informáticas de la Provincia de Córdoba, actualizada a agosto de 2026 por el índice IPIM (CPCIPC, 2026). Los precios en dólares se convirtieron con la cotización del dólar billete del Banco de la Nación Argentina del 15/10/2026, de **$1.530** para la venta.

## Costos de desarrollo

El prototipo fue desarrollado por una sola persona entre junio y octubre de 2026. Para estimar el valor de mercado del trabajo, se presenta el equipo que habría hecho falta para construir la solución en cuatro meses. Las tareas de cada rol se asignaron según los componentes reales del sistema.

| Rol | Tareas principales | Cantidad | Tiempo | Honorario mensual | Subtotal |
|---|---|---|---|---|---|
| Líder de proyectos de desarrollo de software | Planificación, gestión del backlog Scrum y seguimiento de riesgos | 1 | 4 meses | $ 3.148.193,81 | $ 12.592.775,24 |
| Analista funcional senior | Relevamiento con organizaciones y con el Banco de Alimentos, requerimientos y casos de uso | 1 | 2 meses | $ 2.280.319,47 | $ 4.560.638,94 |
| Arquitecto de software | Arquitectura de servicios, modelo de datos y decisiones de diseño | 1 | 1 mes | $ 4.197.573,80 | $ 4.197.573,80 |
| Desarrollador backend | Microservicio de dominio (Java/Spring Boot), Backend For Frontend (NestJS) y motor de asignación (Go) | 2 | 4 meses | $ 3.420.061,79 | $ 27.360.494,32 |
| Desarrollador frontend | Panel autenticado (React/Vite) y sitio público con mapas (Astro) | 1 | 3 meses | $ 3.245.019,26 | $ 9.735.057,78 |
| Diseñador UX/UI | Prototipos de interfaces y sistema de diseño | 1 | 1 mes | $ 2.552.564,47 | $ 2.552.564,47 |
| Analista QA | Plan de pruebas, pruebas de extremo a extremo y validación de seguridad | 1 | 2 meses | $ 2.800.680,52 | $ 5.601.361,04 |
| DevOps | Contenedores, despliegue en Raspberry Pi y Cloudflare Tunnel, respaldos | 1 | 1 mes | $ 4.663.631,27 | $ 4.663.631,27 |
| **Total** | | | | | **$ 71.264.096,86** |

Tabla X: Costos de desarrollo.
Fuente: Elaboración propia sobre la base de CPCIPC (2026).

## Costos operativos

### Hardware

| Recurso | Costo unitario | Cantidad | Fuente | Subtotal |
|---|---|---|---|---|
| Raspberry Pi 5, 8 GB de RAM [VERIFICAR RAM] | $ 375.000 | 1 | Mercado Libre Argentina, vía https://mejorescompras.com.ar/precio/MLA32625223 | $ 375.000,00 |
| Fuente oficial Raspberry Pi 27 W USB-C | USD 11,99 ($ 18.344,70) | 1 | https://www.waveshare.com/product/accessories/power-heat-sinks/power-supply/raspberry-pi-5-official-27w-psu.htm | $ 18.344,70 |
| Tarjeta microSD SanDisk Extreme 128 GB | $ 74.022 | 1 | Mercado Libre Argentina, vía https://mejorescompras.com.ar/precio/MLA36737789 | $ 74.022,00 |
| Equipo de desarrollo (notebook) | [COMPLETAR] | 1 | [COMPLETAR] | [COMPLETAR] |
| **Total hardware** | | | | **$ 467.366,70** + notebook |

Tabla X: Costos de hardware.
Fuente: Elaboración propia.

### Servicios (12 meses de operación)

| Servicio | Plan | Costo mensual | Fuente | Subtotal anual |
|---|---|---|---|---|
| Dominio `elhornero.org` (Cloudflare Registrar) | Renovación anual al costo | USD 10,13 por año | https://domainoffer.net/tld/org/cloudflare | $ 15.498,90 |
| Cloudflare Tunnel y DNS | Gratuito | $ 0 | https://www.cloudflare.com/plans/ | $ 0 |
| Cloudflare R2 (imágenes, evidencias y respaldos) | Gratuito hasta 10 GB por mes; luego USD 0,015 por GB | $ 0 | https://developers.cloudflare.com/r2/pricing/ | $ 0 |
| Resend (correo transaccional) | Gratuito: 3.000 correos por mes, 100 por día | $ 0 | https://resend.com/pricing | $ 0 |
| GitHub (repositorio) | Gratuito | $ 0 | https://github.com/pricing | $ 0 |
| Energía eléctrica del servidor | Unos 6 kWh por mes | [COMPLETAR tarifa EPEC] | [COMPLETAR] | [COMPLETAR] |
| **Total servicios** | | | | **$ 15.498,90** + energía |

Tabla X: Costos de servicios.
Fuente: Elaboración propia.

### Software

Todo el software es gratuito o de código abierto, por lo que el costo de licencias es **$0**: Java y Spring Boot, Node.js y NestJS, React, Vite, Astro, Go, PostgreSQL, Docker, Visual Studio Code, Git y PlantUML. Los datos abiertos utilizados (ReNaCoM y Censo 2022) tampoco tienen costo, ya que se publican bajo licencias que permiten su reutilización con atribución.

## Costo total

| Concepto | Monto |
|---|---|
| Costos de desarrollo | $ 71.264.096,86 |
| Costos operativos (hardware y primer año de servicios) | $ 482.865,60 |
| **Total** | **$ 71.746.962,46** |

Tabla X: Costo total del proyecto.
Fuente: Elaboración propia.

<!-- Si se completa la notebook y la energía, sumar ambos valores a "Costos operativos" y al total. -->

El costo operativo mensual del sistema en producción es casi nulo. Los servicios se mantienen dentro de los planes gratuitos, el servidor consume poca energía y el único gasto recurrente es la renovación anual del dominio. El análisis de escalabilidad del proyecto estima cuánto crecería el costo con más uso:

- **Etapa intermedia:** entre USD 2 y USD 25 por mes. Implica reemplazar la microSD por un disco SSD NVMe y pasar a un plan pago de correo.
- **Etapa de mayor escala:** entre USD 40 y USD 150 por mes. Implica migrar a un servidor virtual o a una base de datos gestionada.

---

# Análisis de riesgos

A continuación se analizan los riesgos detectados para el desarrollo y la operación del proyecto. Para cada uno se identificaron su causa, la probabilidad de que ocurra y el impacto que tendría en el proyecto.

La probabilidad se expresa como porcentaje y se clasifica en tres niveles:

| Nivel | Rango |
|---|---|
| **Alta** | 60 % o más |
| **Intermedia** | 30 % a 59 % |
| **Baja** | menos de 30 % |

El impacto se mide en una escala de 1 (bajo) a 5 (muy alto). La estimación toma como horizonte el período de desarrollo (junio a octubre de 2026) y el primer año de operación.

## Identificación de riesgos

| Id | Riesgo | Causa | Probabilidad | Impacto |
|---|---|---|---|---|
| R1 | Subestimación de los tiempos de desarrollo | Componentes de complejidad alta y sin antecedentes, como el motor de asignación y la acreditación por evidencias | Alta (75 %) | 4 |
| R2 | Cambios en los requerimientos | Requisitos de acreditación que surgieron durante el relevamiento con el Banco de Alimentos | Alta (70 %) | 4 |
| R3 | Disponibilidad de un único desarrollador | Proyecto desarrollado por una sola persona: una enfermedad o una ausencia frena todo el trabajo | Intermedia (50 %) | 5 |
| R4 | Falta de validación con organizaciones reales | Dificultad para coordinar pruebas piloto con comedores y merenderos dentro del plazo académico | Intermedia (50 %) | 4 |
| R5 | Pérdida de datos | Falla de la tarjeta microSD del servidor o error humano en una migración | Intermedia (30 %) | 5 |
| R6 | Dependencia de datos abiertos | Los datasets ReNaCoM y Censo 2022 pueden quedar desactualizados, cambiar de formato o de licencia | Intermedia (50 %) | 3 |
| R7 | Interrupción del servicio | Corte de energía o de internet en el lugar físico del servidor | Intermedia (40 %) | 3 |
| R8 | Incremento de costos | Inflación y variación del tipo de cambio sobre el hardware y los servicios en dólares | Intermedia (40 %) | 2 |
| R9 | Incidente de seguridad | Acceso indebido a cuentas o a datos personales | Baja (15 %) | 5 |
| R10 | Caída de servicios de terceros | Indisponibilidad de Cloudflare o de Resend | Baja (15 %) | 3 |

Tabla X: Identificación de riesgos.
Fuente: Elaboración propia.

## Análisis cuantitativo

El grado de exposición de cada riesgo se calcula como el producto de su probabilidad y su impacto:

| Impacto / Probabilidad | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| **Alta (70 % – 0,7)** | 0,7 | 1,4 | 2,1 | 2,8 | 3,5 |
| **Intermedia (50 % – 0,5)** | 0,5 | 1,0 | 1,5 | 2,0 | 2,5 |
| **Intermedia (30 % – 0,3)** | 0,3 | 0,6 | 0,9 | 1,2 | 1,5 |
| **Baja (15 % – 0,15)** | 0,15 | 0,3 | 0,45 | 0,6 | 0,75 |

Tabla X: Matriz de probabilidad e impacto.
Fuente: Elaboración propia.

La siguiente tabla ordena los riesgos de mayor a menor exposición:

| Id | Riesgo | Probabilidad | Impacto | Exposición | % relativo | % acumulado |
|---|---|---|---|---|---|---|
| R1 | Subestimación de los tiempos | 75 % | 4 | 3,00 | 18,18 % | 18,18 % |
| R2 | Cambios en los requerimientos | 70 % | 4 | 2,80 | 16,97 % | 35,15 % |
| R3 | Disponibilidad de un único desarrollador | 50 % | 5 | 2,50 | 15,15 % | 50,30 % |
| R4 | Falta de validación con organizaciones reales | 50 % | 4 | 2,00 | 12,12 % | 62,42 % |
| R5 | Pérdida de datos | 30 % | 5 | 1,50 | 9,09 % | 71,52 % |
| R6 | Dependencia de datos abiertos | 50 % | 3 | 1,50 | 9,09 % | 80,61 % |
| R7 | Interrupción del servicio | 40 % | 3 | 1,20 | 7,27 % | 87,88 % |
| R8 | Incremento de costos | 40 % | 2 | 0,80 | 4,85 % | 92,73 % |
| R9 | Incidente de seguridad | 15 % | 5 | 0,75 | 4,55 % | 97,27 % |
| R10 | Caída de servicios de terceros | 15 % | 3 | 0,45 | 2,73 % | 100,00 % |
| | **Total** | | | **16,50** | **100 %** | |

Tabla X: Nivel de exposición al riesgo.
Fuente: Elaboración propia.

## Principio de Pareto

Para el diagrama de Pareto se ordenan los riesgos por exposición: las barras muestran la exposición de cada riesgo y una línea muestra el porcentaje acumulado.

<!-- Armar el gráfico en Excel: columnas Id / Exposición / % acumulado de la tabla anterior;
     Insertar > Gráfico > Histograma > Pareto (o barras + línea en eje secundario). Insertarlo como "Ilustración X: Diagrama de Pareto". -->

Ilustración X: Diagrama de Pareto de los riesgos.
Fuente: Elaboración propia.

Los riesgos R1 a R6 concentran el 80,6 % de la exposición total, por lo que se los considera **críticos**. El resultado se aparta del 80/20 clásico: hace falta el 60 % de los riesgos para llegar al 80 % de la exposición. Esto indica que la exposición está repartida en varios frentes y no concentrada en uno o dos riesgos dominantes. Aun así, los tres primeros (tiempos, requerimientos y dependencia de una sola persona) explican la mitad de la exposición. Todos son riesgos de gestión del proyecto y no técnicos, por lo que concentran el esfuerzo de mitigación.

Dos riesgos técnicos que suelen ser críticos quedaron en la zona de baja exposición: el incidente de seguridad (R9) y la pérdida de datos (R5). En los dos casos se debe a que ya se implementaron controles que redujeron su probabilidad. Son los controles descritos en el capítulo de Seguridad: la política de contraseñas, la limitación de intentos, el control de acceso en tres capas y el respaldo diario cifrado con copia externa.

## Plan de contingencia

| Id | Riesgo | Acciones de mitigación (antes de que ocurra) | Contingencia (si ocurre) |
|---|---|---|---|
| R1 | Subestimación de los tiempos | Dividir el trabajo en unidades de alrededor de 400 líneas, cada una con sus pruebas, y priorizar el backlog por los tres ejes del objetivo | Reducir el alcance a lo esencial de cada eje y pasar el resto a trabajo futuro, como se hizo con la reasignación automática |
| R2 | Cambios en los requerimientos | Documentar cada cambio con su especificación y sus decisiones de diseño antes de implementarlo, y validar los prototipos de interfaz antes de construir | Evaluar el impacto del cambio sobre las especificaciones vigentes y aceptarlo sólo si no compromete un objetivo; si no, registrarlo como mejora futura |
| R3 | Disponibilidad de un único desarrollador | Dejar documentación de traspaso y manuales de despliegue, y mantener cada tarea en una rama con su registro de avance | Retomar el trabajo desde el último punto documentado; el despliegue reproducible con Docker permite que otra persona continúe |
| R4 | Falta de validación con organizaciones reales | Contactar con anticipación a referentes del relevamiento y preparar datos de demostración realistas | Validar con escenarios de extremo a extremo que reproducen los flujos relevados y planificar un piloto posterior a la entrega |
| R5 | Pérdida de datos | Respaldo diario automático, cifrado y con copia externa; respaldo previo a cada migración; simulacro de restauración por cuatrimestre | Restaurar la última copia válida siguiendo el procedimiento documentado (RTO de 4 horas, pérdida máxima de 24 horas de datos) |
| R6 | Dependencia de datos abiertos | Guardar una copia local de los datasets usados, con su fecha y su fuente | Si falta el dato poblacional, el término de déficit del motor usa un valor neutro y la asignación sigue funcionando con urgencia y tiempo de espera |
| R7 | Interrupción del servicio | El servicio se reinicia solo al volver la energía y el temporizador de respaldo es persistente | Publicar un aviso de indisponibilidad; si se repite, migrar a un servidor virtual (etapa de mayor escala del análisis de escalabilidad) |
| R8 | Incremento de costos | Usar los planes gratuitos y hardware de bajo costo | Mantener los planes gratuitos el mayor tiempo posible y escalar por etapas |
| R9 | Incidente de seguridad | Controles del capítulo de Seguridad y una matriz de 21 riesgos de seguridad con evidencia de prueba | Revocar las sesiones, rotar `JWT_SECRET` y analizar el registro de actividades inmutable |
| R10 | Caída de servicios de terceros | Desacoplar el envío de correos detrás de una interfaz intercambiable | Cambiar de proveedor de correo sin modificar el dominio; en Cloudflare, publicar por un puerto alternativo de forma temporal |

Tabla X: Plan de contingencia.
Fuente: Elaboración propia.

---

# Conclusiones

El proyecto **Hornero — Sistema de acreditación, asignación priorizada y trazabilidad de donaciones de alimentos** surgió de un problema observado en el relevamiento. Muchos comedores y merenderos de Córdoba funcionan sin personería jurídica y no pueden acreditarse ante los canales formales. El alta en el Banco de Alimentos demora al menos cuatro meses. Mientras tanto, las donaciones informales se concentran en las organizaciones con más presencia en redes sociales. El resultado es que la ayuda no llega según la necesidad real de cada zona y nadie puede verificar si llegó.

El objetivo general fue desarrollar un prototipo funcional que acredite a estas organizaciones y asigne las donaciones según la vulnerabilidad, la urgencia y las restricciones logísticas, con control y transparencia. A continuación se analiza cada objetivo específico.

| Objetivo específico | Grado de cumplimiento | Cómo se logró |
|---|---|---|
| Diseñar un modelo de acreditación progresiva | Cumplido | Escalera de cuatro niveles acumulativos (Registrada, Identificada, Operativa, Acreditada), con un catálogo de ocho requisitos tomados de las fuentes del Banco de Alimentos. Cada evidencia la audita un administrador, y el nivel más alto equivale a estar en condiciones de solicitar el alta en el Banco. El nivel limita la categoría y la concurrencia de las donaciones que una organización puede recibir. |
| Construir un motor de asignación que priorice los pedidos | Cumplido | Servicio en Go que resuelve cada ronda con el algoritmo húngaro. Pondera el déficit de cobertura territorial, la urgencia y el tiempo de espera, e incluye un término contra la postergación indefinida. Cada asignación guarda su puntaje y su costo de oportunidad, de modo que la decisión puede explicarse. |
| Implementar reasignaciones automáticas de donaciones no retiradas | No cumplido; replanteado | Durante el diseño se decidió dejarlo fuera del alcance del prototipo y plantearlo como problema abierto. Hoy un proceso periódico detecta las ofertas estancadas, pero la reasignación automática a otra organización no está implementada. |
| Implementar la trazabilidad del ciclo de la donación | Cumplido | Cada donación tiene un identificador único y una máquina de estados explícita. La entrega se confirma con un código de un solo uso que vence a los 10 minutos y se bloquea tras cinco intentos. Los cambios de acreditación quedan en una bitácora de sólo agregado, y las acciones relevantes, en un registro de actividades inmutable. |
| Generar indicadores de cobertura y de zonas desatendidas | Cumplido parcialmente | Mapa público de vulnerabilidad que combina el registro ReNaCoM, la población del Censo 2022 y la demanda declarada en la plataforma. El mismo valor alimenta el motor de asignación. Queda pendiente la representación por radio censal con alto nivel de detalle. |
| Elaborar legajos exportables | Cumplido | Vista imprimible del legajo con el nivel, los requisitos y el historial de evidencias de la organización. El referente puede exportar el de su propia organización para presentarlo ante bancos de alimentos u organismos públicos. |

Tabla X: Cumplimiento de los objetivos específicos.
Fuente: Elaboración propia.

<!-- [VERIFICAR] fila "indicadores": docs/mapa-vulnerabilidad.md figura "in progress". Si se termina antes de la entrega, pasar a "Cumplido". -->

El prototipo no quedó en un entorno de pruebas: está **desplegado en producción** en `elhornero.org`. Corre sobre una Raspberry Pi 5 publicada mediante Cloudflare Tunnel, con un costo operativo mensual casi nulo. Esto demuestra que una solución de este tipo es sostenible para una organización sin fines de lucro. La calidad se respaldó con unas 1.950 pruebas unitarias y de integración y 95 pruebas de extremo a extremo. La cobertura alcanzó el 90,7 % en el microservicio de dominio y el 95,8 % en el Backend For Frontend. Las pruebas permitieron detectar y corregir seis defectos antes de la entrega.

Quedan como **líneas de trabajo futuro**:

- La reasignación automática de donaciones no retiradas.
- Un piloto con organizaciones reales.
- La incorporación del historial de cumplimiento al puntaje de asignación.
- La migración a un almacenamiento más robusto que la microSD, a medida que crezca el uso.

<!-- [COMPLETAR con voz propia] Los dos párrafos siguientes son un borrador: la consigna pide la mirada profesional y personal del autor. -->

Desde el punto de vista profesional, el proyecto me permitió diseñar y construir un sistema distribuido completo, desde el relevamiento hasta la operación en producción. Integré servicios en cuatro lenguajes (Java, TypeScript, Go y SQL) bajo un mismo modelo de seguridad. Trabajé con desarrollo guiado por especificaciones, registrando decisiones de arquitectura, y apliqué estándares actuales de seguridad, como NIST SP 800-63B y OWASP ASVS. También resolví un problema de optimización real con un algoritmo de asignación y operé la infraestructura: contenedores, túnel, respaldos y monitoreo.

En lo personal, el trabajo me acercó a la realidad de los comedores y merenderos de Córdoba y a cómo se organiza la ayuda alimentaria en el territorio. Me mostró que el problema no es sólo técnico, sino de confianza entre quienes donan y quienes reciben. También me dejó la experiencia de sostener un proyecto de largo plazo en forma individual y de aprender a priorizar y recortar el alcance sin perder de vista el objetivo.

---

# Anexos (sugeridos)

Incluir sólo lo esencial:

1. **Matriz de riesgos de seguridad** (21 riesgos, con su medida y la evidencia de prueba). Fuente: `docs/seguridad-matriz-riesgos.md`.
2. **Matriz de roles y rutas** (62 rutas por rol). Fuente: `ts_hornero_bff/src/auth/role-matrix.spec.ts`.
3. **Procedimiento de restauración de respaldos.** Fuente: `docs/deploy-rpi-cloudflare.md`, sección C.5.
4. **Reporte de validación y calidad** (pruebas, cobertura y defectos corregidos). Fuente: `docs/validacion-calidad.md`.
5. **Enlace al sistema en producción y al repositorio**, con credenciales de demostración si la cátedra las pide.

---

# Referencias de este apartado

- Banco de la Nación Argentina. (2026). *Cotización del dólar billete* [15/10/2026]. https://www.bna.com.ar/Personas
- Cloudflare. (2026). *R2 pricing*. https://developers.cloudflare.com/r2/pricing/
- Consejo Profesional de Ciencias Informáticas de la Provincia de Córdoba. (2026). *Honorarios recomendados* (actualización 08-2026). https://cpcipc.org.ar/honorarios-recomendados/
- National Institute of Standards and Technology. (2025). *Digital Identity Guidelines: Authentication and Authenticator Management* (SP 800-63B-4). https://pages.nist.gov/800-63-4/sp800-63b.html
- OWASP Foundation. (2025). *Application Security Verification Standard 5.0*. https://owasp.org/www-project-application-security-verification-standard/
- Resend. (2026). *Pricing*. https://resend.com/pricing
- Ley 25.326 de Protección de los Datos Personales. (2000). República Argentina.


Fuentes:
- CPCIPC — Honorarios recomendados
- BNA — Cotización
- Cloudflare R2 pricing
- Resend pricing
- Precio .org en Cloudflare
- Raspberry Pi 5 en Mercado Libre
- microSD en Mercado Libre
- Fuente 27W oficial


https://cpcipc.org.ar/honorarios-recomendados/