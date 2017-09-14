import {addLocaleData} from 'react-intl';
import en from 'react-intl/locale-data/en';
import ar from 'react-intl/locale-data/ar';
import de from 'react-intl/locale-data/de';
import es from 'react-intl/locale-data/es';
import he from 'react-intl/locale-data/he';

import messages from '../locales/gui-msgs.js'
import locales from './supported-locales.js';

addLocaleData([...en, ...ar, ...de, ...es, ...he]);

export default getLocaleData = () => {
    let data = Object.keys(locales).reduce((collection, lang) => {
        collection[lang] = {
            name: locales[lang],
            messages: messages[lang]
        };
        return collection;
    }, {});
    return data;
}
