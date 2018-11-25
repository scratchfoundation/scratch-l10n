import en from 'react-intl/locale-data/en';
import am from 'react-intl/locale-data/am';
import ar from 'react-intl/locale-data/ar';
import az from 'react-intl/locale-data/az'; // also parent for Abkahz
import ca from 'react-intl/locale-data/ca';
import cs from 'react-intl/locale-data/cs';
import cy from 'react-intl/locale-data/cy';
import da from 'react-intl/locale-data/da';
import de from 'react-intl/locale-data/de';
import el from 'react-intl/locale-data/el';
import es from 'react-intl/locale-data/es';
import et from 'react-intl/locale-data/et';
import eu from 'react-intl/locale-data/eu';
import fi from 'react-intl/locale-data/fi';
import fr from 'react-intl/locale-data/fr';
import ga from 'react-intl/locale-data/ga';
import gd from 'react-intl/locale-data/gd';
import gl from 'react-intl/locale-data/gl';
import he from 'react-intl/locale-data/he';
import hu from 'react-intl/locale-data/hu';
import hr from 'react-intl/locale-data/hr';
import id from 'react-intl/locale-data/id';
import is from 'react-intl/locale-data/is';
import it from 'react-intl/locale-data/it';
import ja from 'react-intl/locale-data/ja';
import ko from 'react-intl/locale-data/ko';
import lt from 'react-intl/locale-data/lt';
import lv from 'react-intl/locale-data/lv';
import nl from 'react-intl/locale-data/nl';
import nb from 'react-intl/locale-data/nb';
import nn from 'react-intl/locale-data/nn';
import pl from 'react-intl/locale-data/pl';
import pt from 'react-intl/locale-data/pt';
import ro from 'react-intl/locale-data/ro';
import ru from 'react-intl/locale-data/ru';
import sl from 'react-intl/locale-data/sl';
import sk from 'react-intl/locale-data/sk';
import sr from 'react-intl/locale-data/sr';
import sv from 'react-intl/locale-data/sv';
import th from 'react-intl/locale-data/th';
import tr from 'react-intl/locale-data/tr';
import uk from 'react-intl/locale-data/uk';
import vi from 'react-intl/locale-data/vi';
import zh from 'react-intl/locale-data/zh';

import locales, {customLocales, localeMap, isRtl} from './supported-locales.js';
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
    am,
    ar,
    az, // parent for Abkahz
    ca,
    cs,
    cy,
    da,
    de,
    el,
    es,
    et,
    eu,
    fi,
    fr,
    ga,
    gd,
    gl,
    he,
    hu,
    hr,
    id,
    is,
    it,
    ja,
    ko,
    lt,
    lv,
    nl,
    nb,
    nn,
    pl,
    pt,
    sl,
    sk,
    sr,
    sv,
    ro,
    ru,
    th,
    tr,
    uk,
    vi,
    zh
);

for (const lang in customLocales) {
    localeData.push(customLocales[lang]);
}

export {
    locales as default,
    localeMap,
    isRtl,
    localeData // data expected for initializing ReactIntl.addLocaleData
};
