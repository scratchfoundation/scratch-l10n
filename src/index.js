import en from 'react-intl/locale-data/en';
import ar from 'react-intl/locale-data/ar';
import de from 'react-intl/locale-data/de';
import es from 'react-intl/locale-data/es';
import he from 'react-intl/locale-data/he';
import zh from 'react-intl/locale-data/zh';
import locales from './supported-locales.js';

let localeData = locales;
localeData.en.localeData = en;
localeData.ar.localeData = ar;
localeData.de.localeData = de;
localeData.es.localeData = es;
localeData.he.localeData = he;
localeData.zh.localeData = zh;

export {
    localeData as default
};
