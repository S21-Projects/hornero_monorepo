package org.example.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Executor that sends mail off the request thread, so the HTTP response time never depends on the
 * provider (and, for password reset, never reveals whether an email was actually sent). Tests set
 * {@code app.mail.async=false} to run the dispatch inline and stay deterministic.
 */
@Configuration
public class MailAsyncConfig {

    @Bean(name = "mailExecutor", destroyMethod = "shutdown")
    public Executor mailExecutor(@Value("${app.mail.async:true}") boolean async) {
        if (!async) {
            return new SameThreadExecutor();
        }
        ExecutorService pool = Executors.newFixedThreadPool(2, r -> {
            Thread t = new Thread(r, "mail-sender");
            t.setDaemon(true);
            return t;
        });
        return new ShutdownableExecutor(pool);
    }

    /** Runs the task on the caller's thread. */
    static final class SameThreadExecutor implements Executor {
        @Override
        public void execute(Runnable command) {
            command.run();
        }

        @SuppressWarnings("unused")
        public void shutdown() {
            // nothing to release
        }
    }

    /** Delegating executor exposing {@code shutdown()} so Spring can close the pool. */
    static final class ShutdownableExecutor implements Executor {
        private final ExecutorService delegate;

        ShutdownableExecutor(ExecutorService delegate) {
            this.delegate = delegate;
        }

        @Override
        public void execute(Runnable command) {
            delegate.execute(command);
        }

        @SuppressWarnings("unused")
        public void shutdown() {
            delegate.shutdown();
        }
    }
}
