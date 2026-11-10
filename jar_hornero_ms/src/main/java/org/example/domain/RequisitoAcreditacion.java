package org.example.domain;

/**
 * The 8-constant union requirement catalogue Banco de Alimentos Córdoba demands, transcribed
 * verbatim from <https://bancodealimentoscba.org.ar/suma-a-tu-comedor/> and the signup form (see
 * {@code specs/organizacion-acreditacion/spec.md}, "Requirement Catalogue" table, and
 * {@code docs/tesis/handoff.md} section 4). Each constant's {@link #getDescripcion()} preserves
 * the exact source wording rather than a paraphrase. {@link #getNivelExigido()} is the level at
 * which the requisito is first demanded; higher levels continue to demand it (cumulative).
 */
public enum RequisitoAcreditacion {

    SERVICIO_REGULAR_GRATUITO(
            NivelAcreditacion.N1,
            "Site: \"Brindar un servicio de alimentación gratuito, sin condicionamientos y de "
                    + "manera regular (al menos una vez por semana) en un espacio físico.\" "
                    + "Form: \"servicio regular al menos una vez por semana (en el lugar o como "
                    + "viandas)\""),

    NO_DISCRIMINACION(
            NivelAcreditacion.N1,
            "Site: \"No discriminar en la entrega de los alimentos por raza, religión, credo, "
                    + "vecindad o partido político.\" Form: \"alimento gratuito sin discriminar "
                    + "por género, edad, religión\""),

    SEDE_INSCRIPTA_INDIVIDUALMENTE(
            NivelAcreditacion.N1,
            "Form: \"si asiste en varias instituciones, inscribir cada una por separado (el alta "
                    + "se aprueba con auditoría sobre la dirección declarada)\""),

    CONDICIONES_SANITARIAS_ADECUADAS(
            NivelAcreditacion.N2,
            "Site: \"Mantener las instalaciones en condiciones sanitarias adecuadas, de acuerdo "
                    + "con el servicio que se presta.\""),

    SIN_KIOSCO_MISMO_DOMICILIO(
            NivelAcreditacion.N2,
            "Site: \"No contar con kiosko, almacén o despensa en el mismo domicilio del "
                    + "merendero/comedor.\""),

    RADIO_50KM_BANCO_ALIMENTOS(
            NivelAcreditacion.N2,
            "Site: \"Estar dentro de la ciudad de Córdoba o hasta 50 km de distancia desde el "
                    + "Banco de Alimentos Córdoba.\" (conflict resolved: distance is measured "
                    + "from Banco de Alimentos, per user confirmation, superseding the form's "
                    + "\"de Córdoba Capital\" wording)"),

    PERSONERIA_JURIDICA_O_AVAL(
            NivelAcreditacion.N3,
            "Site: \"Contar con Personería Jurídica o Simple Asociación (requisito "
                    + "excluyente).\" Form: \"personería jurídica o aval de otra personería "
                    + "jurídica\". Satisfied by exactly one of 8 documentation options "
                    + "transcribed from the signup form: Asociación Simple, Asociación Civil, "
                    + "Fichero de Culto, Fundación, Cooperativa, Centro de Jubilados, Centro "
                    + "Vecinal, or Aval de otra personería jurídica."),

    ACEPTA_AUDITORIAS_SIN_AVISO(
            NivelAcreditacion.N3,
            "Site: \"Aceptar las visitas de auditoría que realiza el Banco de Alimentos, sin "
                    + "previo aviso.\"");

    private final NivelAcreditacion nivelExigido;
    private final String descripcion;

    RequisitoAcreditacion(NivelAcreditacion nivelExigido, String descripcion) {
        this.nivelExigido = nivelExigido;
        this.descripcion = descripcion;
    }

    public NivelAcreditacion getNivelExigido() {
        return nivelExigido;
    }

    public String getDescripcion() {
        return descripcion;
    }
}
