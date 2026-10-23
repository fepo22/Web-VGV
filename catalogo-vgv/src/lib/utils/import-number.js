export function parseExcelNumber(value) {
	if (typeof value === 'number') return value;
	if (typeof value !== 'string') return Number.NaN;
	let text = value.trim();
	if (!/^-?\d+(?:[.,]\d+)*$/.test(text)) return Number.NaN;
	if (text.includes(',') && text.includes('.')) {
		if (/^-?\d{1,3}(?:\.\d{3})+,\d+$/.test(text)) {
			text = text.replace(/\./g, '').replace(',', '.');
		} else if (/^-?\d{1,3}(?:,\d{3})+\.\d+$/.test(text)) {
			text = text.replace(/,/g, '');
		} else {
			return Number.NaN;
		}
	} else if (text.includes(',')) {
		text = text.replace(',', '.');
	} else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(text)) {
		text = text.replace(/\./g, '');
	}
	return Number(text);
}
