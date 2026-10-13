package org.example.user;

public record UsuarioResponse(Long id, String nombre, String email, String tipo, boolean activo) {

    public static UsuarioResponse de(Usuario u) {
        String tipo = u instanceof Donante ? "DONANTE"
                : u instanceof Referente ? "REFERENTE"
                : "ADMINISTRADOR";
        return new UsuarioResponse(u.getId(), u.getNombre(), u.getEmail(), tipo, u.isActivo());
    }
}
