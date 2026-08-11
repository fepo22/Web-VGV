export const productos = [
	{
		id: '1',
		nombre: 'Canaleta PVC Blanca',
		precio: 28990,
		descripcion:
			'Solución para evacuación de aguas lluvias con diseño funcional y fácil instalación.',
		imagen: '/images/canaleta_blanca.png',
		categoria: 'Canalización',
		categoriaSlug: 'canalizacion'
	},
	{
		id: '2',
		nombre: 'Tubería DrenPro',
		precio: 34990,
		descripcion: 'Tubería para drenaje y evacuación con excelente resistencia y durabilidad.',
		imagen: '/images/drenpro.png',
		categoria: 'Canalización',
		categoriaSlug: 'canalizacion',
		variantes: [
			{ sku: 'DP-20', medida: '20mm x 6m', precio: 29990, minima: 25 },
			{ sku: 'DP-25', medida: '25mm x 6m', precio: 32990, minima: 20 },
			{ sku: 'DP-32', medida: '32mm x 6m', precio: 34990, minima: 10 },
			{ sku: 'DP-40', medida: '40mm x 6m', precio: 39990, minima: 10 }
		]
	},
	{
		id: '3',
		nombre: 'Tubo HDPE',
		precio: 22990,
		descripcion: 'Tubo flexible ideal para sistemas de agua y conducción con alta resistencia.',
		imagen: '/images/hdpe.png',
		categoria: 'Canalización',
		categoriaSlug: 'canalizacion',
		variantes: [
			{ sku: 'HDPE-20', medida: '20mm x 6m', precio: 21990, minima: 25 },
			{ sku: 'HDPE-25', medida: '25mm x 6m', precio: 22990, minima: 20 },
			{ sku: 'HDPE-32', medida: '32mm x 6m', precio: 25990, minima: 10 }
		]
	},
	{
		id: '4',
		nombre: 'Tubo Colector',
		precio: 26990,
		descripcion:
			'Producto para instalaciones de colectores y sistemas de drenaje de alto rendimiento.',
		imagen: '/images/colector.png',
		categoria: 'Canalización',
		categoriaSlug: 'canalizacion',
		variantes: [
			{ sku: 'COL-SN4-110', medida: '110mm x 6m SN4', precio: 26990, minima: 6 },
			{ sku: 'COL-SN8-110', medida: '110mm x 6m SN8', precio: 29990, minima: 6 },
			{ sku: 'COL-SN8-160', medida: '160mm x 6m SN8', precio: 36990, minima: 3 }
		]
	},
	{
		id: '5',
		nombre: 'Tubería de Cobre',
		precio: 39990,
		descripcion: 'Material premium para instalaciones de agua y gas con gran confiabilidad.',
		imagen: '/images/tubo_cobre.png',
		categoria: 'Canalización',
		categoriaSlug: 'canalizacion',
		variantes: [
			{ sku: 'COB-15', medida: '15mm x 6m', precio: 39990, minima: 5 },
			{ sku: 'COB-22', medida: '22mm x 6m', precio: 46990, minima: 3 },
			{ sku: 'COB-28', medida: '28mm x 6m', precio: 54990, minima: 2 }
		]
	},
	{
		id: '6',
		nombre: 'Adhesivo de Montaje',
		precio: 12990,
		descripcion: 'Adhesivo de montaje para aplicaciones rápidas y seguras en obra.',
		imagen: '/images/Peg_montaje.png',
		categoria: 'Pegamentos y cementos',
		categoriaSlug: 'pegamentos-cementos'
	},
	{
		id: '7',
		nombre: 'Pegamento Cerámico y Porcelanato',
		precio: 15990,
		descripcion: 'Adhesivo especializado para cerámica y porcelanato con excelente fijación.',
		imagen: '/images/sika_ceram.png',
		categoria: 'Pegamentos y cementos',
		categoriaSlug: 'pegamentos-cementos'
	},
	{
		id: '8',
		nombre: 'Silirub AC',
		precio: 8990,
		descripcion: 'Silicona acética para sellado y acabado en múltiples aplicaciones.',
		imagen: '/images/Silirub_ac.png',
		categoria: 'Pegamentos y cementos',
		categoriaSlug: 'pegamentos-cementos'
	},
	{
		id: '9',
		nombre: 'Adesilex P9',
		precio: 17990,
		descripcion: 'Aditivo para concreto con propiedades reforzantes y de mejora estructural.',
		imagen: '/images/adesilex.png',
		categoria: 'Pegamentos y cementos',
		categoriaSlug: 'pegamentos-cementos'
	},
	{
		id: '10',
		nombre: 'Termo Eléctrico Muro',
		precio: 109990,
		descripcion: 'Termo eléctrico para instalación en pared, ideal para agua caliente eficiente.',
		imagen: '/images/termo.png',
		categoria: 'Calefont y calefacción',
		categoriaSlug: 'calefont-calefaccion'
	},
	{
		id: '11',
		nombre: 'Monomando Lavaplatos Flexible',
		precio: 49990,
		descripcion:
			'Grifería monomando con cuello flexible para cocina, fácil de limpiar y resistente al uso diario.',
		imagen: '/images/monomando_lavaplatos.png',
		categoria: 'Griferías y sanitarios',
		categoriaSlug: 'griferias-sanitarios'
	},
	{
		id: '12',
		nombre: 'WC One Piece Dual Flush',
		precio: 139990,
		descripcion: 'Sanitario de una pieza con descarga dual para ahorro de agua y mejor higiene.',
		imagen: '/images/wc_one_piece.png',
		categoria: 'Griferías y sanitarios',
		categoriaSlug: 'griferias-sanitarios'
	},
	{
		id: '13',
		nombre: 'Lavamanos Loza Mural',
		precio: 45990,
		descripcion:
			'Lavamanos mural compacto para baños residenciales y comerciales de alto tránsito.',
		imagen: '/images/lavamanos_mural.png',
		categoria: 'Griferías y sanitarios',
		categoriaSlug: 'griferias-sanitarios'
	},
	{
		id: '14',
		nombre: 'Portátil 9000 BTU Frío/Calor Splendid',
		precio: 256000,
		descripcion: 'Equipo portátil frío/calor para climatización eficiente en espacios interiores.',
		imagen: '/images/ofertas/portable_9000.jpg',
		categoria: 'Calefont y calefacción',
		categoriaSlug: 'calefont-calefaccion',
		oferta: true,
		descuentoPct: 17
	},
	{
		id: '15',
		nombre: 'Portátil 12000 BTU Frío/Calor WiFi Splendid',
		precio: 299000,
		descripcion:
			'Climatizador portátil con conectividad WiFi y mayor capacidad para ambientes amplios.',
		imagen: '/images/ofertas/portable_12000_wifi.jpg',
		categoria: 'Calefont y calefacción',
		categoriaSlug: 'calefont-calefaccion',
		oferta: true,
		descuentoPct: 36
	},
	{
		id: '16',
		nombre: 'Jarra purificadora de agua potable',
		precio: 17000,
		descripcion: 'Jarra de filtrado para mejorar sabor y calidad del agua de consumo diario.',
		imagen: '/images/ofertas/jarra_purificadora.jpg',
		categoria: 'Griferías y sanitarios',
		categoriaSlug: 'griferias-sanitarios',
		oferta: true,
		descuentoPct: 37
	},
	{
		id: '17',
		nombre: 'Filtro Purificador Triple',
		precio: 51000,
		descripcion: 'Sistema de purificación de tres etapas para agua más limpia en el hogar.',
		imagen: '/images/ofertas/filtro_purificador_triple.png',
		categoria: 'Griferías y sanitarios',
		categoriaSlug: 'griferias-sanitarios',
		oferta: true,
		descuentoPct: 37
	},
	{
		id: '18',
		nombre: "Pomel 1' x 104mm",
		precio: 1200,
		descripcion: 'Accesorio de conexión para instalaciones sanitarias y de canalización.',
		imagen: '/images/ofertas/pomel_1x104.jpg',
		categoria: 'Consumibles de obra',
		categoriaSlug: 'consumibles-obra',
		oferta: true,
		descuentoPct: 36
	}
];
