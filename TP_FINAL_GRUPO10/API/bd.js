import passport from "passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import { db } from "./db.js";

// Configuración de Passport
export function authConfig() {
  const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
  };

  passport.use(
    new Strategy(jwtOptions, async (payload, next) => {
      const [rows, fields] = await db.execute(
        "SELECT id, usuario FROM empleados WHERE usuario = ?",
        [payload.usuario]
      );
      if (rows.length > 0) {
        next(null, rows[0]);
      } else {
        next(null, false);
      }
    })
  );
}

// Configuración del enrutador de autenticación
export const authRouter = express
  .Router()

  // Endpoint de inicio de sesión
  .post(
    "/login",
    body("usuario").isAlphanumeric().isLength({ min: 1, max: 25 }),
    body("password").isStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 0,
    }),
    async (req, res) => {
      const validacion = validationResult(req);
      if (!validacion.isEmpty()) {
        res.status(400).send({ errors: validacion.array() });
        return;
      }

      const { usuario, password } = req.body;

      // Obtener cuenta de usuario
      const [rows, fields] = await db.execute(
        "SELECT idEmpleado, usuario, password FROM empleados WHERE usuario = ?",
        [usuario]
      );

      if (rows.length === 0) {
        res.status(400).send("Usuario o contraseña inválida");
        return;
      }

      // Verificar contraseña
      const passwordCompared = await bcrypt.compare(password, rows[0].password);
      if (!passwordCompared) {
        res.status(400).send("Usuario o contraseña inválida");
        return;
      }

      // Generar token
      const payload = { usuario };
      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "2h",
      });
      res.send({ usuario, token });
    }
  )

  // Endpoint para obtener el perfil del usuario autenticado
  .get(
    "/perfil",
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
      res.json(req.user);
    }
  );