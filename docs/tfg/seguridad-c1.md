# Seguridad C1: hash de contraseñas

Fecha: 2026-11-08.

## Qué existía

| Elemento | Ubicación | Estado previo |
|---|---|---|
| Algoritmo | `jar_hornero_ms/src/main/java/org/example/config/ApplicationConfig.java:14` | `new BCryptPasswordEncoder()`, costo por defecto 10 |
| Límite de 72 bytes | `jar_hornero_ms/src/main/java/org/example/auth/PasswordPolicy.java:39` (`MAX_UTF8_BYTES = 72`) | Rechaza la contraseña en lugar de truncarla |
| Prueba del límite | `jar_hornero_ms/src/test/java/org/example/auth/PasswordPolicyTest.java:55` (`multibyteWithin64CodePointsButOver72Bytes_rejectedAsTooLong`) | Existente, cubre contraseñas multibyte con más de 72 bytes |

## Qué cambió

| Cambio | Ubicación |
|---|---|
| Costo BCrypt 10 a 12 mediante la constante `BCRYPT_COST` | `ApplicationConfig.java` |
| Prueba nueva `newHashesUseCost12` (hash nuevo con prefijo `$2a$12$`) | `jar_hornero_ms/src/test/java/org/example/config/ApplicationConfigPasswordEncoderTest.java` |
| Prueba nueva `existingCost10HashesStillVerify` (un hash de costo 10 sigue verificando con el codificador de costo 12) | mismo archivo |

La prueba `newHashesUseCost12` falló antes del cambio (RED) y pasa después (GREEN). Los hashes existentes no se migran: BCrypt almacena el costo dentro del hash, por lo que los de costo 10 se verifican sin cambios.

## Impacto del bean compartido

El bean `BCryptPasswordEncoder` se inyecta en varios servicios, de modo que todos pasan a costo 12:

| Servicio | Uso |
|---|---|
| `auth/AuthService.java` | login (`matches`) y registro (`encode`) |
| `auth/otp/OtpService.java` | código OTP (`encode`, `matches` por intento) |
| `auth/reset/PasswordResetService.java` | nueva contraseña tras reset |
| `donacion/entrega/EntregaService.java` | código de entrega (`encode`, `matches` por intento) |
| `user/UsuarioAnonimizacionService.java` | secreto descartable al anonimizar |
| `config/DataInitializer.java` | usuarios semilla al arrancar |

Medición local (Apple M3 Pro, JVM, promedio de 5 codificaciones tras calentamiento): costo 10 = 64 ms, costo 12 = 256 ms por operación (4 veces). En la Raspberry Pi no se midió; es esperable un tiempo mayor, por lo que conviene medirlo allí antes de desplegar. No se separó el bean: ninguna prueba ni diseño existente lo exige. Si la latencia por intento de OTP o de código de entrega resultara excesiva en la Pi, la alternativa es un segundo bean con costo menor para esos códigos de corta vida.
