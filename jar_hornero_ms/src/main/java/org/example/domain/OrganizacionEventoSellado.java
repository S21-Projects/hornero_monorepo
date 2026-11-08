package org.example.domain;

/**
 * Repository fragment holding {@code save}: the only way an event is inserted, and therefore the
 * single place where it is chained (C4). Spring Data prefers a fragment over the base repository
 * for the same method signature.
 */
public interface OrganizacionEventoSellado {

    /** Seals the event into its organization's hash chain and inserts it. */
    OrganizacionEvento save(OrganizacionEvento evento);
}
