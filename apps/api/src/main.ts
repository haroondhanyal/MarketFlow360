import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import cookieParser = require("cookie-parser");
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(Number(process.env.PORT ?? 4000));
}

void bootstrap();
