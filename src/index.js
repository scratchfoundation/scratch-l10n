import en from 'react-intl/locale-data/en';
import az from 'react-intl/locale-data/az'; // parent for Abkahz
import ca from 'react-intl/locale-data/ca';
import cs from 'react-intl/locale-data/cs';
import cy from 'react-intl/locale-data/cy';
import de from 'react-intl/locale-data/de';
import el from 'react-intl/locale-data/el';
import es from 'react-intl/locale-data/es';
import fr from 'react-intl/locale-data/fr';
import ga from 'react-intl/locale-data/ga';
import gd from 'react-intl/locale-data/gd';
import he from 'react-intl/locale-data/he';
import it from 'react-intl/locale-data/it';
import ja from 'react-intl/locale-data/ja';
import nl from 'react-intl/locale-data/nl';
import nb from 'react-intl/locale-data/nb';
import pt from 'react-intl/locale-data/pt';
import sl from 'react-intl/locale-data/sl';
import sr from 'react-intl/locale-data/sr';
import tr from 'react-intl/locale-data/tr';
import uk from 'react-intl/locale-data/uk';
import zh from 'react-intl/locale-data/zh';

import locales, {customLocales} from './supported-locales.js';
/*
locales = {
    'ab': {name: 'Аҧсшәа'},
    'ca': {name: 'Català'},
    'cs': {name: 'Česky'},
    'cy': {name: 'Cymraeg'},
    'de': {name: 'Deutsch'},
    'el': {name: 'Ελληνικά'},
    'en': {name: 'English'},
    'es': {name: 'Español'},
    'es-419': {name: 'Español Latinoamericano'},
    'fr': {name: 'Français'},
    'ga': {name: 'Gaeilge'},
    'gd': {name: 'Gàidhlig'},
    'he': {name: 'עִבְרִית'},
    'it': {name: 'Italiano'},
    'ja': {name: '日本語'},
    'mi': {name: 'Maori'},
    'nl': {name: 'Nederlands'},
    'nb': {name: 'Norsk Bokmål'},
    'pt': {name: 'Português'},
    'pt-br': {name: 'Português Brasileiro'},
    'sr': {name: 'Српски'},
    'sl': {name: 'Slovenščina'},
    'tr': {name: 'Türkçe'},
    'uk': {name: 'Українська'},
    'zh-cn': {name: '简体中文'},
    'zh-tw': {name: '繁體中文'}
*/

let localeData = [].concat(
    en,
    az, // parent for Abkahz
    ca,
    cs,
    cy,
    de,
    el,
    es,
    fr,
    ga,
    gd,
    he,
    it,
    ja,
    nl,
    nb,
    pt,
    sl,
    sr,
    tr,
    uk,
    zh
);

for (const lang in customLocales) {
    localeData.push(customLocales[lang]);
}

export {
    locales as default,
    localeData // data expected for initializing ReactIntl.addLocaleData
};
