# syntax=docker/dockerfile:1
# Multi-stage build: bien dich bang Gradle (JDK 17), chay bang JRE 17 cho nhe image.

FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /app

# Copy truoc phan it thay doi nhat (wrapper + build script) de tan dung Docker layer cache:
# neu chi sua code trong src/, khong can tai lai dependency.
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
RUN chmod +x gradlew

COPY src src
RUN ./gradlew bootJar --no-daemon -x test

# Spring Boot Gradle plugin xuat ra CA jar thuc thi (app.jar) LAN jar "-plain.jar" (khong chay duoc).
# Loai bo -plain.jar truoc khi copy sang stage runtime, tranh COPY --from wildcard dinh nham 2 file.
RUN JAR_FILE=$(find build/libs -maxdepth 1 -name "*.jar" ! -name "*-plain.jar" | head -n 1) \
    && cp "$JAR_FILE" app.jar

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY --from=build /app/app.jar app.jar

EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
