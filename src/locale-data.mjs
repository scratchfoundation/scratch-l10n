// temporarily we have all the locale data in scratch-l10n
import af from './locale-data/af.js'
import am from './locale-data/am.js'
import ar from './locale-data/ar.js'
import ast from './locale-data/ast.js'
import az from './locale-data/az.js'
import be from './locale-data/be.js'
import bg from './locale-data/bg.js'
import bn from './locale-data/bn.js'
import ca from './locale-data/ca.js'
import ckb from './locale-data/ckb.js'
import cs from './locale-data/cs.js'
import cy from './locale-data/cy.js'
import da from './locale-data/da.js'
import de from './locale-data/de.js'
import el from './locale-data/el.js'
import en from './locale-data/en.js'
import eo from './locale-data/eo.js'
import es from './locale-data/es.js'
import et from './locale-data/et.js'
import eu from './locale-data/eu.js'
import fa from './locale-data/fa.js'
import fi from './locale-data/fi.js'
import fil from './locale-data/fil.js'
import fr from './locale-data/fr.js'
import fy from './locale-data/fy.js'
import ga from './locale-data/ga.js'
import gd from './locale-data/gd.js'
import gl from './locale-data/gl.js'
import ha from './locale-data/ha.js'
import he from './locale-data/he.js'
import hi from './locale-data/hi.js'
import hr from './locale-data/hr.js'
import hu from './locale-data/hu.js'
import hy from './locale-data/hy.js'
import id from './locale-data/id.js'
import is from './locale-data/is.js'
import it from './locale-data/it.js'
import ja from './locale-data/ja.js'
import ka from './locale-data/ka.js'
import kk from './locale-data/kk.js'
import km from './locale-data/km.js'
import ko from './locale-data/ko.js'
import ku from './locale-data/ku.js'
import lt from './locale-data/lt.js'
import lv from './locale-data/lv.js'
import mi from './locale-data/mi.js'
import mn from './locale-data/mn.js'
import nb from './locale-data/nb.js'
import nl from './locale-data/nl.js'
import nn from './locale-data/nn.js'
import nso from './locale-data/nso.js'
import or from './locale-data/or.js'
import pl from './locale-data/pl.js'
import pt from './locale-data/pt.js'
import qu from './locale-data/qu.js'
import ro from './locale-data/ro.js'
import ru from './locale-data/ru.js'
import sk from './locale-data/sk.js'
import sl from './locale-data/sl.js'
import sr from './locale-data/sr.js'
import sv from './locale-data/sv.js'
import sw from './locale-data/sw.js'
import th from './locale-data/th.js'
import tn from './locale-data/tn.js'
import tr from './locale-data/tr.js'
import uk from './locale-data/uk.js'
import uz from './locale-data/uz.js'
import vi from './locale-data/vi.js'
import xh from './locale-data/xh.js'
import zh from './locale-data/zh.js'
import zu from './locale-data/zu.js'
import { customLocales } from './supported-locales.mjs'

const localeData = [].concat(
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
  hi,
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
  zu,
)

for (const lang in customLocales) {
  localeData.push(customLocales[lang])
}

export {
  localeData as default, // data expected for initializing ReactIntl.addLocaleData
}
