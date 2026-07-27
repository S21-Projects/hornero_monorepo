# ---- Build stage ----
FROM maven:3.9.6-eclipse-temurin-17 AS builder

WORKDIR /app

# Copy dependency descriptors first for layer caching
COPY pom.xml .
RUN mvn dependency:go-offline -q

# Copy source and build
COPY src ./src
RUN mvn package -DskipTests -q

# ---- Runtime stage ----
FROM eclipse-temurin:17-jre-jammy AS runtime

WORKDIR /app

COPY --from=builder /app/target/*.jar app.jar

EXPOSE 8081

ENTRYPOINT ["java", "-jar", "app.jar"]
