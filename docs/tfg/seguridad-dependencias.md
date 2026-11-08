# Seguridad C6: dependencias y secretos

Fecha: 2026-11-08. Alcance: `ts_hornero_bff`, `ts_hornero_admin`, `ts_hornero_astro`, `e2e`, `go_algorithms_worker`, `jar_hornero_ms`. `ts_hornero_app` está en desuso y se excluye.

## Herramientas

| Herramienta | Versión | Uso |
|---|---|---|
| npm audit | npm incluido en el entorno local | módulos Node |
| govulncheck | última disponible (`@latest`), Go 1.26.0 | módulo Go |
| Maven versions plugin | `versions:display-dependency-updates` | actualizaciones Maven |
| OWASP dependency-check | 13.0.0 | no se pudo ejecutar (ver abajo) |
| gitleaks | 8.30.1, `gitleaks git --redact` | historial completo |

## Hallazgos de npm audit (antes y después)

| Módulo | Antes (crítica / alta / moderada / baja) | Después | Acción |
|---|---|---|---|
| ts_hornero_bff | 2 / 10 / 20 / 2 | 0 / 2 / 23 / 5 | `npm audit fix` sin `--force`; `multer` directo a `^2.5.0` |
| ts_hornero_admin | 0 / 12 / 14 / 0 | 0 / 0 / 13 / 0 | `npm audit fix` sin `--force` |
| ts_hornero_astro | 1 / 13 / 5 / 0 | 0 / 0 / 0 / 0 | `npm audit fix` sin `--force` |
| e2e | 2 / 0 / 1 / 0 | sin cambios | requiere salto mayor |

## Qué queda y por qué

| Módulo | Pendiente | Motivo |
|---|---|---|
| ts_hornero_bff | 2 altas: `@nestjs/platform-express` y `multer` anidado (2.4.0) | `@nestjs/platform-express` 11.2.8, última publicada, fija `multer` 2.4.0; no hay versión corregida upstream |
| ts_hornero_bff, ts_hornero_admin | moderadas y bajas | no se evaluaron para corrección; el criterio fue corregir solo altas y críticas |
| e2e | 2 críticas (`vitest`, `tinypool`) | la corrección es `vitest@5.1.0`, salto mayor; no se aplicó |
| go_algorithms_worker | 22 vulnerabilidades de la biblioteca estándar alcanzables (corregidas en Go 1.26.10), más 13 en paquetes importados y 12 en módulos requeridos sin llamadas detectadas | `Dockerfile` usa `golang:1.26-alpine` (etiqueta flotante), de modo que reconstruir la imagen incorpora el parche; `go.mod` indica `go 1.26.0` y no se modificó |
| jar_hornero_ms | sin análisis de vulnerabilidades | OWASP dependency-check falló con "Error updating the NVD Data" (sin clave NVD); no hay resultado |

Maven: `versions:display-dependency-updates` informa numerosas actualizaciones disponibles (por ejemplo `jackson-databind` 2.15.4 a 2.23.0, `logback` 1.4.14 a 1.6.6), derivadas del padre `spring-boot-starter-parent` 3.2.5. No se modificó nada; la actualización corresponde a subir el padre de Spring Boot y requiere revisión propia.

## Verificación posterior a los cambios

| Comando | Resultado |
|---|---|
| `mvn test` (jar_hornero_ms) | 1116 pruebas, 0 fallos, BUILD SUCCESS |
| `npm test` + `npm run build` (ts_hornero_bff) | 445 pruebas pasan; build correcto |
| `npm test` + `npm run build` (ts_hornero_admin) | 698 pruebas pasan; build correcto |
| `npm run build` (ts_hornero_astro) | build correcto (el módulo no define pruebas) |

Nota: en una primera corrida, `ReclamoServiceTest.crear_onSinReclamar_persistsPendingClaimAndLogsActivity` falló una vez porque el nombre generado aleatoriamente contenía "555" y la prueba exige que el detalle no lo contenga. Es una prueba intermitente ajena a estos cambios; la corrida completa posterior pasó.

## Secretos (gitleaks)

Se analizó el historial completo con `--redact`; no se imprimió ni guardó ningún valor. Resultado: 9 hallazgos, todos de la regla `generic-api-key`.

| Archivo | Commit |
|---|---|
| `.env.example` | 02e92d9a |
| `jar_hornero_ms/src/test/java/org/example/auth/JwtServiceTest.java` | 1901288b |
| `jar_hornero_ms/src/test/java/org/example/auth/PasswordPolicyTest.java` | bc2543a7 |
| `jar_hornero_ms/src/test/resources/application.yml` | 54710d28 |
| `ts_hornero_admin/src/lib/axios.test.ts` | 02e680cb |
| `ts_hornero_bff/README.md` | a615bf59 |
| `ts_hornero_bff/src/auth/dto/password-reset.dto.spec.ts` | 7d1535cd |
| `ts_hornero_bff/src/auth/dto/register.dto.spec.ts` | bc2543a7 |
| `ts_hornero_bff/src/common/client-ip.spec.ts` | f810beb5 |

Todos están en archivos de prueba, documentación o plantilla, lo que sugiere valores de ejemplo, pero no se confirmó cada uno; requiere revisión humana. No se reescribió el historial.

## Dependabot

Se agregó `.github/dependabot.yml` (npm por directorio, gomod, maven y docker). No existe un flujo de trabajo en `.github/`; Dependabot solo actúa si el repositorio está en GitHub con la función habilitada.
