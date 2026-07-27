# Implementation Plan — Email OTP Validation

## Goal

Require users to confirm ownership of their email address with a one-time
password (OTP) before their account becomes usable. A newly registered user
stays **inactive** until they submit a valid 6-digit code sent to their inbox.

## Why this fits the current design

The MS already has the activation gate we need:

- `AuthService.register` (jar_hornero_ms) creates the user and issues tokens
  immediately, passing `activo = true`.
- `AuthService.login` already rejects any user with `activo == false` with
  `401 "Credenciales inválidas"` (`Usuario.isActivo()` check).

So the OTP feature is mostly: **register inactive → verify OTP → flip `activo` to
true → issue tokens**. We are not inventing a new state machine; we are using the
`activo` flag that already exists on `Usuario`.

The MS is the JWT issuer and the real authority, so **all OTP logic lives in the
MS**. The BFF stays a thin proxy (it only forwards and sets cookies), and the
frontend gets one new screen.

---

## Architecture overview

```
Register
  App  POST /auth/register        →  BFF  →  MS  register(activo=false)
                                                 ├─ generate OTP
                                                 ├─ persist hashed OTP + expiry
                                                 └─ send email (JavaMailSender)
  MS returns { email, requiresVerification: true }   ← NO tokens, NO cookies yet

Verify
  App  POST /auth/verify-otp      →  BFF  →  MS  verifyOtp(email, code)
                                                 ├─ validate code/expiry/attempts
                                                 ├─ set activo=true
                                                 └─ return AuthResponse (tokens)
  BFF sets access_token / refresh_token / session_hint cookies   ← same as login today

Resend
  App  POST /auth/resend-otp      →  BFF  →  MS  resendOtp(email)  (rate-limited)
```

**Key contract change:** `register` no longer returns tokens. The session is only
established after a successful `verify-otp`. This is the single behavioral break
the frontend must adapt to.

---

## Part 1 — MS (jar_hornero_ms, Spring Boot)

### 1.1 Add the mail dependency

`pom.xml` currently has **no** mail starter. Add:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-mail</artifactId>
</dependency>
```

### 1.2 SMTP configuration

`application.yml` — read credentials from env vars (never hardcode). Railway can
inject these as service variables.

```yaml
spring:
  mail:
    host: ${MAIL_HOST:smtp.gmail.com}
    port: ${MAIL_PORT:587}
    username: ${MAIL_USERNAME:}
    password: ${MAIL_PASSWORD:}
    properties:
      mail.smtp.auth: true
      mail.smtp.starttls.enable: true

app:
  otp:
    length: 6
    ttl-minutes: 10
    max-attempts: 5
    resend-cooldown-seconds: 60
    from-address: ${MAIL_FROM:no-reply@hornero.app}
