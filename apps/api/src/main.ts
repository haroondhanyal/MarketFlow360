import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import cookieParser = require("cookie-parser");
import express = require("express");
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./module";
import { securityHeaders } from "./security-headers";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.setGlobalPrefix("api/v1");
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true });
  app.use(cookieParser());
  app.use(securityHeaders);
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true, limit: "5mb" }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(Number(process.env.PORT ?? 4000));
}

void bootstrap();
