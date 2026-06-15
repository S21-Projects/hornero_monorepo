package org.example.user;

public record UsuarioResponse(Long id, String nombre, String email, String tipo, boolean activo, String photoUrl) {}
