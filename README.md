# SaaS Multitenant Application (Create by Jean Correa)

Una aplicación SaaS multitenant completa construida con Node.js, Prisma y PostgreSQL.

## 🚀 Características

- **Arquitectura Multitenant**: Separación completa de datos por tenant
- **Autenticación JWT**: Sistema seguro de login/register
- **Control de Roles**: Admin, User, Viewer con permisos específicos
- **API RESTful**: Endpoints bien documentados y estructurados
- **Validación de Datos**: Validación robusta con Joi
- **Seguridad**: Rate limiting, CORS, Helmet, bcrypt
- **Base de Datos**: PostgreSQL con Prisma ORM
- **Documentación**: API autodocumentada

## 📋 Requisitos Previos

- Node.js >= 16.x
- PostgreSQL >= 12.x
- npm o yarn

## 🛠️ Instalación

1. **Clonar el repositorio**
\`\`\`bash
git clone <repository-url>
cd saas-multitenant
\`\`\`

2. **Instalar dependencias**
\`\`\`bash
npm install
\`\`\`

3. **Configurar variables de entorno**
\`\`\`bash
cp .env.example .env
# Editar .env con tus configuraciones
\`\`\`

4. **Configurar base de datos**
\`\`\`bash
# Generar cliente Prisma
npm run db:generate

# Aplicar migraciones
npm run db:migrate

# Poblar con datos de prueba (opcional)
npm run db:seed
\`\`\`

5. **Iniciar servidor**
\`\`\`bash
# Desarrollo
npm run dev

# Producción
npm start
\`\`\`

## 🏗️ Arquitectura

### Estructura del Proyecto
\`\`\`
src/
├── config/          # Configuraciones (DB, etc.)
├── middleware/      # Middlewares personalizados
├── routes/          # Rutas de la API
├── scripts/         # Scripts de utilidad
└── server.js        # Punto de entrada
\`\`\`

### Modelo de Datos

#### Tenant
- Representa una organización/empresa
- Cada tenant tiene su propio subdominio
- Aislamiento completo de datos

#### User
- Usuarios pertenecen a un tenant específico
- Roles: ADMIN, USER, VIEWER
- Autenticación con JWT

#### Project
- Proyectos pertenecen a un tenant
- Asociados a un usuario creador
- Control de permisos por rol

## 🔐 Autenticación

### Registro
\`\`\`bash
POST /api/auth/register
{
  "email": "admin@company.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe",
  "tenantName": "My Company",
  "subdomain": "mycompany"
}
\`\`\`

### Login
\`\`\`bash
POST /api/auth/login
{
  "email": "admin@company.com",
  "password": "securepassword",
  "subdomain": "mycompany"
}
\`\`\`

## 📚 API Endpoints

### Autenticación
- `POST /api/auth/register` - Registrar usuario y crear tenant
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Obtener información del usuario actual
- `POST /api/auth/refresh` - Renovar token JWT

### Tenants
- `GET /api/tenants` - Listar tenants
- `POST /api/tenants` - Crear tenant
- `GET /api/tenants/:id` - Obtener tenant por ID
- `PUT /api/tenants/:id` - Actualizar tenant
- `DELETE /api/tenants/:id` - Eliminar tenant

### Usuarios
- `GET /api/users` - Listar usuarios del tenant
- `POST /api/users` - Crear usuario (Admin)
- `GET /api/users/:id` - Obtener usuario por ID
- `PUT /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Eliminar usuario (Admin)

### Proyectos
- `GET /api/projects` - Listar proyectos del tenant
- `POST /api/projects` - Crear proyecto
- `GET /api/projects/:id` - Obtener proyecto por ID
- `PUT /api/projects/:id` - Actualizar proyecto
- `DELETE /api/projects/:id` - Eliminar proyecto (Admin)

## 🔒 Seguridad

### Características de Seguridad
- **JWT Authentication**: Tokens seguros con expiración
- **Password Hashing**: bcrypt con salt rounds altos
- **Rate Limiting**: Protección contra ataques de fuerza bruta
- **CORS**: Configuración restrictiva de orígenes
- **Helmet**: Headers de seguridad HTTP
- **Input Validation**: Validación estricta con Joi
- **SQL Injection Protection**: Prisma ORM previene inyecciones

### Roles y Permisos
- **ADMIN**: Acceso completo al tenant
- **USER**: Acceso a sus propios recursos
- **VIEWER**: Solo lectura

## 🧪 Testing

### Datos de Prueba
Después de ejecutar `npm run db:seed`:

**Tenant**: demo
- **Admin**: admin@demo.com / admin123456
- **User**: user@demo.com / user123456

### Endpoints de Prueba
\`\`\`bash
# Health check
GET http://localhost:3000/health

# Documentación API
GET http://localhost:3000/api/docs

# Login de prueba
POST http://localhost:3000/api/auth/login
{
  "email": "admin@demo.com",
  "password": "admin123456",
  "subdomain": "demo"
}
\`\`\`

## 🚀 Despliegue

### Variables de Entorno de Producción
\`\`\`env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-super-secure-jwt-secret
PORT=3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
\`\`\`

### Docker (Opcional)
\`\`\`dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "start"]
\`\`\`

## 📊 Monitoreo

### Health Check
\`\`\`bash
GET /health
\`\`\`
Respuesta:
\`\`\`json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production"
}
\`\`\`

### Logs
- Errores se registran automáticamente
- Queries de base de datos en desarrollo
- Rate limiting y intentos de acceso

## 🔧 Mantenimiento

### Comandos Útiles
\`\`\`bash
# Generar cliente Prisma después de cambios en schema
npm run db:generate

# Aplicar nuevas migraciones
npm run db:migrate

# Resetear base de datos (desarrollo)
npx prisma migrate reset

# Ver base de datos en navegador
npx prisma studio
\`\`\`

### Backup de Base de Datos
\`\`\`bash
# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
\`\`\`

## 🤝 Contribución

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

Para soporte y preguntas:
- Crear un issue en GitHub
- Email: jeancorrea1000@gmail.com

## 🔄 Changelog

### v1.0.0
- ✅ Arquitectura multitenant completa
- ✅ Sistema de autenticación JWT
- ✅ CRUD completo para usuarios y proyectos
- ✅ Middleware de seguridad
- ✅ Documentación API
- ✅ Scripts de seeding
- ✅ Validación de datos robusta
