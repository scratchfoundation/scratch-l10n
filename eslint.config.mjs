import { eslintConfigScratch } from 'eslint-config-scratch'
import { globalIgnores } from 'eslint/config'
import globals from 'globals'

export default eslintConfigScratch.config(
  eslintConfigScratch.recommended,
  {
    languageOptions: {
      globals: globals.node,
    },
  },
  globalIgnores(['locales/**/*', 'dist/**/*', 'src/locale-data/**/*']),
)
