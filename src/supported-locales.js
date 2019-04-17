/**
 * Currently supported locales for the Scratch Project
 * @type {Object} Key Value pairs of locale code: Language name written in the language
 */

const locales = {
    'ab': {name: 'Аҧсшәа'},
    'ar': {name: 'العربية'},
    'am': {name: 'አማርኛ'},
    'az': {name: 'Azeri'},
    'id': {name: 'Bahasa Indonesia'},
    'be': {name: 'беларуская'},
    'bg': {name: 'Български'},
    'ca': {name: 'Català'},
    'cs': {name: 'Česky'},
    'cy': {name: 'Cymraeg'},
    'da': {name: 'Dansk'},
    'de': {name: 'Deutsch'},
    'et': {name: 'Eesti'},
    'el': {name: 'Ελληνικά'},
    'en': {name: 'English'},
    'es': {name: 'Español'},
    'es-419': {name: 'Español Latinoamericano'},
    'eu': {name: 'Euskara'},
    'fa': {name: 'فارسی'},
    'fr': {name: 'Français'},
    'ga': {name: 'Gaeilge'},
    'gd': {name: 'Gàidhlig'},
    'gl': {name: 'Galego'},
    'ko': {name: '한국어'},
    'he': {name: 'עִבְרִית'},
    'hr': {name: 'Hrvatski'},
    'zu': {name: 'isiZulu'},
    'is': {name: 'Íslenska'},
    'it': {name: 'Italiano'},
    'ckb': {name: 'کوردیی ناوەندی'},
    'lv': {name: 'Latviešu'},
    'lt': {name: 'Lietuvių'},
    'hu': {name: 'Magyar'},
    'mi': {name: 'Māori'},
    'nl': {name: 'Nederlands'},
    'ja': {name: '日本語'},
    'ja-Hira': {name: 'にほんご'},
    'nb': {name: 'Norsk Bokmål'},
    'nn': {name: 'Norsk Nynorsk'},
    'th': {name: 'ไทย'},
    'pl': {name: 'Polski'},
    'pt': {name: 'Português'},
    'pt-br': {name: 'Português Brasileiro'},
    'ro': {name: 'Română'},
    'ru': {name: 'Русский'},
    'sr': {name: 'Српски'},
    'sk': {name: 'Slovenčina'},
    'sl': {name: 'Slovenščina'},
    'fi': {name: 'Suomi'},
    'sv': {name: 'Svenska'},
    'vi': {name: 'Tiếng Việt'},
    'tr': {name: 'Türkçe'},
    'uk': {name: 'Українська'},
    'zh-cn': {name: '简体中文'},
    'zh-tw': {name: '繁體中文'}
};

const customLocales = {
    'ab': {
        locale: 'ab',
        parentLocale: 'az'
    },
    // TODO: replace zh-cn, zh-tw with zh-Hans and zh-Hant
    'zh-cn': {
        locale: 'zh-cn',
        parentLocale: 'zh'
    },
    'zh-tw': {
        locale: 'zh-tw',
        parentLocale: 'zh'
    }
};

const localeMap = {
    'aa-dj': 'aa_DJ',
    'es-419': 'es_419',
    // ja-Hira: no map - it's 'ja-Hira' on transifex
    'pt-br': 'pt_BR',
    'zh-cn': 'zh_CN',
    'zh-tw': 'zh_TW'
};

// list of RTL locales supported, and a function to check whether a locale is RTL
const rtlLocales = [
    'ar',
    'ckb',
    'fa',
    'he'
];

const isRtl = locale => {
    return rtlLocales.indexOf(locale) !== -1;
};

export {locales as default, customLocales, localeMap, rtlLocales, isRtl};
