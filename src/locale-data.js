// temporarily we have all the locale data in scratch-l10n

import en from './locale-data/en';
import af from './locale-data/af';
import am from './locale-data/am';
import ar from './locale-data/ar';
import ast from './locale-data/ast';
import az from './locale-data/az';
import be from './locale-data/be';
import bn from './locale-data/bn';
import bg from './locale-data/bg';
import ca from './locale-data/ca';
import ckb from './locale-data/ckb';
import cs from './locale-data/cs';
import cy from './locale-data/cy';
import da from './locale-data/da';
import de from './locale-data/de';
import el from './locale-data/el';
import eo from './locale-data/eo';
import es from './locale-data/es';
import et from './locale-data/et';
import eu from './locale-data/eu';
import fa from './locale-data/fa';
import fi from './locale-data/fi';
import fil from './locale-data/fil';
import fr from './locale-data/fr';
import fy from './locale-data/fy';
import ga from './locale-data/ga';
import gd from './locale-data/gd';
import gl from './locale-data/gl';
import ha from './locale-data/ha';
import he from './locale-data/he';
import hu from './locale-data/hu';
import hr from './locale-data/hr';
import hy from './locale-data/hy';
import id from './locale-data/id';
import is from './locale-data/is';
import it from './locale-data/it';
import ja from './locale-data/ja';
import ka from './locale-data/ka';
import kk from './locale-data/kk';
import ko from './locale-data/ko';
import km from './locale-data/km';
import ku from './locale-data/ku';
import lt from './locale-data/lt';
import lv from './locale-data/lv';
import mi from './locale-data/mi';
import mn from './locale-data/mn';
import nl from './locale-data/nl';
import nb from './locale-data/nb';
import nn from './locale-data/nn';
import nso from './locale-data/nso';
import or from './locale-data/or';
import pl from './locale-data/pl';
import pt from './locale-data/pt';
import qu from './locale-data/qu';
import ro from './locale-data/ro';
import ru from './locale-data/ru';
import sl from './locale-data/sl';
import sk from './locale-data/sk';
import sr from './locale-data/sr';
import sv from './locale-data/sv';
import sw from './locale-data/sw';
import th from './locale-data/th';
import tr from './locale-data/tr';
import tn from './locale-data/tn';
import uk from './locale-data/uk';
import uz from './locale-data/uz';
import vi from './locale-data/vi';
import xh from './locale-data/xh';
import zh from './locale-data/zh';
import zu from './locale-data/zu';

import {customLocales} from './supported-locales.js';

let localeData = [].concat(
    en,
    af,
    am,
    ar,
    ast,
    az,
    be,
    bg,
    bn,
    ca,
    ckb,
    cs,
    cy,
    da,
    de,
    el,
    eo,
    es,
    et,
    eu,
    fa,
    fi,
    fil,
    fr,
    fy,
    ga,
    gd,
    gl,
    ha,
    he,
    hu,
    hr,
    hy,
    id,
    is,
    it,
    ja,
    ka,
    kk,
    ko,
    km,
    ku,
    lt,
    lv,
    mi,
    mn,
    nl,
    nb,
    nn,
    nso,
    or,
    pl,
    pt,
    sl,
    sk,
    sr,
    sv,
    sw,
    qu,
    ro,
    ru,
    th,
    tn,
    tr,
    uk,
    uz,
    vi,
    xh,
    zh,
    zu
);

for (const lang in customLocales) {
    localeData.push(customLocales[lang]);
}

export {
    localeData as default // data expected for initializing ReactIntl.addLocaleData
};