```

> For local/dev without a real SMTP server, point `MAIL_HOST` at a
> [MailHog](https://github.com/mailhog/MailHog) / Mailpit container, or log the
> code to stdout behind a `dev` profile flag so you never block development on
> SMTP.

### 1.3 OTP persistence

New entity `OtpCode` — keep it **separate** from `Usuario` so OTP churn doesn't
touch the user row, and so we can store one active code per email.

```
jar_hornero_ms/src/main/java/org/example/auth/otp/OtpCode.java
```

| Column         | Type          | Notes                                            |
|----------------|---------------|--------------------------------------------------|
| `id`           | Long (PK)     |                                                  |
| `email`        | String        | indexed; ties code to the pending account        |
| `codeHash`     | String        | **BCrypt hash** of the code — never store plain  |
| `expiresAt`    | Instant       | `now + ttl-minutes`                              |
| `attempts`     | int           | increments on each wrong guess                   |
| `lastSentAt`   | Instant       | for resend cooldown                              |
| `consumedAt`   | Instant null  | set once verified, prevents reuse                |

`ddl-auto=update` will create the table automatically (consistent with the rest
of this project — no migration files).

`OtpCodeRepository extends JpaRepository<OtpCode, Long>` with
`Optional<OtpCode> findByEmail(String email)`.

> Hash the code with the **existing** `BCryptPasswordEncoder` bean. Treating the
> OTP like a short-lived password means a DB leak doesn't expose live codes.

### 1.4 Services

**`OtpService`** — owns generation + validation:

- `generateAndSend(String email)`:
  1. Generate a cryptographically secure numeric code with
     `java.security.SecureRandom` (NOT `Math.random()`), zero-padded to
     `otp.length`.
  2. Upsert the `OtpCode` row for that email: store `BCrypt(code)`, set
     `expiresAt`, reset `attempts = 0`, set `lastSentAt = now`.
  3. Call `EmailService.sendOtp(email, code)`.
- `verify(String email, String code)`:
  1. Load the row; if missing/consumed/expired → `400 "Código inválido o expirado"`.
  2. If `attempts >= max-attempts` → `429 "Demasiados intentos"`.
  3. `passwordEncoder.matches(code, row.codeHash)` → on mismatch increment
     `attempts`, save, throw `400`.
  4. On match: set `consumedAt = now`, return success.
- `assertCanResend(String email)`: enforce `resend-cooldown-seconds` against
  `lastSentAt`, else `429`.

**`EmailService`** — wraps `JavaMailSender`:

```java
public void sendOtp(String to, String code) {
    SimpleMailMessage msg = new SimpleMailMessage();
    msg.setFrom(fromAddress);
    msg.setTo(to);
    msg.setSubject("Tu código de verificación — Hornero");
    msg.setText("Tu código es " + code + ". Vence en " + ttlMinutes + " minutos.");
    mailSender.send(msg);
}
```

> Send the email **outside** the registration transaction (or make SMTP failures
> non-fatal to the row write) so a flaky mail server doesn't roll back a created
> account. Log send failures; the user can always hit *resend*.

### 1.5 Wire it into `AuthService`

Change `register` so it:

1. Creates the user with **`activo = false`** (flip the `true` on lines 74/77).
2. Calls `otpService.generateAndSend(email)`.
3. Returns a lightweight DTO **without tokens**, e.g.
   `RegisterResponse { email, requiresVerification = true }`.

Add a new method:

```java
public AuthResponse verifyOtp(String email, String code) {
    otpService.verify(email, code);                 // throws on failure
    Usuario usuario = usuarioRepository.findByEmail(email)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Usuario no encontrado"));
    usuario.setActivo(true);
    usuarioRepository.save(usuario);
    String access = jwtService.generateAccessToken(usuario);
    String refresh = jwtService.generateRefreshToken(usuario.getId());
    return new AuthResponse(access, refresh, toUserResponse(usuario));
}
```

`login` needs **no change** — it already blocks inactive users.

### 1.6 Controller endpoints

In `AuthController`, add (both public):

```java
@PostMapping("/verify-otp")
public AuthResponse verifyOtp(@Valid @RequestBody VerifyOtpRequest req) {
    return authService.verifyOtp(req.getEmail(), req.getCode());
}

