export const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        status: 401,
        error: "Acceso no autorizado. Falta token."
      });
    }

    // Aquí podrías validar JWT si lo usas
    // Ejemplo:
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      status: 401,
      error: "Token inválido o expirado."
    });
  }
};
export default authMiddleware;