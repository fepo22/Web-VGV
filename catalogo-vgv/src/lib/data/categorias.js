export const familias = [
	{
		slug: 'canalizacion-tuberia',
		nombre: 'Canalización y tubería',
		subfamilias: [
			{ slug: 'medidores-accesorios', nombre: 'Medidores y Accesorios' },
			{ slug: 'astm', nombre: 'ASTM' },
			{ slug: 'ppr', nombre: 'PPR' },
			{ slug: 'galvanizado', nombre: 'Galvanizado' },
			{ slug: 'hdpe', nombre: 'HDPE' },
			{ slug: 'cobre', nombre: 'Cobre' },
			{ slug: 'bronce', nombre: 'Bronce' },
			{ slug: 'corrugada', nombre: 'Corrugada' },
			{
				slug: 'pvc',
				nombre: 'PVC',
				categorias: [
					{ slug: 'sanitario', nombre: 'Sanitario' },
					{ slug: 'hidraulico', nombre: 'Hidráulico' },
					{ slug: 'colector', nombre: 'Colector' },
					{ slug: 'electrico', nombre: 'Eléctrico' },
					{ slug: 'aguas-lluvias', nombre: 'Aguas Lluvias' },
					{ slug: 'riego-jardin', nombre: 'Riego Jardín' },
					{ slug: 'valvulas-collarines', nombre: 'Válvulas y Collarines' },
					{ slug: 'adhesivos', nombre: 'Adhesivos' }
				]
			},
			{
				slug: 'fitting',
				nombre: 'Fitting',
				categorias: [
					{ slug: 'sanitario', nombre: 'Sanitario' },
					{ slug: 'hidraulico', nombre: 'Hidráulico' },
					{ slug: 'colector', nombre: 'Colector' },
					{ slug: 'electrico', nombre: 'Eléctrico' },
					{ slug: 'aguas-lluvias', nombre: 'Aguas Lluvias' },
					{ slug: 'cobre', nombre: 'Cobre' },
					{ slug: 'bronce', nombre: 'Bronce' },
					{ slug: 'ppr', nombre: 'PPR' },
					{ slug: 'hdpe', nombre: 'HDPE' },
					{ slug: 'astm', nombre: 'ASTM' }
				]
			}
		]
	},
	{
		slug: 'pegamentos-cementos',
		nombre: 'Pegamentos y cementos',
		subfamilias: [
			{ slug: 'cementicios', nombre: 'Cementicios' },
			{ slug: 'aditivos', nombre: 'Aditivos' },
			{ slug: 'pegamentos', nombre: 'Pegamentos' },
			{ slug: 'siliconas', nombre: 'Siliconas' },
			{ slug: 'sellantes', nombre: 'Sellantes' }
		]
	},
	{
		slug: 'bano-cocina',
		nombre: 'Baño y Cocina',
		subfamilias: [
			{ slug: 'sifones-desagues', nombre: 'Sifones y desagües' },
			{ slug: 'flexibles', nombre: 'Flexibles' },
			{ slug: 'lavaplatos', nombre: 'Lavaplatos' },
			{ slug: 'tinas-duchas', nombre: 'Tinas y duchas' },
			{
				slug: 'muebles',
				nombre: 'Muebles',
				categorias: [
					{ slug: 'bano', nombre: 'Baño' },
					{ slug: 'cocina', nombre: 'Cocina' }
				]
			},
			{
				slug: 'griferia',
				nombre: 'Grifería',
				categorias: [
					{ slug: 'riego-jardin', nombre: 'Riego/Jardín' },
					{ slug: 'bano', nombre: 'Baño' },
					{ slug: 'cocina', nombre: 'Cocina' }
				]
			},
			{ slug: 'set-bano', nombre: 'Set de Baño' },
			{ slug: 'accesorios-bano', nombre: 'Accesorios de Baño' }
		]
	},
	{
		slug: 'calefaccion',
		nombre: 'Calefacción',
		subfamilias: [
			{ slug: 'calefont', nombre: 'Calefont' },
			{ slug: 'paneles', nombre: 'Paneles' },
			{ slug: 'calefactores', nombre: 'Calefactores' },
			{ slug: 'aislamiento-termico', nombre: 'Aislamiento Térmico' },
			{ slug: 'termos', nombre: 'Termos' }
		]
	},
	{
		slug: 'consumibles-obra',
		nombre: 'Consumibles de Obra',
		subfamilias: [
			{ slug: 'cintas', nombre: 'Cintas' },
			{ slug: 'accesorios-pinturas', nombre: 'Accesorios Pinturas' },
			{ slug: 'accesorios-albanileria', nombre: 'Accesorios Albañilería' }
		]
	}
];

const familiasLegacy = {
	canalizacion: 'canalizacion-tuberia',
	'griferias-sanitarios': 'bano-cocina',
	'calefont-calefaccion': 'calefaccion'
};

export function normalizeFamiliaSlug(slug) {
	return familiasLegacy[slug] ?? slug;
}