@PostMapping("/resend-otp")
public void resendOtp(@Valid @RequestBody ResendOtpRequest req) {
    authService.resendOtp(req.getEmail());
}
```

DTOs: `VerifyOtpRequest { @Email email, @NotBlank code }`,
`ResendOtpRequest { @Email email }`.

### 1.7 SecurityConfig

`/api/auth/**` is already `permitAll` in `SecurityConfig`, so `verify-otp` and
`resend-otp` are reachable without a token. **No change needed** — just confirm
the wildcard still covers the new paths.

---

## Part 2 — BFF (ts_hornero_bff, NestJS)

The BFF stays a thin proxy. The only nuance is **when cookies get set**.

### 2.1 `auth.service.ts`

- `register`: forward to MS, but the MS no longer returns tokens, so **do not
  call `setCookies`**. Just return `{ requiresVerification: true, email }`.
- New `verifyOtp(dto, res)`: POST to `${javaUrl}/api/auth/verify-otp`; on success
  the MS returns the full `AuthResponse` → call the **existing** `setCookies`
  exactly like `login` does today, return `{ user }`.
- New `resendOtp(dto)`: POST to `${javaUrl}/api/auth/resend-otp`, no cookies.

### 2.2 `auth.controller.ts`

Add two `@Public()` routes mirroring the register/login pattern:

```ts
@Public() @Post('verify-otp')
verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
  return this.authService.verifyOtp(dto, res);
}

@Public() @Post('resend-otp')
resendOtp(@Body() dto: ResendOtpDto) {
  return this.authService.resendOtp(dto);
}
```

DTOs under `auth/dto/`: `VerifyOtpDto { email, code }`, `ResendOtpDto { email }`,
both `class-validator` decorated (`@IsEmail`, `@IsNotEmpty`).

---

## Part 3 — Frontend (ts_hornero_app, Next.js 16)

> Per `ts_hornero_app/AGENTS.md`: read the relevant guide in
> `node_modules/next/dist/docs/` before writing frontend code. This is Next 16 /
> React 19, not the version you may remember.

### 3.1 API client (`src/lib/api/auth.ts`)

`registerUser` currently returns `void` and implicitly logs the user in. After
this change:

- `registerUser` returns `{ requiresVerification: true; email: string }` and
  **does not** establish a session.
- Add `verifyOtp({ email, code })` → on success the session cookies are set by
  the BFF; refetch `/auth/me` (or read the returned user) to populate the store.
- Add `resendOtp({ email })`.

### 3.2 UI flow

`register/page.tsx`: on successful submit, instead of redirecting to the
dashboard, navigate to a verification step carrying the email (route like
`/register/verify?email=...` or a local step in the same page via state).

New OTP screen:

- 6-digit code input (one field or six boxes — your call).
- Submit → `verifyOtp`; on success redirect to the post-login destination the
  app uses today after register.
- "Resend code" button, disabled during the cooldown returned by the BFF (or a
  client-side 60s timer); surface `429` as "Esperá un momento antes de reenviar".
- Map MS errors to friendly copy: `400` → "Código inválido o expirado",
  `429 (attempts)` → "Demasiados intentos, pedí un código nuevo".

### 3.3 `src/proxy.ts` (route guard)

No new protected route is required — the verify screen is public (the user has no
valid token yet). Just make sure the verify path isn't accidentally caught by an
"authenticated-only" matcher.

---

## Security checklist

- [ ] Codes generated with `SecureRandom`, never `Math.random()`.
- [ ] Codes stored **hashed** (BCrypt), never plaintext.
- [ ] Short TTL (10 min) + single-use (`consumedAt`).
- [ ] Per-code attempt cap (`max-attempts`) → blocks brute force of a 6-digit code.
- [ ] Resend cooldown → blocks email-bombing and code-cycling.
- [ ] `verify-otp` / `resend-otp` return generic messages; don't leak whether an
      email exists (mirror the existing "Credenciales inválidas" discretion).
- [ ] SMTP credentials only via env vars (`MAIL_USERNAME`/`MAIL_PASSWORD`).
- [ ] Email send failures don't roll back account creation; user can resend.

---

## Testing

**MS (`mvn test`)**
- `OtpService`: generate → verify happy path; wrong code increments attempts;
  expired code rejected; consumed code can't be reused; attempt cap returns 429;
  resend cooldown enforced.
- `AuthService`: register leaves `activo=false`; `verifyOtp` flips it to true and
  returns tokens; `login` on an unverified account still 401s.

**BFF (`npm test`)**
- `verify-otp` sets cookies on success; `register` does **not** set cookies.

**Frontend**
- Register → verify → land authenticated.
- Resend disabled during cooldown; invalid code shows the right message.

---

## Rollout notes

- `ddl-auto=update` creates the `otp_code` table on MS startup — no manual
  migration. Be deliberate against the shared Railway DB.
- **Existing users** were created with `activo=true`; they are unaffected and keep
  logging in normally. Only accounts created after this change go through OTP.
- The seed/`DataInitializer` accounts are created active — they bypass OTP by
  design, which is what you want for demo/admin accounts.
- New env vars to set in each run mode (`.env*`) and on Railway:
  `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`.

---

## Out of scope (possible follow-ups)

- OTP for **password reset** (same `OtpCode` infra, add a `purpose` column).
- OTP on **login** as a 2FA second factor.
- HTML email templates (`MimeMessage` + Thymeleaf) instead of plain text.
- Switching from SMTP to a transactional email API (Resend, SES) — only the
  `EmailService` implementation changes.
```
