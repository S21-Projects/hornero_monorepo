package org.example.donacion;

import org.example.domain.Organizacion;
import org.example.domain.OrganizacionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.function.UnaryOperator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DonanteVisibilidadTest {

    private static final Long DONANTE_ID = 2L;
    private static final Long ORG_ID = 10L;

    @Mock
    private OrganizacionRepository organizacionRepository;

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private DonanteVisibilidad policy(boolean publico) {
        return new DonanteVisibilidad(organizacionRepository, publico);
    }

    private void login(Long userId, String tipo) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                userId, null, List.of(new SimpleGrantedAuthority("ROLE_" + tipo))));
    }

    private DonacionResponse response(Long orgId) {
        return new DonacionResponse(1L, null, null, "OFRECIDA", null, "Ana Donante", 5L, orgId,
                "", "", DONANTE_ID, null, null, "DIRECTA", null, "OFERTA", List.of());
    }

    private Organizacion org(Long id) {
        Organizacion o = new Organizacion();
        o.setId(id);
        return o;
    }

    @Test
    void anonymousSeesMaskedDonor() {
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken(
                "k", "anonymousUser", AuthorityUtils.createAuthorityList("ROLE_ANONYMOUS")));
        DonacionResponse r = policy(false).paraLlamadaActual().apply(response(ORG_ID));
        assertThat(r.donanteName()).isNull();
        assertThat(r.donanteId()).isNull();
        assertThat(r.id()).isEqualTo(1L);
    }

    @Test
    void noAuthenticationSeesMaskedDonor() {
        assertThat(policy(false).paraLlamadaActual().apply(response(ORG_ID)).donanteName()).isNull();
    }

    @Test
    void otherReferenteSeesMaskedDonor() {
        login(99L, "REFERENTE");
        when(organizacionRepository.findByReferente_Id(99L)).thenReturn(List.of(org(77L)));
        DonacionResponse r = policy(false).paraLlamadaActual().apply(response(ORG_ID));
        assertThat(r.donanteName()).isNull();
        assertThat(r.donanteId()).isNull();
    }

    @Test
    void receivingReferenteSeesDonor() {
        login(99L, "REFERENTE");
        when(organizacionRepository.findByReferente_Id(99L)).thenReturn(List.of(org(ORG_ID)));
        DonacionResponse r = policy(false).paraLlamadaActual().apply(response(ORG_ID));
        assertThat(r.donanteName()).isEqualTo("Ana Donante");
        assertThat(r.donanteId()).isEqualTo(DONANTE_ID);
    }

    @Test
    void poolDonationWithoutOrganizationIsMaskedForReferente() {
        login(99L, "REFERENTE");
        assertThat(policy(false).paraLlamadaActual().apply(response(null)).donanteName()).isNull();
    }

    @Test
    void donorSeesOwnDonation() {
        login(DONANTE_ID, "DONANTE");
        assertThat(policy(false).paraLlamadaActual().apply(response(ORG_ID)).donanteName())
                .isEqualTo("Ana Donante");
    }

    @Test
    void otherDonorSeesMaskedDonor() {
        login(55L, "DONANTE");
        assertThat(policy(false).paraLlamadaActual().apply(response(ORG_ID)).donanteName()).isNull();
    }

    @Test
    void adminSeesDonor() {
        login(1L, "ADMINISTRADOR");
        assertThat(policy(false).paraLlamadaActual().apply(response(ORG_ID)).donanteName())
                .isEqualTo("Ana Donante");
    }

    @Test
    void flagOnShowsDonorToAnonymous() {
        assertThat(policy(true).paraLlamadaActual().apply(response(ORG_ID)).donanteName())
                .isEqualTo("Ana Donante");
    }

    @Test
    void referenteOrganizationsAreResolvedOncePerCall() {
        login(99L, "REFERENTE");
        when(organizacionRepository.findByReferente_Id(99L)).thenReturn(List.of(org(ORG_ID)));
        UnaryOperator<DonacionResponse> mask = policy(false).paraLlamadaActual();
        mask.apply(response(ORG_ID));
        mask.apply(response(ORG_ID));
        mask.apply(response(77L));
        verify(organizacionRepository, times(1)).findByReferente_Id(99L);
    }

    @Test
    void nonReferenteNeverQueriesOrganizations() {
        login(55L, "DONANTE");
        policy(false).paraLlamadaActual().apply(response(ORG_ID));
        verify(organizacionRepository, never()).findByReferente_Id(55L);
    }
}
