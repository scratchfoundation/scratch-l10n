/**
 * @typedef {Object} LocaleData
 * @property {string} name - The name of the locale in the locale's language
 */

/**
 * Currently supported locales for the Scratch Project
 * @type {Record<string, LocaleData>} Key Value pairs of locale code: Language name written in the language
 */
const locales = {
    'ab': {name: 'Аҧсшәа'},
    'af': {name: 'Afrikaans'},
    'ar': {name: 'العربية'},
    'am': {name: 'አማርኛ'},
    'an': {name: 'Aragonés'},
    'ast': {name: 'Asturianu'},
    'az': {name: 'Azeri'},
    'id': {name: 'Bahasa Indonesia'},
    'bn': {name: 'বাংলা'},
    'be': {name: 'Беларуская'},
    'bg': {name: 'Български'},
    'ca': {name: 'Català'},
    'cs': {name: 'Česky'},
    'cy': {name: 'Cymraeg'},
    'da': {name: 'Dansk'},
    'de': {name: 'Deutsch'},
    'et': {name: 'Eesti'},
    'el': {name: 'Ελληνικά'},
    'en': {name: 'English'},
    'es': {name: 'Español (España)'},
    'es-419': {name: 'Español Latinoamericano'},
    'eo': {name: 'Esperanto'},
    'eu': {name: 'Euskara'},
    'fa': {name: 'فارسی'},
    'fil': {name: 'Filipino'},
    'fr': {name: 'Français'},
    'fy': {name: 'Frysk'},
    'ga': {name: 'Gaeilge'},
    'gd': {name: 'Gàidhlig'},
    'gl': {name: 'Galego'},
    'ko': {name: '한국어'},
    'ha': {name: 'Hausa'},
    'hy': {name: 'Հայերեն'},
    'he': {name: 'עִבְרִית'},
    'hi': {name: 'हिंदी'},
    'hr': {name: 'Hrvatski'},
    'xh': {name: 'isiXhosa'},
    'zu': {name: 'isiZulu'},
    'is': {name: 'Íslenska'},
    'it': {name: 'Italiano'},
    'ka': {name: 'ქართული ენა'},
    'kk': {name: 'қазақша'},
    'qu': {name: 'Kichwa'},
    'sw': {name: 'Kiswahili'},
    'ht': {name: 'Kreyòl ayisyen'},
    'ku': {name: 'Kurdî'},
    'ckb': {name: 'کوردیی ناوەندی'},
    'lv': {name: 'Latviešu'},
    'lt': {name: 'Lietuvių'},
    'hu': {name: 'Magyar'},
    'mi': {name: 'Māori'},
    'mn': {name: 'Монгол хэл'},
    'nl': {name: 'Nederlands'},
    'ja': {name: '日本語'},
    'ja-Hira': {name: 'にほんご'},
    'nb': {name: 'Norsk Bokmål'},
    'nn': {name: 'Norsk Nynorsk'},
    'oc': {name: 'Occitan'},
    'or': {name: 'ଓଡ଼ିଆ'},
    'uz': {name: 'Oʻzbekcha'},
    'th': {name: 'ไทย'},
    'km': {name: 'ភាសាខ្មែរ'},
    'pl': {name: 'Polski'},
    'pt': {name: 'Português'},
    'pt-br': {name: 'Português Brasileiro'},
    'rap': {name: 'Rapa Nui'},
    'ro': {name: 'Română'},
    'ru': {name: 'Русский'},
    'nso': {name: 'Sepedi'},
    'tn': {name: 'Setswana'},
    'sk': {name: 'Slovenčina'},
    'sl': {name: 'Slovenščina'},
    'sr': {name: 'Српски'},
    'fi': {name: 'Suomi'},
    'sv': {name: 'Svenska'},
    'vi': {name: 'Tiếng Việt'},
    'tr': {name: 'Türkçe'},
    'uk': {name: 'Українська'},
    'zh-cn': {name: '简体中文'},
    'zh-tw': {name: '繁體中文'}
};

/**
 * @typedef {Object} CustomLocale
 * @property {string} locale - The locale code for this custom locale
 * @property {string} parentLocale - The "parent" locale code to use as a fallback
 */

/**
 * List of custom locales supported by Scratch but not in the locale data
 * @type {Record<string, CustomLocale>}
 */
const customLocales = {
    'ab': {
        locale: 'ab',
        parentLocale: 'ru'
    },
    // Aragonese is not in the locale data, using es for Spain
    'an': {
        locale: 'an',
        parentLocale: 'es'
    },
    // Haitian Creole is not in locale-langData
    'ht': {
        locale: 'ht',
        parentLocale: 'fr'
    },
    'oc': {
        locale: 'oc',
        parentLocale: 'fr'
    },
    'rap': {
        locale: 'rap',
        parentLocale: 'es'
    },
    // TODO: replace zh-cn, zh-tw with zh-Hans and zh-Hant then customLocales is unnecessary
    'zh-cn': {
        locale: 'zh-cn',
        parentLocale: 'zh'
    },
    'zh-tw': {
        locale: 'zh-tw',
        parentLocale: 'zh'
    }
};


/**
 * Map of Scratch locale codes to Transifex locale codes
 * @type {Record<string, string>}
 */
const localeMap = {
    'aa-dj': 'aa_DJ',
    'es-419': 'es_419',
    // ja-Hira: no map - it's 'ja-Hira' on transifex
    'pt-br': 'pt_BR',
    'zh-cn': 'zh_CN',
    'zh-tw': 'zh_TW'
};

/**
 * List of right-to-left (RTL) locale codes
 * @type {string[]}
 */
const rtlLocales = [
    'ar',
    'ckb',
    'fa',
    'he'
];

/**
 * @param {string} locale - The locale code to check
 * @returns {boolean} - True if the locale is RTL, false otherwise
 */
const isRtl = locale => {
    return rtlLocales.indexOf(locale) !== -1;
};

export {locales as default, customLocales, localeMap, isRtl};
