export type Country = {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: string;
  /** International dialling code, without the leading "+" */
  dial: string;
  /** IANA timezone used as the business default for this country */
  timezone: string;
  /** ISO 4217 currency code */
  currency: string;
};

export const COUNTRIES: Country[] = [
  { code: "AR", name: "Argentina", dial: "54", timezone: "America/Argentina/Buenos_Aires", currency: "ARS" },
  { code: "AU", name: "Australia", dial: "61", timezone: "Australia/Sydney", currency: "AUD" },
  { code: "AT", name: "Austria", dial: "43", timezone: "Europe/Vienna", currency: "EUR" },
  { code: "BH", name: "Bahrain", dial: "973", timezone: "Asia/Bahrain", currency: "BHD" },
  { code: "BD", name: "Bangladesh", dial: "880", timezone: "Asia/Dhaka", currency: "BDT" },
  { code: "BE", name: "Belgium", dial: "32", timezone: "Europe/Brussels", currency: "EUR" },
  { code: "BR", name: "Brazil", dial: "55", timezone: "America/Sao_Paulo", currency: "BRL" },
  { code: "BG", name: "Bulgaria", dial: "359", timezone: "Europe/Sofia", currency: "BGN" },
  { code: "CA", name: "Canada", dial: "1", timezone: "America/Toronto", currency: "CAD" },
  { code: "CL", name: "Chile", dial: "56", timezone: "America/Santiago", currency: "CLP" },
  { code: "CN", name: "China", dial: "86", timezone: "Asia/Shanghai", currency: "CNY" },
  { code: "CO", name: "Colombia", dial: "57", timezone: "America/Bogota", currency: "COP" },
  { code: "HR", name: "Croatia", dial: "385", timezone: "Europe/Zagreb", currency: "EUR" },
  { code: "CY", name: "Cyprus", dial: "357", timezone: "Asia/Nicosia", currency: "EUR" },
  { code: "CZ", name: "Czechia", dial: "420", timezone: "Europe/Prague", currency: "CZK" },
  { code: "DK", name: "Denmark", dial: "45", timezone: "Europe/Copenhagen", currency: "DKK" },
  { code: "EG", name: "Egypt", dial: "20", timezone: "Africa/Cairo", currency: "EGP" },
  { code: "EE", name: "Estonia", dial: "372", timezone: "Europe/Tallinn", currency: "EUR" },
  { code: "ET", name: "Ethiopia", dial: "251", timezone: "Africa/Addis_Ababa", currency: "ETB" },
  { code: "FI", name: "Finland", dial: "358", timezone: "Europe/Helsinki", currency: "EUR" },
  { code: "FR", name: "France", dial: "33", timezone: "Europe/Paris", currency: "EUR" },
  { code: "DE", name: "Germany", dial: "49", timezone: "Europe/Berlin", currency: "EUR" },
  { code: "GH", name: "Ghana", dial: "233", timezone: "Africa/Accra", currency: "GHS" },
  { code: "GR", name: "Greece", dial: "30", timezone: "Europe/Athens", currency: "EUR" },
  { code: "HK", name: "Hong Kong", dial: "852", timezone: "Asia/Hong_Kong", currency: "HKD" },
  { code: "HU", name: "Hungary", dial: "36", timezone: "Europe/Budapest", currency: "HUF" },
  { code: "IS", name: "Iceland", dial: "354", timezone: "Atlantic/Reykjavik", currency: "ISK" },
  { code: "IN", name: "India", dial: "91", timezone: "Asia/Kolkata", currency: "INR" },
  { code: "ID", name: "Indonesia", dial: "62", timezone: "Asia/Jakarta", currency: "IDR" },
  { code: "IE", name: "Ireland", dial: "353", timezone: "Europe/Dublin", currency: "EUR" },
  { code: "IL", name: "Israel", dial: "972", timezone: "Asia/Jerusalem", currency: "ILS" },
  { code: "IT", name: "Italy", dial: "39", timezone: "Europe/Rome", currency: "EUR" },
  { code: "JM", name: "Jamaica", dial: "1876", timezone: "America/Jamaica", currency: "JMD" },
  { code: "JP", name: "Japan", dial: "81", timezone: "Asia/Tokyo", currency: "JPY" },
  { code: "JO", name: "Jordan", dial: "962", timezone: "Asia/Amman", currency: "JOD" },
  { code: "KE", name: "Kenya", dial: "254", timezone: "Africa/Nairobi", currency: "KES" },
  { code: "KW", name: "Kuwait", dial: "965", timezone: "Asia/Kuwait", currency: "KWD" },
  { code: "LV", name: "Latvia", dial: "371", timezone: "Europe/Riga", currency: "EUR" },
  { code: "LT", name: "Lithuania", dial: "370", timezone: "Europe/Vilnius", currency: "EUR" },
  { code: "LU", name: "Luxembourg", dial: "352", timezone: "Europe/Luxembourg", currency: "EUR" },
  { code: "MY", name: "Malaysia", dial: "60", timezone: "Asia/Kuala_Lumpur", currency: "MYR" },
  { code: "MT", name: "Malta", dial: "356", timezone: "Europe/Malta", currency: "EUR" },
  { code: "MU", name: "Mauritius", dial: "230", timezone: "Indian/Mauritius", currency: "MUR" },
  { code: "MX", name: "Mexico", dial: "52", timezone: "America/Mexico_City", currency: "MXN" },
  { code: "MA", name: "Morocco", dial: "212", timezone: "Africa/Casablanca", currency: "MAD" },
  { code: "NL", name: "Netherlands", dial: "31", timezone: "Europe/Amsterdam", currency: "EUR" },
  { code: "NZ", name: "New Zealand", dial: "64", timezone: "Pacific/Auckland", currency: "NZD" },
  { code: "NG", name: "Nigeria", dial: "234", timezone: "Africa/Lagos", currency: "NGN" },
  { code: "NO", name: "Norway", dial: "47", timezone: "Europe/Oslo", currency: "NOK" },
  { code: "OM", name: "Oman", dial: "968", timezone: "Asia/Muscat", currency: "OMR" },
  { code: "PK", name: "Pakistan", dial: "92", timezone: "Asia/Karachi", currency: "PKR" },
  { code: "PE", name: "Peru", dial: "51", timezone: "America/Lima", currency: "PEN" },
  { code: "PH", name: "Philippines", dial: "63", timezone: "Asia/Manila", currency: "PHP" },
  { code: "PL", name: "Poland", dial: "48", timezone: "Europe/Warsaw", currency: "PLN" },
  { code: "PT", name: "Portugal", dial: "351", timezone: "Europe/Lisbon", currency: "EUR" },
  { code: "QA", name: "Qatar", dial: "974", timezone: "Asia/Qatar", currency: "QAR" },
  { code: "RO", name: "Romania", dial: "40", timezone: "Europe/Bucharest", currency: "RON" },
  { code: "RW", name: "Rwanda", dial: "250", timezone: "Africa/Kigali", currency: "RWF" },
  { code: "SA", name: "Saudi Arabia", dial: "966", timezone: "Asia/Riyadh", currency: "SAR" },
  { code: "SN", name: "Senegal", dial: "221", timezone: "Africa/Dakar", currency: "XOF" },
  { code: "RS", name: "Serbia", dial: "381", timezone: "Europe/Belgrade", currency: "RSD" },
  { code: "SG", name: "Singapore", dial: "65", timezone: "Asia/Singapore", currency: "SGD" },
  { code: "SK", name: "Slovakia", dial: "421", timezone: "Europe/Bratislava", currency: "EUR" },
  { code: "SI", name: "Slovenia", dial: "386", timezone: "Europe/Ljubljana", currency: "EUR" },
  { code: "ZA", name: "South Africa", dial: "27", timezone: "Africa/Johannesburg", currency: "ZAR" },
  { code: "KR", name: "South Korea", dial: "82", timezone: "Asia/Seoul", currency: "KRW" },
  { code: "ES", name: "Spain", dial: "34", timezone: "Europe/Madrid", currency: "EUR" },
  { code: "LK", name: "Sri Lanka", dial: "94", timezone: "Asia/Colombo", currency: "LKR" },
  { code: "SE", name: "Sweden", dial: "46", timezone: "Europe/Stockholm", currency: "SEK" },
  { code: "CH", name: "Switzerland", dial: "41", timezone: "Europe/Zurich", currency: "CHF" },
  { code: "TW", name: "Taiwan", dial: "886", timezone: "Asia/Taipei", currency: "TWD" },
  { code: "TZ", name: "Tanzania", dial: "255", timezone: "Africa/Dar_es_Salaam", currency: "TZS" },
  { code: "TH", name: "Thailand", dial: "66", timezone: "Asia/Bangkok", currency: "THB" },
  { code: "TN", name: "Tunisia", dial: "216", timezone: "Africa/Tunis", currency: "TND" },
  { code: "TR", name: "Türkiye", dial: "90", timezone: "Europe/Istanbul", currency: "TRY" },
  { code: "UG", name: "Uganda", dial: "256", timezone: "Africa/Kampala", currency: "UGX" },
  { code: "UA", name: "Ukraine", dial: "380", timezone: "Europe/Kyiv", currency: "UAH" },
  { code: "AE", name: "United Arab Emirates", dial: "971", timezone: "Asia/Dubai", currency: "AED" },
  { code: "GB", name: "United Kingdom", dial: "44", timezone: "Europe/London", currency: "GBP" },
  { code: "US", name: "United States", dial: "1", timezone: "America/New_York", currency: "USD" },
  { code: "UY", name: "Uruguay", dial: "598", timezone: "America/Montevideo", currency: "UYU" },
  { code: "VN", name: "Vietnam", dial: "84", timezone: "Asia/Ho_Chi_Minh", currency: "VND" },
  { code: "ZM", name: "Zambia", dial: "260", timezone: "Africa/Lusaka", currency: "ZMW" },
].sort((a, b) => a.name.localeCompare(b.name));

export function countryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

/** Regional-indicator flag emoji from the ISO alpha-2 code. */
export function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
    .join("");
}

/** Best-effort guess of the visitor's country from their browser timezone. */
export function guessCountryCode(): string | undefined {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return COUNTRIES.find((c) => c.timezone === tz)?.code;
  } catch {
    return undefined;
  }
}
