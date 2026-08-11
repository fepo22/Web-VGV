export const products = [
  {
    id: 1,
    nombre: "Canaleta PVC Blanca",
    precio: 28990,
    descripcion: "Solución para evacuación de aguas lluvias con diseño funcional y fácil instalación.",
    imagen: "/images/canaleta_blanca.png",
    categoria: "Canalización",
    categoriaSlug: "canalizacion",
    stock: 50
  },
  {
    id: 2,
    nombre: "Tubería DrenPro",
    precio: 34990,
    descripcion: "Tubería para drenaje y evacuación con excelente resistencia y durabilidad.",
    imagen: "/images/drenpro.png",
    categoria: "Canalización",
    categoriaSlug: "canalizacion",
    stock: 35,
    variantes: [
      { sku: "DP-20", medida: "20mm x 6m", precio: 29990, minima: 25 },
      { sku: "DP-25", medida: "25mm x 6m", precio: 32990, minima: 20 },
      { sku: "DP-32", medida: "32mm x 6m", precio: 34990, minima: 10 },
      { sku: "DP-40", medida: "40mm x 6m", precio: 39990, minima: 10 }
    ]
  },
  {
    id: 3,
    nombre: "Tubo HDPE",
    precio: 22990,
    descripcion: "Tubo flexible ideal para sistemas de agua y conducción con alta resistencia.",
    imagen: "/images/hdpe.png",
    categoria: "Canalización",
    categoriaSlug: "canalizacion",
    stock: 42,
    variantes: [
      { sku: "HDPE-20", medida: "20mm x 6m", precio: 21990, minima: 25 },
      { sku: "HDPE-25", medida: "25mm x 6m", precio: 22990, minima: 20 },
      { sku: "HDPE-32", medida: "32mm x 6m", precio: 25990, minima: 10 }
    ]
  },
  {
    id: 4,
    nombre: "Tubo Colector",
    precio: 26990,
    descripcion: "Producto para instalaciones de colectores y sistemas de drenaje de alto rendimiento.",
    imagen: "/images/colector.png",
    categoria: "Canalización",
    categoriaSlug: "canalizacion",
    stock: 31,
    variantes: [
      { sku: "COL-SN4-110", medida: "110mm x 6m SN4", precio: 26990, minima: 6 },
      { sku: "COL-SN8-110", medida: "110mm x 6m SN8", precio: 29990, minima: 6 },
      { sku: "COL-SN8-160", medida: "160mm x 6m SN8", precio: 36990, minima: 3 }
    ]
  },
  {
    id: 5,
    nombre: "Cañería de Cobre",
    precio: 39990,
    descripcion: "Material premium para instalaciones de agua y gas con gran confiabilidad.",
    imagen: "/images/tubo_cobre.png",
    categoria: "Canalización",
    categoriaSlug: "canalizacion",
    stock: 18,
    variantes: [
      { sku: "COB-15", medida: "15mm x 6m", precio: 39990, minima: 5 },
      { sku: "COB-22", medida: "22mm x 6m", precio: 46990, minima: 3 },
      { sku: "COB-28", medida: "28mm x 6m", precio: 54990, minima: 2 }
    ]
  },
  {
    id: 6,
    nombre: "Adhesivo de Montaje",
    precio: 12990,
    descripcion: "Adhesivo de montaje para aplicaciones rápidas y seguras en obra.",
    imagen: "/images/Peg_montaje.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 65
  },
  {
    id: 7,
    nombre: "Sikaceram 50",
    precio: 15990,
    descripcion: "Adhesivo especializado para cerámica y porcelanato con excelente fijación.",
    imagen: "/images/sika_ceram.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 58
  },
  {
    id: 8,
    nombre: "Silirub AC",
    precio: 8990,
    descripcion: "Silicona acética para sellado y acabado en múltiples aplicaciones.",
    imagen: "/images/Silirub_ac.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 80
  },
  {
    id: 9,
    nombre: "Adesilex P9",
    precio: 17990,
    descripcion: "Aditivo para concreto con propiedades reforzantes y de mejora estructural.",
    imagen: "/images/adesilex.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 44
  },
  {
    id: 10,
    nombre: "Termo Eléctrico Muro",
    precio: 109990,
    descripcion: "Termo eléctrico para instalación en pared, ideal para agua caliente eficiente.",
    imagen: "/images/termo.png",
    categoria: "Calefont y calefacción",
    categoriaSlug: "calefont-calefaccion",
    stock: 14
  },
  {
    id: 14,
    nombre: "Portátil 9000 BTU Frío/Calor Splendid",
    precio: 256000,
    descripcion: "Equipo portátil frío/calor para climatización eficiente en espacios interiores.",
    imagen: "/images/ofertas/portable_9000.jpg",
    categoria: "Calefont y calefacción",
    categoriaSlug: "calefont-calefaccion",
    stock: 7,
    oferta: true,
    descuentoPct: 17
  },
  {
    id: 15,
    nombre: "Portátil 12000 BTU Frío/Calor WiFi Splendid",
    precio: 299000,
    descripcion: "Climatizador portátil con conectividad WiFi y mayor capacidad para ambientes amplios.",
    imagen: "/images/ofertas/portable_12000_wifi.jpg",
    categoria: "Calefont y calefacción",
    categoriaSlug: "calefont-calefaccion",
    stock: 6,
    oferta: true,
    descuentoPct: 36
  },
  {
    id: 16,
    nombre: "Jarra purificadora de agua potable",
    precio: 17000,
    descripcion: "Jarra de filtrado para mejorar sabor y calidad del agua de consumo diario.",
    imagen: "/images/ofertas/jarra_purificadora.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 20,
    oferta: true,
    descuentoPct: 37
  },
  {
    id: 17,
    nombre: "Filtro Purificador Triple",
    precio: 51000,
    descripcion: "Sistema de purificación de tres etapas para agua más limpia en el hogar.",
    imagen: "/images/ofertas/filtro_purificador_triple.png",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 12,
    oferta: true,
    descuentoPct: 37
  },
  {
    id: 18,
    nombre: "Pomel 1' x 104mm",
    precio: 1200,
    descripcion: "Accesorio de conexión para instalaciones sanitarias y de canalización.",
    imagen: "/images/ofertas/pomel_1x104.jpg",
    categoria: "Consumibles de obra",
    categoriaSlug: "consumibles-obra",
    stock: 40,
    oferta: true,
    descuentoPct: 36
  },
  {
    id: 20,
    nombre: "Acrilico Grietas Soudal",
    precio: 5990,
    descripcion: "Sellador acrilico para rellenar grietas y fendas en hormigon, ladrillo y yeso. Pintable.",
    imagen: "/images/acrilico_grietas_soudal.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 62
  },
  {
    id: 21,
    nombre: "Acryrub Sellador Acrilico",
    precio: 6490,
    descripcion: "Sellador acrilico base agua para juntas interiores y terminaciones.",
    imagen: "/images/acryrub.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 58
  },
  {
    id: 22,
    nombre: "Silicona AC",
    precio: 6990,
    descripcion: "Silicona acida para sellado en superficies no porosas y juntas sanitarias.",
    imagen: "/images/silicona_ac_soudal.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 90
  },
  {
    id: 23,
    nombre: "Silirub Soudal",
    precio: 7490,
    descripcion: "Sellador de silicona para juntas de dilatacion y aplicaciones generales.",
    imagen: "/images/silirub_soudal_real.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 76
  },
  {
    id: 24,
    nombre: "Sin Clavos 360gr",
    precio: 8990,
    descripcion: "Adhesivo de montaje de alta adherencia para fijaciones sin perforar.",
    imagen: "/images/sin_clavos_360gr_soudal.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 68
  },
  {
    id: 25,
    nombre: "Soudabond",
    precio: 9990,
    descripcion: "Adhesivo elastico multiproposito para pegado y sellado en obra.",
    imagen: "/images/soudabond.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 52
  },
  {
    id: 26,
    nombre: "Soudalflex",
    precio: 10990,
    descripcion: "Sellador elastomerico para juntas expuestas a movimiento y vibracion.",
    imagen: "/images/soudalflex.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 44
  },
  {
    id: 27,
    nombre: "Asiento y tapa PP WC Aura",
    precio: 18990,
    descripcion: "Asiento y tapa para WC en polipropileno con diseño sobrio y fácil limpieza.",
    imagen: "/images/asiento_tapa_pp_wc_aura.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 18
  },
  {
    id: 28,
    nombre: "Barra cortina 60-90 cm",
    precio: 13990,
    descripcion: "Accesorio para cortina de ducha ajustable en medidas estándar para baño.",
    imagen: "/images/barra_cortina_60_90cm.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 25
  },
  {
    id: 29,
    nombre: "Estanque WC NER ATOS",
    precio: 22990,
    descripcion: "Estanque para WC con sistema funcional y acabado moderno para instalaciones residenciales.",
    imagen: "/images/estanque_wc_ner_atos.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 12
  },
  {
    id: 30,
    nombre: "Lavamanos Aura",
    precio: 25990,
    descripcion: "Lavamanos de diseño compacto ideal para baño con estética simple y moderna.",
    imagen: "/images/lavamanos_aura.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 17
  },
  {
    id: 31,
    nombre: "Llave angular HE 1/2 New con flexible",
    precio: 34990,
    descripcion: "Llave angular con flexible para instalaciones de agua con mayor comodidad y durabilidad.",
    imagen: "/images/llave_angular_he_1_2_new_con_flexible.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 15
  },
  {
    id: 32,
    nombre: "Llave collar HE-HE 3/4",
    precio: 31990,
    descripcion: "Llave de collar para conexión segura y funcional en sistemas de agua y calefacción.",
    imagen: "/images/llave_collar_he_he_3_4.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 14
  },
  {
    id: 33,
    nombre: "Monomando Ducha Oregon",
    precio: 42990,
    descripcion: "Monomando para ducha con terminación elegante y control preciso del caudal.",
    imagen: "/images/monomando_ducha_oregon.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 9
  },
  {
    id: 34,
    nombre: "Monomando lavaplatos Oregon cuello cisne",
    precio: 44990,
    descripcion: "Monomando para lavaplatos con diseño funcional y excelente resistencia al uso diario.",
    imagen: "/images/monomando_lavaplatos_oregon_cuello_cisne.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 8
  },
  {
    id: 35,
    nombre: "Monomando Lavaplatos Vermont",
    precio: 46990,
    descripcion: "Monomando para lavaplatos con diseño contemporáneo y un excelente acabado.",
    imagen: "/images/monomando_lavaplatos_vermont.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 7
  },
  {
    id: 36,
    nombre: "Monomando Lavatorio Oregon",
    precio: 39990,
    descripcion: "Monomando para lavatorio de uso común con control preciso y terminación moderna.",
    imagen: "/images/monomando_lavatorio_oregon.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 11
  },
  {
    id: 37,
    nombre: "Monomando Lavatorio Vermontt",
    precio: 41990,
    descripcion: "Monomando para lavatorio de estilo actualizado, práctico y estético para baño y cocina.",
    imagen: "/images/monomando_lavatorio_vermontt.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 10
  },
  {
    id: 38,
    nombre: "Pedestal Theos",
    precio: 23990,
    descripcion: "Pedestal para lavatorio con diseño limpio y soporte estable para baños modernos.",
    imagen: "/images/pedestal_theos.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 16
  },
  {
    id: 39,
    nombre: "Sifón lavamanos Stretto 1 1/4",
    precio: 8990,
    descripcion: "Conector y sifón para lavamanos con diámetro estándar y conexión práctica para instalaciones rápidas.",
    imagen: "/images/sifon_lavamanos_stretto_1_1_4.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 20
  },
  {
    id: 40,
    nombre: "Taza WC New Ares c/Fijaciones",
    precio: 44990,
    descripcion: "Taza de WC con fijaciones y diseño versátil para baño residencial y comercial.",
    imagen: "/images/taza_wc_new_ares_c_fijaciones.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 13
  },
  {
    id: 41,
    nombre: "Toallero",
    precio: 15990,
    descripcion: "Toallero mural para baño con terminación cromada y montaje firme.",
    imagen: "/images/toallero.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 24
  },
  {
    id: 42,
    nombre: "Prese 110 Maquillaje",
    precio: 12990,
    descripcion: "Pasta base para terminaciones finas y nivelación en superficies interiores.",
    imagen: "/images/prese_110_maquillaje.jpg",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 36
  },
  {
    id: 43,
    nombre: "Presec 01 Albañilería",
    precio: 13990,
    descripcion: "Mortero para albañilería con buena adherencia y rendimiento en obra.",
    imagen: "/images/presec_01_albanileria.jpg",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 32
  },
  {
    id: 44,
    nombre: "Sikaceram 100",
    precio: 15990,
    descripcion: "Adhesivo cementicio para cerámicas en aplicaciones residenciales y comerciales.",
    imagen: "/images/sikaceram_100.jpg",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 40
  },
  {
    id: 45,
    nombre: "Sikaceram 200Flex",
    precio: 19990,
    descripcion: "Adhesivo flexible para porcelanato y revestimientos de mayor exigencia.",
    imagen: "/images/sikaceram_200flex.jpg",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 28
  },
  {
    id: 46,
    nombre: "SikaChapdur",
    precio: 17990,
    descripcion: "Endurecedor superficial para pisos de hormigón de alto tránsito.",
    imagen: "/images/sikachapdur.jpg",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 22
  },
  {
    id: 47,
    nombre: "Sikadur 31hmg",
    precio: 24990,
    descripcion: "Adhesivo epóxico estructural para anclajes, uniones y reparaciones.",
    imagen: "/images/sikadur_31hmg.jpg",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 18
  },
  {
    id: 48,
    nombre: "Sikatop",
    precio: 18990,
    descripcion: "Mortero de reparación para hormigón con buena trabajabilidad y adherencia.",
    imagen: "/images/sikatop.jpg",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 26
  },
  {
    id: 49,
    nombre: "Codo 90 PVC",
    precio: 2990,
    descripcion: "Codo PVC de 90 grados para cambios de dirección en instalaciones de canalización.",
    imagen: "/images/codo_90_pvc.jpg",
    categoria: "Canalización",
    categoriaSlug: "canalizacion",
    stock: 120,
    variantes: [
      { sku: "C90-20", medida: "20mm", precio: 1490, minima: 1 },
      { sku: "C90-25", medida: "25mm", precio: 1790, minima: 1 },
      { sku: "C90-32", medida: "32mm", precio: 2290, minima: 1 },
      { sku: "C90-50", medida: "50mm", precio: 3990, minima: 1 },
      { sku: "C90-110", medida: "110mm", precio: 12990, minima: 1 }
    ]
  }
];
/* Luego esto lo migras a MongoDB cuando quieras */