export const products = [
  {
    id: 1,
    nombre: "Canaleta PVC Blanca",
    descripcion: "Solución para evacuación de aguas lluvias con diseño funcional y fácil instalación.",
    imagen: "/images/canaleta_blanca.png",
    categoria: "Canalización",
    categoriaSlug: "canalizacion",
    stock: 50
  },
  {
    id: 2,
    nombre: "Tubería DrenPro",
    descripcion: "Tubería para drenaje y evacuación con excelente resistencia y durabilidad.",
    imagen: "/images/drenpro.png",
    categoria: "Canalización",
    categoriaSlug: "canalizacion",
    stock: 35,
    variantes: [
      { sku: "DP-20", medida: "20mm x 6m", minima: 25 },
      { sku: "DP-25", medida: "25mm x 6m", minima: 20 },
      { sku: "DP-32", medida: "32mm x 6m", minima: 10 },
      { sku: "DP-40", medida: "40mm x 6m", minima: 10 }
    ]
  },
  {
    id: 3,
    nombre: "Tubo HDPE",
    descripcion: "Tubo flexible ideal para sistemas de agua y conducción con alta resistencia.",
    imagen: "/images/hdpe.png",
    categoria: "Canalización",
    categoriaSlug: "canalizacion",
    stock: 42,
    variantes: [
      { sku: "HDPE-20", medida: "20mm x 6m", minima: 25 },
      { sku: "HDPE-25", medida: "25mm x 6m", minima: 20 },
      { sku: "HDPE-32", medida: "32mm x 6m", minima: 10 }
    ]
  },
  {
    id: 4,
    nombre: "Tubo Colector",
    descripcion: "Producto para instalaciones de colectores y sistemas de drenaje de alto rendimiento.",
    imagen: "/images/colector.png",
    categoria: "Canalización",
    categoriaSlug: "canalizacion",
    stock: 31,
    variantes: [
      { sku: "COL-SN4-110", medida: "110mm x 6m SN4", minima: 6 },
      { sku: "COL-SN8-110", medida: "110mm x 6m SN8", minima: 6 },
      { sku: "COL-SN8-160", medida: "160mm x 6m SN8", minima: 3 }
    ]
  },
  {
    id: 5,
    nombre: "Cañería de Cobre",
    descripcion: "Material premium para instalaciones de agua y gas con gran confiabilidad.",
    imagen: "/images/tubo_cobre.png",
    categoria: "Canalización",
    categoriaSlug: "canalizacion",
    stock: 18,
    variantes: [
      { sku: "COB-15", medida: "15mm x 6m", minima: 5 },
      { sku: "COB-22", medida: "22mm x 6m", minima: 3 },
      { sku: "COB-28", medida: "28mm x 6m", minima: 2 }
    ]
  },
  {
    id: 6,
    nombre: "Adhesivo de Montaje",
    descripcion: "Adhesivo de montaje para aplicaciones rápidas y seguras en obra.",
    imagen: "/images/Peg_montaje.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 65
  },
  {
    id: 7,
    nombre: "Sikaceram 50",
    descripcion: "Adhesivo especializado para cerámica y porcelanato con excelente fijación.",
    imagen: "/images/sika_ceram.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 58
  },
  {
    id: 8,
    nombre: "Silirub AC",
    descripcion: "Silicona acética para sellado y acabado en múltiples aplicaciones.",
    imagen: "/images/Silirub_ac.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 80
  },
  {
    id: 9,
    nombre: "Adesilex P9",
    descripcion: "Aditivo para concreto con propiedades reforzantes y de mejora estructural.",
    imagen: "/images/adesilex.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 44
  },
  {
    id: 10,
    nombre: "Termo eléctrico mural 120 litros Splendid",
    descripcion: "Termo eléctrico para instalación en pared, ideal para agua caliente eficiente.\n\nTanque interno enlozado.\nSistema de aislamiento en poliuretano expandido.\nIndicador de temperatura.\nSelector de temperatura.\nConexión 220 V.\nSistema de seguridad para sobrepresión.\nVálvula anti-retorno.",
    imagen: "/images/termo.png",
    categoria: "Calefont y calefacción",
    categoriaSlug: "calefont-calefaccion",
    stock: 20
  },
  {
    id: 14,
    nombre: "Portátil 9000 BTU Frío/Calor Splendid",
    descripcion: "Función Frío/Calor\nIdeal para verano e invierno\nWiFi: Controla desde tu smartphone\nAutocondensación\nDiseño compacto\nFácil instalación",
    imagen: "/images/ofertas/portable_9000.jpg",
    categoria: "Calefont y calefacción",
    categoriaSlug: "calefont-calefaccion",
    stock: 7
  },
  {
    id: 15,
    nombre: "Portátil 12000 BTU Frío/Calor WiFi Splendid",
    descripcion: "Calefacción y enfriamiento\nWiFi: Controla desde tu smartphone\nAutocondensación\nDiseño compacto\nFácil instalación",
    imagen: "/images/ofertas/portable_12000_wifi.jpg",
    categoria: "Calefont y calefacción",
    categoriaSlug: "calefont-calefaccion",
    stock: 10
  },
  {
    id: 16,
    nombre: "Jarra purificadora de agua potable",
    descripcion: "Jarra de filtrado para mejorar sabor y calidad del agua de consumo diario.",
    imagen: "/images/ofertas/jarra_purificadora.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 20
  },
  {
    id: 17,
    nombre: "Filtro Purificador Triple",
    descripcion: "Sistema de purificación de tres etapas para agua más limpia en el hogar.",
    imagen: "/images/ofertas/filtro_purificador_triple.png",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 12
  },
  {
    id: 18,
    nombre: "Pomel 1' x 104mm",
    descripcion: "Accesorio de conexión para instalaciones sanitarias y de canalización.",
    imagen: "/images/ofertas/pomel_1x104.jpg",
    categoria: "Consumibles de obra",
    categoriaSlug: "consumibles-obra",
    stock: 40
  },
  {
    id: 20,
    nombre: "Acrilico Grietas Soudal",
    descripcion: "Sellador acrilico para rellenar grietas y fendas en hormigon, ladrillo y yeso. Pintable.",
    imagen: "/images/acrilico_grietas_soudal.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 62
  },
  {
    id: 21,
    nombre: "Acryrub Sellador Acrilico",
    descripcion: "Sellador acrilico base agua para juntas interiores y terminaciones.",
    imagen: "/images/acryrub.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 58
  },
  {
    id: 22,
    nombre: "Silicona AC",
    descripcion: "Silicona acida para sellado en superficies no porosas y juntas sanitarias.",
    imagen: "/images/silicona_ac_soudal.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 90
  },
  {
    id: 23,
    nombre: "Silirub Soudal",
    descripcion: "Sellador de silicona para juntas de dilatacion y aplicaciones generales.",
    imagen: "/images/silirub_soudal_real.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 76
  },
  {
    id: 24,
    nombre: "Sin Clavos 360gr",
    descripcion: "Adhesivo de montaje de alta adherencia para fijaciones sin perforar.",
    imagen: "/images/sin_clavos_360gr_soudal.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 68
  },
  {
    id: 25,
    nombre: "Soudabond",
    descripcion: "Adhesivo elastico multiproposito para pegado y sellado en obra.",
    imagen: "/images/soudabond.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 52
  },
  {
    id: 26,
    nombre: "Soudalflex",
    descripcion: "Sellador elastomerico para juntas expuestas a movimiento y vibracion.",
    imagen: "/images/soudalflex.png",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 44
  },
  {
    id: 27,
    nombre: "Asiento y tapa PP WC Aura",
    descripcion: "Asiento y tapa para WC en polipropileno con diseño sobrio y fácil limpieza.",
    imagen: "/images/asiento_tapa_pp_wc_aura.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 18
  },
  {
    id: 28,
    nombre: "Barra cortina 60-90 cm",
    descripcion: "Accesorio para cortina de ducha ajustable en medidas estándar para baño.",
    imagen: "/images/barra_cortina_60_90cm.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 25
  },
  {
    id: 29,
    nombre: "Estanque WC NER ATOS",
    descripcion: "Estanque para WC con sistema funcional y acabado moderno para instalaciones residenciales.",
    imagen: "/images/estanque_wc_ner_atos.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 12
  },
  {
    id: 30,
    nombre: "Lavamanos Aura",
    descripcion: "Lavamanos de diseño compacto ideal para baño con estética simple y moderna.",
    imagen: "/images/lavamanos_aura.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 17
  },
  {
    id: 31,
    nombre: "Llave angular HE 1/2 New con flexible",
    descripcion: "Llave angular con flexible para instalaciones de agua con mayor comodidad y durabilidad.",
    imagen: "/images/llave_angular_he_1_2_new_con_flexible.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 15
  },
  {
    id: 32,
    nombre: "Llave collar HE-HE 3/4",
    descripcion: "Llave de collar para conexión segura y funcional en sistemas de agua y calefacción.",
    imagen: "/images/llave_collar_he_he_3_4.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 14
  },
  {
    id: 33,
    nombre: "Monomando Ducha Oregon",
    descripcion: "Monomando para ducha con terminación elegante y control preciso del caudal.",
    imagen: "/images/monomando_ducha_oregon.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 9
  },
  {
    id: 34,
    nombre: "Monomando lavaplatos Oregon cuello cisne",
    descripcion: "Monomando para lavaplatos con diseño funcional y excelente resistencia al uso diario.",
    imagen: "/images/monomando_lavaplatos_oregon_cuello_cisne.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 8
  },
  {
    id: 35,
    nombre: "Monomando Lavaplatos Vermont",
    descripcion: "Monomando para lavaplatos con diseño contemporáneo y un excelente acabado.",
    imagen: "/images/monomando_lavaplatos_vermont.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 7
  },
  {
    id: 36,
    nombre: "Monomando Lavatorio Oregon",
    descripcion: "Monomando para lavatorio de uso común con control preciso y terminación moderna.",
    imagen: "/images/monomando_lavatorio_oregon.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 11
  },
  {
    id: 37,
    nombre: "Monomando Lavatorio Vermontt",
    descripcion: "Monomando para lavatorio de estilo actualizado, práctico y estético para baño y cocina.",
    imagen: "/images/monomando_lavatorio_vermontt.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 10
  },
  {
    id: 38,
    nombre: "Pedestal Theos",
    descripcion: "Pedestal para lavatorio con diseño limpio y soporte estable para baños modernos.",
    imagen: "/images/pedestal_theos.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 16
  },
  {
    id: 39,
    nombre: "Sifón lavamanos Stretto 1 1/4",
    descripcion: "Conector y sifón para lavamanos con diámetro estándar y conexión práctica para instalaciones rápidas.",
    imagen: "/images/sifon_lavamanos_stretto_1_1_4.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 20
  },
  {
    id: 40,
    nombre: "Taza WC New Ares c/Fijaciones",
    descripcion: "Taza de WC con fijaciones y diseño versátil para baño residencial y comercial.",
    imagen: "/images/taza_wc_new_ares_c_fijaciones.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 13
  },
  {
    id: 41,
    nombre: "Toallero",
    descripcion: "Toallero mural para baño con terminación cromada y montaje firme.",
    imagen: "/images/toallero.jpg",
    categoria: "Griferías y sanitarios",
    categoriaSlug: "griferias-sanitarios",
    stock: 24
  },
  {
    id: 42,
    nombre: "Prese 110 Maquillaje",
    descripcion: "Pasta base para terminaciones finas y nivelación en superficies interiores.",
    imagen: "/images/prese_110_maquillaje.jpg",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 36
  },
  {
    id: 43,
    nombre: "Presec 01 Albañilería",
    descripcion: "Mortero para albañilería con buena adherencia y rendimiento en obra.",
    imagen: "/images/presec_01_albanileria.jpg",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 32
  },
  {
    id: 44,
    nombre: "Sikaceram 100",
    descripcion: "Adhesivo cementicio para cerámicas en aplicaciones residenciales y comerciales.",
    imagen: "/images/sikaceram_100.jpg",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 40
  },
  {
    id: 45,
    nombre: "Sikaceram 200Flex",
    descripcion: "Adhesivo flexible para porcelanato y revestimientos de mayor exigencia.",
    imagen: "/images/sikaceram_200flex.jpg",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 28
  },
  {
    id: 46,
    nombre: "SikaChapdur",
    descripcion: "Endurecedor superficial para pisos de hormigón de alto tránsito.",
    imagen: "/images/sikachapdur.jpg",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 22
  },
  {
    id: 47,
    nombre: "Sikadur 31hmg",
    descripcion: "Adhesivo epóxico estructural para anclajes, uniones y reparaciones.",
    imagen: "/images/sikadur_31hmg.jpg",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 18
  },
  {
    id: 48,
    nombre: "Sikatop",
    descripcion: "Mortero de reparación para hormigón con buena trabajabilidad y adherencia.",
    imagen: "/images/sikatop.jpg",
    categoria: "Pegamentos y cementos",
    categoriaSlug: "pegamentos-cementos",
    stock: 26
  },
  {
    id: 49,
    nombre: "Codo 90 PVC",
    descripcion: "Codo PVC de 90 grados para cambios de dirección en instalaciones de canalización.",
    imagen: "/images/codo_90_pvc.jpg",
    categoria: "Canalización",
    categoriaSlug: "canalizacion",
    stock: 1,
    variantes: [
      { sku: "C90-20", medida: "20mm", minima: 1 },
      { sku: "C90-25", medida: "25mm", minima: 1 },
      { sku: "C90-32", medida: "32mm", minima: 1 },
      { sku: "C90-50", medida: "50mm", minima: 1 },
      { sku: "C90-110", medida: "110mm", minima: 1 }
    ]
  }
];
/* Luego esto lo migras a MongoDB cuando quieras */