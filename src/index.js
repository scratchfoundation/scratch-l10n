import en from 'react-intl/locale-data/en';
import ar from 'react-intl/locale-data/ar';
import de from 'react-intl/locale-data/de';
import es from 'react-intl/locale-data/es';
import he from 'react-intl/locale-data/he';

import {locales} from '../locales/gui-msgs.js';

locales.en.localeData = en;
locales.ar.localeData = ar;
locales.de.localeData = de;
locales.es.localeData = es;
locales.he.localeData = he;

export {
    locales as default
};
