<?php

// ===============================
// 1. VALIDACIÓN BÁSICA Y ANTI‑BOT
// ===============================

// Honeypot
if (!empty($_POST["empresa"])) {
    exit("Bot detectado");
}

// Token CSRF
if (empty($_POST["token"])) {
    exit("Token inválido");
}

// Obtener datos crudos
$nombre  = trim($_POST["nombre"] ?? "");
$correo  = trim($_POST["correo"] ?? "");
$mensaje = trim($_POST["mensaje"] ?? "");

// Campos vacíos
if ($nombre === "" || $correo === "" || $mensaje === "") {
    exit("Faltan datos");
}

// Validación de email
if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
    exit("Correo inválido");
}

// Anti header injection
if (preg_match("/[\r\n]/", $correo)) {
    exit("Correo inválido");
}

// Limitar tamaño del mensaje
if (strlen($mensaje) > 2000) {
    exit("Mensaje demasiado largo");
}


// ===============================
// 2. SANITIZACIÓN
// ===============================
$nombre  = filter_var($nombre, FILTER_SANITIZE_STRING);
$correo  = filter_var($correo, FILTER_SANITIZE_EMAIL);
$mensaje = strip_tags($mensaje);
$mensaje = htmlspecialchars($mensaje, ENT_QUOTES, 'UTF-8');


// ===============================
// 3. ARMADO DEL CORREO
// ===============================
$destino = "ventas@vgv.cl";
$asunto  = "Nuevo mensaje desde el formulario de contacto";

$cuerpo = "
Nombre: $nombre
Correo: $correo

Mensaje:
$mensaje
";

$headers  = "From: $correo\r\n";
$headers .= "Reply-To: $correo\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";


// ===============================
// 4. ENVÍO
// ===============================
if (mail($destino, $asunto, $cuerpo, $headers)) {
    echo "OK"; // El JS mostrará el modal de éxito
} else {
    echo "ERROR";
}
?>

