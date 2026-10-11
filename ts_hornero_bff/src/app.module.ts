import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { OrganizacionesModule } from './organizaciones/organizaciones.module.js';
import { NecesidadesModule } from './necesidades/necesidades.module.js';
import { DonacionesModule } from './donaciones/donaciones.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { UploadModule } from './upload/upload.module.js';
import { ImagesModule } from './images/images.module.js';
import { AcreditacionModule } from './acreditacion/acreditacion.module.js';
import { EvidenciaFilesModule } from './evidencia-files/evidencia-files.module.js';
import { RondasModule } from './rondas/rondas.module.js';
import { ArticulosModule } from './articulos/articulos.module.js';
import { ActividadModule } from './actividad/actividad.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    OrganizacionesModule,
    NecesidadesModule,
    DonacionesModule,
    UsuariosModule,
    UploadModule,
    ImagesModule,
    AcreditacionModule,
    EvidenciaFilesModule,
    RondasModule,
    ArticulosModule,
    ActividadModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
